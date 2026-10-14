export const DICE = [
  { id: "d2", min: 0, max: 1, price: 10, name: "The beginner", color: "lime" },
  {
    id: "d3",
    min: 1,
    max: 3,
    price: 40,
    name: "A little extra",
    color: "mint",
  },
  {
    id: "d4",
    min: 1,
    max: 4,
    price: 50,
    name: "Small but mighty",
    color: "blue",
  },
  { id: "d6", min: 1, max: 6, price: 70, name: "The classic", color: "lilac" },
  {
    id: "d8",
    min: 1,
    max: 8,
    price: 90,
    name: "Raise the stakes",
    color: "pink",
  },
  {
    id: "d10",
    min: 1,
    max: 10,
    price: 110,
    name: "Double digits",
    color: "peach",
  },
  {
    id: "d12",
    min: 1,
    max: 12,
    price: 130,
    name: "A dozen reasons",
    color: "yellow",
  },
  {
    id: "d20",
    min: 1,
    max: 20,
    price: 210,
    name: "Feeling heroic",
    color: "cyan",
  },
  {
    id: "d100",
    min: 1,
    max: 100,
    price: 1010,
    name: "Go big",
    color: "orange",
  },
] as const;
export type DieId = (typeof DICE)[number]["id"];
export const ECONOMY = { loss: 10, win: 20, coinPack: 10_000 } as const;
export const SAVE_KEY = "master-roller:save";
export interface RollResult {
  level: number;
  dice: { id: DieId; values: number[] }[];
  total: number;
  won: boolean;
  reward: number;
}
export interface GameState {
  version: 1;
  level: number;
  balance: number;
  inventory: Record<DieId, number>;
  lastRoll: RollResult | null;
}
export function newGame(): GameState {
  const inventory = Object.fromEntries(
    DICE.map((die) => [die.id, die.id === "d2" ? 1 : 0]),
  ) as GameState["inventory"];
  return { version: 1, level: 1, balance: 0, inventory, lastRoll: null };
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
  const reward = won ? ECONOMY.win : ECONOMY.loss;
  return {
    ...state,
    level: state.level + Number(won),
    balance: state.balance + reward,
    lastRoll: { level: state.level, dice, total, won, reward },
  };
}
export function buyDie(state: GameState, id: DieId): GameState {
  const die = DICE.find((d) => d.id === id);
  if (!die || state.balance < die.price) return state;
  return {
    ...state,
    balance: state.balance - die.price,
    inventory: { ...state.inventory, [id]: state.inventory[id] + 1 },
  };
}
export type TestOffer = DieId | "coins";
export function simulatePurchase(
  state: GameState,
  offer: TestOffer,
): GameState {
  if (offer === "coins")
    return { ...state, balance: state.balance + ECONOMY.coinPack };
  if (!DICE.some((d) => d.id === offer)) return state;
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
