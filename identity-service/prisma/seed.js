// prisma/seed.js — Run with: node prisma/seed.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const password = await bcrypt.hash('Admin@1234', rounds);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@nerdcp.gov' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@nerdcp.gov',
      password,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Seed complete. Admin user ready: ${admin.email}`);
  console.log('   Default password: Admin@1234  ← change this immediately!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
