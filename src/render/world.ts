import * as THREE from "three";
import { CELL_SIZE, REQUIRED_KEY_FRAGMENTS } from "../simulation/gameState";
import { gridToWorldInMaze } from "../simulation/maze";
import type { Chest, GameState, Monster, WeaponId, WeaponPickup } from "../simulation/types";
import { WEAPONS } from "../simulation/weapons";
import type { GameMaterials } from "./materials";
import { createMonsterAnimations, createPropArt, createWeaponArt, createWeaponPickupArt, type MonsterSpriteAnimations } from "./spriteArt";

export type WorldMeshes = {
  root: THREE.Group;
  chests: Map<string, THREE.Group>;
  weaponPickups: Map<string, THREE.Group>;
  monsters: Map<string, THREE.Group>;
  exitDoor: THREE.Group;
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

  const weaponPickups = new Map<string, THREE.Group>();
  for (const pickup of state.weaponPickups) {
    const pickupGroup = createWeaponPickupMesh(pickup, state);
    weaponPickups.set(pickup.id, pickupGroup);
    root.add(pickupGroup);
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
    weaponPickups,
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
    const sprite = mesh.getObjectByName("chestSprite") as THREE.Sprite | undefined;
    const glow = mesh.getObjectByName("glow") as THREE.PointLight | undefined;
    if (sprite) {
      sprite.material.opacity = chest.opened ? 0.62 : 1;
      sprite.scale.setScalar(chest.opened ? 0.92 : 1);
    }
    if (glow) {
      glow.intensity = chest.opened ? 1.4 + Math.sin(time * 5) * 0.25 : 0.5;
    }
  }

  for (const monster of state.monsters) {
    const mesh = meshes.monsters.get(monster.id);
    if (!mesh) continue;
    const sprite = mesh.getObjectByName("monsterSprite") as THREE.Sprite | undefined;
    mesh.visible = true;
    mesh.position.set(monster.position.x, 0, monster.position.z);
    mesh.position.y = monster.alive && monster.kind === "skull" ? 0.25 + Math.sin(time * 4) * 0.08 : 0;
    if (sprite) {
      const animations = mesh.userData.animations as MonsterSpriteAnimations | undefined;
      const frames = animations?.[monster.visualState] ?? animations?.walk;
      if (frames && frames.length > 0) {
        const frameRate =
          monster.visualState === "attack" ? 12 :
          monster.visualState === "hit" ? 14 :
          monster.visualState === "dead" ? 1 :
          monster.kind === "skull" ? 8 : 6;
        const frameIndex = Math.floor(time * frameRate + mesh.userData.frameOffset) % frames.length;
        (sprite.material as THREE.SpriteMaterial).map = frames[frameIndex];
      }
      const pulse = monster.visualState === "dead"
        ? 1
        : 1 + Math.sin(time * (monster.kind === "skull" ? 5 : 3.5) + mesh.userData.frameOffset) * 0.035;
      const width = monster.visualState === "dead" ? (monster.kind === "skull" ? 2.05 : 2.55) : (monster.kind === "skull" ? 1.65 : 1.52);
      const height = monster.visualState === "dead" ? (monster.kind === "skull" ? 0.96 : 1.2) : (monster.kind === "skull" ? 2.28 : 2.24);
      sprite.position.y = monster.visualState === "dead" ? (monster.kind === "skull" ? 0.28 : 0.42) : monster.kind === "skull" ? 1.15 : 1.22;
      sprite.scale.set(width * pulse, height / pulse, 1);
      const marker = mesh.getObjectByName("monsterMarker");
      if (marker) marker.visible = monster.alive;
      const light = mesh.getObjectByName("monsterLight") as THREE.PointLight | undefined;
      if (light) light.intensity = monster.alive ? 1.7 : 0.3;
    }
  }

  for (const pickup of state.weaponPickups) {
    let mesh = meshes.weaponPickups.get(pickup.id);
    if (!mesh) {
      mesh = createWeaponPickupMesh(pickup, state);
      meshes.weaponPickups.set(pickup.id, mesh);
      meshes.root.add(mesh);
    }
    const pickupPosition = gridToWorldInMaze(state.maze, pickup.grid, CELL_SIZE);
    mesh.position.set(pickupPosition.x, 0, pickupPosition.z);
    mesh.visible = !pickup.collected;
    const sprite = mesh.getObjectByName("weaponPickupSprite") as THREE.Sprite | undefined;
    if (sprite) {
      sprite.position.y = Number(sprite.userData.baseY ?? 0.86) + Math.sin(time * 4.2 + mesh.userData.frameOffset) * 0.08;
      sprite.rotation.z = Math.sin(time * 3 + mesh.userData.frameOffset) * 0.035;
    }
    const glow = mesh.getObjectByName("pickupGlow") as THREE.PointLight | undefined;
    if (glow) glow.intensity = pickup.collected ? 0 : 1.7 + Math.sin(time * 5.5) * 0.35;
  }

  const exitGlow = meshes.exitDoor.getObjectByName("exitGlow") as THREE.PointLight | undefined;
  const exitSprite = meshes.exitDoor.getObjectByName("exitSprite") as THREE.Sprite | undefined;
  if (state.player.keyFragments >= REQUIRED_KEY_FRAGMENTS) {
    if (exitGlow) exitGlow.intensity = 2 + Math.sin(time * 3) * 0.25;
    if (exitSprite) exitSprite.material.opacity = 1;
  } else {
    if (exitGlow) exitGlow.intensity = 0.7;
    if (exitSprite) exitSprite.material.opacity = 0.82;
  }

  const selected = WEAPONS[state.player.selectedWeapon];
  const attackUntil = Number(meshes.weaponRig.userData.attackUntil ?? 0);
  const attackAmount = Math.max(0, Math.min(1, (attackUntil - time) / 0.42));
  meshes.weaponRig.traverse((object) => {
    if (object instanceof THREE.Group && typeof object.userData.weaponId === "string") {
      object.visible = object.userData.weaponId === selected.id;
      const idleSprite = object.getObjectByName("weaponIdleSprite") as THREE.Sprite | undefined;
      const attackSprite = object.getObjectByName("weaponAttackSprite") as THREE.Sprite | undefined;
      if (idleSprite && attackSprite) {
        const attackVisible = attackAmount > 0.02;
        (idleSprite.material as THREE.SpriteMaterial).opacity = attackVisible ? 0 : 1;
        (attackSprite.material as THREE.SpriteMaterial).opacity = attackVisible ? 1 : 0.001;
      }
    }
  });
  meshes.weaponRig.position.x = 0.48 + attackAmount * (selected.id === "knife" ? -0.18 : 0.06);
  meshes.weaponRig.position.y = -0.56 + Math.sin(time * 2.4) * 0.012 + attackAmount * (selected.id === "knife" ? 0.12 : -0.04);
  meshes.weaponRig.rotation.z = selected.id === "knife" ? -attackAmount * 0.34 : attackAmount * 0.08;
  meshes.weaponRig.rotation.x = selected.id === "knife" ? attackAmount * 0.18 : -attackAmount * 0.08;
}

export function pulseMuzzle(meshes: WorldMeshes): void {
  meshes.muzzleLight.intensity = 0;
  meshes.weaponRig.userData.attackUntil = performance.now() / 1000 + 0.42;
  setVisibleWeaponAttackPose(meshes.weaponRig, true);
  window.setTimeout(() => {
    meshes.muzzleLight.intensity = 0;
    setVisibleWeaponAttackPose(meshes.weaponRig, false);
  }, 420);
}

function setVisibleWeaponAttackPose(weaponRig: THREE.Group, attacking: boolean): void {
  weaponRig.traverse((object) => {
    if (!(object instanceof THREE.Group) || typeof object.userData.weaponId !== "string") return;
    const idleSprite = object.getObjectByName("weaponIdleSprite") as THREE.Sprite | undefined;
    const attackSprite = object.getObjectByName("weaponAttackSprite") as THREE.Sprite | undefined;
    if (!idleSprite || !attackSprite) return;
    (idleSprite.material as THREE.SpriteMaterial).opacity = attacking ? 0 : 1;
    (attackSprite.material as THREE.SpriteMaterial).opacity = attacking ? 1 : 0.001;
  });
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

  const art = createPropArt("chest");
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: art.texture,
    transparent: true,
    depthWrite: false,
    alphaTest: 0.08,
  }));
  sprite.name = "chestSprite";
  sprite.position.y = art.offsetY;
  sprite.scale.set(art.width, art.height, 1);
  group.add(sprite);

  const glow = new THREE.PointLight("#19f6ff", 0.5, 4);
  glow.name = "glow";
  glow.position.y = 1.25;
  group.add(glow);
  return group;
}

function createMonsterMesh(monster: Monster, materials: GameMaterials): THREE.Group {
  const group = new THREE.Group();
  group.position.set(monster.position.x, 0, monster.position.z);
  group.userData.animations = createMonsterAnimations(monster.kind);
  group.userData.frameOffset = Math.random() * 10;

  const animations = group.userData.animations as MonsterSpriteAnimations;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: animations.walk[0],
    transparent: true,
    depthWrite: false,
    alphaTest: 0.44,
  }));
  sprite.name = "monsterSprite";
  sprite.position.y = monster.kind === "skull" ? 1.15 : 1.22;
  sprite.scale.set(monster.kind === "skull" ? 1.65 : 1.52, monster.kind === "skull" ? 2.28 : 2.24, 1);
  group.add(sprite);

  const light = new THREE.PointLight(monster.kind === "skull" ? "#58f6ff" : "#5eff92", 1.7, 8);
  light.name = "monsterLight";
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
  marker.name = "monsterMarker";
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.03;
  group.add(marker);
  return group;
}

function createExitDoor(state: GameState, materials: GameMaterials): THREE.Group {
  const group = new THREE.Group();
  const position = gridToWorldInMaze(state.maze, state.maze.exit, CELL_SIZE);
  group.position.set(position.x, 0, position.z);

  const art = createPropArt("exit");
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: art.texture,
    transparent: true,
    depthWrite: false,
    alphaTest: 0.08,
    opacity: 0.82,
  }));
  sprite.name = "exitSprite";
  sprite.position.y = art.offsetY;
  sprite.scale.set(art.width, art.height, 1);
  group.add(sprite);

  const glow = new THREE.PointLight("#54ffc6", 0.7, 7);
  glow.name = "exitGlow";
  glow.position.y = 1.8;
  group.add(glow);
  return group;
}

function createWeaponPickupMesh(pickup: WeaponPickup, state: GameState): THREE.Group {
  const group = new THREE.Group();
  const position = gridToWorldInMaze(state.maze, pickup.grid, CELL_SIZE);
  group.position.set(position.x, 0, position.z);
  group.userData.frameOffset = Math.random() * 10;

  const art = createWeaponPickupArt(pickup.weaponId);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: art.texture,
    transparent: true,
    depthWrite: false,
    alphaTest: 0.08,
  }));
  sprite.name = "weaponPickupSprite";
  sprite.userData.baseY = art.offsetY;
  sprite.position.set(art.offsetX, art.offsetY, 0);
  sprite.scale.set(art.width, art.height, 1);
  group.add(sprite);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.74, 28),
    new THREE.MeshBasicMaterial({
      color: WEAPONS[pickup.weaponId].color,
      transparent: true,
      opacity: 0.44,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);

  const glow = new THREE.PointLight(WEAPONS[pickup.weaponId].color, 1.7, 4.8);
  glow.name = "pickupGlow";
  glow.position.y = 0.9;
  group.add(glow);
  group.visible = !pickup.collected;
  return group;
}

function createWeaponRig(state: GameState): THREE.Group {
  const group = new THREE.Group();
  group.position.set(0.48, -0.56, -1.22);
  group.rotation.set(0, 0, 0);

  for (const weaponId of Object.keys(WEAPONS) as WeaponId[]) {
    const model = createWeaponSprite(weaponId);
    model.userData.weaponId = weaponId;
    model.visible = weaponId === state.player.selectedWeapon;
    group.add(model);
  }

  return group;
}

function createWeaponSprite(weaponId: WeaponId): THREE.Group {
  const group = new THREE.Group();
  const idleArt = createWeaponArt(weaponId, "idle");
  const attackArt = createWeaponArt(weaponId, "attack");
  const idleSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: idleArt.texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    alphaTest: 0.04,
  }));
  idleSprite.name = "weaponIdleSprite";
  idleSprite.renderOrder = 20;
  idleSprite.position.set(idleArt.offsetX, idleArt.offsetY, 0);
  idleSprite.scale.set(idleArt.width, idleArt.height, 1);
  group.add(idleSprite);

  const attackSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: attackArt.texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    alphaTest: 0.04,
    opacity: 0.001,
  }));
  attackSprite.name = "weaponAttackSprite";
  attackSprite.renderOrder = 21;
  attackSprite.position.set(attackArt.offsetX, attackArt.offsetY, 0);
  attackSprite.scale.set(attackArt.width, attackArt.height, 1);
  group.add(attackSprite);
  return group;
}
