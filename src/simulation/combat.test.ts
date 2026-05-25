import { describe, expect, it } from "vitest";
import { applyWeaponAttack } from "./combat";
import type { Monster } from "./types";
import { WEAPONS } from "./weapons";

function createMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: "monster-1",
    kind: "skull",
    grid: { x: 0, y: 0 },
    position: { x: 0, z: -2.35 },
    hp: 70,
    maxHp: 70,
    speed: 1,
    attackCooldown: 0,
    wanderTimer: 0,
    wanderAngle: 0,
    visualState: "walk",
    visualStateUntil: 0,
    alive: true,
    ...overrides,
  };
}

describe("applyWeaponAttack", () => {
  it("lets the knife hit a monster whose body is inside the melee sweep", () => {
    const monster = createMonster();

    const result = applyWeaponAttack({
      weapon: WEAPONS.knife,
      playerPosition: { x: 0, z: 0 },
      forward: { x: 0, z: -1 },
      monsters: [monster],
    });

    expect(result?.monster).toBe(monster);
    expect(monster.hp).toBeLessThan(monster.maxHp);
  });

  it("kills a skull with one clean knife hit", () => {
    const monster = createMonster({ hp: 70, maxHp: 70 });

    const result = applyWeaponAttack({
      weapon: WEAPONS.knife,
      playerPosition: { x: 0, z: 0 },
      forward: { x: 0, z: -1 },
      monsters: [monster],
    });

    expect(result?.killed).toBe(true);
    expect(monster.alive).toBe(false);
  });
});
