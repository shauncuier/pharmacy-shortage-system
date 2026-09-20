import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clean() {
  console.log('🧹 Clearing all demo/dummy data from database...')
  await prisma.saleItem.deleteMany()
  await prisma.sale.deleteMany()
  await prisma.retailerPayment.deleteMany()
  await prisma.wholesaleOrderItem.deleteMany()
  await prisma.wholesaleOrder.deleteMany()
  await prisma.retailer.deleteMany()
  await prisma.shortage.deleteMany()
  await prisma.medicine.deleteMany()
  await prisma.manufacturer.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.user.deleteMany()
  console.log('✅ All demo data cleared. Database is clean.')
}

clean()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
