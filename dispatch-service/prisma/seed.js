// prisma/seed.js — Run with: node prisma/seed.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Starting positions around Accra, Ghana — adjust to your region
const vehicles = [
  // Fire trucks
  { callSign: 'FIRE-01', type: 'FIRE_TRUCK',  status: 'AVAILABLE', latitude: 5.6037,  longitude: -0.1870 },
  { callSign: 'FIRE-02', type: 'FIRE_TRUCK',  status: 'AVAILABLE', latitude: 5.5502,  longitude: -0.2174 },
  { callSign: 'FIRE-03', type: 'FIRE_TRUCK',  status: 'OFFLINE',   latitude: 5.5720,  longitude: -0.2300 },

  // Ambulances
  { callSign: 'AMB-01',  type: 'AMBULANCE',   status: 'AVAILABLE', latitude: 5.5364,  longitude: -0.2275 },
  { callSign: 'AMB-02',  type: 'AMBULANCE',   status: 'AVAILABLE', latitude: 5.5717,  longitude: -0.1969 },
  { callSign: 'AMB-03',  type: 'AMBULANCE',   status: 'DISPATCHED',latitude: 5.6100,  longitude: -0.1820 },

  // Police cars
  { callSign: 'POL-01',  type: 'POLICE_CAR',  status: 'AVAILABLE', latitude: 5.5516,  longitude: -0.1769 },
  { callSign: 'POL-02',  type: 'POLICE_CAR',  status: 'AVAILABLE', latitude: 5.6698,  longitude: -0.0166 },
  { callSign: 'POL-03',  type: 'POLICE_CAR',  status: 'ON_SCENE',  latitude: 5.6806,  longitude: -0.1674 },
  { callSign: 'POL-04',  type: 'POLICE_CAR',  status: 'AVAILABLE', latitude: 5.6400,  longitude: -0.1900 },

  // Specialist units
  { callSign: 'HAZ-01',  type: 'HAZMAT_UNIT', status: 'AVAILABLE', latitude: 5.6115,  longitude: -0.2050 },
  { callSign: 'RES-01',  type: 'RESCUE_TEAM', status: 'AVAILABLE', latitude: 5.5913,  longitude: -0.1558 },
  { callSign: 'CMD-01',  type: 'COMMAND_UNIT',status: 'AVAILABLE', latitude: 5.5800,  longitude: -0.2000 },
];

async function main() {
  console.log('Seeding vehicles...');
  await prisma.vehicle.deleteMany();

  for (const v of vehicles) {
    await prisma.vehicle.create({
      data: { ...v, lastUpdated: new Date() },
    });
    console.log(`  ✅ ${v.callSign} [${v.type}]`);
  }

  console.log(`\nDone — ${vehicles.length} vehicles seeded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
