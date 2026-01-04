import { NextRequest, NextResponse } from 'next/server'
import { BOROUGH_NUMBERS } from '@/lib/data-sources'

// Pad BBL to exactly 10 digits
function padBBL(bbl: string): string {
  if (!bbl) return ''
  const clean = bbl.replace(/\D/g, '')
  if (clean.length === 10) return clean
  if (clean.length < 10) return clean.padStart(10, '0')
  return clean.slice(0, 10)
}

function parseAddress(input: string) {
  const cleaned = input.trim().toLowerCase()
  let borough: string | null = null, addressPart = cleaned
  
  for (const [name, code] of Object.entries(BOROUGH_NUMBERS)) {
    if (cleaned.includes(name)) {
      borough = code
      addressPart = cleaned.replace(new RegExp(`,?\\s*${name}.*$`, 'i'), '').trim()
      break
    }
  }
  
  const match = addressPart.match(/^(\d+[-\d]*)\s+(.+)$/)
  return match ? { houseNumber: match[1], streetName: match[2].replace(/,.*$/, '').trim(), borough } : { houseNumber: '', streetName: addressPart, borough }
}

function normalizeStreet(street: string): string {
  return street.toLowerCase()
    .replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave')
    .replace(/\bplace\b/g, 'pl').replace(/\bboulevard\b/g, 'blvd')
    .replace(/\broad\b/g, 'rd').replace(/\bdrive\b/g, 'dr')
    .replace(/\beast\b/g, 'e').replace(/\bwest\b/g, 'w')
    .replace(/\bnorth\b/g, 'n').replace(/\bsouth\b/g, 's')
    .replace(/[^a-z0-9\s]/g, '').trim()
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) return NextResponse.json({ error: 'Address required' }, { status: 400 })

  try {
    // First try full-text search
    const searchQuery = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=address LIKE '%25${address.toUpperCase().replace(/'/g, "''")}%25'&$limit=10`
    const res = await fetch(searchQuery, { headers: { 'Accept': 'application/json' } })
    let data = await res.json()

    // Fallback to $q search
    if (!data?.length) {
      const fallback = await fetch(`https://data.cityofnewyork.us/resource/64uk-42ks.json?$q=${encodeURIComponent(address)}&$limit=10`)
      data = await fallback.json()
    }

    if (!data?.length) {
      return NextResponse.json({ error: 'Address not found. Try including borough name (e.g., "123 Main St, Brooklyn")' }, { status: 404 })
    }

    // Find best match
    const { houseNumber, streetName, borough } = parseAddress(address)
    const normalizedInput = normalizeStreet(streetName || address)
    let bestMatch = data[0], bestScore = 0

    for (const record of data) {
      if (!record.address) continue
      const recordNorm = normalizeStreet(record.address)
      
      // Exact match
      if (recordNorm.includes(normalizedInput) || normalizedInput.includes(recordNorm)) {
        const score = Math.min(recordNorm.length, normalizedInput.length) / Math.max(recordNorm.length, normalizedInput.length) * 100
        if (score > bestScore) { bestMatch = record; bestScore = score }
      }
      
      // Check house number match
      if (houseNumber && record.address.startsWith(houseNumber)) {
        bestScore = Math.max(bestScore, 75)
        bestMatch = record
      }
    }

    const paddedBBL = padBBL(bestMatch.bbl)
    if (paddedBBL.length !== 10) {
      return NextResponse.json({ error: 'Invalid BBL for this address' }, { status: 404 })
    }

    return NextResponse.json({
      bbl: paddedBBL,
      address: bestMatch.address,
      borough: bestMatch.borough,
      zipcode: bestMatch.zipcode,
      confidence: bestScore >= 80 ? 'high' : bestScore >= 50 ? 'medium' : 'low'
    })
  } catch (e) {
    console.error('Lookup error:', e)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
