// Takes the six phone screenshots used by demo/index.html, in guest mode.
// With the page server (dev/serve.ps1) and emulators running: node tests/demo-shots.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../demo/shots/', import.meta.url));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const button = (name) => page.getByRole('button', { name, exact: true }).first();
async function shot(name) {
  await page.addStyleTag({ content: '.firebase-emulator-warning{display:none!important}' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + name + '.png' });
  console.log('saved', name);
}
async function group(name, icon, people) {
  await button('New group').click();
  await page.fill('#new-group-name', name);
  await page.getByRole('button', { name: icon, exact: true }).first().click();
  for (const n of people) { await page.fill('#add-name', n); await button('Add').click(); }
  await button('Create group').click();
}
async function bill(title, items) {
  await button('Add a bill').click();
  await page.fill('#bill-title', title);
  for (const [n, p] of items) { await page.fill('#new-item-name', n); await page.fill('#new-item-price', String(p)); await button('Add').click(); }
}
async function home() { for (let i = 0; i < 4; i++) await button('Back').click({ timeout: 1500 }).catch(() => {}); }

await page.goto('http://localhost:8765/?emu');
await shot('1-welcome');
await button('Continue as guest').click();
for (const [g, icon, ppl] of [['Bubble tea', 'Bubble tea', ['Mei']], ['KTV Saturday', 'KTV', ['Sean', 'Mei']], ['Yangmingshan', 'Hiking', ['Dana']]]) {
  await group(g, icon, ppl);
  await home();
}
await group('Hotpot crew', 'Hotpot', ['Dana', 'Mei', 'Sean']);
await bill('Hotpot night', [['Spicy & herbal pot', 980], ['Wagyu plate', 520], ['Taiwan Beer ×6', 360]]);
await page.evaluate(() => { document.activeElement.blur(); scrollBy(0, -120); });
await shot('4-new-bill');
await button('Save bill').click();
await shot('3-bill');
await button('Back').click();
await shot('2-group');
await page.getByRole('button', { name: /Settle up/ }).first().click();
await shot('5-settle');
await home();
await shot('6-home');
await browser.close();
