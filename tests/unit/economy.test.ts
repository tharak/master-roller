import { describe, expect, it } from "vitest";
import {
  analyzeEconomy,
  defaultPrices,
  distribution,
  upgradeRun,
  validPrices,
} from "../../src/economy";
import { DICE } from "../../src/game";

describe("economy analysis", () => {
  it("computes exact probabilities and means for summed dice", () => {
    const single = distribution(["d4"]);
    expect(single).toEqual([0, 0.25, 0.25, 0.25, 0.25]);
    const pool = distribution(["d4", "d6"]);
    expect(pool.length - 1).toBe(10);
    expect(pool.reduce((sum, probability) => sum + probability, 0)).toBeCloseTo(
      1,
    );
    expect(pool[2]).toBeCloseTo(1 / 24);
    expect(pool[10]).toBeCloseTo(1 / 24);
    expect(pool.reduce((sum, p, value) => sum + p * value, 0)).toBeCloseTo(6);
    expect(pool.slice(7).reduce((sum, p) => sum + p, 0)).toBeCloseTo(10 / 24);
  });
  it("preserves live prices while modeling slots and carryover deterministically", () => {
    const prices = defaultPrices(),
      before = JSON.stringify(prices);
    const run = upgradeRun(prices, 27);
    expect(upgradeRun(prices, 27)).toEqual(run);
    expect(run.events.map((event) => event.id)).toEqual(
      DICE.slice(1).map((die) => die.id),
    );
    expect(run.events[0].spent).toBe(120);
    expect(run.events.at(-1)!.spent).toBe(1920);
    expect(run.events[0].roll).toBeGreaterThanOrEqual(30);
    expect(run.events[0].roll).toBeLessThanOrEqual(120);
    for (const event of run.events) {
      expect(event.earned).toBeGreaterThanOrEqual(event.spent);
      expect(run.trace[event.roll].earned).toBe(event.earned);
    }
    expect(JSON.stringify(prices)).toBe(before);
  });
  it("reports upgrade windows and unreachable-level waits", () => {
    const report = analyzeEconomy(defaultPrices(), 50);
    expect(report.upgrades.every((upgrade) => upgrade.reached === 50)).toBe(
      true,
    );
    const first = report.upgrades[0];
    expect(first.medianLevel).toBe(5);
    expect(first.medianBlockedRolls).toBeGreaterThan(0);
    expect(first.lowRoll!).toBeLessThanOrEqual(first.medianRoll!);
    expect(first.highRoll!).toBeGreaterThanOrEqual(first.medianRoll!);
  });
  it("allows free draft upgrades and reports censored runs honestly", () => {
    const free = defaultPrices();
    free.slot = 0;
    for (const die of DICE) free.dice[die.id] = 0;
    const run = upgradeRun(free, 1);
    expect(run.events).toHaveLength(6);
    expect(
      run.events.every((event) => event.roll === 0 && event.spent === 0),
    ).toBe(true);
    const expensive = defaultPrices();
    expensive.slot = 20_000;
    const capped = analyzeEconomy(expensive, 5, 3);
    expect(
      capped.upgrades.every(
        (upgrade) => upgrade.reached === 0 && upgrade.medianRoll === null,
      ),
    ).toBe(true);
  });
  it("rejects invalid draft prices", () => {
    for (const price of [-1, 1.5, Infinity, 20001])
      expect(validPrices({ ...defaultPrices(), slot: price })).toBe(false);
    expect(validPrices(null)).toBe(false);
    expect(validPrices({ dice: {}, slot: 50 })).toBe(false);
  });
});
