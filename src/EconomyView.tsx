import { useEffect, useMemo, useState } from "react";
import { DICE, slotCost } from "./game";
import {
  defaultPrices,
  distribution,
  DRAFT_KEY,
  loadDraftPrices,
  type DraftPrices,
  type EconomyReport,
} from "./economy";
import "./economy.css";
import EconomyTables from "./EconomyTables";

const colors = [
  "#91bbff",
  "#bcabff",
  "#f1a7d7",
  "#eaba8f",
  "#dfdb8c",
  "#8fd3df",
  "#efad77",
];
const number = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("en-US");
function jumpTo(id: string) {
  const panel = document.getElementById(id);
  panel?.scrollIntoView({ block: "start" });
  panel?.focus({ preventScroll: true });
}
function initialPrices() {
  try {
    return loadDraftPrices(localStorage);
  } catch {
    return defaultPrices();
  }
}
function DiceRanges() {
  const [log, setLog] = useState(false);
  const x = (value: number) =>
    92 + (log ? Math.log10(value) / 2 : (value - 1) / 99) * 670;
  return (
    <section
      className="analysis-card"
      id="dice-ranges"
      tabIndex={-1}
      aria-labelledby="ranges-heading"
    >
      <div className="chart-heading">
        <div>
          <h2 id="ranges-heading">Every die, every possible value</h2>
          <p>Each dot is one equally likely face. Diamonds mark the average.</p>
        </div>
        <label className="axis-choice">
          <input
            type="checkbox"
            checked={log}
            onChange={(event) => setLog(event.target.checked)}
          />{" "}
          Log scale
        </label>
      </div>
      <div className="chart-scroll">
        <svg
          viewBox="0 0 820 340"
          role="img"
          aria-labelledby="ranges-title ranges-desc"
        >
          <title id="ranges-title">Possible values for all seven dice</title>
          <desc id="ranges-desc">
            d4 rolls 1 to 4, d6 1 to 6, d8 1 to 8, d10 1 to 10, d12 1 to 12, d20
            1 to 20, and d100 1 to 100. Every face has equal probability.
          </desc>
          {[1, 4, 10, 20, 50, 100].map((tick) => (
            <g key={tick}>
              <line
                className="chart-grid"
                x1={x(tick)}
                x2={x(tick)}
                y1="12"
                y2="300"
              />
              <text
                className="axis-label"
                x={x(tick)}
                y="326"
                textAnchor="middle"
              >
                {tick}
              </text>
            </g>
          ))}
          {DICE.map((die, index) => {
            const y = 30 + index * 42;
            const mean = (die.min + die.max) / 2;
            return (
              <g key={die.id} style={{ color: colors[index] }}>
                <text className="range-name" x="12" y={y + 5}>
                  {die.id}
                </text>
                <line
                  x1={x(die.min)}
                  x2={x(die.max)}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeOpacity=".18"
                  strokeLinecap="round"
                />
                {Array.from({ length: die.max }, (_, face) => (
                  <circle
                    key={face}
                    cx={x(face + 1)}
                    cy={y}
                    r="2.5"
                    fill="currentColor"
                  >
                    <title>
                      {die.id}: {face + 1}, {(100 / die.max).toFixed(1)}% chance
                    </title>
                  </circle>
                ))}
                <path
                  d={`M${x(mean)} ${y - 7}l6 7-6 7-6-7Z`}
                  fill="currentColor"
                >
                  <title>Average {mean}</title>
                </path>
                <text
                  className="range-caption"
                  x="804"
                  y={y + 5}
                  textAnchor="end"
                >
                  1–{die.max}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
export default function EconomyView() {
  const [prices, setPrices] = useState<DraftPrices>(initialPrices);
  const [stage, setStage] = useState(0);
  const [target, setTarget] = useState(4);
  const [report, setReport] = useState<EconomyReport | null>(null);
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setPending(true);
    setFailed(false);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(prices));
    } catch {
      /* Draft editing still works without storage. */
    }
    const worker = new Worker(new URL("./economy.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event) => {
      setReport(event.data as EconomyReport);
      setPending(false);
    };
    worker.onerror = () => {
      setFailed(true);
      setPending(false);
    };
    worker.postMessage(prices);
    return () => worker.terminate();
  }, [prices]);
  const pool = useMemo(
    () => distribution(DICE.slice(0, stage + 1).map((d) => d.id)),
    [stage],
  );
  const poolMax = pool.length - 1;
  const mean = pool.reduce(
    (sum, probability, value) => sum + probability * value,
    0,
  );
  const chance = pool
    .slice(target)
    .reduce((sum, probability) => sum + probability, 0);
  const selected = report?.upgrades[stage];
  const chartWidth = 820,
    left = 70,
    right = 790,
    top = 20,
    bottom = 270;
  const maxRoll = Math.max(
    10,
    report?.example.trace.at(-1)?.roll ?? 10,
    selected?.highRoll ?? 0,
  );
  const maxCoins = Math.max(
    100,
    report?.upgrades.at(-1)?.cumulativeCost ?? 100,
    report?.example.trace.at(-1)?.earned ?? 0,
  );
  const rx = (roll: number) => left + (roll / maxRoll) * (right - left);
  const cy = (coins: number) => bottom - (coins / maxCoins) * (bottom - top);
  const pointPath = report?.example.trace
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${rx(point.roll)},${cy(point.earned)}`,
    )
    .join(" ");
  return (
    <main className="economy-view">
      <header className="economy-header">
        <div>
          <a className="analysis-back" href="#">
            ← Back to game
          </a>
          <p className="eyebrow">MASTER ROLLER · BALANCE TOOLS</p>
          <h1>Economy lab</h1>
          <p>
            See what your rolls can pay for, and when the next die becomes
            affordable.
          </p>
          <nav className="analysis-nav" aria-label="Economy sections">
            <button onClick={() => jumpTo("dice-ranges")}>Dice values</button>
            <button onClick={() => jumpTo("prices-panel")}>Edit prices</button>
            <button onClick={() => jumpTo("pool-tables")}>
              Pool & budget tables
            </button>
            <button onClick={() => jumpTo("upgrades-panel")}>
              Upgrade timing
            </button>
          </nav>
        </div>
        <span className="draft-badge">Draft prices · game unchanged</span>
      </header>
      <div className="analysis-layout">
        <aside
          className="analysis-card price-editor"
          id="prices-panel"
          tabIndex={-1}
          aria-labelledby="prices-heading"
        >
          <h2 id="prices-heading">Try different prices</h2>
          <p>
            Start with the current prices. Edits only affect these graphs and
            simulations.
          </p>
          {DICE.map((die, index) => (
            <label className="price-row" key={die.id}>
              <span>
                <i style={{ background: colors[index] }} />
                {die.id}
                <small>
                  {die.id === "d4"
                    ? "First one is free"
                    : `1–${die.max} · avg ${(die.max + 1) / 2}`}
                </small>
              </span>
              <input
                aria-label={`${die.id} draft price`}
                type="number"
                min="0"
                max="20000"
                step="1"
                value={prices.dice[die.id]}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (
                    Number.isSafeInteger(value) &&
                    value >= 0 &&
                    value <= 20000
                  )
                    setPrices((previous) => ({
                      ...previous,
                      dice: { ...previous.dice, [die.id]: value },
                    }));
                }}
              />
            </label>
          ))}
          <label className="price-row slot-price">
            <span>
              Slot base price<small>Doubles with each extra slot</small>
            </span>
            <input
              aria-label="Draft slot price"
              type="number"
              min="0"
              max="20000"
              step="1"
              value={prices.slot}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isSafeInteger(value) && value >= 0 && value <= 20000)
                  setPrices((previous) => ({ ...previous, slot: value }));
              }}
            />
          </label>
          <button
            className="secondary-button"
            onClick={() => setPrices(defaultPrices())}
          >
            Reset draft prices
          </button>
          <p className="analysis-note">
            Prices are Dicecoin starting prices. Paid purchases double that
            type’s next price; extra slots also double. New games start with one
            free d4, one free slot, and zero coins. Each roll earns its total.
          </p>
        </aside>
        <div className="analysis-charts">
          <DiceRanges />
          <EconomyTables prices={prices} />
          <section className="analysis-card" aria-labelledby="pool-heading">
            <div className="chart-heading">
              <div>
                <h2 id="pool-heading">What can the current pool roll?</h2>
                <p>
                  Choose the largest die already purchased. The pool has one of
                  every die up to it.
                </p>
              </div>
            </div>
            <div className="stage-picker" role="group" aria-label="Pool stage">
              {DICE.map((die, index) => (
                <button
                  key={die.id}
                  aria-pressed={stage === index}
                  onClick={() => {
                    setStage(index);
                    setTarget(
                      Math.min(
                        target,
                        DICE.slice(0, index + 1).reduce(
                          (sum, d) => sum + d.max,
                          0,
                        ) + 1,
                      ),
                    );
                  }}
                >
                  {die.id}
                </button>
              ))}
            </div>
            <div className="analysis-metrics">
              <p>
                Possible total
                <strong>
                  {stage + 1}–{poolMax}
                </strong>
              </p>
              <p>
                Average income / roll<strong>{mean.toFixed(1)}</strong>
              </p>
              <p>
                Next die + slot
                <strong>
                  {stage < DICE.length - 1
                    ? number(
                        prices.dice[DICE[stage + 1].id] +
                          slotCost(stage + 1, prices.slot),
                      )
                    : "Full set"}
                </strong>
              </p>
            </div>
            <label className="target-slider">
              Inspect level <strong>{target}</strong>
              <input
                aria-label="Inspect level"
                type="range"
                min="1"
                max={poolMax + 5}
                value={target}
                onChange={(event) => setTarget(Number(event.target.value))}
              />
              <span>{(chance * 100).toFixed(1)}% win chance</span>
            </label>
            <div className="chart-scroll">
              <svg
                viewBox="0 0 820 220"
                role="img"
                aria-label={`Probability of each total for a pool through ${DICE[stage].id}`}
              >
                {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                  const max = Math.max(...pool);
                  const y = 175 - fraction * 145;
                  return (
                    <g key={fraction}>
                      <line
                        className="chart-grid"
                        x1="70"
                        x2="790"
                        y1={y}
                        y2={y}
                      />
                      <text
                        className="axis-label"
                        x="60"
                        y={y + 4}
                        textAnchor="end"
                      >
                        {(max * fraction * 100).toFixed(1)}%
                      </text>
                    </g>
                  );
                })}
                {pool.map((probability, value) =>
                  probability > 0 ? (
                    <rect
                      key={value}
                      x={70 + ((value - 0.5) / (poolMax + 1)) * 720}
                      y={175 - (probability / Math.max(...pool)) * 145}
                      width={Math.max(1, 720 / (poolMax + 1) - 1)}
                      height={(probability / Math.max(...pool)) * 145}
                      rx="1"
                      fill={value >= target ? "#dbff78" : "#91bbff"}
                    >
                      <title>
                        Total {value}: {(probability * 100).toFixed(2)}% · earns{" "}
                        {value} Dicecoin
                      </title>
                    </rect>
                  ) : null,
                )}
                {[stage + 1, Math.round(mean), poolMax].map((value, index) => (
                  <text
                    key={index}
                    className="axis-label"
                    x={70 + (value / (poolMax + 1)) * 720}
                    y="204"
                    textAnchor="middle"
                  >
                    {value}
                  </text>
                ))}
                {target <= poolMax && (
                  <line
                    x1={70 + ((target - 0.5) / (poolMax + 1)) * 720}
                    x2={70 + ((target - 0.5) / (poolMax + 1)) * 720}
                    y1="20"
                    y2="180"
                    stroke="#fff"
                    strokeDasharray="4 4"
                  />
                )}
              </svg>
            </div>
            <p className="analysis-note">
              Green totals clear the inspected level. Blue totals lose. Both
              earn their rolled value.
            </p>
          </section>
        </div>
      </div>
      <section
        className="analysis-card income-card"
        id="upgrades-panel"
        tabIndex={-1}
        aria-labelledby="income-heading"
        aria-busy={pending}
      >
        <div className="chart-heading">
          <div>
            <h2 id="income-heading">When can we afford the next die?</h2>
            <p>
              Save for d6 → d8 → d10 → d12 → d20 → d100, buying one slot with
              each die. No merges, repeat dice or Test Lab grants.
            </p>
          </div>
          <span className="simulation-status" role="status">
            {failed
              ? "Analysis failed. Try resetting prices."
              : pending
                ? "Recalculating…"
                : `${report?.seeds} seeded runs · ready`}
          </span>
        </div>
        <div className="analysis-metrics">
          <p>
            Next upgrade
            <strong>
              {stage < DICE.length - 1 ? DICE[stage + 1].id : "Complete"}
            </strong>
          </p>
          <p>
            Median purchase roll
            <strong>{number(selected?.medianRoll ?? null)}</strong>
          </p>
          <p>
            Typical purchase window
            <strong>
              {selected?.lowRoll == null
                ? "—"
                : `${number(selected.lowRoll)}–${number(selected.highRoll)}`}
            </strong>
          </p>
          <p>
            Median level at purchase
            <strong>{number(selected?.medianLevel ?? null)}</strong>
          </p>
        </div>
        <div className="chart-scroll">
          <svg
            viewBox={`0 0 ${chartWidth} 320`}
            role="img"
            aria-labelledby="income-title income-desc"
          >
            <title id="income-title">
              Cumulative earnings and upgrade budgets
            </title>
            <desc id="income-desc">
              The solid line is earned Dicecoin from one example run. Horizontal
              lines are cumulative dice and slot costs. A shaded band shows the
              10th to 90th percentile roll window for the selected upgrade.
            </desc>
            {Array.from({ length: 5 }, (_, i) => i / 4).map((fraction) => (
              <g key={fraction}>
                <line
                  className="chart-grid"
                  x1={left}
                  x2={right}
                  y1={cy(maxCoins * fraction)}
                  y2={cy(maxCoins * fraction)}
                />
                <text
                  className="axis-label"
                  x={left - 12}
                  y={cy(maxCoins * fraction) + 4}
                  textAnchor="end"
                >
                  {number(Math.round(maxCoins * fraction))}
                </text>
                <text
                  className="axis-label"
                  x={rx(maxRoll * fraction)}
                  y="294"
                  textAnchor="middle"
                >
                  {Math.round(maxRoll * fraction)}
                </text>
              </g>
            ))}
            {selected?.lowRoll != null && (
              <rect
                x={rx(selected.lowRoll)}
                y={top}
                width={Math.max(
                  2,
                  rx(selected.highRoll!) - rx(selected.lowRoll),
                )}
                height={bottom - top}
                fill="#dbff78"
                opacity=".09"
              />
            )}
            {report?.upgrades.map((upgrade, index) => (
              <g key={upgrade.id} opacity={index === stage ? 1 : 0.4}>
                <line
                  x1={left}
                  x2={right}
                  y1={cy(upgrade.cumulativeCost)}
                  y2={cy(upgrade.cumulativeCost)}
                  stroke={colors[index + 1]}
                  strokeDasharray="5 5"
                />
                <text
                  className="budget-label"
                  x={right - 4}
                  y={cy(upgrade.cumulativeCost) - 5}
                  textAnchor="end"
                  fill={colors[index + 1]}
                >
                  {upgrade.id} · {number(upgrade.cumulativeCost)}
                </text>
              </g>
            ))}
            <path
              d={pointPath ?? ""}
              fill="none"
              stroke="#dbff78"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {report?.example.events.map((event) => (
              <circle
                key={event.id}
                cx={rx(event.roll)}
                cy={cy(event.earned)}
                r="5"
                fill="#151925"
                stroke="#dbff78"
                strokeWidth="2"
              >
                <title>
                  {event.id}: roll {event.roll}, level {event.level}, earned{" "}
                  {event.earned}, spent {event.spent}
                </title>
              </circle>
            ))}
            <text className="axis-label" x="12" y="15">
              Dicecoin earned
            </text>
            <text className="axis-label" x="430" y="317" textAnchor="middle">
              Roll number
            </text>
          </svg>
        </div>
        <p className="analysis-note">
          Solid line: example seed {report?.example.seed ?? "—"}. Dashed lines:
          cumulative upgrade budgets, including slots. Shaded window: middle 80%
          of purchase rolls for the selected upgrade. Remaining coins carry into
          the next purchase.
        </p>
        <div className="table-scroll">
          <table className="upgrade-table">
            <caption>Upgrade timing across {report?.seeds ?? 200} runs</caption>
            <thead>
              <tr>
                <th>Next die</th>
                <th>Die + slot</th>
                <th>Total budget</th>
                <th>
                  Purchase roll
                  <br />
                  (median · 10–90%)
                </th>
                <th>
                  Level
                  <br />
                  (median)
                </th>
                <th>
                  Unreachable-level waits
                  <br />
                  (median rolls)
                </th>
                <th>Runs reached</th>
              </tr>
            </thead>
            <tbody>
              {report?.upgrades.map((upgrade, index) => (
                <tr
                  key={upgrade.id}
                  className={index === stage ? "selected-upgrade" : ""}
                >
                  <th>
                    <button
                      aria-pressed={stage === index}
                      onClick={() => setStage(index)}
                    >
                      {upgrade.id}
                    </button>
                  </th>
                  <td>{number(upgrade.cost)}</td>
                  <td>{number(upgrade.cumulativeCost)}</td>
                  <td>
                    {number(upgrade.medianRoll)}{" "}
                    <small>
                      {number(upgrade.lowRoll)}–{number(upgrade.highRoll)}
                    </small>
                  </td>
                  <td>{number(upgrade.medianLevel)}</td>
                  <td
                    className={upgrade.medianBlockedRolls ? "wait-value" : ""}
                  >
                    {number(upgrade.medianBlockedRolls)}
                  </td>
                  <td>
                    {upgrade.reached}/{report.seeds}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="analysis-note">
          An unreachable-level wait is a roll made while the target exceeds the
          pool’s maximum. It still earns coins. Results describe this purchase
          strategy, not optimal play. Runs stop at d100 or{" "}
          {number(report?.rollLimit ?? 2000)} rolls. Percentiles use runs that
          reached the upgrade; check the reached count when trying high prices.
          The free starting d4’s price affects extra copies, which this strategy
          does not buy.
        </p>
      </section>
    </main>
  );
}
