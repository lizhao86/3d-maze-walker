import * as THREE from "three";
import "./style.css";
import {
  CELL_SIZE,
  checkExit,
  createGameState,
  damagePlayer,
  getLootLabel,
  openNearestChest,
  pickupNearestWeapon,
  revealAroundPlayer,
} from "./simulation/gameState";
import { isWall, worldToGrid } from "./simulation/maze";
import { getMovementDelta, getYawTowardOpenNeighbor } from "./simulation/movement";
import type { GameState, Monster, WeaponId } from "./simulation/types";
import { WEAPONS } from "./simulation/weapons";
import { applyWeaponAttack } from "./simulation/combat";
import { createMaterials } from "./render/materials";
import { buildWorld, pulseMuzzle, syncWorldMeshes, type WorldMeshes } from "./render/world";
import { createHud } from "./ui/hud";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("App root not found.");

declare global {
  interface Window {
    __mazeWalkerDebug?: {
      getPlayerPosition: () => { x: number; z: number };
      getStatus: () => GameState["status"];
      getMonsterStats: () => { count: number; nearestDistance: number };
      setupKnifeZombieTest: () => { monsterId: string; hp: number; alive: boolean; visualState: Monster["visualState"] };
      setupAssetSheetShowcase: (weaponId?: WeaponId) => { weapon: WeaponId; monsters: number };
      setupWeaponPickupTest: (weaponId?: WeaponId) => { weapon: WeaponId; pickups: number };
      fireWeaponForTest: () => { hp: number; alive: boolean; visualState: Monster["visualState"]; message: string } | null;
      getWeaponVisualDebug: () => { weapon: WeaponId; idleOpacity: number; attackOpacity: number; effectOpacity: number; attackUntil: number };
    };
  }
}

let state = createGameState();
const hud = createHud(app, state);
let knifeZombieTestMonsterId: string | null = null;

window.__mazeWalkerDebug = {
  getPlayerPosition: () => ({ ...state.player.position }),
  getStatus: () => state.status,
  getMonsterStats: () => getMonsterStats(),
  setupKnifeZombieTest: () => setupKnifeZombieTest(),
  setupAssetSheetShowcase: (weaponId?: WeaponId) => setupAssetSheetShowcase(weaponId),
  setupWeaponPickupTest: (weaponId?: WeaponId) => setupWeaponPickupTest(weaponId),
  fireWeaponForTest: () => fireWeaponForTest(),
  getWeaponVisualDebug: () => getWeaponVisualDebug(),
};

const renderer = new THREE.WebGLRenderer({
  canvas: hud.canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#07111a");
scene.fog = new THREE.FogExp2("#07111a", 0.026);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 120);
camera.position.set(state.player.position.x, 1.62, state.player.position.z);
camera.add(new THREE.PointLight("#c8fbff", 3.6, 26));
scene.add(camera);

const ambient = new THREE.AmbientLight("#a8d9ef", 0.54);
scene.add(ambient);

const hemisphere = new THREE.HemisphereLight("#bff8ff", "#16222d", 0.55);
scene.add(hemisphere);

const moon = new THREE.DirectionalLight("#d8f6ff", 0.7);
moon.position.set(12, 20, 8);
moon.castShadow = true;
scene.add(moon);

const materials = createMaterials();
let meshes = buildWorld(scene, state, materials);
camera.add(meshes.weaponRig);

const keys = new Set<string>();
let yaw = getYawTowardOpenNeighbor(state.maze);
let pitch = 0;
let lastTime = performance.now();
let fireCooldown = 0;
let hitFlash = 0;
const EASY_DAMAGE_SCALE = 0.75;

hud.startOverlay.addEventListener("click", () => {
  hud.canvas.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  hud.startOverlay.classList.toggle("hidden", document.pointerLockElement === hud.canvas);
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== hud.canvas || state.status !== "playing") return;
  yaw -= event.movementX * 0.0022;
  pitch -= event.movementY * 0.0017;
  pitch = THREE.MathUtils.clamp(pitch, -0.85, 0.85);
});

document.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "KeyE") {
    const pickup = pickupNearestWeapon(state);
    const loot = pickup ? null : openNearestChest(state);
    if (loot && loot.type !== "weapon") {
      state.message = getLootLabel(loot);
    }
    checkExit(state);
    hud.update(state);
  }
  if (event.code.startsWith("Digit")) {
    const slot = Number(event.code.replace("Digit", "")) - 1;
    const weaponId = state.player.inventory[slot];
    if (weaponId) {
      state.player.selectedWeapon = weaponId;
      hud.update(state);
    }
  }
  if (event.code === "KeyR" && state.status !== "playing") {
    restart();
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

document.addEventListener("mousedown", () => {
  if (document.pointerLockElement !== hud.canvas || state.status !== "playing") return;
  fireWeapon();
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate(now: number): void {
  requestAnimationFrame(animate);
  const delta = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (state.status === "playing") {
    updatePlayer(delta);
    updateMonsters(delta);
    checkExit(state);
  }

  fireCooldown = Math.max(0, fireCooldown - delta);
  hitFlash = Math.max(0, hitFlash - delta);
  camera.rotation.set(pitch, yaw, 0, "YXZ");
  syncWorldMeshes(meshes, state, now / 1000);
  hud.update(state);
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

function updatePlayer(delta: number): void {
  const input = new THREE.Vector3();
  if (keys.has("KeyW")) input.z -= 1;
  if (keys.has("KeyS")) input.z += 1;
  if (keys.has("KeyA")) input.x -= 1;
  if (keys.has("KeyD")) input.x += 1;
  if (input.lengthSq() > 0) input.normalize();

  const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 5.4 : 3.7;
  const move = getMovementDelta({
    yaw,
    inputX: input.x,
    inputZ: input.z,
    speed,
    delta,
  });
  movePlayer(move.x, move.z);
  revealAroundPlayer(state);

  camera.position.x = state.player.position.x;
  camera.position.z = state.player.position.z;

  const nearChest = state.chests.some((chest) => {
    if (chest.opened) return false;
    const chestWorld = {
      x: (chest.grid.x - state.maze.width / 2 + 0.5) * CELL_SIZE,
      z: (chest.grid.y - state.maze.height / 2 + 0.5) * CELL_SIZE,
    };
    return Math.hypot(chestWorld.x - state.player.position.x, chestWorld.z - state.player.position.z) < 2.6;
  });
  const nearWeaponPickup = state.weaponPickups.some((pickup) => {
    if (pickup.collected) return false;
    const pickupWorld = {
      x: (pickup.grid.x - state.maze.width / 2 + 0.5) * CELL_SIZE,
      z: (pickup.grid.y - state.maze.height / 2 + 0.5) * CELL_SIZE,
    };
    return Math.hypot(pickupWorld.x - state.player.position.x, pickupWorld.z - state.player.position.z) < 2.6;
  });
  const exitWorld = {
    x: (state.maze.exit.x - state.maze.width / 2 + 0.5) * CELL_SIZE,
    z: (state.maze.exit.y - state.maze.height / 2 + 0.5) * CELL_SIZE,
  };
  const nearExit = Math.hypot(exitWorld.x - state.player.position.x, exitWorld.z - state.player.position.z) < 2.8;
  hud.setPrompt(
    nearWeaponPickup
      ? "Press E to pick up weapon"
      : nearChest
        ? "Press E to open cyber chest"
        : nearExit
          ? "Press E to access exit door"
          : "",
  );
}

function movePlayer(dx: number, dz: number): void {
  const radius = 0.42;
  const nextX = state.player.position.x + dx;
  if (!collides(nextX, state.player.position.z, radius)) {
    state.player.position.x = nextX;
  }
  const nextZ = state.player.position.z + dz;
  if (!collides(state.player.position.x, nextZ, radius)) {
    state.player.position.z = nextZ;
  }
}

function collides(x: number, z: number, radius: number): boolean {
  const checks = [
    { x: x - radius, z: z - radius },
    { x: x + radius, z: z - radius },
    { x: x - radius, z: z + radius },
    { x: x + radius, z: z + radius },
  ];
  return checks.some((point) => {
    const grid = worldToGrid(state.maze, point, CELL_SIZE);
    return isWall(state.maze, grid.x, grid.y);
  });
}

function updateMonsters(delta: number): void {
  const now = performance.now() / 1000;
  for (const monster of state.monsters) {
    if (!monster.alive) {
      monster.visualState = "dead";
      continue;
    }
    if (monster.visualStateUntil <= now && monster.visualState !== "walk") {
      monster.visualState = "walk";
    }
    const dx = state.player.position.x - monster.position.x;
    const dz = state.player.position.z - monster.position.z;
    const distance = Math.hypot(dx, dz);
    let angle = monster.wanderAngle;

    if (distance < 16) {
      angle = Math.atan2(dx, dz);
    } else {
      monster.wanderTimer -= delta;
      if (monster.wanderTimer <= 0) {
        monster.wanderTimer = 1.8 + Math.random() * 2.4;
        monster.wanderAngle += (Math.random() - 0.5) * 1.8;
      }
    }

    const speed = monster.speed * (distance < 16 ? 1.08 : 0.5);
    moveMonster(monster, Math.sin(angle) * speed * delta, Math.cos(angle) * speed * delta);
    monster.attackCooldown = Math.max(0, monster.attackCooldown - delta);

    if (distance < 1.45 && monster.attackCooldown <= 0) {
      monster.attackCooldown = monster.kind === "skull" ? 0.8 : 1.25;
      monster.visualState = "attack";
      monster.visualStateUntil = now + 0.28;
      hitFlash = 0.16;
      damagePlayer(state, Math.round((monster.kind === "skull" ? 11 : 16) * EASY_DAMAGE_SCALE));
    }
  }

  if (hitFlash > 0) {
    scene.fog!.color.set("#210611");
  } else {
    scene.fog!.color.set("#07111a");
  }
}

function moveMonster(monster: Monster, dx: number, dz: number): void {
  const nextX = monster.position.x + dx;
  if (!collides(nextX, monster.position.z, 0.38)) {
    monster.position.x = nextX;
  }
  const nextZ = monster.position.z + dz;
  if (!collides(monster.position.x, nextZ, 0.38)) {
    monster.position.z = nextZ;
  }
  monster.grid = worldToGrid(state.maze, monster.position, CELL_SIZE);
}

function fireWeapon(): void {
  const weapon = WEAPONS[state.player.selectedWeapon];
  if (fireCooldown > 0) return;
  const ammo = state.player.ammo[weapon.id] ?? 0;
  if (weapon.ammoCost > 0 && ammo < weapon.ammoCost) {
    state.message = `${weapon.name} needs ammo. Switch weapon or open chests.`;
    return;
  }

  fireCooldown = 1 / weapon.fireRate;
  if (weapon.ammoCost > 0) {
    state.player.ammo[weapon.id] = ammo - weapon.ammoCost;
  }
  pulseMuzzle(meshes);
  hud.showAttackFlash(weapon.id);

  const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation).normalize();
  const result = applyWeaponAttack({
    weapon,
    playerPosition: state.player.position,
    forward: { x: forward.x, z: forward.z },
    monsters: state.monsters,
  });

  if (result) {
    state.message = `${weapon.shortName} hit ${result.monster.kind.toUpperCase()}`;
    if (result.killed) {
      result.monster.visualState = "dead";
      result.monster.visualStateUntil = Number.POSITIVE_INFINITY;
      state.message = `${result.monster.kind.toUpperCase()} neutralized`;
    } else {
      result.monster.visualState = "hit";
      result.monster.visualStateUntil = performance.now() / 1000 + 0.22;
    }
  }
}

function setupKnifeZombieTest(): { monsterId: string; hp: number; alive: boolean; visualState: Monster["visualState"] } {
  const testMonster = state.monsters.find((monster) => monster.kind === "zombie") ?? state.monsters[0];
  knifeZombieTestMonsterId = testMonster.id;
  for (const monster of state.monsters) {
    if (monster.id === testMonster.id) continue;
    monster.position = { x: state.player.position.x + 40, z: state.player.position.z + 40 };
    monster.grid = worldToGrid(state.maze, monster.position, CELL_SIZE);
    monster.alive = false;
    monster.visualState = "dead";
  }
  testMonster.position = {
    x: state.player.position.x,
    z: state.player.position.z,
  };
  testMonster.maxHp = 70;
  testMonster.hp = 70;
  testMonster.speed = 0;
  testMonster.attackCooldown = 999;
  testMonster.alive = true;
  testMonster.visualState = "walk";
  testMonster.visualStateUntil = 0;
  state.status = "playing";
  state.player.hp = state.player.maxHp;
  state.player.selectedWeapon = "knife";
  yaw = getYawTowardOpenNeighbor(state.maze);
  pitch = 0;
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, "YXZ")).normalize();
  testMonster.position = {
    x: state.player.position.x + forward.x * 2.05,
    z: state.player.position.z + forward.z * 2.05,
  };
  testMonster.grid = worldToGrid(state.maze, testMonster.position, CELL_SIZE);
  fireCooldown = 0;
  camera.rotation.set(pitch, yaw, 0, "YXZ");
  camera.position.x = state.player.position.x;
  camera.position.z = state.player.position.z;
  state.message = "Knife zombie test ready.";
  hud.startOverlay.classList.add("hidden");
  hud.update(state);
  return {
    monsterId: testMonster.id,
    hp: testMonster.hp,
    alive: testMonster.alive,
    visualState: testMonster.visualState,
  };
}

function fireWeaponForTest(): { hp: number; alive: boolean; visualState: Monster["visualState"]; message: string } | null {
  fireWeapon();
  const testMonster = state.monsters.find((monster) => monster.id === knifeZombieTestMonsterId) ?? state.monsters[0];
  return {
    hp: testMonster.hp,
    alive: testMonster.alive,
    visualState: testMonster.visualState,
    message: state.message,
  };
}

function getWeaponVisualDebug(): { weapon: WeaponId; idleOpacity: number; attackOpacity: number; effectOpacity: number; attackUntil: number } {
  const selectedGroup = meshes.weaponRig.children.find((child) => child.userData.weaponId === state.player.selectedWeapon) as THREE.Group | undefined;
  const idleSprite = selectedGroup?.getObjectByName("weaponIdleSprite") as THREE.Sprite | undefined;
  const attackSprite = selectedGroup?.getObjectByName("weaponAttackSprite") as THREE.Sprite | undefined;
  return {
    weapon: state.player.selectedWeapon,
    idleOpacity: idleSprite ? (idleSprite.material as THREE.SpriteMaterial).opacity : -1,
    attackOpacity: attackSprite ? (attackSprite.material as THREE.SpriteMaterial).opacity : -1,
    effectOpacity: 0,
    attackUntil: Number(meshes.weaponRig.userData.attackUntil ?? 0),
  };
}

function setupAssetSheetShowcase(weaponId: WeaponId = "knife"): { weapon: WeaponId; monsters: number } {
  const selectedWeapon = WEAPONS[weaponId] ? weaponId : "knife";
  const zombie = state.monsters.find((monster) => monster.kind === "zombie");
  const skull = state.monsters.find((monster) => monster.kind === "skull");
  const yawToOpen = getYawTowardOpenNeighbor(state.maze);
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yawToOpen, 0, "YXZ")).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yawToOpen, 0, "YXZ")).normalize();
  const origin = state.player.position;

  state.status = "playing";
  state.player.hp = state.player.maxHp;
  state.player.inventory = Object.keys(WEAPONS) as WeaponId[];
  state.player.selectedWeapon = selectedWeapon;
  for (const key of Object.keys(WEAPONS) as WeaponId[]) {
    state.player.ammo[key] = 99;
  }
  yaw = yawToOpen;
  pitch = 0;
  camera.rotation.set(pitch, yaw, 0, "YXZ");
  camera.position.x = origin.x;
  camera.position.z = origin.z;

  let visibleMonsters = 0;
  for (const monster of state.monsters) {
    monster.alive = false;
    monster.visualState = "dead";
  }
  if (zombie) {
    placeMonsterForShowcase(zombie, origin, forward, right, -0.92, 2.55);
    visibleMonsters += 1;
  }
  if (skull) {
    placeMonsterForShowcase(skull, origin, forward, right, 0.92, 2.75);
    visibleMonsters += 1;
  }

  const chest = state.chests[0];
  const chestMesh = chest ? meshes.chests.get(chest.id) : undefined;
  if (chest && chestMesh) {
    chest.opened = false;
    chest.grid = worldToGrid(state.maze, {
      x: origin.x + forward.x * 2.9 + right.x * -1.95,
      z: origin.z + forward.z * 2.9 + right.z * -1.95,
    }, CELL_SIZE);
    chestMesh.position.set(origin.x + forward.x * 2.9 + right.x * -1.95, 0, origin.z + forward.z * 2.9 + right.z * -1.95);
  }

  meshes.exitDoor.position.set(origin.x + forward.x * 5.1 + right.x * 1.85, 0, origin.z + forward.z * 5.1 + right.z * 1.85);
  hud.startOverlay.classList.add("hidden");
  state.message = "Design sheet assets loaded.";
  hud.update(state);
  return { weapon: selectedWeapon, monsters: visibleMonsters };
}

function setupWeaponPickupTest(weaponId: WeaponId = "barrett"): { weapon: WeaponId; pickups: number } {
  const selectedWeapon = WEAPONS[weaponId] ? weaponId : "barrett";
  const yawToOpen = getYawTowardOpenNeighbor(state.maze);
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yawToOpen, 0, "YXZ")).normalize();
  const origin = state.player.position;
  const pickupWorld = {
    x: origin.x + forward.x * 2.1,
    z: origin.z + forward.z * 2.1,
  };
  const pickupGrid = worldToGrid(state.maze, pickupWorld, CELL_SIZE);

  state.status = "playing";
  state.player.hp = state.player.maxHp;
  state.weaponPickups = [{
    id: "debug-weapon-pickup",
    weaponId: selectedWeapon,
    grid: pickupGrid,
    collected: false,
  }];
  yaw = yawToOpen;
  pitch = 0;
  camera.rotation.set(pitch, yaw, 0, "YXZ");
  camera.position.x = origin.x;
  camera.position.z = origin.z;
  hud.startOverlay.classList.add("hidden");
  state.message = `${selectedWeapon.toUpperCase()} pickup test ready.`;
  hud.update(state);
  return { weapon: selectedWeapon, pickups: state.weaponPickups.length };
}

function placeMonsterForShowcase(
  monster: Monster,
  origin: { x: number; z: number },
  forward: THREE.Vector3,
  right: THREE.Vector3,
  sideOffset: number,
  forwardOffset: number,
): void {
  monster.position = {
    x: origin.x + forward.x * forwardOffset + right.x * sideOffset,
    z: origin.z + forward.z * forwardOffset + right.z * sideOffset,
  };
  monster.grid = worldToGrid(state.maze, monster.position, CELL_SIZE);
  monster.hp = monster.maxHp;
  monster.speed = 0;
  monster.attackCooldown = 999;
  monster.alive = true;
  monster.visualState = "walk";
  monster.visualStateUntil = 0;
}

function restart(): void {
  scene.remove(meshes.root);
  camera.remove(meshes.weaponRig);
  state = createGameState();
  yaw = getYawTowardOpenNeighbor(state.maze);
  pitch = 0;
  meshes = buildWorld(scene, state, materials);
  camera.add(meshes.weaponRig);
  camera.position.set(state.player.position.x, 1.62, state.player.position.z);
  hud.startOverlay.classList.remove("hidden");
  hud.update(state);
}

function getMonsterStats(): { count: number; nearestDistance: number } {
  const aliveMonsters = state.monsters.filter((monster) => monster.alive);
  const nearestDistance = Math.min(
    ...aliveMonsters.map((monster) =>
      Math.hypot(
        monster.position.x - state.player.position.x,
        monster.position.z - state.player.position.z,
      ),
    ),
  );
  return {
    count: aliveMonsters.length,
    nearestDistance,
  };
}
