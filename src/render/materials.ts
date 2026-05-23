import * as THREE from "three";

export type GameMaterials = ReturnType<typeof createMaterials>;

export function createMaterials() {
  const floorTexture = createFloorTexture();
  const wallTexture = createWallTexture();
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(18, 18);
  wallTexture.wrapS = THREE.RepeatWrapping;
  wallTexture.wrapT = THREE.RepeatWrapping;

  return {
    floor: new THREE.MeshStandardMaterial({
      map: floorTexture,
      color: "#d6f5ff",
      emissive: "#0b1d25",
      emissiveIntensity: 0.34,
      roughness: 0.68,
      metalness: 0.18,
    }),
    wall: new THREE.MeshStandardMaterial({
      map: wallTexture,
      color: "#d8f2ff",
      emissive: "#0d1b27",
      emissiveIntensity: 0.38,
      roughness: 0.62,
      metalness: 0.28,
    }),
    neonCyan: new THREE.MeshStandardMaterial({
      color: "#55f4ff",
      emissive: "#17d9ff",
      emissiveIntensity: 2.4,
      roughness: 0.25,
    }),
    neonMagenta: new THREE.MeshStandardMaterial({
      color: "#ff4dd8",
      emissive: "#ff26c2",
      emissiveIntensity: 1.25,
      roughness: 0.25,
    }),
    chest: new THREE.MeshStandardMaterial({
      color: "#202834",
      emissive: "#01334b",
      emissiveIntensity: 0.45,
      roughness: 0.38,
      metalness: 0.72,
    }),
    chestOpen: new THREE.MeshStandardMaterial({
      color: "#4a3920",
      emissive: "#ffb936",
      emissiveIntensity: 1.1,
      roughness: 0.42,
      metalness: 0.42,
    }),
    exitLocked: new THREE.MeshStandardMaterial({
      color: "#29313c",
      emissive: "#ff6d2d",
      emissiveIntensity: 1.4,
      roughness: 0.45,
      metalness: 0.7,
    }),
    exitReady: new THREE.MeshStandardMaterial({
      color: "#203d39",
      emissive: "#54ffc6",
      emissiveIntensity: 2,
      roughness: 0.35,
      metalness: 0.65,
    }),
    skull: new THREE.MeshStandardMaterial({
      color: "#d8f7ff",
      emissive: "#4bf2ff",
      emissiveIntensity: 0.7,
      roughness: 0.42,
    }),
    zombie: new THREE.MeshStandardMaterial({
      color: "#6dff9b",
      emissive: "#18b85b",
      emissiveIntensity: 0.55,
      roughness: 0.6,
    }),
  };
}

function createFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");

  context.fillStyle = "#25313c";
  context.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      context.fillStyle = (x + y) % 128 === 0 ? "#344251" : "#2b3744";
      context.fillRect(x, y, 62, 62);
      context.strokeStyle = "#5f7284";
      context.lineWidth = 2;
      context.strokeRect(x + 1, y + 1, 60, 60);
      context.fillStyle = x % 128 === 0 ? "#0df2ff" : "#ff39c7";
      context.globalAlpha = 0.42;
      context.fillRect(x + 8, y + 30, 34, 3);
      context.fillRect(x + 40, y + 30, 3, 20);
      context.globalAlpha = 0.22;
      context.fillRect(x + 12, y + 12, 9, 9);
      context.globalAlpha = 1;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");

  context.fillStyle = "#303c49";
  context.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 48) {
    for (let x = 0; x < 256; x += 80) {
      context.fillStyle = y % 96 === 0 ? "#425160" : "#384756";
      context.fillRect(x, y, 78, 46);
      context.strokeStyle = "#121b24";
      context.strokeRect(x + 0.5, y + 0.5, 77, 45);
      context.strokeStyle = "#6d8192";
      context.globalAlpha = 0.45;
      context.strokeRect(x + 6.5, y + 7.5, 25, 13);
      context.globalAlpha = 1;
    }
  }
  context.strokeStyle = "#13efff";
  context.globalAlpha = 0.78;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(18, 36);
  context.lineTo(116, 36);
  context.lineTo(116, 88);
  context.lineTo(210, 88);
  context.stroke();
  context.strokeStyle = "#ff43ce";
  context.beginPath();
  context.moveTo(44, 180);
  context.lineTo(176, 180);
  context.lineTo(176, 130);
  context.stroke();
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
