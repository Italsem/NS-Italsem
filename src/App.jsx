import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("it-IT");
};

const formatAmount = (value) => {
  const number = Number(value);
  if (Number.isNaN(number)) return value || "0,00 €";
  return number.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
};

const monthFromDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Mese non valido";
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
};

let xlsxLoader = null;
const loadXlsx = async () => {
  if (!xlsxLoader) {
    xlsxLoader = import("https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs");
  }
  return xlsxLoader;
};

function App() {
  const [cards, setCards] = useState([]);
  const [newLast4, setNewLast4] = useState("");
  const [newHolder, setNewHolder] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [reportsByCard, setReportsByCard] = useState({});
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef(null);

  const loadCards = async () => {
    const res = await fetch("/api/cards");
    const data = await res.json();
    setCards(data);
  };

  useEffect(() => {
    loadCards();
  }, []);

  const createCard = async () => {
    if (newLast4.length !== 4 || !newHolder.trim()) return;

    await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_last4: newLast4,
        holder_name: newHolder.trim(),
      }),
    });

    setNewLast4("");
    setNewHolder("");
    loadCards();
  };

  const deleteCard = async () => {
    if (!selectedCard) return;

    await fetch("/api/cards", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedCard.id }),
    });

    setReportsByCard((prev) => {
      const next = { ...prev };
      delete next[selectedCard.id];
      return next;
    });
    setSelectedCard(null);
    loadCards();
  };

  const parseWorkbook = async (file) => {
    const XLSX = await loadXlsx();
    const workbook = XLSX.read(await file.arrayBuffer());
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];

    const sheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    if (matrix.length <= 1) return [];

    return matrix.slice(1).map((line, index) => {
      const [date = "", movement = "", amount = ""] = line;
      return {
        id: `${Date.now()}-${index}`,
        date,
        movement,
        amount,
        note: movement,
        attachment: "",
      };
    });
  };

  const handleStatementImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCard) return;

    try {
      setImportError("");
      const rows = await parseWorkbook(file);
      const reportDate = rows[0]?.date || new Date().toISOString();
      const report = {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        month: monthFromDate(reportDate),
        rows,
      };

      setReportsByCard((prev) => {
        const current = prev[selectedCard.id] || [];
        return {
          ...prev,
          [selectedCard.id]: [report, ...current],
        };
      });
      setSelectedMonth(report.month);
    } catch {
      setImportError(
        "Import non riuscito. Verifica che il file .xlsx abbia colonne: data, movimento, importo.",
      );
    } finally {
      event.target.value = "";
    }
  };

  const updateRow = (reportId, rowId, key, value) => {
    if (!selectedCard) return;

    setReportsByCard((prev) => ({
      ...prev,
      [selectedCard.id]: (prev[selectedCard.id] || []).map((report) =>
        report.id !== reportId
          ? report
          : {
              ...report,
              rows: report.rows.map((row) =>
                row.id === rowId ? { ...row, [key]: value } : row,
              ),
            },
      ),
    }));
  };

  const monthlyHistory = useMemo(() => {
    if (!selectedCard) return [];
    const reports = reportsByCard[selectedCard.id] || [];
    return reports.reduce((acc, report) => {
      const month = report.month;
      const total = report.rows.reduce(
        (sum, row) => sum + (Number(String(row.amount).replace(",", ".")) || 0),
        0,
      );
      const existing = acc.find((item) => item.month === month);
      if (existing) {
        existing.reports += 1;
        existing.total += total;
      } else {
        acc.push({ month, reports: 1, total });
      }
      return acc;
    }, []);
  }, [reportsByCard, selectedCard]);

  const visibleReports = useMemo(() => {
    if (!selectedCard) return [];
    const reports = reportsByCard[selectedCard.id] || [];
    if (selectedMonth === "all") return reports;
    return reports.filter((report) => report.month === selectedMonth);
  }, [reportsByCard, selectedCard, selectedMonth]);

  if (selectedCard) {
    return (
      <div className="app-shell">
        <header className="top-header">
          <img src="/logo-italsem.png" alt="Logo Italsem" className="brand-logo" />
          <div className="title-group">
            <h1>Dettaglio carta **** {selectedCard.card_last4}</h1>
            <p>{selectedCard.holder_name}</p>
          </div>
          <div className="header-actions">
            <button type="button" onClick={() => setSelectedCard(null)}>
              Torna dashboard
            </button>
            <button type="button" className="danger" onClick={deleteCard}>
              Elimina carta
            </button>
          </div>
        </header>

        <main className="expense-window">
          <aside className="history-panel">
            <h3>Storico note spese</h3>
            <button
              type="button"
              className="accent"
              onClick={() => fileInputRef.current?.click()}
            >
              + Aggiungi nota spesa
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleStatementImport}
              className="hidden-input"
            />
            <button
              type="button"
              className={selectedMonth === "all" ? "month active" : "month"}
              onClick={() => setSelectedMonth("all")}
            >
              Tutti i mesi
            </button>
            {monthlyHistory.map((item) => (
              <button
                key={item.month}
                type="button"
                className={selectedMonth === item.month ? "month active" : "month"}
                onClick={() => setSelectedMonth(item.month)}
              >
                <span>{item.month}</span>
                <small>
                  {item.reports} note · {formatAmount(item.total)}
                </small>
              </button>
            ))}
          </aside>

          <section className="expense-content">
            {importError && <p className="error-box">{importError}</p>}
            {visibleReports.length === 0 ? (
              <p className="empty-state">
                Nessuna nota spese per questo filtro. Premi "Aggiungi nota spesa" e carica
                un file Excel .xlsx.
              </p>
            ) : (
              visibleReports.map((report) => (
                <div key={report.id} className="report-box">
                  <div className="report-head">
                    <strong>{report.month}</strong>
                    <span>Caricata il {formatDate(report.createdAt)}</span>
                  </div>
                  <div className="expense-table">
                    <div className="expense-row table-head">
                      <span>Data</span>
                      <span>Movimento</span>
                      <span>Importo</span>
                      <span>Descrizione</span>
                      <span>Allegato</span>
                    </div>
                    {report.rows.map((row) => (
                      <div key={row.id} className="expense-row">
                        <span>{formatDate(row.date)}</span>
                        <span>{row.movement || "-"}</span>
                        <span>{formatAmount(String(row.amount).replace(",", "."))}</span>
                        <input
                          type="text"
                          value={row.note}
                          onChange={(e) =>
                            updateRow(report.id, row.id, "note", e.target.value)
                          }
                        />
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) =>
                            updateRow(
                              report.id,
                              row.id,
                              "attachment",
                              e.target.files?.[0]?.name || "",
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="top-header">
        <img src="/logo-italsem.png" alt="Logo Italsem" className="brand-logo" />
        <div className="title-group">
          <h1>Dashboard Note Spese</h1>
          <p>Massimo 4 carte per colonna.</p>
        </div>
      </header>

      <main className="content-wrap">
        <section className="new-card">
          <h2>Aggiungi carta</h2>
          <div className="new-card-form">
            <input
              placeholder="Ultime 4 cifre"
              maxLength={4}
              value={newLast4}
              onChange={(e) => setNewLast4(e.target.value.replace(/\D/g, ""))}
            />
            <input
              placeholder="Utilizzatore o CASSAFORTE"
              value={newHolder}
              onChange={(e) => setNewHolder(e.target.value)}
            />
            <button onClick={createCard}>+ Nuova Carta</button>
          </div>
        </section>

        <section className="grid four-per-column">
          {cards.map((card) => (
            <button
              key={card.id}
              className="card-item"
              onClick={() => setSelectedCard(card)}
              type="button"
            >
              <div className="card-preview-wrap">
                <img src="/card.png" className="card-img" alt="Carta aziendale" />
                <span
                  className={`status-dot ${
                    card.status === "available" ? "available" : "assigned"
                  }`}
                />
              </div>
              <div className="card-details">
                <strong>**** **** **** {card.card_last4}</strong>
                <span>{card.holder_name}</span>
              </div>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}

export default App;
