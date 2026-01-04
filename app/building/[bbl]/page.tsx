'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, AlertTriangle, CheckCircle, XCircle, Search, ChevronRight, ChevronLeft, Home, FileText, Users, History, Hammer, MapPin, DollarSign, Clock, Star, ThumbsUp, MessageSquare, Flame, Bug, Volume2, ShieldAlert, ExternalLink } from 'lucide-react'
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from 'recharts'

type Tab = 'overview' | 'violations' | 'complaints' | 'timeline' | 'landlord' | 'permits' | 'sales' | 'neighborhood' | 'reviews'

type RangeKey = '30d' | '90d' | '1y' | '3y'

type Review = {
  id: string
  bbl: string
  rating: number
  title: string | null
  review: string
  pros: string | null
  cons: string | null
  lived_here: boolean
  years_lived: string | null
  author_name: string
  helpful_count: number
  created_at: string
}

// Recharts is generally stable, but a single unexpected value can occasionally
// trigger a runtime error that would otherwise take down the whole page.
// This boundary keeps the rest of the building page usable.
class ChartBoundary extends React.Component<
  { children: React.ReactNode; title?: string },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: any) {
    console.error('Chart render error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center text-center px-4">
          <div>
            <div className="text-sm font-semibold text-[#e2e8f0]">Chart unavailable</div>
            <div className="text-xs text-[#64748b] mt-1">
              {this.props.title ? `${this.props.title} couldn't load for this building.` : 'This chart could not be rendered for this building.'}
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function BuildingPage() {
  const params = useParams()
  const router = useRouter()
  const bbl = params.bbl as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [range, setRange] = useState<RangeKey>('90d')
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  
  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewsData, setReviewsData] = useState<{ count: number, averageRating: number, distribution: Record<number, number> }>({ count: 0, averageRating: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } })
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', review: '', pros: '', cons: '', lived_here: false, years_lived: '', author_name: '', email: '', phone: '' })
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [votedReviews, setVotedReviews] = useState<Set<string>>(new Set())

  // Initialize time range from query string (?range=30d|90d|1y|3y)
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search)
      const r = (qs.get('range') || '').toLowerCase()
      if (r === '30d' || r === '90d' || r === '1y' || r === '3y') setRange(r)
    } catch {}
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/building?bbl=${bbl}`)
        const json = await res.json()
        if (json.error) setError(json.error)
        else setData(json)
      } catch { setError('Failed to load data') }
      finally { setLoading(false) }
    }
    if (bbl) load()
  }, [bbl])
  
  // Fetch reviews
  useEffect(() => {
    async function loadReviews() {
      try {
        const res = await fetch(`/api/reviews?bbl=${bbl}`)
        const json = await res.json()
        if (!json.error) {
          setReviews(json.reviews || [])
          setReviewsData({ count: json.count, averageRating: json.averageRating, distribution: json.distribution })
        }
      } catch (e) { console.error('Failed to load reviews', e) }
    }
    if (bbl) loadReviews()
  }, [bbl])
  
  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingReview(true)
    setReviewError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbl, ...reviewForm })
      })
      const json = await res.json()
      if (json.error) {
        setReviewError(json.error)
      } else {
        setReviews([json.review, ...reviews])
        setReviewsData(prev => ({ ...prev, count: prev.count + 1, averageRating: ((prev.averageRating * prev.count) + reviewForm.rating) / (prev.count + 1) }))
        setShowReviewForm(false)
        setReviewForm({ rating: 5, title: '', review: '', pros: '', cons: '', lived_here: false, years_lived: '', author_name: '', email: '', phone: '' })
      }
    } catch { setReviewError('Failed to submit review') }
    finally { setSubmittingReview(false) }
  }
  
  const voteHelpful = async (reviewId: string) => {
    if (votedReviews.has(reviewId)) return
    try {
      await fetch('/api/reviews/helpful', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId })
      })
      setVotedReviews(new Set([...Array.from(votedReviews), reviewId]))
      setReviews(reviews.map(r => r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r))
    } catch (e) { console.error('Vote failed', e) }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    if (!q) return
    setSearching(true)
    setSearchError('')
    try {
      const res = await fetch(`/api/lookup?address=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json?.bbl) {
        router.push(`/building/${json.bbl}`)
      } else {
        setSearchError(json?.error || 'Address not found')
      }
    } catch {
      setSearchError('Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e17]">
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 border-4 border-[#1e293b] rounded-full" />
          <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
        </div>
        <p className="text-[#94a3b8] text-xl mb-2">Analyzing building...</p>
        <p className="text-[#64748b] text-sm">Fetching from 30+ data sources</p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e17]">
      <div className="text-center max-w-md px-4">
        <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Building Not Found</h1>
        <p className="text-[#94a3b8] mb-6">{error}</p>
        <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-semibold">
          <ChevronLeft size={18} />Back to Search
        </Link>
      </div>
    </div>
  )

  const { building: b, score: s } = data
  const scoreColor = s.overall >= 80 ? '#10b981' : s.overall >= 60 ? '#f59e0b' : '#ef4444'
  const scoreBadge = s.overall >= 80 ? { text: 'GOOD', cls: 'badge-green' } : s.overall >= 60 ? { text: 'FAIR', cls: 'badge-yellow' } : { text: 'POOR', cls: 'badge-red' }
  const circumference = 2 * Math.PI * 42
  const strokeDashoffset = circumference - (s.overall / 100) * circumference
  const COLORS = ['#f97316', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#64748b']

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'reviews', label: `Reviews${reviewsData.count > 0 ? ` (${reviewsData.count})` : ''}`, icon: MessageSquare },
    { id: 'violations', label: 'Violations', icon: AlertTriangle },
    { id: 'complaints', label: 'Complaints', icon: FileText },
    { id: 'timeline', label: 'Timeline', icon: History },
    { id: 'landlord', label: 'Landlord', icon: Users },
    { id: 'permits', label: 'Permits', icon: Hammer },
    { id: 'sales', label: 'Sales', icon: DollarSign },
    { id: 'neighborhood', label: 'Neighborhood', icon: MapPin },
  ]

  const rangeOptions: { key: RangeKey; label: string; subtitle: string }[] = [
    { key: '30d', label: '30 days', subtitle: 'most recent' },
    { key: '90d', label: '90 days', subtitle: 'recent pattern' },
    { key: '1y', label: '1 year', subtitle: 'seasonality' },
    { key: '3y', label: '3 years', subtitle: 'longer trend' },
  ]

  const windowSignals = data?.signals?.windows?.[range]

  const signalCounts = windowSignals?.counts || { heat: 0, pests: 0, noise: 0, other: 0, total: 0 }
  const signalDeltas = windowSignals?.deltas || { heat: 0, pests: 0, noise: 0, other: 0, total: 0 }

  const signalSeries = useMemo(() => {
    const series = data?.signals?.series
    if (!series) return []
    if (range === '30d') return series.daily30 || []
    if (range === '90d') return series.weekly90 || []
    const monthly = series.monthly36 || []
    if (range === '1y') return monthly.slice(-12)
    return monthly
  }, [data, range])

  const rangeLabel = rangeOptions.find(r => r.key === range)?.label || '90 days'

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0e17]/95 backdrop-blur-xl border-b border-[#1e293b]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Building2 size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold hidden sm:block">Building Health X</span>
          </Link>
          <form onSubmit={handleSearch} className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5568]" size={18} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={b?.address || "Search..."} className="w-full pl-10 pr-10 py-2.5 bg-[#151c2c] border border-[#1e293b] rounded-xl text-sm text-white placeholder-[#4a5568] focus:outline-none focus:border-blue-500/50" disabled={searching} />
              {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />}
            </div>
            {searchError && <div className="text-xs text-red-400 mt-1">{searchError}</div>}
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Building Header */}
        <div className="card p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h1 className="text-2xl md:text-3xl font-bold">{b?.address || 'Unknown'}</h1>
                <span className={`badge ${scoreBadge.cls}`}>{scoreBadge.text}</span>
                {b?.isRentStabilized && <span className="badge badge-cyan">Rent Stabilized</span>}
                {data.programs?.aep && <span className="badge badge-red">AEP Building</span>}
                {data.programs?.speculationWatch && <span className="badge badge-orange">Speculation Watch</span>}
                {b?.isNycha && <span className="badge badge-purple">NYCHA</span>}
                {b?.isSubsidized && <span className="badge badge-green">Subsidized</span>}
              </div>
              <p className="text-[#94a3b8] text-lg mb-4">
                {b?.neighborhood && `${b.neighborhood}, `}{b?.borough}, NY {b?.zipcode}
              </p>
              <div className="flex flex-wrap gap-3">
                {b?.unitsRes > 0 && <div className="px-3 py-2 bg-[#1a2235] rounded-lg"><span className="text-[#64748b] text-xs">Units</span><span className="ml-2 text-white font-semibold">{b.unitsRes}</span></div>}
                {b?.yearBuilt && <div className="px-3 py-2 bg-[#1a2235] rounded-lg"><span className="text-[#64748b] text-xs">Built</span><span className="ml-2 text-white font-semibold">{b.yearBuilt}</span></div>}
                {b?.floors > 0 && <div className="px-3 py-2 bg-[#1a2235] rounded-lg"><span className="text-[#64748b] text-xs">Floors</span><span className="ml-2 text-white font-semibold">{b.floors}</span></div>}
                {b?.buildingClassDesc && <div className="px-3 py-2 bg-[#1a2235] rounded-lg"><span className="text-[#64748b] text-xs">Type</span><span className="ml-2 text-white font-semibold">{b.buildingClassDesc}</span></div>}
                {b?.rentStabilizedUnits && <div className="px-3 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg"><span className="text-cyan-400 text-xs">RS Units</span><span className="ml-2 text-cyan-300 font-semibold">{b.rentStabilizedUnits}</span></div>}
              </div>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full score-ring" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold" style={{ color: scoreColor }}>{s.overall}</span>
                  <span className="text-xs text-[#64748b]">/ 100</span>
                </div>
              </div>
              <p className="text-sm font-medium mt-2" style={{ color: scoreColor }}>{s.label}</p>
            </div>
          </div>
        </div>

        {/* Red Flags */}
        {data.redFlags?.length > 0 && (
          <div className="card card-warning p-5 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="text-red-400" size={20} />
              </div>
              <div>
                <h2 className="font-bold text-red-400 mb-2">{data.redFlags.length} Red Flag{data.redFlags.length > 1 ? 's' : ''} Detected</h2>
                <ul className="space-y-2">
                  {data.redFlags.slice(0, 8).map((f: any, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${f.severity === 'critical' ? 'bg-red-500' : f.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                      <div className={f.severity === 'critical' ? 'text-red-300' : 'text-[#94a3b8]'}><strong>{f.title}</strong> — {f.description}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)} className={`tab flex items-center gap-2 ${tab === t.id ? 'tab-active' : ''}`}>
              <t.icon size={16} />{t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Time Window */}
            <div className="card p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 font-bold">
                    <Clock size={16} className="text-[#94a3b8]" />
                    Time window: <span className="text-white">{rangeLabel}</span>
                  </div>
                  <p className="text-sm text-[#64748b] mt-1">We summarize this period and compare it to the previous period of the same length.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {rangeOptions.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setRange(r.key)}
                      className={`px-3 py-2 rounded-xl border text-sm transition-all ${range === r.key ? 'bg-blue-500 border-blue-500 text-white' : 'bg-[#151c2c] border-[#1e293b] text-[#94a3b8] hover:text-white'}`}
                    >
                      <div className="font-semibold leading-none">{r.label}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{r.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* At-a-glance signals */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-5 stat-yellow">
                <div className="flex items-center justify-between">
                  <div className="text-[#64748b] text-xs">Heat & Hot Water reports</div>
                  <Flame size={18} className="text-yellow-400" />
                </div>
                <div className="text-3xl font-bold text-yellow-300 mt-2">{signalCounts.heat}</div>
                <div className={`text-xs mt-1 ${signalDeltas.heat > 0 ? 'text-red-300' : signalDeltas.heat < 0 ? 'text-emerald-300' : 'text-[#64748b]'}`}>
                  {signalDeltas.heat === 0 ? 'No change vs prior period' : `${signalDeltas.heat > 0 ? '+' : ''}${signalDeltas.heat} vs prior period`}
                </div>
              </div>
              <div className="card p-5 stat-green">
                <div className="flex items-center justify-between">
                  <div className="text-[#64748b] text-xs">Pest signals</div>
                  <Bug size={18} className="text-emerald-400" />
                </div>
                <div className="text-3xl font-bold text-emerald-300 mt-2">{signalCounts.pests}</div>
                <div className={`text-xs mt-1 ${signalDeltas.pests > 0 ? 'text-red-300' : signalDeltas.pests < 0 ? 'text-emerald-300' : 'text-[#64748b]'}`}>
                  {signalDeltas.pests === 0 ? 'No change vs prior period' : `${signalDeltas.pests > 0 ? '+' : ''}${signalDeltas.pests} vs prior period`}
                </div>
              </div>
              <div className="card p-5 stat-blue">
                <div className="flex items-center justify-between">
                  <div className="text-[#64748b] text-xs">Noise signals</div>
                  <Volume2 size={18} className="text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-blue-300 mt-2">{signalCounts.noise}</div>
                <div className={`text-xs mt-1 ${signalDeltas.noise > 0 ? 'text-red-300' : signalDeltas.noise < 0 ? 'text-emerald-300' : 'text-[#64748b]'}`}>
                  {signalDeltas.noise === 0 ? 'No change vs prior period' : `${signalDeltas.noise > 0 ? '+' : ''}${signalDeltas.noise} vs prior period`}
                </div>
              </div>
              <div className="card p-5 stat-red">
                <div className="flex items-center justify-between">
                  <div className="text-[#64748b] text-xs">Open hazardous violations</div>
                  <ShieldAlert size={18} className="text-red-400" />
                </div>
                <div className="text-3xl font-bold text-red-300 mt-2">{(data?.violations?.hpd?.classC ?? 0)}</div>
                <div className="text-xs text-[#64748b] mt-1">Class C (immediately hazardous)</div>
              </div>
            </div>

            {/* Resident Reviews Widget - Prominent */}
            <div className="card p-6 border-2 border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 cursor-pointer hover:border-yellow-500/50 transition-colors" onClick={() => setTab('reviews')}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                    <Star className="text-yellow-400 fill-yellow-400" size={28} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">What Do Residents Say?</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold">{reviewsData.averageRating > 0 ? reviewsData.averageRating.toFixed(1) : '—'}</span>
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map(star => (
                          <Star key={star} size={18} className={star <= Math.round(reviewsData.averageRating) ? 'text-yellow-400 fill-yellow-400' : 'text-[#4a5568]'} />
                        ))}
                      </div>
                      <span className="text-[#64748b]">({reviewsData.count} review{reviewsData.count !== 1 ? 's' : ''})</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={(e) => { e.stopPropagation(); setTab('reviews'); setShowReviewForm(true); }} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg flex items-center gap-2">
                    <MessageSquare size={16} />
                    Write a Review
                  </button>
                  <ChevronRight className="text-[#4a5568]" size={20} />
                </div>
              </div>
            </div>

            {/* Signals over time */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Reports over time ({rangeLabel})</h3>
                <div className="text-xs text-[#64748b]">Heat / Pests / Noise / Other</div>
              </div>
              <div className="h-72">
                <ChartBoundary title="Reports over time">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={signalSeries || []} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="heatG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.28}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                      <linearGradient id="pestsG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.22}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                      <linearGradient id="noiseG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.22}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                      <linearGradient id="otherG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#64748b" stopOpacity={0.18}/><stop offset="95%" stopColor="#64748b" stopOpacity={0}/></linearGradient>
                    </defs>
                    <XAxis dataKey="label" stroke="#4a5568" fontSize={10} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis stroke="#4a5568" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#151c2c', border: '1px solid #2a3441', borderRadius: '10px', fontSize: '12px' }} />
                    <Legend />
                    <Area type="monotone" dataKey="heat" name="Heat" stroke="#f59e0b" strokeWidth={2} fill="url(#heatG)" stackId="1" />
                    <Area type="monotone" dataKey="pests" name="Pests" stroke="#10b981" strokeWidth={2} fill="url(#pestsG)" stackId="1" />
                    <Area type="monotone" dataKey="noise" name="Noise" stroke="#3b82f6" strokeWidth={2} fill="url(#noiseG)" stackId="1" />
                    <Area type="monotone" dataKey="other" name="Other" stroke="#64748b" strokeWidth={2} fill="url(#otherG)" stackId="1" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartBoundary>
              </div>
              <div className="mt-4 text-xs text-[#64748b]">
                Total reports in this window: <span className="text-white font-semibold">{signalCounts.total}</span>
              </div>
            </div>

            {/* What to look at next */}
            <div className="card p-6">
              <h3 className="font-bold mb-2 text-lg">What to sanity-check before a lease</h3>
              <p className="text-sm text-[#64748b] mb-4">Use the tabs to drill in. These are the highest-signal checks.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-[#1a2235] rounded-xl border border-[#1e293b]">
                  <div className="flex items-center gap-2 font-semibold"><Flame size={16} className="text-yellow-400" />Heat & hot water</div>
                  <div className="text-xs text-[#94a3b8] mt-1">Look for repeated winter spikes and unresolved building-wide patterns.</div>
                </div>
                <div className="p-4 bg-[#1a2235] rounded-xl border border-[#1e293b]">
                  <div className="flex items-center gap-2 font-semibold"><Bug size={16} className="text-emerald-400" />Pests</div>
                  <div className="text-xs text-[#94a3b8] mt-1">Repeated rodent fails or bedbug filings matter more than a single event.</div>
                </div>
                <div className="p-4 bg-[#1a2235] rounded-xl border border-[#1e293b]">
                  <div className="flex items-center gap-2 font-semibold"><Volume2 size={16} className="text-blue-400" />Noise</div>
                  <div className="text-xs text-[#94a3b8] mt-1">Late-night spikes can hint at chronic issues (bar, construction, neighbors).</div>
                </div>
                <div className="p-4 bg-[#1a2235] rounded-xl border border-[#1e293b]">
                  <div className="flex items-center gap-2 font-semibold"><ShieldAlert size={16} className="text-red-400" />Hazards</div>
                  <div className="text-xs text-[#94a3b8] mt-1">Open Class C violations deserve direct questions during a showing.</div>
                </div>
              </div>
            </div>

            {/* Category Scores */}
            <div className="card p-6">
              <h3 className="font-bold mb-6 text-lg">Category Scores</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.categoryScores?.map((c: any) => (
                  <div key={c.name} className="p-4 bg-[#1a2235] rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2"><span className="text-lg">{c.icon}</span><span className="font-medium">{c.name}</span></div>
                      <span className={`font-bold ${c.score >= 80 ? 'text-emerald-400' : c.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{c.score}</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${c.score}%`, backgroundColor: c.score >= 80 ? '#10b981' : c.score >= 60 ? '#f59e0b' : '#ef4444' }} /></div>
                    <p className="text-xs text-[#64748b] mt-2">{c.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIOLATIONS TAB */}
        {tab === 'violations' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              <div className="card p-4 text-center"><div className="text-2xl font-bold text-red-400">{(data?.violations?.hpd?.classC ?? 0)}</div><div className="text-xs text-[#64748b]">Class C</div></div>
              <div className="card p-4 text-center"><div className="text-2xl font-bold text-yellow-400">{data.violations.hpd.classB}</div><div className="text-xs text-[#64748b]">Class B</div></div>
              <div className="card p-4 text-center"><div className="text-2xl font-bold text-blue-400">{data.violations.hpd.classA}</div><div className="text-xs text-[#64748b]">Class A</div></div>
              <div className="card p-4 text-center"><div className="text-2xl font-bold">{data.violations.hpd.total}</div><div className="text-xs text-[#64748b]">Total HPD</div></div>
              <div className="card p-4 text-center"><div className="text-2xl font-bold text-orange-400">{data.violations.dob.total}</div><div className="text-xs text-[#64748b]">DOB</div></div>
              <div className="card p-4 text-center"><div className="text-2xl font-bold text-purple-400">{data.violations.ecb.total}</div><div className="text-xs text-[#64748b]">ECB</div></div>
            </div>

            {/* Yearly Chart */}
            <div className="card p-6">
              <h3 className="font-bold mb-4">Violations by Year</h3>
              <div className="h-56">
                <ChartBoundary title="Violations by Year">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(data.yearlyStats ? data.yearlyStats.slice(0, 8).reverse() : [])}>
                    <XAxis dataKey="year" stroke="#4a5568" fontSize={11} />
                    <YAxis stroke="#4a5568" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#151c2c', border: '1px solid #2a3441', borderRadius: '8px' }} />
                    <Bar dataKey="hpdViolations" fill="#3b82f6" name="HPD" radius={[4,4,0,0]} />
                    <Bar dataKey="dobViolations" fill="#f97316" name="DOB" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBoundary>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-bold mb-4">Recent Violations ({data.violations.recent?.length})</h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {data.violations.recent?.length > 0 ? data.violations.recent.map((v: any) => (
                  <div key={v.id} className="p-4 bg-[#1a2235] rounded-xl border border-[#1e293b]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${v.class === 'C' ? 'violation-c' : v.class === 'B' ? 'violation-b' : v.source === 'DOB' ? 'badge-orange' : 'violation-a'}`}>{v.source}{v.class ? ` ${v.class}` : ''}</span>
                        <div><p className="text-sm">{v.description}</p><div className="flex gap-3 mt-1 text-xs text-[#64748b]"><span>{v.category}</span>{v.unit && <span>Unit: {v.unit}</span>}</div></div>
                      </div>
                      <div className="text-right flex-shrink-0"><span className={`text-xs font-medium ${v.status === 'Open' ? 'text-red-400' : 'text-[#64748b]'}`}>{v.status}</span><p className="text-xs text-[#4a5568] mt-1">{v.date && new Date(v.date).toLocaleDateString()}</p></div>
                    </div>
                  </div>
                )) : <div className="text-center py-8 text-[#64748b]"><CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />No violations</div>}
              </div>
            </div>
          </div>
        )}

        {/* COMPLAINTS TAB */}
        {tab === 'complaints' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4 text-center"><div className="text-2xl font-bold">{data.complaints.hpd.total}</div><div className="text-xs text-[#64748b]">Total HPD</div></div>
              <div className="card p-4 text-center"><div className="text-2xl font-bold text-yellow-400">{data.complaints.hpd.recentYear}</div><div className="text-xs text-[#64748b]">Last 12mo</div></div>
              <div className="card p-4 text-center"><div className="text-2xl font-bold text-orange-400">{data.complaints.hpd.heatHotWater}</div><div className="text-xs text-[#64748b]">Heat/Hot Water</div></div>
              <div className="card p-4 text-center"><div className="text-2xl font-bold text-blue-400">{data.complaints.sr311.total}</div><div className="text-xs text-[#64748b]">311 Requests</div></div>
            </div>
            <div className="card p-6">
              <h3 className="font-bold mb-4">Recent Complaints</h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {data.complaints.recent?.length > 0 ? data.complaints.recent.map((c: any) => (
                  <div key={c.id} className="p-4 bg-[#1a2235] rounded-xl border border-[#1e293b] flex items-center justify-between">
                    <div><span className={`badge ${c.source === 'HPD' ? 'badge-blue' : c.source === '311' ? 'badge-purple' : 'badge-orange'} mr-2`}>{c.source}</span><span className="text-sm">{c.type}</span>{c.descriptor && <span className="text-xs text-[#64748b] ml-2">({c.descriptor})</span>}</div>
                    <div className="text-right"><span className="text-xs text-[#64748b]">{c.status}</span><p className="text-xs text-[#4a5568]">{c.date && new Date(c.date).toLocaleDateString()}</p></div>
                  </div>
                )) : <div className="text-center py-8 text-[#64748b]">No complaints</div>}
              </div>
            </div>
          </div>
        )}

        {/* TIMELINE TAB */}
        {tab === 'timeline' && (
          <div className="card p-6 animate-fade-in">
            <h3 className="font-bold mb-6 text-lg">Building Timeline ({data.timeline?.length} events)</h3>
            <div className="space-y-4 max-h-[700px] overflow-y-auto">
              {data.timeline?.length > 0 ? data.timeline.map((e: any, i: number) => (
                <div key={i} className={`timeline-item severity-${e.severity || 'low'} pb-4`}>
                  <div className="flex items-start justify-between">
                    <div><span className={`badge ${e.type === 'violation' ? 'badge-red' : e.type === 'complaint' ? 'badge-yellow' : e.type === 'sale' ? 'badge-green' : e.type === 'eviction' ? 'badge-purple' : e.type === 'litigation' ? 'badge-orange' : 'badge-blue'} mr-2`}>{e.type}</span><span className="text-xs text-[#64748b]">{e.source}</span><p className="text-sm mt-1">{e.description}</p></div>
                    <span className="text-xs text-[#64748b] flex-shrink-0">{e.date && new Date(e.date).toLocaleDateString()}</span>
                  </div>
                </div>
              )) : <div className="text-center py-8 text-[#64748b]">No events</div>}
            </div>
          </div>
        )}

        {/* LANDLORD TAB */}
        {tab === 'landlord' && (
          <div className="space-y-6 animate-fade-in">
            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4 text-center"><div className="text-2xl font-bold">{data.violations.hpd.open}</div><div className="text-xs text-[#64748b]">Open Violations</div></div>
              <div className="card p-4 text-center"><div className="text-2xl font-bold">{data.violations.hpd.total}</div><div className="text-xs text-[#64748b]">Total Violations</div></div>
              <div className="card p-4 text-center"><div className="text-2xl font-bold text-orange-400">{data.evictions.filings?.total || 0}</div><div className="text-xs text-[#64748b]">Eviction Filings</div></div>
              <div className="card p-4 text-center"><div className="text-2xl font-bold text-red-400">{data.evictions.total}</div><div className="text-xs text-[#64748b]">Evictions Executed</div></div>
            </div>

            {/* Who's the landlord - styled like Who Owns What */}
            <div className="card p-6">
              <h3 className="font-bold mb-2 text-lg">Who's the landlord of this building?</h3>
              <p className="text-[#64748b] text-sm mb-6">Learn more about the people responsible for this building</p>
              
              {/* All Contacts */}
              <div className="space-y-4">
                {data.landlord.owners?.map((c: any, i: number) => (
                  <div key={`owner-${i}`} className="p-4 bg-[#1a2235] rounded-xl border-l-4 border-blue-500">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-lg">{c.name}</div>
                        <div className="text-sm text-blue-400">{c.title || 'Head Officer'}</div>
                        {c.address && <div className="text-sm text-[#64748b] mt-1">{c.address}</div>}
                      </div>
                    </div>
                  </div>
                ))}
                
                {data.landlord.agents?.map((c: any, i: number) => (
                  <div key={`agent-${i}`} className="p-4 bg-[#1a2235] rounded-xl border-l-4 border-green-500">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-lg">{c.name}</div>
                        <div className="text-sm text-green-400">{c.title || 'Agent'}</div>
                        {c.address && <div className="text-sm text-[#64748b] mt-1">{c.address}</div>}
                      </div>
                    </div>
                  </div>
                ))}
                
                {data.landlord.siteManagers?.filter((c: any) => !data.landlord.agents?.find((a: any) => a.name === c.name)).map((c: any, i: number) => (
                  <div key={`site-${i}`} className="p-4 bg-[#1a2235] rounded-xl border-l-4 border-purple-500">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-lg">{c.name}</div>
                        <div className="text-sm text-purple-400">Site Manager</div>
                        {c.address && <div className="text-sm text-[#64748b] mt-1">{c.address}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Corporation & Registration */}
              <div className="mt-6 p-4 bg-[#151c2c] rounded-xl">
                <div className="font-bold text-lg mb-2">{data.landlord.name}</div>
                <div className="flex flex-wrap gap-4 text-sm text-[#94a3b8]">
                  {data.landlord.registrationDate && <span>{data.landlord.registrationDate}</span>}
                  {data.landlord.registrationExpires && <span className="text-yellow-400">({data.landlord.registrationExpires})</span>}
                </div>
                {data.sales?.recent?.[0] && (
                  <div className="mt-2 text-sm">
                    <span className="text-[#64748b]">Last sold: </span>
                    <span className="text-white">{new Date(data.sales.recent[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span className="text-emerald-400 ml-2">for ${data.sales.recent[0].amount?.toLocaleString()}</span>
                  </div>
                )}
              </div>
              
              {data.landlord.portfolioSize > 1 && (
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <div className="text-blue-400 font-medium">This landlord owns {data.landlord.portfolioSize} buildings</div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`https://whoownswhat.justfix.org/bbl/${bbl}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-blue-400 text-sm">Who Owns What <ExternalLink size={14} /></a>
                <a href={`https://hpdonline.nyc.gov/hpdonline/building/${bbl}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2235] hover:bg-[#232938] rounded-lg text-sm">HPD Profile <ExternalLink size={14} /></a>
              </div>
            </div>
            
            {/* Portfolio */}
            {data.landlord.portfolio?.length > 0 && (
              <div className="card p-6">
                <h3 className="font-bold mb-4">Other Buildings by This Owner ({data.landlord.portfolioSize})</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">{data.landlord.portfolio.map((p: any) => (<Link key={p.bbl} href={`/building/${p.bbl}`} className="block p-3 bg-[#1a2235] rounded-lg hover:bg-[#232938]"><div className="flex items-center justify-between"><div><div className="font-medium">{p.address}</div><div className="text-xs text-[#64748b]">{p.borough} {p.zipcode}</div></div><ChevronRight size={16} className="text-[#4a5568]" /></div></Link>))}</div>
              </div>
            )}
            
            {/* Eviction Filings */}
            {data.evictions.filings?.recent?.length > 0 && (
              <div className="card p-6">
                <h3 className="font-bold mb-4">Housing Court Filings ({data.evictions.filings.total})</h3>
                <div className="space-y-3">{data.evictions.filings.recent.map((f: any) => (<div key={f.id} className="p-4 bg-[#1a2235] rounded-xl flex items-center justify-between"><div><span className="badge badge-orange mr-2">Filing</span><span className="text-sm">{f.caseType || 'Housing Court'}</span></div><span className="text-xs text-[#64748b]">{f.filedDate && new Date(f.filedDate).toLocaleDateString()}</span></div>))}</div>
              </div>
            )}
            
            {/* HPD Legal Actions */}
            {data.litigations.recent?.length > 0 && (
              <div className="card p-6">
                <h3 className="font-bold mb-4">HPD Legal Actions ({data.litigations.total})</h3>
                <div className="space-y-3">{data.litigations.recent.map((l: any) => (<div key={l.id} className="p-4 bg-[#1a2235] rounded-xl flex items-center justify-between"><div><span className="badge badge-purple mr-2">{l.caseType}</span><span className="text-sm">{l.caseStatus}</span>{l.penalty && <span className="text-emerald-400 text-sm ml-2">${l.penalty.toLocaleString()}</span>}</div><span className="text-xs text-[#64748b]">{l.caseOpenDate && new Date(l.caseOpenDate).toLocaleDateString()}</span></div>))}</div>
              </div>
            )}
            
            {/* Evictions Executed */}
            {data.evictions.recent?.length > 0 && (
              <div className="card p-6">
                <h3 className="font-bold mb-4">Evictions Executed ({data.evictions.total})</h3>
                <div className="space-y-3">{data.evictions.recent.map((e: any) => (<div key={e.id} className="p-4 bg-[#1a2235] rounded-xl flex items-center justify-between"><div><span className="badge badge-red mr-2">Executed</span><span className="text-sm">{e.type}</span></div><span className="text-xs text-[#64748b]">{e.executedDate && new Date(e.executedDate).toLocaleDateString()}</span></div>))}</div>
              </div>
            )}
          </div>
        )}

        {/* PERMITS TAB */}
        {tab === 'permits' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4 text-center"><div className="text-2xl font-bold">{data.permits.total}</div><div className="text-xs text-[#64748b]">Total Filings</div></div>
              <div className="card p-4 text-center"><div className="text-2xl font-bold text-orange-400">{data.permits.majorAlterations}</div><div className="text-xs text-[#64748b]">Major Alterations</div></div>
              <div className="card p-4 text-center"><div className="text-2xl font-bold text-blue-400">{data.permits.recentActivity}</div><div className="text-xs text-[#64748b]">Last 3 Years</div></div>
            </div>
            <div className="card p-6">
              <h3 className="font-bold mb-4">Recent Permits & Filings</h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">{data.permits.recent?.length > 0 ? data.permits.recent.map((p: any) => (<div key={p.jobNumber} className="p-4 bg-[#1a2235] rounded-xl"><div className="flex items-center justify-between mb-2"><span className="badge badge-blue">{p.jobTypeDesc || p.jobType}</span><span className="text-xs text-[#64748b]">{p.filingDate && new Date(p.filingDate).toLocaleDateString()}</span></div><div className="text-sm">{p.workType || 'Work filing'}</div>{p.estimatedCost && <div className="text-xs text-emerald-400 mt-1">Est. Cost: ${p.estimatedCost.toLocaleString()}</div>}<div className="text-xs text-[#64748b] mt-1">Status: {p.jobStatusDesc || p.jobStatus}</div></div>)) : <div className="text-center py-8 text-[#64748b]">No permits</div>}</div>
            </div>
          </div>
        )}

        {/* SALES TAB */}
        {tab === 'sales' && (
          <div className="space-y-6 animate-fade-in">
            {data.sales.recent?.length > 0 ? (
              <div className="card p-6">
                <h3 className="font-bold mb-4">Property Sales History</h3>
                <div className="space-y-3">{data.sales.recent.map((s: any) => (<div key={s.id} className="p-4 bg-[#1a2235] rounded-xl flex items-center justify-between"><div className="flex items-center gap-3"><DollarSign className="text-green-400" size={20} /><div><div className="font-semibold text-green-400">${s.amount.toLocaleString()}</div><div className="text-xs text-[#64748b]">{s.docType}</div></div></div><span className="text-sm text-[#64748b]">{s.date && new Date(s.date).toLocaleDateString()}</span></div>))}</div>
              </div>
            ) : <div className="card p-6 text-center text-[#64748b]">No sales data available</div>}
            <div className="card p-6">
              <h3 className="font-bold mb-4">External Records</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <a href={`https://a836-acris.nyc.gov/bblsearch/bblsearch.asp?borough=${bbl[0]}&block=${bbl.slice(1,6)}&lot=${bbl.slice(6)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-[#1a2235] rounded-xl hover:bg-[#232938]"><span>ACRIS (Full History)</span><ExternalLink size={14} className="text-[#4a5568]" /></a>
                <a href={`https://zola.planning.nyc.gov/lot/${bbl[0]}/${bbl.slice(1,6).replace(/^0+/, '')}/${bbl.slice(6).replace(/^0+/, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-[#1a2235] rounded-xl hover:bg-[#232938]"><span>ZoLa (Zoning)</span><ExternalLink size={14} className="text-[#4a5568]" /></a>
              </div>
            </div>
          </div>
        )}

        {/* NEIGHBORHOOD TAB - ENHANCED WITH 55+ DATA SOURCES */}
        {tab === 'neighborhood' && (
          <div className="space-y-6 animate-fade-in">
            {/* Neighborhood Score */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg">Neighborhood Score</h3>
                <div className="text-3xl font-bold" style={{ color: data.neighborhoodScore >= 70 ? '#10b981' : data.neighborhoodScore >= 50 ? '#f59e0b' : '#ef4444' }}>{data.neighborhoodScore || 'N/A'}</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                  <div className="text-2xl mb-1">🚔</div>
                  <div className="text-lg font-bold" style={{ color: data.crime?.score >= 70 ? '#10b981' : data.crime?.score >= 50 ? '#f59e0b' : '#ef4444' }}>{data.crime?.level || 'N/A'}</div>
                  <div className="text-xs text-[#64748b]">Crime Level</div>
                </div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                  <div className="text-2xl mb-1">🔫</div>
                  <div className="text-lg font-bold" style={{ color: data.shootings?.score >= 70 ? '#10b981' : data.shootings?.score >= 50 ? '#f59e0b' : '#ef4444' }}>{data.shootings?.level || 'N/A'}</div>
                  <div className="text-xs text-[#64748b]">Violent Crime</div>
                </div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                  <div className="text-2xl mb-1">🚶</div>
                  <div className="text-lg font-bold" style={{ color: data.trafficSafety?.score >= 70 ? '#10b981' : data.trafficSafety?.score >= 50 ? '#f59e0b' : '#ef4444' }}>{data.trafficSafety?.level || 'N/A'}</div>
                  <div className="text-xs text-[#64748b]">Pedestrian Safety</div>
                </div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                  <div className="text-2xl mb-1">💧</div>
                  <div className="text-lg font-bold" style={{ color: data.flood?.floodRisk === 'LOW' ? '#10b981' : data.flood?.floodRisk === 'MODERATE' ? '#f59e0b' : '#ef4444' }}>{data.flood?.floodRisk || 'LOW'}</div>
                  <div className="text-xs text-[#64748b]">Flood Risk</div>
                </div>
              </div>
            </div>

            {/* HUD Fair Market Rent - NEW! */}
            {data.rentFairness?.hudFMR && (
              <div className="card p-6 border-2 border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
                <h3 className="font-bold mb-4 flex items-center gap-2"><span className="text-xl">💰</span> Rent Fairness Meter (HUD FY2025)</h3>
                <p className="text-sm text-[#64748b] mb-4">Compare asking rent to HUD Fair Market Rent benchmarks (40th percentile of NYC area rents)</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-xs text-[#64748b] mb-1">Studio</div>
                    <div className="text-lg font-bold text-blue-400">${data.rentFairness.hudFMR.studio?.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-xs text-[#64748b] mb-1">1 BR</div>
                    <div className="text-lg font-bold text-blue-400">${data.rentFairness.hudFMR.oneBr?.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-xs text-[#64748b] mb-1">2 BR</div>
                    <div className="text-lg font-bold text-blue-400">${data.rentFairness.hudFMR.twoBr?.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-xs text-[#64748b] mb-1">3 BR</div>
                    <div className="text-lg font-bold text-blue-400">${data.rentFairness.hudFMR.threeBr?.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-xs text-[#64748b] mb-1">4 BR</div>
                    <div className="text-lg font-bold text-blue-400">${data.rentFairness.hudFMR.fourBr?.toLocaleString()}</div>
                  </div>
                </div>
                <p className="text-xs text-[#64748b] mt-3">If rent is significantly above FMR, it may be overpriced. Source: HUD.gov</p>
              </div>
            )}

            {/* Violent Crime (Shootings) - NEW! */}
            <div className="card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2"><span className="text-xl">🔫</span> Shooting Incidents (500m, 3 years)</h3>
              <div className="grid sm:grid-cols-4 gap-4 mb-4">
                <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                  <div className="text-2xl font-bold" style={{ color: data.shootings?.total === 0 ? '#10b981' : data.shootings?.total <= 2 ? '#f59e0b' : '#ef4444' }}>{data.shootings?.total || 0}</div>
                  <div className="text-xs text-[#64748b]">Total Shootings</div>
                </div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                  <div className="text-2xl font-bold text-red-400">{data.shootings?.fatal || 0}</div>
                  <div className="text-xs text-[#64748b]">Fatal</div>
                </div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                  <div className="text-2xl font-bold" style={{ color: data.shootings?.score >= 70 ? '#10b981' : data.shootings?.score >= 50 ? '#f59e0b' : '#ef4444' }}>{data.shootings?.score || 100}</div>
                  <div className="text-xs text-[#64748b]">Safety Score</div>
                </div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                  <div className="text-lg font-bold" style={{ color: data.shootings?.level === 'LOW' ? '#10b981' : data.shootings?.level === 'MODERATE' ? '#f59e0b' : '#ef4444' }}>{data.shootings?.level || 'LOW'}</div>
                  <div className="text-xs text-[#64748b]">Risk Level</div>
                </div>
              </div>
              {data.shootings?.total === 0 && <p className="text-sm text-green-400">✓ No shooting incidents nearby in the last 3 years</p>}
            </div>

            {/* Pedestrian Safety (Vision Zero) - NEW! */}
            <div className="card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2"><span className="text-xl">🚶</span> Pedestrian & Traffic Safety (300m, 2 years)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
                <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                  <div className="text-2xl font-bold">{data.trafficSafety?.crashes || 0}</div>
                  <div className="text-xs text-[#64748b]">Crashes</div>
                </div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                  <div className="text-2xl font-bold text-orange-400">{data.trafficSafety?.pedestrianInjuries || 0}</div>
                  <div className="text-xs text-[#64748b]">Ped Injuries</div>
                </div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                  <div className="text-2xl font-bold text-red-400">{data.trafficSafety?.pedestrianFatalities || 0}</div>
                  <div className="text-xs text-[#64748b]">Ped Deaths</div>
                </div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                  <div className="text-2xl font-bold text-yellow-400">{data.trafficSafety?.cyclistInjuries || 0}</div>
                  <div className="text-xs text-[#64748b]">Cyclist Injuries</div>
                </div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                  <div className="text-lg font-bold" style={{ color: data.trafficSafety?.score >= 70 ? '#10b981' : data.trafficSafety?.score >= 50 ? '#f59e0b' : '#ef4444' }}>{data.trafficSafety?.score || 100}</div>
                  <div className="text-xs text-[#64748b]">Safety Score</div>
                </div>
              </div>
              <p className="text-xs text-[#64748b]">Data from NYC Vision Zero motor vehicle collision reports</p>
            </div>

            {/* Crime */}
            <div className="card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2"><span className="text-xl">🚔</span> All Crime (500m radius, last year)</h3>
              <div className="grid sm:grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-[#1a2235] rounded-xl text-center"><div className="text-2xl font-bold">{data.crime?.total || 0}</div><div className="text-xs text-[#64748b]">Total Incidents</div></div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center"><div className="text-2xl font-bold text-red-400">{data.crime?.violent || 0}</div><div className="text-xs text-[#64748b]">Violent Crimes</div></div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center"><div className="text-2xl font-bold" style={{ color: data.crime?.score >= 70 ? '#10b981' : data.crime?.score >= 50 ? '#f59e0b' : '#ef4444' }}>{data.crime?.score || 0}</div><div className="text-xs text-[#64748b]">Safety Score</div></div>
              </div>
              {data.crime?.byType?.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {data.crime.byType.slice(0,8).map((c: any) => (
                    <div key={c.type} className="flex items-center justify-between p-2 bg-[#151c2c] rounded-lg">
                      <span className="text-sm text-[#94a3b8]">{c.type}</span>
                      <span className="text-sm font-medium">{c.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Noise Complaints - NEW! */}
            {data.noise && (
              <div className="card p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2"><span className="text-xl">🔊</span> Noise Complaints (3 years)</h3>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-2xl font-bold" style={{ color: data.noise.level === 'LOW' ? '#10b981' : data.noise.level === 'MODERATE' ? '#f59e0b' : '#ef4444' }}>{data.noise.total || 0}</div>
                    <div className="text-xs text-[#64748b]">Total Noise Complaints</div>
                  </div>
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-lg font-bold" style={{ color: data.noise.level === 'LOW' ? '#10b981' : data.noise.level === 'MODERATE' ? '#f59e0b' : '#ef4444' }}>{data.noise.level}</div>
                    <div className="text-xs text-[#64748b]">Noise Level</div>
                  </div>
                </div>
                {data.noise?.byType?.length > 0 && (
                  <div className="space-y-2">
                    {data.noise.byType.map((n: any) => (
                      <div key={n.type} className="flex items-center justify-between p-2 bg-[#151c2c] rounded-lg">
                        <span className="text-sm text-[#94a3b8]">{n.type}</span>
                        <span className="text-sm font-medium">{n.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pest Score - NEW! */}
            {data.pests && (
              <div className="card p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2"><span className="text-xl">🐛</span> Pest Control Score</h3>
                <div className="grid sm:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-2xl font-bold" style={{ color: data.pests.score >= 70 ? '#10b981' : data.pests.score >= 50 ? '#f59e0b' : '#ef4444' }}>{data.pests.score}</div>
                    <div className="text-xs text-[#64748b]">Pest Score</div>
                  </div>
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-2xl font-bold text-orange-400">{data.pests.rodentFails}</div>
                    <div className="text-xs text-[#64748b]">Rodent Fails</div>
                  </div>
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-2xl font-bold text-red-400">{data.pests.bedbugReports}</div>
                    <div className="text-xs text-[#64748b]">Bedbug Reports</div>
                  </div>
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-2xl font-bold text-yellow-400">{data.pests.restaurantPestViolations}</div>
                    <div className="text-xs text-[#64748b]">Restaurant Pests</div>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${data.pests.level === 'LOW' ? 'bg-green-500/10 text-green-400' : data.pests.level === 'MODERATE' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                  Pest Risk: <strong>{data.pests.level}</strong>
                </div>
              </div>
            )}

            {/* Restaurants & Food Safety - NEW! */}
            {data.restaurants && (
              <div className="card p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2"><span className="text-xl">🍽️</span> Nearby Restaurant Inspections (100m)</h3>
                <div className="grid sm:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-2xl font-bold">{data.restaurants.nearbyCount}</div>
                    <div className="text-xs text-[#64748b]">Restaurants</div>
                  </div>
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-2xl font-bold" style={{ color: data.restaurants.avgGrade === 'A' ? '#10b981' : data.restaurants.avgGrade === 'B' ? '#f59e0b' : '#ef4444' }}>{data.restaurants.avgGrade || '—'}</div>
                    <div className="text-xs text-[#64748b]">Avg Grade</div>
                  </div>
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-2xl font-bold text-red-400">{data.restaurants.criticalViolations}</div>
                    <div className="text-xs text-[#64748b]">Critical Violations</div>
                  </div>
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-2xl font-bold text-orange-400">{data.restaurants.pestViolations}</div>
                    <div className="text-xs text-[#64748b]">Pest Violations</div>
                  </div>
                </div>
                {data.restaurants.note && <p className="text-sm text-orange-400">{data.restaurants.note}</p>}
              </div>
            )}

            {/* Cooling Towers (Legionella) - NEW! */}
            {data.coolingTowers && (
              <div className="card p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2"><span className="text-xl">🏭</span> Cooling Towers (Legionella Risk)</h3>
                <div className={`p-4 rounded-xl ${data.coolingTowers.hasTower ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                  <div className="flex items-center justify-between">
                    <span>Cooling Tower Present</span>
                    <span className={`font-bold ${data.coolingTowers.hasTower ? 'text-yellow-400' : 'text-green-400'}`}>{data.coolingTowers.hasTower ? `YES (${data.coolingTowers.count})` : 'NO'}</span>
                  </div>
                  {data.coolingTowers.hasTower && (
                    <p className="text-xs text-[#64748b] mt-2">{data.coolingTowers.riskNote}</p>
                  )}
                  {data.coolingTowers.lastCertification && (
                    <p className="text-xs text-[#64748b] mt-1">Last certification: {data.coolingTowers.lastCertification}</p>
                  )}
                </div>
              </div>
            )}

            {/* Tax Exemptions & Rent Stabilization - NEW! */}
            {data.taxExemptions && (
              <div className="card p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2"><span className="text-xl">🏛️</span> Tax Exemptions & Rent Stabilization</h3>
                <div className="grid sm:grid-cols-3 gap-4 mb-4">
                  <div className={`p-3 rounded-xl ${data.taxExemptions.has421a ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-[#1a2235]'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">421-a Exemption</span>
                      <span className={`font-bold ${data.taxExemptions.has421a ? 'text-blue-400' : 'text-[#64748b]'}`}>{data.taxExemptions.has421a ? 'YES' : 'NO'}</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl ${data.taxExemptions.hasJ51 ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-[#1a2235]'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">J-51 Exemption</span>
                      <span className={`font-bold ${data.taxExemptions.hasJ51 ? 'text-blue-400' : 'text-[#64748b]'}`}>{data.taxExemptions.hasJ51 ? 'YES' : 'NO'}</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl ${data.taxExemptions.rentStabilizedByExemption ? 'bg-green-500/10 border border-green-500/30' : 'bg-[#1a2235]'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Rent Stabilized</span>
                      <span className={`font-bold ${data.taxExemptions.rentStabilizedByExemption ? 'text-green-400' : 'text-[#64748b]'}`}>{data.taxExemptions.rentStabilizedByExemption ? 'LIKELY' : 'UNKNOWN'}</span>
                    </div>
                  </div>
                </div>
                {data.taxExemptions.note && <p className="text-sm text-blue-400 mb-2">{data.taxExemptions.note}</p>}
                {data.taxExemptions.exemptionExpiration && <p className="text-sm text-yellow-400">⚠️ Exemption expires: {data.taxExemptions.exemptionExpiration} - rent may increase after</p>}
              </div>
            )}

            {/* Financial Health - NEW! */}
            {data.financialHealth && (
              <div className="card p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2"><span className="text-xl">💰</span> Building Financial Health</h3>
                <div className="grid sm:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-2xl font-bold" style={{ color: data.financialHealth.score >= 70 ? '#10b981' : data.financialHealth.score >= 50 ? '#f59e0b' : '#ef4444' }}>{data.financialHealth.score}</div>
                    <div className="text-xs text-[#64748b]">Financial Score</div>
                  </div>
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-2xl font-bold" style={{ color: data.financialHealth.taxLiens === 0 ? '#10b981' : '#ef4444' }}>{data.financialHealth.taxLiens}</div>
                    <div className="text-xs text-[#64748b]">Tax Liens</div>
                  </div>
                  <div className="p-3 bg-[#1a2235] rounded-xl text-center">
                    <div className="text-lg font-bold" style={{ color: data.financialHealth.level === 'HEALTHY' ? '#10b981' : data.financialHealth.level === 'FAIR' ? '#f59e0b' : '#ef4444' }}>{data.financialHealth.level}</div>
                    <div className="text-xs text-[#64748b]">Status</div>
                  </div>
                </div>
                {data.taxLiens?.warning && <p className="text-sm text-red-400">{data.taxLiens.warning}</p>}
              </div>
            )}

            {/* Flood & Hurricane */}
            <div className="card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2"><span className="text-xl">💧</span> Flood & Hurricane Risk</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl ${data.flood?.inFloodZone ? 'bg-red-500/10 border border-red-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                  <div className="flex items-center justify-between">
                    <span>FEMA Flood Zone</span>
                    <span className={`font-bold ${data.flood?.inFloodZone ? 'text-red-400' : 'text-green-400'}`}>{data.flood?.inFloodZone ? data.flood.floodZoneType || 'YES' : 'NO'}</span>
                  </div>
                  <p className="text-xs text-[#64748b] mt-1">{data.flood?.inFloodZone ? 'Consider flood insurance' : 'Not in a flood zone'}</p>
                </div>
                <div className={`p-4 rounded-xl ${data.flood?.inHurricaneZone ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                  <div className="flex items-center justify-between">
                    <span>Hurricane Evac Zone</span>
                    <span className={`font-bold ${data.flood?.inHurricaneZone ? 'text-orange-400' : 'text-green-400'}`}>{data.flood?.inHurricaneZone ? `Zone ${data.flood.hurricaneZone}` : 'NO'}</span>
                  </div>
                  <p className="text-xs text-[#64748b] mt-1">{data.flood?.inHurricaneZone ? 'May need to evacuate during hurricanes' : 'Not in evacuation zone'}</p>
                </div>
              </div>
            </div>

            {/* Parks & Green Space */}
            <div className="card p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2"><span className="text-xl">🌳</span> Parks & Green Space</h3>
              <div className="grid sm:grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-[#1a2235] rounded-xl text-center"><div className="text-2xl font-bold text-green-400">{data.parks?.count || 0}</div><div className="text-xs text-[#64748b]">Parks Nearby</div></div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center"><div className="text-2xl font-bold text-emerald-400">{data.parks?.totalAcres || 0}</div><div className="text-xs text-[#64748b]">Total Acres</div></div>
                <div className="p-3 bg-[#1a2235] rounded-xl text-center"><div className="text-2xl font-bold text-lime-400">{data.trees?.count || 0}</div><div className="text-xs text-[#64748b]">Street Trees</div></div>
              </div>
              {data.parks?.nearby?.length > 0 && (
                <div className="space-y-2">
                  {data.parks.nearby.slice(0,5).map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-[#151c2c] rounded-lg">
                      <span>{p.name}</span>
                      {p.acres && <span className="text-xs text-[#64748b]">{p.acres} acres</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* REVIEWS TAB */}
        {tab === 'reviews' && (
          <div className="space-y-6 animate-fade-in">
            {/* Reviews Summary */}
            <div className="card p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-white">{reviewsData.averageRating.toFixed(1)}</div>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      {[1,2,3,4,5].map(star => (
                        <Star key={star} size={20} className={star <= Math.round(reviewsData.averageRating) ? 'text-yellow-400 fill-yellow-400' : 'text-[#4a5568]'} />
                      ))}
                    </div>
                    <div className="text-sm text-[#64748b] mt-1">{reviewsData.count} review{reviewsData.count !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="space-y-1">
                    {[5,4,3,2,1].map(rating => (
                      <div key={rating} className="flex items-center gap-2">
                        <span className="text-xs w-3">{rating}</span>
                        <Star size={12} className="text-yellow-400 fill-yellow-400" />
                        <div className="w-24 h-2 bg-[#1e293b] rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${reviewsData.count > 0 ? (reviewsData.distribution[rating] / reviewsData.count) * 100 : 0}%` }} />
                        </div>
                        <span className="text-xs text-[#64748b] w-6">{reviewsData.distribution[rating]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => setShowReviewForm(!showReviewForm)} className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-semibold flex items-center gap-2">
                  <MessageSquare size={18} />
                  Write a Review
                </button>
              </div>
            </div>

            {/* Review Form */}
            {showReviewForm && (
              <div className="card p-6 border-2 border-blue-500/30 animate-fade-in">
                <h3 className="font-bold text-lg mb-6">Share Your Experience</h3>
                <form onSubmit={submitReview} className="space-y-6">
                  {/* Rating */}
                  <div>
                    <label className="block text-sm text-[#94a3b8] mb-2">Your Rating *</label>
                    <div className="flex items-center gap-2">
                      {[1,2,3,4,5].map(star => (
                        <button key={star} type="button" onClick={() => setReviewForm({...reviewForm, rating: star})} className="p-1 hover:scale-110 transition-transform">
                          <Star size={32} className={star <= reviewForm.rating ? 'text-yellow-400 fill-yellow-400' : 'text-[#4a5568] hover:text-yellow-400'} />
                        </button>
                      ))}
                      <span className="ml-2 text-[#64748b]">{reviewForm.rating === 1 ? 'Terrible' : reviewForm.rating === 2 ? 'Poor' : reviewForm.rating === 3 ? 'Average' : reviewForm.rating === 4 ? 'Good' : 'Excellent'}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-sm text-[#94a3b8] mb-2">Review Title</label>
                    <input type="text" value={reviewForm.title} onChange={e => setReviewForm({...reviewForm, title: e.target.value})} placeholder="Summarize your experience" className="w-full p-3 bg-[#151c2c] border border-[#1e293b] rounded-xl text-white placeholder-[#4a5568] focus:outline-none focus:border-blue-500/50" maxLength={100} />
                  </div>

                  {/* Review Text */}
                  <div>
                    <label className="block text-sm text-[#94a3b8] mb-2">Your Review *</label>
                    <textarea value={reviewForm.review} onChange={e => setReviewForm({...reviewForm, review: e.target.value})} placeholder="Tell others about your experience living here. What did you like? What could be better?" rows={4} className="w-full p-3 bg-[#151c2c] border border-[#1e293b] rounded-xl text-white placeholder-[#4a5568] focus:outline-none focus:border-blue-500/50 resize-none" minLength={10} required />
                  </div>

                  {/* Pros & Cons */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[#94a3b8] mb-2">👍 Pros</label>
                      <textarea value={reviewForm.pros} onChange={e => setReviewForm({...reviewForm, pros: e.target.value})} placeholder="What did you like?" rows={2} className="w-full p-3 bg-[#151c2c] border border-[#1e293b] rounded-xl text-white placeholder-[#4a5568] focus:outline-none focus:border-blue-500/50 resize-none" />
                    </div>
                    <div>
                      <label className="block text-sm text-[#94a3b8] mb-2">👎 Cons</label>
                      <textarea value={reviewForm.cons} onChange={e => setReviewForm({...reviewForm, cons: e.target.value})} placeholder="What could be better?" rows={2} className="w-full p-3 bg-[#151c2c] border border-[#1e293b] rounded-xl text-white placeholder-[#4a5568] focus:outline-none focus:border-blue-500/50 resize-none" />
                    </div>
                  </div>

                  {/* Lived Here & Years */}
                  <div className="flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={reviewForm.lived_here} onChange={e => setReviewForm({...reviewForm, lived_here: e.target.checked})} className="w-5 h-5 rounded border-[#1e293b] bg-[#151c2c] text-blue-500 focus:ring-blue-500" />
                      <span className="text-[#94a3b8]">I live/lived here</span>
                    </label>
                    {reviewForm.lived_here && (
                      <select value={reviewForm.years_lived} onChange={e => setReviewForm({...reviewForm, years_lived: e.target.value})} className="p-2 bg-[#151c2c] border border-[#1e293b] rounded-lg text-white focus:outline-none focus:border-blue-500/50">
                        <option value="">How long?</option>
                        <option value="< 1 year">Less than 1 year</option>
                        <option value="1-2 years">1-2 years</option>
                        <option value="2-5 years">2-5 years</option>
                        <option value="5+ years">5+ years</option>
                      </select>
                    )}
                  </div>

                  {/* Author Name */}
                  <div>
                    <label className="block text-sm text-[#94a3b8] mb-2">Your Name (optional)</label>
                    <input type="text" value={reviewForm.author_name} onChange={e => setReviewForm({...reviewForm, author_name: e.target.value})} placeholder="Anonymous" className="w-full sm:w-64 p-3 bg-[#151c2c] border border-[#1e293b] rounded-xl text-white placeholder-[#4a5568] focus:outline-none focus:border-blue-500/50" maxLength={50} />
                  </div>

                  {/* Contact Details (Required but not displayed publicly) */}
                  <div className="p-4 bg-[#151c2c] rounded-xl border border-[#1e293b]">
                    <p className="text-sm text-[#94a3b8] mb-4">📧 Your contact details are required for verification but will <strong>never be displayed publicly</strong>.</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-[#94a3b8] mb-2">Email Address *</label>
                        <input type="email" value={reviewForm.email} onChange={e => setReviewForm({...reviewForm, email: e.target.value})} placeholder="your@email.com" className="w-full p-3 bg-[#0a0e17] border border-[#1e293b] rounded-xl text-white placeholder-[#4a5568] focus:outline-none focus:border-blue-500/50" required />
                      </div>
                      <div>
                        <label className="block text-sm text-[#94a3b8] mb-2">Phone Number *</label>
                        <input type="tel" value={reviewForm.phone} onChange={e => setReviewForm({...reviewForm, phone: e.target.value})} placeholder="(555) 123-4567" className="w-full p-3 bg-[#0a0e17] border border-[#1e293b] rounded-xl text-white placeholder-[#4a5568] focus:outline-none focus:border-blue-500/50" required />
                      </div>
                    </div>
                  </div>

                  {/* Error & Submit */}
                  {reviewError && <p className="text-red-400 text-sm">{reviewError}</p>}
                  <div className="flex items-center gap-4">
                    <button type="submit" disabled={submittingReview} className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 rounded-xl font-semibold flex items-center gap-2">
                      {submittingReview ? 'Submitting...' : 'Submit Review'}
                    </button>
                    <button type="button" onClick={() => setShowReviewForm(false)} className="px-6 py-3 bg-[#1e293b] hover:bg-[#2d3748] rounded-xl">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* Reviews List */}
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <div className="card p-12 text-center">
                  <MessageSquare className="w-16 h-16 text-[#4a5568] mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No reviews yet</h3>
                  <p className="text-[#64748b] mb-6">Be the first to share your experience living in this building!</p>
                  <button onClick={() => setShowReviewForm(true)} className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-semibold">Write a Review</button>
                </div>
              ) : reviews.map(review => (
                <div key={review.id} className="card p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center">
                          {[1,2,3,4,5].map(star => (
                            <Star key={star} size={16} className={star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-[#4a5568]'} />
                          ))}
                        </div>
                        {review.lived_here && (
                          <span className="badge badge-green flex items-center gap-1">
                            <CheckCircle size={12} /> Verified Resident
                          </span>
                        )}
                      </div>
                      {review.title && <h4 className="font-semibold text-lg">{review.title}</h4>}
                    </div>
                    <div className="text-right text-sm text-[#64748b]">
                      <div>{review.author_name}</div>
                      <div>{new Date(review.created_at).toLocaleDateString()}</div>
                      {review.years_lived && <div className="text-xs">Lived here: {review.years_lived}</div>}
                    </div>
                  </div>
                  
                  <p className="text-[#e2e8f0] mb-4 whitespace-pre-wrap">{review.review}</p>
                  
                  {(review.pros || review.cons) && (
                    <div className="grid sm:grid-cols-2 gap-4 mb-4">
                      {review.pros && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                          <div className="text-xs text-green-400 font-semibold mb-1">👍 PROS</div>
                          <p className="text-sm text-[#e2e8f0]">{review.pros}</p>
                        </div>
                      )}
                      {review.cons && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <div className="text-xs text-red-400 font-semibold mb-1">👎 CONS</div>
                          <p className="text-sm text-[#e2e8f0]">{review.cons}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 pt-3 border-t border-[#1e293b]">
                    <button onClick={() => voteHelpful(review.id)} disabled={votedReviews.has(review.id)} className={`flex items-center gap-2 text-sm ${votedReviews.has(review.id) ? 'text-blue-400' : 'text-[#64748b] hover:text-white'}`}>
                      <ThumbsUp size={16} className={votedReviews.has(review.id) ? 'fill-blue-400' : ''} />
                      Helpful ({review.helpful_count})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* External Links */}
        <div className="card p-6 mt-6">
          <h3 className="font-bold mb-4">Official Records</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'HPD Building Profile', url: `https://hpdonline.nyc.gov/hpdonline/building/${bbl}` },
              { label: 'DOB Building Info', url: `https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?boro=${bbl[0]}&block=${bbl.slice(1,6)}&lot=${bbl.slice(6)}` },
              { label: 'ACRIS (Sales)', url: `https://a836-acris.nyc.gov/bblsearch/bblsearch.asp?borough=${bbl[0]}&block=${bbl.slice(1,6)}&lot=${bbl.slice(6)}` },
              { label: 'Who Owns What', url: `https://whoownswhat.justfix.org/bbl/${bbl}` },
            ].map(link => (<a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-[#1a2235] rounded-xl hover:bg-[#232938] text-sm"><span>{link.label}</span><ExternalLink size={14} className="text-[#4a5568]" /></a>))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 p-4 bg-[#151c2c] rounded-xl border border-[#1e293b] text-center">
          <p className="text-xs text-[#64748b]">{data.dataDisclaimer}</p>
        </div>
      </main>
    </div>
  )
}
