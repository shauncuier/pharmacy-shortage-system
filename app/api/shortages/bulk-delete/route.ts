import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Role } from '@prisma/client'
import { createAuditLog } from '@/lib/audit'
import { notifyShortageChange } from '@/lib/shortage-events'

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const shortageIds: string[] | undefined = body.shortageIds

    if (!Array.isArray(shortageIds) || shortageIds.length === 0) {
      return NextResponse.json({ error: 'No shortage IDs provided for deletion' }, { status: 400 })
    }

    const result = await prisma.shortage.deleteMany({
      where: {
        id: { in: shortageIds },
      },
    })

    await createAuditLog('SHORTAGES_BULK_DELETED', {
      userId: user.userId,
      details: `Admin ${user.name} (${user.employeeId}) bulk deleted ${result.count} shortages.`,
    })

    notifyShortageChange('bulk-delete', { deletedCount: result.count })

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Successfully deleted ${result.count} shortage record(s)`,
    })
  } catch (error) {
    console.error('Bulk delete error:', error)
    return NextResponse.json({ error: 'Failed to bulk delete shortages' }, { status: 500 })
  }
}
