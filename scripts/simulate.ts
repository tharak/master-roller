import {
  buyDie,
  DICE,
  newGame,
  poolStats,
  rollGame,
  type GameState,
} from "../src/game";

function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
type Strategy = "d2-only" | "save-for-d20";
function simulate(seed: number, strategy: Strategy) {
  let game: GameState = newGame();
  let rolls = 0,
    losses = 0,
    purchases = 0;
  const random = seededRandom(seed);
  while (game.level <= 100 && rolls < 100_000) {
    game = rollGame(game, random);
    rolls++;
    if (!game.lastRoll!.won) losses++;
    // No test purchases. Compare immediate d2 spending against saving for d20,
    // buying a fallback d2 only when the next level is otherwise unreachable.
    if (strategy === "d2-only") {
      while (game.balance >= DICE[0].price) {
        game = buyDie(game, "d2");
        purchases++;
      }
    } else {
      while (game.balance >= DICE[7].price) {
        game = buyDie(game, "d20");
        purchases++;
      }
      if (poolStats(game).max < game.level && game.balance >= DICE[0].price) {
        game = buyDie(game, "d2");
        purchases++;
      }
    }
  }
  if (game.level <= 100)
    throw new Error(`${strategy}, seed ${seed}: did not clear level 100.`);
  return { rolls, losses, purchases, dice: poolStats(game).count };
}
console.log(
  "Progression through level 100. Fixed prices; no test purchases. 100 seeds per strategy.",
);
for (const strategy of ["d2-only", "save-for-d20"] as const) {
  const runs = Array.from({ length: 100 }, (_, i) => simulate(i + 1, strategy));
  const mean = (key: keyof (typeof runs)[number]) =>
    Math.round((runs.reduce((sum, r) => sum + r[key], 0) / runs.length) * 10) /
    10;
  console.log(
    JSON.stringify({
      strategy,
      seeds: runs.length,
      averageRolls: mean("rolls"),
      averageLosses: mean("losses"),
      averagePurchases: mean("purchases"),
      averageDice: mean("dice"),
      maxRolls: Math.max(...runs.map((r) => r.rolls)),
    }),
  );
}
