export const DICE = [
  {
    id: "d4",
    min: 1,
    max: 4,
    price: 5,
    name: "Small but mighty",
    color: "blue",
  },
  { id: "d6", min: 1, max: 6, price: 7, name: "The classic", color: "lilac" },
  {
    id: "d8",
    min: 1,
    max: 8,
    price: 9,
    name: "Raise the stakes",
    color: "pink",
  },
  {
    id: "d10",
    min: 1,
    max: 10,
    price: 11,
    name: "Double digits",
    color: "peach",
  },
  {
    id: "d12",
    min: 1,
    max: 12,
    price: 13,
    name: "A dozen reasons",
    color: "yellow",
  },
  {
    id: "d20",
    min: 1,
    max: 20,
    price: 21,
    name: "Feeling heroic",
    color: "cyan",
  },
  {
    id: "d100",
    min: 1,
    max: 100,
    price: 101,
    name: "Go big",
    color: "orange",
  },
] as const;
export type DieId = (typeof DICE)[number]["id"];
export const ECONOMY = { slotPrice: 3, coinPack: 10_000 } as const;
// The starting slot is free; extra slots cost 1×, 2×, 3×… the base price.
export function slotCost(
  ownedSlots: number,
  basePrice: number = ECONOMY.slotPrice,
) {
  return ownedSlots * basePrice;
}
// Compatibility baseline for untouched drafts saved before the pricing update.
export const LEGACY_DRAFT_DEFAULTS = {
  dice: { d4: 50, d6: 70, d8: 90, d10: 110, d12: 130, d20: 210, d100: 1010 },
  slot: 50,
} as const;
export const LEGACY_DICE = [
  { id: "d2", min: 0, max: 1 },
  { id: "d3", min: 1, max: 3 },
] as const;
export const LEGACY_REWARDS = { win: 20, loss: 10 } as const;
export const SAVE_KEY = "master-roller:save";
export const LEGACY_SAVE_KEY = "master-roller:save:v1-backup";
export interface RollResult {
  level: number;
  dice: { id: DieId; values: number[] }[];
  total: number;
  won: boolean;
  reward: number;
}
export interface GameState {
  version: 2;
  slots: number;
  level: number;
  balance: number;
  inventory: Record<DieId, number>;
  lastRoll: RollResult | null;
}
export function newGame(): GameState {
  const inventory = Object.fromEntries(
    DICE.map((die) => [die.id, die.id === "d4" ? 1 : 0]),
  ) as GameState["inventory"];
  return {
    version: 2,
    slots: 1,
    level: 1,
    balance: 0,
    inventory,
    lastRoll: null,
  };
}
export function rollGame(
  state: GameState,
  random: () => number = Math.random,
): GameState {
  const dice = DICE.filter((die) => state.inventory[die.id] > 0).map((die) => ({
    id: die.id,
    values: Array.from({ length: state.inventory[die.id] }, () => {
      const value = random();
      if (!Number.isFinite(value) || value < 0 || value >= 1)
        throw new Error("Random value must be in [0, 1).");
      return die.min + Math.floor(value * (die.max - die.min + 1));
    }),
  }));
  const total = dice.reduce(
    (sum, group) => sum + group.values.reduce((a, b) => a + b, 0),
    0,
  );
  const won = total >= state.level;
  const reward = total;
  return {
    ...state,
    level: state.level + Number(won),
    balance: state.balance + reward,
    lastRoll: { level: state.level, dice, total, won, reward },
  };
}
export function buyDie(state: GameState, id: DieId): GameState {
  const die = DICE.find((d) => d.id === id);
  if (
    !die ||
    state.balance < die.price ||
    poolStats(state).count >= state.slots
  )
    return state;
  return {
    ...state,
    balance: state.balance - die.price,
    inventory: { ...state.inventory, [id]: state.inventory[id] + 1 },
  };
}
export function buySlot(state: GameState): GameState {
  const cost = slotCost(state.slots);
  if (
    !Number.isSafeInteger(cost) ||
    state.balance < cost ||
    !Number.isSafeInteger(state.slots + 1)
  )
    return state;
  return {
    ...state,
    balance: state.balance - cost,
    slots: state.slots + 1,
  };
}
export type TestOffer = DieId | "coins";
export function simulatePurchase(
  state: GameState,
  offer: TestOffer,
): GameState {
  if (offer === "coins")
    return { ...state, balance: state.balance + ECONOMY.coinPack };
  if (
    !DICE.some((d) => d.id === offer) ||
    poolStats(state).count >= state.slots
  )
    return state;
  return {
    ...state,
    inventory: { ...state.inventory, [offer]: state.inventory[offer] + 1 },
  };
}
export function poolStats(state: GameState) {
  return DICE.reduce(
    (stats, d) => ({
      count: stats.count + state.inventory[d.id],
      min: stats.min + d.min * state.inventory[d.id],
      max: stats.max + d.max * state.inventory[d.id],
    }),
    { count: 0, min: 0, max: 0 },
  );
}
