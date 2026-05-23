import { describe, expect, it } from "vitest";
import { generateMaze, isWall, manhattan } from "./maze";

describe("generateMaze", () => {
  it("creates odd dimensions and walkable start and exit cells", () => {
    const maze = generateMaze(24, 24, 7);

    expect(maze.width % 2).toBe(1);
    expect(maze.height % 2).toBe(1);
    expect(isWall(maze, maze.start.x, maze.start.y)).toBe(false);
    expect(isWall(maze, maze.exit.x, maze.exit.y)).toBe(false);
  });

  it("puts the exit far away from the starting cell", () => {
    const maze = generateMaze(25, 25, 19);

    expect(manhattan(maze.start, maze.exit)).toBeGreaterThan(30);
  });
});
