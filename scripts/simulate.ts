import {
  buyDie,
  buySlot,
  DICE,
  dieCost,
  ECONOMY,
  newGame,
  poolStats,
  rollGame,
  slotCost,
} from "../src/game";
import { analyzeEconomy, defaultPrices, seededRandom } from "../src/economy";

type Strategy = "d4-only" | "next-die";
const ROLL_LIMIT = 10_000;
function simulate(seed: number, strategy: Strategy) {
  let game = newGame(),
    rolls = 0,
    losses = 0,
    purchases = 0,
    slotsBought = 0;
  const random = seededRandom(seed);
  while (game.level <= 100 && rolls < ROLL_LIMIT) {
    game = rollGame(game, random);
    rolls++;
    if (!game.lastRoll!.won) losses++;
    const next =
      strategy === "d4-only"
        ? DICE[0]
        : (DICE.find((die) => game.inventory[die.id] === 0) ?? DICE.at(-1)!);
    const slotNeeded = poolStats(game).count >= game.slots;
    if (
      game.balance >=
      dieCost(game, next.id) + (slotNeeded ? slotCost(game.slots) : 0)
    ) {
      if (slotNeeded) {
        game = buySlot(game);
        slotsBought++;
      }
      game = buyDie(game, next.id);
      purchases++;
    }
  }
  return {
    cleared: game.level > 100,
    level: game.level,
    max: poolStats(game).max,
    rolls,
    losses,
    purchases,
    slotsBought,
    dice: poolStats(game).count,
  };
}
console.log(
  `Progression through level 100. Paid dice prices double by type; slots start at ${ECONOMY.slotPrice} and double. Roll-total earnings; no merges or test purchases. 100 seeds per strategy.`,
);
for (const strategy of ["d4-only", "next-die"] as const) {
  const runs = Array.from({ length: 100 }, (_, index) =>
    simulate(index + 1, strategy),
  );
  const reached = runs.filter((run) => run.cleared);
  const mean = (
    sample: typeof runs,
    key:
      | "rolls"
      | "losses"
      | "purchases"
      | "slotsBought"
      | "dice"
      | "level"
      | "max",
  ) =>
    sample.length
      ? Math.round(
          (sample.reduce((sum, run) => sum + run[key], 0) / sample.length) * 10,
        ) / 10
      : null;
  console.log(
    JSON.stringify({
      strategy,
      seeds: runs.length,
      clearedLevel100: reached.length,
      capped: runs.length - reached.length,
      rollLimit: ROLL_LIMIT,
      averageRollsWhenCleared: mean(reached, "rolls"),
      averageLossesWhenCleared: mean(reached, "losses"),
      averagePurchasesWhenCleared: mean(reached, "purchases"),
      averageSlotsBoughtWhenCleared: mean(reached, "slotsBought"),
      averageDiceAtEnd: mean(runs, "dice"),
      averageLevelAtEnd: mean(runs, "level"),
      averagePoolMaxAtEnd: mean(runs, "max"),
      maxRolls: Math.max(...runs.map((run) => run.rolls)),
    }),
  );
}
console.log(
  "Upgrade affordability: one of each next die, including its slot, no merges, 200 seeds.",
);
console.log(JSON.stringify(analyzeEconomy(defaultPrices()).upgrades));
