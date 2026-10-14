import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  buyDie,
  buySlot,
  dieCost,
  mergeDice,
  DICE,
  ECONOMY,
  newGame,
  poolStats,
  rollGame,
  simulatePurchase,
  slotCost,
  type DieId,
  type MergeRecipe,
  type TestOffer,
} from "./game";
import { loadGame, saveGame, type SaveStatus } from "./storage";
import DieShape, { DIE_SHAPES } from "./DieShape";
import Shatter from "./Shatter";
import EconomyView from "./EconomyView";
import MergeShop from "./MergeShop";
import { ROLL_TIMING, type RollPhase } from "./rollAnimation";

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
function initialSave(): ReturnType<typeof loadGame> {
  try {
    return loadGame(window.localStorage);
  } catch {
    return { state: newGame(), status: "unavailable" as const };
  }
}

export default function App() {
  const [initial] = useState(initialSave);
  const legacyBackup = useRef(initial.legacyBackup);
  const [migrationNotice, setMigrationNotice] = useState(
    Boolean(initial.legacyBackup),
  );
  const [economyView, setEconomyView] = useState(
    window.location.hash === "#economy",
  );
  const [game, setGame] = useState(initial.state);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initial.status);
  const [phase, setPhase] = useState<RollPhase>("idle");
  const rolling = phase !== "idle";
  const [modal, setModal] = useState<
    "reset" | "test" | "recovery" | "shop" | "help" | null
  >(initial.status === "invalid" ? "recovery" : null);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const pendingRoll = useRef<ReturnType<typeof rollGame> | null>(null);
  const playback = useRef({ at: 0, elapsed: 0, rate: 1 });
  const [fastForwarding, setFastForwarding] = useState(false);
  const skipRequested = useRef(false);
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
  const hasRoom = stats.count < game.slots;

  useEffect(() => {
    const changeView = () =>
      setEconomyView(window.location.hash === "#economy");
    window.addEventListener("hashchange", changeView);
    return () => window.removeEventListener("hashchange", changeView);
  }, []);

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
  }, [economyView]);

  useEffect(() => {
    if (saveStatus === "invalid") return;
    try {
      const saved = saveGame(
        window.localStorage,
        game,
        legacyBackup.current,
        initial.backupKey,
      );
      if (saved) legacyBackup.current = undefined;
      setSaveStatus(saved ? "saved" : "unavailable");
    } catch {
      setSaveStatus("unavailable");
    }
  }, [game, saveStatus]);
  useLayoutEffect(() => {
    if (!rolling) return;
    const currentOffset = phase === "rolling" ? 0 : ROLL_TIMING[phase];
    const timers = Object.entries(ROLL_TIMING)
      .filter(([, at]) => at > currentOffset)
      .map(([next, at]) =>
        setTimeout(
          () => {
            if (!busy.current) return;
            if (next === "faces") commitRoll();
            if (next === "leveling" && !gameRef.current.lastRoll?.won) return;
            if (next === "idle") busy.current = false;
            setPhase(next as RollPhase);
          },
          remaining(at) / playback.current.rate,
        ),
      );
    return () => timers.forEach(clearTimeout);
  }, [rolling, fastForwarding]);

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
        duration: remaining(ROLL_TIMING.impact),
        easing: "cubic-bezier(.5, 0, .8, .5)",
        fill: "forwards",
      },
    );
    return () => animation.cancel();
  }, [phase, poolSize]);

  useLayoutEffect(() => {
    if (phase !== "impact" || !levelTarget.current) return;
    // Measure again at collision; a viewport resize may precede ResizeObserver.
    const to = levelTarget.current
      .querySelector(".level-copy")!
      .getBoundingClientRect();
    setImpactBox((current) =>
      gameRef.current.lastRoll!.won
        ? { left: to.left, top: to.top, width: to.width, height: to.height }
        : {
            ...current,
            left: to.left + to.width / 2 - Number(current.width) / 2,
            top: to.bottom,
          },
    );
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
          duration: Math.max(
            0,
            remaining(ROLL_TIMING.total) - (index % 6) * 15,
          ),
          delay: (index % 6) * 15,
          easing: "cubic-bezier(.45, 0, .8, .45)",
          fill: "forwards",
        },
      );
    });
    return () => animations.forEach((animation) => animation.cancel());
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
        duration: remaining(ROLL_TIMING.collected),
        easing: "cubic-bezier(.4, 0, .35, 1)",
        fill: "forwards",
      },
    );
    return () => animation.cancel();
  }, [phase, poolSize]);
  useLayoutEffect(() => {
    // Retiming existing animations preserves their current frame on Skip.
    const shell = diceField.current?.closest(".game-shell");
    shell
      ?.getAnimations({ subtree: true })
      .forEach((animation) =>
        animation.updatePlaybackRate(playback.current.rate),
      );
  }, [phase, poolSize, fastForwarding]);
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
  }, [modal, economyView]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  function remaining(at: number) {
    const clock = playback.current;
    const elapsed = clock.elapsed + (performance.now() - clock.at) * clock.rate;
    return Math.max(0, at - elapsed);
  }
  function commitRoll() {
    if (!pendingRoll.current) return;
    gameRef.current = pendingRoll.current;
    setGame(pendingRoll.current);
    pendingRoll.current = null;
  }
  function skip() {
    if (!busy.current || skipRequested.current) return;
    skipRequested.current = true;
    const left = remaining(ROLL_TIMING.idle);
    playback.current = {
      at: performance.now(),
      elapsed: ROLL_TIMING.idle - left,
      rate: Math.max(1, left / 1000),
    };
    setFastForwarding(true);
  }
  function roll() {
    if (busy.current || modal) return;
    busy.current = true;
    pendingRoll.current = rollGame(gameRef.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      commitRoll();
      busy.current = false;
      return;
    }
    playback.current = { at: performance.now(), elapsed: 0, rate: 1 };
    skipRequested.current = false;
    setFastForwarding(false);
    setPhase("rolling");
  }
  function buy(id: DieId) {
    if (busy.current) return;
    setGame((current) => buyDie(current, id));
    setMessage(`+1 ${id}`);
  }
  function purchaseSlot() {
    if (busy.current) return;
    setGame((current) => buySlot(current));
    setMessage("+1 dice slot");
  }
  function merge(recipe: MergeRecipe) {
    if (busy.current) return;
    setGame((current) => mergeDice(current, ...recipe.inputs));
    setMessage(
      `Merged ${recipe.inputs.join(" + ")} into ${recipe.output}. One slot freed.`,
    );
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

  if (economyView) return <EconomyView />;

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
        {migrationNotice && saveStatus !== "unavailable" && (
          <p className="warning migration-notice" role="status">
            {initial.migratedFrom === 1
              ? "Your d2/d3 became d4. Slots were added for your collection; level and coins were kept. "
              : "Prices now double with purchases. Your dice, coins, level and slots were kept. Existing copies set your starting purchase counts. "}
            <button
              className="text-button"
              onClick={() => setMigrationNotice(false)}
            >
              Dismiss update
            </button>
          </p>
        )}
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
            {last && (
              <span
                ref={reward}
                className={`earned-reward ${phase !== "reward" ? "reward-departed" : ""}`}
              >
                +{last.reward} <Coin />
              </span>
            )}
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
                ? "Skip animation"
                : `Roll your ${stats.count === 1 ? "die" : "dice"}`
            }
            disabled={modal === "recovery"}
            onClick={rolling ? skip : roll}
          >
            <span aria-hidden="true">{rolling ? "»" : "↻"}</span>
            {rolling ? "SKIP" : "ROLL"}
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
            <div className="slot-shop">
              <div>
                <strong>
                  {stats.count} / {game.slots} slots used
                </strong>
                <p>
                  {hasRoom
                    ? `${game.slots - stats.count} empty ${game.slots - stats.count === 1 ? "slot" : "slots"}`
                    : "Buy a slot to add another die."}
                </p>
              </div>
              <button
                className="buy-button"
                aria-label={
                  Number.isFinite(slotCost(game.slots))
                    ? `Buy slot for ${slotCost(game.slots)} Dicecoin`
                    : "Slot price limit reached"
                }
                disabled={rolling || game.balance < slotCost(game.slots)}
                onClick={purchaseSlot}
              >
                {Number.isFinite(slotCost(game.slots)) ? (
                  <>
                    + Slot <Coin amount={slotCost(game.slots)} />
                  </>
                ) : (
                  "Limit reached"
                )}
              </button>
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
                    <strong
                      className="die-value shop-die-max"
                      aria-hidden="true"
                    >
                      {die.max}
                    </strong>
                    <span className="owned">
                      ×{number(game.inventory[die.id])}
                    </span>
                  </div>
                  <button
                    className="buy-button"
                    aria-label={
                      Number.isFinite(dieCost(game, die.id))
                        ? `Buy ${die.id} for ${dieCost(game, die.id)} Dicecoin`
                        : `${die.id} price limit reached`
                    }
                    disabled={
                      rolling ||
                      !Number.isFinite(dieCost(game, die.id)) ||
                      game.balance < dieCost(game, die.id) ||
                      !hasRoom
                    }
                    onClick={() => buy(die.id)}
                  >
                    {Number.isFinite(dieCost(game, die.id)) ? (
                      <Coin amount={dieCost(game, die.id)} />
                    ) : (
                      "Limit reached"
                    )}
                    <span aria-hidden="true">+</span>
                  </button>
                </article>
              ))}
            </div>
            <MergeShop game={game} rolling={rolling} onMerge={merge} />
            <div className="shop-bottom">
              <p className="purchase-feedback" role="status">
                {message}
              </p>
              <a
                className="text-button"
                href="#economy"
                onClick={() => setModal(null)}
              >
                Economy lab
              </a>
              <button className="text-button" onClick={() => setModal("test")}>
                Test purchases
              </button>
            </div>
          </>
        ) : modal === "test" ? (
          <>
            <h2 id="modal-title">Test purchases</h2>
            <p className="modal-copy">No charge, no payment details.</p>
            <p className="modal-copy">
              {stats.count} / {game.slots} slots used.{" "}
              {hasRoom
                ? "Each test die uses one empty slot."
                : "Buy more slots in the shop before adding test dice."}
            </p>
            <button className="text-button" onClick={() => setModal("shop")}>
              Back to dice shop
            </button>
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
                  disabled={!hasRoom || rolling}
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
              Earn your rolled total in <Coin /> Dicecoin, on wins and losses.
            </p>
            <p className="modal-copy">
              Start with one d4 in one free slot. Extra slots cost{" "}
              {ECONOMY.slotPrice}, {ECONOMY.slotPrice * 2},{" "}
              {ECONOMY.slotPrice * 4} Dicecoin and so on, doubling each time.
              Each paid die purchase also doubles that type’s next price;
              merging does not reset it. Each owned die uses one slot and joins
              every roll.
            </p>
            <p className="modal-copy">
              Dice roll 1 through their face count. Buy an empty slot before
              adding another die.
            </p>
            <p className="modal-copy">
              In the shop, merge two dice for free when their maximums add up to
              another die’s maximum. For example, d4 + d4 becomes d8. Merging
              frees a slot and keeps the same maximum total, with 0.5 less
              average income per roll.
            </p>
            <a
              className="text-button"
              href="#economy"
              onClick={() => setModal(null)}
            >
              Open economy lab ↗
            </a>
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
                : "Start over at level 1 with one d4, one slot and zero Dicecoin?"}
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
