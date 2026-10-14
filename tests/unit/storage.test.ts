import { describe, expect, it } from "vitest";
import { DICE, newGame, rollGame, simulatePurchase } from "../../src/game";
import { loadGame, saveGame, validSave } from "../../src/storage";

describe("save validation and recovery", () => {
  it("round-trips actual progress including later purchases", () => {
    let state = { ...newGame(), slots: DICE.length + 2 };
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
    expect(validSave({ ...newGame(), inventory: { d4: 1 } })).toBe(false);
    expect(validSave({ ...newGame(), slots: 0 })).toBe(false);
    expect(
      validSave({ ...newGame(), inventory: { ...newGame().inventory, d6: 1 } }),
    ).toBe(false);
    expect(
      validSave({ ...newGame(), inventory: { ...newGame().inventory, d4: 0 } }),
    ).toBe(false);
  });
  it("rejects invalid result ranges, totals, rewards, and advancement", () => {
    const state = rollGame(newGame(), () => 0.9);
    for (const lastRoll of [
      { ...state.lastRoll, total: 5 },
      { ...state.lastRoll, reward: 50 },
      { ...state.lastRoll, won: false },
      { ...state.lastRoll, dice: [{ id: "d4", values: [5] }] },
      { ...state.lastRoll, dice: [{ id: "d4", values: [4, 4] }] },
    ])
      expect(validSave({ ...state, lastRoll })).toBe(false);
    expect(validSave({ ...state, level: 10 })).toBe(false);
  });
});

describe("version 1 migration", () => {
  const legacy = {
    version: 1,
    level: 2,
    balance: 123,
    inventory: {
      d2: 3,
      d3: 2,
      d4: 1,
      d6: 2,
      d8: 0,
      d10: 0,
      d12: 0,
      d20: 0,
      d100: 0,
    },
    lastRoll: {
      level: 1,
      total: 1,
      won: true,
      reward: 20,
      dice: [{ id: "d2", values: [1] }],
    },
  };
  it("upgrades removed dice, preserves money/level, and grants capacity", () => {
    const raw = JSON.stringify(legacy);
    const loaded = loadGame({ getItem: () => raw });
    expect(loaded.status).toBe("saved");
    expect(loaded.legacyBackup).toBe(raw);
    expect(loaded.state).toMatchObject({
      version: 2,
      level: 2,
      balance: 123,
      slots: 8,
      inventory: { d4: 6, d6: 2 },
      lastRoll: null,
    });
    expect("d2" in loaded.state.inventory).toBe(false);
    expect("d3" in loaded.state.inventory).toBe(false);
    expect(validSave(loaded.state)).toBe(true);
  });
  it("backs up the original before writing version 2", () => {
    const raw = JSON.stringify(legacy),
      loaded = loadGame({ getItem: () => raw });
    const writes: [string, string][] = [];
    expect(
      saveGame(
        {
          setItem: (key, value) => {
            writes.push([key, value]);
          },
        },
        loaded.state,
        loaded.legacyBackup,
      ),
    ).toBe(true);
    expect(writes[0]).toEqual(["master-roller:save:v1-backup", raw]);
    expect(writes[1]).toEqual([
      "master-roller:save",
      JSON.stringify(loaded.state),
    ]);
  });
  it("does not replace the save if its backup fails", () => {
    const raw = JSON.stringify(legacy),
      loaded = loadGame({ getItem: () => raw });
    const keys: string[] = [];
    expect(
      saveGame(
        {
          setItem: (key) => {
            keys.push(key);
            throw new Error("quota");
          },
        },
        loaded.state,
        raw,
      ),
    ).toBe(false);
    expect(keys).toEqual(["master-roller:save:v1-backup"]);
  });
  it("rejects a corrupt legacy result instead of migrating it", () => {
    expect(
      loadGame({
        getItem: () =>
          JSON.stringify({
            ...legacy,
            lastRoll: { ...legacy.lastRoll, reward: 999 },
          }),
      }).status,
    ).toBe("invalid");
  });
});
