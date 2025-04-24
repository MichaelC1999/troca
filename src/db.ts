import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(__dirname, '../data/db.sqlite'))

// Example table: store generated proofs & public inputs
db
  .prepare(`
    CREATE TABLE IF NOT EXISTS proofs (
      id TEXT PRIMARY KEY,
      type TEXT,
      public_inputs_json TEXT,
      proof_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  .run()

export default db