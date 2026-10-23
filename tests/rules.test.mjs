// Checks firestore.rules against the Firestore emulator.
// Run from the repo root:  firebase emulators:exec --only firestore "npm --prefix tests test"
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const FV = firebase.firestore.FieldValue;
const TS = firebase.firestore.Timestamp;
const CODE = 'invite-code-0123456789abcd';
const OLD = 'expired-code-0123456789abc';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-tab',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});
after(() => env.cleanup());

// Kyle is in the circle and owns group g1, with one bill, one payment and one message.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc('members/kyle').set({ invite: 'bootstrap', personId: 'pk', joinedAt: 1 });
    await db.doc('people/pk').set({ name: 'Kyle', uid: 'kyle' });
    await db.doc('people/ps').set({ name: 'Sean' });
    await db.doc('groups/g1').set({ name: 'Hotpot', ownerId: 'pk', ownerUid: 'kyle', memberIds: ['pk', 'ps'], memberUids: ['kyle'] });
    await db.doc('groups/g1/bills/b1').set({ groupId: 'g1', title: 'Dinner', items: [] });
    await db.doc('groups/g1/payments/p1').set({ groupId: 'g1', amount: 100 });
    await db.doc('groups/g1/messages/m1').set({ personId: 'pk', text: 'hi', at: 1 });
    await db.doc('groups/g2').set({ name: 'Other', ownerUid: 'zed', memberUids: ['zed'], memberIds: [] });
    await db.doc('invites/' + CODE).set({ groupId: 'g1', uid: 'kyle', createdAt: 1, expiresAt: TS.fromMillis(Date.now() + 86400000) });
    await db.doc('invites/' + OLD).set({ groupId: 'g1', uid: 'kyle', createdAt: 1, expiresAt: TS.fromMillis(Date.now() - 1000) });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
async function join(db, uid, code = CODE) {
  await db.doc('members/' + uid).set({ invite: code, personId: null, joinedAt: Date.now() });
  await db.doc('groups/g1').update({ memberUids: FV.arrayUnion(uid), joinCode: code });
}

test('signed-out visitors can read nothing', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(db.doc('groups/g1').get());
  await assertFails(db.collection('people').get());
  await assertFails(db.doc('invites/' + CODE).get());
});

test('a signed-in stranger sees nothing and cannot create groups', async () => {
  const db = as('stranger');
  await assertFails(db.doc('groups/g1').get());
  await assertFails(db.collection('groups').where('memberUids', 'array-contains', 'kyle').get());
  await assertFails(db.collection('groups/g1/bills').get());
  await assertFails(db.collection('groups/g1/messages').get());
  await assertFails(db.collection('people').get());
  await assertFails(db.collection('photos').get());
  await assertFails(db.collection('invites').get());
  await assertFails(db.doc('groups/new').set({ ownerUid: 'stranger', memberUids: ['stranger'] }));
  await assertFails(db.doc('members/stranger').set({ invite: 'made-up-code-0123456789ab', personId: null, joinedAt: 1 }));
});

test('a member lists their own groups and reads the bills, payments and chat', async () => {
  const db = as('kyle');
  const mine = await assertSucceeds(db.collection('groups').where('memberUids', 'array-contains', 'kyle').get());
  if (mine.size !== 1) throw new Error('expected 1 group, got ' + mine.size);
  await assertSucceeds(db.collection('groups/g1/bills').get());
  await assertSucceeds(db.collection('groups/g1/payments').get());
  await assertSucceeds(db.collection('groups/g1/messages').orderBy('at', 'desc').limit(200).get());
  await assertSucceeds(db.collection('people').get());
  await assertFails(db.doc('groups/g2').get());
  await assertFails(db.collection('groups/g2/bills').get());
});

test('a friend with the invite link joins and then sees the group', async () => {
  const db = as('sean');
  await assertSucceeds(db.doc('invites/' + CODE).get());
  await assertSucceeds(join(db, 'sean'));
  await assertSucceeds(db.doc('groups/g1').get());
  await assertSucceeds(db.collection('groups/g1/bills').get());
  await assertSucceeds(db.collection('people').get());
  await assertSucceeds(db.doc('members/sean').update({ personId: 'ps' }));
  await assertSucceeds(db.doc('people/ps').update({ uid: 'sean' }));
  await assertSucceeds(db.doc('groups/g1/messages/m2').set({ personId: 'ps', text: 'hello', at: 2 }));
  // The invite only opens g1.
  await assertFails(db.doc('groups/g2').update({ memberUids: FV.arrayUnion('sean'), joinCode: CODE }));
});

test('an expired invite does not let anyone in', async () => {
  const db = as('late');
  await assertFails(db.doc('members/late').set({ invite: OLD, personId: null, joinedAt: 1 }));
  await assertFails(db.doc('groups/g1').update({ memberUids: FV.arrayUnion('late'), joinCode: OLD }));
});

test('joining may not change anything else about the group', async () => {
  const db = as('sean');
  await db.doc('members/sean').set({ invite: CODE, personId: null, joinedAt: 1 });
  await assertFails(db.doc('groups/g1').update({ memberUids: FV.arrayUnion('sean'), joinCode: CODE, name: 'Mine now' }));
  await assertFails(db.doc('groups/g1').update({ memberUids: ['kyle', 'sean', 'eve'], joinCode: CODE }));
});

test('a member cannot let others in, but can leave', async () => {
  const sean = as('sean');
  await join(sean, 'sean');
  await assertFails(sean.doc('groups/g1').update({ memberUids: ['kyle', 'sean', 'eve'] }));
  await assertFails(sean.doc('groups/g1').update({ ownerUid: 'sean' }));
  await assertSucceeds(sean.doc('groups/g1').update({ memberUids: ['kyle'], memberIds: ['pk'] }));
  await assertFails(sean.doc('groups/g1').get());
});

test('the owner can remove a member, and only the owner deletes the group', async () => {
  await join(as('sean'), 'sean');
  await assertFails(as('sean').doc('groups/g1').delete());
  await assertSucceeds(as('kyle').doc('groups/g1').update({ memberUids: ['kyle'] }));
  await assertFails(as('kyle').doc('groups/g1').update({ memberUids: ['sean'] }));
  await assertSucceeds(as('kyle').doc('groups/g1').delete());
});

test('bills must belong to the group they are filed under', async () => {
  const db = as('kyle');
  await assertSucceeds(db.doc('groups/g1/bills/b2').set({ groupId: 'g1', title: 'Lunch' }));
  await assertFails(db.doc('groups/g1/bills/b3').set({ groupId: 'g2', title: 'Sneaky' }));
});

test('invites: members of the group create them; nobody can list other people’s', async () => {
  const kyle = as('kyle');
  const code = 'another-code-0123456789ab';
  const soon = TS.fromMillis(Date.now() + 14 * 86400000);
  await assertSucceeds(kyle.doc('invites/' + code).set({ groupId: 'g1', uid: 'kyle', createdAt: 1, expiresAt: soon }));
  await assertSucceeds(kyle.collection('invites').where('uid', '==', 'kyle').get());
  await assertFails(kyle.doc('invites/short').set({ groupId: 'g1', uid: 'kyle', createdAt: 1, expiresAt: soon }));
  await assertFails(kyle.doc('invites/forever-code-0123456789ab').set({ groupId: 'g1', uid: 'kyle', createdAt: 1, expiresAt: TS.fromMillis(Date.now() + 90 * 86400000) }));
  await assertFails(kyle.doc('invites/other-group-0123456789abc').set({ groupId: 'g2', uid: 'kyle', createdAt: 1, expiresAt: soon }));
  await assertFails(as('stranger').collection('invites').where('uid', '==', 'kyle').get());
});

test('people may only be linked to your own account', async () => {
  const db = as('kyle');
  await assertSucceeds(db.doc('people/new').set({ name: 'Mina' }));
  await assertFails(db.doc('people/new2').set({ name: 'Mina', uid: 'someone-else' }));
  await assertFails(db.doc('people/ps').update({ uid: 'someone-else' }));
});

test('settings and member records are private to their owner', async () => {
  await assertSucceeds(as('kyle').doc('settings/kyle').set({ lang: 'en' }));
  await assertFails(as('kyle').doc('settings/sean').set({ lang: 'en' }));
  await assertFails(as('sean').doc('members/kyle').get());
  await assertFails(as('kyle').doc('members/kyle').update({ invite: 'changed' }));
});

test('photos: circle members read them, uploaders delete their own', async () => {
  const kyle = as('kyle');
  await assertSucceeds(kyle.doc('photos/ph1').set({ uid: 'kyle', data: 'data:image/jpeg;base64,AAAA' }));
  await assertFails(kyle.doc('photos/ph2').set({ uid: 'sean', data: 'x' }));
  await assertFails(kyle.doc('photos/ph3').set({ uid: 'kyle', data: 'x'.repeat(300001) }));
  await assertFails(as('stranger').doc('photos/ph1').get());
  await join(as('sean'), 'sean');
  await assertSucceeds(as('sean').doc('photos/ph1').get());
  await assertFails(as('sean').doc('photos/ph1').delete());
  await assertSucceeds(kyle.doc('photos/ph1').delete());
});
