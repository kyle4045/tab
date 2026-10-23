// Quick check of the published site on a phone-sized screen, signed out.
//   node tests/live.mjs [url] [screenshot folder]
import { chromium } from 'playwright';
import { join } from 'node:path';

const URL_ = process.argv[2] || 'https://kyle4045.github.io/tab/';
const SHOTS = process.argv[3] || null;
let failures = 0;
function check(ok, what) { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) failures++; }

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(URL_)) problems.push(r.status() + ' ' + r.url()); });

  await page.goto(URL_, { waitUntil: 'networkidle' });
  const seen = (t) => page.getByText(t).first().waitFor({ timeout: 15000 }).then(() => true, () => false);
  check(await seen('Split bills with your friends'), 'the live site opens on the sign-in screen');
  check(await page.getByRole('button', { name: 'Sign in with Google' }).isVisible(), 'the Google sign-in button is there');
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'live-sign-in.png') });

  await page.reload({ waitUntil: 'networkidle' });
  check(await seen('Split bills with your friends'), 'a refresh keeps working (no 404)');

  // Guest mode: a group kept on the phone, still there after a refresh.
  await page.getByRole('button', { name: 'Continue as guest' }).click();
  check(await seen('Guest · saved on this phone only'), 'Continue as guest opens the guest groups');
  await page.getByRole('button', { name: 'New group', exact: true }).first().click();
  await page.fill('#new-group-name', 'Live check');
  await page.fill('#add-name', 'Dana');
  await page.getByRole('button', { name: 'Create group' }).click();
  check(await seen('2 members'), 'a guest can make a group');
  await page.reload({ waitUntil: 'networkidle' });
  check(await seen('Live check'), "the guest's group is still there after a refresh");
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'live-guest.png') });
  await page.evaluate(() => window.Tab.store.clearGuest());
  check(await seen('Continue as guest'), 'deleting guest data goes back to the welcome screen');

  await page.goto(URL_ + '?openExternalBrowser=1#join=0000000000000000000000000000000000ff', { waitUntil: 'networkidle' });
  check(await seen("You're invited"), 'an invite link shows "You\'re invited"');
  check(page.url() === URL_, 'the invite code is removed from the address bar');
  await page.reload({ waitUntil: 'networkidle' });
  check(await seen('Split bills with your friends') || await seen("You're invited"), 'refreshing after an invite link still works');

  await page.locator('button.icon-btn.text').first().click();
  check(await seen('用 Google 登入'), 'the language switch works before sign-in');

  const read = await page.evaluate(() => window.firebase.firestore().collection('people').get().then(() => 'read', (e) => e.code));
  check(read === 'permission-denied', 'the live database refuses a signed-out visitor: ' + read);

  check(problems.length === 0, 'no errors or missing files' + (problems.length ? ': ' + problems.join(' | ') : ''));
} finally {
  await browser.close();
}
console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
