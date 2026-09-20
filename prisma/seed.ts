import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('====================================================')
  console.log('🏥 PRODUCTION SEED — SUPERUSER ACCOUNT ONLY')
  console.log('====================================================\n')

  // Upsert the Superuser — idempotent, safe to re-run
  const passwordHash = await bcrypt.hash('1234', 10)

  const superuser = await prisma.user.upsert({
    where: { employeeId: 'SUPERUSER' },
    update: {
      name: 'Super Administrator',
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      employeeId: 'SUPERUSER',
      name: 'Super Administrator',
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  })

  // Ensure system settings exist
  await prisma.systemSetting.upsert({
    where: { key: 'pharmacy_name' },
    update: {},
    create: { key: 'pharmacy_name', value: 'Bara-Awlia Medical Hall' },
  })
  await prisma.systemSetting.upsert({
    where: { key: 'require_quantity' },
    update: {},
    create: { key: 'require_quantity', value: 'false' },
  })

  await prisma.auditLog.create({
    data: {
      action: 'SYSTEM_SEEDED',
      userId: superuser.id,
      details: 'Production seed: Superuser account created/verified.',
    },
  })

  console.log('✅ SUPERUSER account ready!')
  console.log('====================================================')
  console.log('  Employee ID : SUPERUSER')
  console.log('  PIN         : 1234  ← Change this after first login!')
  console.log('  Role        : ADMIN (Full Access)')
  console.log('====================================================')
  console.log('\nNext steps:')
  console.log('  1. Log in as SUPERUSER with PIN 1234')
  console.log('  2. Go to Admin → Employees → Add your real staff')
  console.log('  3. Change the SUPERUSER PIN from Settings\n')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
