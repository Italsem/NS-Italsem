DROP TABLE IF EXISTS cards;

CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_last4 TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO cards (card_last4, holder_name, status) VALUES
('4214','DAMIANO DOMENICO','assigned'),
('4214','RUSSO GIOVANNI','assigned'),
('4214','MOTTOLA VALERIO','assigned'),
('4214','SEVERINO ENZO','assigned'),
('4214','IULIANO AGOSTINO','assigned'),
('4214','COLAVITO FRANCO','assigned'),
('4214','MAIONE GIOVANNI','assigned'),
('4214','MAIO ORESTE','assigned'),
('4214','FAVICCHIO NICOLA','assigned'),
('4214','UFFICIO','assigned'),
('4214','COVIELLO NICOLA','assigned'),
('4214','CAPONE ANGELO','assigned'),
('4214','DI CAPRIO SALVATORE','assigned'),
('4214','LUBRANO GENNARO','assigned'),
('4214','BOGATCHUK MYKHAYLO','assigned'),
('4214','MUSSO GIANPIERO','assigned'),
('4214','FALCO RAFFAELE','assigned'),
('4214','CASSAFORTE','available'),
('4214','CASSAFORTE','available'),
('4214','CASSAFORTE','available'),
('4214','CASSAFORTE','available'),
('4214','CASSAFORTE','available');
