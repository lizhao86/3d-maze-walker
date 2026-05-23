import type { Cell, GridPoint, Maze } from "./types";

const WALL = 1;
const FLOOR = 0;

export function generateMaze(width = 25, height = 25, seed = Date.now()): Maze {
  const safeWidth = width % 2 === 0 ? width + 1 : width;
  const safeHeight = height % 2 === 0 ? height + 1 : height;
  const random = mulberry32(seed);
  const cells: Cell[][] = Array.from({ length: safeHeight }, () =>
    Array.from({ length: safeWidth }, () => WALL),
  );
  const start = { x: 1, y: 1 };
  const stack: GridPoint[] = [start];
  cells[start.y][start.x] = FLOOR;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const directions = shuffle(
      [
        { x: 0, y: -2 },
        { x: 2, y: 0 },
        { x: 0, y: 2 },
        { x: -2, y: 0 },
      ],
      random,
    );
    const next = directions
      .map((direction) => ({
        x: current.x + direction.x,
        y: current.y + direction.y,
        wallX: current.x + direction.x / 2,
        wallY: current.y + direction.y / 2,
      }))
      .find(
        (candidate) =>
          candidate.x > 0 &&
          candidate.y > 0 &&
          candidate.x < safeWidth - 1 &&
          candidate.y < safeHeight - 1 &&
          cells[candidate.y][candidate.x] === WALL,
      );

    if (!next) {
      stack.pop();
      continue;
    }

    cells[next.wallY][next.wallX] = FLOOR;
    cells[next.y][next.x] = FLOOR;
    stack.push({ x: next.x, y: next.y });
  }

  const exit = findFarthestFloor(cells, start);
  cells[exit.y][exit.x] = FLOOR;

  return {
    width: safeWidth,
    height: safeHeight,
    cells,
    start,
    exit,
  };
}

export function isWall(maze: Maze, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= maze.width || y >= maze.height) {
    return true;
  }
  return maze.cells[y][x] === WALL;
}

export function gridToWorld(point: GridPoint, cellSize: number): { x: number; z: number } {
  return {
    x: (point.x - mazeCenterOffset(point.x, cellSize)) * cellSize,
    z: (point.y - mazeCenterOffset(point.y, cellSize)) * cellSize,
  };
}

export function gridToWorldInMaze(
  maze: Maze,
  point: GridPoint,
  cellSize: number,
): { x: number; z: number } {
  return {
    x: (point.x - maze.width / 2 + 0.5) * cellSize,
    z: (point.y - maze.height / 2 + 0.5) * cellSize,
  };
}

export function worldToGrid(
  maze: Maze,
  position: { x: number; z: number },
  cellSize: number,
): GridPoint {
  return {
    x: Math.floor(position.x / cellSize + maze.width / 2),
    y: Math.floor(position.z / cellSize + maze.height / 2),
  };
}

export function walkableCells(maze: Maze): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let y = 1; y < maze.height - 1; y += 1) {
    for (let x = 1; x < maze.width - 1; x += 1) {
      if (!isWall(maze, x, y)) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

export function manhattan(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function findFarthestFloor(cells: number[][], start: GridPoint): GridPoint {
  let farthest = start;
  let distance = -1;
  for (let y = 1; y < cells.length - 1; y += 1) {
    for (let x = 1; x < cells[0].length - 1; x += 1) {
      if (cells[y][x] === FLOOR) {
        const currentDistance = Math.abs(start.x - x) + Math.abs(start.y - y);
        if (currentDistance > distance) {
          distance = currentDistance;
          farthest = { x, y };
        }
      }
    }
  }
  return farthest;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function mazeCenterOffset(_coordinate: number, _cellSize: number): number {
  return 0;
}
