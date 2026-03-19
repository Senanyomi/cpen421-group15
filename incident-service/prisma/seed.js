// prisma/seed.js — Run with: node prisma/seed.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mock responders scattered around Accra, Ghana (adjust lat/lng to your region)
const responders = [
  { name: 'Engine 1 — Airport Station',    type: 'FIRE_TRUCK',   status: 'AVAILABLE', latitude: 5.6037,  longitude: -0.1870 },
  { name: 'Engine 2 — Accra Central',      type: 'FIRE_TRUCK',   status: 'AVAILABLE', latitude: 5.5502,  longitude: -0.2174 },
  { name: 'Ambulance A1 — Korle-Bu',       type: 'AMBULANCE',    status: 'AVAILABLE', latitude: 5.5364,  longitude: -0.2275 },
  { name: 'Ambulance A2 — Ridge Hospital', type: 'AMBULANCE',    status: 'AVAILABLE', latitude: 5.5717,  longitude: -0.1969 },
  { name: 'Patrol Unit P1 — Osu',          type: 'POLICE_CAR',   status: 'AVAILABLE', latitude: 5.5516,  longitude: -0.1769 },
  { name: 'Patrol Unit P2 — Tema',         type: 'POLICE_CAR',   status: 'AVAILABLE', latitude: 5.6698,  longitude: -0.0166 },
  { name: 'Patrol Unit P3 — Madina',       type: 'POLICE_CAR',   status: 'BUSY',      latitude: 5.6806,  longitude: -0.1674 },
  { name: 'HazMat Unit H1',                type: 'HAZMAT_UNIT',  status: 'AVAILABLE', latitude: 5.6115,  longitude: -0.2050 },
  { name: 'Rescue Team R1',                type: 'RESCUE_TEAM',  status: 'AVAILABLE', latitude: 5.5913,  longitude: -0.1558 },
  { name: 'Rescue Team R2 — Spintex',      type: 'RESCUE_TEAM',  status: 'OFFLINE',   latitude: 5.6457,  longitude: -0.1280 },
];

async function main() {
  console.log('Seeding responders...');

  await prisma.responder.deleteMany(); // clear previous seeds

  for (const r of responders) {
    await prisma.responder.create({ data: r });
    console.log(`  ✅ ${r.name}`);
  }

  console.log(`\nDone. ${responders.length} responders seeded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
