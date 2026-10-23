// The only file that talks to the backend: Google sign-in and the database
// (Firebase), photos (kept in the database) and receipt reading and the bill
// assistant (the AI proxy in proxy/). Everything else works on plain objects.
// A guest (no sign-in) keeps their groups and bills on this device only.
// Where Firebase could not load at all, it runs from memory so the screens
// still work.
(function () {
  'use strict';
  var Tab = window.Tab = window.Tab || {};
  var config = Tab.config || {};
  var fb = window.firebase;

  var CHAT_KEEP = 200; // each group's chat holds its latest 200 messages; older ones are pruned as new ones arrive
  var INVITE_DAYS = 14;
  var PHOTO_SIDE = 1600; // receipt photos are shrunk to this many pixels on the long side before they are sent
  // Bills and payments are kept under their group, like its chat, so only
  // the group's members can read them (firestore.rules).
  var PARTS = ['bills', 'payments'];

  function groupOf(row) { return (row && row.groupId) || null; }
  function chatPath(groupId) { return 'groups/' + groupId + '/messages'; }
  function chatGroup(path) {
    var m = /^groups\/([^/]+)\/messages$/.exec(path);
    return m ? m[1] : null;
  }
  function rows(snap) { return snap.docs.map(function (doc) { return Object.assign({ id: doc.id }, doc.data()); }); }
  function noop() {}

  // Remembered on this device only: the language before sign-in, an invite
  // link waiting for sign-in, and how far the chat has been read. Falls back
  // to memory where storage is blocked.
  var memory = {};
  function localGet(key) {
    try {
      var v = window.localStorage.getItem(key);
      if (v != null) return v;
    } catch (e) { /* storage blocked */ }
    return memory[key] == null ? null : memory[key];
  }
  function localSet(key, value) {
    memory[key] = value;
    try {
      if (value == null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, String(value));
    } catch (e) { /* storage blocked */ }
  }

  // How far this device has read each group's chat: {groupId: time}.
  function readMarks() {
    try {
      var marks = JSON.parse(localGet('tab.chatRead'));
      return marks && typeof marks === 'object' ? marks : {};
    } catch (e) { return {}; }
  }

  function localSettings() {
    var lang = localGet('tab.lang');
    return lang ? { lang: lang } : {};
  }

  var state = {
    ready: false,
    persistent: false,
    // True when there is a backend. Then no database means the viewer is cut
    // off from their groups; only a page without Firebase may run from memory.
    platform: !!fb,
    auth: 'pending', // 'pending' | 'out' | 'in' | 'none' (no sign-in available)
    guest: false, // using Tab without an account; the data stays on this device
    hasGuestData: !!localGet('tab.guest'), // this device still holds a guest's groups
    user: null, // {uid, name, email} once signed in
    inCircle: null, // whether this account was ever let in through an invite or friend link
    joining: !!(localGet('tab.join') || localGet('tab.add')),
    adding: !!localGet('tab.add'), // the link being opened is someone's friend link
    joinError: null,
    notice: null, // {code, uid}: what happened to a friend link opened on this device
    canWrite: null,
    isOwner: false,
    meId: null, // the viewer's person id, which is their account's uid
    friendCode: null, // the code in this account's own friend link, once made
    friends: [], // uids of this account's friends
    requestsIn: [], // friend requests waiting for this account: [{id, from, to, at}]
    requestsOut: [], // friend requests this account sent that are still open
    invitations: [], // group invitations waiting for this account: [{id, groupId, groupName, from, to, at}]
    groupInvites: {}, // groupId -> that group's open invitations
    chatRead: readMarks(),
    chats: {}, // groupId -> that group's messages, oldest first
    photos: {}, // photo id -> data URL
    canUpload: false,
    canAsk: false,
    canScan: false,
    scanTypes: 'image/*',
    people: [],
    bills: [],
    payments: [],
    groups: [],
    settings: localSettings()
  };
  var listeners = [];
  var auth = null;
  var db = null;
  var sample = null;
  var arrived = {};
  var stops = []; // live queries for the signed-in account, closed on sign-out
  var parts = { bills: {}, payments: {} }; // name -> groupId -> rows
  var partStops = {}; // 'bills/groupId' -> stop
  var chatStops = {};
  var uploaded = {}; // photos uploaded from this device, shown before the database echoes them back

  function emit() {
    state = Object.assign({}, state);
    listeners.forEach(function (fn) { fn(state); });
  }

  function me() { return auth && auth.currentUser ? auth.currentUser.uid : null; }

  // Ready once people, groups and settings have arrived, and the bills and
  // payments of every group, so no balance is shown half-loaded.
  function checkReady() {
    if (state.ready) return;
    var base = ['people', 'groups', 'settings'].every(function (k) { return arrived[k]; });
    var all = state.groups.every(function (g) {
      return PARTS.every(function (name) { return arrived[name + '/' + g.id]; });
    });
    if (base && all) state.ready = true;
  }

  // One live query per group for its chat, bills and payments, opened as
  // groups appear and closed as they go. A group made on this device is only
  // watched once the database has stored it: until then the rules can't see
  // it and would turn the queries away. A query that fails anyway is tried
  // again a few times.
  var retries = {};
  function retry(key, again, e) {
    if (config.emulator) console.warn('feed failed', key, e && e.code);
    var n = (retries[key] || 0) + 1;
    retries[key] = n;
    if (n > 5) return;
    setTimeout(function () {
      var groupId = key.split('/').pop();
      if (db && state.groups.some(function (g) { return g.id === groupId; })) again();
    }, 1000 * n);
  }
  function watchChat(groupId) {
    if (chatStops[groupId]) return;
    var key = 'chat/' + groupId;
    chatStops[groupId] = db.collection(chatPath(groupId)).orderBy('at', 'desc').limit(CHAT_KEEP).onSnapshot(function (snap) {
      retries[key] = 0;
      var chats = Object.assign({}, state.chats);
      chats[groupId] = rows(snap).reverse();
      state.chats = chats;
      emit();
    }, function (e) {
      delete chatStops[groupId];
      retry(key, function () { watchChat(groupId); }, e);
    });
  }
  function watchPart(name, groupId) {
    var key = name + '/' + groupId;
    if (partStops[key]) return;
    function done(list) {
      parts[name][groupId] = list;
      state[name] = [].concat.apply([], Object.keys(parts[name]).map(function (g) { return parts[name][g]; }));
      arrived[key] = true;
      checkReady();
      emit();
    }
    partStops[key] = db.collection('groups/' + groupId + '/' + name).onSnapshot(function (snap) {
      retries[key] = 0;
      done(rows(snap));
    }, function (e) {
      delete partStops[key];
      if (!arrived[key]) done([]);
      retry(key, function () { watchPart(name, groupId); }, e);
    });
  }
  // Who has been invited to a group and hasn't answered yet.
  var inviteStops = {};
  function watchInvites(groupId) {
    if (inviteStops[groupId]) return;
    var key = 'invitations/' + groupId;
    inviteStops[groupId] = db.collection('groups/' + groupId + '/invitations').onSnapshot(function (snap) {
      retries[key] = 0;
      state.groupInvites = Object.assign({}, state.groupInvites);
      state.groupInvites[groupId] = rows(snap);
      emit();
    }, function () {
      delete inviteStops[groupId];
      retry(key, function () { watchInvites(groupId); });
    });
  }
  // saved: the ids of the groups the database has already stored.
  function syncGroups(saved) {
    var ids = state.groups.map(function (g) { return g.id; });
    saved.forEach(function (id) {
      watchChat(id);
      watchInvites(id);
      PARTS.forEach(function (name) { watchPart(name, id); });
    });
    Object.keys(inviteStops).forEach(function (id) {
      if (ids.indexOf(id) !== -1) return;
      inviteStops[id]();
      delete inviteStops[id];
      state.groupInvites = Object.assign({}, state.groupInvites);
      delete state.groupInvites[id];
    });
    Object.keys(chatStops).forEach(function (id) {
      if (ids.indexOf(id) !== -1) return;
      chatStops[id]();
      delete chatStops[id];
      var chats = Object.assign({}, state.chats);
      delete chats[id];
      state.chats = chats;
    });
    PARTS.forEach(function (name) {
      Object.keys(parts[name]).forEach(function (id) {
        if (ids.indexOf(id) !== -1) return;
        if (partStops[name + '/' + id]) partStops[name + '/' + id]();
        delete partStops[name + '/' + id];
        delete parts[name][id];
      });
      state[name] = state[name].filter(function (row) { return ids.indexOf(groupOf(row)) !== -1; });
    });
  }


  function stopAll() {
    stops.forEach(function (stop) { stop(); });
    stops = [];
    Object.keys(chatStops).forEach(function (id) { chatStops[id](); });
    Object.keys(partStops).forEach(function (key) { partStops[key](); });
    Object.keys(inviteStops).forEach(function (id) { inviteStops[id](); });
    chatStops = {};
    partStops = {};
    inviteStops = {};
    parts = { bills: {}, payments: {} };
    arrived = {};
    retries = {};
    sample = null;
    Object.assign(state, {
      ready: false, persistent: false, guest: false, user: null, inCircle: null, meId: null, friendCode: null,
      chats: {}, photos: {}, people: [], bills: [], payments: [], groups: [],
      friends: [], requestsIn: [], requestsOut: [], invitations: [], groupInvites: {},
      canUpload: false, canAsk: false, canScan: false, settings: localSettings()
    });
  }

  function lost() { state.persistent = false; state.ready = true; emit(); }

  // Everything a member of the circle sees, live.
  function watchData(uid) {
    state.persistent = true;
    state.canUpload = true;
    sample = aiClient();
    state.canAsk = state.canScan = !!config.aiUrl;
    // With metadata changes, a snapshot also arrives when a new group is stored.
    stops.push(db.collection('groups').where('memberUids', 'array-contains', uid).onSnapshot({ includeMetadataChanges: true }, function (snap) {
      state.groups = rows(snap);
      syncGroups(snap.docs.filter(function (doc) { return !doc.metadata.hasPendingWrites; }).map(function (doc) { return doc.id; }));
      arrived.groups = true;
      checkReady();
      emit();
    }, lost));
    var making = false;
    stops.push(db.collection('people').onSnapshot(function (snap) {
      state.people = rows(snap);
      // Every account has its own profile; a new one starts from the Google name.
      if (!making && !state.people.some(function (p) { return p.id === uid; })) {
        making = true;
        var user = auth.currentUser || {};
        db.doc('people/' + uid).set({
          uid: uid, name: (user.displayName || (user.email || '').split('@')[0] || '').slice(0, 40),
          isMe: false, archived: false, avatar: { kind: 'preset', preset: uid.charCodeAt(0) % 8 }
        }).catch(function () { making = false; });
      }
      arrived.people = true;
      checkReady();
      emit();
    }, lost));
    stops.push(db.collection('friends').where('uids', 'array-contains', uid).onSnapshot(function (snap) {
      state.friends = snap.docs.map(function (doc) {
        var uids = doc.data().uids || [];
        return uids[0] === uid ? uids[1] : uids[0];
      });
      emit();
    }, noop));
    stops.push(db.collection('friendRequests').where('to', '==', uid).onSnapshot(function (snap) {
      state.requestsIn = rows(snap);
      emit();
    }, noop));
    stops.push(db.collection('friendRequests').where('from', '==', uid).onSnapshot(function (snap) {
      state.requestsOut = rows(snap);
      emit();
    }, noop));
    // Invitations to this account, from every group. This search needs the
    // collection-group index in firestore.indexes.json; if it fails, it is
    // tried again a few times.
    function watchInvitations(n) {
      stops.push(db.collectionGroup('invitations').where('to', '==', uid).onSnapshot(function (snap) {
        state.invitations = rows(snap);
        emit();
      }, function (e) {
        if (config.emulator) console.warn('invitations feed failed', e && e.code);
        if (n < 5) setTimeout(function () { if (me() === uid) watchInvitations(n + 1); }, 3000 * (n + 1));
      }));
    }
    watchInvitations(0);
    stops.push(db.doc('settings/' + uid).onSnapshot(function (snap) {
      state.settings = Object.assign(localSettings(), snap.exists ? snap.data() : {});
      arrived.settings = true;
      checkReady();
      emit();
    }, lost));
    stops.push(db.collection('photos').onSnapshot(function (snap) {
      var photos = {};
      snap.docs.forEach(function (doc) { photos[doc.id] = doc.data().data; });
      state.photos = photos;
      emit();
    }, noop));
  }

  // This account's own record says whether it is in the circle at all. The
  // viewer's person is their own profile, people/{uid}.
  function watchMember(uid) {
    var watching = false;
    stops.push(db.doc('members/' + uid).onSnapshot(function (snap) {
      state.inCircle = snap.exists;
      state.meId = snap.exists ? uid : null;
      state.friendCode = snap.exists ? snap.data().friendCode || null : null;
      if (snap.exists && !watching) {
        watching = true;
        watchData(uid);
      } else if (!snap.exists) {
        state.ready = true;
      }
      emit();
    }, lost));
  }

  // A group invite link (#join=CODE) or a friend link (#add=CODE) is kept until
  // the visitor has signed in.
  function takeInvite() {
    var join = /[#&]join=([A-Za-z0-9_-]{20,})/.exec(location.hash);
    var add = /[#&]add=([A-Za-z0-9_-]{20,})/.exec(location.hash);
    if (!join && !add) return;
    if (join) localSet('tab.join', join[1]);
    if (add) localSet('tab.add', add[1]);
    state.joining = true;
    state.adding = !!add;
    try {
      var params = new URLSearchParams(location.search);
      params.delete('openExternalBrowser');
      var query = params.toString().replace(/=(&|$)/g, '$1');
      history.replaceState(null, '', location.pathname + (query ? '?' + query : ''));
    } catch (e) { /* keep the address as it is */ }
  }

  // Lets this account into the circle with the code of the link it opened,
  // unless it is in already.
  function enterCircle(code) {
    var mine = db.doc('members/' + me());
    return mine.get().then(function (m) {
      if (m.exists) return null;
      return mine.set({ invite: code, joinedAt: Date.now() });
    });
  }

  // Joins the invite's group: first the circle (once per account), then the group.
  function redeem(code) {
    var uid = me();
    var FV = fb.firestore.FieldValue;
    return db.doc('invites/' + code).get().then(function (snap) {
      if (!snap.exists) throw { code: 'invite_missing' };
      var invite = snap.data();
      if (invite.expiresAt && invite.expiresAt.toMillis() < Date.now()) throw { code: 'invite_expired' };
      return enterCircle(code).then(function () {
        return db.doc('groups/' + invite.groupId).update({ memberUids: FV.arrayUnion(uid), memberIds: FV.arrayUnion(uid), joinCode: code });
      });
    }).catch(function (e) {
      throw { code: e && /^invite_/.test(e.code) ? e.code : 'join_failed' };
    });
  }

  // Someone's friend link: lets this account in if it is new, then sends that
  // person a friend request. What happened is left in state.notice.
  function redeemFriend(code) {
    var uid = me();
    return db.doc('friendCodes/' + code).get().then(function (snap) {
      if (!snap.exists) throw { code: 'friend_link_bad' };
      var owner = snap.data().uid;
      if (owner === uid) return { code: 'friend_self', uid: owner };
      return enterCircle(code).then(function () {
        return db.doc('friends/' + pairId(uid, owner)).get().then(function (f) { return f.exists; }, function () { return false; });
      }).then(function (already) {
        if (already) return { code: 'friend_already', uid: owner };
        return db.doc('friendRequests/' + uid + '_' + owner).set({ from: uid, to: owner, at: Date.now() })
          .then(function () { return { code: 'friend_sent', uid: owner }; });
      });
    }).catch(function (e) {
      return { code: e && e.code === 'friend_link_bad' ? 'friend_link_bad' : 'friend_failed' };
    });
  }

  function signedIn(user) {
    state.auth = 'in';
    state.user = { uid: user.uid, name: user.displayName || '', email: user.email || '' };
    emit();
    var code = localGet('tab.join');
    var add = localGet('tab.add');
    var joined = code ? redeem(code) : Promise.resolve();
    joined.catch(function (e) { state.joinError = e.code; }).then(function () {
      return add ? redeemFriend(add).then(function (notice) { state.notice = notice; }) : null;
    }).then(function () {
      localSet('tab.join', null);
      localSet('tab.add', null);
      state.joining = false;
      state.adding = false;
      watchMember(user.uid);
    });
  }

  // ---------- guest ----------

  // A guest's people, groups, bills and payments live in this device's storage.
  var GUEST_ID = 'me';
  function readGuest() {
    try {
      var saved = JSON.parse(localGet('tab.guest'));
      return saved && typeof saved === 'object' ? saved : {};
    } catch (e) { return {}; }
  }
  function saveGuest() {
    localSet('tab.guest', JSON.stringify({ people: state.people, groups: state.groups, bills: state.bills, payments: state.payments }));
    state.hasGuestData = true;
  }

  // Opens Tab without an account. The first time, the guest is one person, "Me".
  function startGuest() {
    var saved = readGuest();
    localSet('tab.mode', 'guest');
    Object.assign(state, {
      guest: true, ready: true, persistent: true, meId: GUEST_ID,
      people: saved.people || [], groups: saved.groups || [], bills: saved.bills || [], payments: saved.payments || []
    });
    if (!state.people.some(function (p) { return p.id === GUEST_ID; })) {
      state.people = state.people.concat({
        id: GUEST_ID, name: Tab.i18n.t('guest.meName'), isMe: false, archived: false, avatar: { kind: 'preset', preset: 0 }
      });
      saveGuest();
    }
    emit();
  }

  // Back to the welcome screen. The guest's data stays on this device for next time.
  function leaveGuest() {
    localSet('tab.mode', null);
    Object.assign(state, { guest: false, meId: null, people: [], groups: [], bills: [], payments: [] });
    emit();
  }

  function clearGuest() {
    localSet('tab.guest', null);
    state.hasGuestData = false;
    leaveGuest();
  }

  function start() {
    // LINE's own browser can't sign in with Google and doesn't keep the login:
    // this asks LINE to open the page in the phone's browser instead.
    if (/\bLine\//.test(navigator.userAgent || '') && !/[?&]openExternalBrowser=1/.test(location.search)) {
      location.replace(location.pathname + (location.search ? location.search + '&' : '?') + 'openExternalBrowser=1' + location.hash);
      return;
    }
    if (!fb || !config.firebase) { state.auth = 'none'; state.ready = true; emit(); return; }
    fb.initializeApp(config.firebase);
    auth = fb.auth();
    db = fb.firestore();
    if (config.emulator) {
      auth.useEmulator('http://127.0.0.1:9099');
      db.useEmulator('127.0.0.1', 8080);
    }
    // Keep a copy of the data on this device, so the next visit shows it at
    // once while the database catches up. Where the browser can't (some
    // private windows), it simply loads from the database each time.
    db.enablePersistence({ synchronizeTabs: true }).catch(noop);
    takeInvite();
    auth.onAuthStateChanged(function (user) {
      stopAll();
      if (user) { localSet('tab.mode', null); signedIn(user); return; }
      state.auth = 'out';
      state.ready = true;
      // A guest comes back to their groups, unless they opened an invite link.
      if (localGet('tab.mode') === 'guest' && !state.joining) { startGuest(); return; }
      emit();
    });
  }

  // Google sign-in in a pop-up; where pop-ups are blocked, the page goes to
  // Google and comes back.
  function signIn() {
    if (!auth) return Promise.reject({ code: 'unavailable' });
    var provider = new fb.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return auth.signInWithPopup(provider).catch(function (e) {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
        return auth.signInWithRedirect(provider);
      }
      throw e;
    });
  }

  // Signing out also wipes the copy of the data kept on this device, then
  // starts the page afresh, as a guest if `toGuest`.
  function signOut(toGuest) {
    if (toGuest === true) localSet('tab.mode', 'guest');
    if (!auth) return Promise.resolve();
    return auth.signOut().then(function () {
      return db.terminate().then(function () { return db.clearPersistence(); }).catch(noop);
    }).then(function () { location.reload(); });
  }

  function newId() {
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function randomCode() {
    var bytes = new Uint8Array(18);
    window.crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  // A link to the group that lets whoever opens it join. A link this account
  // made earlier is reused while it has a couple of days left.
  function inviteFor(groupId) {
    var uid = me();
    if (!db || !uid) return Promise.reject({ code: 'not_granted' });
    return db.collection('invites').where('uid', '==', uid).get().then(function (snap) {
      var soon = Date.now() + 2 * 86400000;
      var found = snap.docs.filter(function (doc) {
        var v = doc.data();
        return v.groupId === groupId && v.expiresAt && v.expiresAt.toMillis() > soon;
      })[0];
      if (found) return found.id;
      var code = randomCode();
      return db.doc('invites/' + code).set({
        groupId: groupId, uid: uid, createdAt: Date.now(),
        expiresAt: fb.firestore.Timestamp.fromMillis(Date.now() + INVITE_DAYS * 86400000)
      }).then(function () { return code; });
    });
  }

  function body(data) {
    var out = JSON.parse(JSON.stringify(data));
    delete out.id;
    delete out.mine; // "is this the viewer" is worked out per device, never stored
    return out;
  }

  // ---------- friends ----------

  // A friendship is stored once, under the two uids in sorted order.
  function pairId(a, b) { return a < b ? a + '_' + b : b + '_' + a; }

  // The code in this account's friend link, made the first time it is asked for.
  function friendLink() {
    var uid = me();
    if (!db || !uid) return Promise.reject({ code: 'not_granted' });
    if (state.friendCode) return Promise.resolve(state.friendCode);
    var code = randomCode();
    return db.doc('friendCodes/' + code).set({ uid: uid, createdAt: Date.now() }).then(function () {
      return db.doc('members/' + uid).update({ friendCode: code });
    }).then(function () {
      state.friendCode = code;
      emit();
      return code;
    });
  }

  // Accepting makes the friendship; either way the request is done.
  function acceptFriend(fromUid) {
    var uid = me();
    var uids = [uid, fromUid].sort();
    return db.doc('friends/' + pairId(uid, fromUid)).set({ uids: uids, since: Date.now() }).then(function () {
      return db.doc('friendRequests/' + fromUid + '_' + uid).delete();
    });
  }
  function declineFriend(fromUid) { return db.doc('friendRequests/' + fromUid + '_' + me()).delete(); }
  function cancelFriendRequest(toUid) { return db.doc('friendRequests/' + me() + '_' + toUid).delete(); }
  function removeFriend(uid) { return db.doc('friends/' + pairId(me(), uid)).delete(); }

  // ---------- group invitations ----------

  // A member invites one of their friends; the friend joins when they accept.
  function inviteToGroup(groupId, uid) {
    var group = state.groups.filter(function (g) { return g.id === groupId; })[0];
    return db.doc('groups/' + groupId + '/invitations/' + uid).set({
      groupId: groupId, groupName: (group && group.name) || '', from: me(), to: uid, at: Date.now()
    });
  }
  function cancelInvitation(groupId, uid) { return db.doc('groups/' + groupId + '/invitations/' + uid).delete(); }
  function acceptInvitation(groupId) {
    var uid = me();
    var FV = fb.firestore.FieldValue;
    return db.doc('groups/' + groupId).update({ memberUids: FV.arrayUnion(uid), memberIds: FV.arrayUnion(uid) }).then(function () {
      return db.doc('groups/' + groupId + '/invitations/' + uid).delete();
    });
  }
  function declineInvitation(groupId) { return db.doc('groups/' + groupId + '/invitations/' + me()).delete(); }

  function markChatRead(groupId) {
    var now = Date.now();
    if (now - (state.chatRead[groupId] || 0) < 1000) return;
    var marks = Object.assign({}, state.chatRead);
    marks[groupId] = now;
    localSet('tab.chatRead', JSON.stringify(marks));
    state.chatRead = marks;
    emit();
  }

  function sendMessage(groupId, personId, text) {
    var doc = { personId: personId, text: String(text).slice(0, 1000), at: Date.now() };
    var list = state.chats[groupId] || [];
    var oldest = list.length >= CHAT_KEEP ? list[0] : null;
    var path = chatPath(groupId);
    return put(path, newId(), doc).then(function () {
      if (oldest) return remove(path, oldest.id).catch(function () {});
      return undefined;
    });
  }

  // A group goes with everything in it: bills, payments, chat and open
  // invitations. They go first, while the group still says who may delete them.
  function removeGroup(groupId) {
    var jobs = [];
    (state.chats[groupId] || []).forEach(function (m) { jobs.push(remove(chatPath(groupId), m.id)); });
    (state.groupInvites[groupId] || []).forEach(function (inv) { jobs.push(cancelInvitation(groupId, inv.id).catch(noop)); });
    PARTS.forEach(function (name) {
      state[name].forEach(function (row) { if (groupOf(row) === groupId) jobs.push(remove(name, row.id)); });
    });
    return Promise.all(jobs).then(function () { return remove('groups', groupId); });
  }

  // A refused write is how the store says "you may not change this group".
  // Remember it so the page can say so, and leave the rejection for the caller.
  function guard(promise) {
    promise.catch(function (e) {
      if (e && e.code === 'invalid_argument' && state.canWrite !== false) {
        state.canWrite = false;
        emit();
      }
    });
    return promise;
  }

  // Where a document lives: bills and payments under their group, everything
  // else at the path the screens use.
  function pathOf(collection, id, doc) {
    if (PARTS.indexOf(collection) === -1) return collection;
    var row = doc || state[collection].filter(function (r) { return r.id === id; })[0];
    return 'groups/' + groupOf(row) + '/' + collection;
  }

  // Who may open a group travels with it, and is the same list as its members
  // (each member is an account). A new group starts with this account alone;
  // others join themselves, through an invitation or an invite link.
  function withAccess(id, doc) {
    var old = state.groups.filter(function (g) { return g.id === id; })[0];
    if (!old) {
      doc.ownerUid = me();
      doc.memberIds = [me()];
      doc.memberUids = [me()];
      return doc;
    }
    doc.ownerUid = old.ownerUid;
    doc.memberUids = (doc.memberIds || []).slice();
    if (old.joinCode) doc.joinCode = old.joinCode;
    return doc;
  }

  // Without a store, rows live in state: a chat under its group's id, anything
  // else under its collection's name.
  function memoryRows(path) {
    var g = chatGroup(path);
    return g ? state.chats[g] || [] : state[path];
  }
  function setMemoryRows(path, rows) {
    var g = chatGroup(path);
    if (g) {
      state.chats = Object.assign({}, state.chats);
      state.chats[g] = rows;
    } else {
      state[path] = rows;
    }
    emit();
  }

  function put(collection, id, data) {
    var doc = body(data);
    if (db && !state.guest) {
      if (collection === 'groups') withAccess(id, doc);
      return guard(db.collection(pathOf(collection, id, doc)).doc(id).set(doc));
    }
    var row = Object.assign({ id: id }, doc);
    var found = false;
    var rows = memoryRows(collection).map(function (r) {
      if (r.id !== id) return r;
      found = true;
      return row;
    });
    setMemoryRows(collection, found ? rows : rows.concat(row));
    if (state.guest) saveGuest();
    return Promise.resolve();
  }

  function remove(collection, id) {
    if (db && !state.guest) return guard(db.collection(pathOf(collection, id)).doc(id).delete());
    setMemoryRows(collection, memoryRows(collection).filter(function (r) { return r.id !== id; }));
    if (state.guest) saveGuest();
    return Promise.resolve();
  }

  // Settings are per account; the language is also kept on this device so the
  // sign-in screen speaks it too.
  function saveSettings(patch) {
    var next = Object.assign({}, state.settings, patch);
    if (next.lang) localSet('tab.lang', next.lang);
    var uid = me();
    if (db && uid && state.inCircle) return guard(db.doc('settings/' + uid).set(next));
    state.settings = next;
    emit();
    return Promise.resolve();
  }

  // Profile photos are small (256px) JPEGs, kept in the database as data URLs.
  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(blob);
    });
  }

  function uploadPhoto(blob) {
    var uid = me();
    if (!db || !uid) return Promise.reject({ code: 'not_granted' });
    return blobToDataUrl(blob).then(function (data) {
      var id = newId();
      uploaded[id] = data;
      return db.collection('photos').doc(id).set({ uid: uid, data: data, at: Date.now() }).then(function () { return id; });
    });
  }

  function deletePhoto(id) {
    if (!db || !id) return Promise.resolve();
    delete uploaded[id];
    return db.collection('photos').doc(id).delete().catch(function () {});
  }

  function photoUrl(id) { return (id && (state.photos[id] || uploaded[id])) || null; }

  // A receipt photo as JPEG at most PHOTO_SIDE pixels on its long side,
  // base64-encoded for the AI proxy.
  function shrinkImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, PHOTO_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        var data = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ mimeType: 'image/jpeg', data: data.slice(data.indexOf(',') + 1) });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject({ code: 'image_rejected' }); };
      img.src = url;
    });
  }

  // Stands in for the model call the prompts below were written for:
  // json(prompt or turns, {images, signal}) resolves the model's JSON answer,
  // or rejects with {code} (rate_limited, session_expired, not_granted,
  // refused, image_rejected, cancelled, ...). The proxy checks the sign-in.
  function aiClient() {
    return {
      json: function (input, options) {
        options = options || {};
        var user = auth && auth.currentUser;
        if (!user || !config.aiUrl) return Promise.reject({ code: 'not_granted' });
        var files = !options.images ? [] : Array.isArray(options.images) ? options.images : [options.images];
        return Promise.all([user.getIdToken(), Promise.all(files.map(shrinkImage))]).then(function (got) {
          if (options.signal && options.signal.aborted) throw { code: 'cancelled' };
          return fetch(config.aiUrl, {
            method: 'POST',
            // text/plain keeps this a "simple" request, with no CORS preflight.
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ token: got[0], input: input, images: got[1] }),
            signal: options.signal
          });
        }).then(function (res) {
          if (!res.ok) throw { code: 'unavailable' };
          return res.json();
        }).then(function (out) {
          if (!out || !out.ok) throw { code: (out && out.code) || 'unavailable' };
          return out.data;
        }).catch(function (e) {
          if (e && e.name === 'AbortError') throw { code: 'cancelled' };
          throw e && e.code ? e : { code: 'network' };
        });
      }
    };
  }

  var RECEIPT_PROMPT = [
    'The image is a photo of a receipt from a restaurant, bar or shop, most likely in Taiwan.',
    'Prices are in New Taiwan Dollars. Read it and reply with only one JSON object in exactly this shape:',
    '{"title": string, "items": [{"name": string, "price": number, "unsure": boolean}], "servicePct": number or null, "taxPct": number or null, "total": number or null}',
    '',
    'Rules:',
    '- "items": one entry per purchased line, in the order printed. "name" is the item as printed on the receipt, in its original language (keep Chinese as Chinese). If a line has a quantity above 1, append it to the name like " ×3".',
    '- "price" is the full amount charged for that line (quantity times unit price) as a whole number of dollars, with no currency symbol.',
    '- A discount that is its own line is an item with a negative price.',
    '- Never list subtotal, total, service charge, tax, tips, cash, change or payment lines as items.',
    '- "unsure" is true when any part of that line was hard to read or you had to guess.',
    '- "servicePct": the service charge percentage if the receipt adds one (10 is common), otherwise null.',
    '- "taxPct": a percentage only if tax is added on top of the listed prices; prices in Taiwan normally already include tax, so this is usually null.',
    '- "total": the final amount charged, or null if it cannot be read.',
    '- "title": the shop or restaurant name if it is visible, otherwise an empty string.',
    'If the image is not a receipt, reply {"title": "", "items": [], "servicePct": null, "taxPct": null, "total": null}.'
  ].join('\n');

  function pctOrNull(v) {
    var n = Number(v);
    return isFinite(n) && n > 0 && n <= 100 ? n : null;
  }

  // Resolves {title, items:[{name, price, unsure}], servicePct, taxPct, total};
  // rejects with the platform's {code, message}.
  function scanReceipt(file, signal) {
    if (!sample || !state.canScan) return Promise.reject({ code: 'images_unavailable' });
    return sample.json(RECEIPT_PROMPT, { images: file, signal: signal }).then(function (res) {
      res = res && typeof res === 'object' ? res : {};
      var items = Array.isArray(res.items) ? res.items : [];
      var total = Number(res.total);
      return {
        title: typeof res.title === 'string' ? res.title.trim().slice(0, 60) : '',
        items: items.map(function (it) {
          return {
            name: String(it && it.name != null ? it.name : '').trim().slice(0, 80),
            price: Math.round(Number(it && it.price)) || 0,
            unsure: !!(it && it.unsure)
          };
        }).filter(function (it) { return it.name || it.price; }),
        servicePct: pctOrNull(res.servicePct),
        taxPct: pctOrNull(res.taxPct),
        total: isFinite(total) && total > 0 ? Math.round(total) : null
      };
    });
  }

  var ASSISTANT_RULES = [
    'You are the bill-splitting assistant inside an app called Tab. The person writing to you went out with friends and wants the bill split. They may attach a photo of the receipt and tell you in plain words who had what, who paid, and how to split things. They write in English or Traditional Chinese.',
    '',
    'Every answer must be ONLY one JSON object in exactly this shape:',
    '{"reply": string, "bill": {"title": string, "date": "YYYY-MM-DD", "payer": string or null, "people": [string], "items": [{"name": string, "price": number, "sharers": [string], "unsure": boolean}], "servicePct": number or null, "taxPct": number or null}}',
    '',
    'Each message from the app gives you TODAY, KNOWN PEOPLE, CURRENT BILL and the person\'s MESSAGE. Rules:',
    '- "bill" is always the COMPLETE bill after applying the latest message, never a partial update. Start from CURRENT BILL and change only what the message (or an attached receipt) calls for. Keep everything else exactly as it is.',
    '- People: use the exact spelling from KNOWN PEOPLE whenever a name, nickname or obvious typo matches one of them. "I", "me", "my", "我" mean the person marked (me). If someone is mentioned who is not in KNOWN PEOPLE, use the name as the person wrote it. "people" is everyone who came to this outing; add anyone the message says came, remove anyone it says did not.',
    '- Receipt photo: read every purchased line. "name" is the item as printed, in its original language (keep Chinese as Chinese); for a quantity above 1 append it like " ×3". "price" is the full amount charged for that line as a whole number of New Taiwan Dollars. A discount on its own line is an item with a negative price. Never list subtotal, total, service charge, tax, tips, cash, change or payment lines as items. "unsure" is true when part of a line was hard to read.',
    '- Items the person only describes in words (no receipt) are added the same way, with the price they give.',
    '- "sharers": the people who split that item equally. If nobody has said who had an item, everyone in "people" shares it. If one person had it alone, list only that person. "split evenly", "平分", "AA" mean everyone in "people".',
    '- An uneven split of one line (say 2 of 3 beers for one person) becomes separate items ("Beer ×2" and "Beer ×1") with the price divided to match.',
    '- "payer": who paid the bill, or null if you have not been told. Keep the current payer unless the message changes it.',
    '- "servicePct": the service charge percentage if the receipt shows one or the person says so (10 is common), otherwise null. "taxPct": only when tax is added on top of the listed prices, which is rare in Taiwan; otherwise null. Keep the current values unless something changes them.',
    '- "title": a short name for the outing (the restaurant name, or what the person calls it). "date": keep the current date unless the receipt or the person gives another.',
    '- "reply": one to three short plain-text sentences in the language the person used. Say what you did. If something important is still missing (who paid, or who had a pricey item that should not be shared by all), ask ONE short question. Do not list amounts: the app works out and shows the totals itself, and you must not do that arithmetic.',
    '- If the message is not about this bill, say briefly that you can only help split this bill and return the bill unchanged.'
  ].join('\n');

  function cleanNames(list) {
    return (Array.isArray(list) ? list : []).map(function (n) { return String(n == null ? '' : n).trim().slice(0, 40); })
      .filter(function (n, i, all) { return n && all.indexOf(n) === i; });
  }

  // One turn of the bill assistant. `history` is the earlier chat as
  // [{role: 'user'|'assistant', text}], `context` describes today, the people
  // and the current bill. Resolves {reply, bill}; rejects with {code, message}.
  function askAssistant(req) {
    if (!sample) return Promise.reject({ code: 'not_granted' });
    var turns = [{ role: 'user', content: ASSISTANT_RULES }];
    (req.history || []).slice(-12).forEach(function (m) {
      if (m.role !== 'user' && m.role !== 'assistant') return;
      turns.push({ role: m.role, content: m.text || '(sent a photo of the receipt)' });
    });
    turns.push({
      role: 'user',
      content: req.context + '\n\nMESSAGE:\n' + (req.message || '(no text)') +
        (req.file ? '\n\n(A photo of the receipt is attached to this message.)' : '')
    });
    var options = { signal: req.signal, cache: false };
    if (req.file) options.images = req.file;

    return sample.json(turns, options).then(function (res) {
      res = res && typeof res === 'object' ? res : {};
      var bill = res.bill && typeof res.bill === 'object' ? res.bill : null;
      if (!bill) return Promise.reject({ code: 'invalid_json' });
      return {
        reply: typeof res.reply === 'string' ? res.reply.trim().slice(0, 600) : '',
        bill: {
          title: typeof bill.title === 'string' ? bill.title.trim().slice(0, 60) : '',
          date: /^\d{4}-\d{2}-\d{2}$/.test(bill.date) ? bill.date : '',
          payer: typeof bill.payer === 'string' && bill.payer.trim() ? bill.payer.trim().slice(0, 40) : null,
          people: cleanNames(bill.people),
          items: (Array.isArray(bill.items) ? bill.items : []).map(function (it) {
            return {
              name: String(it && it.name != null ? it.name : '').trim().slice(0, 80),
              price: Math.round(Number(it && it.price)) || 0,
              sharers: cleanNames(it && it.sharers),
              unsure: !!(it && it.unsure)
            };
          }).filter(function (it) { return it.name || it.price; }).slice(0, 80),
          servicePct: pctOrNull(bill.servicePct),
          taxPct: pctOrNull(bill.taxPct)
        }
      };
    });
  }

  // Only for local testing against the Firebase emulators (config.emulator):
  // signs in as a made-up Google account without a pop-up.
  function testSignIn(email) {
    if (!config.emulator || !auth) return Promise.reject({ code: 'unavailable' });
    var token = JSON.stringify({ sub: email, email: email, email_verified: true, name: email.split('@')[0] });
    return auth.signInWithCredential(fb.auth.GoogleAuthProvider.credential(token));
  }

  Tab.store = {
    groupOf: groupOf,
    markChatRead: markChatRead,
    sendMessage: sendMessage,
    removeGroup: removeGroup,
    askAssistant: askAssistant,
    start: start,
    getState: function () { return state; },
    subscribe: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (l) { return l !== fn; }); };
    },
    newId: newId,
    put: put,
    remove: remove,
    saveSettings: saveSettings,
    uploadPhoto: uploadPhoto,
    deletePhoto: deletePhoto,
    photoUrl: photoUrl,
    scanReceipt: scanReceipt,
    signIn: signIn,
    signOut: signOut,
    startGuest: startGuest,
    leaveGuest: leaveGuest,
    clearGuest: clearGuest,
    inviteFor: inviteFor,
    clearJoinError: function () { state.joinError = null; emit(); },
    clearNotice: function () { state.notice = null; emit(); },
    friendLink: friendLink,
    acceptFriend: acceptFriend,
    declineFriend: declineFriend,
    cancelFriendRequest: cancelFriendRequest,
    removeFriend: removeFriend,
    inviteToGroup: inviteToGroup,
    cancelInvitation: cancelInvitation,
    acceptInvitation: acceptInvitation,
    declineInvitation: declineInvitation,
    testSignIn: testSignIn
  };
})();
