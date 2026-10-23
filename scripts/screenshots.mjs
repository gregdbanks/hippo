#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '..');
const base = process.env.HIPPO_DEMO_URL ?? 'http://localhost:5174/demo/index.html';
const tours = JSON.parse(fs.readFileSync(path.join(repo, 'src/client/tours/tours.json'), 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(path.join(repo, 'src/client/demo/snapshot.json'), 'utf8'));
const home = snapshot.inventory.home;
const outDir = path.join(repo, 'src/client/tours/img');
const viewport = { width: 1280, height: 800 };
const clip = { x: 240, y: 0, width: 1040, height: 800 };

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

async function run(page, action) {
  if (action.click) await page.locator(action.click).first().click();
  else if (action.type) await page.locator(action.type.selector).first().fill(action.type.text);
  else if (action.press) await page.keyboard.press(action.press);
  else if (action.wait) await page.waitForTimeout(action.wait);
}

const browser = await chromium.launch();
const shots = {};
const problems = [];

for (const tour of tours) {
  for (const [i, step] of tour.steps.entries()) {
    const key = `${tour.id}-${i + 1}`;
    const page = await browser.newPage({ viewport, colorScheme: 'dark' });
    await page.addInitScript(() => localStorage.setItem('hippo-tour-seen', '1'));
    const route = (step.capture ?? step.route).replaceAll('{home}', home);
    await page.goto(`${base}#${route}`);
    await page.locator('.main-content h1').first().waitFor();
    await page.waitForTimeout(500);
    for (const action of step.actions ?? []) await run(page, action);

    const first = step.hotspots[0] && page.locator(step.hotspots[0].selector).first();
    if (first && (await first.count())) await first.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    const hotspots = [];
    for (const hotspot of step.hotspots) {
      const box = await page.locator(hotspot.selector).first().boundingBox().catch(() => null);
      if (!box) { problems.push(`${key}: no element for ${hotspot.selector}`); continue; }
      hotspots.push({
        label: hotspot.label,
        x: +(((box.x - clip.x + box.width / 2) / clip.width) * 100).toFixed(2),
        y: +(((box.y - clip.y + box.height / 2) / clip.height) * 100).toFixed(2),
        box: [(box.x - clip.x) / clip.width, (box.y - clip.y) / clip.height, box.width / clip.width, box.height / clip.height].map(n => +(n * 100).toFixed(2)),
      });
    }
    await page.screenshot({ path: path.join(outDir, `${key}.jpg`), type: 'jpeg', quality: 82, clip });
    shots[key] = { hotspots };
    await page.close();
    console.log(`${key}  ${hotspots.length}/${step.hotspots.length} hotspots`);
  }
}

await browser.close();
fs.writeFileSync(path.join(repo, 'src/client/tours/shots.json'), JSON.stringify(shots, null, 2) + '\n');
if (problems.length) {
  console.error('\nMissing hotspots:\n' + problems.join('\n'));
  process.exit(1);
}
