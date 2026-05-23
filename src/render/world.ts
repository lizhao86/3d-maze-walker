import * as THREE from "three";
import { CELL_SIZE, REQUIRED_KEY_FRAGMENTS } from "../simulation/gameState";
import { gridToWorldInMaze } from "../simulation/maze";
import type { Chest, GameState, Monster } from "../simulation/types";
import { WEAPONS } from "../simulation/weapons";
import type { GameMaterials } from "./materials";

export type WorldMeshes = {
  root: THREE.Group;
  chests: Map<string, THREE.Group>;
  monsters: Map<string, THREE.Group>;
  exitDoor: THREE.Mesh;
  weaponRig: THREE.Group;
  muzzleLight: THREE.PointLight;
};

export function buildWorld(scene: THREE.Scene, state: GameState, materials: GameMaterials): WorldMeshes {
  const root = new THREE.Group();
  scene.add(root);
  buildFloor(root, state, materials);
  buildWalls(root, state, materials);

  const chests = new Map<string, THREE.Group>();
  for (const chest of state.chests) {
    const chestGroup = createChestMesh(chest, state, materials);
    chests.set(chest.id, chestGroup);
    root.add(chestGroup);
  }

  const monsters = new Map<string, THREE.Group>();
  for (const monster of state.monsters) {
    const monsterGroup = createMonsterMesh(monster, materials);
    monsters.set(monster.id, monsterGroup);
    root.add(monsterGroup);
  }

  const exitDoor = createExitDoor(state, materials);
  root.add(exitDoor);

  const weaponRig = createWeaponRig(state);
  const muzzleLight = new THREE.PointLight("#60f7ff", 0, 8);
  muzzleLight.position.set(0.42, -0.28, -1.35);
  weaponRig.add(muzzleLight);

  return {
    root,
    chests,
    monsters,
    exitDoor,
    weaponRig,
    muzzleLight,
  };
}

export function syncWorldMeshes(meshes: WorldMeshes, state: GameState, time: number): void {
  for (const chest of state.chests) {
    const mesh = meshes.chests.get(chest.id);
    if (!mesh) continue;
    const lid = mesh.getObjectByName("lid");
    const glow = mesh.getObjectByName("glow") as THREE.PointLight | undefined;
    if (lid) {
      lid.rotation.x = chest.opened ? -0.9 : 0;
      lid.position.y = chest.opened ? 0.72 : 0.58;
    }
    if (glow) {
      glow.intensity = chest.opened ? 1.4 + Math.sin(time * 5) * 0.25 : 0.5;
    }
  }

  for (const monster of state.monsters) {
    const mesh = meshes.monsters.get(monster.id);
    if (!mesh) continue;
    mesh.visible = monster.alive;
    mesh.position.set(monster.position.x, 0, monster.position.z);
    mesh.rotation.y += monster.kind === "skull" ? 0.02 : 0.008;
    mesh.position.y = monster.kind === "skull" ? 0.25 + Math.sin(time * 4) * 0.08 : 0;
  }

  const exitMaterial = meshes.exitDoor.material as THREE.MeshStandardMaterial;
  if (state.player.keyFragments >= REQUIRED_KEY_FRAGMENTS) {
    exitMaterial.color.set("#203d39");
    exitMaterial.emissive.set("#54ffc6");
    exitMaterial.emissiveIntensity = 2 + Math.sin(time * 3) * 0.25;
  }

  const selected = WEAPONS[state.player.selectedWeapon];
  meshes.weaponRig.traverse((object) => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
      object.material.emissive.set(selected.color);
      object.material.emissiveIntensity = object.name === "weaponAccent" ? 1.5 : 0.15;
    }
  });
  meshes.weaponRig.position.y = -0.04 + Math.sin(time * 2.4) * 0.01;
}

export function pulseMuzzle(meshes: WorldMeshes): void {
  meshes.muzzleLight.intensity = 3.2;
  window.setTimeout(() => {
    meshes.muzzleLight.intensity = 0;
  }, 55);
}

function buildFloor(root: THREE.Group, state: GameState, materials: GameMaterials): void {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(state.maze.width * CELL_SIZE, state.maze.height * CELL_SIZE),
    materials.floor,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
}

function buildWalls(root: THREE.Group, state: GameState, materials: GameMaterials): void {
  const wallGeometry = new THREE.BoxGeometry(CELL_SIZE, 3.4, CELL_SIZE);
  const stripGeometry = new THREE.BoxGeometry(CELL_SIZE * 0.46, 0.055, 0.07);

  for (let y = 0; y < state.maze.height; y += 1) {
    for (let x = 0; x < state.maze.width; x += 1) {
      if (state.maze.cells[y][x] === 0) continue;
      const position = gridToWorldInMaze(state.maze, { x, y }, CELL_SIZE);
      const wall = new THREE.Mesh(wallGeometry, materials.wall);
      wall.position.set(position.x, 1.7, position.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      root.add(wall);

      if ((x + y) % 5 === 0) {
        const strip = new THREE.Mesh(stripGeometry, (x + y) % 2 === 0 ? materials.neonCyan : materials.neonMagenta);
        strip.position.set(position.x, 2.05, position.z - CELL_SIZE / 2 - 0.02);
        root.add(strip);
      }
    }
  }
}

function createChestMesh(chest: Chest, state: GameState, materials: GameMaterials): THREE.Group {
  const group = new THREE.Group();
  const position = gridToWorldInMaze(state.maze, chest.grid, CELL_SIZE);
  group.position.set(position.x, 0, position.z);

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.7, 0.85), materials.chest);
  base.position.y = 0.35;
  group.add(base);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.24, 0.9), materials.chestOpen);
  lid.name = "lid";
  lid.position.y = 0.58;
  lid.position.z = -0.04;
  group.add(lid);

  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.08, 0.96), materials.neonCyan);
  trim.position.y = 0.74;
  group.add(trim);

  const glow = new THREE.PointLight("#19f6ff", 0.5, 4);
  glow.name = "glow";
  glow.position.y = 1.25;
  group.add(glow);
  return group;
}

function createMonsterMesh(monster: Monster, materials: GameMaterials): THREE.Group {
  const group = new THREE.Group();
  group.position.set(monster.position.x, 0, monster.position.z);

  if (monster.kind === "skull") {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 14), materials.skull);
    head.position.y = 1.05;
    group.add(head);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: "#03070b", emissive: "#ff35cb", emissiveIntensity: 2 });
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.04), eyeMaterial);
    const rightEye = leftEye.clone();
    leftEye.position.set(-0.16, 1.08, -0.42);
    rightEye.position.set(0.16, 1.08, -0.42);
    group.add(leftEye, rightEye);
  } else {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.8, 8, 16), materials.zombie);
    body.position.y = 0.9;
    group.add(body);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.06), materials.neonMagenta);
    visor.position.set(0, 1.25, -0.32);
    group.add(visor);
  }

  const light = new THREE.PointLight(monster.kind === "skull" ? "#58f6ff" : "#5eff92", 1.7, 8);
  light.position.y = 1.2;
  group.add(light);
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.72, 24),
    new THREE.MeshBasicMaterial({
      color: monster.kind === "skull" ? "#58f6ff" : "#6dff9b",
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.03;
  group.add(marker);
  return group;
}

function createExitDoor(state: GameState, materials: GameMaterials): THREE.Mesh {
  const position = gridToWorldInMaze(state.maze, state.maze.exit, CELL_SIZE);
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 0.28), materials.exitLocked);
  door.position.set(position.x, 1.4, position.z);
  return door;
}

function createWeaponRig(state: GameState): THREE.Group {
  const group = new THREE.Group();
  group.position.set(0.64, -0.64, -1.55);
  group.rotation.set(-0.08, -0.22, 0.03);
  group.scale.setScalar(0.44);

  const selected = WEAPONS[state.player.selectedWeapon];
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: "#151a20",
    emissive: selected.color,
    emissiveIntensity: 0.16,
    roughness: 0.42,
    metalness: 0.8,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: selected.color,
    emissive: selected.color,
    emissiveIntensity: 1.5,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.22, 0.9), bodyMaterial);
  body.position.set(0, 0, -0.2);
  group.add(body);

  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.82), bodyMaterial);
  barrel.position.set(0.06, 0.04, -0.96);
  group.add(barrel);

  const accent = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.08), accentMaterial);
  accent.name = "weaponAccent";
  accent.position.set(0, 0.14, -0.23);
  group.add(accent);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.18), bodyMaterial);
  grip.position.set(-0.17, -0.28, 0.08);
  grip.rotation.x = -0.34;
  group.add(grip);

  return group;
}
