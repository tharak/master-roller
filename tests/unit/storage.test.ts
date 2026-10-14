import { describe, expect, it } from "vitest";
import {
  DICE,
  newGame,
  rollGame,
  simulatePurchase,
  mergeDice,
  buyDie,
  dieCost,
} from "../../src/game";
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
  it("round-trips a merge after rolling without stale consumed dice", () => {
    const rolled = rollGame(
      { ...newGame(), slots: 2, inventory: { ...newGame().inventory, d4: 2 } },
      () => 0.99,
    );
    const merged = mergeDice(rolled, "d4", "d4");
    expect(merged.lastRoll).toBeNull();
    expect(merged).toMatchObject({
      version: 3,
      level: 2,
      balance: 8,
      slots: 2,
      inventory: { d4: 0, d8: 1 },
    });
    expect(validSave(merged)).toBe(true);
    expect(loadGame({ getItem: () => JSON.stringify(merged) })).toEqual({
      state: merged,
      status: "saved",
    });
    expect(validSave(rollGame(merged, () => 0.99))).toBe(true);
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
  it("rejects absent or invalid purchase counts in version 3", () => {
    expect(validSave({ ...newGame(), purchases: undefined })).toBe(false);
    for (const count of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(
        validSave({
          ...newGame(),
          purchases: { ...newGame().purchases, d4: count },
        }),
      ).toBe(false);
  });
  it("round-trips paid price increases after merging", () => {
    const purchased = buyDie({ ...newGame(), slots: 2, balance: 5 }, "d4");
    const merged = mergeDice(purchased, "d4", "d4");
    const loaded = loadGame({ getItem: () => JSON.stringify(merged) });
    expect(loaded.status).toBe("saved");
    expect(dieCost(loaded.state, "d4")).toBe(10);
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
      version: 3,
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
  it("backs up the original before writing version 3", () => {
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

describe("version 2 migration", () => {
  function oldSave() {
    const { purchases: _, ...state } = rollGame(
      {
        ...newGame(),
        slots: 4,
        inventory: { ...newGame().inventory, d4: 2, d6: 1 },
      },
      () => 0.99,
    );
    return { ...state, version: 2 };
  }
  it("keeps progress and roll history while inferring existing paid copies", () => {
    const original = oldSave(),
      raw = JSON.stringify(original);
    const loaded = loadGame({ getItem: () => raw });
    expect(loaded).toMatchObject({
      status: "saved",
      migratedFrom: 2,
      legacyBackup: raw,
      backupKey: "master-roller:save:v2-backup",
    });
    expect(loaded.state).toMatchObject({
      ...original,
      version: 3,
      purchases: { d4: 1, d6: 1, d8: 0 },
    });
    expect(dieCost(loaded.state, "d4")).toBe(10);
    expect(dieCost(loaded.state, "d6")).toBe(14);
    expect(validSave(loaded.state)).toBe(true);
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
        loaded.backupKey,
      ),
    ).toBe(true);
    expect(writes.map(([key]) => key)).toEqual([
      "master-roller:save:v2-backup",
      "master-roller:save",
    ]);
    expect(writes[0][1]).toBe(raw);
  });
  it("does not overwrite a version-2 save when its backup fails", () => {
    const raw = JSON.stringify(oldSave()),
      loaded = loadGame({ getItem: () => raw });
    const writes: string[] = [];
    expect(
      saveGame(
        {
          setItem: (key) => {
            writes.push(key);
            throw new Error("blocked");
          },
        },
        loaded.state,
        loaded.legacyBackup,
        loaded.backupKey,
      ),
    ).toBe(false);
    expect(writes).toEqual(["master-roller:save:v2-backup"]);
  });
  it("rejects corrupt old saves instead of migrating them", () => {
    const original = oldSave();
    const raw = JSON.stringify({
      ...original,
      lastRoll: { ...original.lastRoll, reward: 999 },
    });
    expect(loadGame({ getItem: () => raw }).status).toBe("invalid");
  });
});
