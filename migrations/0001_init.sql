-- Cards (carte prepagate)
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  card_last4 TEXT NOT NULL,
  card_png_key TEXT,              -- key su R2 (es: cards/123.png)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Movements (movimenti mensili)
CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  movement_date TEXT NOT NULL,    -- ISO date: YYYY-MM-DD
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,  -- positivo=ricarica, negativo=spesa
  currency TEXT NOT NULL DEFAULT 'EUR',
  is_topup INTEGER NOT NULL DEFAULT 0, -- 1=ricarica, 0=spesa
  import_batch TEXT,              -- es: 2026-02 (mese import)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(card_id) REFERENCES cards(id)
);

-- Attachments (allegati per movimento)
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movement_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,           -- key su R2 (es: receipts/uuid.pdf)
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(movement_id) REFERENCES movements(id)
);

CREATE INDEX IF NOT EXISTS idx_movements_card_date ON movements(card_id, movement_date);
CREATE INDEX IF NOT EXISTS idx_attachments_movement ON attachments(movement_id);

