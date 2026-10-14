import { DICE, slotCost, type DieId } from "./game";
import {
  comparePool,
  earlyUpgradeChoices,
  poolLabel,
  type DraftPrices,
} from "./economy";

const number = (value: number) => value.toLocaleString("en-US");
const comparisons: DieId[][] = DICE.flatMap<DieId[]>((die) =>
  die.id === "d6" ? [[die.id], ["d4", "d4"]] : [[die.id]],
);

export default function EconomyTables({ prices }: { prices: DraftPrices }) {
  const choices = earlyUpgradeChoices(prices);
  const firstUpgrade = choices[1];
  return (
    <>
      <section
        className="analysis-card"
        id="pool-tables"
        tabIndex={-1}
        aria-labelledby="comparison-heading"
      >
        <h2 id="comparison-heading">Compare whole pools</h2>
        <p>
          Live dice prices are twice the average roll. Compare a single die with
          combinations; the prices below follow your draft edits.
        </p>
        <div className="table-scroll">
          <table className="value-table">
            <caption>Dice and pool value comparison</caption>
            <thead>
              <tr>
                <th>Dice</th>
                <th>Slots</th>
                <th>Possible total</th>
                <th>Average income / roll</th>
                <th>Highest winnable level</th>
                <th>Dice price</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((ids) => {
                const stats = comparePool(ids, prices);
                return (
                  <tr
                    key={poolLabel(ids)}
                    className={ids.length > 1 ? "pool-emphasis" : ""}
                  >
                    <th scope="row">{poolLabel(ids)}</th>
                    <td>{stats.slots}</td>
                    <td>
                      {stats.min}–{stats.max}
                    </td>
                    <td>{stats.mean}</td>
                    <td>{stats.max}</td>
                    <td>
                      {number(stats.diceCost)}
                      {ids.length === 1 && ids[0] === "d4" && (
                        <small>Starter is free</small>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="analysis-note">
          Dice prices exclude slots and the free starting die. Two d4s cost{" "}
          {number(prices.dice.d4 * 2)} to buy as a set; adding just one to your
          starter costs {number(prices.dice.d4)} plus a slot. 2d4 averages 5
          versus d6’s 3.5 and d8’s 4.5. A d8 has a higher chance of rolling 7 or
          8 and uses one slot.
        </p>
      </section>
      <section className="analysis-card" aria-labelledby="budget-heading">
        <div className="chart-heading">
          <div>
            <h2 id="budget-heading">
              Upgrade before the pool runs out of levels
            </h2>
            <p>
              Clearing levels 1–4 with a d4 guarantees at least 1 + 2 + 3 + 4 =
              10 Dicecoin. Extra slots cost {number(slotCost(1, prices.slot))},{" "}
              {number(slotCost(2, prices.slot))},{" "}
              {number(slotCost(3, prices.slot))} and so on: base price × slots
              already owned.
            </p>
          </div>
          <span
            className={
              firstUpgrade.affordable
                ? "budget-fits budget-badge"
                : "budget-short budget-badge"
            }
          >
            {firstUpgrade.affordable
              ? "d6 + slot fits the first 10 coins"
              : `d6 + slot exceeds 10 coins by ${number(firstUpgrade.cost - 10)}`}
          </span>
        </div>
        <div className="table-scroll">
          <table className="value-table budget-table">
            <caption>Guaranteed upgrade budgets</caption>
            <thead>
              <tr>
                <th>Current pool</th>
                <th>Cleared through</th>
                <th>Minimum wallet</th>
                <th>Buy</th>
                <th>Dice + slots</th>
                <th>Resulting pool</th>
                <th>New ceiling</th>
                <th>Affordable?</th>
              </tr>
            </thead>
            <tbody>
              {choices.map((choice, index) => (
                <tr key={index}>
                  <th scope="row">{poolLabel(choice.pool)}</th>
                  <td>Level {choice.through}</td>
                  <td>
                    {choice.wallet === null ? "—" : number(choice.wallet)}
                  </td>
                  <td>{poolLabel(choice.addition)}</td>
                  <td>{number(choice.cost)}</td>
                  <td>{poolLabel(choice.result)}</td>
                  <td>Level {comparePool(choice.result, prices).max}</td>
                  <td
                    className={
                      choice.affordable ? "budget-fits" : "budget-short"
                    }
                  >
                    {choice.affordable === null
                      ? "Earlier upgrade exceeds budget"
                      : choice.affordable
                        ? "Fits"
                        : `Short ${number(choice.cost - choice.wallet!)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="analysis-note">
          Assume purchases happen at these checkpoints, with every owned die
          still rolling. The first two rows are alternatives. The last two
          assume you bought the d6 at level 4: subtract its dice + slot cost,
          then add at least 5 + 6 + 7 + 8 + 9 + 10 = 45 coins from the next
          levels. Losses and overshoots add income, so these are guaranteed
          lower bounds, not average wallets. A dash means the earlier purchase
          does not fit the guaranteed budget; extra earnings may still fund it.
        </p>
      </section>
    </>
  );
}
