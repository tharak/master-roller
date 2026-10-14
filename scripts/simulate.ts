import {
  buyDie,
  buySlot,
  DICE,
  ECONOMY,
  newGame,
  poolStats,
  rollGame,
} from "../src/game";
import { analyzeEconomy, defaultPrices, seededRandom } from "../src/economy";

type Strategy = "d4-only" | "next-die";
function simulate(seed: number, strategy: Strategy) {
  let game = newGame(),
    rolls = 0,
    losses = 0,
    purchases = 0,
    slotsBought = 0;
  const random = seededRandom(seed);
  while (game.level <= 100 && rolls < 100_000) {
    game = rollGame(game, random);
    rolls++;
    if (!game.lastRoll!.won) losses++;
    const next =
      strategy === "d4-only"
        ? DICE[0]
        : (DICE.find((die) => game.inventory[die.id] === 0) ?? DICE.at(-1)!);
    const slotNeeded = poolStats(game).count >= game.slots;
    if (game.balance >= next.price + (slotNeeded ? ECONOMY.slotPrice : 0)) {
      if (slotNeeded) {
        game = buySlot(game);
        slotsBought++;
      }
      game = buyDie(game, next.id);
      purchases++;
    }
  }
  if (game.level <= 100)
    throw new Error(`${strategy}, seed ${seed}: did not clear level 100.`);
  return { rolls, losses, purchases, slotsBought, dice: poolStats(game).count };
}
console.log(
  "Progression through level 100. Roll-total earnings, fixed live prices, 50-coin slots; no test purchases. 100 seeds per strategy.",
);
for (const strategy of ["d4-only", "next-die"] as const) {
  const runs = Array.from({ length: 100 }, (_, index) =>
    simulate(index + 1, strategy),
  );
  const mean = (key: keyof (typeof runs)[number]) =>
    Math.round(
      (runs.reduce((sum, run) => sum + run[key], 0) / runs.length) * 10,
    ) / 10;
  console.log(
    JSON.stringify({
      strategy,
      seeds: runs.length,
      averageRolls: mean("rolls"),
      averageLosses: mean("losses"),
      averagePurchases: mean("purchases"),
      averageSlotsBought: mean("slotsBought"),
      averageDice: mean("dice"),
      maxRolls: Math.max(...runs.map((run) => run.rolls)),
    }),
  );
}
console.log(
  "Upgrade affordability: one of each next die, including its slot, 200 seeds.",
);
console.log(JSON.stringify(analyzeEconomy(defaultPrices()).upgrades));
