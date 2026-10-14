import { useEffect, useRef, useState } from "react";
import {
  buyDie,
  DICE,
  ECONOMY,
  newGame,
  poolStats,
  rollGame,
  simulatePurchase,
  type DieId,
  type GameState,
  type TestOffer,
} from "./game";
import { loadGame, saveGame, type SaveStatus } from "./storage";

const number = (value: number) => value.toLocaleString("en-US");
function Coin({ amount }: { amount?: number }) {
  return (
    <span className="coin-label">
      <span className="coin" aria-hidden="true">
        D
      </span>
      {amount !== undefined && number(amount)}
    </span>
  );
}
function initialSave() {
  try {
    return loadGame(window.localStorage);
  } catch {
    return { state: newGame(), status: "unavailable" as const };
  }
}

export default function App() {
  const [initial] = useState(initialSave);
  const [game, setGame] = useState(initial.state);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initial.status);
  const [rolling, setRolling] = useState(false);
  const [tab, setTab] = useState<"play" | "shop">("play");
  const [modal, setModal] = useState<"reset" | "test" | "recovery" | null>(
    initial.status === "invalid" ? "recovery" : null,
  );
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const stats = poolStats(game);

  useEffect(() => {
    if (saveStatus === "invalid") return;
    try {
      setSaveStatus(
        saveGame(window.localStorage, game) ? "saved" : "unavailable",
      );
    } catch {
      setSaveStatus("unavailable");
    }
  }, [game, saveStatus]);
  useEffect(
    () => () => {
      if (rollTimer.current) clearTimeout(rollTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (modal) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else if (dialog.current?.open) {
      dialog.current.close();
      previousFocus.current?.focus();
    }
  }, [modal]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  function roll() {
    if (busy.current || modal) return;
    busy.current = true;
    setRolling(true);
    rollTimer.current = setTimeout(
      () => {
        setGame((current) => rollGame(current));
        setRolling(false);
        busy.current = false;
      },
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 550,
    );
  }
  function buy(id: DieId) {
    if (busy.current) return;
    setGame((current) => buyDie(current, id));
    setMessage(`${id} added to your collection.`);
  }
  function testBuy(offer: TestOffer) {
    if (busy.current) return;
    setGame((current) => simulatePurchase(current, offer));
    setMessage(
      offer === "coins"
        ? "Test purchase: 10,000 Dicecoin added. No charge."
        : `Test purchase: ${offer} added. No charge.`,
    );
  }
  function recover() {
    setGame(newGame());
    setSaveStatus("saved");
    setModal(null);
    setMessage("A fresh start. Let’s roll!");
  }
  const last = game.lastRoll;

  return (
    <>
      <header className="header">
        <a
          className="brand"
          href="#"
          aria-label="Master Roller home"
          onClick={(e) => {
            e.preventDefault();
            setTab("play");
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            ✣
          </span>
          <span>
            master<span className="brand-light">roller</span>
            <span className="beta">BETA</span>
          </span>
        </a>
        <div className="header-actions">
          <span className="wallet" aria-label={`${game.balance} Dicecoin`}>
            <Coin amount={game.balance} />
            <span className="wallet-name">Dicecoin</span>
          </span>
          <button
            className="icon-button"
            aria-label="Reset progress"
            disabled={rolling}
            onClick={() => setModal("reset")}
          >
            ↺
          </button>
        </div>
      </header>

      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">SMALL DICE. BIG POSSIBILITIES.</p>
            <h1>
              Roll your way up<span>.</span>
            </h1>
            <p className="intro-copy">
              Build your collection. Beat the number. Keep climbing.
            </p>
          </div>
          <span className="release-tag">
            <span /> MOBILE WEB TEST
          </span>
        </div>
        <nav className="mobile-tabs" aria-label="Game sections">
          <button aria-pressed={tab === "play"} onClick={() => setTab("play")}>
            Play
          </button>
          <button aria-pressed={tab === "shop"} onClick={() => setTab("shop")}>
            Dice shop
          </button>
        </nav>
        {saveStatus === "unavailable" && (
          <p className="warning" role="status">
            Saving is unavailable. You can play, but progress may be lost when
            you leave.
          </p>
        )}

        <div className={`play-layout ${tab === "shop" ? "mobile-hidden" : ""}`}>
          <section className="arena panel" aria-label="Roll arena">
            <div className="panel-top">
              <span className="eyebrow">THE NEXT CHALLENGE</span>
              <span className="stage-pill">LEVEL {number(game.level)}</span>
            </div>
            <div className="target">
              <span className="target-label">ROLL AT LEAST</span>
              <div className="target-number" data-testid="target">
                {number(game.level)}
              </div>
              <p>
                Your dice total needs to reach{" "}
                <strong>{number(game.level)}</strong> or more.
              </p>
            </div>
            <div
              className={`result ${last ? (last.won ? "result-win" : "result-loss") : ""}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {rolling ? (
                <>
                  <span className="result-symbol spinning">↻</span>
                  <div>
                    <strong>Let them roll…</strong>
                    <span>Every die gets a chance.</span>
                  </div>
                </>
              ) : last ? (
                <>
                  <span className="result-symbol">{last.won ? "↗" : "↻"}</span>
                  <div>
                    <strong>
                      {last.won
                        ? `Level ${number(last.level)} cleared!`
                        : "So close. Roll again."}
                    </strong>
                    <span>
                      You rolled {number(last.total)} · Target{" "}
                      {number(last.level)}
                    </span>
                  </div>
                  <span className="reward">
                    +{last.reward} <span className="reward-unit">DC</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="result-symbol">↗</span>
                  <div>
                    <strong>One die is all it takes to start.</strong>
                    <span>Your first level is waiting.</span>
                  </div>
                </>
              )}
            </div>
            <button
              className="roll-button"
              disabled={rolling || modal === "recovery"}
              onClick={roll}
            >
              <span aria-hidden="true">✣</span>
              {rolling
                ? "Rolling…"
                : `Roll ${stats.count === 1 ? "your die" : "your dice"}`}
              <span aria-hidden="true">↗</span>
            </button>
            <p className="roll-note">
              Every roll earns Dicecoin. <strong>Win +20</strong>
              <span> / </span>
              <strong>Lose +10</strong>
            </p>
          </section>

          <section
            className="collection panel"
            aria-labelledby="collection-title"
          >
            <div className="panel-top">
              <h2 id="collection-title">Your collection</h2>
              <span className="count-pill">
                {number(stats.count)} {stats.count === 1 ? "die" : "dice"}
              </span>
            </div>
            <p className="section-copy">
              Every die rolls with you. More dice, more possibility.
            </p>
            <div className="collection-list">
              {DICE.filter((d) => game.inventory[d.id] > 0).map((d) => (
                <div className="collection-row" key={d.id}>
                  <span className={`die-badge ${d.color}`}>{d.id}</span>
                  <div className="collection-info">
                    <strong>{d.name}</strong>
                    <span>
                      {d.min}–{d.max} per die
                    </span>
                  </div>
                  <span className="quantity">
                    ×{number(game.inventory[d.id])}
                  </span>
                </div>
              ))}
            </div>
            <div className="pool-range">
              <span>Possible total</span>
              <strong>
                {number(stats.min)} <span>—</span> {number(stats.max)}
              </strong>
            </div>
            {last && (
              <details className="breakdown">
                <summary>
                  Last roll breakdown <span>{number(last.total)} total</span>
                </summary>
                <p>
                  Level {last.level} · {last.won ? "Cleared" : "Try again"}
                </p>
                {last.dice.map((group) => (
                  <div key={group.id}>
                    <strong>
                      {group.id} ×{group.values.length}
                    </strong>
                    <span>
                      {group.values.length > 100
                        ? `${group.values.slice(0, 100).join(" + ")} + … (${group.values.length} dice)`
                        : group.values.join(" + ")}
                    </span>
                  </div>
                ))}
              </details>
            )}
            <button
              className="collection-shop-link"
              onClick={() => {
                setTab("shop");
                document
                  .getElementById("shop")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Grow your collection <span>↗</span>
            </button>
          </section>
        </div>

        <section
          id="shop"
          className={`shop ${tab === "play" ? "mobile-hidden" : ""}`}
          aria-labelledby="shop-title"
        >
          <div className="shop-heading">
            <div>
              <p className="eyebrow">INVEST IN YOUR NEXT ROLL</p>
              <h2 id="shop-title">A little more luck.</h2>
              <p>Pick up a new die. They all add up.</p>
            </div>
            <span className="shop-hint">
              Buy as many as you like <span>↙</span>
            </span>
          </div>
          <div className="shop-grid">
            {DICE.map((d) => (
              <article
                className="die-card"
                key={d.id}
                aria-label={`${d.id} shop item`}
              >
                <div className="die-card-top">
                  <span className={`die-badge large ${d.color}`}>{d.id}</span>
                  <span className="owned">
                    {number(game.inventory[d.id])} owned
                  </span>
                </div>
                <h3>{d.name}</h3>
                <p>
                  Rolls {d.min}–{d.max}
                </p>
                <button
                  className="buy-button"
                  aria-label={`Buy ${d.id} for ${d.price} Dicecoin`}
                  disabled={
                    rolling || game.balance < d.price || modal === "recovery"
                  }
                  onClick={() => buy(d.id)}
                >
                  <Coin amount={d.price} />
                  <span>
                    {game.balance >= d.price ? "+ Add die" : "Save up"}
                  </span>
                </button>
              </article>
            ))}
          </div>
          <aside className="test-banner">
            <span className="test-icon" aria-hidden="true">
              ✧
            </span>
            <div>
              <strong>Want to try a bigger collection?</strong>
              <p>Explore test purchases. No real money, just possibilities.</p>
            </div>
            <button
              className="secondary-button"
              disabled={rolling}
              onClick={() => setModal("test")}
            >
              Test purchases <span aria-hidden="true">↗</span>
            </button>
          </aside>
        </section>
        <footer>
          <span>Made for one more roll.</span>
          <span className="save-indicator">
            <span
              className={saveStatus === "saved" ? "saved-dot" : "unsaved-dot"}
            />
            {saveStatus === "saved"
              ? "Progress saved on this device"
              : saveStatus === "invalid"
                ? "Save needs recovery"
                : "Progress is not saved"}
          </span>
          <a
            href="https://github.com/tharak/master-roller/issues"
            target="_blank"
            rel="noreferrer"
          >
            Feedback ↗
          </a>
        </footer>
      </main>
      <div
        className={`toast ${message ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
      <dialog
        ref={dialog}
        className="modal"
        aria-labelledby="modal-title"
        onCancel={(e) => {
          if (modal === "recovery") e.preventDefault();
          else setModal(null);
        }}
      >
        {modal === "test" ? (
          <>
            <div className="modal-heading">
              <p className="eyebrow">THE TEST LAB</p>
              <button
                className="icon-button"
                aria-label="Close test purchases"
                onClick={() => setModal(null)}
              >
                ×
              </button>
            </div>
            <h2 id="modal-title">Try your luck. On us.</h2>
            <p className="modal-copy">
              Simulated purchases only. No charge, no payment details. Grants
              are saved to this browser.
            </p>
            <button className="pack-button" onClick={() => testBuy("coins")}>
              <div>
                <span className="eyebrow">THE BIG COIN PACK</span>
                <strong>
                  <Coin amount={ECONOMY.coinPack} /> Dicecoin
                </strong>
                <small>Simulated purchase — no charge</small>
              </div>
              <span>+ Add</span>
            </button>
            <div className="test-dice-grid">
              {DICE.map((d) => (
                <button
                  key={d.id}
                  aria-label={`Simulate purchase of ${d.id}`}
                  onClick={() => testBuy(d.id)}
                >
                  <span className={`die-badge ${d.color}`}>{d.id}</span>
                  <span>
                    Add one {d.id}
                    <small>Simulated · no charge</small>
                  </span>
                  <span>+</span>
                </button>
              ))}
            </div>
            <p className="modal-note" role="status">
              {message || "Test purchases can be repeated."}
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">
              {modal === "recovery" ? "SAVE RECOVERY" : "A FRESH START"}
            </p>
            <h2 id="modal-title">
              {modal === "recovery"
                ? "This save needs a fresh start."
                : "Start from one die again?"}
            </h2>
            <p className="modal-copy">
              {modal === "recovery"
                ? "The saved progress could not be read. Start a new game to replace it with level 1, one d2, and zero Dicecoin."
                : "This clears your levels, Dicecoin, and collection on this browser. You’ll start at level 1 with one d2."}
            </p>
            <div className="modal-buttons">
              {modal !== "recovery" && (
                <button
                  className="secondary-button"
                  onClick={() => setModal(null)}
                >
                  Keep playing
                </button>
              )}
              <button className="primary-button" onClick={recover}>
                {modal === "recovery" ? "Start new game" : "Reset progress"}
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
