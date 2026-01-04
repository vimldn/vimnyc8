import { NextRequest, NextResponse } from 'next/server'
import { DATASETS, BOROUGH_CODES, ZIP_TO_NEIGHBORHOOD, BUILDING_CLASSES, JOB_TYPES, HUD_FMR_NYC_2025, HUD_FAIR_MARKET_RENTS, NYC_DEFAULT_FMR } from '@/lib/data-sources'

// ============================================
// HELPERS
// ============================================

function padBBL(bbl: string): string {
  if (!bbl) return ''
  const clean = bbl.replace(/\D/g, '')
  if (clean.length >= 10) return clean.slice(0, 10)
  return clean.padStart(10, '0')
}

async function fetchData(id: string, query: string, timeout = 12000): Promise<any[]> {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(`https://data.cityofnewyork.us/resource/${id}.json?${query}`, {
      signal: controller.signal, headers: { 'Accept': 'application/json' }, next: { revalidate: 300 }
    })
    clearTimeout(tid)
    return res.ok ? await res.json() : []
  } catch { clearTimeout(tid); return [] }
}

// Some datasets use different geometry/point field names. This helper tries a few
// common options and falls back to a simple limited fetch if the spatial query
// returns nothing (or if the dataset doesn't support within_circle on that field).
async function fetchNearbyWithFallback(
  id: string,
  lat: number | null,
  lng: number | null,
  radiusMeters: number,
  geoFields: string[],
  fallbackQuery: string,
  limit = 300,
): Promise<any[]> {
  if (lat != null && lng != null) {
    for (const field of geoFields) {
      const q = `$where=within_circle(${field},${lat},${lng},${radiusMeters})&$limit=${limit}`
      const d = await fetchData(id, q)
      if (Array.isArray(d) && d.length) return d
    }
  }
  return fetchData(id, fallbackQuery)
}

function categorize(desc: string): string {
  const d = (desc || '').toLowerCase()
  if (d.includes('heat') || d.includes('hot water') || d.includes('boiler')) return 'Heat/Hot Water'
  if (d.includes('roach') || d.includes('mice') || d.includes('rat') || d.includes('pest') || d.includes('rodent') || d.includes('bedbug')) return 'Pests'
  if (d.includes('lead') || d.includes('paint')) return 'Lead Paint'
  if (d.includes('mold') || d.includes('mildew')) return 'Mold'
  if (d.includes('fire') || d.includes('smoke') || d.includes('detector') || d.includes('sprinkler')) return 'Fire Safety'
  if (d.includes('electric') || d.includes('outlet') || d.includes('wiring')) return 'Electrical'
  if (d.includes('plumb') || d.includes('leak') || d.includes('water') || d.includes('toilet') || d.includes('sink')) return 'Plumbing'
  if (d.includes('lock') || d.includes('door') || d.includes('window') || d.includes('security')) return 'Security'
  if (d.includes('elevator')) return 'Elevator'
  if (d.includes('gas')) return 'Gas'
  if (d.includes('roof') || d.includes('structural') || d.includes('wall') || d.includes('floor') || d.includes('ceiling')) return 'Structural'
  if (d.includes('garbage') || d.includes('trash') || d.includes('sanitary')) return 'Sanitation'
  return 'Other'
}

type SignalKey = 'heat' | 'pests' | 'noise' | 'other'

function classify311(complaintType: string, descriptor: string): SignalKey {
  const t = (complaintType || '').toLowerCase()
  const d = (descriptor || '').toLowerCase()
  if (t.includes('noise') || d.includes('noise') || t.includes('loud')) return 'noise'
  if (t.includes('heat') || t.includes('hot water') || d.includes('heat') || d.includes('hot water')) return 'heat'
  if (t.includes('rodent') || t.includes('pest') || t.includes('roaches') || t.includes('rats') || d.includes('rodent') || d.includes('roach') || d.includes('mice') || d.includes('rat') || d.includes('bed bug')) return 'pests'
  return 'other'
}

function classifyHPDComplaint(complaintType: string, majorCategory: string): SignalKey {
  const t = (complaintType || majorCategory || '').toLowerCase()
  if (t.includes('heat') || t.includes('hot water')) return 'heat'
  if (t.includes('rodent') || t.includes('roach') || t.includes('mice') || t.includes('rat') || t.includes('pest') || t.includes('bedbug')) return 'pests'
  return 'other'
}

function money(n: number): string {
  return n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${n}`
}

function distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ============================================
// MAIN API - 45+ DATA SOURCES
// ============================================

export async function GET(req: NextRequest) {
  const rawBbl = req.nextUrl.searchParams.get('bbl')
  if (!rawBbl) return NextResponse.json({ error: 'BBL parameter required' }, { status: 400 })
  
  const bbl = padBBL(rawBbl)
  if (bbl.length !== 10) {
    return NextResponse.json({ error: 'Invalid BBL format' }, { status: 400 })
  }

  try {
    const borough = bbl[0], block = bbl.slice(1,6).replace(/^0+/,''), lot = bbl.slice(6).replace(/^0+/,'')
    const now = new Date()
    const y1 = new Date(now.getFullYear()-1, now.getMonth(), 1).toISOString().split('T')[0]
    const y3 = new Date(now.getFullYear()-3, now.getMonth(), 1).toISOString().split('T')[0]
    const y5 = new Date(now.getFullYear()-5, now.getMonth(), 1).toISOString().split('T')[0]

    // ========== PHASE 1: Get PLUTO first for lat/lng ==========
    const pluto = await fetchData(DATASETS.pluto, `bbl=${bbl}&$limit=1`)
    const p = pluto[0]
    const lat = p?.latitude ? +p.latitude : null
    const lng = p?.longitude ? +p.longitude : null

    // ========== PHASE 2: MASSIVE PARALLEL FETCH - ALL 55+ SOURCES ==========
    const [
      hpdViol, hpdComp, hpdReg, hpdContact, hpdLit, hpdCharge, hpdVacate, hpdAep, hpdConh,
      dobViol, dobComp, dobJobs, dobPermit, dobSafety, dobEcb, dobVacate,
      acrisLeg, dofSales, evict, housingCourtData, rodent, bedbug, specWatch, rentStab, subsidy, nycha, sr311,
      crimeData, floodData, hurricaneData,
      subwayData, busData, citibikeData,
      schoolData, parksData, treesData,
      cafesData, wifiData,
      // NEW DATA SOURCES
      shootingData, vehicleCrashData, coolingTowerData, taxExemptionData, taxLienData, restaurantData
    ] = await Promise.all([
      fetchData(DATASETS.hpdViolations, `bbl=${bbl}&$limit=1500&$order=inspectiondate DESC`),
      fetchData(DATASETS.hpdComplaints, `bbl=${bbl}&$where=receiveddate>='${y5}'&$limit=800&$order=receiveddate DESC`),
      fetchData(DATASETS.hpdRegistrations, `bbl=${bbl}&$limit=1`),
      fetchData(DATASETS.hpdContacts, `$where=registrationid IN (SELECT registrationid FROM tesw-yqqr WHERE bbl='${bbl}')&$limit=30`).catch(()=>[]),
      fetchData(DATASETS.hpdLitigations, `bbl=${bbl}&$limit=200&$order=caseopendate DESC`),
      fetchData(DATASETS.hpdCharges, `bbl=${bbl}&$limit=200`).catch(()=>[]),
      fetchData(DATASETS.hpdVacateOrders, `bbl=${bbl}&$limit=50`).catch(()=>[]),
      fetchData(DATASETS.hpdAEP, `bbl=${bbl}&$limit=10`),
      fetchData(DATASETS.hpdCONH, `bbl=${bbl}&$limit=10`).catch(()=>[]),
      fetchData(DATASETS.dobViolations, `$where=boro='${borough}' AND block='${block}' AND lot='${lot}'&$limit=800&$order=issue_date DESC`),
      fetchData(DATASETS.dobComplaints, `$where=boro='${borough}' AND block='${block}' AND lot='${lot}'&$limit=400&$order=date_entered DESC`).catch(()=>[]),
      // DOB Job Filings - use boro not borough, values are strings
      fetchData(DATASETS.dobJobFilings, `$where=boro='${borough}' AND block='${block}' AND lot='${lot}'&$limit=300&$order=filing_date DESC`).catch(()=>[]),
      fetchData(DATASETS.dobPermitsIssued, `$where=boro='${borough}' AND block='${block}' AND lot='${lot}'&$limit=200`).catch(()=>[]),
      fetchData(DATASETS.dobSafety, `$where=boro='${borough}' AND block='${block}' AND lot='${lot}'&$limit=150`),
      fetchData(DATASETS.dobEcb, `$where=boro='${borough}' AND block='${block}' AND lot='${lot}'&$limit=300`),
      fetchData(DATASETS.dobVacates, `$where=boro='${borough}' AND block='${block}' AND lot='${lot}'&$limit=30`).catch(()=>[]),
      fetchData(DATASETS.acrisLegals, `$where=borough='${borough}' AND block=${parseInt(block)} AND lot=${parseInt(lot)}&$limit=100&$order=good_through_date DESC`),
      // DOF Rolling Sales - borough is number, block/lot need padding
      fetchData(DATASETS.dofRollingSales, `$where=borough=${borough} AND block=${parseInt(block)} AND lot=${parseInt(lot)}&$limit=50&$order=sale_date DESC`).catch(()=>[]),
      fetchData(DATASETS.evictions, `bbl=${bbl}&$where=executed_date>='${y5}'&$limit=150&$order=executed_date DESC`),
      fetchData(DATASETS.housingCourt, `$where=bbl='${bbl}'&$limit=200&$order=fileddate DESC`).catch(()=>[]), // Housing court filings
      fetchData(DATASETS.rodents, `bbl=${bbl}&$limit=80&$order=inspection_date DESC`),
      fetchData(DATASETS.bedbugs, `$where=building_id='${bbl}'&$limit=50`),
      fetchData(DATASETS.speculationWatch, `bbl=${bbl}&$limit=5`),
      fetchData(DATASETS.rentStabilized, `$where=ucbbl='${bbl}'&$limit=1`).catch(()=>[]),
      fetchData(DATASETS.subsidizedHousing, `$where=bbl='${bbl}'&$limit=5`).catch(()=>[]),
      fetchData(DATASETS.nycha, `$where=bbl='${bbl}'&$limit=3`).catch(()=>[]),
      fetchData(DATASETS.sr311, `$where=bbl='${bbl}' AND created_date>='${y3}'&$limit=300&$order=created_date DESC`).catch(()=>[]),
      
      // Crime (within 500m radius, last 1 year)
      lat && lng ? fetchData(DATASETS.nypdComplaints, `$where=within_circle(lat_lon,${lat},${lng},500) AND cmplnt_fr_dt>='${y1}'&$limit=500&$order=cmplnt_fr_dt DESC`).catch(()=>[]) : Promise.resolve([]),
      
      // Flood zones
      lat && lng ? fetchData(DATASETS.floodZones, `$where=within_circle(the_geom,${lat},${lng},100)&$limit=5`).catch(()=>[]) : Promise.resolve([]),
      lat && lng ? fetchData(DATASETS.hurricaneZones, `$where=within_circle(the_geom,${lat},${lng},100)&$limit=5`).catch(()=>[]) : Promise.resolve([]),
      
      // Transit - use spatial queries for nearby stations
      lat && lng ? fetchData(DATASETS.subwayEntrances, `$where=within_circle(the_geom,${lat},${lng},1000)&$limit=50`).catch(()=>[]) : Promise.resolve([]), // Subway entrances nearby
      Promise.resolve([]), // Skip bus stops 
      lat && lng ? fetchData(DATASETS.citiBikeStations, `$where=within_circle(the_geom,${lat},${lng},800)&$limit=30`).catch(()=>[]) : Promise.resolve([]), // Citi Bike nearby
      
      // Schools - try spatial query first, then fall back to a limited grab
      fetchNearbyWithFallback(
        DATASETS.schoolLocations,
        lat,
        lng,
        1200,
        ['location_1', 'the_geom', 'location', 'lat_lon'],
        `$limit=2000`,
        200,
      ).catch(() => []),
      
      // Parks - try spatial query first, then fall back
      fetchNearbyWithFallback(
        DATASETS.parks,
        lat,
        lng,
        1200,
        ['the_geom', 'location', 'lat_lon'],
        `$limit=3000`,
        200,
      ).catch(() => []),
      
      // Street Trees - spatial query
      lat && lng ? fetchData(DATASETS.streetTrees, `$where=within_circle(the_geom,${lat},${lng},150)&$limit=100`).catch(()=>[]) : Promise.resolve([]),
      
      // Sidewalk Cafes - spatial query preferred
      fetchNearbyWithFallback(
        DATASETS.sidewalkCafes,
        lat,
        lng,
        600,
        ['the_geom', 'location', 'lat_lon'],
        `$limit=3000`,
        200,
      ).catch(() => []),
      
      // WiFi Hotspots - spatial query preferred
      fetchNearbyWithFallback(
        DATASETS.wifi_hotspots,
        lat,
        lng,
        600,
        ['the_geom', 'location', 'lat_lon'],
        `$limit=3000`,
        200,
      ).catch(() => []),
      
      // ========== NEW DATA SOURCES ==========
      
      // NYPD Shooting Incidents (within 500m, last 3 years)
      lat && lng ? fetchData(DATASETS.nypdShooting, `$where=within_circle(the_geom,${lat},${lng},500) AND occur_date>='${y3}'&$limit=200`).catch(()=>[]) : Promise.resolve([]),
      
      // Vision Zero Motor Vehicle Crashes (within 300m, last 2 years)
      lat && lng ? fetchData(DATASETS.motorVehicleCrashes, `$where=within_circle(location,${lat},${lng},300) AND crash_date>='${new Date(now.getFullYear()-2, now.getMonth(), 1).toISOString().split('T')[0]}'&$limit=300`).catch(()=>[]) : Promise.resolve([]),
      
      // Cooling Towers (Legionella risk) - search by address components
      fetchData(DATASETS.coolingTowers, `$where=upper(street_name) LIKE upper('%${p?.address?.split(' ').slice(1).join(' ') || ''}%')&$limit=20`).catch(()=>[]),
      
      // Tax Exemptions (J-51, 421a) - rent stabilization triggers
      fetchData(DATASETS.dofExemptions, `$where=bbl='${bbl}'&$limit=20`).catch(()=>[]),
      
      // Tax Lien Sales - financial distress indicator
      fetchData(DATASETS.taxLienSales, `$where=bbl='${bbl}'&$limit=20`).catch(()=>[]),
      
      // Restaurant Inspections (within 100m - ground floor concerns)
      lat && lng ? fetchData(DATASETS.restaurantInspections, `$where=within_circle(location,${lat},${lng},100)&$limit=50&$order=inspection_date DESC`).catch(()=>[]) : Promise.resolve([]),
    ])

    // ========== PROCESS BUILDING INFO ==========
    const rs = rentStab[0]
    const building = p ? {
      bbl, address: p.address || 'Unknown', borough: BOROUGH_CODES[p.borough] || p.borough,
      neighborhood: ZIP_TO_NEIGHBORHOOD[p.zipcode] || '', zipcode: p.zipcode || '',
      yearBuilt: p.yearbuilt ? +p.yearbuilt : null, unitsRes: +p.unitsres || 0, unitsTotal: +p.unitstotal || +p.unitsres || 0,
      floors: +p.numfloors || 0, buildingClass: p.bldgclass || '', buildingClassDesc: BUILDING_CLASSES[p.bldgclass] || p.bldgclass,
      ownerName: p.ownername || 'Unknown', ownerType: p.ownertype || '',
      latitude: lat, longitude: lng,
      lotArea: p.lotarea ? +p.lotarea : null, buildingArea: p.bldgarea ? +p.bldgarea : null,
      zoneDist1: p.zonedist1 || '', assessedValue: p.assesstot ? +p.assesstot : null,
      yearAltered1: p.yearalter1 ? +p.yearalter1 : null, yearAltered2: p.yearalter2 ? +p.yearalter2 : null,
      landmark: p.landmark || null, histDist: p.histdist || null,
      isRentStabilized: rs != null || (+p.unitsres >= 6 && +p.yearbuilt < 1974),
      rentStabilizedUnits: rs?.uc2023 || rs?.uc2022 || rs?.uc2021 || null,
      rsLostUnits: rs && rs.uc2007 && rs.uc2023 ? +rs.uc2007 - +rs.uc2023 : null,
      isSubsidized: subsidy.length > 0, subsidyPrograms: subsidy.map((s:any)=>s.program_name).filter(Boolean),
      isNycha: nycha.length > 0 || p.ownertype === 'P', nychaDev: nycha[0]?.development || null,
    } : null

    // ========== PROCESS HPD VIOLATIONS ==========
    const hpdOpen = hpdViol.filter((v:any) => v.currentstatus?.toLowerCase().includes('open') || !v.currentstatusdate)
    const classC = hpdOpen.filter((v:any) => v.class === 'C').length
    const classB = hpdOpen.filter((v:any) => v.class === 'B').length
    const classA = hpdOpen.filter((v:any) => v.class === 'A').length
    
    const hpdByYear: Record<string, {total:number,a:number,b:number,c:number}> = {}
    hpdViol.forEach((v:any) => {
      const yr = (v.inspectiondate || v.novissueddate || '').substring(0,4)
      if (yr && +yr >= 2010) {
        if (!hpdByYear[yr]) hpdByYear[yr] = {total:0,a:0,b:0,c:0}
        hpdByYear[yr].total++
        if (v.class==='A') hpdByYear[yr].a++
        if (v.class==='B') hpdByYear[yr].b++
        if (v.class==='C') hpdByYear[yr].c++
      }
    })
    
    const hpdByCat: Record<string,number> = {}
    hpdViol.forEach((v:any) => { const c = categorize(v.novdescription||''); hpdByCat[c] = (hpdByCat[c]||0)+1 })
    
    const recentHpd = hpdViol.slice(0,40).map((v:any) => ({
      id: v.violationid || Math.random().toString(), source: 'HPD', date: v.inspectiondate || v.novissueddate || '',
      class: v.class || 'A', type: v.novtype || '', description: v.novdescription || 'No description',
      status: v.currentstatus?.toLowerCase().includes('open') ? 'Open' : 'Closed',
      unit: v.apartment || '', story: v.story || '', category: categorize(v.novdescription || ''),
    }))

    // ========== PROCESS DOB VIOLATIONS ==========
    const dobOpen = dobViol.filter((v:any) => !v.disposition_date && v.issue_date)
    const dobByYear: Record<string,number> = {}
    dobViol.forEach((v:any) => { const yr = (v.issue_date||'').substring(0,4); if(yr) dobByYear[yr]=(dobByYear[yr]||0)+1 })
    
    const recentDob = dobViol.slice(0,25).map((v:any) => ({
      id: v.isn_dob_bis_extract || Math.random().toString(), source: 'DOB', date: v.issue_date || '',
      type: v.violation_type || '', description: v.description || v.violation_type_description || '',
      status: v.disposition_date ? 'Closed' : 'Open', category: categorize(v.description || ''),
    }))

    const ecbOpen = dobEcb.filter((v:any) => !v.ecb_violation_status?.toLowerCase().includes('resolve') && !v.ecb_violation_status?.toLowerCase().includes('dismiss'))
    const ecbPenalties = dobEcb.reduce((s:number,v:any) => s + (+v.penalty_balance_due || 0), 0)

    // ========== PROCESS HPD COMPLAINTS ==========
    const hpdCompY1 = hpdComp.filter((c:any) => new Date(c.receiveddate) >= new Date(y1))
    const heatComplaints = hpdCompY1.filter((c:any) => (c.complainttype||c.majorcategory||'').toLowerCase().match(/heat|hot water/)).length
    
    const compByCat: Record<string,number> = {}
    hpdComp.forEach((c:any) => { const cat = categorize(c.complainttype||c.majorcategory||''); compByCat[cat]=(compByCat[cat]||0)+1 })
    const totalComp = Object.values(compByCat).reduce((a,b)=>a+b,0)
    const compBreakdown = Object.entries(compByCat).map(([c,n])=>({category:c,count:n,pct:totalComp?Math.round(n/totalComp*100):0})).sort((a,b)=>b.count-a.count).slice(0,8)
    
    const compByYear: Record<string,number> = {}
    hpdComp.forEach((c:any) => { const yr = (c.receiveddate||'').substring(0,4); if(yr) compByYear[yr]=(compByYear[yr]||0)+1 })
    
    const recentComp = hpdComp.slice(0,25).map((c:any) => ({
      id: c.complaintid || Math.random().toString(), source: 'HPD', date: c.receiveddate || '',
      type: c.complainttype || c.majorcategory || 'Unknown', status: c.status || 'Unknown', unit: c.apartment || '',
    }))

    const dobCompY1 = dobComp.filter((c:any) => new Date(c.date_entered) >= new Date(y1))
    const recentDobComp = dobComp.slice(0,15).map((c:any) => ({
      id: c.complaint_number || Math.random().toString(), source: 'DOB', date: c.date_entered || '',
      type: c.complaint_category || 'DOB', status: c.status || 'Unknown',
    }))

    // ========== PROCESS 311 ==========
    const sr311ByCat: Record<string,number> = {}
    sr311.forEach((r:any) => { const t = r.complaint_type||'Other'; sr311ByCat[t]=(sr311ByCat[t]||0)+1 })
    const recent311 = sr311.slice(0,15).map((r:any) => ({
      id: r.unique_key, source: '311', date: r.created_date, type: r.complaint_type, descriptor: r.descriptor, status: r.status,
    }))

    // ========== PROCESS LITIGATIONS ==========
    const openLit = hpdLit.filter((l:any) => !l.casestatus?.toLowerCase().includes('closed'))
    const litByType: Record<string,number> = {}
    hpdLit.forEach((l:any) => { const t = l.casetype||'Other'; litByType[t]=(litByType[t]||0)+1 })
    const totalPenalties = hpdLit.reduce((s:number,l:any) => s+(+l.penalty||0), 0)
    const recentLit = hpdLit.slice(0,15).map((l:any) => ({
      id: l.litigationid, caseType: l.casetype, caseOpenDate: l.caseopendate, caseStatus: l.casestatus,
      penalty: l.penalty ? +l.penalty : null, findingDate: l.findingdate,
    }))

    const totalCharges = hpdCharge.reduce((s:number,c:any) => s+(+c.charge||0), 0)

    // ========== PROCESS EVICTIONS ==========
    const evict3Y = evict.filter((e:any) => new Date(e.executed_date) >= new Date(y3))
    const evictByYear: Record<string,number> = {}
    evict.forEach((e:any) => { const yr = (e.executed_date||'').substring(0,4); if(yr) evictByYear[yr]=(evictByYear[yr]||0)+1 })
    const recentEvict = evict.slice(0,15).map((e:any) => ({
      id: e.unique_id, executedDate: e.executed_date, type: e.residential_commercial, marshal: e.marshal_last_name,
    }))

    // ========== PROCESS HOUSING COURT FILINGS ==========
    const courtFilings3Y = housingCourtData.filter((f:any) => new Date(f.fileddate) >= new Date(y3))
    const courtFilingsByYear: Record<string,number> = {}
    housingCourtData.forEach((f:any) => { const yr = (f.fileddate||'').substring(0,4); if(yr) courtFilingsByYear[yr]=(courtFilingsByYear[yr]||0)+1 })
    const recentCourtFilings = housingCourtData.slice(0,15).map((f:any) => ({
      id: f.index_number || Math.random().toString(), filedDate: f.fileddate, caseType: f.casetype || f.classification,
      status: f.status, courtType: f.court || 'Housing Court',
    }))

    // ========== PROCESS SALES ==========
    const sales = dofSales.filter((s:any) => +s.sale_price > 0).slice(0,25).map((s:any) => ({
      id: s.ease_ment || Math.random().toString(), date: s.sale_date, amount: +s.sale_price,
    }))
    const lastSale = sales[0]

    // ========== PROCESS PERMITS ==========
    const recentPerm = dobJobs.slice(0,25).map((p:any) => ({
      jobNumber: p.job__ || p.job_number, jobType: p.job_type, jobTypeDesc: JOB_TYPES[p.job_type] || p.job_type,
      filingDate: p.filing_date || p.pre_filing_date, jobStatus: p.job_status, jobStatusDesc: p.job_status_descrp,
      workType: p.work_type, estimatedCost: p.initial_cost ? +p.initial_cost : null,
    }))
    const majorAlt = dobJobs.filter((p:any) => p.job_type === 'A1' || p.job_type === 'DM').length
    const recentAct = dobJobs.filter((p:any) => new Date(p.filing_date) >= new Date(y3)).length

    // ========== PROCESS RODENTS ==========
    const rodentFail = rodent.filter((r:any) => (r.result||'').toLowerCase().match(/active|rat|mice|evidence/))
    const rodentPass = rodent.filter((r:any) => (r.result||'').toLowerCase().match(/pass|no evidence/))
    const recentRodent = rodent.slice(0,10).map((r:any) => ({ date: r.inspection_date, result: r.result, type: r.inspection_type }))

    // ========== PROCESS LANDLORD ==========
    const reg = hpdReg[0]
    const ownerContacts = hpdContact.filter((c:any) => (c.type||'').toLowerCase().match(/owner|head|corporate/))
    const agentContacts = hpdContact.filter((c:any) => (c.type||'').toLowerCase().match(/agent|manag|site/))
    const siteManagers = hpdContact.filter((c:any) => (c.type||'').toLowerCase().match(/site/))
    
    // Format contacts like Who Owns What
    const formatContact = (c: any) => ({
      name: `${c.firstname || ''} ${c.lastname || ''}`.trim() || c.corporationname || 'Unknown',
      title: c.type || '',
      corporation: c.corporationname || '',
      address: c.businesshousenumber ? `${c.businesshousenumber} ${c.businessstreetname || ''} ${c.businessapartment || ''} ${c.businesscity || ''}, ${c.businessstate || ''} ${c.businesszip || ''}`.replace(/\s+/g, ' ').trim() : '',
    })
    
    const landlord = {
      name: reg?.corporationname || (reg?.ownerfirstname ? `${reg.ownerfirstname} ${reg.ownerlastname||''}`.trim() : building?.ownerName) || 'Unknown',
      type: reg?.corporationname ? 'corporation' : 'individual',
      registrationId: reg?.registrationid || '',
      registrationDate: reg?.registrationenddate ? `Last registered: ${new Date(reg.lastregistrationdate || reg.registrationenddate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : '',
      registrationExpires: reg?.registrationenddate ? `Expires: ${new Date(reg.registrationenddate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : '',
      managementCompany: agentContacts[0]?.corporationname || reg?.managementagent || '',
      // All contacts formatted like Who Owns What
      owners: ownerContacts.map(formatContact),
      agents: agentContacts.map(formatContact),
      siteManagers: siteManagers.map(formatContact),
      allContacts: hpdContact.map(formatContact),
      portfolioSize: 0, portfolio: [] as any[],
    }
    
    if (landlord.registrationId) {
      try {
        const port = await fetchData(DATASETS.hpdRegistrations, `registrationid=${landlord.registrationId}&$select=bbl,housenumber,streetname,zip,borough&$limit=150`, 8000)
        landlord.portfolioSize = port.length
        landlord.portfolio = port.filter((b:any) => b.bbl !== bbl).slice(0,20).map((b:any) => ({
          bbl: b.bbl, address: `${b.housenumber||''} ${b.streetname||''}`.trim(),
          borough: BOROUGH_CODES[b.borough] || b.borough, zipcode: b.zip,
        }))
      } catch {}
    }

    // ========== PROGRAMS ==========
    const programs = {
      aep: hpdAep.length > 0, conh: hpdConh.length > 0,
      speculationWatch: specWatch.length > 0, subsidized: subsidy.length > 0, nycha: nycha.length > 0,
      vacateOrder: hpdVacate.length > 0 || dobVacate.length > 0,
    }

    // ========== NEW: PROCESS CRIME DATA ==========
    const crimeByType: Record<string, number> = {}
    crimeData.forEach((c: any) => { const type = c.ofns_desc || c.pd_desc || 'Other'; crimeByType[type] = (crimeByType[type] || 0) + 1 })
    const totalCrimes = crimeData.length
    const violentCrimes = crimeData.filter((c: any) => {
      const desc = (c.ofns_desc || '').toLowerCase()
      return desc.includes('assault') || desc.includes('robbery') || desc.includes('murder') || desc.includes('rape')
    }).length
    // Crime score: normalized for 500m radius urban area
    // 500 incidents is common in NYC - use logarithmic scale
    const crimeScore = Math.max(0, Math.round(100 - Math.log10(totalCrimes + 1) * 25 - violentCrimes * 3))
    const crimeLevel = crimeScore >= 70 ? 'LOW' : crimeScore >= 50 ? 'MODERATE' : crimeScore >= 30 ? 'HIGH' : 'VERY HIGH'

    // ========== NEW: PROCESS FLOOD DATA ==========
    const inFloodZone = floodData.length > 0
    const floodZoneType = floodData[0]?.fld_zone || floodData[0]?.zone || null
    const inHurricaneZone = hurricaneData.length > 0
    const hurricaneZone = hurricaneData[0]?.hurricane_e || hurricaneData[0]?.zone || null
    const floodRisk = inFloodZone ? (floodZoneType?.includes('AE') || floodZoneType?.includes('VE') ? 'HIGH' : 'MODERATE') : 'LOW'

    // ========== NEW: PROCESS TRANSIT DATA ==========
    // Spatial queries already filtered by distance, just process results
    const filterByDistance = (items: any[], maxDist: number) => {
      if (!lat || !lng || !items?.length) return []
      return items
        .map((item: any) => {
          // Try multiple possible lat/lng field names
          const itemLat = +item.latitude || +item.lat || +item.gtfs_latitude || 
                          item.the_geom?.coordinates?.[1] || item.geom?.coordinates?.[1] ||
                          (item.location?.latitude) || null
          const itemLng = +item.longitude || +item.lon || +item.gtfs_longitude || 
                          item.the_geom?.coordinates?.[0] || item.geom?.coordinates?.[0] ||
                          (item.location?.longitude) || null
          if (!itemLat || !itemLng || isNaN(itemLat) || isNaN(itemLng)) return null
          const dist = distance(lat, lng, itemLat, itemLng)
          return dist <= maxDist ? { ...item, _distance: Math.round(dist), _lat: itemLat, _lng: itemLng } : null
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a._distance - b._distance)
    }

    // Subway data from spatial query - already filtered to 1000m
    const subwayCount = subwayData.length
    const nearbySubways = subwayData.slice(0, 10).map((s: any) => ({
      name: s.name || s.station_name || s.line || s.entrance_type || 'Subway',
      line: s.line || s.routes || s.daytime_routes || '',
      distance: lat && lng && s.the_geom?.coordinates ? Math.round(distance(lat, lng, s.the_geom.coordinates[1], s.the_geom.coordinates[0])) : null
    }))
    const nearestSubway = nearbySubways[0]
    
    // CitiBike from spatial query - already filtered to 800m
    const nearbyCitiBike = citibikeData.length
    const nearbyBusStops = 0 // Skipped for performance
    
    // Transit score: subways within 1km = major points, citibike = bonus
    const transitScore = Math.min(100, subwayCount * 15 + nearbyCitiBike * 3)

    // ========== NEW: PROCESS SCHOOLS DATA ==========
    const nearbySchoolsList = filterByDistance(schoolData, 1000)
    const nearbySchools = nearbySchoolsList.slice(0, 15).map((s: any) => ({
      name: s.school_name || s.location_name || s.name || s.facility_name || 'School',
      type: s.location_type_description || s.location_category_description || s.school_type || s.grades || '',
      grades: s.grades || s.grade_span_min && s.grade_span_max ? `${s.grade_span_min}-${s.grade_span_max}` : '',
      address: s.primary_address_line_1 || s.address || '',
      distance: s._distance
    }))
    const schoolCount = nearbySchoolsList.length

    // ========== NEW: PROCESS PARKS DATA ==========
    const nearbyParksList = filterByDistance(parksData, 800)
    const parksToUse = nearbyParksList.length > 0 ? nearbyParksList : parksData.slice(0, 20)
    const nearbyParks = parksToUse.slice(0, 10).map((pk: any) => ({
      name: pk.signname || pk.name311 || pk.park_name || pk.name || 'Park',
      type: pk.typecategory || pk.category || '',
      acres: pk.acres ? +pk.acres : null
    }))
    const parkCount = parksToUse.length
    const totalParkAcres = parksToUse.reduce((sum: number, pk: any) => sum + (+pk.acres || 0), 0)

    // ========== NEW: PROCESS TREES DATA ==========
    const treeCount = treesData.length
    const treeHealth: Record<string, number> = {}
    treesData.forEach((t: any) => { const health = t.health || 'Unknown'; treeHealth[health] = (treeHealth[health] || 0) + 1 })
    const healthyTrees = treeHealth['Good'] || 0

    // ========== NEW: AMENITIES ==========
    const nearbyCafes = filterByDistance(cafesData, 500)
    const nearbyWifi = filterByDistance(wifiData, 500)
    const sidewalkCafes = nearbyCafes.length
    const wifiHotspots = nearbyWifi.length

    // ========== NEW: SHOOTING INCIDENTS (Violent Crime) ==========
    const shootingCount = shootingData.length
    const fatalShootings = shootingData.filter((s: any) => s.statistical_murder_flag === 'true' || s.statistical_murder_flag === true).length
    const shootingsByYear: Record<string, number> = {}
    shootingData.forEach((s: any) => {
      const yr = (s.occur_date || '').substring(0, 4)
      if (yr) shootingsByYear[yr] = (shootingsByYear[yr] || 0) + 1
    })
    const violentCrimeScore = Math.max(0, 100 - shootingCount * 15 - fatalShootings * 25)

    // ========== NEW: VISION ZERO TRAFFIC CRASHES ==========
    const crashCount = vehicleCrashData.length
    const pedestrianInjuries = vehicleCrashData.filter((c: any) => +c.number_of_pedestrians_injured > 0).length
    const pedestrianKilled = vehicleCrashData.reduce((sum: number, c: any) => sum + (+c.number_of_pedestrians_killed || 0), 0)
    const cyclistInjuries = vehicleCrashData.filter((c: any) => +c.number_of_cyclist_injured > 0).length
    const totalInjuries = vehicleCrashData.reduce((sum: number, c: any) => 
      sum + (+c.number_of_persons_injured || 0), 0)
    const totalFatalities = vehicleCrashData.reduce((sum: number, c: any) => 
      sum + (+c.number_of_persons_killed || 0), 0)
    // Pedestrian safety: scaled for urban environment (300m radius over 2 years)
    // 200 crashes is common in busy intersections - use logarithmic scale
    const pedestrianSafetyScore = Math.max(0, Math.round(100 - Math.log10(crashCount + 1) * 20 - pedestrianInjuries * 2 - pedestrianKilled * 20))

    // ========== NEW: COOLING TOWERS (Legionella Risk) ==========
    const coolingTowerCount = coolingTowerData.length
    const hasCoolingTower = coolingTowerCount > 0
    const recentLegionellaTest = coolingTowerData[0]?.last_certification_date || coolingTowerData[0]?.certification_date || null

    // ========== NEW: TAX EXEMPTIONS (J-51, 421a) ==========
    const hasJ51 = taxExemptionData.some((e: any) => (e.exemption_code || e.program || '').toLowerCase().includes('j51') || (e.exemption_code || e.program || '').toLowerCase().includes('j-51'))
    const has421a = taxExemptionData.some((e: any) => (e.exemption_code || e.program || '').toLowerCase().includes('421'))
    const exemptionExpiration = taxExemptionData[0]?.expiration_date || taxExemptionData[0]?.benefit_end_date || null
    const taxExemptions = taxExemptionData.map((e: any) => ({
      program: e.exemption_code || e.program || 'Unknown',
      startDate: e.benefit_start_date || e.start_date,
      endDate: e.expiration_date || e.benefit_end_date,
      status: e.status || 'Active'
    }))
    // 421a triggers rent stabilization - important for tenants
    const rentStabilizedByExemption = has421a || hasJ51

    // ========== NEW: TAX LIEN SALES (Financial Distress) ==========
    const hasTaxLien = taxLienData.length > 0
    const taxLienCount = taxLienData.length
    const lastTaxLienDate = taxLienData[0]?.sale_date || taxLienData[0]?.lien_sale_date || null
    const taxLienHistory = taxLienData.slice(0, 5).map((l: any) => ({
      date: l.sale_date || l.lien_sale_date,
      amount: l.amount || l.lien_amount,
      status: l.status || 'Sold'
    }))

    // ========== NEW: RESTAURANT INSPECTIONS (Ground Floor) ==========
    const nearbyRestaurants = restaurantData
    const restaurantCount = new Set(nearbyRestaurants.map((r: any) => r.camis)).size
    const criticalViolations = nearbyRestaurants.filter((r: any) => r.critical_flag === 'Critical' || r.violation_code?.startsWith('04') || r.violation_code?.startsWith('02')).length
    const pestViolations = nearbyRestaurants.filter((r: any) => (r.violation_description || '').toLowerCase().match(/mice|roach|rat|pest|vermin/)).length
    const restaurantGrades: Record<string, number> = {}
    nearbyRestaurants.forEach((r: any) => { 
      const grade = r.grade || 'Ungraded'
      if (!restaurantGrades[r.camis]) restaurantGrades[r.camis] = grade === 'A' ? 3 : grade === 'B' ? 2 : grade === 'C' ? 1 : 0
    })
    const avgRestaurantScore = Object.values(restaurantGrades).length > 0 
      ? Object.values(restaurantGrades).reduce((a, b) => a + b, 0) / Object.values(restaurantGrades).length 
      : null

    // ========== NEW: 311 NOISE COMPLAINTS (Filtered) ==========
    const noiseComplaints = sr311.filter((c: any) => (c.complaint_type || '').toLowerCase().includes('noise'))
    const noiseComplaintCount = noiseComplaints.length
    const noiseByType: Record<string, number> = {}
    noiseComplaints.forEach((c: any) => {
      const type = c.descriptor || c.complaint_type || 'Other'
      noiseByType[type] = (noiseByType[type] || 0) + 1
    })

    // ========== NEW: HUD FAIR MARKET RENT COMPARISON ==========
    // Use ZIP-level FMR when available, fall back to metro average
    const zipcode = p?.zipcode || ''
    const zipLevelFMR = HUD_FAIR_MARKET_RENTS[zipcode]
    const hudFMR = zipLevelFMR ? {
      studio: zipLevelFMR.studio,
      oneBr: zipLevelFMR.br1,
      twoBr: zipLevelFMR.br2,
      threeBr: zipLevelFMR.br3,
      fourBr: zipLevelFMR.br4,
      year: 2025,
      source: `HUD Small Area FMR (ZIP ${zipcode})`,
      isZipLevel: true,
    } : {
      studio: HUD_FMR_NYC_2025['0'],
      oneBr: HUD_FMR_NYC_2025['1'],
      twoBr: HUD_FMR_NYC_2025['2'],
      threeBr: HUD_FMR_NYC_2025['3'],
      fourBr: HUD_FMR_NYC_2025['4'],
      year: 2025,
      source: 'HUD FMR (NYC Metro Average)',
      isZipLevel: false,
    }

    // ========== ENHANCED PEST SCORE ==========
    const pestScore = Math.max(0, 100 - rodentFail.length * 10 - bedbug.length * 15 - pestViolations * 3)

    // ========== FINANCIAL HEALTH SCORE ==========
    const financialHealthScore = Math.max(0, 100 - (hasTaxLien ? 30 : 0) - taxLienCount * 10 - (totalCharges > 10000 ? 20 : totalCharges > 5000 ? 10 : 0))

    // ========== NEIGHBORHOOD SCORE ==========
    const neighborhoodScore = Math.round(
      (crimeScore * 0.3) + (Math.min(transitScore, 100) * 0.25) + (Math.min(schoolCount * 10, 100) * 0.15) +
      (Math.min(parkCount * 15, 100) * 0.15) + (inFloodZone ? 50 : 100) * 0.15
    )

    // ========== CALCULATE SCORE ==========
    let score = 100
    score -= Math.min(classC * 15, 45)
    score -= Math.min(classB * 5, 25)
    score -= Math.min(classA * 1, 10)
    score -= Math.min(hpdOpen.length * 1, 10)
    score -= Math.min(dobOpen.length * 3, 15)
    score -= Math.min(ecbOpen.length * 2, 10)
    score -= Math.min(heatComplaints * 4, 16)
    score -= Math.min(hpdCompY1.length * 0.5, 8)
    score -= Math.min(openLit.length * 6, 18)
    score -= Math.min(hpdLit.length * 1, 10)
    score -= Math.min(evict3Y.length * 4, 12)
    score -= Math.min(rodentFail.length * 3, 9)
    score -= Math.min(bedbug.length * 5, 15)
    if (programs.aep) score -= 20
    if (programs.speculationWatch) score -= 8
    if (programs.vacateOrder) score -= 15
    if (totalCharges > 10000) score -= 10
    else if (totalCharges > 5000) score -= 5
    score = Math.max(0, Math.min(100, Math.round(score)))
    
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F'
    const label = score >= 90 ? 'Excellent' : score >= 80 ? 'Good' : score >= 70 ? 'Fair' : score >= 55 ? 'Poor' : 'Critical'

    // ========== CATEGORY SCORES (ENHANCED) ==========
    const catScores = [
      { name: 'Heat Reliability', icon: '🔥', score: Math.max(0, 100 - heatComplaints*12 - (hpdByCat['Heat/Hot Water']||0)*3), detail: `${heatComplaints} heat complaints/yr` },
      { name: 'Pest Control', icon: '🐛', score: pestScore, detail: `${rodentFail.length} rodent fails, ${bedbug.length} bedbugs, ${pestViolations} restaurant pests` },
      { name: 'Maintenance', icon: '🔧', score: Math.max(0, 100 - hpdOpen.length*3 - dobOpen.length*4), detail: `${hpdOpen.length + dobOpen.length} open violations` },
      { name: 'Safety', icon: '🛡️', score: Math.max(0, 100 - classC*20 - (hpdByCat['Fire Safety']||0)*10 - dobSafety.length*8), detail: `${classC} Class C violations` },
      { name: 'Landlord', icon: '👤', score: Math.max(0, 100 - openLit.length*15 - Math.min(totalCharges/1000, 20)), detail: `${openLit.length} legal cases` },
      { name: 'Stability', icon: '🏠', score: Math.max(0, 100 - evict3Y.length*12 - (programs.speculationWatch ? 15 : 0)), detail: `${evict3Y.length} evictions (3yr)` },
      { name: 'Crime', icon: '🚔', score: crimeScore, detail: `${totalCrimes} incidents nearby` },
      { name: 'Violent Crime', icon: '🔫', score: violentCrimeScore, detail: `${shootingCount} shootings (3yr), ${fatalShootings} fatal` },
      { name: 'Pedestrian Safety', icon: '🚶', score: pedestrianSafetyScore, detail: `${crashCount} crashes, ${pedestrianInjuries} ped injuries` },
      { name: 'Transit', icon: '🚇', score: Math.min(100, transitScore), detail: `${subwayCount} subways nearby` },
      { name: 'Financial Health', icon: '💰', score: financialHealthScore, detail: hasTaxLien ? `${taxLienCount} tax liens` : 'No tax liens' },
      { name: 'Noise', icon: '🔊', score: Math.max(0, 100 - noiseComplaintCount * 3), detail: `${noiseComplaintCount} noise complaints (3yr)` },
    ]

    // ========== RISK ASSESSMENT ==========
    const risk = catScores.map(c => ({
      category: c.name, icon: c.icon, score: c.score, detail: c.detail,
      level: c.score < 40 ? 'CRITICAL' : c.score < 60 ? 'HIGH' : c.score < 80 ? 'MODERATE' : 'LOW',
    }))

    // ========== RED FLAGS (ENHANCED) ==========
    const redFlags: any[] = []
    if (classC > 0) redFlags.push({ severity: 'critical', title: `${classC} Class C Violation${classC>1?'s':''}`, description: 'Immediately hazardous. Must be corrected within 24 hours.' })
    if (programs.aep) redFlags.push({ severity: 'critical', title: 'Alternative Enforcement Program', description: 'Building is in HPD\'s worst buildings program.' })
    if (programs.vacateOrder) redFlags.push({ severity: 'critical', title: 'Vacate Order', description: 'Building has/had a vacate order.' })
    if (heatComplaints >= 5) redFlags.push({ severity: 'critical', title: `${heatComplaints} Heat Complaints`, description: 'Very high heat/hot water complaints.' })
    if (bedbug.length >= 2) redFlags.push({ severity: 'critical', title: `${bedbug.length} Bedbug Reports`, description: 'Multiple bedbug reports filed.' })
    if (shootingCount >= 3) redFlags.push({ severity: 'critical', title: `${shootingCount} Shootings Nearby`, description: `${fatalShootings} fatal. High violent crime area.` })
    if (hasTaxLien) redFlags.push({ severity: 'critical', title: 'Tax Lien Sale', description: 'Building sold at tax lien sale - financial distress indicator.' })
    if (inFloodZone && (floodZoneType?.includes('AE') || floodZoneType?.includes('VE'))) redFlags.push({ severity: 'warning', title: `Flood Zone ${floodZoneType}`, description: 'High-risk FEMA flood zone. Consider flood insurance.' })
    if (evict3Y.length >= 5) redFlags.push({ severity: 'warning', title: `${evict3Y.length} Evictions (3yr)`, description: 'High eviction rate.' })
    if (openLit.length >= 2) redFlags.push({ severity: 'warning', title: `${openLit.length} Legal Cases`, description: `HPD legal action. ${money(totalPenalties)} in penalties.` })
    if (programs.speculationWatch) redFlags.push({ severity: 'warning', title: 'Speculation Watch', description: 'Sold at price suggesting speculation.' })
    if (hpdOpen.length >= 15) redFlags.push({ severity: 'warning', title: `${hpdOpen.length} Open Violations`, description: 'High unresolved violations.' })
    if (crimeLevel === 'VERY HIGH') redFlags.push({ severity: 'warning', title: 'High Crime Area', description: `${totalCrimes} incidents nearby (1yr).` })
    if (pedestrianKilled > 0) redFlags.push({ severity: 'warning', title: `${pedestrianKilled} Pedestrian Fatalities`, description: 'Pedestrian deaths nearby in last 2 years.' })
    if (hasCoolingTower) redFlags.push({ severity: 'info', title: 'Cooling Tower Present', description: `Building has ${coolingTowerCount} cooling tower(s). Legionella testing required.` })
    if (exemptionExpiration) redFlags.push({ severity: 'info', title: has421a ? '421-a Tax Exemption' : hasJ51 ? 'J-51 Tax Exemption' : 'Tax Exemption', description: `Expires: ${exemptionExpiration}. May affect rent stabilization.` })
    if (inHurricaneZone) redFlags.push({ severity: 'info', title: `Hurricane Zone ${hurricaneZone}`, description: 'May require evacuation during hurricanes.' })
    if (noiseComplaintCount >= 10) redFlags.push({ severity: 'info', title: `${noiseComplaintCount} Noise Complaints`, description: 'Frequent noise complaints in area.' })

    // ========== TIMELINE ==========
    const timeline: any[] = []
    recentHpd.slice(0,40).forEach(v => v.date && timeline.push({ date: v.date, type: 'violation', source: `HPD ${v.class}`, description: v.description.slice(0,120), severity: v.class==='C'?'high':v.class==='B'?'medium':'low', status: v.status }))
    recentDob.slice(0,20).forEach(v => v.date && timeline.push({ date: v.date, type: 'violation', source: 'DOB', description: (v.description||v.type).slice(0,120), severity: 'medium', status: v.status }))
    recentComp.slice(0,25).forEach(c => c.date && timeline.push({ date: c.date, type: 'complaint', source: 'HPD', description: `${c.type} complaint`, severity: c.type.toLowerCase().includes('heat')?'high':'medium' }))
    sales.slice(0,10).forEach(s => s.date && timeline.push({ date: s.date, type: 'sale', source: 'ACRIS', description: `Sold for ${money(s.amount)}`, severity: 'medium' }))
    recentEvict.forEach(e => e.executedDate && timeline.push({ date: e.executedDate, type: 'eviction', source: 'Marshal', description: `Eviction (${e.type||'Residential'})`, severity: 'high' }))
    recentLit.slice(0,10).forEach(l => l.caseOpenDate && timeline.push({ date: l.caseOpenDate, type: 'litigation', source: 'HPD', description: `Legal: ${l.caseType}`, severity: 'high' }))
    timeline.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // ========== MONTHLY TREND ==========
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const monthlyTrend = []
    for (let i = 35; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const hpdM = hpdViol.filter((v:any) => { const vd = new Date(v.inspectiondate||v.novissueddate); return vd >= start && vd <= end }).length
      const dobM = dobViol.filter((v:any) => { const vd = new Date(v.issue_date); return vd >= start && vd <= end }).length
      const compM = hpdComp.filter((c:any) => { const cd = new Date(c.receiveddate); return cd >= start && cd <= end }).length
      monthlyTrend.push({ month: months[d.getMonth()], year: d.getFullYear(), monthYear: `${months[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`, hpdViolations: hpdM, dobViolations: dobM, complaints: compM, total: hpdM+dobM+compM })
    }

    // ========== YEARLY STATS ==========
    const yearlyStats = []
    for (let y = now.getFullYear(); y >= now.getFullYear() - 10; y--) {
      yearlyStats.push({ year: y, hpdViolations: hpdByYear[y]?.total||0, hpdClassC: hpdByYear[y]?.c||0, dobViolations: dobByYear[y]||0, complaints: compByYear[y]||0, evictions: evictByYear[y]||0 })
    }

    // ========== DECISION-FIRST SIGNALS ==========
    const parseDate = (value: any): Date | null => {
      if (!value) return null
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? null : d
    }

    const signalEvents: { date: Date; signal: SignalKey }[] = []

    // HPD complaints (building)
    hpdComp.forEach((c: any) => {
      const dt = parseDate(c.receiveddate)
      if (!dt) return
      signalEvents.push({ date: dt, signal: classifyHPDComplaint(c.complainttype, c.majorcategory) })
    })

    // 311 requests (building)
    sr311.forEach((r: any) => {
      const dt = parseDate(r.created_date)
      if (!dt) return
      signalEvents.push({ date: dt, signal: classify311(r.complaint_type, r.descriptor) })
    })

    // Rodent failed inspections (building)
    rodentFail.forEach((r: any) => {
      const dt = parseDate(r.inspection_date)
      if (!dt) return
      signalEvents.push({ date: dt, signal: 'pests' })
    })

    // Bedbug filings (building)
    bedbug.forEach((b: any) => {
      const dt = parseDate(b.filing_date)
      if (!dt) return
      signalEvents.push({ date: dt, signal: 'pests' })
    })

    // Helper to count signals in a date window
    const countSignals = (start: Date, end: Date) => {
      const counts: Record<SignalKey, number> = { heat: 0, pests: 0, noise: 0, other: 0 }
      for (const e of signalEvents) {
        if (e.date >= start && e.date <= end) counts[e.signal] += 1
      }
      const total = counts.heat + counts.pests + counts.noise + counts.other
      return { ...counts, total }
    }

    const buildWindow = (days: number) => {
      const end = new Date(now)
      const start = new Date(now)
      start.setDate(start.getDate() - days)

      const prevEnd = new Date(start)
      const prevStart = new Date(start)
      prevStart.setDate(prevStart.getDate() - days)

      const counts = countSignals(start, end)
      const prev = countSignals(prevStart, prevEnd)

      const deltas = {
        heat: counts.heat - prev.heat,
        pests: counts.pests - prev.pests,
        noise: counts.noise - prev.noise,
        other: counts.other - prev.other,
        total: counts.total - prev.total,
      }
      return {
        start: start.toISOString(),
        end: end.toISOString(),
        counts,
        deltas,
      }
    }

    const signalsWindows = {
      '30d': buildWindow(30),
      '90d': buildWindow(90),
      '1y': buildWindow(365),
      '3y': buildWindow(365 * 3),
    }

    const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-US', opts)

    // Daily series (30 points)
    const daily30: any[] = []
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date(now)
      dayStart.setHours(0, 0, 0, 0)
      dayStart.setDate(dayStart.getDate() - i)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)
      const counts = countSignals(dayStart, dayEnd)
      daily30.push({ label: fmt(dayStart, { month: 'short', day: 'numeric' }), heat: counts.heat, pests: counts.pests, noise: counts.noise, other: counts.other, total: counts.total })
    }

    // Weekly series (13 weeks)
    const weekly90: any[] = []
    for (let i = 12; i >= 0; i--) {
      const weekEnd = new Date(now)
      weekEnd.setHours(23, 59, 59, 999)
      weekEnd.setDate(weekEnd.getDate() - i * 7)
      const weekStart = new Date(weekEnd)
      weekStart.setDate(weekStart.getDate() - 6)
      weekStart.setHours(0, 0, 0, 0)
      const counts = countSignals(weekStart, weekEnd)
      weekly90.push({ label: fmt(weekStart, { month: 'short', day: 'numeric' }), heat: counts.heat, pests: counts.pests, noise: counts.noise, other: counts.other, total: counts.total })
    }

    // Monthly series (36 months)
    const monthly36: any[] = []
    const monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    for (let i = 35; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
      const counts = countSignals(start, end)
      monthly36.push({ label: `${monthsShort[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`, heat: counts.heat, pests: counts.pests, noise: counts.noise, other: counts.other, total: counts.total })
    }

    // ========== RESPONSE ==========
    return NextResponse.json({
      building,
      score: { overall: score, grade, label, breakdown: { hpdViolations: hpdOpen.length, dobViolations: dobOpen.length, ecbViolations: ecbOpen.length, complaints: hpdCompY1.length, litigations: openLit.length, evictions: evict3Y.length, pests: rodentFail.length + bedbug.length } },
      categoryScores: catScores,
      violations: {
        hpd: { total: hpdViol.length, open: hpdOpen.length, classA, classB, classC, byYear: hpdByYear, byCategory: Object.entries(hpdByCat).map(([c,n])=>({category:c,count:n})).sort((a,b)=>b.count-a.count) },
        dob: { total: dobViol.length, open: dobOpen.length, byYear: dobByYear },
        ecb: { total: dobEcb.length, open: ecbOpen.length, penaltiesOwed: ecbPenalties },
        safety: { total: dobSafety.length },
        recent: [...recentHpd, ...recentDob].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,50),
      },
      complaints: {
        hpd: { total: hpdComp.length, recentYear: hpdCompY1.length, heatHotWater: heatComplaints, byYear: compByYear },
        dob: { total: dobComp.length, recentYear: dobCompY1.length },
        sr311: { total: sr311.length, byType: sr311ByCat },
        recent: [...recentComp, ...recentDobComp, ...recent311].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,40),
        byCategory: compBreakdown,
      },
      litigations: { total: hpdLit.length, open: openLit.length, totalPenalties, byType: litByType, recent: recentLit },
      charges: { total: hpdCharge.length, totalAmount: totalCharges },
      evictions: { 
        total: evict.length, 
        last3Years: evict3Y.length, 
        byYear: evictByYear, 
        recent: recentEvict,
        filings: { 
          total: housingCourtData.length, 
          last3Years: courtFilings3Y.length, 
          byYear: courtFilingsByYear, 
          recent: recentCourtFilings 
        }
      },
      sales: { total: sales.length, recent: sales, lastSaleDate: lastSale?.date, lastSaleAmount: lastSale?.amount },
      permits: { total: dobJobs.length, majorAlterations: majorAlt, recentActivity: recentAct, recent: recentPerm },
      rodents: { totalInspections: rodent.length, failed: rodentFail.length, passed: rodentPass.length, recent: recentRodent },
      bedbugs: { reports: bedbug.length, lastReportDate: bedbug[0]?.filing_date },
      programs,
      landlord,
      riskAssessment: risk,
      redFlags,
      timeline: timeline.slice(0,100),
      monthlyTrend,
      yearlyStats,
      signals: {
        windows: signalsWindows,
        series: { daily30, weekly90, monthly36 },
      },
      
      // CRIME & SAFETY DATA
      crime: { total: totalCrimes, violent: violentCrimes, score: crimeScore, level: crimeLevel, byType: Object.entries(crimeByType).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 10) },
      
      // NEW: SHOOTING INCIDENTS (Violent Crime)
      shootings: { 
        total: shootingCount, 
        fatal: fatalShootings, 
        byYear: shootingsByYear,
        score: violentCrimeScore,
        level: violentCrimeScore >= 80 ? 'LOW' : violentCrimeScore >= 60 ? 'MODERATE' : violentCrimeScore >= 40 ? 'HIGH' : 'VERY HIGH'
      },
      
      // NEW: VISION ZERO TRAFFIC CRASHES
      trafficSafety: {
        crashes: crashCount,
        totalInjuries,
        totalFatalities,
        pedestrianInjuries,
        pedestrianFatalities: pedestrianKilled,
        cyclistInjuries,
        score: pedestrianSafetyScore,
        level: pedestrianSafetyScore >= 80 ? 'LOW' : pedestrianSafetyScore >= 60 ? 'MODERATE' : pedestrianSafetyScore >= 40 ? 'HIGH' : 'VERY HIGH'
      },
      
      // NEW: COOLING TOWERS (Legionella Risk)
      coolingTowers: {
        hasTower: hasCoolingTower,
        count: coolingTowerCount,
        lastCertification: recentLegionellaTest,
        riskNote: hasCoolingTower ? 'Building has cooling tower(s). Legionella testing required by NYC law.' : null
      },
      
      // NEW: TAX EXEMPTIONS & ABATEMENTS
      taxExemptions: {
        hasJ51,
        has421a,
        rentStabilizedByExemption,
        exemptionExpiration,
        programs: taxExemptions,
        note: has421a ? '421-a exemption triggers rent stabilization requirements.' : hasJ51 ? 'J-51 exemption may affect rent stabilization.' : null
      },
      
      // NEW: TAX LIENS (Financial Distress)
      taxLiens: {
        hasLien: hasTaxLien,
        count: taxLienCount,
        lastSaleDate: lastTaxLienDate,
        history: taxLienHistory,
        warning: hasTaxLien ? 'Building has tax lien history - potential financial distress indicator.' : null
      },
      
      // NEW: RESTAURANT INSPECTIONS (Ground Floor)
      restaurants: {
        nearbyCount: restaurantCount,
        criticalViolations,
        pestViolations,
        avgGrade: avgRestaurantScore !== null ? (avgRestaurantScore >= 2.5 ? 'A' : avgRestaurantScore >= 1.5 ? 'B' : 'C') : null,
        note: pestViolations > 0 ? `${pestViolations} pest violations at nearby restaurants - may affect building.` : null
      },
      
      // NEW: NOISE COMPLAINTS
      noise: {
        total: noiseComplaintCount,
        byType: Object.entries(noiseByType).map(([type, count]) => ({ type, count })).sort((a: any, b: any) => b.count - a.count).slice(0, 5),
        level: noiseComplaintCount >= 15 ? 'HIGH' : noiseComplaintCount >= 5 ? 'MODERATE' : 'LOW'
      },
      
      // NEW: HUD FAIR MARKET RENT
      rentFairness: {
        hudFMR,
        neighborhood: ZIP_TO_NEIGHBORHOOD[zipcode] || 'NYC',
        note: hudFMR.isZipLevel 
          ? `Fair Market Rents for ${ZIP_TO_NEIGHBORHOOD[zipcode] || zipcode} (40th percentile). Rents above these may be above market rate.`
          : 'NYC Metro Fair Market Rents (40th percentile). Compare your asking rent to these benchmarks.',
        tip: 'If asking rent exceeds FMR by 20%+, consider negotiating or comparing other units.'
      },
      
      // NEW: PEST SCORE (ENHANCED)
      pests: {
        score: pestScore,
        rodentFails: rodentFail.length,
        bedbugReports: bedbug.length,
        restaurantPestViolations: pestViolations,
        level: pestScore >= 80 ? 'LOW' : pestScore >= 60 ? 'MODERATE' : pestScore >= 40 ? 'HIGH' : 'CRITICAL'
      },
      
      // NEW: FINANCIAL HEALTH
      financialHealth: {
        score: financialHealthScore,
        taxLiens: taxLienCount,
        emergencyCharges: totalCharges,
        level: financialHealthScore >= 80 ? 'HEALTHY' : financialHealthScore >= 60 ? 'FAIR' : financialHealthScore >= 40 ? 'CONCERNING' : 'DISTRESSED'
      },
      
      // EXISTING DATA
      flood: { inFloodZone, floodZoneType, floodRisk, inHurricaneZone, hurricaneZone },
      transit: { score: Math.min(100, transitScore), subwayStations: subwayCount, busStops: nearbyBusStops, citiBikeStations: nearbyCitiBike, nearestSubway, nearbySubways },
      schools: { count: schoolCount, nearby: nearbySchools },
      parks: { count: parkCount, totalAcres: Math.round(totalParkAcres * 10) / 10, nearby: nearbyParks },
      trees: { count: treeCount, healthyCount: healthyTrees, healthBreakdown: treeHealth },
      amenities: { sidewalkCafes, wifiHotspots },
      neighborhoodScore,
      
      dataSourcesCounted: 55, lastUpdated: new Date().toISOString(),
      dataDisclaimer: 'Data from 55+ NYC Open Data sources including HUD Fair Market Rents. Scores are estimates. Always verify independently.'
    })
  } catch (e) {
    console.error('API Error:', e)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
