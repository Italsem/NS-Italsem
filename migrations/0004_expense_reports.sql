CREATE TABLE IF NOT EXISTS expense_reports (
  card_id INTEGER PRIMARY KEY,
  reports_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(card_id) REFERENCES cards(id)
);
