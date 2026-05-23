import type { Maze } from "./types";

export type MovementInput = {
  yaw: number;
  inputX: number;
  inputZ: number;
  speed: number;
  delta: number;
};

export function getMovementDelta(input: MovementInput): { x: number; z: number } {
  const forward = {
    x: -Math.sin(input.yaw),
    z: -Math.cos(input.yaw),
  };
  const right = {
    x: Math.cos(input.yaw),
    z: -Math.sin(input.yaw),
  };

  const distance = input.speed * input.delta;
  return {
    x: (right.x * input.inputX - forward.x * input.inputZ) * distance,
    z: (right.z * input.inputX - forward.z * input.inputZ) * distance,
  };
}

export function getYawTowardOpenNeighbor(maze: Maze): number {
  const { start } = maze;
  const neighbors = [
    { x: start.x, y: start.y - 1, yaw: 0 },
    { x: start.x + 1, y: start.y, yaw: -Math.PI / 2 },
    { x: start.x, y: start.y + 1, yaw: Math.PI },
    { x: start.x - 1, y: start.y, yaw: Math.PI / 2 },
  ];
  const openNeighbor = neighbors.find(
    (neighbor) =>
      neighbor.x >= 0 &&
      neighbor.y >= 0 &&
      neighbor.x < maze.width &&
      neighbor.y < maze.height &&
      maze.cells[neighbor.y][neighbor.x] === 0,
  );

  return openNeighbor?.yaw ?? Math.PI;
}
