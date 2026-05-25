export type Cell = 0 | 1;

export type Maze = {
  width: number;
  height: number;
  cells: Cell[][];
  start: GridPoint;
  exit: GridPoint;
};

export type GridPoint = {
  x: number;
  y: number;
};

export type Vec2 = {
  x: number;
  z: number;
};

export type WeaponId =
  | "knife"
  | "m9"
  | "glock29"
  | "scarlm"
  | "m134"
  | "m667"
  | "barrett";

export type Weapon = {
  id: WeaponId;
  name: string;
  shortName: string;
  damage: number;
  range: number;
  fireRate: number;
  ammoCost: number;
  color: string;
};

export type ChestLoot =
  | { type: "weapon"; weaponId: WeaponId }
  | { type: "ammo"; amount: number }
  | { type: "med"; amount: number }
  | { type: "key"; amount: number };

export type Chest = {
  id: string;
  grid: GridPoint;
  opened: boolean;
  loot: ChestLoot;
};

export type MonsterKind = "skull" | "zombie";
export type MonsterVisualState = "walk" | "hit" | "attack" | "dead";

export type Monster = {
  id: string;
  kind: MonsterKind;
  grid: GridPoint;
  position: Vec2;
  hp: number;
  maxHp: number;
  speed: number;
  attackCooldown: number;
  wanderTimer: number;
  wanderAngle: number;
  visualState: MonsterVisualState;
  visualStateUntil: number;
  alive: boolean;
};

export type GameStatus = "playing" | "won" | "lost";

export type GameState = {
  maze: Maze;
  player: {
    position: Vec2;
    hp: number;
    maxHp: number;
    selectedWeapon: WeaponId;
    inventory: WeaponId[];
    ammo: Partial<Record<WeaponId, number>>;
    keyFragments: number;
  };
  chests: Chest[];
  monsters: Monster[];
  explored: boolean[][];
  status: GameStatus;
  message: string;
};
