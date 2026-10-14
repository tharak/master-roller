import {
  DICE,
  LEGACY_DICE,
  LEGACY_REWARDS,
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  V2_SAVE_KEY,
  newGame,
  type GameState,
} from "./game";

const integer = (value: unknown, min = 0): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function validState(
  value: unknown,
  version: 1 | 2 | 3,
): value is Record<string, unknown> & {
  inventory: Record<string, number>;
  level: number;
  balance: number;
} {
  const legacy = version === 1;
  if (
    !object(value) ||
    value.version !== version ||
    !integer(value.level, 1) ||
    !integer(value.balance) ||
    !object(value.inventory)
  )
    return false;
  if (
    version === 3 &&
    (!object(value.purchases) ||
      !DICE.every((die) =>
        integer((value.purchases as Record<string, unknown>)[die.id]),
      ))
  )
    return false;
  const definitions = legacy ? [...LEGACY_DICE, ...DICE] : DICE;
  const inventory = value.inventory;
  if (
    !definitions.every((die) => integer(inventory[die.id])) ||
    !integer(inventory[legacy ? "d2" : "d4"], legacy ? 1 : 0)
  )
    return false;
  const count = definitions.reduce(
    (sum, die) => sum + (inventory[die.id] as number),
    0,
  );
  if (
    !integer(count, 1) ||
    (!legacy &&
      (!integer(value.slots, count) || "d2" in inventory || "d3" in inventory))
  )
    return false;
  if (value.lastRoll === null) return true;
  const roll = value.lastRoll;
  if (
    !object(roll) ||
    !integer(roll.level, 1) ||
    !integer(roll.total) ||
    typeof roll.won !== "boolean" ||
    !Array.isArray(roll.dice) ||
    roll.dice.length === 0
  )
    return false;
  const seen = new Set<string>();
  let total = 0;
  for (const group of roll.dice) {
    if (!object(group)) return false;
    const die = definitions.find((d) => d.id === group.id);
    if (
      !die ||
      seen.has(die.id) ||
      !Array.isArray(group.values) ||
      group.values.length === 0 ||
      group.values.length > (inventory[die.id] as number)
    )
      return false;
    seen.add(die.id);
    for (const face of group.values) {
      if (!integer(face, die.min) || face > die.max) return false;
      total += face;
    }
  }
  return (
    Number.isSafeInteger(total) &&
    total === roll.total &&
    roll.won === total >= roll.level &&
    roll.reward ===
      (legacy
        ? roll.won
          ? LEGACY_REWARDS.win
          : LEGACY_REWARDS.loss
        : total) &&
    value.level === roll.level + Number(roll.won)
  );
}
export function validSave(value: unknown): value is GameState {
  return validState(value, 3);
}
export type SaveStatus = "saved" | "invalid" | "unavailable";
export function loadGame(storage: Pick<Storage, "getItem">): {
  state: GameState;
  status: SaveStatus;
  legacyBackup?: string;
  backupKey?: string;
  migratedFrom?: 1 | 2;
} {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { state: newGame(), status: "saved" };
    const parsed: unknown = JSON.parse(raw);
    if (validSave(parsed)) return { state: parsed, status: "saved" };
    if (validState(parsed, 1) || validState(parsed, 2)) {
      const version = parsed.version as 1 | 2;
      const inventory = Object.fromEntries(
        DICE.map((die) => [die.id, parsed.inventory[die.id]]),
      ) as GameState["inventory"];
      if (version === 1)
        inventory.d4 += parsed.inventory.d2 + parsed.inventory.d3;
      const slots =
        version === 2
          ? (parsed.slots as number)
          : Object.values(inventory).reduce((sum, count) => sum + count, 0);
      if (!integer(slots, 1)) return { state: newGame(), status: "invalid" };
      return {
        state: {
          version: 3,
          slots,
          inventory,
          level: parsed.level,
          balance: parsed.balance,
          lastRoll:
            version === 1 ? null : (parsed.lastRoll as GameState["lastRoll"]),
          // Earlier saves did not record purchases or consumed merge inputs.
          purchases: Object.fromEntries(
            DICE.map((die) => [
              die.id,
              Math.max(0, inventory[die.id] - Number(die.id === "d4")),
            ]),
          ) as GameState["purchases"],
        },
        status: "saved",
        legacyBackup: raw,
        backupKey: version === 1 ? LEGACY_SAVE_KEY : V2_SAVE_KEY,
        migratedFrom: version,
      };
    }
    return { state: newGame(), status: "invalid" };
  } catch (error) {
    return {
      state: newGame(),
      status: error instanceof SyntaxError ? "invalid" : "unavailable",
    };
  }
}
export function saveGame(
  storage: Pick<Storage, "setItem">,
  state: GameState,
  legacyBackup?: string,
  backupKey: string = LEGACY_SAVE_KEY,
): boolean {
  try {
    // A failed backup prevents replacing the legacy save.
    if (legacyBackup !== undefined) storage.setItem(backupKey, legacyBackup);
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
