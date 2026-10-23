// Checks firestore.rules against the Firestore emulator.
// Run from the repo root:  firebase emulators:exec --only firestore --project demo-tab "npm --prefix tests test"
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const FV = firebase.firestore.FieldValue;
const TS = firebase.firestore.Timestamp;
const LINK = 'invite-code-0123456789abcd';
const OLD = 'expired-code-0123456789abc';
const KYLE_CODE = 'kyle-friend-code-0123456789';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-tab',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});
after(() => env.cleanup());

// Kyle is in the circle with a friend code, owns group g1 (one bill, payment and
// message) and is friends with Sean, who is in the circle but not in g1.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const soon = TS.fromMillis(Date.now() + 86400000);
    await db.doc('members/kyle').set({ invite: 'bootstrap', joinedAt: 1, friendCode: KYLE_CODE });
    await db.doc('members/sean').set({ invite: KYLE_CODE, joinedAt: 1 });
    await db.doc('people/kyle').set({ uid: 'kyle', name: 'Kyle' });
    await db.doc('people/sean').set({ uid: 'sean', name: 'Sean' });
    await db.doc('friendCodes/' + KYLE_CODE).set({ uid: 'kyle', createdAt: 1 });
    await db.doc('friends/kyle_sean').set({ uids: ['kyle', 'sean'], since: 1 });
    await db.doc('groups/g1').set({ name: 'Hotpot', ownerId: 'kyle', ownerUid: 'kyle', memberIds: ['kyle'], memberUids: ['kyle'] });
    await db.doc('groups/g1/bills/b1').set({ groupId: 'g1', title: 'Dinner', items: [] });
    await db.doc('groups/g1/payments/p1').set({ groupId: 'g1', amount: 100 });
    await db.doc('groups/g1/messages/m1').set({ personId: 'kyle', text: 'hi', at: 1 });
    await db.doc('groups/g2').set({ name: 'Other', ownerUid: 'zed', memberUids: ['zed'], memberIds: ['zed'] });
    await db.doc('invites/' + LINK).set({ groupId: 'g1', uid: 'kyle', createdAt: 1, expiresAt: soon });
    await db.doc('invites/' + OLD).set({ groupId: 'g1', uid: 'kyle', createdAt: 1, expiresAt: TS.fromMillis(Date.now() - 1000) });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const invitation = (to) => ({ groupId: 'g1', groupName: 'Hotpot', from: 'kyle', to, at: 1 });
const join = (db, uid, extra = {}) => db.doc('groups/g1').update(Object.assign({ memberUids: FV.arrayUnion(uid), memberIds: FV.arrayUnion(uid) }, extra));
// Accepting an invitation, as the app does it: join, then use the invitation up.
const accept = (db, uid) => join(db, uid).then(() => db.doc('groups/g1/invitations/' + uid).delete());

test('signed-out visitors can read nothing', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(db.doc('groups/g1').get());
  await assertFails(db.collection('people').get());
  await assertFails(db.doc('friendCodes/' + KYLE_CODE).get());
});

test('a signed-in stranger sees nothing and cannot get in without a link', async () => {
  const db = as('eve');
  await assertFails(db.doc('groups/g1').get());
  await assertFails(db.collection('groups/g1/bills').get());
  await assertFails(db.collection('people').get());
  await assertFails(db.collection('friends').where('uids', 'array-contains', 'kyle').get());
  await assertFails(db.collection('friendCodes').get());
  await assertFails(db.doc('people/eve').set({ uid: 'eve', name: 'Eve' }));
  await assertFails(db.doc('groups/new').set({ ownerUid: 'eve', memberUids: ['eve'], memberIds: ['eve'] }));
  await assertFails(db.doc('members/eve').set({ invite: 'made-up-code-0123456789ab', joinedAt: 1 }));
  await assertFails(db.doc('friendRequests/eve_kyle').set({ from: 'eve', to: 'kyle', at: 1 }));
});

test("a friend link lets someone in, and they can then ask to be friends", async () => {
  const db = as('dana');
  await assertSucceeds(db.doc('friendCodes/' + KYLE_CODE).get());
  await assertSucceeds(db.doc('members/dana').set({ invite: KYLE_CODE, joinedAt: 1 }));
  await assertSucceeds(db.doc('people/dana').set({ uid: 'dana', name: 'Dana' }));
  await assertSucceeds(db.collection('people').get());
  await assertSucceeds(db.doc('friendRequests/dana_kyle').set({ from: 'dana', to: 'kyle', at: 1 }));
  // ...but not on someone else's behalf, or to themself.
  await assertFails(db.doc('friendRequests/sean_kyle').set({ from: 'sean', to: 'kyle', at: 1 }));
  await assertFails(db.doc('friendRequests/dana_dana').set({ from: 'dana', to: 'dana', at: 1 }));
  // Still no groups.
  await assertFails(db.doc('groups/g1').get());
});

test('only the person asked can accept a friend request', async () => {
  await as('dana').doc('members/dana').set({ invite: KYLE_CODE, joinedAt: 1 });
  await as('dana').doc('friendRequests/dana_kyle').set({ from: 'dana', to: 'kyle', at: 1 });
  await assertSucceeds(as('kyle').collection('friendRequests').where('to', '==', 'kyle').get());
  await assertFails(as('sean').doc('friendRequests/dana_kyle').get());
  // Dana can't accept her own request, and nobody can make a friendship without one.
  await assertFails(as('dana').doc('friends/dana_kyle').set({ uids: ['dana', 'kyle'], since: 1 }));
  await assertFails(as('sean').doc('friends/dana_sean').set({ uids: ['dana', 'sean'], since: 1 }));
  await assertSucceeds(as('kyle').doc('friends/dana_kyle').set({ uids: ['dana', 'kyle'], since: 1 }));
  await assertSucceeds(as('kyle').doc('friendRequests/dana_kyle').delete());
  await assertSucceeds(as('dana').collection('friends').where('uids', 'array-contains', 'dana').get());
  await assertFails(as('sean').doc('friends/dana_kyle').get());
  // Either friend can end it.
  await assertSucceeds(as('dana').doc('friends/dana_kyle').delete());
});

test('profiles belong to their owner', async () => {
  await assertSucceeds(as('sean').doc('people/sean').update({ name: 'Sean W' }));
  await assertFails(as('sean').doc('people/kyle').update({ name: 'Hacked' }));
  await assertFails(as('sean').doc('people/fake').set({ uid: 'sean', name: 'Fake' }));
  await assertFails(as('sean').doc('people/kyle').delete());
});

test('a member reads the group, its bills, payments and chat; others cannot', async () => {
  const db = as('kyle');
  const mine = await assertSucceeds(db.collection('groups').where('memberUids', 'array-contains', 'kyle').get());
  if (mine.size !== 1) throw new Error('expected 1 group, got ' + mine.size);
  await assertSucceeds(db.collection('groups/g1/bills').get());
  await assertSucceeds(db.collection('groups/g1/payments').get());
  await assertSucceeds(db.collection('groups/g1/messages').orderBy('at', 'desc').limit(200).get());
  await assertFails(db.doc('groups/g2').get());
  await assertFails(as('sean').collection('groups/g1/bills').get());
});

test('a member invites a friend, who accepts and joins', async () => {
  const kyle = as('kyle');
  const sean = as('sean');
  await assertSucceeds(kyle.doc('groups/g1/invitations/sean').set(invitation('sean')));
  await assertSucceeds(sean.collectionGroup('invitations').where('to', '==', 'sean').get());
  await assertSucceeds(kyle.collection('groups/g1/invitations').get());
  await assertSucceeds(join(sean, 'sean'));
  await assertSucceeds(sean.doc('groups/g1/invitations/sean').delete());
  await assertSucceeds(sean.collection('groups/g1/bills').get());
  await assertSucceeds(sean.doc('groups/g1/messages/m2').set({ personId: 'sean', text: 'hello', at: 2 }));
});

test('invitations go only to friends, and only the invitee can use one', async () => {
  await as('dana').doc('members/dana').set({ invite: KYLE_CODE, joinedAt: 1 });
  // Dana is not Kyle's friend.
  await assertFails(as('kyle').doc('groups/g1/invitations/dana').set(invitation('dana')));
  // A non-member can't invite, and an invitation can't claim to be from someone else.
  await assertFails(as('sean').doc('groups/g1/invitations/sean').set(Object.assign(invitation('sean'), { from: 'sean' })));
  await assertFails(as('kyle').doc('groups/g1/invitations/sean').set(Object.assign(invitation('sean'), { from: 'zed' })));
  // Without an invitation nobody can add themself...
  await assertFails(join(as('sean'), 'sean'));
  await as('kyle').doc('groups/g1/invitations/sean').set(invitation('sean'));
  // ...and Sean's invitation doesn't let Dana in, or anyone read others' invitations.
  await assertFails(join(as('dana'), 'dana'));
  await assertFails(as('dana').collectionGroup('invitations').where('to', '==', 'sean').get());
  // Joining may only add yourself, to both lists.
  await assertFails(as('sean').doc('groups/g1').update({ memberUids: FV.arrayUnion('sean'), memberIds: FV.arrayUnion('sean'), name: 'Mine' }));
  await assertFails(as('sean').doc('groups/g1').update({ memberUids: FV.arrayUnion('sean') }));
});

test('nobody is put in a group without accepting: not even by the owner', async () => {
  await assertFails(as('kyle').doc('groups/g1').update({ memberUids: ['kyle', 'sean'], memberIds: ['kyle', 'sean'] }));
  await assertFails(as('kyle').doc('groups/new').set({ ownerUid: 'kyle', memberUids: ['kyle', 'sean'], memberIds: ['kyle', 'sean'] }));
  await assertSucceeds(as('kyle').doc('groups/new').set({ ownerUid: 'kyle', ownerId: 'kyle', memberUids: ['kyle'], memberIds: ['kyle'], name: 'New' }));
});

test('a group invite link lets a non-friend in; an expired one does not', async () => {
  const dana = as('dana');
  await assertSucceeds(dana.doc('members/dana').set({ invite: LINK, joinedAt: 1 }));
  await assertSucceeds(join(dana, 'dana', { joinCode: LINK }));
  await assertSucceeds(dana.collection('groups/g1/bills').get());
  const late = as('late');
  await assertFails(late.doc('members/late').set({ invite: OLD, joinedAt: 1 }));
  await assertFails(join(late, 'late', { joinCode: OLD }));
});

test('members can leave; the owner can remove members; only the owner deletes', async () => {
  await as('kyle').doc('groups/g1/invitations/sean').set(invitation('sean'));
  await accept(as('sean'), 'sean');
  await assertFails(as('sean').doc('groups/g1').update({ ownerUid: 'sean' }));
  await assertFails(as('sean').doc('groups/g1').delete());
  await assertSucceeds(as('kyle').doc('groups/g1').update({ memberUids: ['kyle'], memberIds: ['kyle'] }));
  await assertFails(as('sean').doc('groups/g1').get());
  // Back in, then leaving by themself.
  await as('kyle').doc('groups/g1/invitations/sean').set(invitation('sean'));
  await accept(as('sean'), 'sean');
  await assertSucceeds(as('sean').doc('groups/g1').update({ memberUids: ['kyle'], memberIds: ['kyle'] }));
  await assertFails(as('kyle').doc('groups/g1').update({ memberUids: ['sean'], memberIds: ['sean'] }));
  await assertSucceeds(as('kyle').doc('groups/g1').delete());
});

test('bills must belong to the group they are filed under', async () => {
  const db = as('kyle');
  await assertSucceeds(db.doc('groups/g1/bills/b2').set({ groupId: 'g1', title: 'Lunch' }));
  await assertFails(db.doc('groups/g1/bills/b3').set({ groupId: 'g2', title: 'Sneaky' }));
});

test('friend codes and invite links are made by their owner and cannot be listed', async () => {
  const kyle = as('kyle');
  await assertSucceeds(kyle.doc('friendCodes/another-friend-code-01234').set({ uid: 'kyle', createdAt: 1 }));
  await assertFails(kyle.doc('friendCodes/someone-elses-code-012345').set({ uid: 'sean', createdAt: 1 }));
  await assertFails(kyle.doc('friendCodes/short').set({ uid: 'kyle', createdAt: 1 }));
  await assertSucceeds(kyle.doc('members/kyle').update({ friendCode: 'another-friend-code-01234' }));
  await assertFails(kyle.doc('members/kyle').update({ invite: 'changed' }));
  const soon = TS.fromMillis(Date.now() + 14 * 86400000);
  await assertSucceeds(kyle.doc('invites/another-code-0123456789ab').set({ groupId: 'g1', uid: 'kyle', createdAt: 1, expiresAt: soon }));
  await assertFails(kyle.doc('invites/forever-code-0123456789ab').set({ groupId: 'g1', uid: 'kyle', createdAt: 1, expiresAt: TS.fromMillis(Date.now() + 90 * 86400000) }));
  await assertFails(kyle.doc('invites/other-group-0123456789abc').set({ groupId: 'g2', uid: 'kyle', createdAt: 1, expiresAt: soon }));
  await assertFails(as('sean').collection('invites').where('uid', '==', 'kyle').get());
});

test('settings and member records are private to their owner', async () => {
  await assertSucceeds(as('kyle').doc('settings/kyle').set({ lang: 'en' }));
  await assertFails(as('kyle').doc('settings/sean').set({ lang: 'en' }));
  await assertFails(as('sean').doc('members/kyle').get());
});

test('private messages: only the two friends read and send them', async () => {
  const kyle = as('kyle');
  const sean = as('sean');
  const msg = (personId, text = 'hi') => ({ personId, text, at: 1 });
  await assertSucceeds(kyle.doc('dms/kyle_sean/messages/m1').set(msg('kyle')));
  await assertSucceeds(sean.collection('dms/kyle_sean/messages').get());
  await assertSucceeds(sean.doc('dms/kyle_sean/messages/m2').set(msg('sean')));
  // Not as someone else, not too long, nothing extra.
  await assertFails(sean.doc('dms/kyle_sean/messages/m3').set(msg('kyle')));
  await assertFails(kyle.doc('dms/kyle_sean/messages/m4').set(msg('kyle', 'x'.repeat(1001))));
  await assertFails(kyle.doc('dms/kyle_sean/messages/m5').set(Object.assign(msg('kyle'), { extra: 1 })));
  // A reminder travels as a card next to its text.
  await assertSucceeds(kyle.doc('dms/kyle_sean/messages/m9').set(Object.assign(msg('kyle'), { card: { kind: 'remind', groupId: 'g1', payments: [] } })));
  await assertFails(kyle.doc('dms/kyle_sean/messages/m10').set(Object.assign(msg('kyle'), { card: 'not a card' })));
  // A third person can neither read nor write; the pair must be in order.
  await assertFails(as('dana').collection('dms/kyle_sean/messages').get());
  await assertFails(as('dana').doc('dms/dana_kyle/messages/m6').set(msg('dana')));
  await assertFails(kyle.doc('dms/sean_kyle/messages/m7').set(msg('kyle')));
  // After unfriending, the history stays readable but no more can be sent.
  await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc('friends/kyle_sean').delete());
  await assertSucceeds(kyle.collection('dms/kyle_sean/messages').get());
  await assertFails(kyle.doc('dms/kyle_sean/messages/m8').set(msg('kyle')));
});

test('photos: circle members read them, uploaders delete their own', async () => {
  const kyle = as('kyle');
  await assertSucceeds(kyle.doc('photos/ph1').set({ uid: 'kyle', data: 'data:image/jpeg;base64,AAAA' }));
  await assertFails(kyle.doc('photos/ph2').set({ uid: 'sean', data: 'x' }));
  await assertFails(kyle.doc('photos/ph3').set({ uid: 'kyle', data: 'x'.repeat(300001) }));
  await assertFails(as('eve').doc('photos/ph1').get());
  await assertSucceeds(as('sean').doc('photos/ph1').get());
  await assertFails(as('sean').doc('photos/ph1').delete());
  await assertSucceeds(kyle.doc('photos/ph1').delete());
});
