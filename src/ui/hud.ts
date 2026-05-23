import type { GameState } from "../simulation/types";
import { WEAPONS } from "../simulation/weapons";
import { REQUIRED_KEY_FRAGMENTS } from "../simulation/gameState";

export type Hud = ReturnType<typeof createHud>;

export function createHud(container: HTMLElement, state: GameState) {
  container.innerHTML = `
    <canvas id="game-canvas"></canvas>
    <div class="vignette"></div>
    <div class="scanlines"></div>
    <div class="hud">
      <section class="status-panel">
        <div class="label">HP</div>
        <div class="hp-bar"><div class="hp-fill"></div></div>
        <div class="hp-value">100</div>
      </section>
      <section class="objective-panel">
        <div class="objective-title">OBJECTIVE</div>
        <div class="objective-copy">Find key fragments and reach the exit.</div>
      </section>
      <section class="minimap-panel">
        <canvas class="minimap" width="132" height="132"></canvas>
      </section>
      <div class="crosshair"><span></span><span></span></div>
      <section class="weapon-panel">
        <div class="weapon-name">Tactical Knife</div>
        <div class="ammo-readout">READY</div>
      </section>
      <section class="hotbar"></section>
      <div class="prompt"></div>
      <div class="message"></div>
    </div>
    <button class="start-overlay" type="button">
      <span class="title">3D Maze Walker</span>
      <span class="subtitle">Cyber maze prototype</span>
      <span class="start-text">Click to enter</span>
      <span class="controls">WASD move · Mouse look · E open · Click fire · 1-7 switch</span>
    </button>
  `;

  const canvas = container.querySelector<HTMLCanvasElement>("#game-canvas");
  const hpFill = container.querySelector<HTMLElement>(".hp-fill");
  const hpValue = container.querySelector<HTMLElement>(".hp-value");
  const objectiveCopy = container.querySelector<HTMLElement>(".objective-copy");
  const weaponName = container.querySelector<HTMLElement>(".weapon-name");
  const ammoReadout = container.querySelector<HTMLElement>(".ammo-readout");
  const hotbar = container.querySelector<HTMLElement>(".hotbar");
  const prompt = container.querySelector<HTMLElement>(".prompt");
  const message = container.querySelector<HTMLElement>(".message");
  const minimap = container.querySelector<HTMLCanvasElement>(".minimap");
  const startOverlay = container.querySelector<HTMLButtonElement>(".start-overlay");

  if (!canvas || !hpFill || !hpValue || !objectiveCopy || !weaponName || !ammoReadout || !hotbar || !prompt || !message || !minimap || !startOverlay) {
    throw new Error("HUD failed to initialize.");
  }

  const api = {
    canvas,
    startOverlay,
    setPrompt(copy: string) {
      prompt.textContent = copy;
      prompt.classList.toggle("visible", copy.length > 0);
    },
    update(nextState: GameState) {
      const hpPercent = Math.max(0, nextState.player.hp / nextState.player.maxHp);
      hpFill.style.transform = `scaleX(${hpPercent})`;
      hpValue.textContent = `${Math.ceil(nextState.player.hp)}`;
      objectiveCopy.textContent =
        nextState.status === "playing"
          ? `Keys ${nextState.player.keyFragments}/${REQUIRED_KEY_FRAGMENTS} · Find the exit door`
          : nextState.message;

      const selected = WEAPONS[nextState.player.selectedWeapon];
      weaponName.textContent = selected.name;
      const ammo = nextState.player.ammo[selected.id] ?? 0;
      ammoReadout.textContent = selected.ammoCost === 0 ? "READY" : `${ammo} rounds`;
      message.textContent = nextState.message;
      message.classList.toggle("danger", nextState.status === "lost");
      message.classList.toggle("success", nextState.status === "won");

      hotbar.innerHTML = nextState.player.inventory
        .map((weaponId, index) => {
          const weapon = WEAPONS[weaponId];
          const selectedClass = weaponId === nextState.player.selectedWeapon ? " selected" : "";
          return `<button class="slot${selectedClass}" data-slot="${index}" style="--slot-color:${weapon.color}">
            <span class="slot-number">${index + 1}</span>
            <span class="slot-icon">${weapon.shortName}</span>
          </button>`;
        })
        .join("");

      drawMinimap(minimap, nextState);
    },
  };

  api.update(state);
  return api;
}

function drawMinimap(canvas: HTMLCanvasElement, state: GameState): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const { maze } = state;
  const scale = canvas.width / maze.width;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(3, 8, 14, 0.92)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      context.fillStyle = maze.cells[y][x] === 1 ? "#293645" : "#07151d";
      context.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
    }
  }

  context.fillStyle = "#ffb72f";
  for (const chest of state.chests) {
    if (!chest.opened) {
      context.fillRect(chest.grid.x * scale, chest.grid.y * scale, scale, scale);
    }
  }

  context.fillStyle = "#ff4fce";
  for (const monster of state.monsters) {
    if (monster.alive) {
      context.fillRect(monster.grid.x * scale, monster.grid.y * scale, scale, scale);
    }
  }

  context.fillStyle = "#51ffc8";
  context.fillRect(maze.exit.x * scale, maze.exit.y * scale, scale * 1.5, scale * 1.5);

  const playerGridX = state.player.position.x / 4 + maze.width / 2;
  const playerGridY = state.player.position.z / 4 + maze.height / 2;
  context.fillStyle = "#e9fbff";
  context.beginPath();
  context.arc(playerGridX * scale, playerGridY * scale, Math.max(2.5, scale * 0.8), 0, Math.PI * 2);
  context.fill();
}
