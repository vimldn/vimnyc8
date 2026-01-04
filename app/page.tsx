'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CheckCircle2, ChevronRight, Clock, Database, Search, Shield, Sparkles, Star } from 'lucide-react'

interface Suggestion {
  bbl: string
  address: string
  borough: string
  zipcode: string
  neighborhood?: string
  units?: number
}

export default function HomePage() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const reqSeqRef = useRef(0)

  useEffect(() => {
    if (query.length < 2) {
      // Cancel any in-flight request
      abortRef.current?.abort()
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    const seq = ++reqSeqRef.current
    const controller = new AbortController()
    // Abort the previous request so we never display stale results
    abortRef.current?.abort()
    abortRef.current = controller

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        const data = await res.json()
        // Ignore out-of-order responses
        if (reqSeqRef.current !== seq) return

        if (data.suggestions?.length) {
          setSuggestions(data.suggestions)
          setShowDropdown(true)
        } else {
          setSuggestions([])
          setShowDropdown(false)
        }
      } catch (e) {
        // Abort is expected when the user keeps typing
        if ((e as any)?.name === 'AbortError') return
        setSuggestions([])
        setShowDropdown(false)
      }
    }, 120)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = (s: Suggestion) => {
    setLoading(true)
    setShowDropdown(false)
    router.push(`/building/${s.bbl}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || !suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((p) => (p < suggestions.length - 1 ? p + 1 : p))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((p) => (p > 0 ? p - 1 : 0))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      handleSelect(suggestions[selectedIndex])
      return
    }
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/lookup?address=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data.bbl) router.push(`/building/${data.bbl}`)
      else {
        setLoading(false)
        alert(data.error || 'Address not found. Try including borough name.')
      }
    } catch {
      setLoading(false)
      alert('Something went wrong. Please try again.')
    }
  }

  return (
    <main className="min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0e17]/90 backdrop-blur-xl border-b border-[#1e293b]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold">Building Health X</span>
              <span className="hidden sm:inline text-sm text-[#64748b] ml-2">NYC building reality check</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-[#64748b]">
            <Clock size={14} />
            <span>30 / 90 days • 1 / 3 years</span>
          </div>
        </div>
      </header>

      <div className="relative min-h-screen flex items-center justify-center pt-16">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url('https://images.unsplash.com/photo-1529421308418-eab98863cee2?w=2000')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e17] via-[#0a0e17]/80 to-[#0a0e17]" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm mb-8">
              <Sparkles size={14} />
              A fast read on the stuff that actually matters
            </div>

            <h1 className="text-5xl md:text-6xl font-black mb-6 leading-[1.1]">
              Check a building <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">before</span>
              <span className="block mt-2">you sign.</span>
            </h1>

            <p className="text-xl text-[#94a3b8] mb-10 max-w-3xl mx-auto">
              Building Health X turns NYC open data into a clear, decision-first summary: recent heat/hot water issues, pests, noise,
              safety hazards, and resident reviews. Pick a time window (30/90 days, 1 year, 3 years) and see what’s changing.
            </p>

            <div className="relative max-w-2xl mx-auto" ref={dropdownRef}>
              <form onSubmit={handleSubmit}>
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-emerald-500/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#64748b]" size={22} />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value)
                        setSelectedIndex(-1)
                      }}
                      onKeyDown={handleKeyDown}
                      onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                      placeholder="Enter any NYC address..."
                      className="w-full pl-14 pr-32 py-5 bg-[#151c2c] border border-[#2a3441] rounded-2xl text-lg text-white placeholder-[#4a5568] focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/25"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Loading
                        </>
                      ) : (
                        <>
                          Check
                          <ChevronRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {showDropdown && suggestions.length > 0 && (
                <div className="autocomplete-dropdown animate-slide-up">
                  {suggestions.map((s, i) => (
                    <div
                      key={s.bbl}
                      className={`autocomplete-item ${i === selectedIndex ? 'selected' : ''}`}
                      onClick={() => handleSelect(s)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#1e293b] rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 size={18} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{s.address}</div>
                          <div className="text-sm text-[#64748b]">
                            {s.neighborhood ? `${s.neighborhood}, ` : ''}
                            {s.borough} {s.zipcode}
                            {s.units ? ` • ${s.units} units` : ''}
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-[#4a5568] flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-6 mt-10 text-sm text-[#64748b]">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-purple-400" />
                Clear, decision-first metrics
              </div>
              <div className="flex items-center gap-2">
                <Database size={16} className="text-cyan-400" />
                NYC Open Data + reviews
              </div>
              <div className="flex items-center gap-2">
                <Star size={16} className="text-yellow-400" />
                Resident experience included
              </div>
            </div>
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-6">
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="text-blue-400" size={18} />
                </div>
                <div className="font-bold">Fast read</div>
              </div>
              <p className="text-[#94a3b8] text-sm">
                One page answers the lease question: what’s broken, what’s noisy, what keeps showing up, and how recent it is.
              </p>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                  <Clock className="text-emerald-400" size={18} />
                </div>
                <div className="font-bold">Time windows</div>
              </div>
              <p className="text-[#94a3b8] text-sm">
                Toggle 30/90 days, 1 year, or 3 years. Recent spikes matter more than ancient history.
              </p>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-center">
                  <Star className="text-yellow-400" size={18} />
                </div>
                <div className="font-bold">Resident reality</div>
              </div>
              <p className="text-[#94a3b8] text-sm">
                Layer in reviews so you’re not relying only on complaints data (which can be incomplete or skewed).
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="py-10 text-center text-xs text-[#64748b] border-t border-[#1e293b]">
        Building Health X uses publicly available NYC datasets and resident reviews. Always verify with an in-person visit and your own due diligence.
      </footer>
    </main>
  )
}
