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
  slotCost,
  MERGE_RECIPES,
  availableMerges,
  mergeDice,
  type DieId,
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
describe("dice merging", () => {
  const recipes: [DieId, DieId, DieId][] = [
    ["d4", "d4", "d8"],
    ["d4", "d6", "d10"],
    ["d4", "d8", "d12"],
    ["d6", "d6", "d12"],
    ["d8", "d12", "d20"],
    ["d10", "d10", "d20"],
  ];
  it("offers exactly the supported unordered pairs", () => {
    expect(
      MERGE_RECIPES.map((recipe) => [...recipe.inputs, recipe.output]),
    ).toEqual(recipes);
    expect(availableMerges(newGame())).toEqual([]);
  });
  it.each(recipes)(
    "merges %s + %s into %s for free at full capacity",
    (left, right, output) => {
      const initial = {
        ...newGame(),
        slots: 2,
        balance: 17,
        level: 9,
        inventory: Object.fromEntries(
          DICE.map((die) => [
            die.id,
            Number(die.id === left) + Number(die.id === right),
          ]),
        ) as ReturnType<typeof newGame>["inventory"],
      };
      const before = structuredClone(initial);
      const next = mergeDice(initial, left, right);
      expect(initial).toEqual(before);
      expect(next).toMatchObject({ slots: 2, balance: 17, level: 9 });
      expect(next.inventory[output]).toBe(1);
      expect(next.inventory[left]).toBe(0);
      expect(next.inventory[right]).toBe(0);
      expect(poolStats(next)).toEqual({
        count: 1,
        min: 1,
        max: poolStats(initial).max,
      });
      expect(mergeDice(initial, right, left)).toEqual(next);
      const rolled = rollGame(next, () => 0.99);
      expect(rolled.lastRoll?.total).toBe(poolStats(initial).max);
      expect(rolled.lastRoll?.dice).toEqual([
        { id: output, values: [poolStats(initial).max] },
      ]);
    },
  );
  it("rejects missing copies and unsupported or unknown sums without mutation", () => {
    const initial = { ...newGame(), slots: 10 };
    expect(mergeDice(initial, "d4", "d4")).toBe(initial);
    expect(mergeDice(initial, "d4", "d6")).toBe(initial);
    const rich = {
      ...initial,
      inventory: Object.fromEntries(
        DICE.map((die) => [die.id, 1]),
      ) as typeof initial.inventory,
    };
    expect(mergeDice(rich, "d6", "d8")).toBe(rich);
    expect(mergeDice(rich, "d100", "d4")).toBe(rich);
    expect(mergeDice(rich, "d2" as DieId, "d4")).toBe(rich);
  });
  it("supports chained merges, keeps unconsumed copies and guards repeated consumption", () => {
    const initial = {
      ...newGame(),
      slots: 4,
      inventory: { ...newGame().inventory, d4: 3, d6: 1 },
    };
    const first = mergeDice(initial, "d4", "d4");
    expect(first.inventory).toMatchObject({ d4: 1, d6: 1, d8: 1 });
    expect(mergeDice(first, "d4", "d4")).toBe(first);
    expect(availableMerges(first).map((recipe) => recipe.output)).toEqual([
      "d10",
      "d12",
    ]);
    const second = mergeDice(first, "d4", "d8");
    expect(second.inventory).toMatchObject({ d4: 0, d6: 1, d8: 0, d12: 1 });
    expect(poolStats(second)).toEqual({ count: 2, min: 2, max: 18 });
    expect(slotCost(second.slots)).toBe(slotCost(initial.slots));
  });
});
describe("slots and purchases", () => {
  it("charges 3, 6, 9 for consecutive slots and preserves dice", () => {
    const initial = { ...newGame(), balance: 18 };
    const second = buySlot(initial);
    expect(second).toMatchObject({ slots: 2, balance: 15 });
    const third = buySlot(second);
    expect(third).toMatchObject({ slots: 3, balance: 9 });
    const next = buySlot(third);
    expect(next.slots).toBe(4);
    expect(next.balance).toBe(0);
    expect(next.inventory).toEqual(initial.inventory);
    expect(buySlot(next)).toBe(next);
    expect(slotCost(next.slots)).toBe(12);
    const short = { ...next, balance: 11 };
    expect(buySlot(short)).toBe(short);
    // Existing version-2 saves need no new purchase counter.
    expect(buySlot({ ...next, balance: 12 })).toMatchObject({
      slots: 5,
      balance: 0,
    });
  });
  it.each(DICE)(
    "$id costs twice its average and requires a free slot",
    (die) => {
      expect(die.price).toBe(die.min + die.max);
      const full = {
        ...newGame(),
        balance: die.price * 2 + 9,
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
  it("minimum winning income through level 4 funds a d6 and its slot", () => {
    let game = newGame();
    for (let face = 1; face <= 4; face++)
      game = rollGame(game, () => (face - 1) / 4);
    expect(game.level).toBe(5);
    expect(game.balance).toBe(10);
    game = buyDie(buySlot(game), "d6");
    expect(game).toMatchObject({
      slots: 2,
      balance: 0,
      inventory: { d4: 1, d6: 1 },
    });
  });
});
