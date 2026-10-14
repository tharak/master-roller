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
  const [modal, setModal] = useState<
    "reset" | "test" | "recovery" | "shop" | "help" | null
  >(initial.status === "invalid" ? "recovery" : null);
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
      if (!dialog.current?.open) {
        previousFocus.current = document.activeElement as HTMLElement;
        dialog.current?.showModal();
      }
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
    setMessage(`+1 ${id}`);
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
    setMessage("Reset");
  }
  const last = game.lastRoll;

  const visibleDice = DICE.flatMap((die) => {
    const values =
      last?.dice.find((group) => group.id === die.id)?.values ?? [];
    return Array.from(
      { length: Math.min(game.inventory[die.id], 6) },
      (_, index) => ({
        die,
        index,
        value: values[index],
        remaining: index === 5 ? game.inventory[die.id] - 6 : 0,
      }),
    );
  });

  return (
    <div className="game-shell">
      <header className="hud">
        <h1 className="brand">
          master<span>roller</span>
        </h1>
        <span className="wallet" aria-label={`${game.balance} Dicecoin`}>
          <Coin amount={game.balance} />
        </span>
        <button
          className="icon-button"
          aria-label="How to play"
          onClick={() => setModal("help")}
        >
          ?
        </button>
        <button
          className="icon-button"
          aria-label="Reset progress"
          disabled={rolling}
          onClick={() => setModal("reset")}
        >
          ↺
        </button>
      </header>
      <main className="game-main">
        {saveStatus === "unavailable" && (
          <p className="warning" role="status">
            Saving is unavailable. Progress won’t be kept.
          </p>
        )}
        <section
          className={`arena ${rolling ? "is-rolling" : ""} ${last?.won && !rolling ? "is-win" : ""}`}
          aria-label="Roll arena"
        >
          <div className="level-target">
            <span className="level-label">LEVEL</span>
            <div className="target-value">
              <span className="target-sign" aria-hidden="true">
                ≥
              </span>
              <span data-testid="target">{number(game.level)}</span>
            </div>
          </div>
          <section className="dice-field" aria-label="Your collection">
            <div
              className="dice-count"
              aria-label={`${stats.count} ${stats.count === 1 ? "die" : "dice"}`}
            >
              {number(stats.count)} {stats.count === 1 ? "die" : "dice"}
            </div>
            <div
              className={`dice-grid ${visibleDice.length === 1 ? "single-die" : ""}`}
            >
              {visibleDice.map(({ die, index, value, remaining }) => (
                <div
                  className={`play-die ${die.color} ${value === undefined ? "unrolled" : ""}`}
                  key={`${die.id}-${index}`}
                  aria-label={`${die.id} ${value === undefined ? "not rolled yet" : `rolled ${value}`}`}
                >
                  <span className="die-type">{die.id}</span>
                  <strong className="die-value">
                    {rolling ? "·" : value === undefined ? "?" : value}
                  </strong>
                  {index === 0 && game.inventory[die.id] > 1 && (
                    <span className="die-quantity">
                      ×{number(game.inventory[die.id])}
                    </span>
                  )}
                  {remaining > 0 && (
                    <span
                      className="extra-dice"
                      title="Additional dice also roll"
                    >
                      +{number(remaining)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
          <div
            className="result-area"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {last && !rolling ? (
              <>
                <div className="roll-total">
                  <span>TOTAL</span>
                  <strong data-testid="roll-total">{number(last.total)}</strong>
                </div>
                <div className={`outcome ${last.won ? "won" : "lost"}`}>
                  <strong>{last.won ? "CLEARED!" : "TRY AGAIN"}</strong>
                  <span>
                    +{last.reward} <Coin />
                  </span>
                  <span className="sr-only">
                    Level {last.level}. Rolled {last.total}, target {last.level}
                    .
                  </span>
                </div>
              </>
            ) : (
              <div className="ready-label">
                {rolling ? "ROLLING…" : "TAP TO ROLL"}
              </div>
            )}
          </div>
        </section>
        <div className="controls">
          <button
            className="roll-button"
            aria-label={
              rolling
                ? "Rolling…"
                : `Roll your ${stats.count === 1 ? "die" : "dice"}`
            }
            disabled={rolling || modal === "recovery"}
            onClick={roll}
          >
            <span aria-hidden="true">↻</span>
            {rolling ? "ROLLING…" : "ROLL"}
          </button>
          <button
            className="shop-button"
            aria-label="Dice shop"
            disabled={rolling}
            onClick={() => setModal("shop")}
          >
            <span aria-hidden="true">+</span>DICE
          </button>
        </div>
        <div className="save-status">
          <span
            className={saveStatus === "saved" ? "saved-dot" : "unsaved-dot"}
            title={
              saveStatus === "saved" ? "Progress saved" : "Progress not saved"
            }
            aria-label={
              saveStatus === "saved" ? "Progress saved" : "Progress not saved"
            }
          />
        </div>
      </main>
      <div
        className={`toast ${message && !modal ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {!modal ? message : ""}
      </div>
      <dialog
        ref={dialog}
        className={`modal ${modal === "shop" ? "shop-modal" : ""}`}
        aria-labelledby="modal-title"
        onCancel={(e) => {
          if (modal === "recovery") e.preventDefault();
          else setModal(null);
        }}
      >
        {modal !== "recovery" && (
          <button
            className="icon-button modal-close"
            aria-label={
              modal === "test"
                ? "Close test purchases"
                : modal === "shop"
                  ? "Close dice shop"
                  : "Close"
            }
            onClick={() => setModal(null)}
          >
            ×
          </button>
        )}
        {modal === "shop" ? (
          <>
            <h2 id="modal-title">Dice shop</h2>
            <div
              className="shop-wallet"
              aria-label={`${game.balance} Dicecoin available`}
            >
              <Coin amount={game.balance} />
            </div>
            <div className="shop-grid">
              {DICE.map((die) => (
                <article
                  className={`die-card ${die.color}`}
                  key={die.id}
                  aria-label={`${die.id} shop item`}
                >
                  <div className="shop-die-type">
                    {die.id}
                    <span className="owned">
                      ×{number(game.inventory[die.id])}
                    </span>
                  </div>
                  <span className="die-range">
                    {die.min}–{die.max}
                  </span>
                  <button
                    className="buy-button"
                    aria-label={`Buy ${die.id} for ${die.price} Dicecoin`}
                    disabled={rolling || game.balance < die.price}
                    onClick={() => buy(die.id)}
                  >
                    <Coin amount={die.price} />
                    <span aria-hidden="true">+</span>
                  </button>
                </article>
              ))}
            </div>
            <div className="shop-bottom">
              <p className="purchase-feedback" role="status">
                {message}
              </p>
              <button className="text-button" onClick={() => setModal("test")}>
                Test purchases
              </button>
            </div>
          </>
        ) : modal === "test" ? (
          <>
            <h2 id="modal-title">Test purchases</h2>
            <p className="modal-copy">No charge, no payment details.</p>
            <button
              className="pack-button"
              aria-label="THE BIG COIN PACK: simulate 10,000 Dicecoin"
              onClick={() => testBuy("coins")}
            >
              <strong>
                <Coin amount={ECONOMY.coinPack} />
              </strong>
              <span>
                +<small>Simulated purchase — no charge</small>
              </span>
            </button>
            <div className="test-dice-grid">
              {DICE.map((die) => (
                <button
                  className={die.color}
                  key={die.id}
                  aria-label={`Simulate purchase of ${die.id}`}
                  onClick={() => testBuy(die.id)}
                >
                  <strong>{die.id}</strong>
                  <span>
                    +<small>Simulated · no charge</small>
                  </span>
                </button>
              ))}
            </div>
            <p className="modal-note" role="status">
              {message}
            </p>
          </>
        ) : modal === "help" ? (
          <>
            <h2 id="modal-title">How to play</h2>
            <p className="modal-copy">
              Roll all your dice. Reach the level number to advance.
            </p>
            <p className="help-rewards">
              Win <strong>+20</strong>
              <Coin /> · Lose <strong>+10</strong>
              <Coin />
            </p>
            <p className="modal-copy">
              Buy more dice with Dicecoin. Every die joins every roll.
            </p>
            <p className="modal-copy">
              d2: 0–1. Other dice: 1–their face count.
            </p>
            {last && (
              <details className="breakdown">
                <summary>Last roll · {number(last.total)}</summary>
                {last.dice.map((group) => (
                  <p key={group.id}>
                    <strong>
                      {group.id} ×{group.values.length}
                    </strong>{" "}
                    {group.values.join(" + ")}
                  </p>
                ))}
              </details>
            )}
            <a
              className="text-button feedback-link"
              href="https://github.com/tharak/master-roller/issues"
              target="_blank"
              rel="noreferrer"
            >
              Feedback ↗
            </a>
          </>
        ) : (
          <>
            <h2 id="modal-title">
              {modal === "recovery" ? "Recover save" : "Reset progress?"}
            </h2>
            <p className="modal-copy">
              {modal === "recovery"
                ? "This save could not be read. Replace it with a fresh game?"
                : "Start over at level 1 with one d2 and zero Dicecoin?"}
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
    </div>
  );
}
