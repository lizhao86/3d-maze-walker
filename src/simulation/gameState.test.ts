import { describe, expect, it } from "vitest";
import { createGameState } from "./gameState";
import { manhattan } from "./maze";

describe("createGameState", () => {
  it("spawns enough monsters and puts early encounters near the start", () => {
    const state = createGameState(12345);
    const nearestMonsterDistance = Math.min(
      ...state.monsters.map((monster) => manhattan(monster.grid, state.maze.start)),
    );

    expect(state.monsters.length).toBeGreaterThanOrEqual(18);
    expect(nearestMonsterDistance).toBeLessThanOrEqual(2);
  });
});
