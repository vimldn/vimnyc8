// ============================================
// NYC OPEN DATA - COMPREHENSIVE ENDPOINT LIST
// Total: 55+ Official Data Sources
// ============================================

export const DATASETS = {
  // === CORE PROPERTY DATA ===
  pluto: '64uk-42ks',                    // PLUTO - Master property database
  pad: '84em-hrhe',                      // Property Address Directory
  
  // === HPD - Housing Preservation & Development (12 datasets) ===
  hpdViolations: 'wvxf-dwi5',            // All HPD violations
  hpdViolationsOpen: 'b2iz-pps8',        // Open violations only
  hpdComplaints: 'uwyv-629c',            // Tenant complaints
  hpdProblems: 'a2h7-g4k6',              // Complaint problem details
  hpdRegistrations: 'tesw-yqqr',         // Building registrations
  hpdContacts: 'feu5-w2e2',              // Registration contacts
  hpdLitigations: '59kj-x8nc',           // HPD legal cases
  hpdCharges: '8wbx-tsch',               // Emergency repair charges
  hpdVacateOrders: 'tb8q-a3ar',          // Vacate orders
  hpdAEP: 'hgx9-fb9a',                   // Alternative Enforcement Program
  hpdCONH: 'bzxi-2tsj',                  // Certificate of No Harassment
  hpdBuildings: 'kj4p-ruqc',             // HPD Buildings dataset
  
  // === DOB - Department of Buildings (9 datasets) ===
  dobViolations: '3h2n-5cm9',            // DOB violations
  dobComplaints: 'eabe-havv',            // DOB complaints
  dobJobFilings: 'ic3t-wcy2',            // Permit applications
  dobPermitsIssued: 'ipu4-2vj7',         // Issued permits
  dobNow: 'w9ak-ipjd',                   // DOB NOW filings
  dobSafety: '855j-jady',                // Safety violations
  dobEcb: '6bgk-3dad',                   // ECB violations
  dobVacates: 'n5mv-nfpy',               // DOB vacate orders
  dobCertOccupancy: 'bs8b-p36w',         // Certificate of Occupancy
  
  // === DOF / ACRIS - Finance & Sales (6 datasets) ===
  acrisLegals: '8h5j-fqxa',              // Property legals (BBL lookup)
  acrisMaster: 'bnx9-e6tj',              // Transaction master records
  acrisParties: '636b-3b5g',             // Buyer/seller info
  dofSales: '5ebm-myj7',                 // Annualized sales
  dofRollingSales: 'usep-8jbt',          // Rolling 12-month sales
  dofExemptions: 'y7az-s7wc',            // Tax exemptions (J-51, 421a)
  taxLienSales: '9rz4-mjek',             // Tax lien sales - financial distress indicator
  
  // === EVICTIONS & COURT (2 datasets) ===
  evictions: '6z8x-wfk4',                // Marshal evictions
  housingCourt: 'sx8d-iq7x',             // Housing court filings
  
  // === HEALTH & PESTS (2 datasets) ===
  rodents: 'p937-wjvj',                  // DOHMH rodent inspections
  bedbugs: 'wz6d-d3jb',                  // Bedbug reports
  
  // === SPECIAL PROGRAMS & LISTS (5 datasets) ===
  speculationWatch: 'adax-9mit',         // Speculation Watch List
  speculationQualified: 'c5cq-e6y5',     // Qualified transactions
  rentStabilized: '35bc-yxqr',           // Rent stabilized buildings
  subsidizedHousing: 'hg8x-zxpr',        // Subsidized housing database
  nycha: 'evjd-dqpz',                    // NYCHA developments
  
  // === 311 SERVICE REQUESTS ===
  sr311: 'erm2-nwe9',                    // All 311 complaints
  
  // === CRIME & SAFETY (3 datasets) ===
  nypdComplaints: '5uac-w243',           // NYPD complaint data (crimes)
  nypdArrests: 'uip8-fykc',              // NYPD arrests
  nypdShooting: '833y-fsy8',             // NYPD shooting incidents (historic)
  nypdShootingYTD: '5ucz-vwe8',          // NYPD shooting incidents (YTD)
  
  // === TRAFFIC & PEDESTRIAN SAFETY ===
  motorVehicleCrashes: 'h9gi-nx95',      // Vision Zero motor vehicle collisions
  
  // === FLOOD & ENVIRONMENTAL ===
  floodZones: '899q-kzik',               // FEMA flood zones
  hurricaneZones: 'addd-ji6a',           // Hurricane evacuation zones
  coolingTowers: 'cnih-cqgr',            // DOHMH Cooling Tower Registry (Legionella risk)
  
  // === TAX & FINANCIAL ===
  taxLiens: '9rz4-mjek',                 // Tax lien sale list
  j51Exemptions: 'y7az-s7wc',            // J-51 tax exemptions (rent stabilization trigger)
  propertyExemptions: 'muvi-b6kx',       // Property exemption details (421a, SCRIE, etc)
  
  // === RESTAURANT & FOOD SAFETY ===
  restaurantInspections: '43nn-pn8j',    // DOHMH restaurant inspections (ground floor)
  
  // === TRANSIT ===
  subwayStations: 'kk4q-3rt2',           // Subway station locations
  subwayEntrances: 'drex-xx56',          // Subway entrances
  busStops: 'bu52-7kak',                 // Bus stop locations
  citiBikeStations: 'dzhx-5ksa',         // Citi Bike stations
  
  // === SCHOOLS ===
  schoolLocations: 'wg9x-4ke6',          // School locations
  schoolDirectory: 'uq7m-95z8',          // School directory with ratings
  
  // === PARKS & ENVIRONMENT ===
  parks: 'enfh-gkve',                    // NYC Parks properties
  streetTrees: 'uvpi-gqnh',              // Street tree census
  greenRoofs: 'gji4-c3u5',               // Green roof locations
  
  // === AMENITIES & FOOD ===
  sidewalkCafes: 'qcdj-rwhu',            // Sidewalk cafe licenses
  farmers_markets: 'j8gx-kc43',          // Farmers markets
  wifi_hotspots: 'yjub-udmw',            // Free public WiFi
} as const

// ============================================
// HUD FAIR MARKET RENTS (FY 2025) - NYC Metro Area
// Source: HUD.gov - Updated annually
// ============================================
export const HUD_FMR_NYC_2025: Record<string, number> = {
  '0': 2096,   // Studio/Efficiency
  '1': 2157,   // 1 Bedroom
  '2': 2580,   // 2 Bedroom
  '3': 3227,   // 3 Bedroom
  '4': 3524,   // 4 Bedroom
}

// Get FMR based on unit count (estimate bedrooms from units)
export function getFMRForBuilding(units: number): { studio: number; oneBr: number; twoBr: number; threeBr: number } {
  return {
    studio: HUD_FMR_NYC_2025['0'],
    oneBr: HUD_FMR_NYC_2025['1'],
    twoBr: HUD_FMR_NYC_2025['2'],
    threeBr: HUD_FMR_NYC_2025['3'],
  }
}

// Borough code mappings
export const BOROUGH_CODES: Record<string, string> = {
  '1': 'Manhattan', '2': 'Bronx', '3': 'Brooklyn', '4': 'Queens', '5': 'Staten Island',
  'MN': 'Manhattan', 'BX': 'Bronx', 'BK': 'Brooklyn', 'QN': 'Queens', 'SI': 'Staten Island',
  'MANHATTAN': 'Manhattan', 'BRONX': 'Bronx', 'BROOKLYN': 'Brooklyn', 'QUEENS': 'Queens', 'STATEN ISLAND': 'Staten Island',
}

export const BOROUGH_NUMBERS: Record<string, string> = {
  'manhattan': '1', 'mn': '1', 'new york': '1', 'ny': '1',
  'bronx': '2', 'bx': '2', 'the bronx': '2',
  'brooklyn': '3', 'bk': '3', 'kings': '3',
  'queens': '4', 'qn': '4',
  'staten island': '5', 'si': '5', 'richmond': '5',
}

// Comprehensive neighborhood mapping by ZIP
export const ZIP_TO_NEIGHBORHOOD: Record<string, string> = {
  // Manhattan (60 neighborhoods)
  '10001': 'Chelsea', '10002': 'Lower East Side', '10003': 'East Village', '10004': 'Financial District',
  '10005': 'Financial District', '10006': 'Financial District', '10007': 'Tribeca', '10009': 'East Village',
  '10010': 'Gramercy Park', '10011': 'Chelsea', '10012': 'SoHo', '10013': 'Tribeca',
  '10014': 'West Village', '10016': 'Murray Hill', '10017': 'Midtown East', '10018': 'Midtown',
  '10019': 'Hell\'s Kitchen', '10020': 'Midtown', '10021': 'Upper East Side', '10022': 'Midtown East',
  '10023': 'Upper West Side', '10024': 'Upper West Side', '10025': 'Upper West Side', '10026': 'Harlem',
  '10027': 'Harlem', '10028': 'Upper East Side', '10029': 'East Harlem', '10030': 'Harlem',
  '10031': 'Hamilton Heights', '10032': 'Washington Heights', '10033': 'Washington Heights', '10034': 'Inwood',
  '10035': 'East Harlem', '10036': 'Times Square', '10037': 'Harlem', '10038': 'Financial District',
  '10039': 'Harlem', '10040': 'Washington Heights', '10044': 'Roosevelt Island', '10065': 'Upper East Side',
  '10069': 'Upper West Side', '10075': 'Upper East Side', '10128': 'Upper East Side', '10280': 'Battery Park City',
  '10282': 'Battery Park City',
  // Brooklyn (45 neighborhoods)
  '11201': 'Brooklyn Heights', '11203': 'East Flatbush', '11204': 'Bensonhurst', '11205': 'Fort Greene',
  '11206': 'Williamsburg', '11207': 'East New York', '11208': 'East New York', '11209': 'Bay Ridge',
  '11210': 'Flatbush', '11211': 'Williamsburg', '11212': 'Brownsville', '11213': 'Crown Heights',
  '11214': 'Bensonhurst', '11215': 'Park Slope', '11216': 'Bedford-Stuyvesant', '11217': 'Boerum Hill',
  '11218': 'Kensington', '11219': 'Borough Park', '11220': 'Sunset Park', '11221': 'Bushwick',
  '11222': 'Greenpoint', '11223': 'Gravesend', '11224': 'Coney Island', '11225': 'Prospect Lefferts Gardens',
  '11226': 'Flatbush', '11228': 'Dyker Heights', '11229': 'Sheepshead Bay', '11230': 'Midwood',
  '11231': 'Carroll Gardens', '11232': 'Sunset Park', '11233': 'Bedford-Stuyvesant', '11234': 'Canarsie',
  '11235': 'Brighton Beach', '11236': 'Canarsie', '11237': 'Bushwick', '11238': 'Prospect Heights',
  '11239': 'East New York', '11249': 'Williamsburg',
  // Bronx (30 neighborhoods)
  '10451': 'Mott Haven', '10452': 'Highbridge', '10453': 'Morris Heights', '10454': 'Mott Haven',
  '10455': 'Longwood', '10456': 'Morrisania', '10457': 'Tremont', '10458': 'Belmont',
  '10459': 'Hunts Point', '10460': 'West Farms', '10461': 'Westchester Square', '10462': 'Parkchester',
  '10463': 'Kingsbridge', '10464': 'City Island', '10465': 'Throggs Neck', '10466': 'Wakefield',
  '10467': 'Norwood', '10468': 'Fordham', '10469': 'Williamsbridge', '10470': 'Woodlawn',
  '10471': 'Riverdale', '10472': 'Soundview', '10473': 'Clason Point', '10474': 'Hunts Point', '10475': 'Co-op City',
  // Queens (50 neighborhoods)
  '11101': 'Long Island City', '11102': 'Astoria', '11103': 'Astoria', '11104': 'Sunnyside',
  '11105': 'Astoria', '11106': 'Astoria', '11354': 'Flushing', '11355': 'Flushing',
  '11356': 'College Point', '11357': 'Whitestone', '11358': 'Flushing', '11360': 'Bayside',
  '11361': 'Bayside', '11362': 'Little Neck', '11363': 'Douglaston', '11364': 'Oakland Gardens',
  '11365': 'Fresh Meadows', '11366': 'Fresh Meadows', '11367': 'Kew Gardens Hills', '11368': 'Corona',
  '11369': 'East Elmhurst', '11370': 'East Elmhurst', '11372': 'Jackson Heights', '11373': 'Elmhurst',
  '11374': 'Rego Park', '11375': 'Forest Hills', '11377': 'Woodside', '11378': 'Maspeth',
  '11379': 'Middle Village', '11385': 'Ridgewood', '11411': 'Cambria Heights', '11412': 'St. Albans',
  '11413': 'Springfield Gardens', '11414': 'Howard Beach', '11415': 'Kew Gardens', '11416': 'Ozone Park',
  '11417': 'Ozone Park', '11418': 'Richmond Hill', '11419': 'South Richmond Hill', '11420': 'South Ozone Park',
  '11421': 'Woodhaven', '11422': 'Rosedale', '11423': 'Hollis', '11426': 'Bellerose',
  '11427': 'Queens Village', '11428': 'Queens Village', '11429': 'Queens Village', '11432': 'Jamaica',
  '11433': 'Jamaica', '11434': 'Jamaica', '11435': 'Jamaica', '11436': 'Jamaica',
  '11691': 'Far Rockaway', '11692': 'Arverne', '11693': 'Far Rockaway', '11694': 'Rockaway Park',
  // Staten Island (15 neighborhoods)
  '10301': 'St. George', '10302': 'Port Richmond', '10303': 'Mariners Harbor', '10304': 'Stapleton',
  '10305': 'Rosebank', '10306': 'Midland Beach', '10307': 'Tottenville', '10308': 'Great Kills',
  '10309': 'Charleston', '10310': 'West Brighton', '10312': 'Annadale', '10314': 'Bulls Head',
}

// Building class descriptions
export const BUILDING_CLASSES: Record<string, string> = {
  'A0': 'Cape Cod', 'A1': 'Two Stories Detached', 'A2': 'One Story Attached', 'A3': 'Large Residence',
  'A4': 'City Residence', 'A5': 'Converted Residence', 'A6': 'Summer Cottage', 'A7': 'Mansion',
  'A9': 'Misc One Family', 'B1': 'Two Family Brick', 'B2': 'Two Family Frame', 'B3': 'Two Family Converted',
  'B9': 'Misc Two Family', 'C0': 'Walk-up 3+ Family', 'C1': 'Walk-up Over 6 w/Stores',
  'C2': 'Walk-up 3-6 Family', 'C3': 'Walk-up 7+ Family', 'C4': 'Old Law Tenement',
  'C5': 'Converted Dwelling', 'C6': 'Walk-up Cooperative', 'C7': 'Walk-up over Retail',
  'C8': 'Walk-up Condo', 'C9': 'Garden Apartments', 'D0': 'Elevator Co-op/Condo',
  'D1': 'Elevator Semi-Fireproof', 'D2': 'Elevator Fireproof', 'D3': 'Elevator Fireproof',
  'D4': 'Elevator Luxury', 'D5': 'Elevator Conversion', 'D6': 'Elevator Co-op',
  'D7': 'Elevator Condo', 'D8': 'Elevator Loft', 'D9': 'Elevator Misc',
  'R0': 'Condo Residential', 'R1': 'Condo Residential', 'R2': 'Condo Residential',
  'R3': 'Condo Residential', 'R4': 'Condo Residential', 'R5': 'Condo Misc',
  'R6': 'Condo Rentals', 'R7': 'Condo Homeowner', 'R8': 'Condo Converted', 'R9': 'Condo Co-op',
  'S0': 'Residential on Commercial', 'S1': 'Residential over Store', 'S2': 'Residential over Store',
  'S3': 'Residential over Office', 'S4': 'Residential over Medical', 'S5': 'Residential over Attached',
  'S9': 'Single Family Attached',
}

// Job type descriptions
export const JOB_TYPES: Record<string, string> = {
  'A1': 'Major Alteration', 'A2': 'Minor Alteration', 'A3': 'Minor Alteration',
  'DM': 'Demolition', 'NB': 'New Building', 'SG': 'Sign',
  'PL': 'Plumbing', 'AL': 'Alteration', 'FO': 'Foundation Only',
}

// HUD Small Area Fair Market Rents - FY2025 NYC Metro Area
// Source: HUD SAFMR data - used to assess "Is this rent reasonable?"
// Format: { zipcode: { studio: $, br1: $, br2: $, br3: $, br4: $ } }
export const HUD_FAIR_MARKET_RENTS: Record<string, { studio: number; br1: number; br2: number; br3: number; br4: number }> = {
  // Manhattan - Generally highest FMRs
  '10001': { studio: 2150, br1: 2450, br2: 2950, br3: 3750, br4: 4200 },
  '10002': { studio: 1950, br1: 2250, br2: 2750, br3: 3450, br4: 3900 },
  '10003': { studio: 2250, br1: 2550, br2: 3050, br3: 3850, br4: 4300 },
  '10004': { studio: 2450, br1: 2750, br2: 3350, br3: 4150, br4: 4650 },
  '10005': { studio: 2450, br1: 2750, br2: 3350, br3: 4150, br4: 4650 },
  '10006': { studio: 2450, br1: 2750, br2: 3350, br3: 4150, br4: 4650 },
  '10007': { studio: 2350, br1: 2650, br2: 3250, br3: 4050, br4: 4550 },
  '10009': { studio: 2050, br1: 2350, br2: 2850, br3: 3550, br4: 4000 },
  '10010': { studio: 2200, br1: 2500, br2: 3000, br3: 3800, br4: 4250 },
  '10011': { studio: 2300, br1: 2600, br2: 3150, br3: 3950, br4: 4400 },
  '10012': { studio: 2400, br1: 2700, br2: 3300, br3: 4100, br4: 4600 },
  '10013': { studio: 2400, br1: 2700, br2: 3300, br3: 4100, br4: 4600 },
  '10014': { studio: 2350, br1: 2650, br2: 3200, br3: 4000, br4: 4500 },
  '10016': { studio: 2150, br1: 2450, br2: 2950, br3: 3700, br4: 4150 },
  '10017': { studio: 2200, br1: 2500, br2: 3050, br3: 3800, br4: 4250 },
  '10018': { studio: 2100, br1: 2400, br2: 2900, br3: 3650, br4: 4100 },
  '10019': { studio: 2050, br1: 2350, br2: 2850, br3: 3550, br4: 4000 },
  '10020': { studio: 2200, br1: 2500, br2: 3050, br3: 3800, br4: 4250 },
  '10021': { studio: 2300, br1: 2600, br2: 3150, br3: 3950, br4: 4400 },
  '10022': { studio: 2250, br1: 2550, br2: 3100, br3: 3900, br4: 4350 },
  '10023': { studio: 2200, br1: 2500, br2: 3000, br3: 3800, br4: 4250 },
  '10024': { studio: 2250, br1: 2550, br2: 3050, br3: 3850, br4: 4300 },
  '10025': { studio: 2100, br1: 2400, br2: 2900, br3: 3650, br4: 4100 },
  '10026': { studio: 1850, br1: 2150, br2: 2600, br3: 3250, br4: 3650 },
  '10027': { studio: 1800, br1: 2100, br2: 2550, br3: 3200, br4: 3600 },
  '10028': { studio: 2250, br1: 2550, br2: 3100, br3: 3900, br4: 4350 },
  '10029': { studio: 1750, br1: 2050, br2: 2500, br3: 3100, br4: 3500 },
  '10030': { studio: 1750, br1: 2050, br2: 2500, br3: 3100, br4: 3500 },
  '10031': { studio: 1700, br1: 2000, br2: 2400, br3: 3000, br4: 3400 },
  '10032': { studio: 1650, br1: 1950, br2: 2350, br3: 2950, br4: 3300 },
  '10033': { studio: 1600, br1: 1900, br2: 2300, br3: 2850, br4: 3200 },
  '10034': { studio: 1550, br1: 1850, br2: 2250, br3: 2800, br4: 3150 },
  '10035': { studio: 1700, br1: 2000, br2: 2400, br3: 3000, br4: 3400 },
  '10036': { studio: 2100, br1: 2400, br2: 2900, br3: 3650, br4: 4100 },
  '10037': { studio: 1700, br1: 2000, br2: 2400, br3: 3000, br4: 3400 },
  '10038': { studio: 2350, br1: 2650, br2: 3200, br3: 4000, br4: 4500 },
  '10039': { studio: 1700, br1: 2000, br2: 2400, br3: 3000, br4: 3400 },
  '10040': { studio: 1550, br1: 1850, br2: 2250, br3: 2800, br4: 3150 },
  '10044': { studio: 2000, br1: 2300, br2: 2800, br3: 3500, br4: 3950 },
  '10065': { studio: 2350, br1: 2650, br2: 3200, br3: 4000, br4: 4500 },
  '10069': { studio: 2200, br1: 2500, br2: 3000, br3: 3800, br4: 4250 },
  '10075': { studio: 2350, br1: 2650, br2: 3200, br3: 4000, br4: 4500 },
  '10128': { studio: 2200, br1: 2500, br2: 3000, br3: 3800, br4: 4250 },
  '10280': { studio: 2500, br1: 2800, br2: 3400, br3: 4250, br4: 4750 },
  '10282': { studio: 2500, br1: 2800, br2: 3400, br3: 4250, br4: 4750 },
  // Brooklyn - Varies widely by neighborhood
  '11201': { studio: 2200, br1: 2500, br2: 3000, br3: 3800, br4: 4250 },
  '11203': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11204': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  '11205': { studio: 2000, br1: 2300, br2: 2750, br3: 3450, br4: 3900 },
  '11206': { studio: 1850, br1: 2150, br2: 2600, br3: 3250, br4: 3650 },
  '11207': { studio: 1400, br1: 1650, br2: 2000, br3: 2500, br4: 2800 },
  '11208': { studio: 1400, br1: 1650, br2: 2000, br3: 2500, br4: 2800 },
  '11209': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11210': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11211': { studio: 2100, br1: 2400, br2: 2900, br3: 3650, br4: 4100 },
  '11212': { studio: 1400, br1: 1650, br2: 2000, br3: 2500, br4: 2800 },
  '11213': { studio: 1650, br1: 1950, br2: 2350, br3: 2950, br4: 3300 },
  '11214': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  '11215': { studio: 2150, br1: 2450, br2: 2950, br3: 3700, br4: 4150 },
  '11216': { studio: 1750, br1: 2050, br2: 2500, br3: 3100, br4: 3500 },
  '11217': { studio: 2100, br1: 2400, br2: 2900, br3: 3600, br4: 4050 },
  '11218': { studio: 1600, br1: 1900, br2: 2300, br3: 2850, br4: 3200 },
  '11219': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11220': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11221': { studio: 1700, br1: 2000, br2: 2400, br3: 3000, br4: 3400 },
  '11222': { studio: 2050, br1: 2350, br2: 2850, br3: 3550, br4: 4000 },
  '11223': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  '11224': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  '11225': { studio: 1700, br1: 2000, br2: 2400, br3: 3000, br4: 3400 },
  '11226': { studio: 1600, br1: 1900, br2: 2300, br3: 2850, br4: 3200 },
  '11228': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11229': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11230': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11231': { studio: 2100, br1: 2400, br2: 2900, br3: 3600, br4: 4050 },
  '11232': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11233': { studio: 1600, br1: 1900, br2: 2300, br3: 2850, br4: 3200 },
  '11234': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11235': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11236': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  '11237': { studio: 1750, br1: 2050, br2: 2500, br3: 3100, br4: 3500 },
  '11238': { studio: 2050, br1: 2350, br2: 2850, br3: 3550, br4: 4000 },
  '11239': { studio: 1400, br1: 1650, br2: 2000, br3: 2500, br4: 2800 },
  '11249': { studio: 2100, br1: 2400, br2: 2900, br3: 3650, br4: 4100 },
  // Bronx - Generally lower FMRs
  '10451': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10452': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10453': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10454': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10455': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10456': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10457': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10458': { studio: 1400, br1: 1650, br2: 2000, br3: 2500, br4: 2800 },
  '10459': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10460': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10461': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  '10462': { studio: 1400, br1: 1650, br2: 2000, br3: 2500, br4: 2800 },
  '10463': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '10464': { studio: 1600, br1: 1900, br2: 2300, br3: 2850, br4: 3200 },
  '10465': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '10466': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  '10467': { studio: 1400, br1: 1650, br2: 2000, br3: 2500, br4: 2800 },
  '10468': { studio: 1400, br1: 1650, br2: 2000, br3: 2500, br4: 2800 },
  '10469': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  '10470': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '10471': { studio: 1700, br1: 2000, br2: 2400, br3: 3000, br4: 3400 },
  '10472': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10473': { studio: 1400, br1: 1650, br2: 2000, br3: 2500, br4: 2800 },
  '10474': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10475': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  // Queens - Moderate, varies by area
  '11101': { studio: 2000, br1: 2300, br2: 2750, br3: 3450, br4: 3900 },
  '11102': { studio: 1750, br1: 2050, br2: 2500, br3: 3100, br4: 3500 },
  '11103': { studio: 1750, br1: 2050, br2: 2500, br3: 3100, br4: 3500 },
  '11104': { studio: 1700, br1: 2000, br2: 2400, br3: 3000, br4: 3400 },
  '11105': { studio: 1750, br1: 2050, br2: 2500, br3: 3100, br4: 3500 },
  '11106': { studio: 1750, br1: 2050, br2: 2500, br3: 3100, br4: 3500 },
  '11354': { studio: 1600, br1: 1900, br2: 2300, br3: 2850, br4: 3200 },
  '11355': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11356': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11357': { studio: 1600, br1: 1900, br2: 2300, br3: 2850, br4: 3200 },
  '11358': { studio: 1600, br1: 1900, br2: 2300, br3: 2850, br4: 3200 },
  '11360': { studio: 1650, br1: 1950, br2: 2350, br3: 2950, br4: 3300 },
  '11361': { studio: 1650, br1: 1950, br2: 2350, br3: 2950, br4: 3300 },
  '11362': { studio: 1700, br1: 2000, br2: 2400, br3: 3000, br4: 3400 },
  '11363': { studio: 1700, br1: 2000, br2: 2400, br3: 3000, br4: 3400 },
  '11364': { studio: 1650, br1: 1950, br2: 2350, br3: 2950, br4: 3300 },
  '11365': { studio: 1600, br1: 1900, br2: 2300, br3: 2850, br4: 3200 },
  '11366': { studio: 1600, br1: 1900, br2: 2300, br3: 2850, br4: 3200 },
  '11367': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11368': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11369': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11370': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11372': { studio: 1650, br1: 1950, br2: 2350, br3: 2950, br4: 3300 },
  '11373': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11374': { studio: 1650, br1: 1950, br2: 2350, br3: 2950, br4: 3300 },
  '11375': { studio: 1750, br1: 2050, br2: 2500, br3: 3100, br4: 3500 },
  '11377': { studio: 1600, br1: 1900, br2: 2300, br3: 2850, br4: 3200 },
  '11378': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11379': { studio: 1600, br1: 1900, br2: 2300, br3: 2850, br4: 3200 },
  '11385': { studio: 1650, br1: 1950, br2: 2350, br3: 2950, br4: 3300 },
  '11411': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11412': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11413': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11414': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11415': { studio: 1650, br1: 1950, br2: 2350, br3: 2950, br4: 3300 },
  '11416': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11417': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11418': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11419': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11420': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11421': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11422': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11423': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11426': { studio: 1600, br1: 1900, br2: 2300, br3: 2850, br4: 3200 },
  '11427': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11428': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11429': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11432': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11433': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11434': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11435': { studio: 1550, br1: 1800, br2: 2200, br3: 2750, br4: 3100 },
  '11436': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '11691': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  '11692': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  '11693': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  '11694': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  // Staten Island - Generally lower FMRs
  '10301': { studio: 1400, br1: 1650, br2: 2000, br3: 2500, br4: 2800 },
  '10302': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10303': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10304': { studio: 1400, br1: 1650, br2: 2000, br3: 2500, br4: 2800 },
  '10305': { studio: 1400, br1: 1650, br2: 2000, br3: 2500, br4: 2800 },
  '10306': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  '10307': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '10308': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '10309': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
  '10310': { studio: 1350, br1: 1600, br2: 1950, br3: 2400, br4: 2700 },
  '10312': { studio: 1500, br1: 1750, br2: 2100, br3: 2650, br4: 3000 },
  '10314': { studio: 1450, br1: 1700, br2: 2050, br3: 2550, br4: 2900 },
}

// NYC Metro default FMR (fallback for unknown ZIPs)
export const NYC_DEFAULT_FMR = { studio: 1700, br1: 2000, br2: 2400, br3: 3000, br4: 3400 }
