import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createSuperUser() {
  const employeeId = (process.argv[2] || 'SUPERUSER').trim().toUpperCase()
  const pin = process.argv[3] || '1234'
  const name = process.argv[4] || 'Super Administrator'

  console.log('====================================================')
  console.log('👑 CREATING / UPDATING SUPERUSER ACCOUNT')
  console.log('====================================================')
  console.log(`Employee ID : ${employeeId}`)
  console.log(`Name        : ${name}`)
  console.log(`Role        : ADMIN (Superuser)`)
  console.log(`PIN         : ${pin}`)
  console.log('----------------------------------------------------')

  const passwordHash = await bcrypt.hash(pin, 10)

  const user = await prisma.user.upsert({
    where: { employeeId },
    update: {
      name,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      employeeId,
      name,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  })

  console.log(`✅ Superuser "${user.employeeId}" successfully configured!`)
  console.log('You can now log in with full administrative privileges.')
  console.log('====================================================\n')
}

createSuperUser()
  .catch((err) => {
    console.error('Failed to create superuser:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
