// usage: node scripts/svg2png.mjs <dir>   - converts every .svg in <dir> to a .png next to it (needs playwright + chromium)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/opt/node-tools/node_modules/playwright/index.mjs");
const dir = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage();
for (const f of readdirSync(dir).filter((x) => x.endsWith(".svg"))) {
  const svg = readFileSync(join(dir, f), "utf8");
  const m = svg.match(/width="(\d+)" height="(\d+)"/);
  await pg.setViewportSize({ width: Math.min(1600, +m[1]), height: Math.min(1400, +m[2]) });
  await pg.setContent(`<body style="margin:0;background:#07121f">${svg}</body>`);
  await pg.screenshot({ path: join(dir, f.replace(/\.svg$/, ".png")) });
  console.log(f);
}
await b.close();
