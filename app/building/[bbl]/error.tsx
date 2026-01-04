'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, ChevronLeft } from 'lucide-react'

export default function BuildingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Building page error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e17]">
      <div className="max-w-md w-full px-4 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
          <AlertTriangle className="text-red-300" size={26} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Something broke on this building page</h1>
        <p className="text-[#94a3b8] text-sm mb-6">
          This is usually caused by a missing data field for a specific building or a chart trying to render unexpected values.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 font-semibold"
          >
            <RefreshCw size={16} /> Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#151c2c] border border-[#1e293b] text-[#e2e8f0] hover:text-white"
          >
            <ChevronLeft size={16} /> Back to search
          </Link>
        </div>

        <div className="mt-6 text-xs text-[#64748b]">
          If you want the exact cause, open the browser console and copy the red error message.
        </div>
      </div>
    </div>
  )
}
