import { NextRequest, NextResponse } from 'next/server'
import { updateNoteResolved } from '@/lib/alert-notes'

interface RouteParams {
  params: {
    id: string
    noteId: string
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const body = await req.json()
    const resolved = body.resolved ?? false
    const resolvedBy = body.resolvedBy ?? null

    const note = await updateNoteResolved(params.id, params.noteId, resolved, resolvedBy)

    return NextResponse.json({ note }, { status: 200 })
  } catch (error) {
    console.error('Failed to update note resolved status:', error)
    return NextResponse.json(
      { error: 'Failed to update note resolved status' },
      { status: 500 }
    )
  }
}

