import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
import DieShape, { DIE_SHAPES } from "./DieShape";
import Shatter from "./Shatter";

type RollPhase =
  | "idle"
  | "rolling"
  | "faces"
  | "gathering"
  | "total"
  | "targeting"
  | "impact"
  | "leveling"
  | "reward"
  | "crediting"
  | "collected";

const number = (value: number) => value.toLocaleString("en-US");
function LevelText({ level, live = false }: { level: number; live?: boolean }) {
  return (
    <span className="level-copy">
      <span className="level-label">LEVEL</span>
      <span className="target-value">
        <span data-testid={live ? "target" : undefined}>{number(level)}</span>
      </span>
    </span>
  );
}
function ResultDie({
  die,
  total,
  size,
  live = false,
}: {
  die: (typeof DICE)[number];
  total: number;
  size?: number;
  live?: boolean;
}) {
  return (
    <div
      className={`result-die ${die.color} die-${die.id}`}
      style={
        {
          "--value-ratio": 0.42 / Math.max(1, number(total).length / 2),
          ...(size ? { "--die-size": `${size}px` } : {}),
        } as CSSProperties
      }
    >
      <DieShape id={die.id} />
      <strong
        className="die-value"
        data-testid={live ? "roll-total" : undefined}
      >
        {number(total)}
      </strong>
    </div>
  );
}
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
  const [phase, setPhase] = useState<RollPhase>("idle");
  const rolling = phase !== "idle";
  const [modal, setModal] = useState<
    "reset" | "test" | "recovery" | "shop" | "help" | null
  >(initial.status === "invalid" ? "recovery" : null);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const gameRef = useRef(game);
  gameRef.current = game;
  const diceField = useRef<HTMLElement>(null);
  const diceGrid = useRef<HTMLDivElement>(null);
  const sumAnchor = useRef<HTMLDivElement>(null);
  const totalFlight = useRef<HTMLDivElement>(null);
  const levelTarget = useRef<HTMLDivElement>(null);
  const [impactBox, setImpactBox] = useState<CSSProperties>({});
  const wallet = useRef<HTMLButtonElement>(null);
  const reward = useRef<HTMLSpanElement>(null);
  const coinFlight = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [poolSize, setPoolSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const stats = poolStats(game);

  useLayoutEffect(() => {
    if (!diceGrid.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setPoolSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    observer.observe(diceGrid.current);
    return () => observer.disconnect();
  }, []);

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
  useEffect(() => {
    const transitions: Partial<
      Record<RollPhase, { delay: number; next: RollPhase }>
    > = {
      rolling: { delay: 550, next: "faces" },
      faces: { delay: 280, next: "gathering" },
      total: { delay: 450, next: "targeting" },
      impact: {
        delay: 500,
        next: gameRef.current.lastRoll?.won ? "leveling" : "reward",
      },
      leveling: { delay: 300, next: "reward" },
      reward: { delay: 500, next: "crediting" },
      collected: { delay: 220, next: "idle" },
    };
    const transition = transitions[phase];
    if (!transition) return;
    const timer = setTimeout(() => {
      // Commit one complete result once; only its presentation waits for the flight.
      if (phase === "rolling") setGame(rollGame(gameRef.current));
      if (transition.next === "idle") busy.current = false;
      setPhase(transition.next);
    }, transition.delay);
    return () => clearTimeout(timer);
  }, [phase]);

  useLayoutEffect(() => {
    if (
      phase !== "targeting" ||
      !sumAnchor.current ||
      !levelTarget.current ||
      !totalFlight.current
    )
      return;
    const source = sumAnchor.current.querySelector(".result-die")!;
    const from = source.getBoundingClientRect();
    const to = levelTarget.current
      .querySelector(".level-copy")!
      .getBoundingClientRect();
    const flyer = totalFlight.current;
    Object.assign(flyer.style, {
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
    });
    const scale = Math.min(1, 60 / from.width);
    const x = to.left + to.width / 2 - from.left - from.width / 2;
    // The total's leading edge touches the level text on arrival.
    const y =
      to.bottom + (from.height * scale) / 2 - from.top - from.height / 2;
    const won = gameRef.current.lastRoll!.won;
    setImpactBox(
      won
        ? {
            left: to.left,
            top: to.top,
            width: to.width,
            height: to.height,
          }
        : {
            left: to.left + to.width / 2 - (from.width * scale) / 2,
            top: to.bottom,
            width: from.width * scale,
            height: from.height * scale,
          },
    );
    const animation = flyer.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        {
          transform: `translate(${x * 0.2}px, ${y * 0.25}px) scale(.85)`,
          opacity: 1,
          offset: 0.3,
        },
        { transform: `translate(${x}px, ${y}px) scale(${scale})`, opacity: 1 },
      ],
      {
        duration: 600,
        easing: "cubic-bezier(.5, 0, .8, .5)",
        fill: "forwards",
      },
    );
    let active = true;
    void animation.finished
      .then(() => {
        if (active) setPhase("impact");
      })
      .catch(() => {});
    return () => {
      active = false;
      animation.cancel();
    };
  }, [phase, poolSize]);

  useLayoutEffect(() => {
    if (phase !== "gathering" || !sumAnchor.current || !diceField.current)
      return;
    const target = sumAnchor.current.getBoundingClientRect();
    const dice = Array.from(
      diceField.current.querySelectorAll<HTMLElement>(".play-die"),
    );
    const animations = dice.map((die, index) => {
      const start = die.getBoundingClientRect();
      const x = target.left + target.width / 2 - start.left - start.width / 2;
      const y = target.top + target.height / 2 - start.top - start.height / 2;
      return die.animate(
        [
          { transform: getComputedStyle(die).transform, opacity: 1 },
          {
            transform: `translate(${x * 0.3}px, ${y * 0.3 - 65}px) rotate(${index % 2 ? 35 : -35}deg) scale(1.08)`,
            opacity: 1,
            offset: 0.38,
          },
          {
            transform: `translate(${x}px, ${y}px) rotate(${index % 2 ? 160 : -160}deg) scale(0.08)`,
            opacity: 0,
          },
        ],
        {
          duration: 520,
          delay: (index % 6) * 15,
          easing: "cubic-bezier(.45, 0, .8, .45)",
          fill: "forwards",
        },
      );
    });
    let active = true;
    void Promise.all(animations.map((animation) => animation.finished))
      .then(() => {
        if (active) setPhase("total");
      })
      .catch(() => {});
    return () => {
      active = false;
      animations.forEach((animation) => animation.cancel());
    };
  }, [phase]);

  useLayoutEffect(() => {
    if (
      phase !== "crediting" ||
      !reward.current ||
      !wallet.current ||
      !coinFlight.current
    )
      return;
    const from = reward.current.getBoundingClientRect();
    const to = wallet.current.getBoundingClientRect();
    const flyer = coinFlight.current;
    flyer.style.left = `${from.left}px`;
    flyer.style.top = `${from.top}px`;
    flyer.style.width = `${from.width}px`;
    flyer.style.height = `${from.height}px`;
    const x = to.left + to.width / 2 - from.left - from.width / 2;
    const y = to.top + to.height / 2 - from.top - from.height / 2;
    const animation = flyer.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        {
          transform: `translate(${x * 0.3}px, ${y * 0.4 - 32}px) scale(1.2)`,
          opacity: 1,
          offset: 0.4,
        },
        { transform: `translate(${x}px, ${y}px) scale(.55)`, opacity: 0.8 },
      ],
      {
        duration: 700,
        easing: "cubic-bezier(.4, 0, .35, 1)",
        fill: "forwards",
      },
    );
    let active = true;
    void animation.finished
      .then(() => {
        if (active) setPhase("collected");
      })
      .catch(() => {});
    return () => {
      active = false;
      animation.cancel();
    };
  }, [phase]);
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setGame(rollGame(game));
      busy.current = false;
      return;
    }
    setPhase("rolling");
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
    setMessage("");
  }
  const last = game.lastRoll;
  const awaitingCredit =
    phase !== "idle" && phase !== "rolling" && phase !== "collected";
  const displayedBalance =
    game.balance - (awaitingCredit ? (last?.reward ?? 0) : 0);
  const displayedLevel =
    last &&
    ["faces", "gathering", "total", "targeting", "impact"].includes(phase)
      ? last.level
      : game.level;
  const showSum =
    Boolean(last) && ["total", "targeting", "impact"].includes(phase);

  const visibleDice = DICE.flatMap((die) => {
    const values =
      last?.dice.find((group) => group.id === die.id)?.values ?? [];
    return Array.from(
      { length: Math.min(game.inventory[die.id], 6) },
      (_, index) => ({
        die,
        index,
        value: values[index],
      }),
    );
  });
  const resultDie = visibleDice.at(-1)!.die;
  // Use the grid's content box so dice stay clear of the overlaid controls.
  let columns = 1;
  let availableSize = 0;
  for (let count = 1; count <= visibleDice.length; count++) {
    const rowCount = Math.ceil(visibleDice.length / count);
    const size = Math.min(
      (poolSize.width - (count - 1) * 12) / count,
      (poolSize.height - (rowCount - 1) * 12) / rowCount / 1.1,
    );
    if (size > availableSize) {
      columns = count;
      availableSize = size;
    }
  }
  const rows = Math.ceil(visibleDice.length / columns);
  const dieSize = Math.max(
    1,
    Math.min(visibleDice.length === 1 ? 126 : 82, availableSize * 0.85),
  );

  return (
    <div className="game-shell">
      <header className="hud">
        <h1 className="brand">
          master<span>roller</span>
        </h1>
        <button
          ref={wallet}
          className={`wallet ${phase === "collected" ? "wallet-collected" : ""}`}
          aria-label={`${displayedBalance} Dicecoin`}
          aria-description="Open dice shop"
          aria-haspopup="dialog"
          disabled={rolling || modal === "recovery"}
          onClick={() => setModal("shop")}
        >
          <Coin amount={displayedBalance} />
        </button>
        <button
          className="icon-button"
          aria-label="How to play"
          disabled={rolling}
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
          className={`arena phase-${phase} ${last?.won ? "roll-win" : "roll-loss"} ${phase === "rolling" ? "is-rolling" : ""}`}
          aria-label="Roll arena"
          data-phase={phase}
        >
          <div ref={levelTarget} className="level-target">
            <LevelText level={displayedLevel} live />
          </div>
          <section
            ref={diceField}
            className="dice-field"
            aria-label="Your collection"
            aria-description={`${stats.count} ${stats.count === 1 ? "die" : "dice"}`}
          >
            <div
              ref={diceGrid}
              className={`dice-grid ${visibleDice.length === 1 ? "single-die" : ""}`}
              style={
                {
                  "--dice-columns": columns,
                  "--dice-rows": rows,
                  "--die-size": `${dieSize}px`,
                } as CSSProperties
              }
            >
              {visibleDice.map(({ die, index, value }) => (
                <div
                  className={`play-die ${die.color} die-${die.id} ${value === undefined ? "unrolled" : ""}`}
                  key={`${die.id}-${index}`}
                  aria-label={`${die.id} ${value === undefined ? "not rolled yet" : `rolled ${value}`}`}
                >
                  <DieShape id={die.id} />
                  <strong className="die-value">
                    {phase === "rolling"
                      ? "·"
                      : value === undefined
                        ? "?"
                        : value}
                  </strong>
                </div>
              ))}
            </div>
            <div
              ref={sumAnchor}
              className={`sum-burst ${phase === "total" ? "sum-visible" : ""}`}
              aria-hidden="true"
            >
              {last && showSum ? (
                <ResultDie die={resultDie} total={last.total} live />
              ) : (
                <strong data-testid="roll-total" />
              )}
            </div>
            {last && (
              <span
                ref={reward}
                className={`earned-reward ${phase !== "reward" ? "reward-departed" : ""}`}
              >
                +{last.reward} <Coin />
              </span>
            )}
          </section>
          {phase === "targeting" && last && (
            <div ref={totalFlight} className="total-flight" aria-hidden="true">
              <ResultDie die={resultDie} total={last.total} />
            </div>
          )}
          {phase === "impact" && last && (
            <Shatter
              className={last.won ? "level-shatter" : "total-shatter"}
              style={impactBox}
            >
              {last.won ? (
                <LevelText level={last.level} />
              ) : (
                <ResultDie die={resultDie} total={last.total} size={60} />
              )}
            </Shatter>
          )}
          <span className="sr-only" role="status" aria-live="polite">
            {last
              ? `Total ${last.total}. ${last.won ? "Level cleared." : "Try again."} Earned ${last.reward} Dicecoin.`
              : ""}
          </span>
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
      {phase === "crediting" && last && (
        <div
          ref={coinFlight}
          className="reward-flight"
          data-testid="reward-flight"
          aria-hidden="true"
        >
          +{last.reward} <Coin />
          <span className="coin-trail" />
        </div>
      )}
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
                  <div
                    className={`shop-die-type die-${die.id}`}
                    aria-description={DIE_SHAPES[die.id]}
                  >
                    <DieShape id={die.id} />
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
