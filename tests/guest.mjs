// End-to-end check of guest mode (no sign-in, data kept on the phone), on a
// phone-sized screen against the Firebase emulators.
// Start the emulators (dev/emulators.ps1) and the page server (dev/serve.ps1), then:
//   node tests/guest.mjs [screenshot folder]
import { chromium } from 'playwright';
import { join } from 'node:path';

const BASE = 'http://localhost:8765/?emu';
const SHOTS = process.argv[2] || null;
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
let failures = 0;

function check(ok, what) {
  console.log((ok ? 'PASS ' : 'FAIL ') + what);
  if (!ok) failures++;
}
async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, name + '.png') });
}
async function seen(page, text, timeout = 10000) {
  try { await page.getByText(text, { exact: false }).first().waitFor({ timeout }); return true; } catch (e) { return false; }
}
const button = (page, name) => page.getByRole('button', { name, exact: true }).first();
async function tab(page, name) {
  const it = page.locator('nav.tabbar').getByRole('button', { name: new RegExp('^' + name) });
  for (let i = 0; i < 4 && !(await it.isVisible()); i++) await button(page, 'Back').click().catch(() => {});
  await it.click();
}
async function mainText(page) { return page.locator('main').innerText(); }

const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext(phone);
const shared = [];
// Exchange rates: a fixed answer (1 US$ = NT$32), so the converted amounts are known.
await ctx.route('**/currencies/usd.min.json', (route) => route.fulfill({ json: { date: '2026-10-24', usd: { usd: 1, twd: 32, jpy: 150 } } }));
await ctx.route('https://line.me/**', (route) => { shared.push(new URL(route.request().url()).searchParams.get('text') || ''); route.fulfill({ body: 'LINE' }); });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));

try {
  // 1. The welcome screen offers both ways in.
  await page.goto(BASE);
  check(await seen(page, 'Continue as guest'), 'welcome shows Continue as guest');
  check(await seen(page, 'Sign in with Google'), 'welcome shows Sign in with Google');
  check(await seen(page, 'Saved on this phone only'), 'guest hint is shown');
  await shot(page, 'g01-welcome');

  // 2. In as a guest: the groups list with the guest bar.
  await button(page, 'Continue as guest').click();
  check(await seen(page, 'Guest · saved on this phone only'), 'guest bar is shown');
  await shot(page, 'g02-guest-home');
  check(!(await seen(page, 'A new version of Tab is ready', 1500)), 'no update banner while this is the newest version');
  // The site publishes a newer version: when Tab comes back on screen it offers to update.
  await page.route(/\/\?v=\d+$/, async (route) => {
    const res = await route.fetch();
    route.fulfill({ response: res, body: (await res.text()).replace(/(name="tab-version" content=")[^"]*/, '$1999999999999') });
  });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  check(await seen(page, 'A new version of Tab is ready', 5000), 'a newer version on the site shows the update banner');
  await page.unroute(/\/\?v=\d+$/);

  // 3. A group with typed names; the last name is typed but not added.
  await button(page, 'New group').click();
  await page.fill('#new-group-name', 'Hotpot');
  await page.fill('#add-name', 'Dana');
  await button(page, 'Add').click();
  await page.fill('#add-name', 'Sean');
  await shot(page, 'g03-new-group');
  await button(page, 'Create group').click();
  check(await seen(page, '3 members'), 'the group has the guest, Dana and Sean');
  check(!(await mainText(page)).includes('Group chat'), 'no group chat for a guest');

  // 4. AI asks for sign-in.
  await button(page, 'Split with AI').click();
  check(await seen(page, 'Sign in to use AI'), 'Split with AI asks to sign in');
  await shot(page, 'g04-ai-locked');
  await button(page, 'Not now').click();

  // 5. A bill the guest paid: 900 shared by three.
  await button(page, 'Add a bill').click();
  await page.fill('#bill-title', 'Hotpot night');
  await page.fill('#new-item-name', 'Pot');
  await page.fill('#new-item-price', '900');
  await button(page, 'Add').click();
  check(await page.getByRole('button', { name: 'Scan a receipt' }).count() > 0 || await seen(page, 'Scan', 2000), 'scan button is still shown');
  await button(page, 'Save bill').click();
  check(await seen(page, 'NT$900'), 'the bill shows NT$900');
  check(await seen(page, 'NT$300'), 'each share is NT$300');
  await button(page, 'Send in LINE').click();
  await page.waitForTimeout(500);
  check(shared.some((s) => s.includes('Hotpot night')), 'Send in LINE works for a guest');

  // 6. Kept after a reload.
  await page.reload();
  check(await seen(page, 'Hotpot'), 'the group is still there after a reload');
  check(await seen(page, 'Guest · saved on this phone only'), 'still a guest after a reload');
  check(await seen(page, '+NT$600'), 'the guest is owed NT$600');

  // 7. Members: add someone by name.
  await page.getByRole('button', { name: /Hotpot/ }).first().click();
  await page.getByRole('button', { name: 'Members', exact: true }).click();
  await page.fill('#add-name', 'Eve');
  await button(page, 'Add').click();
  check(await seen(page, '4 members'), 'Eve is added in Members');
  await button(page, 'Back').click();

  // 8. Settle: mark a payment.
  await page.getByRole('button', { name: /Settle up/ }).first().click();
  await button(page, 'Mark as paid').click();
  check(await seen(page, 'Recent payments', 5000) || await seen(page, 'Undo', 5000), 'a payment is marked as paid');

  // 9. Friends asks to sign in. Reached by sliding a finger along the tab bar
  // from Groups to Friends and letting go there.
  await tab(page, 'Groups');
  const bar = page.locator('nav.tabbar');
  const from = await bar.getByRole('button', { name: /^Groups/ }).boundingBox();
  const to = await bar.getByRole('button', { name: /^Friends/ }).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(from.x + from.width / 2 + (to.x - from.x) * k / 8, from.y + from.height / 2);
  await page.mouse.up();
  check(await seen(page, 'Sign in to add friends'), 'sliding along the tab bar to Friends opens it, and Friends asks to sign in');

  // 9b. A group in US dollars: cents in shares and settling, and totals converted.
  await tab(page, 'Groups');
  await button(page, 'New group').click();
  await page.fill('#new-group-name', 'NYC trip');
  await page.selectOption('#new-group-currency', 'USD');
  for (const n of ['Ava', 'Ben']) { await page.fill('#add-name', n); await button(page, 'Add').click(); }
  await button(page, 'Create group').click();
  await button(page, 'Add a bill').click();
  await page.fill('#bill-title', 'Pizza');
  await page.fill('#new-item-name', 'Pizza');
  await page.fill('#new-item-price', '10');
  await button(page, 'Add').click();
  await button(page, 'Save bill').click();
  check(await seen(page, 'US$3.33') && await seen(page, 'US$3.34'), 'US$10.00 three ways shows US$3.33, US$3.33 and US$3.34');
  check(await seen(page, '6.66'), 'the guest gets back US$6.66');
  await shot(page, 'g05b-usd-bill');
  await button(page, 'Back').click();
  await page.getByRole('button', { name: /Settle up/ }).first().click();
  check(await seen(page, 'US$3.33'), 'Settle up shows cents');
  await tab(page, 'Groups');
  check(await seen(page, "Converted at today's rate"), 'the Home total converts the US$ group into NT$');
  check(await seen(page, '≈ NT$213'), 'the US$ tile shows about NT$213 (US$6.66 × 32)');
  await shot(page, 'g05c-converted');
  await tab(page, 'Me');
  await page.selectOption('#me-currency', 'USD');
  await tab(page, 'Groups');
  check(await seen(page, '≈ US$'), 'with totals in US$, the NT$ group shows its amount in US$');
  await tab(page, 'Me');
  await page.selectOption('#me-currency', 'TWD');
  await shot(page, 'g05-friends');

  // 10. Me: the note, and back to the welcome screen with the groups kept.
  await tab(page, 'Me');
  check(await seen(page, 'Guest data is on this phone only'), 'Me explains where guest data is');
  await shot(page, 'g06-me');
  await page.locator('.banner.guest').getByRole('button', { name: 'Sign in' }).click();
  check(await seen(page, 'Your guest groups are still here'), 'welcome says the guest groups are still here');
  await button(page, 'Continue as guest').click();
  check(await seen(page, 'Hotpot'), 'back to the same guest groups');

  // 11. Signing in without an invite offers guest mode again.
  await page.locator('.banner.guest').getByRole('button', { name: 'Sign in' }).click();
  await page.evaluate(() => window.Tab.store.testSignIn('stranger@example.com'));
  check(await seen(page, 'You need an invite'), 'an account without an invite gets the invite screen');
  await button(page, 'Continue as guest').click();
  check(await seen(page, 'Hotpot', 15000), 'Continue as guest there returns to the guest groups');
  check(await seen(page, 'Guest · saved on this phone only'), 'and it is guest mode again');

  // 12. Delete guest data.
  await tab(page, 'Me');
  await button(page, 'Delete guest data').click();
  await button(page, 'Delete').click();
  check(await seen(page, 'Continue as guest'), 'deleting goes back to the welcome screen');
  check(await seen(page, 'No account. Saved on this phone only'), 'and the guest data is gone');
  await button(page, 'Continue as guest').click();
  check(await seen(page, 'No groups yet'), 'a new guest starts with no groups');

  // 13. Chinese.
  await page.evaluate(() => window.Tab.store.leaveGuest());
  await page.getByRole('button', { name: /Switch language|中文|language/i }).first().click();
  check(await seen(page, '以訪客身分使用'), 'welcome in Chinese');
  await shot(page, 'g07-welcome-zh');
} catch (e) {
  failures++;
  console.log('FAIL stopped: ' + e.message.split('\n')[0]);
  await shot(page, 'g99-stopped');
}

check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
