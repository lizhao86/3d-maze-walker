import { describe, expect, it } from "vitest";
import { CELL_SIZE, createGameState, revealAroundPlayer } from "./gameState";
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

  it("uses the easier 75 percent monster pressure tuning", () => {
    const state = createGameState(12345);
    const skull = state.monsters.find((monster) => monster.kind === "skull");
    const zombie = state.monsters.find((monster) => monster.kind === "zombie");

    expect(state.monsters.length).toBe(19);
    expect(skull?.maxHp).toBe(53);
    expect(skull?.speed).toBeCloseTo(1.61);
    expect(zombie?.maxHp).toBe(83);
    expect(zombie?.speed).toBeCloseTo(0.94);
  });

  it("tracks explored cells for minimap fog of war", () => {
    const state = createGameState(12345);
    const initialExploredCount = countExplored(state.explored);

    state.player.position.x += CELL_SIZE * 4;
    revealAroundPlayer(state);

    expect(initialExploredCount).toBeGreaterThan(0);
    expect(initialExploredCount).toBeLessThan(state.maze.width * state.maze.height);
    expect(countExplored(state.explored)).toBeGreaterThan(initialExploredCount);
  });
});

function countExplored(explored: boolean[][]): number {
  return explored.flat().filter(Boolean).length;
}
