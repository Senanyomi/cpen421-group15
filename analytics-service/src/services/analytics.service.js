// src/services/analytics.service.js
const prisma = require('../utils/prisma');
const { parseDateRange, formatDuration } = require('../utils/dateRange');

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE TIMES
// GET /analytics/response-times
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns average, min, max, and P90 response times.
 * "Time to dispatch" = seconds from report to first vehicle assigned.
 * "Time to resolve"  = seconds from report to incident resolved/closed.
 *
 * Supports optional ?from=&to= date range and ?type= incident type filter.
 */
const getResponseTimes = async (query) => {
  const dateRange = parseDateRange(query);
  const where = {
    reportedAt: dateRange,
    // Only include incidents that have a measured time
    timeToDispatchSec: { not: null },
  };
  if (query.type) where.type = query.type;

  const logs = await prisma.incidentLog.findMany({
    where,
    select: {
      incidentId:        true,
      type:              true,
      timeToDispatchSec: true,
      timeToResolveSec:  true,
      reportedAt:        true,
    },
    orderBy: { reportedAt: 'desc' },
  });

  if (logs.length === 0) {
    return {
      period: { from: dateRange.gte, to: dateRange.lte },
      totalIncidents: 0,
      timeToDispatch: null,
      timeToResolve: null,
      byType: [],
    };
  }

  // ── Overall stats ──────────────────────────────────────────────────────────
  const dispatchTimes = logs.map((l) => l.timeToDispatchSec).filter(Boolean).sort((a, b) => a - b);
  const resolveTimes  = logs.map((l) => l.timeToResolveSec).filter(Boolean).sort((a, b) => a - b);

  const stats = (arr) => {
    if (!arr.length) return null;
    const sum = arr.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / arr.length);
    const p90 = arr[Math.floor(arr.length * 0.9)] ?? arr[arr.length - 1];
    return {
      avgSec:       avg,
      avgFormatted: formatDuration(avg),
      minSec:       arr[0],
      minFormatted: formatDuration(arr[0]),
      maxSec:       arr[arr.length - 1],
      maxFormatted: formatDuration(arr[arr.length - 1]),
      p90Sec:       p90,
      p90Formatted: formatDuration(p90),
      sampleSize:   arr.length,
    };
  };

  // ── Breakdown by incident type ─────────────────────────────────────────────
  const typeMap = {};
  for (const log of logs) {
    if (!typeMap[log.type]) typeMap[log.type] = { dispatch: [], resolve: [] };
    if (log.timeToDispatchSec) typeMap[log.type].dispatch.push(log.timeToDispatchSec);
    if (log.timeToResolveSec)  typeMap[log.type].resolve.push(log.timeToResolveSec);
  }

  const byType = Object.entries(typeMap).map(([type, times]) => ({
    type,
    incidentCount:  times.dispatch.length,
    timeToDispatch: stats(times.dispatch.sort((a, b) => a - b)),
    timeToResolve:  stats(times.resolve.sort((a, b) => a - b)),
  }));

  return {
    period:         { from: dateRange.gte, to: dateRange.lte },
    totalIncidents: logs.length,
    timeToDispatch: stats(dispatchTimes),
    timeToResolve:  stats(resolveTimes),
    byType,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// INCIDENTS BY REGION
// GET /analytics/incidents-by-region
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Counts incidents per geographic region bucket.
 * Returns a ranked list — highest incident count first.
 */
const getIncidentsByRegion = async (query) => {
  const dateRange = parseDateRange(query);
  const where = { reportedAt: dateRange };
  if (query.type) where.type = query.type;

  // Use Prisma's groupBy to count per region
  const grouped = await prisma.incidentLog.groupBy({
    by:      ['region', 'type'],
    where,
    _count:  { incidentId: true },
    orderBy: { _count: { incidentId: 'desc' } },
  });

  // Roll up: first by region, then show type breakdown within each region
  const regionMap = {};
  for (const row of grouped) {
    const region = row.region || 'UNKNOWN';
    if (!regionMap[region]) regionMap[region] = { total: 0, byType: {} };
    regionMap[region].total += row._count.incidentId;
    regionMap[region].byType[row.type] = (regionMap[region].byType[row.type] || 0) + row._count.incidentId;
  }

  const regions = Object.entries(regionMap)
    .map(([region, data]) => ({
      region,
      totalIncidents: data.total,
      byType: Object.entries(data.byType)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.totalIncidents - a.totalIncidents);

  // Total incidents in period (for percentage calculation)
  const grandTotal = regions.reduce((sum, r) => sum + r.totalIncidents, 0);

  return {
    period:      { from: dateRange.gte, to: dateRange.lte },
    grandTotal,
    regionCount: regions.length,
    regions:     regions.map((r) => ({
      ...r,
      sharePercent: grandTotal > 0
        ? Math.round((r.totalIncidents / grandTotal) * 1000) / 10  // 1 decimal place
        : 0,
    })),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCE UTILISATION
// GET /analytics/resource-utilization
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Shows how heavily each vehicle type is being used.
 * "Deployments" = number of assignment events in the period.
 * "Active pings" = number of moving GPS pings recorded.
 */
const getResourceUtilization = async (query) => {
  const dateRange = parseDateRange(query);

  // ── Deployments per vehicle type ───────────────────────────────────────────
  const deployments = await prisma.assignmentLog.groupBy({
    by:      ['vehicleType'],
    where:   { assignedAt: dateRange },
    _count:  { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  // ── Active GPS pings per vehicle type (proxy for time-in-motion) ───────────
  const locationActivity = await prisma.locationLog.groupBy({
    by:      ['vehicleType', 'vehicleStatus'],
    where:   { recordedAt: dateRange },
    _count:  { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  // ── Total unique vehicles seen in GPS pings ────────────────────────────────
  const uniqueVehicles = await prisma.locationLog.groupBy({
    by:    ['vehicleId', 'vehicleType'],
    where: { recordedAt: dateRange },
  });

  // ── Most active individual vehicles ───────────────────────────────────────
  const vehicleActivity = await prisma.assignmentLog.groupBy({
    by:      ['vehicleId', 'callSign', 'vehicleType'],
    where:   { assignedAt: dateRange },
    _count:  { id: true },
    orderBy: { _count: { id: 'desc' } },
    take:    10,
  });

  // Merge deployment + location data by vehicle type
  const typeMap = {};

  for (const d of deployments) {
    const t = d.vehicleType;
    if (!typeMap[t]) typeMap[t] = { vehicleType: t, deployments: 0, locationPings: 0, uniqueVehicles: 0 };
    typeMap[t].deployments = d._count.id;
  }

  for (const l of locationActivity) {
    const t = l.vehicleType;
    if (!typeMap[t]) typeMap[t] = { vehicleType: t, deployments: 0, locationPings: 0, uniqueVehicles: 0 };
    typeMap[t].locationPings += l._count.id;
  }

  for (const v of uniqueVehicles) {
    const t = v.vehicleType;
    if (!typeMap[t]) typeMap[t] = { vehicleType: t, deployments: 0, locationPings: 0, uniqueVehicles: 0 };
    typeMap[t].uniqueVehicles += 1;
  }

  const byType = Object.values(typeMap).sort((a, b) => b.deployments - a.deployments);

  const totalDeployments = byType.reduce((s, t) => s + t.deployments, 0);

  return {
    period:             { from: dateRange.gte, to: dateRange.lte },
    totalDeployments,
    byVehicleType:      byType.map((t) => ({
      ...t,
      deploymentSharePercent: totalDeployments > 0
        ? Math.round((t.deployments / totalDeployments) * 1000) / 10
        : 0,
    })),
    mostActiveVehicles: vehicleActivity.map((v) => ({
      vehicleId:   v.vehicleId,
      callSign:    v.callSign,
      vehicleType: v.vehicleType,
      deployments: v._count.id,
    })),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY DASHBOARD
// GET /analytics/summary-dashboard
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Single endpoint that returns everything the dashboard needs in one call.
 * Designed to power a command-centre screen — keep it fast.
 */
const getSummaryDashboard = async (query) => {
  const dateRange = parseDateRange(query);

  // Run all queries in parallel
  const [
    totalIncidents,
    resolvedIncidents,
    unresolvedByStatus,
    incidentsByType,
    avgDispatch,
    avgResolve,
    totalDeployments,
    recentIncidents,
    recentAssignments,
    dailyTrend,
  ] = await Promise.all([

    // Total incidents in period
    prisma.incidentLog.count({ where: { reportedAt: dateRange } }),

    // Resolved incidents
    prisma.incidentLog.count({
      where: { reportedAt: dateRange, status: { in: ['RESOLVED', 'CLOSED'] } },
    }),

    // Current open incidents grouped by status
    prisma.incidentLog.groupBy({
      by:    ['status'],
      where: { reportedAt: dateRange, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      _count: { incidentId: true },
    }),

    // Incident breakdown by type
    prisma.incidentLog.groupBy({
      by:      ['type'],
      where:   { reportedAt: dateRange },
      _count:  { incidentId: true },
      orderBy: { _count: { incidentId: 'desc' } },
    }),

    // Average time to dispatch (seconds) — raw SQL aggregate via Prisma
    prisma.incidentLog.aggregate({
      where:   { reportedAt: dateRange, timeToDispatchSec: { not: null } },
      _avg:    { timeToDispatchSec: true },
      _min:    { timeToDispatchSec: true },
      _max:    { timeToDispatchSec: true },
    }),

    // Average time to resolve
    prisma.incidentLog.aggregate({
      where:   { reportedAt: dateRange, timeToResolveSec: { not: null } },
      _avg:    { timeToResolveSec: true },
      _min:    { timeToResolveSec: true },
      _max:    { timeToResolveSec: true },
    }),

    // Total vehicle deployments
    prisma.assignmentLog.count({ where: { assignedAt: dateRange } }),

    // 5 most recent incidents
    prisma.incidentLog.findMany({
      where:   { reportedAt: dateRange },
      orderBy: { reportedAt: 'desc' },
      take:    5,
      select:  { incidentId: true, type: true, status: true, region: true, reportedAt: true, timeToDispatchSec: true },
    }),

    // 5 most recent assignments
    prisma.assignmentLog.findMany({
      where:   { assignedAt: dateRange },
      orderBy: { assignedAt: 'desc' },
      take:    5,
    }),

    // Incident count per day for the trend chart (last 14 days max)
    prisma.$queryRaw`
      SELECT
        DATE_TRUNC('day', reported_at) AS day,
        COUNT(*)::int                  AS incident_count
      FROM incident_logs
      WHERE reported_at >= ${dateRange.gte}
        AND reported_at <= ${dateRange.lte}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  const resolutionRate = totalIncidents > 0
    ? Math.round((resolvedIncidents / totalIncidents) * 1000) / 10
    : 0;

  const roundSec = (val) => val != null ? Math.round(val) : null;

  return {
    period: { from: dateRange.gte, to: dateRange.lte },

    incidents: {
      total:          totalIncidents,
      resolved:       resolvedIncidents,
      resolutionRate: `${resolutionRate}%`,
      openByStatus:   unresolvedByStatus.map((r) => ({ status: r.status, count: r._count.incidentId })),
      byType:         incidentsByType.map((r) => ({ type: r.type, count: r._count.incidentId })),
    },

    responseTimes: {
      avgTimeToDispatch: {
        sec:       roundSec(avgDispatch._avg.timeToDispatchSec),
        formatted: formatDuration(roundSec(avgDispatch._avg.timeToDispatchSec)),
        minSec:    avgDispatch._min.timeToDispatchSec,
        maxSec:    avgDispatch._max.timeToDispatchSec,
      },
      avgTimeToResolve: {
        sec:       roundSec(avgResolve._avg.timeToResolveSec),
        formatted: formatDuration(roundSec(avgResolve._avg.timeToResolveSec)),
        minSec:    avgResolve._min.timeToResolveSec,
        maxSec:    avgResolve._max.timeToResolveSec,
      },
    },

    resources: {
      totalDeployments,
      deploymentsPerIncident: totalIncidents > 0
        ? Math.round((totalDeployments / totalIncidents) * 10) / 10
        : 0,
    },

    recentActivity: {
      incidents:   recentIncidents,
      assignments: recentAssignments,
    },

    trend: dailyTrend.map((row) => ({
      date:           row.day,
      incidentCount:  row.incident_count,
    })),
  };
};

module.exports = {
  getResponseTimes,
  getIncidentsByRegion,
  getResourceUtilization,
  getSummaryDashboard,
};
