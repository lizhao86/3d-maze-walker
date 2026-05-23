import * as THREE from "three";
import "./style.css";
import {
  CELL_SIZE,
  checkExit,
  createGameState,
  damagePlayer,
  getLootLabel,
  openNearestChest,
} from "./simulation/gameState";
import { isWall, worldToGrid } from "./simulation/maze";
import { getMovementDelta, getYawTowardOpenNeighbor } from "./simulation/movement";
import type { GameState, Monster } from "./simulation/types";
import { WEAPONS } from "./simulation/weapons";
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
    };
  }
}

let state = createGameState();
const hud = createHud(app, state);

window.__mazeWalkerDebug = {
  getPlayerPosition: () => ({ ...state.player.position }),
  getStatus: () => state.status,
  getMonsterStats: () => getMonsterStats(),
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
    const loot = openNearestChest(state);
    if (loot) {
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
  const exitWorld = {
    x: (state.maze.exit.x - state.maze.width / 2 + 0.5) * CELL_SIZE,
    z: (state.maze.exit.y - state.maze.height / 2 + 0.5) * CELL_SIZE,
  };
  const nearExit = Math.hypot(exitWorld.x - state.player.position.x, exitWorld.z - state.player.position.z) < 2.8;
  hud.setPrompt(nearChest ? "Press E to open cyber chest" : nearExit ? "Press E to access exit door" : "");
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
  for (const monster of state.monsters) {
    if (!monster.alive) continue;
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
      hitFlash = 0.16;
      damagePlayer(state, monster.kind === "skull" ? 11 : 16);
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

  const forward = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation).normalize();
  let bestMonster: Monster | null = null;
  let bestScore = 0;
  for (const monster of state.monsters) {
    if (!monster.alive) continue;
    const toMonster = new THREE.Vector3(
      monster.position.x - state.player.position.x,
      0.2,
      monster.position.z - state.player.position.z,
    );
    const distance = toMonster.length();
    if (distance > weapon.range) continue;
    const aim = forward.dot(toMonster.normalize());
    const threshold = weapon.id === "knife" ? 0.58 : weapon.id === "m667" ? 0.82 : 0.94;
    const score = aim / Math.max(distance, 0.2);
    if (aim > threshold && score > bestScore) {
      bestScore = score;
      bestMonster = monster;
    }
  }

  if (bestMonster) {
    bestMonster.hp -= weapon.damage;
    state.message = `${weapon.shortName} hit ${bestMonster.kind.toUpperCase()}`;
    if (bestMonster.hp <= 0) {
      bestMonster.alive = false;
      state.message = `${bestMonster.kind.toUpperCase()} neutralized`;
    }
  }
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
