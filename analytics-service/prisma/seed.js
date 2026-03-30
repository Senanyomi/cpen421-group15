// prisma/seed.js — Run with: node prisma/seed.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Sample incident log data (past 30 days)
const incidentLogs = [
  {
    incidentId: 'INC-001',
    type: 'STRUCTURE_FIRE',
    status: 'RESOLVED',
    latitude: 5.6037,
    longitude: -0.1870,
    region: 'AIRPORT_STATION',
    reportedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
    dispatchedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000 + 3 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
    timeToDispatchSec: 180,
    timeToResolveSec: 2700,
  },
  {
    incidentId: 'INC-002',
    type: 'VEHICLE_ACCIDENT',
    status: 'RESOLVED',
    latitude: 5.5502,
    longitude: -0.2174,
    region: 'ACCRA_CENTRAL',
    reportedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    dispatchedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000 + 2 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000),
    timeToDispatchSec: 120,
    timeToResolveSec: 1500,
  },
  {
    incidentId: 'INC-003',
    type: 'MEDICAL_EMERGENCY',
    status: 'RESOLVED',
    latitude: 5.5364,
    longitude: -0.2275,
    region: 'KORLE_BU',
    reportedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    dispatchedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 + 1 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 + 12 * 60 * 1000),
    timeToDispatchSec: 60,
    timeToResolveSec: 660,
  },
  {
    incidentId: 'INC-004',
    type: 'STRUCTURAL_COLLAPSE',
    status: 'RESOLVED',
    latitude: 5.5717,
    longitude: -0.1969,
    region: 'RIDGE_HOSPITAL',
    reportedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    dispatchedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
    timeToDispatchSec: 300,
    timeToResolveSec: 5400,
  },
  {
    incidentId: 'INC-005',
    type: 'WILDFIRE',
    status: 'RESOLVED',
    latitude: 5.5516,
    longitude: -0.1769,
    region: 'OSU',
    reportedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    dispatchedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 120 * 60 * 1000),
    timeToDispatchSec: 240,
    timeToResolveSec: 7200,
  },
  {
    incidentId: 'INC-006',
    type: 'HAZMAT_INCIDENT',
    status: 'RESOLVED',
    latitude: 5.6698,
    longitude: -0.0166,
    region: 'TEMA',
    reportedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    dispatchedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 8 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
    timeToDispatchSec: 480,
    timeToResolveSec: 3600,
  },
  {
    incidentId: 'INC-007',
    type: 'MEDICAL_EMERGENCY',
    status: 'RESOLVED',
    latitude: 5.6806,
    longitude: -0.1674,
    region: 'MADINA',
    reportedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    dispatchedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000),
    timeToDispatchSec: 120,
    timeToResolveSec: 1080,
  },
  {
    incidentId: 'INC-008',
    type: 'VEHICLE_ACCIDENT',
    status: 'RESOLVED',
    latitude: 5.6115,
    longitude: -0.2050,
    region: 'SPINTEX',
    reportedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    dispatchedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
    timeToDispatchSec: 180,
    timeToResolveSec: 1620,
  },
];

// Sample assignment log data
const assignmentLogs = [
  {
    vehicleId: 'FIRE-01',
    callSign: 'FIRE-01',
    vehicleType: 'FIRE_TRUCK',
    incidentId: 'INC-001',
    assignedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000 + 3 * 60 * 1000),
  },
  {
    vehicleId: 'AMB-01',
    callSign: 'AMB-01',
    vehicleType: 'AMBULANCE',
    incidentId: 'INC-003',
    assignedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 + 1 * 60 * 1000),
  },
  {
    vehicleId: 'POL-01',
    callSign: 'POL-01',
    vehicleType: 'POLICE_CAR',
    incidentId: 'INC-002',
    assignedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000 + 2 * 60 * 1000),
  },
  {
    vehicleId: 'HAZ-01',
    callSign: 'HAZ-01',
    vehicleType: 'HAZMAT_UNIT',
    incidentId: 'INC-006',
    assignedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 8 * 60 * 1000),
  },
  {
    vehicleId: 'RES-01',
    callSign: 'RES-01',
    vehicleType: 'RESCUE_TEAM',
    incidentId: 'INC-004',
    assignedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
  },
  {
    vehicleId: 'FIRE-02',
    callSign: 'FIRE-02',
    vehicleType: 'FIRE_TRUCK',
    incidentId: 'INC-005',
    assignedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 1000),
  },
  {
    vehicleId: 'AMB-02',
    callSign: 'AMB-02',
    vehicleType: 'AMBULANCE',
    incidentId: 'INC-007',
    assignedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 1000),
  },
  {
    vehicleId: 'POL-02',
    callSign: 'POL-02',
    vehicleType: 'POLICE_CAR',
    incidentId: 'INC-008',
    assignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 1000),
  },
];

async function main() {
  console.log('Seeding analytics data...');

  // Clear existing data
  await prisma.assignmentLog.deleteMany();
  await prisma.incidentLog.deleteMany();

  // Seed incident logs
  for (const incident of incidentLogs) {
    await prisma.incidentLog.create({ data: incident });
    console.log(`  ✅ Incident ${incident.incidentId} [${incident.type}]`);
  }

  // Seed assignment logs
  for (const assignment of assignmentLogs) {
    await prisma.assignmentLog.create({ data: assignment });
    console.log(`  ✅ Assignment ${assignment.callSign} → ${assignment.incidentId}`);
  }

  console.log(`\nDone. ${incidentLogs.length} incidents and ${assignmentLogs.length} assignments seeded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
