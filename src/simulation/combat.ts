import type { Monster, Vec2, Weapon } from "./types";

type WeaponAttackInput = {
  weapon: Weapon;
  playerPosition: Vec2;
  forward: Vec2;
  monsters: Monster[];
};

export type WeaponAttackResult = {
  monster: Monster;
  killed: boolean;
};

export function applyWeaponAttack(input: WeaponAttackInput): WeaponAttackResult | null {
  const forward = normalize2D(input.forward);
  let bestMonster: Monster | null = null;
  let bestScore = 0;

  for (const monster of input.monsters) {
    if (!monster.alive) continue;

    const toMonster = {
      x: monster.position.x - input.playerPosition.x,
      z: monster.position.z - input.playerPosition.z,
    };
    const centerDistance = Math.hypot(toMonster.x, toMonster.z);
    if (centerDistance <= 0.001) continue;

    const monsterRadius = monster.kind === "skull" ? 0.68 : 0.58;
    const edgeDistance = Math.max(0, centerDistance - monsterRadius);
    if (edgeDistance > input.weapon.range) continue;

    const aim = dot2D(forward, normalize2D(toMonster));
    const threshold = getAimThreshold(input.weapon.id);
    const score = aim / Math.max(edgeDistance, 0.2);
    if (aim > threshold && score > bestScore) {
      bestScore = score;
      bestMonster = monster;
    }
  }

  if (!bestMonster) return null;

  bestMonster.hp -= input.weapon.damage;
  if (bestMonster.hp <= 0) {
    bestMonster.hp = 0;
    bestMonster.alive = false;
  }

  return {
    monster: bestMonster,
    killed: !bestMonster.alive,
  };
}

function getAimThreshold(weaponId: Weapon["id"]): number {
  if (weaponId === "knife") return 0.42;
  if (weaponId === "m667") return 0.82;
  return 0.94;
}

function normalize2D(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.z);
  if (length <= 0.001) return { x: 0, z: -1 };
  return {
    x: vector.x / length,
    z: vector.z / length,
  };
}

function dot2D(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.z * b.z;
}
