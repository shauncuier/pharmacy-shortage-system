import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Role, ShortageStatus } from '@prisma/client'
import { createAuditLog } from '@/lib/audit'
import { getLocalDateString } from '@/lib/date-utils'
import { notifyShortageChange } from '@/lib/shortage-events'

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const targetStatus = body.status as ShortageStatus
    const date = body.date || getLocalDateString()
    const shortageIds: string[] | undefined = body.shortageIds

    if (!([ShortageStatus.REVIEWED, ShortageStatus.ORDERED, ShortageStatus.CANCELLED] as ShortageStatus[]).includes(targetStatus)) {
      return NextResponse.json({ error: 'Invalid target status' }, { status: 400 })
    }



    const whereClause: any = {}
    if (shortageIds && shortageIds.length > 0) {
      whereClause.id = { in: shortageIds }
    } else {
      whereClause.reportedDate = date
      whereClause.status = ShortageStatus.REPORTED
    }

    const updateData: any = {
      status: targetStatus,
    }

    if (targetStatus === ShortageStatus.REVIEWED) {
      updateData.reviewedAt = new Date()
      updateData.reviewedBy = user.name
    } else if (targetStatus === ShortageStatus.ORDERED) {
      updateData.orderedAt = new Date()
      updateData.orderedBy = user.name
    }

    const result = await prisma.shortage.updateMany({
      where: whereClause,
      data: updateData,
    })

    await createAuditLog('SHORTAGES_BULK_STATUS_CHANGE', {
      userId: user.userId,
      details: `Bulk updated ${result.count} shortages to status ${targetStatus} for date ${date}.`,
    })

    notifyShortageChange('bulk-review', { count: result.count, status: targetStatus })

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      status: targetStatus,
    })
  } catch (error) {
    console.error('Bulk review error:', error)
    return NextResponse.json({ error: 'Failed to bulk update shortages' }, { status: 500 })
  }
}
