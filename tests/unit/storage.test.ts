import { describe, expect, it } from "vitest";
import { DICE, newGame, rollGame, simulatePurchase } from "../../src/game";
import { loadGame, saveGame, validSave } from "../../src/storage";

describe("save validation and recovery", () => {
  it("round-trips actual progress including later purchases", () => {
    let state = newGame();
    for (const die of DICE) state = simulatePurchase(state, die.id);
    state = rollGame(state, () => 0.7);
    state = simulatePurchase(state, "d6");
    let raw = "";
    expect(
      saveGame(
        {
          setItem: (_, value) => {
            raw = value;
          },
        },
        state,
      ),
    ).toBe(true);
    expect(loadGame({ getItem: () => raw })).toEqual({
      state,
      status: "saved",
    });
  });
  it("returns a fresh game when no save exists", () => {
    expect(loadGame({ getItem: () => null })).toEqual({
      state: newGame(),
      status: "saved",
    });
  });
  it.each(["bad json", "{}", "null", '{"version":99}'])(
    "marks corrupt or unsupported data invalid: %s",
    (raw) => {
      expect(loadGame({ getItem: () => raw }).status).toBe("invalid");
    },
  );
  it("handles unavailable reads and writes", () => {
    expect(
      loadGame({
        getItem: () => {
          throw new Error("blocked");
        },
      }).status,
    ).toBe("unavailable");
    expect(
      saveGame(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        newGame(),
      ),
    ).toBe(false);
  });
  it("rejects malformed inventory and numerical state", () => {
    expect(validSave({ ...newGame(), level: 0 })).toBe(false);
    expect(validSave({ ...newGame(), balance: -1 })).toBe(false);
    expect(validSave({ ...newGame(), balance: 1.2 })).toBe(false);
    expect(validSave({ ...newGame(), inventory: { d2: 1 } })).toBe(false);
    expect(
      validSave({ ...newGame(), inventory: { ...newGame().inventory, d2: 0 } }),
    ).toBe(false);
  });
  it("rejects invalid result ranges, totals, rewards, and advancement", () => {
    const state = rollGame(newGame(), () => 0.9);
    for (const lastRoll of [
      { ...state.lastRoll, total: 5 },
      { ...state.lastRoll, reward: 50 },
      { ...state.lastRoll, won: false },
      { ...state.lastRoll, dice: [{ id: "d2", values: [2] }] },
      { ...state.lastRoll, dice: [{ id: "d2", values: [1, 1] }] },
    ])
      expect(validSave({ ...state, lastRoll })).toBe(false);
    expect(validSave({ ...state, level: 10 })).toBe(false);
  });
});
