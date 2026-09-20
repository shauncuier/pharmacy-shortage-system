import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function verify() {
  const [u, m, mf, mp, shor, ret, sales] = await Promise.all([
    p.user.count(),
    p.medicine.count(),
    p.manufacturer.count(),
    p.medicine.count({ where: { mrp: { not: null } } }),
    p.shortage.count(),
    p.retailer.count(),
    p.sale.count(),
  ])
  console.log('=== PRODUCTION DATABASE STATE ===')
  console.log('Users              :', u)
  console.log('Medicines          :', m)
  console.log('Medicines (priced) :', mp)
  console.log('Manufacturers      :', mf)
  console.log('Shortages          :', shor)
  console.log('Retailers          :', ret)
  console.log('POS Sales          :', sales)
}

verify().finally(() => p.$disconnect())
