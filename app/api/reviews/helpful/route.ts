import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST - increment helpful count for a review
export async function POST(req: NextRequest) {
  try {
    const { reviewId } = await req.json()

    if (!reviewId) {
      return NextResponse.json({ error: 'Review ID required' }, { status: 400 })
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase is not configured on the server' }, { status: 500 })
    }

    const { error } = await supabase.rpc('increment_helpful', { review_id: reviewId })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error incrementing helpful:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
