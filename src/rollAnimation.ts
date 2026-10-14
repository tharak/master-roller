// Absolute offsets keep wins, losses and different pool sizes on the same clock.
export const ROLL_TIMING = {
  faces: 120,
  gathering: 200,
  total: 360,
  targeting: 450,
  impact: 600,
  leveling: 700,
  reward: 760,
  crediting: 820,
  collected: 970,
  idle: 1000,
} as const;
export type RollPhase = "rolling" | keyof typeof ROLL_TIMING;
