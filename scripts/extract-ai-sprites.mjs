import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const generatedRoot = path.join(root, "public", "assets", "generated");
const outputRoot = path.join(root, "public", "assets", "sprites-ai");
const docsRoot = path.join(root, "docs");

const weapons = [
  ["knife", "Tactical knife"],
  ["m9", "M9 pistol"],
  ["glock29", "Glock 29 pistol"],
  ["scarlm", "SCAR-LM rifle"],
  ["m134", "9M 134 minigun"],
  ["m667", "M667 sci-fi shotgun"],
  ["barrett", "Barrett M82A1 sniper"],
];
const weaponPoses = [
  ["idle", "First-person idle/ready pose"],
  ["attack", "First-person attack pose, includes slash or muzzle effect"],
  ["side", "Side-view pickup and HUD icon"],
];

const weaponSources = {
  knife: {
    idle: { x: 0, y: 0, width: 512, height: 135 },
    attack: { x: 512, y: 0, width: 512, height: 135 },
    side: { x: 1024, y: 0, width: 512, height: 135 },
  },
  m9: {
    idle: { x: 0, y: 145, width: 512, height: 140 },
    attack: { x: 512, y: 164, width: 512, height: 121 },
    side: { x: 1024, y: 145, width: 512, height: 140 },
  },
  glock29: {
    idle: { x: 0, y: 316, width: 512, height: 108 },
    attack: { x: 512, y: 300, width: 512, height: 124 },
    side: { x: 1024, y: 316, width: 512, height: 108 },
  },
  scarlm: {
    idle: { x: 0, y: 432, width: 512, height: 135 },
    attack: { x: 512, y: 432, width: 512, height: 135 },
    side: { x: 1024, y: 432, width: 512, height: 135 },
  },
  m134: {
    idle: { x: 0, y: 578, width: 512, height: 138 },
    attack: { x: 512, y: 578, width: 512, height: 138 },
    side: { x: 1024, y: 578, width: 512, height: 138 },
  },
  m667: {
    idle: { x: 0, y: 722, width: 512, height: 138 },
    attack: { x: 512, y: 722, width: 512, height: 138 },
    side: { x: 1024, y: 722, width: 512, height: 138 },
  },
  barrett: {
    idle: { x: 0, y: 874, width: 512, height: 150 },
    attack: { x: 512, y: 874, width: 512, height: 150 },
    side: { x: 1024, y: 874, width: 512, height: 150 },
  },
};

const weaponTasks = weapons.flatMap(([weaponId, label]) =>
  weaponPoses.map(([pose, use]) => ({
    group: "Weapon",
    id: weaponId,
    state: pose,
    label,
    use,
    sheet: "weapons",
    name: `weapons/${weaponId}-${pose}.png`,
    source: weaponSources[weaponId][pose],
    pad: pose === "attack" ? 14 : 10,
  })),
);

const monsterTasks = [
  monster("zombie", "walk", 0, "Cyber zombie", "Walking animation frame 1", 34, 20, 188, 235),
  monster("zombie", "walk", 1, "Cyber zombie", "Walking animation frame 2", 254, 20, 188, 235),
  monster("zombie", "walk", 2, "Cyber zombie", "Walking animation frame 3", 430, 20, 230, 235),
  monster("zombie", "walk", 3, "Cyber zombie", "Walking animation frame 4", 635, 20, 235, 235),
  monster("zombie", "hit", 0, "Cyber zombie", "Hit reaction frame 1", 910, 25, 235, 235),
  monster("zombie", "hit", 1, "Cyber zombie", "Hit reaction frame 2", 1162, 25, 250, 235),
  monster("zombie", "attack", 0, "Cyber zombie", "Attack animation frame 1", 30, 270, 238, 250),
  monster("zombie", "attack", 1, "Cyber zombie", "Attack animation frame 2", 335, 270, 275, 250),
  monster("zombie", "attack", 2, "Cyber zombie", "Attack animation frame 3", 630, 270, 270, 250),
  monster("zombie", "dead", 0, "Cyber zombie", "Dead/lying down frame", 990, 345, 430, 150),
  monster("skull", "walk", 0, "Cyber skull drone", "Hover/walk animation frame 1", 24, 540, 210, 185),
  monster("skull", "walk", 1, "Cyber skull drone", "Hover/walk animation frame 2", 250, 540, 210, 185),
  monster("skull", "walk", 2, "Cyber skull drone", "Hover/walk animation frame 3", 478, 540, 210, 185),
  monster("skull", "walk", 3, "Cyber skull drone", "Hover/walk animation frame 4", 700, 540, 210, 185),
  monster("skull", "hit", 0, "Cyber skull drone", "Hit reaction frame 1", 910, 540, 235, 185),
  monster("skull", "hit", 1, "Cyber skull drone", "Hit reaction frame 2", 1168, 540, 235, 185),
  monster("skull", "attack", 0, "Cyber skull drone", "Attack animation frame 1", 22, 750, 190, 235),
  monster("skull", "attack", 1, "Cyber skull drone", "Attack animation frame 2", 260, 750, 220, 235),
  monster("skull", "attack", 2, "Cyber skull drone", "Attack animation frame 3", 515, 750, 210, 235),
  monster("skull", "dead", 0, "Cyber skull drone", "Broken/dead frame", 745, 760, 160, 225),
  prop("chest", "Loot chest", "Chest object in the maze", 900, 760, 285, 220),
  prop("exit", "Exit portal", "Exit door/portal object in the maze", 1180, 690, 335, 315),
];

const tasks = [...weaponTasks, ...monsterTasks];

function monster(kind, state, frame, label, use, x, y, width, height) {
  return {
    group: "Monster",
    id: kind,
    state: `${state}-${frame}`,
    label,
    use,
    sheet: "monsters",
    name: `monsters/${kind}-${state}-${frame}.png`,
    source: { x, y, width, height },
    pad: 10,
  };
}

function prop(kind, label, use, x, y, width, height) {
  return {
    group: "Prop",
    id: kind,
    state: "single",
    label,
    use,
    sheet: "monsters",
    name: `props/${kind}.png`,
    source: { x, y, width, height },
    pad: 10,
  };
}

const sheetDataUrls = {
  weapons: await dataUrl(path.join(generatedRoot, "sprite-sheet-weapons-ai.png")),
  monsters: await dataUrl(path.join(generatedRoot, "sprite-sheet-monsters-ai.png")),
};

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const extracted = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><meta charset='utf-8'><body></body>");

  for (const task of tasks) {
    const result = await page.evaluate(
      async ({ task, sheetDataUrl }) => {
        function removeEdgeWhite(context, width, height) {
          const imageData = context.getImageData(0, 0, width, height);
          const queue = [];
          const seen = new Uint8Array(width * height);
          const push = (x, y) => {
            if (x < 0 || y < 0 || x >= width || y >= height) return;
            const pixel = y * width + x;
            if (seen[pixel]) return;
            seen[pixel] = 1;
            if (isNearWhite(imageData, pixel * 4)) queue.push(pixel);
          };

          for (let x = 0; x < width; x += 1) {
            push(x, 0);
            push(x, height - 1);
          }
          for (let y = 1; y < height - 1; y += 1) {
            push(0, y);
            push(width - 1, y);
          }

          while (queue.length > 0) {
            const pixel = queue.pop();
            imageData.data[pixel * 4 + 3] = 0;
            const x = pixel % width;
            const y = Math.floor(pixel / width);
            push(x + 1, y);
            push(x - 1, y);
            push(x, y + 1);
            push(x, y - 1);
          }
          context.putImageData(imageData, 0, 0);
        }

        function isNearWhite(imageData, index) {
          const red = imageData.data[index];
          const green = imageData.data[index + 1];
          const blue = imageData.data[index + 2];
          return red > 238 && green > 238 && blue > 238 && Math.max(red, green, blue) - Math.min(red, green, blue) < 22;
        }

        function trimBounds(context, width, height) {
          const imageData = context.getImageData(0, 0, width, height);
          let left = width;
          let top = height;
          let right = -1;
          let bottom = -1;
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              const alpha = imageData.data[(y * width + x) * 4 + 3];
              if (alpha > 8) {
                left = Math.min(left, x);
                top = Math.min(top, y);
                right = Math.max(right, x);
                bottom = Math.max(bottom, y);
              }
            }
          }
          if (right < left || bottom < top) return { left: 0, top: 0, width, height };
          return { left, top, width: right - left + 1, height: bottom - top + 1 };
        }

        function removeSmallBorderFragments(context, width, height) {
          const imageData = context.getImageData(0, 0, width, height);
          const seen = new Uint8Array(width * height);
          const components = [];
          for (let start = 0; start < width * height; start += 1) {
            if (seen[start] || imageData.data[start * 4 + 3] <= 8) continue;
            const stack = [start];
            const pixels = [];
            let touchesBorder = false;
            seen[start] = 1;
            while (stack.length > 0) {
              const pixel = stack.pop();
              pixels.push(pixel);
              const x = pixel % width;
              const y = Math.floor(pixel / width);
              touchesBorder ||= x === 0 || y === 0 || x === width - 1 || y === height - 1;
              for (const next of [pixel - 1, pixel + 1, pixel - width, pixel + width]) {
                if (next < 0 || next >= width * height || seen[next]) continue;
                const nx = next % width;
                if ((next === pixel - 1 && nx === width - 1) || (next === pixel + 1 && nx === 0)) continue;
                if (imageData.data[next * 4 + 3] <= 8) continue;
                seen[next] = 1;
                stack.push(next);
              }
            }
            components.push({ pixels, touchesBorder });
          }

          const largestArea = Math.max(...components.map((component) => component.pixels.length), 0);
          for (const component of components) {
            if (!component.touchesBorder || component.pixels.length > largestArea * 0.6) continue;
            for (const pixel of component.pixels) {
              imageData.data[pixel * 4 + 3] = 0;
            }
          }
          context.putImageData(imageData, 0, 0);
        }

        const sheet = new Image();
        sheet.src = sheetDataUrl;
        await sheet.decode();

        const crop = document.createElement("canvas");
        crop.width = Math.round(task.source.width);
        crop.height = Math.round(task.source.height);
        const cropContext = crop.getContext("2d");
        cropContext.drawImage(
          sheet,
          task.source.x,
          task.source.y,
          task.source.width,
          task.source.height,
          0,
          0,
          crop.width,
          crop.height,
        );
        removeEdgeWhite(cropContext, crop.width, crop.height);
        removeSmallBorderFragments(cropContext, crop.width, crop.height);
        const bounds = trimBounds(cropContext, crop.width, crop.height);

        const output = document.createElement("canvas");
        output.width = bounds.width + task.pad * 2;
        output.height = bounds.height + task.pad * 2;
        const outputContext = output.getContext("2d");
        outputContext.drawImage(
          crop,
          bounds.left,
          bounds.top,
          bounds.width,
          bounds.height,
          task.pad,
          task.pad,
          bounds.width,
          bounds.height,
        );

        return {
          base64: output.toDataURL("image/png").split(",")[1],
          width: output.width,
          height: output.height,
          source: task.source,
          bounds,
        };
      },
      { task, sheetDataUrl: sheetDataUrls[task.sheet] },
    );

    const outputPath = path.join(outputRoot, task.name);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(result.base64, "base64"));
    extracted.push({ ...task, width: result.width, height: result.height, source: result.source, bounds: result.bounds });
  }
} finally {
  await browser.close();
}

await writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(extracted.map(toManifestEntry), null, 2)}\n`);
await mkdir(docsRoot, { recursive: true });
await writeFile(path.join(docsRoot, "sprite-asset-map.md"), buildMarkdown(extracted));

console.log(`Extracted ${tasks.length} AI sprite files to ${path.relative(root, outputRoot)}`);
console.log(`Wrote ${path.relative(root, path.join(outputRoot, "manifest.json"))}`);
console.log(`Wrote ${path.relative(root, path.join(docsRoot, "sprite-asset-map.md"))}`);

async function dataUrl(filePath) {
  const bytes = await readFile(filePath);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function toManifestEntry(entry) {
  return {
    file: `public/assets/sprites-ai/${entry.name}`.replaceAll("\\", "/"),
    group: entry.group,
    id: entry.id,
    state: entry.state,
    label: entry.label,
    use: entry.use,
    width: entry.width,
    height: entry.height,
    sourceSheet: entry.sheet,
    sourceRect: entry.source,
  };
}

function buildMarkdown(entries) {
  const rows = entries
    .map((entry) => {
      const file = `public/assets/sprites-ai/${entry.name}`.replaceAll("\\", "/");
      return `| ${entry.group} | ${entry.id} | ${entry.state} | ${entry.label} | ${entry.use} | ${entry.width}x${entry.height} | \`${file}\` |`;
    })
    .join("\n");

  return `# Sprite Asset Map\n\nThis table maps each generated sprite file to its gameplay meaning. These PNG files are individually cropped from the AI white-background sheets, then white edge pixels are removed. Each file keeps its own natural size instead of being forced into one shared sprite size.\n\n| Type | ID | State | Name | Use | PNG size | File |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}\n`;
}
