import { describe, expect, it } from "vitest";
import {
  buyDie,
  DICE,
  ECONOMY,
  newGame,
  poolStats,
  rollGame,
  simulatePurchase,
} from "../../src/game";

describe("roll engine", () => {
  it("starts at level 1 with a single d2 and no coins", () => {
    const game = newGame();
    expect(game.level).toBe(1);
    expect(game.balance).toBe(0);
    expect(poolStats(game)).toEqual({ count: 1, min: 0, max: 1 });
  });
  it("losing grants exactly enough for a d2 and does not advance", () => {
    const game = rollGame(newGame(), () => 0);
    expect(game.lastRoll?.total).toBe(0);
    expect(game.level).toBe(1);
    expect(game.balance).toBe(DICE[0].price);
    expect(buyDie(game, "d2").inventory.d2).toBe(2);
  });
  it("an exact target wins and grants twice a d2 price", () => {
    const game = rollGame(newGame(), () => 0.5);
    expect(game.lastRoll).toMatchObject({
      total: 1,
      level: 1,
      won: true,
      reward: 20,
    });
    expect(game.level).toBe(2);
    expect(game.balance).toBe(2 * DICE[0].price);
  });
  it("overshooting advances only one level", () => {
    const game = rollGame(simulatePurchase(newGame(), "d100"), () => 0.999999);
    expect(game.lastRoll?.total).toBe(101);
    expect(game.level).toBe(2);
    expect(game.balance).toBe(20);
  });
  it.each(DICE)("$id has correct endpoints and reaches every face", (die) => {
    const initial = simulatePurchase(newGame(), die.id);
    for (let face = die.min; face <= die.max; face++) {
      const random = (face - die.min + 0.5) / (die.max - die.min + 1);
      const rolled = rollGame(initial, () => random);
      const group = rolled.lastRoll!.dice.find((g) => g.id === die.id)!;
      expect(group.values.every((value) => value === face)).toBe(true);
    }
    expect(
      rollGame(initial, () => 0).lastRoll!.dice.find((g) => g.id === die.id)!
        .values[0],
    ).toBe(die.min);
    expect(
      rollGame(initial, () => 1 - Number.EPSILON).lastRoll!.dice.find(
        (g) => g.id === die.id,
      )!.values[0],
    ).toBe(die.max);
  });
  it("rolls all copies and correctly sums different dice", () => {
    let game = simulatePurchase(newGame(), "d2");
    game = simulatePurchase(game, "d6");
    game = rollGame(game, () => 0.5);
    expect(game.lastRoll?.dice).toEqual([
      { id: "d2", values: [1, 1] },
      { id: "d6", values: [4] },
    ]);
    expect(game.lastRoll?.total).toBe(6);
  });
  it("does not mutate previous state", () => {
    const initial = newGame();
    rollGame(initial, () => 0);
    simulatePurchase(initial, "d20");
    expect(initial).toEqual(newGame());
  });
  it("rejects invalid injected randomness", () => {
    for (const value of [-1, 1, NaN, Infinity])
      expect(() => rollGame(newGame(), () => value)).toThrow();
  });
});
describe("economy and test purchases", () => {
  it.each(DICE)(
    "$id costs 20 times expected roll and buys repeatedly",
    (die) => {
      expect(die.price).toBe((20 * (die.min + die.max)) / 2);
      const game = { ...newGame(), balance: die.price * 2 };
      const next = buyDie(buyDie(game, die.id), die.id);
      expect(next.balance).toBe(0);
      expect(next.inventory[die.id]).toBe(game.inventory[die.id] + 2);
      expect(buyDie(next, die.id)).toBe(next);
    },
  );
  it.each(DICE)("test offer grants one $id without charging", (die) => {
    const initial = newGame();
    const next = simulatePurchase(simulatePurchase(initial, die.id), die.id);
    expect(next.balance).toBe(0);
    expect(next.inventory[die.id]).toBe(initial.inventory[die.id] + 2);
  });
  it("test currency pack grants 10,000 and repeats", () => {
    expect(
      simulatePurchase(simulatePurchase(newGame(), "coins"), "coins").balance,
    ).toBe(2 * ECONOMY.coinPack);
  });
});
