// Absolute offsets keep wins, losses and different pool sizes on the same clock.
export const ROLL_TIMING = {
  faces: 550,
  gathering: 830,
  total: 1425,
  targeting: 1875,
  impact: 2475,
  leveling: 2975,
  reward: 3275,
  crediting: 3775,
  collected: 4475,
  idle: 4695,
} as const;
export type RollPhase = "rolling" | keyof typeof ROLL_TIMING;
