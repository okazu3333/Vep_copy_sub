import { NextRequest, NextResponse } from 'next/server'
import { createAlertNote, listAlertNotes } from '@/lib/alert-notes'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const notes = await listAlertNotes(params.id)
    return NextResponse.json({ notes })
  } catch (error) {
    console.error('Failed to fetch alert notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const body = await req.json()
    const author = (body.author ?? '').trim()
    const content = (body.content ?? '').trim()
    const parentId = body.parentId ?? null

    if (!author || !content) {
      return NextResponse.json({ error: 'author and content are required' }, { status: 400 })
    }

    const note = await createAlertNote({
      alertId: params.id,
      author,
      content,
      parentId: parentId || null,
    })

    return NextResponse.json({ note }, { status: 201 })
  } catch (error) {
    console.error('Failed to create alert note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

