import { DICE, ECONOMY, SAVE_KEY, newGame, type GameState } from "./game";

const integer = (value: unknown, min = 0): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export function validSave(value: unknown): value is GameState {
  if (
    !object(value) ||
    value.version !== 1 ||
    !integer(value.level, 1) ||
    !integer(value.balance) ||
    !object(value.inventory)
  )
    return false;
  const inventory = value.inventory;
  if (
    !DICE.every((d) => integer(inventory[d.id])) ||
    (inventory.d2 as number) < 1
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
    const die = DICE.find((d) => d.id === group.id);
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
    total === roll.total &&
    roll.won === total >= roll.level &&
    roll.reward === (roll.won ? ECONOMY.win : ECONOMY.loss) &&
    value.level === roll.level + Number(roll.won)
  );
}
export type SaveStatus = "saved" | "invalid" | "unavailable";
export function loadGame(storage: Pick<Storage, "getItem">): {
  state: GameState;
  status: SaveStatus;
} {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { state: newGame(), status: "saved" };
    const parsed: unknown = JSON.parse(raw);
    return validSave(parsed)
      ? { state: parsed, status: "saved" }
      : { state: newGame(), status: "invalid" };
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
): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
