import { promises as fs } from 'fs'
import path from 'path'
import { dbPool } from './database-pool'

export interface AlertNote {
  id: string
  alertId: string
  author: string
  content: string
  createdAt: string
  parentId?: string | null
  resolved?: boolean
  resolvedAt?: string | null
  resolvedBy?: string | null
}

export interface AlertNoteInput {
  alertId: string
  author: string
  content: string
  parentId?: string | null
}

const NOTES_DRIVER = (process.env.ALERT_NOTES_DRIVER || 'file').toLowerCase()
const NOTES_STORE_PATH = path.join(process.cwd(), 'artifacts', 'alert-notes.json')

interface FileNoteStore {
  notes: AlertNote[]
}

async function readFileStore(): Promise<FileNoteStore> {
  try {
    const raw = await fs.readFile(NOTES_STORE_PATH, 'utf-8')
    return JSON.parse(raw) as FileNoteStore
  } catch {
    return { notes: [] }
  }
}

async function writeFileStore(store: FileNoteStore) {
  await fs.mkdir(path.dirname(NOTES_STORE_PATH), { recursive: true })
  await fs.writeFile(NOTES_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

const useDatabase = NOTES_DRIVER === 'db'

export async function listAlertNotes(alertId: string): Promise<AlertNote[]> {
  if (!alertId) return []

  if (useDatabase) {
    try {
      const result = await dbPool.query(
        `SELECT id, alert_id, author, content, created_at, parent_id, resolved, resolved_at, resolved_by
         FROM alert_notes
         WHERE alert_id = $1
         ORDER BY created_at ASC`,
        [alertId]
      )
      return result.rows.map((row) => ({
        id: row.id,
        alertId: row.alert_id,
        author: row.author,
        content: row.content,
        createdAt: row.created_at?.toISOString?.() ?? row.created_at,
        parentId: row.parent_id ?? null,
        resolved: row.resolved ?? false,
        resolvedAt: row.resolved_at?.toISOString?.() ?? row.resolved_at ?? null,
        resolvedBy: row.resolved_by ?? null,
      }))
    } catch (error) {
      console.error('Failed to fetch alert notes from DB:', error)
      return []
    }
  }

  const store = await readFileStore()
  return store.notes.filter((note) => note.alertId === alertId)
}

export async function createAlertNote(input: AlertNoteInput): Promise<AlertNote> {
  if (!input.alertId) {
    throw new Error('alertId is required')
  }
  if (!input.author) {
    throw new Error('author is required')
  }
  if (!input.content) {
    throw new Error('content is required')
  }

  if (useDatabase) {
    try {
      const result = await dbPool.query(
        `INSERT INTO alert_notes (alert_id, author, content, parent_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, alert_id, author, content, created_at, parent_id, resolved, resolved_at, resolved_by`,
        [input.alertId, input.author, input.content, input.parentId || null]
      )
      const row = result.rows[0]
      return {
        id: row.id,
        alertId: row.alert_id,
        author: row.author,
        content: row.content,
        createdAt: row.created_at?.toISOString?.() ?? row.created_at,
        parentId: row.parent_id ?? null,
        resolved: row.resolved ?? false,
        resolvedAt: row.resolved_at?.toISOString?.() ?? row.resolved_at ?? null,
        resolvedBy: row.resolved_by ?? null,
      }
    } catch (error) {
      console.error('Failed to insert alert note into DB:', error)
      throw error
    }
  }

  const store = await readFileStore()
  const note: AlertNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    alertId: input.alertId,
    author: input.author,
    content: input.content,
    createdAt: new Date().toISOString(),
    parentId: input.parentId ?? null,
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
  }
  store.notes.push(note)
  await writeFileStore(store)
  return note
}

export async function updateNoteResolved(
  alertId: string,
  noteId: string,
  resolved: boolean,
  resolvedBy?: string | null
): Promise<AlertNote> {
  if (useDatabase) {
    try {
      const result = await dbPool.query(
        `UPDATE alert_notes
         SET resolved = $1, resolved_at = $2, resolved_by = $3
         WHERE id = $4 AND alert_id = $5
         RETURNING id, alert_id, author, content, created_at, parent_id, resolved, resolved_at, resolved_by`,
        [
          resolved,
          resolved ? new Date().toISOString() : null,
          resolved ? resolvedBy || null : null,
          noteId,
          alertId,
        ]
      )
      if (result.rows.length === 0) {
        throw new Error('Note not found')
      }
      const row = result.rows[0]
      return {
        id: row.id,
        alertId: row.alert_id,
        author: row.author,
        content: row.content,
        createdAt: row.created_at?.toISOString?.() ?? row.created_at,
        parentId: row.parent_id ?? null,
        resolved: row.resolved ?? false,
        resolvedAt: row.resolved_at?.toISOString?.() ?? row.resolved_at ?? null,
        resolvedBy: row.resolved_by ?? null,
      }
    } catch (error) {
      console.error('Failed to update note resolved status in DB:', error)
      throw error
    }
  }

  const store = await readFileStore()
  const noteIndex = store.notes.findIndex((n) => n.id === noteId && n.alertId === alertId)
  if (noteIndex === -1) {
    throw new Error('Note not found')
  }
  const note = store.notes[noteIndex]
  note.resolved = resolved
  note.resolvedAt = resolved ? new Date().toISOString() : null
  note.resolvedBy = resolved ? resolvedBy || null : null
  await writeFileStore(store)
  return note
}
