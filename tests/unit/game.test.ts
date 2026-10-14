import { describe, expect, it } from "vitest";
import {
  buyDie,
  buySlot,
  DICE,
  ECONOMY,
  newGame,
  poolStats,
  rollGame,
  simulatePurchase,
} from "../../src/game";

describe("roll engine", () => {
  it("starts with one d4 in one slot and no coins", () => {
    const game = newGame();
    expect(game).toMatchObject({ version: 2, slots: 1, level: 1, balance: 0 });
    expect(poolStats(game)).toEqual({ count: 1, min: 1, max: 4 });
    expect(DICE.map((die) => die.id)).toEqual([
      "d4",
      "d6",
      "d8",
      "d10",
      "d12",
      "d20",
      "d100",
    ]);
  });
  it("losing stays at the level and earns the total", () => {
    const game = rollGame({ ...newGame(), level: 4 }, () => 0);
    expect(game.lastRoll).toMatchObject({ total: 1, won: false, reward: 1 });
    expect(game.level).toBe(4);
    expect(game.balance).toBe(1);
  });
  it("an exact target advances once and earns its total", () => {
    const game = rollGame({ ...newGame(), level: 4 }, () => 0.99);
    expect(game.lastRoll).toMatchObject({ total: 4, won: true, reward: 4 });
    expect(game.level).toBe(5);
    expect(game.balance).toBe(4);
  });
  it("overshooting advances only one level and pays the full sum", () => {
    const game = rollGame(
      simulatePurchase({ ...newGame(), slots: 2 }, "d100"),
      () => 0.999999,
    );
    expect(game.lastRoll?.total).toBe(104);
    expect(game.level).toBe(2);
    expect(game.balance).toBe(104);
  });
  it.each(DICE)("$id reaches every face and both endpoints", (die) => {
    const initial = simulatePurchase({ ...newGame(), slots: 2 }, die.id);
    for (let face = die.min; face <= die.max; face++) {
      const game = rollGame(
        initial,
        () => (face - die.min + 0.5) / (die.max - die.min + 1),
      );
      expect(
        game
          .lastRoll!.dice.find((group) => group.id === die.id)!
          .values.every((value) => value === face),
      ).toBe(true);
      expect(game.lastRoll!.reward).toBe(game.lastRoll!.total);
    }
  });
  it("sums all copies and die types", () => {
    let game = simulatePurchase({ ...newGame(), slots: 3 }, "d4");
    game = simulatePurchase(game, "d6");
    game = rollGame(game, () => 0.5);
    expect(game.lastRoll?.dice).toEqual([
      { id: "d4", values: [3, 3] },
      { id: "d6", values: [4] },
    ]);
    expect(game.lastRoll?.total).toBe(10);
    expect(game.balance).toBe(10);
  });
  it("does not mutate state and rejects invalid randomness", () => {
    const initial = newGame();
    rollGame(initial, () => 0);
    buySlot(initial);
    simulatePurchase(initial, "d20");
    expect(initial).toEqual(newGame());
    for (const value of [-1, 1, NaN, Infinity])
      expect(() => rollGame(initial, () => value)).toThrow();
  });
});
describe("slots and purchases", () => {
  it("buys slots for a flat 50 and preserves dice", () => {
    const initial = { ...newGame(), balance: 150 };
    const next = buySlot(buySlot(buySlot(initial)));
    expect(next.slots).toBe(4);
    expect(next.balance).toBe(0);
    expect(next.inventory).toEqual(initial.inventory);
    expect(buySlot(next)).toBe(next);
  });
  it.each(DICE)(
    "$id preserves its starting price and requires a free slot",
    (die) => {
      expect(die.price).toBe((20 * (die.min + die.max)) / 2);
      const full = {
        ...newGame(),
        balance: die.price * 2 + ECONOMY.slotPrice * 2,
      };
      expect(buyDie(full, die.id)).toBe(full);
      expect(simulatePurchase(full, die.id)).toBe(full);
      const next = buyDie(buySlot(buyDie(buySlot(full), die.id)), die.id);
      expect(next.balance).toBe(0);
      expect(next.slots).toBe(3);
      expect(next.inventory[die.id]).toBe(full.inventory[die.id] + 2);
      expect(buyDie(next, die.id)).toBe(next);
    },
  );
  it.each(DICE)("test $id grant is free but uses an empty slot", (die) => {
    const initial = { ...newGame(), slots: 2 };
    const next = simulatePurchase(initial, die.id);
    expect(next.balance).toBe(0);
    expect(next.slots).toBe(2);
    expect(next.inventory[die.id]).toBe(initial.inventory[die.id] + 1);
    expect(simulatePurchase(next, die.id)).toBe(next);
  });
  it("test coin packs are repeatable and do not grant slots", () => {
    const game = simulatePurchase(
      simulatePurchase(newGame(), "coins"),
      "coins",
    );
    expect(game.balance).toBe(2 * ECONOMY.coinPack);
    expect(game.slots).toBe(1);
  });
});
