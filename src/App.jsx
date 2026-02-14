import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const EXPENSE_CATEGORIES = [
  "VITTO",
  "COSTI DI BOLLO",
  "COMMISSIONE SMS",
  "CARBURANTE",
  "PRELIEVO",
  "COMMISSIONI DI PRELIEVO",
  "ACQUISTO MATERIALI",
  "NOLEGGIO MACCHINARI",
];

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const formatAmount = (value) => {
  const number = Number(value);
  if (Number.isNaN(number)) return "0,00 €";
  return number.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
};

const parseAmount = (value) => {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const clean = String(value)
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim();
  const n = Number(clean);
  return Number.isNaN(n) ? 0 : n;
};

const parseDate = (raw) => {
  if (raw instanceof Date) return raw.toISOString();
  if (!raw) return new Date().toISOString();

  if (typeof raw === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + raw * 24 * 60 * 60 * 1000);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  const text = String(raw).trim();
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const yearToken = Number(slash[3]);
    const year = slash[3].length === 2 ? 2000 + yearToken : yearToken;
    return new Date(year, month - 1, day).toISOString();
  }

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  return new Date().toISOString();
};

const monthLabelFromIsoDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "mese non valido";
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
};

const monthLabelFromKey = (value) => {
  if (!value) return "";
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
};

const monthKeyFromIsoDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const monthStartLabel = (monthKey) => {
  if (!monthKey || monthKey === "all") return "-";
  const [year, month] = monthKey.split("-");
  if (!year || !month) return "-";
  return `01/${month}/${year}`;
};

let xlsxLoader = null;
let pdfToolsLoader = null;
const loadXlsx = async () => {
  if (!xlsxLoader) {
    xlsxLoader = import("https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs");
  }
  return xlsxLoader;
};

const loadPdfTools = async () => {
  if (!pdfToolsLoader) {
    pdfToolsLoader = Promise.all([
      import("https://esm.sh/jspdf@2.5.1"),
      import("https://esm.sh/jspdf-autotable@3.8.2"),
    ]);
  }
  return pdfToolsLoader;
};

const loadLogoDataUrl = async () => {
  const res = await fetch("/logo-italsem.png");
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

const reportStorageKey = (cardId) => `expense-reports-${cardId}`;



function App() {
  const [cards, setCards] = useState([]);
  const [newLast4, setNewLast4] = useState("");
  const [newHolder, setNewHolder] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [reportsByCard, setReportsByCard] = useState({});
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [importError, setImportError] = useState("");
  const [reportMonthInput, setReportMonthInput] = useState("");
  const [draftReport, setDraftReport] = useState(null);
  const [openingBalanceByMonth, setOpeningBalanceByMonth] = useState({});
  const fileInputRef = useRef(null);

  const loadCards = async () => {
    const res = await fetch("/api/cards");
    const data = await res.json();
    setCards(data);
  };

  useEffect(() => {
    loadCards();
  }, []);

  useEffect(() => {
    const loadReports = async () => {
      if (!selectedCard) return;

      let localReports = [];
      try {
        const raw = localStorage.getItem(reportStorageKey(selectedCard.id));
        localReports = raw ? JSON.parse(raw) : [];
      } catch {
        localReports = [];
      }

      setReportsByCard((prev) => ({ ...prev, [selectedCard.id]: localReports }));

      try {
        const res = await fetch(`/api/reports?cardId=${selectedCard.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const apiReports = data.reports || [];
        const finalReports = apiReports.length > 0 ? apiReports : localReports;
        localStorage.setItem(reportStorageKey(selectedCard.id), JSON.stringify(finalReports));
        setReportsByCard((prev) => ({ ...prev, [selectedCard.id]: finalReports }));
      } catch {
        // fallback locale già applicato
      }
    };

    loadReports();
  }, [selectedCard]);

  const persistReports = async (cardId, reports) => {
    localStorage.setItem(reportStorageKey(cardId), JSON.stringify(reports));
    try {
      await fetch("/api/reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, reports }),
      });
    } catch {
      // già salvato in locale
    }
  };

  const createCard = async () => {
    if (newLast4.length !== 4 || !newHolder.trim()) return;

    await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_last4: newLast4, holder_name: newHolder.trim() }),
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

    localStorage.removeItem(reportStorageKey(selectedCard.id));

    setSelectedCard(null);
    loadCards();
  };

  const parseWorkbook = async (file) => {
    const XLSX = await loadXlsx();
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

    return rows.map((entry, index) => {
      const date = parseDate(entry["Data operazione"]);
      const cardLabel = entry.Carta || "";
      const description = entry.Descrizione || "";
      const amount = parseAmount(entry["Importo in euro"]);

      return {
        id: `${Date.now()}-${index}`,
        date,
        cardLabel,
        movement: description,
        amount,
        category: "",
        detailDescription: "",
        attachment: null,
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
      const monthKey = reportMonthInput || monthKeyFromIsoDate(reportDate);
      const report = {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        monthKey,
        monthLabel: monthLabelFromKey(monthKey) || monthLabelFromIsoDate(reportDate),
        rows,
      };
      setDraftReport(report);
    } catch {
      setImportError(
        "Import non riuscito. Il file deve avere le colonne: Data operazione, Carta, Descrizione, Importo in euro.",
      );
    } finally {
      event.target.value = "";
    }
  };

  const saveDraftReport = () => {
    if (!selectedCard || !draftReport) return;
    setReportsByCard((prev) => {
      const current = prev[selectedCard.id] || [];
      const updated = [draftReport, ...current];
      persistReports(selectedCard.id, updated);
      return { ...prev, [selectedCard.id]: updated };
    });
    setSelectedMonth(draftReport.monthKey);
    setDraftReport(null);
  };

  const updateRow = (reportId, rowId, key, value) => {
    if (!selectedCard) return;

    setReportsByCard((prev) => {
      const updated = (prev[selectedCard.id] || []).map((report) =>
        report.id !== reportId
          ? report
          : {
              ...report,
              rows: report.rows.map((row) =>
                row.id === rowId ? { ...row, [key]: value } : row,
              ),
            },
      );
      persistReports(selectedCard.id, updated);
      return {
        ...prev,
        [selectedCard.id]: updated,
      };
    });
  };

  const monthlyHistory = useMemo(() => {
    if (!selectedCard) return [];
    const reports = reportsByCard[selectedCard.id] || [];

    return reports.reduce((acc, report) => {
      const total = report.rows.reduce((sum, row) => sum + row.amount, 0);
      const expenseOnly = report.rows
        .filter((row) => row.amount < 0)
        .reduce((sum, row) => sum + row.amount, 0);

      const existing = acc.find((item) => item.monthKey === report.monthKey);
      if (existing) {
        existing.reports += 1;
        existing.total += total;
        existing.expenses += expenseOnly;
      } else {
        acc.push({
          monthKey: report.monthKey,
          monthLabel: report.monthLabel,
          reports: 1,
          total,
          expenses: expenseOnly,
        });
      }
      return acc;
    }, []);
  }, [reportsByCard, selectedCard]);

  const visibleReports = useMemo(() => {
    if (!selectedCard) return [];
    const reports = reportsByCard[selectedCard.id] || [];
    if (selectedMonth === "all") return reports;
    return reports.filter((report) => report.monthKey === selectedMonth);
  }, [reportsByCard, selectedCard, selectedMonth]);

  const rowsForCurrentFilter = useMemo(
    () =>
      visibleReports.flatMap((report) =>
        report.rows.map((row) => ({ ...row, month: report.monthLabel, monthKey: report.monthKey })),
      ),
    [visibleReports],
  );

  const totalAll = rowsForCurrentFilter.reduce((sum, row) => sum + row.amount, 0);
  const totalExpenses = rowsForCurrentFilter
    .filter((row) => row.amount < 0)
    .reduce((sum, row) => sum + row.amount, 0);

  const openingBalance = parseAmount(openingBalanceByMonth[selectedMonth] || 0);
  const closingBalance = openingBalance + totalAll;

  const exportSummaryPdf = async () => {
    if (!selectedCard) return;
    const [{ jsPDF }, autoTableModule] = await loadPdfTools();
    const autoTable = autoTableModule.default;
    const logo = await loadLogoDataUrl();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    doc.setFillColor(255, 122, 26);
    doc.rect(0, 0, 842, 56, "F");
    doc.addImage(logo, "PNG", 24, 10, 140, 36);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text("NS-ITALSEM · Riepilogo Totale Nota Spese", 190, 34);
    doc.setTextColor(40, 40, 40);

    const subtitleLines = [
      `Carta: ****${selectedCard.card_last4} - ${selectedCard.holder_name}`,
      `Filtro mese: ${selectedMonth === "all" ? "tutti" : monthLabelFromKey(selectedMonth)}`,
      `Saldo iniziale: ${formatAmount(openingBalance)}`,
      `Totale movimenti: ${formatAmount(totalAll)}`,
      `Saldo finale: ${formatAmount(closingBalance)}`,
    ];

    doc.setFontSize(10);
    subtitleLines.forEach((line, index) => doc.text(line, 24, 78 + index * 14));

    const body = rowsForCurrentFilter.map((row) => [
        formatDate(row.date),
        row.month || "-",
        row.cardLabel || "-",
        row.movement || "-",
        row.category || "-",
        row.detailDescription || "-",
        formatAmount(row.amount),
        row.attachment?.name || "-",
      ]);

    autoTable(doc, {
      startY: 160,
      head: [["Data", "Mese", "Carta", "Movimento", "Categoria", "Descrizione", "Importo", "Allegato"]],
      body,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [255, 122, 26], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 58 },
        1: { cellWidth: 78 },
        2: { cellWidth: 64 },
        3: { cellWidth: 150 },
        4: { cellWidth: 92 },
        5: { cellWidth: 150 },
        6: { cellWidth: 70, halign: "right" },
        7: { cellWidth: 90 },
      },
      margin: { left: 24, right: 24 },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(8);
        doc.text(`Generato da NS-ITALSEM · ${new Date().toLocaleString("it-IT")}`, 24, pageHeight - 16);
        doc.setTextColor(40, 40, 40);
      },
    });

    doc.save(`riepilogo-${selectedCard.card_last4}.pdf`);
  };

  const exportExpensesPdf = async () => {
    if (!selectedCard) return;
    const [{ jsPDF }, autoTableModule] = await loadPdfTools();
    const autoTable = autoTableModule.default;
    const logo = await loadLogoDataUrl();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    doc.setFillColor(255, 122, 26);
    doc.rect(0, 0, 842, 56, "F");
    doc.addImage(logo, "PNG", 24, 10, 140, 36);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text("NS-ITALSEM · Export Sole Spese", 190, 34);
    doc.setTextColor(40, 40, 40);

    const expenseRows = rowsForCurrentFilter.filter((row) => row.amount < 0);
    const subtitleLines = [
      `Carta: ****${selectedCard.card_last4} - ${selectedCard.holder_name}`,
      `Filtro mese: ${selectedMonth === "all" ? "tutti" : monthLabelFromKey(selectedMonth)}`,
      `Totale sole spese: ${formatAmount(totalExpenses)}`,
    ];

    doc.setFontSize(10);
    subtitleLines.forEach((line, index) => doc.text(line, 24, 78 + index * 14));

    const body = expenseRows.map((row) => [
        formatDate(row.date),
        row.month || "-",
        row.category || "SENZA CATEGORIA",
        row.detailDescription || "-",
        formatAmount(row.amount),
      ]);

    autoTable(doc, {
      startY: 140,
      head: [["Data", "Mese", "Categoria", "Descrizione uscita", "Importo"]],
      body,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [255, 122, 26], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 100 },
        2: { cellWidth: 130 },
        3: { cellWidth: 430 },
        4: { cellWidth: 70, halign: "right" },
      },
      margin: { left: 24, right: 24 },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(8);
        doc.text(`Generato da NS-ITALSEM · ${new Date().toLocaleString("it-IT")}`, 24, pageHeight - 16);
        doc.setTextColor(40, 40, 40);
      },
    });

    doc.save(`sole-spese-${selectedCard.card_last4}.pdf`);
  };

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
            <button type="button" className="accent" onClick={() => fileInputRef.current?.click()}>
              Importa movimenti (.xlsx)
            </button>
            <label className="month-picker">
              Mese nota spese
              <input
                type="month"
                value={reportMonthInput}
                onChange={(e) => setReportMonthInput(e.target.value)}
              />
            </label>
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
              <span>Tutti i mesi</span>
            </button>
            {monthlyHistory.map((item) => (
              <button
                key={item.monthKey}
                type="button"
                className={selectedMonth === item.monthKey ? "month active" : "month"}
                onClick={() => setSelectedMonth(item.monthKey)}
              >
                <span>{item.monthLabel}</span>
                <small>
                  {item.reports} note · Tot {formatAmount(item.total)} · Spese {formatAmount(item.expenses)}
                </small>
              </button>
            ))}
          </aside>

          <section className="expense-content">
            <div className="totals-box">
              <label>
                Saldo al {monthStartLabel(selectedMonth)}
                <input
                  type="text"
                  value={openingBalanceByMonth[selectedMonth] || ""}
                  onChange={(e) =>
                    setOpeningBalanceByMonth((prev) => ({ ...prev, [selectedMonth]: e.target.value }))
                  }
                  placeholder="es. 1500,00"
                />
              </label>
              <div>
                <strong>Totale movimenti (incluse ricariche):</strong> {formatAmount(totalAll)}
              </div>
              <div>
                <strong>Totale sole spese:</strong> {formatAmount(totalExpenses)}
              </div>
              <div>
                <strong>Saldo finale:</strong> {formatAmount(closingBalance)}
              </div>
              <div className="export-actions">
                <button type="button" onClick={exportSummaryPdf}>
                  Export PDF riepilogo totale
                </button>
                <button type="button" onClick={exportExpensesPdf}>
                  Export PDF sole spese
                </button>
              </div>
            </div>

            {importError && <p className="error-box">{importError}</p>}

            {draftReport && (
              <div className="draft-box">
                <strong>Bozza pronta: {draftReport.monthLabel}</strong>
                <button type="button" className="accent" onClick={saveDraftReport}>
                  Salva nota spese
                </button>
              </div>
            )}

            {visibleReports.length === 0 ? (
              <p className="empty-state">
                Nessuna nota spese per questo filtro. Carica un file Excel con intestazioni:
                Data operazione, Carta, Descrizione, Importo in euro.
              </p>
            ) : (
              visibleReports.map((report) => (
                <div key={report.id} className="report-box">
                  <div className="report-head">
                    <strong>{report.monthLabel}</strong>
                    <span>Caricata il {formatDate(report.createdAt)}</span>
                  </div>

                  <div className="expense-table">
                    <div className="expense-row table-head">
                      <span>Data operazione</span>
                      <span>Carta</span>
                      <span>Descrizione banca</span>
                      <span>Importo in euro</span>
                      <span>Categoria</span>
                      <span>Descrizione uscita</span>
                      <span>Allegato</span>
                    </div>

                    {report.rows.map((row) => (
                      <div key={row.id} className="expense-row">
                        <span>{formatDate(row.date)}</span>
                        <span>{row.cardLabel || "-"}</span>
                        <span>{row.movement || "-"}</span>
                        <span>{formatAmount(row.amount)}</span>
                        <select
                          value={row.category}
                          onChange={(e) => updateRow(report.id, row.id, "category", e.target.value)}
                        >
                          <option value="">Seleziona categoria</option>
                          {EXPENSE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={row.detailDescription}
                          onChange={(e) =>
                            updateRow(report.id, row.id, "detailDescription", e.target.value)
                          }
                          placeholder="es. pranzo per 3 persone"
                        />
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) =>
                            updateRow(
                              report.id,
                              row.id,
                              "attachment",
                              e.target.files?.[0]
                                ? {
                                    name: e.target.files[0].name,
                                    type: e.target.files[0].type,
                                  }
                                : null,
                            )
                          }
                        />
                        {row.attachment?.name && <small>{row.attachment.name}</small>}
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

        <section className="grid four-per-row">
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
                  className={`status-dot ${card.status === "available" ? "available" : "assigned"}`}
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
