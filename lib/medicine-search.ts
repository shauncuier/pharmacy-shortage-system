import { prisma } from './prisma'

export interface SearchableMedicine {
  id: string
  brandName: string
  genericName: string
  strength: string
  dosageForm: string
  manufacturerId: string
  packDescription?: string | null
  purchaseUnit?: string | null
  retailUnit?: string | null
  searchKeywords?: string | null
  barcode?: string | null
  isActive: boolean
  manufacturer?: {
    id: string
    name: string
    shortName: string | null
  }
  // Pre-lowercased tokens & fields for ultra-fast candidate scoring
  _brandLower: string
  _genericLower: string
  _strengthLower: string
  _mfgLower: string
  _mfgShortLower: string
}

interface SearchIndexData {
  medicines: SearchableMedicine[]
  prefixMap: Map<string, SearchableMedicine[]>
  brandExactMap: Map<string, SearchableMedicine[]>
  lastIndexedAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __medicineSearchIndex: SearchIndexData | undefined
  // eslint-disable-next-line no-var
  var __medicineIndexingPromise: Promise<SearchIndexData> | undefined
}

/**
 * Build the high-performance prefix search index from database.
 */
async function buildIndex(): Promise<SearchIndexData> {
  const records = await prisma.medicine.findMany({
    where: { isActive: true },
    select: {
      id: true,
      brandName: true,
      genericName: true,
      strength: true,
      dosageForm: true,
      manufacturerId: true,
      packDescription: true,
      purchaseUnit: true,
      retailUnit: true,
      searchKeywords: true,
      barcode: true,
      isActive: true,
      manufacturer: {
        select: { id: true, name: true, shortName: true },
      },
    },
  })

  const medicines: SearchableMedicine[] = new Array(records.length)
  const prefixMap = new Map<string, SearchableMedicine[]>()
  const brandExactMap = new Map<string, SearchableMedicine[]>()

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const brandLower = r.brandName.toLowerCase().trim()
    const genericLower = r.genericName.toLowerCase().trim()
    const strengthLower = (r.strength || '').toLowerCase().trim()
    const mfgName = (r.manufacturer?.name || '').toLowerCase().trim()
    const mfgShort = (r.manufacturer?.shortName || '').toLowerCase().trim()

    const med: SearchableMedicine = {
      ...r,
      _brandLower: brandLower,
      _genericLower: genericLower,
      _strengthLower: strengthLower,
      _mfgLower: mfgName,
      _mfgShortLower: mfgShort,
    }
    medicines[i] = med

    // Brand exact map
    let exactList = brandExactMap.get(brandLower)
    if (!exactList) {
      exactList = []
      brandExactMap.set(brandLower, exactList)
    }
    exactList.push(med)

    // Tokenize brand and generic for prefix buckets
    const tokens = [
      ...brandLower.split(/[\s\-+/]+/),
      ...genericLower.split(/[\s\-+/]+/),
    ]

    const seenPrefixes = new Set<string>()
    for (const t of tokens) {
      if (!t) continue
      const maxLen = Math.min(4, t.length)
      for (let len = 1; len <= maxLen; len++) {
        const prefix = t.slice(0, len)
        if (!seenPrefixes.has(prefix)) {
          seenPrefixes.add(prefix)
          let bucket = prefixMap.get(prefix)
          if (!bucket) {
            bucket = []
            prefixMap.set(prefix, bucket)
          }
          bucket.push(med)
        }
      }
    }
  }

  const indexData: SearchIndexData = {
    medicines,
    prefixMap,
    brandExactMap,
    lastIndexedAt: Date.now(),
  }

  global.__medicineSearchIndex = indexData
  return indexData
}

/**
 * Retrieve or build the search index.
 * Cached in global memory across Next.js dev hot-reloads for 0ms access.
 */
export async function getMedicineIndex(): Promise<SearchIndexData> {
  const cached = global.__medicineSearchIndex
  const now = Date.now()

  // 15-minute in-memory cache TTL
  if (cached && cached.medicines.length > 0 && now - cached.lastIndexedAt < 15 * 60 * 1000) {
    return cached
  }

  if (global.__medicineIndexingPromise) {
    return global.__medicineIndexingPromise
  }

  global.__medicineIndexingPromise = buildIndex().finally(() => {
    global.__medicineIndexingPromise = undefined
  })

  return global.__medicineIndexingPromise
}

export function invalidateMedicineIndex() {
  global.__medicineSearchIndex = undefined
  global.__medicineIndexingPromise = undefined
}

/**
 * Ultra-fast medicine search (sub-millisecond execution).
 * Uses prefix buckets to narrow 25,000+ records down to small candidate pools (10-100 items),
 * scoring and ranking them with zero lag.
 */
export async function fastSearchMedicines(
  query: string,
  limit = 30
): Promise<SearchableMedicine[]> {
  const indexData = await getMedicineIndex()
  const q = query.trim().toLowerCase()

  if (!q) {
    return indexData.medicines.slice(0, limit)
  }

  const tokens = q.split(/[\s\-+/]+/).filter(Boolean)
  if (tokens.length === 0) {
    return indexData.medicines.slice(0, limit)
  }

  // 1. Check instant exact brand match
  const exactMatches = indexData.brandExactMap.get(q)
  if (exactMatches && exactMatches.length >= limit) {
    return exactMatches.slice(0, limit)
  }

  // 2. Select the smallest candidate pool using prefix buckets
  let candidatePool: SearchableMedicine[] | null = null

  // Find candidate pool using token prefixes (up to length 4)
  for (const token of tokens) {
    const prefixLen = Math.min(4, token.length)
    for (let len = prefixLen; len >= 1; len--) {
      const p = token.slice(0, len)
      const bucket = indexData.prefixMap.get(p)
      if (bucket && (candidatePool === null || bucket.length < candidatePool.length)) {
        candidatePool = bucket
        // If we found a compact candidate pool (< 300), no need to search further prefixes
        if (candidatePool.length < 300) break
      }
    }
  }

  // Fallback if no prefix matched
  const pool = candidatePool || indexData.medicines

  // 3. Fast candidate scoring
  const matches: Array<{ med: SearchableMedicine; score: number }> = []
  const firstToken = tokens[0]

  for (let i = 0; i < pool.length; i++) {
    const med = pool[i]
    let score = 0
    let allTokensMatch = true

    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t]
      let tokenScore = 0

      // Exact brand match
      if (med._brandLower === token) {
        tokenScore = 800
      } else if (med._brandLower.startsWith(token)) {
        // Higher score the closer the prefix is to the full brand name
        tokenScore = 500 - (med._brandLower.length - token.length) * 5
      } else if (med._brandLower.includes(token)) {
        tokenScore = 220
      }

      // Strength matching (e.g. 500, 20, 10, 650, 40)
      if (med._strengthLower.includes(token)) {
        tokenScore = Math.max(tokenScore, 300)
      }

      // Generic name matching
      if (med._genericLower.startsWith(token)) {
        tokenScore = Math.max(tokenScore, 180)
      } else if (med._genericLower.includes(token)) {
        tokenScore = Math.max(tokenScore, 100)
      }

      // Manufacturer matching
      if (med._mfgShortLower === token || med._mfgLower.startsWith(token)) {
        tokenScore = Math.max(tokenScore, 90)
      }

      if (tokenScore === 0) {
        allTokensMatch = false
        break
      }

      score += tokenScore
    }

    if (allTokensMatch && score > 0) {
      // Bonus if brand name starts with the exact first token
      if (med._brandLower.startsWith(firstToken)) {
        score += 400
      }
      // Bonus if entire brand starts with full raw query
      if (med._brandLower.startsWith(q)) {
        score += 600
      }

      matches.push({ med, score })

      // Optimization: if we have 50 high quality matches, stop scanning
      if (matches.length >= 60 && score > 1000) {
        break
      }
    }
  }

  // 4. Sort top candidates: highest score first, shorter brand name second
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.med.brandName.length !== b.med.brandName.length) {
      return a.med.brandName.length - b.med.brandName.length
    }
    return a.med.brandName.localeCompare(b.med.brandName)
  })

  return matches.slice(0, limit).map((m) => m.med)
}

// Background warmup of the index on module initialization
if (typeof process !== 'undefined') {
  setTimeout(() => {
    getMedicineIndex().catch((err) => {
      console.warn('Background search index warmup:', err)
    })
  }, 100)
}
