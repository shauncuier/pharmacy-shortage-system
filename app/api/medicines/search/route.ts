import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { fastSearchMedicines, invalidateMedicineIndex } from '@/lib/medicine-search'

const queryCache = new Map<string, { data: any[]; expiresAt: number }>()

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    if (searchParams.get('refresh') === '1') {
      invalidateMedicineIndex()
      queryCache.clear()
    }
    const rawQuery = (searchParams.get('q') || '').trim()
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)))

    const cacheKey = `${rawQuery.toLowerCase()}___${limit}`
    const cached = queryCache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(
        { medicines: cached.data },
        {
          headers: {
            'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
            'X-Search-Cache': 'HIT',
          },
        }
      )
    }

    const results = await fastSearchMedicines(rawQuery, limit)

    // Keep cache bounded to 500 entries
    if (queryCache.size > 500) {
      const oldestKey = queryCache.keys().next().value
      if (oldestKey) queryCache.delete(oldestKey)
    }
    queryCache.set(cacheKey, { data: results, expiresAt: Date.now() + 60000 })

    return NextResponse.json(
      { medicines: results },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
          'X-Search-Cache': 'MISS',
        },
      }
    )
  } catch (error) {
    console.error('Medicine search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
