// End-to-end check of Tab against the Firebase emulators, on a phone-sized screen,
// with four accounts: Kyle (let in by hand), Dana (his friend, joins by invitation),
// Sean (joins with a group invite link) and Eve (a stranger).
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
const button = (page, name) => page.getByRole('button', { name, exact: true }).first();
// Taps a bottom tab, going Back first from screens that have no tab bar.
async function tab(page, name) {
  // A tab's name can carry an unread count after it ("Groups 1 new message").
  const it = page.locator('nav.tabbar').getByRole('button', { name: new RegExp('^' + name) });
  for (let i = 0; i < 4 && !(await it.isVisible()); i++) await button(page, 'Back').click().catch(() => {});
  await it.click();
}
// Opens a group from the Groups tab, without reloading.
async function openGroup(page, name) {
  await tab(page, 'Groups');
  await page.getByRole('button', { name: new RegExp(name) }).first().click();
}
// Writes a document as an administrator (the emulator skips the rules for "Bearer owner").
async function adminSet(path, fields) {
  const [col, id] = path.split('/');
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/demo-tab/databases/(default)/documents/${col}?documentId=${id}`, {
    method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error('adminSet ' + res.status + ' ' + await res.text());
}
async function clearEmulators() {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-tab/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-tab/accounts', { method: 'DELETE' });
}

const browser = await chromium.launch();
const pages = [];
const errors = [];
async function phonePage(who) {
  const ctx = await browser.newContext(phone);
  const shared = [];
  // LINE's share page is caught here instead of being opened.
  await ctx.route('https://line.me/**', (route) => { shared.push(new URL(route.request().url()).searchParams.get('text') || ''); route.fulfill({ body: 'LINE' }); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(who + ': ' + e.message));
  if (process.env.DEBUG) page.on('console', (m) => console.log('  [' + who + ' ' + m.type() + '] ' + m.text().slice(0, 300)));
  pages.push(page);
  return { page, shared };
}

try {
  await clearEmulators();

  // 1. Kyle: signed out, then signed in without an invite, then let in by hand.
  const { page: kyle, shared: kyleShared } = await phonePage('kyle');
  await kyle.goto(BASE);
  check(await seen(kyle, 'Split bills with your friends'), 'signed-out visitor sees the sign-in screen');
  await shot(kyle, '01-sign-in');
  await signIn(kyle, 'kyle@example.com');
  check(await seen(kyle, 'You need an invite'), 'a new account without an invite is told it needs one');
  const kyleUid = await kyle.evaluate(() => window.firebase.auth().currentUser.uid);
  await adminSet('members/' + kyleUid, { invite: { stringValue: 'bootstrap' }, joinedAt: { integerValue: '1' } });
  check(await seen(kyle, 'Your groups'), 'once let in, Kyle lands on his (empty) groups');
  check(await seen(kyle, 'No groups yet'), 'there is no setup screen and no example data');
  await tab(kyle, 'Me');
  check(await seen(kyle, 'kyle'), "Kyle's profile was made from his Google name");

  // 2. Kyle's friend link, with a QR code and a LINE button.
  await tab(kyle, 'Friends');
  check(await seen(kyle, 'No friends yet'), 'Friends starts empty');
  await button(kyle, 'Add friend').click();
  await kyle.waitForFunction(() => /#add=/.test((document.getElementById('friend-link') || {}).value || ''), null, { timeout: 10000 });
  const friendLink = await kyle.inputValue('#friend-link');
  check(/^http:\/\/localhost:8765\/\?openExternalBrowser=1#add=[0-9a-f]{36}$/.test(friendLink), 'a personal friend link is made');
  check(await kyle.locator('svg.qr').count() === 1, 'the friend link has a QR code');
  await button(kyle, 'Send in LINE').click();
  await kyle.waitForTimeout(1200);
  check(kyleShared.some((s) => s.includes(friendLink)), 'the friend link can be sent in LINE');
  await shot(kyle, '02-add-friend');

  // 3. Dana opens Kyle's friend link: she gets in and sends a request.
  const { page: dana } = await phonePage('dana');
  await dana.goto(friendLink.replace('/?', '/?emu&'));
  check(await seen(dana, 'Add a friend on Tab'), 'a friend link explains itself before sign-in');
  await signIn(dana, 'dana@example.com');
  check(await seen(dana, 'Friend request sent to kyle'), 'after sign-in Dana is told her friend request was sent');
  check(await seen(dana, 'Your groups'), 'the friend link let Dana into Tab');
  await tab(dana, 'Friends');
  check(await seen(dana, 'Sent requests'), "Dana sees her request waiting for Kyle's answer");
  await dana.waitForTimeout(4000);
  check(await dana.locator('.toast').count() === 0, 'the friend-request message goes away by itself');

  // 4. Kyle accepts.
  await tab(kyle, 'Friends');
  check(await seen(kyle, 'Friend requests', 15000), 'Kyle sees the request without reloading');
  await shot(kyle, '03-friend-request');
  await button(kyle, 'Accept').click();
  check(await seen(kyle, 'You and dana are now friends'), 'Kyle accepts and they are friends');
  check(await dana.getByRole('button', { name: /kyle/ }).first().waitFor({ timeout: 10000 }).then(() => true, () => false), "Dana's Friends list shows Kyle");

  // 5. Kyle makes a group and invites Dana; she accepts.
  await tab(kyle, 'Groups');
  await button(kyle, 'New group').click();
  await kyle.fill('#new-group-name', 'Hotpot');
  await button(kyle, 'dana').click();
  await button(kyle, 'Create group').click();
  check(await seen(kyle, 'No bills yet'), 'the new group opens straight away');
  await kyle.getByRole('button', { name: 'Members', exact: true }).click();
  check(await seen(kyle, 'Waiting for an answer'), 'Dana shows as invited in Members');
  await shot(kyle, '04-members-invited');
  await tab(dana, 'Groups');
  check(await seen(dana, 'kyle invited you', 15000), 'Dana sees the invitation without reloading');
  await shot(dana, '05-invitation');
  check(await dana.getByText('Friend request sent').count() === 0, 'the friend-request message does not come back later');
  await button(dana, 'Join').click();
  check(await seen(dana, 'You joined Hotpot'), 'Dana accepts the invitation');
  await kyle.waitForTimeout(1500);
  check(!(await kyle.locator('main').innerText()).includes('Waiting for an answer'), "Kyle's Members list no longer shows Dana as waiting");

  // 6. Kyle adds a bill through the editor; both see it at once.
  await openGroup(kyle, 'Hotpot');
  await button(kyle, 'Add a bill').click();
  await kyle.fill('#bill-title', 'Dinner');
  for (const [name, price] of [['Fried rice', '300'], ['Beer', '200']]) {
    await kyle.fill('#new-item-name', name);
    await kyle.fill('#new-item-price', price);
    await button(kyle, 'Add').click();
  }
  await button(kyle, 'Save bill').click();
  check(await seen(kyle, '250'), 'the saved bill splits NT$500 into 250 each');
  await shot(kyle, '05b-bill');
  await button(kyle, 'Share in the group chat').click();
  check(await seen(kyle, 'Sent to the group chat.'), 'Kyle shares the bill in the group chat');
  await openGroup(kyle, 'Hotpot');
  check(await seen(kyle, 'Dinner'), 'the bill shows in the group without a reload');
  await openGroup(dana, 'Hotpot');
  check(await seen(dana, 'Dinner', 15000), 'Dana sees the new bill without a reload');
  await tab(dana, 'Settle');
  check(await seen(dana, '250'), 'Dana owes Kyle 250 in Settle');

  // 7. Chat both ways, no reloads.
  await openGroup(kyle, 'Hotpot');
  await kyle.getByRole('button', { name: /Open group chat/ }).click();
  await kyle.getByPlaceholder('Message the group').fill('Hello from Kyle');
  await kyle.keyboard.press('Enter');
  await openGroup(dana, 'Hotpot');
  await dana.getByRole('button', { name: /Open group chat/ }).click();
  check(await seen(dana, 'Hello from Kyle', 15000), "Dana gets Kyle's message");
  check(await seen(dana, 'Dinner · Hotpot'), 'the shared bill is a card in the group chat');
  await dana.getByPlaceholder('Message the group').fill('Hi from Dana');
  await dana.keyboard.press('Enter');
  check(await seen(kyle, 'Hi from Dana', 15000), "Kyle gets Dana's reply");
  await shot(dana, '06-chat');

  // 7b. Reminders and the plan go inside Tab: Kyle reminds Dana privately and
  // sends the plan to the group chat; Dana answers in their private chat.
  await openGroup(kyle, 'Hotpot');
  await kyle.getByRole('button', { name: /Settle up/ }).first().click();
  await button(kyle, 'Remind').click();
  await shot(kyle, '06a-remind');
  check(await kyle.getByRole('button', { name: 'Send in LINE' }).count() > 0, 'LINE is still offered for a reminder');
  await button(kyle, 'Send to dana privately').click();
  check(await seen(kyle, 'Sent to dana.'), 'Kyle sends Dana a private reminder');
  await button(kyle, 'Send the plan to the group chat').click();
  check(await seen(kyle, 'Sent to the group chat.'), 'Kyle sends the plan to the group chat');
  await tab(dana, 'Friends');
  check(await seen(dana, 'Payment reminder · Hotpot', 15000), "Dana's Friends list shows Kyle's reminder");
  check(/1 new message/.test(await dana.locator('nav.tabbar').innerText()), 'the Friends tab shows 1 new message');
  await shot(dana, '06b-friends');
  await dana.getByRole('button', { name: 'Message kyle', exact: true }).click();
  check(await seen(dana, 'You → kyle'), 'the reminder is a card in their private chat, written for Dana');
  await dana.getByPlaceholder('Message kyle').fill('Paying now');
  await dana.keyboard.press('Enter');
  await tab(kyle, 'Friends');
  check(await seen(kyle, 'Paying now', 15000), "Kyle gets Dana's private reply");
  await kyle.getByRole('button', { name: /^dana/ }).first().click();
  check(await seen(kyle, 'dana owes you NT$250'), "Dana's profile shows their group and what she owes Kyle");
  await shot(kyle, '06d-profile');
  await shot(dana, '06c-private-chat');
  await openGroup(dana, 'Hotpot');
  await dana.getByRole('button', { name: /Open group chat/ }).click();
  check(await seen(dana, 'Settle-up plan · Hotpot', 15000), 'the plan is a card in the group chat');
  await shot(dana, '06e-group-cards');
  await button(dana, 'Go to Settle up').click();
  check(await seen(dana, 'Mark as paid'), "the plan card's button opens Settle up");

  // 8. Dana pays; Kyle's Settle shows it.
  await tab(dana, 'Settle');
  await dana.locator('main .row.tap').first().click();
  await button(dana, 'Mark as paid').click();
  check(await seen(dana, 'Marked as paid.'), 'Dana marks her payment as paid');
  await tab(kyle, 'Settle');
  await kyle.waitForTimeout(1500);
  check(!(await kyle.locator('main').innerText()).includes('250'), "Kyle's Settle shows the debt cleared");

  // 9. Sean, not a friend, joins with the group invite link.
  await openGroup(kyle, 'Hotpot');
  await kyle.getByRole('button', { name: 'Members', exact: true }).click();
  await kyle.getByText('Invite a friend').first().click();
  await kyle.waitForFunction(() => /#join=/.test((document.getElementById('invite-link') || {}).value || ''), null, { timeout: 10000 });
  const groupLink = await kyle.inputValue('#invite-link');
  const { page: sean } = await phonePage('sean');
  await sean.goto(groupLink.replace('/?', '/?emu&'));
  check(await seen(sean, "You're invited"), 'the group link shows "You\'re invited"');
  await signIn(sean, 'sean@example.com');
  check(await seen(sean, 'Hotpot', 15000), 'Sean is in the group after signing in');
  await openGroup(sean, 'Hotpot');
  check(await seen(sean, 'Dinner'), "Sean sees the group's bills");
  check(await seen(sean, '3 members'), 'the group now has 3 members');

  // 10. A stranger sees nothing.
  const { page: eve } = await phonePage('eve');
  await eve.goto(BASE);
  await signIn(eve, 'eve@example.com');
  check(await seen(eve, 'You need an invite'), 'a stranger is told they need an invite');
  const peek = await eve.evaluate(() => Promise.all([
    window.firebase.firestore().collection('people').get().then(() => 'read', (e) => e.code),
    window.firebase.firestore().collection('groups').where('memberUids', 'array-contains', 'x').get().then(() => 'read', (e) => e.code)
  ]));
  check(peek.every((r) => r === 'permission-denied'), 'the database refuses the stranger: ' + peek.join(', '));

  // 11. Kyle removes Sean; Dana leaves. Both lose access.
  await openGroup(kyle, 'Hotpot');
  await kyle.getByRole('button', { name: 'Members', exact: true }).click();
  await kyle.getByRole('button', { name: 'Remove sean from the group' }).click();
  await button(kyle, 'Remove').click();
  await kyle.waitForTimeout(1500);
  const seanLeft = await sean.evaluate(() => window.firebase.firestore().collection('groups').where('memberUids', 'array-contains', window.firebase.auth().currentUser.uid).get().then((s) => s.size));
  check(seanLeft === 0, 'after Kyle removes Sean, Sean no longer has access');
  await openGroup(dana, 'Hotpot');
  await dana.getByRole('button', { name: 'Members', exact: true }).click();
  await button(dana, 'Leave group').click();
  await dana.getByRole('button', { name: 'Leave group' }).last().click();
  await dana.waitForTimeout(1500);
  const danaLeft = await dana.evaluate(() => window.firebase.firestore().collection('groups').where('memberUids', 'array-contains', window.firebase.auth().currentUser.uid).get().then((s) => s.size));
  check(danaLeft === 0, 'after leaving, Dana no longer has access');

  // 12. Language, photo, and the money maths from HANDOFF.md.
  await tab(kyle, 'Me');
  await button(kyle, '繁體中文').click();
  check(await seen(kyle, '登出'), 'switching to Chinese works');
  await button(kyle, 'English').click();
  await kyle.getByText('Edit profile').click();
  await kyle.locator('input[type=file]').first().setInputFiles(PHOTO);
  await kyle.waitForFunction(() => /^data:image/.test((document.querySelector('img.avatar') || {}).src || ''), null, { timeout: 10000 });
  await button(kyle, 'Save').click();
  await kyle.waitForTimeout(1500);
  await kyle.reload();
  await tab(kyle, 'Me');
  check(await kyle.waitForFunction(() => /^data:image/.test((document.querySelector('img.avatar') || {}).src || ''), null, { timeout: 10000 }).then(() => true, () => false),
    'a profile photo is saved and shown after a reload');
  const shares = await kyle.evaluate(() => {
    const all = ['me', 'mei', 'arjun', 'dana'];
    const it = (price, ids) => ({ id: String(price), price, sharerIds: ids });
    return window.Tab.calc.billShares({
      payerId: 'mei', presentIds: all, servicePct: 10,
      items: [it(400, all), it(720, ['me', 'mei', 'arjun']), it(640, ['mei', 'dana']), it(240, all), it(360, ['me', 'arjun', 'dana'])]
    });
  });
  check(shares.total === 2596 && shares.shares.me === 572 && shares.shares.mei === 792 && shares.shares.arjun === 572 && shares.shares.dana === 660,
    'money maths: Hotpot night shares 572 / 792 / 572 / 660, total 2,596');

  // 13. Signing out wipes this device's copy of the data.
  await tab(kyle, 'Me');
  await kyle.evaluate(() => { window.beforeSignOut = true; });
  await button(kyle, 'Sign out').click();
  // The copy is wiped after the sign-in screen shows, then the page reloads.
  await kyle.waitForFunction(() => !window.beforeSignOut, null, { timeout: 15000 });
  check(await seen(kyle, 'Split bills with your friends', 15000), 'Sign out goes back to the sign-in screen');
  const leftover = await kyle.evaluate(() => new Promise((r) => { const q = indexedDB.databases ? indexedDB.databases() : Promise.resolve([]); q.then((d) => r(d.map((x) => x.name).filter((n) => /firestore/i.test(n) && /main/.test(n)))); }));
  check(leftover.length === 0, 'no copy of the data is left on the device after signing out' + (leftover.length ? ': ' + leftover.join(', ') : ''));

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
