import { NextRequest, NextResponse } from 'next/server'
import { BOROUGH_CODES, ZIP_TO_NEIGHBORHOOD } from '@/lib/data-sources'

// Edge runtime can reduce cold-start/latency on Vercel for small endpoints.
export const runtime = 'edge'

// Pad BBL to exactly 10 digits
function padBBL(bbl: string): string {
  if (!bbl) return ''
  // BBL format: 1 digit borough + 5 digit block + 4 digit lot = 10 total
  const clean = bbl.replace(/\D/g, '')
  if (clean.length === 10) return clean
  if (clean.length < 10) return clean.padStart(10, '0')
  return clean.slice(0, 10)
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  if (!query || query.length < 2) return NextResponse.json({ suggestions: [] })

  try {
    const q = query.trim()
    const qUpper = q.toUpperCase().replace(/'/g, "''")

    // Socrata's $q (full-text) is often faster than LIKE; try it first.
    // Keep the payload tiny; we only need a handful of suggestions.
    const primaryQuery = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$q=${encodeURIComponent(q)}&$limit=12&$select=bbl,address,borough,zipcode,unitsres&$order=unitsres DESC`
    const primaryRes = await fetch(primaryQuery, {
      headers: { Accept: 'application/json' },
      // Cache results at the edge for a few minutes (good for repeated searches).
      next: { revalidate: 300 },
    })

    let data = await primaryRes.json()

    // If full-text is empty, fall back to LIKE.
    // Heuristic: if the user starts with a building number, prefix matching is usually what they expect.
    // NOTE: Don't manually put URL-encoded "%25" in the SQL pattern; encode the whole $where instead.
    if (!Array.isArray(data) || data.length === 0) {
      const likePattern = qUpper.match(/^\d/) ? `${qUpper}%` : `%${qUpper}%`
      const where = `upper(address) LIKE '${likePattern}'`
      const fallbackQuery = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=${encodeURIComponent(where)}&$limit=12&$select=bbl,address,borough,zipcode,unitsres&$order=unitsres DESC`
      const fallbackRes = await fetch(fallbackQuery, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 300 },
      })
      data = await fallbackRes.json()
    }

    if (!Array.isArray(data)) return NextResponse.json({ suggestions: [] })

    const seen = new Set<string>()
    const suggestions = data
      .filter((item: any) => {
        if (!item.address || !item.bbl) return false
        const paddedBBL = padBBL(item.bbl)
        if (paddedBBL.length !== 10 || seen.has(item.address)) return false
        seen.add(item.address)
        return true
      })
      .map((item: any) => ({
        bbl: padBBL(item.bbl),
        address: item.address,
        borough: BOROUGH_CODES[item.borough] || item.borough || '',
        zipcode: item.zipcode || '',
        neighborhood: ZIP_TO_NEIGHBORHOOD[item.zipcode] || '',
        units: +item.unitsres || 0,
      }))
      .slice(0, 8)

    return NextResponse.json({ suggestions })
  } catch (e) {
    console.error('Autocomplete error:', e)
    return NextResponse.json({ suggestions: [] })
  }
}
