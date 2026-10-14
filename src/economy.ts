import {
  DICE,
  ECONOMY,
  newGame,
  poolStats,
  rollGame,
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
      const cost = prices.dice[next.id] + prices.slot;
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
    const cost = prices.dice[die.id] + prices.slot;
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
