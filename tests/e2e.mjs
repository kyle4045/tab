// End-to-end check of Tab against the Firebase emulators, on a phone-sized screen.
// Start the emulators (dev/emulators.ps1) and the page server (dev/serve.ps1), then:
//   node tests/e2e.mjs [screenshot folder]
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const BASE = 'http://localhost:8765/?emu';
const SHOTS = process.argv[2] || null;
const PHOTO = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'receipt.jpg');
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
async function signIn(page, email) {
  await page.waitForFunction(() => window.Tab && window.Tab.store && window.firebase);
  await page.evaluate((e) => window.Tab.store.testSignIn(e), email);
}
// Writes a document as an administrator (the emulator skips the rules for "Bearer owner").
async function adminSet(path, fields) {
  const [col, id] = path.split('/');
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/demo-tab/databases/(default)/documents/${col}?documentId=${id}`, {
    method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error('adminSet ' + res.status + ' ' + await res.text());
}
// Reloads the page and opens the first group in the list.
async function openGroup(page) {
  await page.reload();
  await page.getByText('Your groups').first().waitFor({ timeout: 15000 });
  await page.locator('main .row.tap').first().click();
}
async function clearEmulators() {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-tab/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-tab/accounts', { method: 'DELETE' });
}

const browser = await chromium.launch();
const pages = [];
try {
  await clearEmulators();
  const errors = [];
  const ownerCtx = await browser.newContext(phone);
  const owner = await ownerCtx.newPage();
  pages.push(owner);
  owner.on('pageerror', (e) => errors.push('owner: ' + e.message));

  // 1. Signed out, then signed in without an invite.
  await owner.goto(BASE);
  check(await seen(owner, 'Split bills with your friends'), 'signed-out visitor sees the sign-in screen');
  await shot(owner, '01-sign-in');
  await signIn(owner, 'kyle@example.com');
  check(await seen(owner, 'You need an invite'), 'a new account without an invite is told it needs one');

  // 2. Kyle is let in by hand (as he will be on the real site) and sets up.
  const kyleUid = await owner.evaluate(() => window.firebase.auth().currentUser.uid);
  await adminSet('members/' + kyleUid, { invite: { stringValue: 'bootstrap' }, personId: { nullValue: null }, joinedAt: { integerValue: '1' } });
  check(await seen(owner, 'Split the bill before anyone forgets'), 'once in the circle, the owner sees first-run setup');
  await owner.fill('#setup-name', 'Kyle');
  await owner.getByText('Load an example outing instead').click();
  check(await seen(owner, 'This is example data.'), 'example outing loads into a new group');

  // 3. The money maths from HANDOFF.md, read back from the database.
  await owner.reload();
  check(await seen(owner, 'Your groups'), 'after a reload the owner is still signed in and sees their groups');
  await owner.getByRole('button', { name: 'Settle', exact: true }).click();
  await owner.waitForTimeout(800);
  const settleText = await owner.locator('main').innerText();
  check(['476', '152'].every((n) => settleText.includes(n)), "the owner's Settle tab shows Dana 476 and Arjun 152");
  await shot(owner, '02-settle');
  await owner.locator('main .row.tap').first().click();
  await owner.waitForTimeout(800);
  const groupSettle = await owner.locator('main').innerText();
  check(['964', '476', '152'].every((n) => groupSettle.includes(n)), "the group's Settle up shows 964 / 476 / 152");
  await openGroup(owner);
  await owner.getByText('Hotpot night').first().click();
  await owner.waitForTimeout(500);
  const billText = await owner.locator('main').innerText();
  check(['572', '792', '660', '2,596'].every((n) => billText.includes(n)), 'Hotpot night shares 572 / 792 / 572 / 660, total 2,596');
  await shot(owner, '03-bill');

  // 4. Chat and an invite link.
  await openGroup(owner);
  await owner.getByRole('button', { name: /Open group chat/ }).click();
  await owner.getByPlaceholder('Message the group').fill('Hello from Kyle');
  await owner.keyboard.press('Enter');
  check(await seen(owner, 'Hello from Kyle'), 'owner can post in the group chat');
  await openGroup(owner);
  await owner.getByRole('button', { name: 'Members', exact: true }).click();
  await owner.getByText('Invite a friend').click();
  await owner.waitForFunction(() => /#join=/.test((document.getElementById('invite-link') || {}).value || ''), null, { timeout: 10000 });
  const link = await owner.inputValue('#invite-link');
  check(/^http:\/\/localhost:8765\/\?openExternalBrowser=1#join=[0-9a-f]{36}$/.test(link), 'invite link is made: ' + link.replace(/join=.*/, 'join=…'));
  await shot(owner, '04-invite');

  // 5. A friend opens the link, signs in, picks her name and chats.
  const friendCtx = await browser.newContext(phone);
  const friend = await friendCtx.newPage();
  pages.push(friend);
  friend.on('pageerror', (e) => errors.push('friend: ' + e.message));
  if (process.env.DEBUG) friend.on('console', (m) => console.log('  [friend ' + m.type() + '] ' + m.text().slice(0, 300)));
  await friend.goto(link.replace('/?', '/?emu&'));
  check(await seen(friend, "You're invited"), 'the invite link shows "You\'re invited"');
  check(!(await friend.evaluate(() => location.hash)).includes('join'), 'the invite code is taken out of the address bar');
  await signIn(friend, 'dana@example.com');
  check(await seen(friend, 'Who are you?'), 'after sign-in the friend is asked who she is');
  await friend.getByRole('button', { name: 'Dana', exact: true }).click();
  check(await seen(friend, 'Your groups'), 'the friend now sees her groups');
  await friend.locator('main .row.tap').first().click();
  await friend.getByRole('button', { name: /Open group chat/ }).click();
  check(await seen(friend, 'Hello from Kyle'), "the friend sees the owner's chat message");
  await friend.getByPlaceholder('Message the group').fill('Hi from Dana');
  await friend.keyboard.press('Enter');
  check(await seen(owner, 'Hi from Dana', 15000) || (await owner.reload(), await seen(owner, 'Hi from Dana')), "the owner gets the friend's reply");
  await shot(friend, '05-friend-chat');

  // 6. The friend marks a payment; the owner sees it.
  await friend.reload();
  await friend.getByRole('button', { name: 'Settle', exact: true }).click();
  await friend.locator('main .row.tap').first().click();
  await friend.getByRole('button', { name: 'Mark as paid' }).first().click();
  check(await seen(friend, 'Marked as paid.'), 'the friend can mark a payment as paid');
  await owner.reload();
  await owner.getByRole('button', { name: 'Settle', exact: true }).click();
  await owner.waitForTimeout(800);
  const after = await owner.locator('main').innerText();
  check(!after.includes('964'), "the owner's Settle screen reflects the friend's payment");

  // 7. A stranger who signs in without an invite sees nothing.
  const strangerCtx = await browser.newContext(phone);
  const stranger = await strangerCtx.newPage();
  await stranger.goto(BASE);
  await signIn(stranger, 'eve@example.com');
  check(await seen(stranger, 'You need an invite'), 'a stranger is told they need an invite');
  const peek = await stranger.evaluate(() => Promise.all([
    window.firebase.firestore().collection('people').get().then(() => 'read', (e) => e.code),
    window.firebase.firestore().collection('groups').where('memberUids', 'array-contains', 'x').get().then(() => 'read', (e) => e.code)
  ]));
  check(peek.every((r) => r === 'permission-denied'), 'the database refuses the stranger: ' + peek.join(', '));

  // 8. Language, photo and leaving the group.
  await owner.getByRole('button', { name: 'Me', exact: true }).click();
  await owner.getByRole('button', { name: '繁體中文', exact: true }).click();
  check(await seen(owner, '登出'), 'switching to Chinese works');
  await owner.getByRole('button', { name: 'English', exact: true }).click();
  await owner.getByText('Edit profile').click();
  await owner.locator('input[type=file]').first().setInputFiles(PHOTO);
  await owner.waitForFunction(() => /^data:image/.test((document.querySelector('img.avatar') || {}).src || ''), null, { timeout: 10000 });
  await owner.getByRole('button', { name: 'Save', exact: true }).click();
  await owner.reload();
  await owner.getByRole('button', { name: 'Me', exact: true }).click();
  check(await owner.waitForFunction(() => /^data:image/.test((document.querySelector('img.avatar') || {}).src || ''), null, { timeout: 10000 }).then(() => true, () => false),
    'a profile photo is saved and shown after a reload');
  await shot(owner, '06-me');

  await openGroup(friend);
  await friend.getByRole('button', { name: 'Members', exact: true }).click();
  await friend.getByRole('button', { name: 'Leave group' }).click();
  await friend.getByRole('button', { name: 'Leave group' }).last().click();
  await friend.waitForTimeout(1500);
  const leftRead = await friend.evaluate(() => window.firebase.firestore().collection('groups').where('memberUids', 'array-contains', window.firebase.auth().currentUser.uid).get().then((s) => s.size));
  check(leftRead === 0, 'after leaving, the friend no longer has access to the group');

  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
} catch (e) {
  failures++;
  console.log('FAIL stopped: ' + e.message.split('\n')[0]);
  for (let i = 0; i < pages.length; i++) await shot(pages[i], 'failed-' + i).catch(() => {});
} finally {
  await browser.close();
}
console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
