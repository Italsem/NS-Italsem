import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [cards, setCards] = useState([]);
  const [newLast4, setNewLast4] = useState("");
  const [newHolder, setNewHolder] = useState("");

  const loadCards = async () => {
    const res = await fetch("/api/cards");
    const data = await res.json();
    setCards(data);
  };

  useEffect(() => {
    loadCards();
  }, []);

  const createCard = async () => {
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

  return (
    <div className="container">
      <h1>Portale Note Spese Italsem</h1>

      <div className="new-card">
        <input
          placeholder="Ultime 4 cifre"
          value={newLast4}
          onChange={(e) => setNewLast4(e.target.value)}
        />
        <input
          placeholder="Utilizzatore o CASSAFORTE"
          value={newHolder}
          onChange={(e) => setNewHolder(e.target.value)}
        />
        <button onClick={createCard}>+ Nuova Carta</button>
      </div>

      <div className="grid">
        {cards.map((card) => (
          <div key={card.id} className="card-box">
            <img src="/card.png" className="card-img" />

            <div className="card-overlay">
              <div className="card-number">
                **** **** **** {card.card_last4}
              </div>

              <div className="card-holder">
                {card.holder_name}
              </div>

              <div
                className={
                  card.status === "available"
                    ? "status available"
                    : "status assigned"
                }
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
