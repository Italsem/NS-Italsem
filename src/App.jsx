import { useEffect, useMemo, useState } from "react";
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

function App() {
  const [cards, setCards] = useState([]);
  const [newLast4, setNewLast4] = useState("");
  const [newHolder, setNewHolder] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [expensesByCard, setExpensesByCard] = useState({});

  const loadCards = async () => {
    const res = await fetch("/api/cards");
    const data = await res.json();
    setCards(data);
  };

  useEffect(() => {
    loadCards();
  }, []);

  const createCard = async () => {
    if (!newLast4 || !newHolder) return;

    await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_last4: newLast4,
        holder_name: newHolder,
      }),
    });

    setNewLast4("");
    setNewHolder("");
    loadCards();
  };

  const parseStatement = (text) => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) return [];

    return lines.slice(1).map((line, index) => {
      const [date = "", movement = "", amount = ""] = line
        .split(/[;,]/)
        .map((field) => field.trim());

      return {
        id: `${Date.now()}-${index}`,
        date,
        movement,
        amount,
        note: movement,
        attachment: null,
      };
    });
  };

  const handleStatementImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCard) return;

    const content = await file.text();
    const rows = parseStatement(content);

    setExpensesByCard((prev) => ({
      ...prev,
      [selectedCard.id]: rows,
    }));

    event.target.value = "";
  };

  const updateRow = (cardId, rowId, key, value) => {
    setExpensesByCard((prev) => ({
      ...prev,
      [cardId]: (prev[cardId] || []).map((row) =>
        row.id === rowId ? { ...row, [key]: value } : row,
      ),
    }));
  };

  const selectedExpenses = useMemo(
    () => expensesByCard[selectedCard?.id] || [],
    [expensesByCard, selectedCard],
  );

  return (
    <div className="app-shell">
      <header className="top-header">
        <img src="/logo-italsem.png" alt="Logo Italsem" className="brand-logo" />
        <div className="title-group">
          <h1>Dashboard Note Spese</h1>
          <p>Gestione carte aziendali e movimenti in un unico spazio.</p>
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

        <section className="grid">
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
                  title={
                    card.status === "available" ? "Disponibile" : "Assegnata"
                  }
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

      {selectedCard && (
        <div className="mask" role="dialog" aria-modal="true">
          <div className="expense-modal">
            <div className="expense-header">
              <div>
                <h3>
                  Nota spese carta ****{selectedCard.card_last4}
                </h3>
                <p>{selectedCard.holder_name}</p>
              </div>
              <button onClick={() => setSelectedCard(null)} type="button">
                Chiudi
              </button>
            </div>

            <label className="import-box">
              Importa estratto conto (.csv o .txt: data;movimento;importo)
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleStatementImport}
              />
            </label>

            <div className="expense-table">
              <div className="expense-row table-head">
                <span>Data</span>
                <span>Movimento</span>
                <span>Importo</span>
                <span>Descrizione modificabile</span>
                <span>Allegato</span>
              </div>

              {selectedExpenses.length === 0 ? (
                <p className="empty-state">
                  Nessun movimento importato. Carica un estratto conto per generare
                  automaticamente le righe.
                </p>
              ) : (
                selectedExpenses.map((row) => (
                  <div key={row.id} className="expense-row">
                    <span>{formatDate(row.date)}</span>
                    <span>{row.movement || "-"}</span>
                    <span>{formatAmount(row.amount?.replace(",", "."))}</span>
                    <input
                      type="text"
                      value={row.note}
                      onChange={(e) =>
                        updateRow(selectedCard.id, row.id, "note", e.target.value)
                      }
                    />
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) =>
                        updateRow(
                          selectedCard.id,
                          row.id,
                          "attachment",
                          e.target.files?.[0]?.name || "",
                        )
                      }
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
