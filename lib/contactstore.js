import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'

const dbDir = path.join(process.cwd(), 'lib/database')
const dbFile = path.join(dbDir, 'contacts.sqlite')

let SQL = null
let db = null
let dirty = false

async function init() {
  if (db) return db

  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  SQL = await initSqlJs()

  if (fs.existsSync(dbFile)) {
    db = new SQL.Database(fs.readFileSync(dbFile))
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      primary_id TEXT PRIMARY KEY,
      secondary_id TEXT,
      name TEXT,
      updated_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_secondary ON contacts (secondary_id);
  `)

  save()
  setInterval(() => { if (dirty) save() }, 15000)

  return db
}

function save() {
  if (!db) return
  fs.writeFileSync(dbFile, Buffer.from(db.export()))
  dirty = false
}

function one(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const row = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  return row
}

function isLid(id) {
  return typeof id === 'string' && id.endsWith('@lid')
}

export async function upsertContact({ primaryId, secondaryId = null, name = null }) {
  if (!primaryId) return
  await init()

  const existing = one(`SELECT * FROM contacts WHERE primary_id = ?`, [primaryId])
  const finalSecondary = secondaryId || existing?.secondary_id || null
  const finalName = name || existing?.name || null

  db.run(
    `INSERT INTO contacts (primary_id, secondary_id, name, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(primary_id)
     DO UPDATE SET secondary_id = excluded.secondary_id, name = excluded.name, updated_at = excluded.updated_at`,
    [primaryId, finalSecondary, finalName, Math.floor(Date.now() / 1000)]
  )

  dirty = true
}

export async function syncFromParticipants(participants = []) {
  if (!Array.isArray(participants) || participants.length === 0) return
  await init()

  for (const p of participants) {
    if (!p?.id) continue
    await upsertContact({
      primaryId: p.id,
      secondaryId: p.phoneNumber || null,
      name: p.name || p.notify || null
    })
  }
}

export async function getByPrimaryId(primaryId) {
  await init()
  return one(`SELECT * FROM contacts WHERE primary_id = ?`, [primaryId])
}

export async function getBySecondaryId(secondaryId) {
  await init()
  return one(`SELECT * FROM contacts WHERE secondary_id = ?`, [secondaryId])
}

export async function resolveToPhone(id) {
  if (!id) return id
  if (!isLid(id)) return id

  await init()
  const row = one(`SELECT secondary_id FROM contacts WHERE primary_id = ?`, [id])
  return row?.secondary_id || id
}

export async function resolveToLid(id) {
  if (!id) return id
  if (isLid(id)) return id

  await init()
  const row = one(`SELECT primary_id FROM contacts WHERE secondary_id = ?`, [id])
  return row?.primary_id || id
}

export async function matches(id, target) {
  if (!id || !target) return false
  if (id === target) return true

  const resolvedId = isLid(id) ? await resolveToPhone(id) : await resolveToLid(id)
  return resolvedId === target
}