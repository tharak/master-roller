import {
  DICE,
  ECONOMY,
  dieCost,
  exponentialCost,
  LEGACY_DRAFT_DEFAULTS,
  newGame,
  poolStats,
  rollGame,
  slotCost,
  type DieId,
  type GameState,
} from "./game";

export interface DraftPrices {
  dice: Record<DieId, number>;
  slot: number;
}
export const defaultPrices = (): DraftPrices => ({
  dice: Object.fromEntries(DICE.map((d) => [d.id, d.price])) as Record<
    DieId,
    number
  >,
  slot: ECONOMY.slotPrice,
});
export function validPrices(value: unknown): value is DraftPrices {
  const draft = value as DraftPrices | null;
  const valid = (n: unknown) =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= 20_000;
  return Boolean(
    draft &&
    typeof draft === "object" &&
    draft.dice &&
    valid(draft.slot) &&
    DICE.every((die) => valid(draft.dice[die.id])),
  );
}
export const DRAFT_KEY = "master-roller:economy-draft:v2";
export const LEGACY_DRAFT_KEY = "master-roller:economy-draft:v1";
export function loadDraftPrices(
  storage: Pick<Storage, "getItem">,
): DraftPrices {
  try {
    const current = storage.getItem(DRAFT_KEY);
    if (current !== null) {
      const parsed: unknown = JSON.parse(current);
      return validPrices(parsed) ? parsed : defaultPrices();
    }
    const legacy: unknown = JSON.parse(
      storage.getItem(LEGACY_DRAFT_KEY) ?? "null",
    );
    if (!validPrices(legacy)) return defaultPrices();
    const untouched =
      legacy.slot === LEGACY_DRAFT_DEFAULTS.slot &&
      DICE.every(
        (die) => legacy.dice[die.id] === LEGACY_DRAFT_DEFAULTS.dice[die.id],
      );
    return untouched ? defaultPrices() : legacy;
  } catch {
    return defaultPrices();
  }
}

export function poolLabel(ids: readonly DieId[]): string {
  return DICE.flatMap((die) => {
    const count = ids.filter((id) => id === die.id).length;
    return count ? [`${count}${die.id}`] : [];
  }).join(" + ");
}
export function comparePool(ids: readonly DieId[], prices: DraftPrices) {
  const copies = new Map<DieId, number>();
  return ids.reduce(
    (stats, id) => {
      const die = DICE.find((d) => d.id === id)!;
      const bought = copies.get(id) ?? 0;
      copies.set(id, bought + 1);
      return {
        slots: stats.slots + 1,
        min: stats.min + die.min,
        max: stats.max + die.max,
        mean: stats.mean + (die.min + die.max) / 2,
        diceCost: stats.diceCost + exponentialCost(prices.dice[id], bought),
      };
    },
    { slots: 0, min: 0, max: 0, mean: 0, diceCost: 0 },
  );
}
export function minimumWinningIncome(
  ids: readonly DieId[],
  from: number,
  through: number,
): number {
  const stats = comparePool(ids, defaultPrices());
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(through) ||
    from < 1 ||
    through < from ||
    through > stats.max
  )
    throw new RangeError(
      "The pool must be able to clear the requested levels.",
    );
  let income = 0;
  for (let level = from; level <= through; level++)
    income += Math.max(level, stats.min);
  return income;
}
export interface BudgetChoice {
  pool: DieId[];
  through: number;
  wallet: number | null;
  addition: DieId[];
  cost: number;
  result: DieId[];
  affordable: boolean | null;
}
export function earlyUpgradeChoices(prices: DraftPrices): BudgetChoice[] {
  const starter: DieId[] = ["d4"],
    second: DieId[] = ["d4", "d6"];
  const firstWallet = minimumWinningIncome(starter, 1, 4);
  const firstUpgrade = prices.dice.d6 + slotCost(1, prices.slot);
  const secondWallet =
    firstUpgrade <= firstWallet
      ? firstWallet - firstUpgrade + minimumWinningIncome(second, 5, 10)
      : null;
  return [
    {
      pool: starter,
      through: 4,
      wallet: firstWallet,
      addition: ["d4"] as DieId[],
    },
    {
      pool: starter,
      through: 4,
      wallet: firstWallet,
      addition: ["d6"] as DieId[],
    },
    {
      pool: second,
      through: 10,
      wallet: secondWallet,
      addition: ["d8"] as DieId[],
    },
    {
      pool: second,
      through: 10,
      wallet: secondWallet,
      addition: ["d4", "d4"] as DieId[],
    },
  ].map((choice) => {
    const cost =
      comparePool(choice.addition, prices).diceCost +
      choice.addition.reduce(
        (total, _, index) =>
          total + slotCost(choice.pool.length + index, prices.slot),
        0,
      );
    return {
      ...choice,
      cost,
      result: [...choice.pool, ...choice.addition],
      affordable: choice.wallet === null ? null : cost <= choice.wallet,
    };
  });
}
export function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function distribution(ids: readonly DieId[]): number[] {
  let values = [1];
  for (const id of ids) {
    const die = DICE.find((d) => d.id === id)!;
    const next = Array(values.length + die.max).fill(0) as number[];
    for (let sum = 0; sum < values.length; sum++) {
      for (let face = die.min; face <= die.max; face++)
        next[sum + face] += values[sum] / (die.max - die.min + 1);
    }
    values = next;
  }
  return values;
}
export interface PurchaseEvent {
  id: DieId;
  roll: number;
  level: number;
  earned: number;
  spent: number;
  blockedRolls: number;
}
export interface TracePoint {
  roll: number;
  earned: number;
  level: number;
}
export interface UpgradeRun {
  seed: number;
  events: PurchaseEvent[];
  trace: TracePoint[];
}
export function upgradeRun(
  prices: DraftPrices,
  seed: number,
  rollLimit = 2000,
): UpgradeRun {
  if (!validPrices(prices)) throw new Error("Invalid draft prices.");
  let game: GameState = newGame();
  let stage = 0,
    earned = 0,
    spent = 0,
    blockedRolls = 0;
  const random = seededRandom(seed);
  const events: PurchaseEvent[] = [],
    trace: TracePoint[] = [{ roll: 0, earned: 0, level: 1 }];
  for (let roll = 0; roll <= rollLimit; roll++) {
    // Reserve enough for both the next die and its slot. All existing dice keep rolling.
    while (stage < DICE.length - 1) {
      const next = DICE[stage + 1];
      const cost =
        dieCost(game, next.id, prices.dice[next.id]) +
        slotCost(game.slots, prices.slot);
      if (game.balance < cost) break;
      spent += cost;
      game = {
        ...game,
        balance: game.balance - cost,
        slots: game.slots + 1,
        inventory: {
          ...game.inventory,
          [next.id]: game.inventory[next.id] + 1,
        },
        purchases: {
          ...game.purchases,
          [next.id]: game.purchases[next.id] + 1,
        },
      };
      events.push({
        id: next.id,
        roll,
        level: game.level,
        earned,
        spent,
        blockedRolls,
      });
      blockedRolls = 0;
      stage++;
    }
    if (stage === DICE.length - 1 || roll === rollLimit) break;
    if (game.level > poolStats(game).max) blockedRolls++;
    game = rollGame(game, random);
    earned += game.lastRoll!.reward;
    trace.push({ roll: roll + 1, earned, level: game.level });
  }
  return { seed, events, trace };
}
const quantile = (values: number[], fraction: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length
    ? sorted[Math.floor((sorted.length - 1) * fraction)]
    : null;
};
export interface UpgradeSummary {
  id: DieId;
  cost: number;
  cumulativeCost: number;
  reached: number;
  medianRoll: number | null;
  lowRoll: number | null;
  highRoll: number | null;
  medianLevel: number | null;
  medianBlockedRolls: number | null;
}
export interface EconomyReport {
  seeds: number;
  rollLimit: number;
  upgrades: UpgradeSummary[];
  example: UpgradeRun;
}
export function analyzeEconomy(
  prices: DraftPrices,
  seeds = 200,
  rollLimit = 2000,
): EconomyReport {
  const runs = Array.from({ length: seeds }, (_, index) =>
    upgradeRun(prices, index + 1, rollLimit),
  );
  let cumulativeCost = 0;
  const upgrades = DICE.slice(1).map((die, index) => {
    const cost = prices.dice[die.id] + slotCost(index + 1, prices.slot);
    cumulativeCost += cost;
    const events = runs.flatMap((run) =>
      run.events[index] ? [run.events[index]] : [],
    );
    return {
      id: die.id,
      cost,
      cumulativeCost,
      reached: events.length,
      medianRoll: quantile(
        events.map((e) => e.roll),
        0.5,
      ),
      lowRoll: quantile(
        events.map((e) => e.roll),
        0.1,
      ),
      highRoll: quantile(
        events.map((e) => e.roll),
        0.9,
      ),
      medianLevel: quantile(
        events.map((e) => e.level),
        0.5,
      ),
      medianBlockedRolls: quantile(
        events.map((e) => e.blockedRolls),
        0.5,
      ),
    };
  });
  const sorted = [...runs].sort((a, b) => a.trace.length - b.trace.length);
  return {
    seeds,
    rollLimit,
    upgrades,
    example: sorted[Math.floor((sorted.length - 1) / 2)],
  };
}
