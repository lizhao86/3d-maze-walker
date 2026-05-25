import { generateMaze, gridToWorldInMaze, manhattan, walkableCells } from "./maze";
import type { Chest, ChestLoot, GameState, GridPoint, Monster, MonsterKind, WeaponId } from "./types";
import { LOOT_WEAPONS } from "./weapons";

export const CELL_SIZE = 4;
export const REQUIRED_KEY_FRAGMENTS = 2;
const EASY_PRESSURE_SCALE = 0.75;

export function createGameState(seed = Date.now()): GameState {
  const maze = generateMaze(25, 25, seed);
  const random = mulberry32(seed + 101);
  const occupied = new Set<string>([cellKey(maze.start), cellKey(maze.exit)]);
  const candidates = walkableCells(maze).filter((cell) => manhattan(cell, maze.exit) > 3);
  const earlyMonsterCells = takeAvailableCells(
    [...getOpeningCorridorCells(maze, 4), ...getCellsByPathDistance(maze, 3, 9)],
    6,
    occupied,
  );
  const roamingMonsterCells = takeAvailableCells(
    shuffle(candidates.filter((cell) => manhattan(cell, maze.start) > 8), random),
    Math.round(17 * EASY_PRESSURE_SCALE),
    occupied,
  );
  const monsterCells = [...earlyMonsterCells, ...roamingMonsterCells];
  const chestCells = takeAvailableCells(
    shuffle(candidates.filter((cell) => manhattan(cell, maze.start) > 5), random),
    12,
    occupied,
  );
  const chests = chestCells.map((grid, index) => createChest(grid, index, random));
  const monsters = monsterCells.map((grid, index) => createMonster(maze, grid, index, random));
  const startPosition = gridToWorldInMaze(maze, maze.start, CELL_SIZE);
  const explored = createExploredMap(maze.width, maze.height);

  const state: GameState = {
    maze,
    player: {
      position: startPosition,
      hp: 100,
      maxHp: 100,
      selectedWeapon: "knife",
      inventory: ["knife", "m9"],
      ammo: {
        m9: 28,
      },
      keyFragments: 0,
    },
    chests,
    monsters,
    explored,
    status: "playing",
    message: "Find key fragments, open chests, and reach the exit.",
  };
  revealAroundPlayer(state);
  return state;
}

function takeAvailableCells(cells: GridPoint[], count: number, occupied: Set<string>): GridPoint[] {
  const selected: GridPoint[] = [];
  for (const cell of cells) {
    if (selected.length >= count) break;
    const key = cellKey(cell);
    if (occupied.has(key)) continue;
    occupied.add(key);
    selected.push(cell);
  }
  return selected;
}

function cellKey(cell: GridPoint): string {
  return `${cell.x},${cell.y}`;
}

function getCellsByPathDistance(maze: GameState["maze"], minDistance: number, maxDistance: number): GridPoint[] {
  const queue: Array<{ cell: GridPoint; distance: number }> = [{ cell: maze.start, distance: 0 }];
  const visited = new Set<string>([cellKey(maze.start)]);
  const selected: GridPoint[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    if (current.distance >= minDistance && current.distance <= maxDistance) {
      selected.push(current.cell);
    }
    if (current.distance >= maxDistance) continue;

    for (const neighbor of getOpenNeighbors(maze, current.cell)) {
      const key = cellKey(neighbor);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ cell: neighbor, distance: current.distance + 1 });
    }
  }

  return selected;
}

function getOpeningCorridorCells(maze: GameState["maze"], maxDistance: number): GridPoint[] {
  const firstStep = getOpenNeighbors(maze, maze.start)[0];
  if (!firstStep) return [];

  const direction = {
    x: firstStep.x - maze.start.x,
    y: firstStep.y - maze.start.y,
  };
  const cells: GridPoint[] = [];
  for (let distance = 2; distance <= maxDistance; distance += 1) {
    const cell = {
      x: maze.start.x + direction.x * distance,
      y: maze.start.y + direction.y * distance,
    };
    if (
      cell.x < 0 ||
      cell.y < 0 ||
      cell.x >= maze.width ||
      cell.y >= maze.height ||
      maze.cells[cell.y][cell.x] !== 0
    ) {
      break;
    }
    cells.push(cell);
  }

  return cells;
}

function getOpenNeighbors(maze: GameState["maze"], cell: GridPoint): GridPoint[] {
  return [
    { x: cell.x, y: cell.y - 1 },
    { x: cell.x + 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x - 1, y: cell.y },
  ].filter(
    (neighbor) =>
      neighbor.x >= 0 &&
      neighbor.y >= 0 &&
      neighbor.x < maze.width &&
      neighbor.y < maze.height &&
      maze.cells[neighbor.y][neighbor.x] === 0,
  );
}

export function openNearestChest(state: GameState): ChestLoot | null {
  const chest = state.chests.find((candidate) => {
    if (candidate.opened) return false;
    const chestPosition = gridToWorldInMaze(state.maze, candidate.grid, CELL_SIZE);
    return distance2D(chestPosition, state.player.position) < 2.6;
  });

  if (!chest) {
    return null;
  }

  chest.opened = true;
  applyLoot(state, chest.loot);
  return chest.loot;
}

export function getLootLabel(loot: ChestLoot): string {
  if (loot.type === "weapon") return `Weapon found: ${loot.weaponId.toUpperCase()}`;
  if (loot.type === "ammo") return `Ammo cache +${loot.amount}`;
  if (loot.type === "med") return `Med kit +${loot.amount} HP`;
  return `Key fragment ${loot.amount}/2`;
}

export function damagePlayer(state: GameState, amount: number): void {
  state.player.hp = Math.max(0, state.player.hp - amount);
  if (state.player.hp <= 0) {
    state.status = "lost";
    state.message = "Signal lost. Restart and try another route.";
  }
}

export function checkExit(state: GameState): boolean {
  const exitPosition = gridToWorldInMaze(state.maze, state.maze.exit, CELL_SIZE);
  if (distance2D(exitPosition, state.player.position) > 2.8) {
    return false;
  }
  if (state.player.keyFragments >= REQUIRED_KEY_FRAGMENTS) {
    state.status = "won";
    state.message = "Exit unlocked. You escaped the maze.";
    return true;
  }
  state.message = `Exit locked. Need ${REQUIRED_KEY_FRAGMENTS - state.player.keyFragments} more key fragment.`;
  return false;
}

function createChest(grid: GridPoint, index: number, random: () => number): Chest {
  return {
    id: `chest-${index}`,
    grid,
    opened: false,
    loot: createLoot(index, random),
  };
}

function createLoot(index: number, random: () => number): ChestLoot {
  if (index < REQUIRED_KEY_FRAGMENTS) {
    return { type: "key", amount: 1 };
  }
  const roll = random();
  if (roll < 0.45) {
    return {
      type: "weapon",
      weaponId: LOOT_WEAPONS[Math.floor(random() * LOOT_WEAPONS.length)],
    };
  }
  if (roll < 0.75) {
    return { type: "ammo", amount: 16 + Math.floor(random() * 20) };
  }
  return { type: "med", amount: 20 + Math.floor(random() * 16) };
}

function applyLoot(state: GameState, loot: ChestLoot): void {
  if (loot.type === "weapon") {
    if (!state.player.inventory.includes(loot.weaponId)) {
      state.player.inventory.push(loot.weaponId);
    }
    state.player.ammo[loot.weaponId] = (state.player.ammo[loot.weaponId] ?? 0) + 18;
    state.player.selectedWeapon = loot.weaponId;
    state.message = getLootLabel(loot);
    return;
  }
  if (loot.type === "ammo") {
    for (const weapon of state.player.inventory) {
      if (weapon !== "knife") {
        state.player.ammo[weapon] = (state.player.ammo[weapon] ?? 0) + Math.ceil(loot.amount / 2);
      }
    }
    state.message = getLootLabel(loot);
    return;
  }
  if (loot.type === "med") {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + loot.amount);
    state.message = getLootLabel(loot);
    return;
  }
  state.player.keyFragments += loot.amount;
  state.message = `Key fragment acquired: ${state.player.keyFragments}/${REQUIRED_KEY_FRAGMENTS}`;
}

function createMonster(
  maze: GameState["maze"],
  grid: GridPoint,
  index: number,
  random: () => number,
): Monster {
  const kind: MonsterKind = index % 2 === 0 ? "skull" : "zombie";
  const position = gridToWorldInMaze(maze, grid, CELL_SIZE);
  const maxHp = Math.round((kind === "skull" ? 70 : 110) * EASY_PRESSURE_SCALE);
  return {
    id: `monster-${index}`,
    kind,
    grid,
    position,
    hp: maxHp,
    maxHp,
    speed: Number(((kind === "skull" ? 2.15 : 1.25) * EASY_PRESSURE_SCALE).toFixed(2)),
    attackCooldown: 0,
    wanderTimer: 0,
    wanderAngle: random() * Math.PI * 2,
    visualState: "walk",
    visualStateUntil: 0,
    alive: true,
  };
}

export function revealAroundPlayer(state: GameState, radius = 3): void {
  const playerGrid = {
    x: Math.floor(state.player.position.x / CELL_SIZE + state.maze.width / 2),
    y: Math.floor(state.player.position.z / CELL_SIZE + state.maze.height / 2),
  };
  for (let y = playerGrid.y - radius; y <= playerGrid.y + radius; y += 1) {
    for (let x = playerGrid.x - radius; x <= playerGrid.x + radius; x += 1) {
      if (x < 0 || y < 0 || x >= state.maze.width || y >= state.maze.height) continue;
      const distance = Math.hypot(x - playerGrid.x, y - playerGrid.y);
      if (distance <= radius) {
        state.explored[y][x] = true;
      }
    }
  }
}

function createExploredMap(width: number, height: number): boolean[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => false));
}

function distance2D(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
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
