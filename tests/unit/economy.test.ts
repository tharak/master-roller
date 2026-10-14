import { describe, expect, it } from "vitest";
import {
  analyzeEconomy,
  defaultPrices,
  distribution,
  upgradeRun,
  validPrices,
  comparePool,
  earlyUpgradeChoices,
  minimumWinningIncome,
  loadDraftPrices,
  DRAFT_KEY,
  LEGACY_DRAFT_KEY,
} from "../../src/economy";
import { DICE, LEGACY_DRAFT_DEFAULTS } from "../../src/game";

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
    expect(run.events[0].spent).toBe(10);
    expect(run.events.at(-1)!.spent).toBe(225);
    expect(run.events[1].spent - run.events[0].spent).toBe(15);
    expect(run.events[0].roll).toBeGreaterThanOrEqual(3);
    expect(run.events[0].roll).toBeLessThanOrEqual(10);
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
    expect(first.medianLevel).toBe(4);
    expect(first.medianBlockedRolls).toBe(0);
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
  it("compares whole-pool power and prices", () => {
    const prices = defaultPrices();
    const pair = comparePool(["d4", "d4"], prices),
      single = comparePool(["d6"], prices);
    expect(pair).toEqual({ slots: 2, min: 2, max: 8, mean: 5, diceCost: 10 });
    expect(single).toEqual({
      slots: 1,
      min: 1,
      max: 6,
      mean: 3.5,
      diceCost: 7,
    });
    expect(single.diceCost).toBeLessThan(pair.diceCost);
    prices.dice.d4 = 6;
    expect(comparePool(["d4", "d4"], prices).diceCost).toBe(12);
  });
  it("computes guaranteed income and checkpoint wallets after earlier spending", () => {
    expect(minimumWinningIncome(["d4"], 1, 4)).toBe(10);
    expect(minimumWinningIncome(["d4", "d4"], 1, 8)).toBe(37);
    expect(minimumWinningIncome(["d4", "d6"], 5, 10)).toBe(45);
    expect(() => minimumWinningIncome(["d4"], 1, 5)).toThrow(RangeError);
    const choices = earlyUpgradeChoices(defaultPrices());
    expect(choices.map((row) => row.wallet)).toEqual([10, 10, 45, 45]);
    expect(choices.map((row) => row.cost)).toEqual([8, 10, 15, 25]);
    expect(choices.every((row) => row.affordable)).toBe(true);
    expect(comparePool(choices[3].result, defaultPrices())).toMatchObject({
      min: 4,
      max: 18,
      mean: 11,
    });
  });
  it("marks a failed earlier guaranteed purchase instead of inventing a later wallet", () => {
    const prices = defaultPrices();
    prices.slot = 50;
    const choices = earlyUpgradeChoices(prices);
    expect(choices[1]).toMatchObject({
      wallet: 10,
      cost: 57,
      affordable: false,
    });
    expect(choices[2]).toMatchObject({ wallet: null, affordable: null });
  });
  it("updates untouched legacy drafts and retains custom and current drafts", () => {
    const storage = (key: string, value: unknown) => ({
      getItem: (requested: string) =>
        requested === key ? JSON.stringify(value) : null,
    });
    expect(
      loadDraftPrices(storage(LEGACY_DRAFT_KEY, LEGACY_DRAFT_DEFAULTS)),
    ).toEqual(defaultPrices());
    const custom = { ...LEGACY_DRAFT_DEFAULTS, slot: 49 };
    expect(loadDraftPrices(storage(LEGACY_DRAFT_KEY, custom))).toEqual(custom);
    expect(loadDraftPrices(storage(DRAFT_KEY, custom))).toEqual(custom);
  });
});
