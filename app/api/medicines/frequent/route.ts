import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

let cachedFrequent: { data: any[]; expiresAt: number } | null = null

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Serve from 60-second in-memory cache if fresh
    if (cachedFrequent && Date.now() < cachedFrequent.expiresAt) {
      return NextResponse.json(
        { frequent: cachedFrequent.data },
        { headers: { 'Cache-Control': 'private, max-age=60', 'X-Cache': 'HIT' } }
      )
    }

    // Find top reported medicines in the system
    const topShortageGroups = await prisma.shortage.groupBy({
      by: ['medicineId'],
      _count: {
        medicineId: true,
      },
      orderBy: {
        _count: {
          medicineId: 'desc',
        },
      },
      take: 8,
    })

    const topMedIds = topShortageGroups.map((g) => g.medicineId)

    let frequentMedicines: Array<{
      id: string
      brandName: string
      strength: string
      dosageForm: string
      genericName: string
      purchaseUnit: string | null
      retailUnit: string | null
      manufacturer: { id: string; name: string; shortName: string | null }
    }> = []

    if (topMedIds.length > 0) {
      frequentMedicines = await prisma.medicine.findMany({
        where: {
          id: { in: topMedIds },
          isActive: true,
        },
        include: {
          manufacturer: {
            select: { id: true, name: true, shortName: true },
          },
        },
      })
    }

    // If fewer than 4 frequent medicines exist, backfill with default active medicines
    if (frequentMedicines.length < 4) {
      const existingIds = new Set(frequentMedicines.map((m) => m.id))
      const backfill = await prisma.medicine.findMany({
        where: {
          isActive: true,
          id: { notIn: Array.from(existingIds) },
        },
        include: {
          manufacturer: {
            select: { id: true, name: true, shortName: true },
          },
        },
        take: 8 - frequentMedicines.length,
        orderBy: { brandName: 'asc' },
      })
      frequentMedicines = [...frequentMedicines, ...backfill]
    }

    cachedFrequent = { data: frequentMedicines, expiresAt: Date.now() + 60000 }

    return NextResponse.json(
      { frequent: frequentMedicines },
      { headers: { 'Cache-Control': 'private, max-age=60', 'X-Cache': 'MISS' } }
    )
  } catch (error) {
    console.error('Frequent medicines error:', error)
    return NextResponse.json({ error: 'Failed to load frequent medicines' }, { status: 500 })
  }
}
