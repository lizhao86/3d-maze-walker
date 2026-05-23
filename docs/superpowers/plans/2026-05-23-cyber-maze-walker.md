# Cyber Maze Walker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable first-person cyberpunk maze escape prototype with random maze generation, chests, weapons, monsters, HUD, and an exit objective.

**Architecture:** Use a Vite + TypeScript + Three.js app. Keep maze/game state in simulation modules, render objects in Three.js adapters, and HUD/menu controls in DOM/CSS so gameplay and presentation can evolve separately.

**Tech Stack:** Vite, TypeScript, Three.js, Vitest, DOM HUD.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/style.css`

- [x] Create a Vite TypeScript project with Three.js and Vitest scripts.
- [x] Add a full-screen app shell with no browser default margins.

### Task 2: Simulation

**Files:**
- Create: `src/simulation/types.ts`
- Create: `src/simulation/weapons.ts`
- Create: `src/simulation/maze.ts`
- Create: `src/simulation/maze.test.ts`
- Create: `src/simulation/gameState.ts`

- [x] Generate an odd-sized maze with a start and far exit.
- [x] Place chests and monsters on walkable cells.
- [x] Track player health, inventory, ammo, key fragments, chests, monsters, and win/loss state.
- [x] Add tests for maze dimensions, start/exit walkability, and exit distance.

### Task 3: Rendering And Controls

**Files:**
- Create: `src/render/materials.ts`
- Create: `src/render/world.ts`
- Create: `src/main.ts`

- [x] Render floor, walls, neon wall strips, chests, monsters, exit door, and first-person weapon.
- [x] Add pointer-lock mouselook and WASD movement with wall collision.
- [x] Add open chest, weapon switch, and fire weapon actions.

### Task 4: HUD

**Files:**
- Create: `src/ui/hud.ts`
- Modify: `src/style.css`

- [x] Build a compact cyberpunk HUD with HP, objective, minimap, crosshair, hotbar, ammo, prompt, and start overlay.
- [x] Keep center view clear during movement and combat.

### Task 5: Verification

**Files:**
- Modify as needed based on verification.

- [x] Run `npm install`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Launch the dev server and playtest in a browser.
