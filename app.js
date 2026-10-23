// Tab: screens and state. Data comes from store.js, sums from calc.js, words from i18n.js.
(function () {
  'use strict';
  var Tab = window.Tab;
  var mount = document.getElementById('app');
  var P = window.htmPreact;
  if (!P) {
    mount.textContent = 'The app could not load. Check your connection and reload the page.';
    return;
  }
  var html = P.html, render = P.render, useState = P.useState, useEffect = P.useEffect, useRef = P.useRef;
  var Calc = Tab.calc, store = Tab.store, I18n = Tab.i18n, t = I18n.t;

  // The link that lets a friend join a group. openExternalBrowser makes LINE
  // open it in the phone's browser, where Google sign-in works.
  function inviteLink(code) {
    return location.origin + location.pathname + '?openExternalBrowser=1#join=' + code;
  }

  var COLORS = ['#FACA82', '#8CC8FF', '#FF9E7A', '#C9B6FF', '#7FD9B4', '#FF9EC0', '#E8D95A', '#8FD8E8'];
  var ICONS = {
    back: 'M19 12H5M11 6l-6 6 6 6',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    plus: 'M12 5v14M5 12h14',
    close: 'M6 6l12 12M18 6L6 18',
    camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    copy: 'M9 9h10v11H9zM5 15V4h10',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    pencil: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
    image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    send: 'M12 19V5M6 11l6-6 6 6',
    users: 'M3 19v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17 14a4 4 0 0 1 4 4v1M15 4.2a3.5 3.5 0 0 1 0 6.6',
    swap: 'M4 8h15l-4-4M20 16H5l4 4',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20.5a7 7 0 0 1 14 0'
  };

  // ---------- small helpers ----------

  function money(n) {
    var v = Math.round(n);
    return (v < 0 ? '−' : '') + 'NT$' + Math.abs(v).toLocaleString('en-US');
  }
  function signed(n) { return (Math.round(n) > 0 ? '+' : '') + money(n); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayISO() { return iso(new Date()); }
  function daysAgoISO(n) { var d = new Date(); d.setDate(d.getDate() - n); return iso(d); }
  function fmtDate(value) {
    if (!value) return '';
    var p = String(value).split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (isNaN(d.getTime())) return String(value);
    var opt = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== new Date().getFullYear()) opt.year = 'numeric';
    try { return new Intl.DateTimeFormat(I18n.lang() === 'zh-TW' ? 'zh-TW' : 'en-US', opt).format(d); }
    catch (e) { return String(value); }
  }
  function initialOf(name) {
    var chars = Array.from(String(name || '').trim());
    if (!chars.length) return '?';
    return /[㐀-鿿]/.test(name) ? chars[chars.length - 1] : chars[0].toUpperCase();
  }
  function nameOf(person) { return person && person.name ? person.name : t('person.unknown'); }
  function sortBills(bills) {
    return bills.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }
  function extrasList(bill) {
    var out = [];
    if (bill.servicePct > 0) out.push(t('edit.plusService', { pct: bill.servicePct }));
    if (bill.taxPct > 0) out.push(t('edit.plusTax', { pct: bill.taxPct }));
    return out;
  }
  function plural(key, n) { return t(key + (n === 1 ? '1' : 'N'), { n: n }); }
  function newPerson(name, index, extra) {
    return Object.assign({
      name: name, isMe: false, archived: false,
      avatar: { kind: 'preset', preset: index % COLORS.length }
    }, extra || {});
  }
  // The person in `list` with this name, ignoring case and outer spaces.
  function findByName(list, name) {
    var k = String(name).trim().toLowerCase();
    return list.filter(function (p) { return String(p.name).trim().toLowerCase() === k; })[0];
  }
  // The id of whoever has this name (brought back if they had been removed),
  // or of a new person made for it.
  function personFor(c, name, extra) {
    var match = findByName(c.people, name);
    if (!match) {
      var id = store.newId();
      store.put('people', id, newPerson(String(name).trim(), c.people.length, extra));
      return id;
    }
    if (match.archived) store.put('people', match.id, Object.assign({}, match, { archived: false }));
    return match.id;
  }

  // A new bill starts with the whole group there and the viewer paying.
  function newDraft(c) {
    var members = c.group.members.map(function (p) { return p.id; });
    if (members.indexOf(c.me.id) === -1) members.unshift(c.me.id);
    return {
      id: null, groupId: c.group.id, title: '', date: todayISO(), payerId: c.me.id, presentIds: members, items: [],
      serviceOn: false, servicePct: '10', taxOn: false, taxPct: '5'
    };
  }
  function draftFromBill(bill) {
    var b = JSON.parse(JSON.stringify(bill));
    return {
      id: b.id, groupId: store.groupOf(b), title: b.title || '', date: b.date || todayISO(), payerId: b.payerId,
      presentIds: b.presentIds || [],
      items: (b.items || []).map(function (it) {
        return { id: it.id, name: it.name || '', price: String(it.price), sharerIds: it.sharerIds || [] };
      }),
      serviceOn: b.servicePct > 0, servicePct: String(b.servicePct > 0 ? b.servicePct : 10),
      taxOn: b.taxPct > 0, taxPct: String(b.taxPct > 0 ? b.taxPct : 5),
      createdAt: b.createdAt, example: !!b.example
    };
  }
  function draftToBill(d) {
    var service = Calc.num(d.servicePct);
    var tax = Calc.num(d.taxPct);
    return {
      groupId: d.groupId, title: d.title, date: d.date, payerId: d.payerId, presentIds: d.presentIds.slice(),
      items: d.items.map(function (it) {
        return { id: it.id, name: it.name, price: Math.round(Calc.num(it.price)), sharerIds: it.sharerIds.slice() };
      }),
      servicePct: d.serviceOn && service > 0 ? service : null,
      taxPct: d.taxOn && tax > 0 ? tax : null
    };
  }

  // Everything the editor and the assistant need to know about a draft:
  // the bill it would save, its shares, and why it can't be saved yet (if so).
  function draftCheck(draft) {
    var bill = draftToBill(draft);
    var sh = Calc.billShares(bill);
    var realItems = bill.items.filter(function (it) { return it.name.trim() || it.price; });
    var unassigned = Math.round(sh.unassigned * sh.mult);
    var problem = !realItems.length ? t('edit.needItems')
      : unassigned !== 0 || sh.unassigned !== 0 ? t('edit.unassigned', { amount: money(unassigned) })
      : '';
    return { bill: bill, sh: sh, realItems: realItems, problem: problem };
  }

  function saveDraft(c, draft) {
    var chk = draftCheck(draft);
    if (chk.problem) return;
    var id = draft.id || store.newId();
    var doc = chk.bill;
    doc.title = draft.title.trim() || t('edit.untitled');
    doc.items = chk.realItems.map(function (it) {
      return {
        id: it.id, name: it.name.trim() || t('item.unnamed'), price: it.price,
        sharerIds: it.sharerIds.filter(function (pid) { return doc.presentIds.indexOf(pid) !== -1; })
      };
    });
    doc.createdAt = draft.createdAt || Date.now();
    if (draft.example) doc.example = true;
    store.put('bills', id, doc).catch(function () { c.say(t('app.saveFailed')); });
    c.saved(Object.assign({ id: id }, doc));
  }

  function squareJpeg(file, size) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var side = Math.min(img.naturalWidth, img.naturalHeight);
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(
          img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size
        );
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) { if (blob) resolve(blob); else reject(new Error('encode')); }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  // Returns the example "you" (for the caller to claim) and the example group.
  function loadExample(myName, asOwner) {
    var ids = { me: store.newId(), mei: store.newId(), arjun: store.newId(), dana: store.newId() };
    var all = [ids.me, ids.mei, ids.arjun, ids.dana];
    var flag = { example: true };
    var gid = store.newId();
    store.put('people', ids.me, newPerson(myName || t('people.you'), 0, { isMe: asOwner, example: true }));
    store.put('people', ids.mei, newPerson('Mei', 1, flag));
    store.put('people', ids.arjun, newPerson('Arjun', 2, flag));
    store.put('people', ids.dana, newPerson('Dana', 3, flag));
    store.put('groups', gid, {
      name: t('example.group'), ownerId: ids.me, memberIds: all, preset: 1, createdAt: Date.now() - 3, example: true
    });
    function item(name, price, sharers) { return { id: store.newId(), name: name, price: price, sharerIds: sharers }; }
    store.put('bills', store.newId(), {
      groupId: gid, title: 'Hotpot night', date: daysAgoISO(2), payerId: ids.mei, presentIds: all, servicePct: 10, taxPct: null,
      createdAt: Date.now(), example: true,
      items: [
        item('Soup base', 400, all),
        item('Beef platter', 720, [ids.me, ids.mei, ids.arjun]),
        item('Seafood set', 640, [ids.mei, ids.dana]),
        item('Veggie basket', 240, all),
        item('Beers ×3', 360, [ids.me, ids.arjun, ids.dana])
      ]
    });
    store.put('bills', store.newId(), {
      groupId: gid, title: 'Karaoke', date: daysAgoISO(8), payerId: ids.me, presentIds: all, servicePct: null, taxPct: null,
      createdAt: Date.now() - 1, example: true,
      items: [item('Room, 3 hours', 2000, all)]
    });
    store.put('bills', store.newId(), {
      groupId: gid, title: 'Brunch', date: daysAgoISO(14), payerId: ids.arjun, presentIds: all, servicePct: null, taxPct: null,
      createdAt: Date.now() - 2, example: true,
      items: [
        item('Brunch sets ×4', 1120, all),
        item('Extra egg', 20, [ids.me]),
        item('Latte', 60, [ids.mei])
      ]
    });
    return { me: ids.me, group: gid };
  }

  function removeExample(data) {
    var gone = data.groups.filter(function (g) { return g.example; }).map(function (g) { return g.id; });
    gone.forEach(function (id) { store.removeGroup(id); });
    ['bills', 'payments', 'people'].forEach(function (name) {
      data[name].forEach(function (row) {
        if (row.example && gone.indexOf(row.groupId) === -1) store.remove(name, row.id);
      });
    });
  }

  // The screens work on copies of a group with extra working fields; only
  // these are stored.
  var GROUP_FIELDS = ['name', 'ownerId', 'memberIds', 'preset', 'createdAt', 'example'];
  function saveGroup(group, patch) {
    var doc = {};
    GROUP_FIELDS.forEach(function (k) { if (group[k] !== undefined) doc[k] = group[k]; });
    return store.put('groups', group.id, Object.assign(doc, patch));
  }

  // ---------- shared pieces ----------

  function Icon(p) {
    var size = p.size || 20;
    return html`<svg aria-hidden="true" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${p.weight || 2} stroke-linecap="round" stroke-linejoin="round"><path d=${ICONS[p.name]} /></svg>`;
  }

  function Avatar(p) {
    var person = p.person || {};
    var size = p.size || 36;
    var assetId = person.avatar && person.avatar.kind === 'photo' ? person.avatar.assetId : null;
    var src = store.photoUrl(assetId);
    var b = useState(false), broken = b[0], setBroken = b[1];
    useEffect(function () { setBroken(false); }, [assetId]);
    var box = 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.42) + 'px';
    if (src && !broken) {
      return html`<img class="avatar" style=${box} src=${src} alt="" onError=${function () { setBroken(true); }} />`;
    }
    var preset = person.avatar && typeof person.avatar.preset === 'number' ? person.avatar.preset : 0;
    return html`<span class="avatar" style=${box + ';background:' + COLORS[preset % COLORS.length]} aria-hidden="true">${initialOf(person.name)}</span>`;
  }

  function GroupAvatar(p) {
    var group = p.group || {};
    var size = p.size || 44;
    var box = 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.42) + 'px;background:' +
      COLORS[(group.preset || 0) % COLORS.length];
    return html`<span class="avatar group" style=${box} aria-hidden="true">${initialOf(group.name)}</span>`;
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // A number that runs up to its new value instead of jumping there. A timer
  // backs up the animation frames, which stop while the page is hidden.
  function useCountUp(target, ms) {
    var still = reducedMotion();
    var s = useState(still ? target : 0), value = s[0], setValue = s[1];
    var from = useRef(still ? target : 0);
    useEffect(function () {
      if (still) { from.current = target; setValue(target); return undefined; }
      var start = null, frame = 0, a = from.current;
      function step(now) {
        if (start === null) start = now;
        var k = Math.min(1, (now - start) / ms);
        var v = Math.round(a + (target - a) * (1 - Math.pow(1 - k, 3)));
        from.current = v;
        setValue(v);
        if (k < 1) frame = requestAnimationFrame(step);
      }
      frame = requestAnimationFrame(step);
      var done = setTimeout(function () { cancelAnimationFrame(frame); from.current = target; setValue(target); }, ms + 150);
      return function () { cancelAnimationFrame(frame); clearTimeout(done); };
    }, [target]);
    return value;
  }

  // The in-page "are you sure?" step before removing or deleting something.
  function Confirm(p) {
    return html`<div class="confirm" role="alertdialog" aria-label=${p.text}>
      <p>${p.text}</p>
      ${p.extra && html`<p class="warn-text">${p.extra}</p>`}
      <div class="confirm-actions">
        <button class="btn small secondary" onClick=${p.onCancel}>${t('common.cancel')}</button>
        <button class="btn small danger" onClick=${p.onConfirm}>${p.label}</button>
      </div>
    </div>`;
  }

  function Badge(p) {
    if (!p.n) return null;
    return html`<span class="badge inline" aria-label=${plural('groups.unread', p.n)}>${p.n > 9 ? '9+' : p.n}</span>`;
  }

  function Head(p) {
    return html`<header class="head">
      ${p.onBack && html`<button class="icon-btn" aria-label=${t('common.back')} onClick=${p.onBack}><${Icon} name="back" /></button>`}
      <div class="head-text">
        <h1>${p.title}</h1>
        ${p.sub && html`<p class="sub">${p.sub}</p>`}
      </div>
      ${p.right}
    </header>`;
  }

  function FilePick(p) {
    function onChange(e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) p.onFile(file);
    }
    return html`<label class=${p.class}>
      ${p.children}
      <input class="visually-hidden" type="file" accept=${p.accept || 'image/*'} capture=${p.capture} disabled=${!!p.disabled} onChange=${onChange} />
    </label>`;
  }

  function LangButton(p) {
    var next = p.lang === 'en' ? 'zh-TW' : 'en';
    return html`<button class="icon-btn text" aria-label=${t('lang.switch')} onClick=${function () { store.saveSettings({ lang: next }); }}>${p.lang === 'en' ? '中' : 'EN'}</button>`;
  }

  // ---------- first run ----------

  function Setup(c) {
    var a = useState(''), name = a[0], setName = a[1];
    var b = useState(''), friend = b[0], setFriend = b[1];
    var f = useState([]), friends = f[0], setFriends = f[1];
    var g = useState(''), group = g[0], setGroup = g[1];
    var e = useState(''), err = e[0], setErr = e[1];

    function addFriend(ev) {
      ev.preventDefault();
      var n = friend.trim();
      if (!n) return;
      if (friends.indexOf(n) === -1) setFriends(friends.concat(n));
      setFriend('');
    }
    function begin() {
      var mine = name.trim();
      if (!mine) { setErr(t('setup.needName')); return; }
      var all = friends.slice();
      var pending = friend.trim();
      if (pending && all.indexOf(pending) === -1) all.push(pending);
      var id = store.newId();
      var memberIds = [id];
      store.put('people', id, newPerson(mine, 0, { isMe: asOwner }));
      all.forEach(function (n, i) {
        var pid = store.newId();
        memberIds.push(pid);
        store.put('people', pid, newPerson(n, i + 1));
      });
      var gid = store.newId();
      store.put('groups', gid, { name: group.trim() || t('group.default'), ownerId: id, memberIds: memberIds, preset: 0, createdAt: Date.now() });
      store.claim(id);
      c.go('group', null, gid);
    }
    function example() {
      var ex = loadExample(name.trim(), asOwner);
      store.claim(ex.me);
      c.go('group', null, ex.group);
    }
    // The stored isMe flag marks the page owner's own person; everyone else
    // says who they are on their own device.
    var asOwner = c.data.isOwner !== false;

    return html`
      <${Head} title="Tab" right=${html`<${LangButton} lang=${c.lang} />`} />
      <section class="section">
        <p class="lead-title">${t('setup.title')}</p>
        <p class="muted">${t('setup.lead')}</p>
      </section>
      <section class="section">
        <label class="eyebrow" for="setup-name">${t('setup.yourName')}</label>
        <input id="setup-name" class="field" value=${name} autocomplete="off" onInput=${function (ev) { setName(ev.target.value); setErr(''); }} />
        ${err && html`<p class="warn-text" role="alert">${err}</p>`}
      </section>
      <section class="section">
        <label class="eyebrow" for="setup-friend">${t('setup.friends')}</label>
        ${friends.length > 0 && html`<div class="pills">
          ${friends.map(function (n) {
            return html`<button key=${n} class="pill on" aria-label=${t('item.remove', { name: n })} onClick=${function () { setFriends(friends.filter(function (x) { return x !== n; })); }}>${n}<${Icon} name="close" size=${14} /></button>`;
          })}
        </div>`}
        <form class="add-row" onSubmit=${addFriend}>
          <input id="setup-friend" class="field" placeholder=${t('setup.friendPh')} value=${friend} autocomplete="off" onInput=${function (ev) { setFriend(ev.target.value); }} />
          <button class="btn small secondary" type="submit">${t('setup.add')}</button>
        </form>
      </section>
      <section class="section">
        <label class="eyebrow" for="setup-group">${t('setup.group')}</label>
        <input id="setup-group" class="field" placeholder=${t('setup.groupPh')} value=${group} autocomplete="off" onInput=${function (ev) { setGroup(ev.target.value); }} />
      </section>
      <div class="stack">
        <button class="btn" onClick=${begin}>${t('setup.start')}</button>
        <button class="btn ghost" onClick=${example}>${t('setup.example')}</button>
      </div>`;
  }

  // Shown inside Claude when this view has no shared store. Without it the page
  // could only pretend, and a group made here would exist on this screen alone.
  function Disconnected(c) {
    return html`
      <${Head} title="Tab" />
      <section class="section">
        <p class="lead-title">${t('off.title')}</p>
        <p class="muted">${t('off.lead')}</p>
      </section>
      <section class="card">
        <p class="row-title">${t('off.fix')}</p>
        <ol class="steps">
          <li>${t('off.step1')}</li>
          <li>${t('off.step2')}</li>
        </ol>
      </section>
      <button class="btn" onClick=${function () { window.location.reload(); }}>${t('off.retry')}</button>`;
  }

  // Shown before sign-in, including to a friend who just opened an invite link.
  function SignIn(p) {
    var b = useState(false), busy = b[0], setBusy = b[1];
    var e = useState(''), err = e[0], setErr = e[1];
    // Google refuses to sign in inside LINE's and other apps' built-in browsers.
    var inApp = /\bLine\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(navigator.userAgent || '');

    function signIn() {
      setBusy(true);
      setErr('');
      store.signIn().then(function () { setBusy(false); }, function (x) {
        setBusy(false);
        if (x && (x.code === 'auth/popup-closed-by-user' || x.code === 'auth/cancelled-popup-request')) return;
        setErr(t('signin.failed'));
      });
    }

    return html`
      <${Head} title="Tab" right=${html`<${LangButton} lang=${p.lang} />`} />
      <section class="section">
        <p class="lead-title">${p.data.joining ? t('signin.joinTitle') : t('signin.title')}</p>
        <p class="muted">${p.data.joining ? t('signin.joinLead') : t('signin.lead')}</p>
      </section>
      ${inApp && html`<p class="banner warn" role="status">${t('signin.inApp')}</p>`}
      <div class="stack">
        <button class="btn" disabled=${busy} onClick=${signIn}>${t('signin.google')}</button>
        ${err && html`<p class="warn-text" role="alert">${err}</p>`}
      </div>`;
  }

  function joinErrorText(code) {
    if (code === 'invite_expired') return t('noinvite.expired');
    if (code === 'invite_missing') return t('noinvite.missing');
    return t('noinvite.failed');
  }

  // Signed in, but this account was never let in through an invite link.
  function NotInvited(p) {
    return html`
      <${Head} title="Tab" right=${html`<${LangButton} lang=${p.lang} />`} />
      <section class="section">
        <p class="lead-title">${t('noinvite.title')}</p>
        <p class="muted">${p.data.joinError ? joinErrorText(p.data.joinError) : t('noinvite.lead')}</p>
        <p class="muted small">${t('noinvite.signedAs', { email: p.data.user ? p.data.user.email : '' })}</p>
      </section>
      <div class="stack">
        <button class="btn secondary" onClick=${function () { store.signOut(); }}>${t('me.signOut')}</button>
      </div>`;
  }

  // Shown to someone who opens an existing group on a device that doesn't know
  // who they are yet.
  function WhoAmI(c) {
    var o = useState(false), open = o[0], setOpen = o[1];
    var n = useState(''), name = n[0], setName = n[1];
    var visible = c.people.filter(function (p) { return !p.archived; });

    function join(ev) {
      ev.preventDefault();
      var clean = name.trim();
      if (clean) store.claim(personFor(c, clean));
    }

    return html`
      <${Head} title="Tab" right=${html`<${LangButton} lang=${c.lang} />`} />
      <section class="section">
        <p class="lead-title">${t('who.title')}</p>
        <p class="muted">${t('who.lead')}</p>
      </section>
      <section class="section">
        <div class="list">
          ${visible.map(function (p) {
            return html`<button class="row tap" key=${p.id} onClick=${function () { store.claim(p.id); }}>
              <${Avatar} person=${p} size=${40} />
              <span class="row-main row-title">${p.name}</span>
              <${Icon} name="arrow" size=${16} />
            </button>`;
          })}
        </div>
        ${!open && html`<button class="btn dashed" onClick=${function () { setOpen(true); }}>${t('who.notListed')}</button>`}
        ${open && html`<form class="add-row" onSubmit=${join}>
          <input id="who-name" class="field" aria-label=${t('setup.yourName')} placeholder=${t('setup.yourName')} value=${name} autocomplete="off" onInput=${function (e) { setName(e.target.value); }} />
          <button class="btn small" type="submit">${t('who.join')}</button>
        </form>`}
      </section>`;
  }

  // ---------- home ----------

  // The viewer's groups, most recently active first, like a list of chats:
  // each row has the viewer's balance there and the latest message.
  function Home(c) {
    var net = Calc.balances(c.data.bills, c.data.payments);
    var mine = Math.round(net[c.me.id] || 0);
    var shown = useCountUp(Math.abs(mine), 700);
    var pr = useState(false), pressed = pr[0], setPressed = pr[1];
    var timer = useRef(null);
    useEffect(function () { return function () { clearTimeout(timer.current); }; }, []);

    // The banner stays pressed in, glowing, for a moment before Settle up opens.
    function openSettle() {
      if (pressed) return;
      setPressed(true);
      timer.current = setTimeout(function () { c.go('settleAll', null, null); }, reducedMotion() ? 0 : 420);
    }
    var hasExample = ['people', 'bills', 'payments', 'groups'].some(function (name) {
      return c.data[name].some(function (row) { return row.example; });
    });

    return html`
      <${Head}
        title=${t('groups.title')}
        right=${html`<button class="icon-btn" aria-label=${t('groups.new')} onClick=${function () { c.go('newGroup', null, null); }}><${Icon} name="plus" weight=${2.5} /></button>`}
      />

      ${hasExample && html`<div class="banner">
        <span>${t('home.example')}</span>
        <button class="link" onClick=${function () { removeExample(c.data); }}>${t('home.removeExample')}</button>
      </div>`}

      ${c.groups.some(function (g) { return g.bills.length; }) && html`<button type="button" class=${'card hero live' + (pressed ? ' pressed' : '')} onClick=${openSettle}>
        <span class="muted">${mine > 0 ? t('home.owed') : mine < 0 ? t('home.owe') : t('home.square')}</span>
        <span class="big">${money(shown)}</span>
        <span class="muted">${plural('groups.across', c.groups.length)}</span>
        <span class="hero-go" aria-hidden="true"><${Icon} name="arrow" size=${20} /></span>
        <span class="visually-hidden">${t('home.openSettle')}</span>
      </button>`}

      <section class="section grow">
        <h2 class="eyebrow">${t('groups.eyebrow')}</h2>
        ${c.groups.length === 0 && html`<p class="empty">${t('groups.none')}</p>`}
        ${c.groups.length === 0 && html`<button class="btn" onClick=${function () { c.go('newGroup', null, null); }}><${Icon} name="plus" weight=${2.5} />${t('groups.new')}</button>`}
        <div class="list">
          ${c.groups.map(function (g) {
            var v = Math.round(g.net[c.me.id] || 0);
            return html`<button class="row tap" key=${g.id} onClick=${function () { c.go('group', null, g.id); }}>
              <${GroupAvatar} group=${g} size=${48} />
              <span class="row-main">
                <span class="line">
                  <span class="row-title clip">${g.name}</span>
                  ${v !== 0 && html`<span class=${'amt ' + (v > 0 ? 'owed' : 'owes')}>${signed(v)}</span>`}
                  ${v === 0 && g.bills.length > 0 && html`<span class="hint">${t('home.even')}</span>`}
                </span>
                <span class="line">
                  <span class="row-sub clip">${g.lastLine || plural('groups.members', g.members.length)}</span>
                  ${g.lastMessageAt > 0 && html`<span class="hint">${when(g.lastMessageAt)}</span>`}
                  <${Badge} n=${g.unread} />
                </span>
              </span>
            </button>`;
          })}
        </div>
      </section>`;
  }

  // One group: balances, outings and the way into its chat.
  function GroupHome(c) {
    var g = c.group;
    var s = useState(false), showAll = s[0], setShowAll = s[1];
    var net = g.net;
    var plan = Calc.settle(net);
    var mine = Math.round(net[c.me.id] || 0);
    var bills = sortBills(g.bills);
    var shown = showAll ? bills : bills.slice(0, 8);
    // Members, plus anyone else this group's bills still count: guests, and people who left.
    var rows = c.people
      .filter(function (p) { return (!p.archived && g.memberIds.indexOf(p.id) !== -1) || Math.round(net[p.id] || 0) !== 0; })
      .map(function (p) { return { p: p, v: Math.round(net[p.id] || 0) }; })
      .sort(function (x, y) { return y.v - x.v; });

    return html`
      <${Head}
        onBack=${function () { c.go('home', null, null); }}
        title=${g.name}
        sub=${plural('groups.members', g.members.length)}
        right=${html`<button class="icon-btn" aria-label=${t('members.title')} onClick=${function () { c.go('members'); }}><${Icon} name="users" /></button>`}
      />

      ${g.example && html`<div class="banner">
        <span>${t('home.example')}</span>
        <button class="link" onClick=${function () { removeExample(c.data); c.go('home', null, null); }}>${t('home.removeExample')}</button>
      </div>`}

      <button class="chat-link" aria-label=${g.unread ? t('chat.openN', { n: g.unread }) : t('chat.open')} onClick=${function () { c.go('chat'); }}>
        <span class="chat-link-icon"><${Icon} name="chat" /></span>
        <span class="row-main">
          <span class="row-title">${t('chat.title')}</span>
          <span class="row-sub">${g.lastLine || t('group.noMessages')}</span>
        </span>
        <${Badge} n=${g.unread} />
        <${Icon} name="arrow" size=${16} />
      </button>

      <section class="card hero">
        <p class="muted">${mine > 0 ? t('group.owed') : mine < 0 ? t('group.owe') : t('home.square')}</p>
        <p class=${'big ' + (mine > 0 ? 'owed' : mine < 0 ? 'owes' : '')}>${money(Math.abs(mine))}</p>
        <p class="muted">${plural('home.across', bills.length)}</p>
        ${plan.length > 0 && html`<button class="link-row" onClick=${function () { c.go('settle'); }}>
          <span>${plural('home.settle', plan.length)}</span><${Icon} name="arrow" size=${18} />
        </button>`}
      </section>

      <section class="section">
        <h2 class="eyebrow">${t('home.balances')}</h2>
        <div class="list">
          ${rows.map(function (r) {
            return html`<div class="row" key=${r.p.id}>
              <${Avatar} person=${r.p} size=${32} />
              <span class="row-main row-title">${r.p.name}</span>
              <span class="hint">${r.v > 0 ? t('home.isOwed') : r.v < 0 ? t('home.owes') : t('home.even')}</span>
              <span class=${'amt wide ' + (r.v > 0 ? 'owed' : r.v < 0 ? 'owes' : 'muted')}>${signed(r.v)}</span>
            </div>`;
          })}
        </div>
      </section>

      <section class="section grow">
        <h2 class="eyebrow">${t('home.outings')}</h2>
        ${bills.length === 0 && html`<p class="empty">${t('home.noOutings')}</p>`}
        <div class="list">
          ${shown.map(function (bill) {
            var sh = Calc.billShares(bill);
            var there = (bill.presentIds || []).indexOf(c.me.id) !== -1;
            return html`<button class="row tap" key=${bill.id} onClick=${function () { c.go('bill', bill.id); }}>
              <span class="row-main">
                <span class="row-title">${bill.title}</span>
                <span class="row-sub">${fmtDate(bill.date)} · ${t('home.paid', { name: nameOf(c.byId[bill.payerId]), amount: money(sh.total) })}</span>
              </span>
              <span class="row-side">
                <span class="amt">${there ? money(sh.shares[c.me.id] || 0) : '—'}</span>
                <span class="row-sub">${there ? t('home.yourShare') : t('home.notThere')}</span>
              </span>
            </button>`;
          })}
        </div>
        ${bills.length > shown.length && html`<button class="btn ghost" onClick=${function () { setShowAll(true); }}>${t('home.showAll', { n: bills.length })}</button>`}
      </section>

      <div class="cta-row cta">
        <button class="btn" onClick=${c.startNew}><${Icon} name="plus" weight=${2.5} />${t('home.addBill')}</button>
        ${c.data.canAsk && html`<button class="btn secondary" onClick=${c.startAi}><${Icon} name="chat" />${t('ai.open')}</button>`}
      </div>`;
  }

  // ---------- add / edit a bill ----------

  function Editor(c) {
    var draft = c.draft;
    var g = useState(false), guestOpen = g[0], setGuestOpen = g[1];
    var gn = useState(''), guestName = gn[0], setGuestName = gn[1];
    var nn = useState(''), newName = nn[0], setNewName = nn[1];
    var np = useState(''), newPrice = np[0], setNewPrice = np[1];
    var nameRef = useRef(null);

    function upd(patch) { c.setDraft(Object.assign({}, draft, patch)); }
    function isHere(id) { return draft.presentIds.indexOf(id) !== -1; }

    var pickable = c.people.filter(function (p) {
      return isHere(p.id) || (!p.archived && c.group.memberIds.indexOf(p.id) !== -1);
    });
    var present = pickable.filter(function (p) { return isHere(p.id); });
    var presentIds = present.map(function (p) { return p.id; });
    var chk = draftCheck(draft);
    var bill = chk.bill, sh = chk.sh, problem = chk.problem;

    function togglePresent(id) {
      if (!isHere(id)) { upd({ presentIds: draft.presentIds.concat(id) }); return; }
      var next = draft.presentIds.filter(function (x) { return x !== id; });
      if (!next.length) return;
      upd({ presentIds: next, payerId: draft.payerId === id ? next[0] : draft.payerId });
    }
    // Someone from outside the group came along: reuse them if the app knows them.
    function addGuest(ev) {
      ev.preventDefault();
      var n = guestName.trim();
      if (!n) return;
      var id = personFor(c, n);
      if (!isHere(id)) upd({ presentIds: draft.presentIds.concat(id) });
      setGuestName('');
      setGuestOpen(false);
    }
    function updItem(id, patch) {
      upd({ items: draft.items.map(function (it) { return it.id === id ? Object.assign({}, it, patch) : it; }) });
    }
    function toggleShare(item, personId) {
      var has = item.sharerIds.indexOf(personId) !== -1;
      updItem(item.id, {
        sharerIds: has ? item.sharerIds.filter(function (x) { return x !== personId; }) : item.sharerIds.concat(personId)
      });
    }
    function addItem(ev) {
      ev.preventDefault();
      var n = newName.trim();
      var price = Math.round(Calc.num(newPrice));
      if (!n && !price) return;
      upd({ items: draft.items.concat({ id: store.newId(), name: n || t('item.unnamed'), price: String(price), sharerIds: presentIds.slice() }) });
      setNewName('');
      setNewPrice('');
      if (nameRef.current) nameRef.current.focus();
    }

    function save() { saveDraft(c, draft); }

    var extras = extrasList(bill);

    return html`
      <${Head} onBack=${c.cancel} title=${draft.id ? t('edit.edit') : t('edit.new')} />

      <section class="section">
        <div class="two-col">
          <div class="section">
            <label class="eyebrow" for="bill-title">${t('edit.title')}</label>
            <input id="bill-title" class="field" placeholder=${t('edit.titlePh')} value=${draft.title} autocomplete="off" onInput=${function (e) { upd({ title: e.target.value }); }} />
          </div>
          <div class="section">
            <label class="eyebrow" for="bill-date">${t('edit.date')}</label>
            <input id="bill-date" class="field" type="date" value=${draft.date} onInput=${function (e) { upd({ date: e.target.value || todayISO() }); }} />
          </div>
        </div>
      </section>

      <section class="section">
        <div class="eyebrow-row">
          <h2 class="eyebrow">${t('edit.whoCame')}</h2>
          <span class="hint">${t('edit.hereCount', { n: present.length, m: pickable.length })}</span>
        </div>
        <div class="who-row">
          ${pickable.map(function (p) {
            var on = isHere(p.id);
            return html`<button key=${p.id} class=${'who' + (on ? '' : ' off')} aria-pressed=${on ? 'true' : 'false'} onClick=${function () { togglePresent(p.id); }}>
              <${Avatar} person=${p} size=${44} />
              <span class="who-name">${p.name}</span>
            </button>`;
          })}
          <button class="who" aria-expanded=${guestOpen ? 'true' : 'false'} onClick=${function () { setGuestOpen(!guestOpen); }}>
            <span class="avatar dashed" style="width:44px;height:44px"><${Icon} name="plus" size=${18} weight=${2.5} /></span>
            <span class="who-name muted">${t('edit.newPerson')}</span>
          </button>
        </div>
        ${guestOpen && html`<form class="add-row" onSubmit=${addGuest}>
          <input id="guest-name" class="field" aria-label=${t('edit.guestPh')} placeholder=${t('edit.guestPh')} value=${guestName} autocomplete="off" onInput=${function (e) { setGuestName(e.target.value); }} />
          <button class="btn small secondary" type="submit">${t('setup.add')}</button>
        </form>`}
      </section>

      <section class="section">
        <h2 class="eyebrow">${t('edit.whoPaid')}</h2>
        <div class="pills">
          ${present.map(function (p) {
            var on = draft.payerId === p.id;
            return html`<button key=${p.id} class=${'pill' + (on ? ' on' : '')} aria-pressed=${on ? 'true' : 'false'} onClick=${function () { upd({ payerId: p.id, payerAssumed: false }); }}>${p.name}</button>`;
          })}
        </div>
      </section>

      <section class="section">
        <div class="eyebrow-row">
          <h2 class="eyebrow">${t('edit.items')}</h2>
          <span class="hint">${t('edit.itemsHint')}</span>
        </div>
        <div class="list">
          ${draft.items.map(function (it) {
            var allOn = presentIds.length > 0 && presentIds.every(function (id) { return it.sharerIds.indexOf(id) !== -1; });
            return html`<div class="item" key=${it.id}>
              <div class="item-top">
                <input class="plain" aria-label=${t('item.name')} value=${it.name} autocomplete="off" onInput=${function (e) { updItem(it.id, { name: e.target.value }); }} />
                <span class="cur">NT$</span>
                <input class="plain price" inputmode="numeric" aria-label=${t('item.price')} value=${it.price} autocomplete="off" onInput=${function (e) { updItem(it.id, { price: e.target.value }); }} />
                <button class="icon-btn bare muted" aria-label=${t('item.remove', { name: it.name })} onClick=${function () { upd({ items: draft.items.filter(function (x) { return x.id !== it.id; }) }); }}><${Icon} name="close" size=${18} /></button>
              </div>
              <div class="pills">
                ${present.map(function (p) {
                  var on = it.sharerIds.indexOf(p.id) !== -1;
                  return html`<button key=${p.id} class=${'pill chip' + (on ? ' on' : '')} aria-pressed=${on ? 'true' : 'false'} onClick=${function () { toggleShare(it, p.id); }}>
                    <${Avatar} person=${p} size=${24} />${p.name}
                  </button>`;
                })}
                <button class="pill chip quiet" onClick=${function () { updItem(it.id, { sharerIds: allOn ? [] : presentIds.slice() }); }}>${allOn ? t('item.none') : t('item.everyone')}</button>
              </div>
            </div>`;
          })}
        </div>
        <form class="add-row" onSubmit=${addItem}>
          <input id="new-item-name" ref=${nameRef} class="field" aria-label=${t('item.name')} placeholder=${t('edit.namePh')} value=${newName} autocomplete="off" onInput=${function (e) { setNewName(e.target.value); }} />
          <input id="new-item-price" class="field price" inputmode="numeric" aria-label=${t('item.price')} placeholder="NT$" value=${newPrice} autocomplete="off" onInput=${function (e) { setNewPrice(e.target.value); }} />
          <button class="btn small secondary" type="submit">${t('edit.addItem')}</button>
        </form>
        ${c.data.canScan && html`<${FilePick} class="btn dashed" accept=${c.data.scanTypes} onFile=${c.startScan}>
          <${Icon} name="camera" size=${18} />${t('edit.scan')}
        <//>`}
        ${c.data.canAsk && html`<button class="btn dashed" onClick=${function () { c.go('ai'); }}>
          <${Icon} name="chat" size=${18} />${t('ai.fromEditor')}
        </button>`}
      </section>

      <section class="section">
        <div class="switch-row">
          <span class="row-main row-title">${t('edit.service')}</span>
          ${draft.serviceOn && html`<span class="pct">
            <input id="service-pct" class="field" inputmode="decimal" aria-label=${t('edit.servicePct')} value=${draft.servicePct} onInput=${function (e) { upd({ servicePct: e.target.value }); }} />%
          </span>`}
          <div class="seg">
            <button class=${draft.serviceOn ? '' : 'on'} aria-pressed=${draft.serviceOn ? 'false' : 'true'} onClick=${function () { upd({ serviceOn: false }); }}>${t('edit.no')}</button>
            <button class=${draft.serviceOn ? 'on' : ''} aria-pressed=${draft.serviceOn ? 'true' : 'false'} onClick=${function () { upd({ serviceOn: true }); }}>${t('edit.yes')}</button>
          </div>
        </div>
        <div class="switch-row">
          <span class="row-main row-title">${t('edit.tax')}</span>
          ${draft.taxOn && html`<span class="pct">
            <input id="tax-pct" class="field" inputmode="decimal" aria-label=${t('edit.taxPct')} value=${draft.taxPct} onInput=${function (e) { upd({ taxPct: e.target.value }); }} />%
          </span>`}
          <div class="seg">
            <button class=${draft.taxOn ? '' : 'on'} aria-pressed=${draft.taxOn ? 'false' : 'true'} onClick=${function () { upd({ taxOn: false }); }}>${t('edit.no')}</button>
            <button class=${draft.taxOn ? 'on' : ''} aria-pressed=${draft.taxOn ? 'true' : 'false'} onClick=${function () { upd({ taxOn: true }); }}>${t('edit.yes')}</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="sum-head">
          <span class="muted">${[t('edit.sumItems', { amount: money(sh.subtotal) })].concat(extras).join(' + ')}</span>
          <span class="amt">${money(sh.total)}</span>
        </div>
        <div class="summary">
          ${present.map(function (p) {
            return html`<div class="sum-cell" key=${p.id}>
              <span class="hint">${p.name}${draft.payerId === p.id ? ' · ' + t('edit.paidTag') : ''}</span>
              <span class="amt">${money(sh.shares[p.id] || 0)}</span>
            </div>`;
          })}
        </div>
      </section>

      <div class="stack cta">
        ${problem && html`<p class="warn-text" role="status">${problem}</p>`}
        <button class="btn" disabled=${!!problem} onClick=${save}>${t('edit.save')}</button>
      </div>`;
  }

  // ---------- scan a receipt ----------

  function scanMessage(code) {
    if (code === 'rate_limited') return t('scan.err.rate');
    if (code === 'image_rejected') return t('scan.err.image');
    if (code === 'session_expired') return t('scan.err.signin');
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'images_unavailable'].indexOf(code) !== -1) {
      return t('scan.err.unavailable');
    }
    return t('scan.err.generic');
  }

  function Scan(c) {
    var s = useState({ phase: 'reading' }), state = s[0], setState = s[1];
    var a = useState(0), attempt = a[0], setAttempt = a[1];
    var u = useState(''), photoUrl = u[0], setPhotoUrl = u[1];
    var ctlRef = useRef(null);

    useEffect(function () {
      var url = URL.createObjectURL(c.file);
      setPhotoUrl(url);
      return function () { URL.revokeObjectURL(url); };
    }, [c.file]);

    useEffect(function () {
      var ctl = new AbortController();
      ctlRef.current = ctl;
      setState({ phase: 'reading' });
      store.scanReceipt(c.file, ctl.signal).then(function (res) {
        if (ctl.signal.aborted) return;
        setState({
          phase: 'review', title: res.title, servicePct: res.servicePct, taxPct: res.taxPct, total: res.total,
          items: res.items.map(function (it) { return { id: store.newId(), name: it.name, price: String(it.price), unsure: it.unsure }; })
        });
      }, function (err) {
        if (ctl.signal.aborted || (err && err.code === 'cancelled')) return;
        setState({ phase: 'error', message: scanMessage(err && err.code) });
      });
      return function () { ctl.abort(); };
    }, [c.file, attempt]);

    function updRow(id, patch) {
      setState(Object.assign({}, state, {
        items: state.items.map(function (it) { return it.id === id ? Object.assign({}, it, patch) : it; })
      }));
    }
    function useItems() {
      var draft = c.draft;
      var added = state.items.map(function (it) {
        return { id: it.id, name: it.name.trim() || t('item.unnamed'), price: String(Math.round(Calc.num(it.price))), sharerIds: draft.presentIds.slice() };
      });
      var patch = { items: draft.items.concat(added) };
      if (!draft.title.trim() && state.title) patch.title = state.title;
      if (state.servicePct) { patch.serviceOn = true; patch.servicePct = String(state.servicePct); }
      if (state.taxPct) { patch.taxOn = true; patch.taxPct = String(state.taxPct); }
      c.setDraft(Object.assign({}, draft, patch));
      c.back();
    }

    var head = html`<${Head} onBack=${c.back} title=${t('scan.title')} />`;
    var photo = photoUrl && html`<img class="photo" src=${photoUrl} alt="" />`;

    if (state.phase === 'reading') {
      return html`${head}${photo}
        <section class="card center" role="status">
          <span class="spinner" aria-hidden="true"></span>
          <p class="row-title">${t('scan.reading')}</p>
          <p class="muted">${t('scan.readingHint')}</p>
        </section>
        <button class="btn secondary" onClick=${c.back}>${t('scan.stop')}</button>`;
    }

    if (state.phase === 'error') {
      return html`${head}${photo}
        <p class="warn-text" role="alert">${state.message}</p>
        <div class="stack">
          <button class="btn" onClick=${function () { setAttempt(attempt + 1); }}>${t('scan.retry')}</button>
          <button class="btn ghost" onClick=${c.back}>${t('scan.back')}</button>
        </div>`;
    }

    var itemsSum = state.items.reduce(function (sum, it) { return sum + Math.round(Calc.num(it.price)); }, 0);
    var withExtras = Math.round(itemsSum * (1 + ((state.servicePct || 0) + (state.taxPct || 0)) / 100));
    var mismatch = state.total != null && Math.abs(withExtras - state.total) > 1;

    return html`${head}${photo}
      <section class="section">
        <div class="eyebrow-row">
          <h2 class="eyebrow">${plural('scan.found', state.items.length)}</h2>
          ${state.items.length > 0 && html`<span class="hint">${t('scan.fix')}</span>`}
        </div>
        ${state.items.length === 0 && html`<p class="empty">${t('scan.none')}</p>`}
        <div class="list">
          ${state.items.map(function (it) {
            return html`<div class="item" key=${it.id}>
              <div class="item-top">
                <input class=${'plain' + (it.unsure ? ' flagged' : '')} aria-label=${t('item.name')} value=${it.name} autocomplete="off" onInput=${function (e) { updRow(it.id, { name: e.target.value }); }} />
                ${it.unsure && html`<span class="tag warn">${t('scan.check')}</span>`}
                <span class="cur">NT$</span>
                <input class=${'plain price' + (it.unsure ? ' flagged' : '')} inputmode="numeric" aria-label=${t('item.price')} value=${it.price} autocomplete="off" onInput=${function (e) { updRow(it.id, { price: e.target.value }); }} />
                <button class="icon-btn bare muted" aria-label=${t('item.remove', { name: it.name })} onClick=${function () { setState(Object.assign({}, state, { items: state.items.filter(function (x) { return x.id !== it.id; }) })); }}><${Icon} name="close" size=${18} /></button>
              </div>
            </div>`;
          })}
        </div>
        ${state.servicePct && html`<p class="muted">${t('scan.service', { pct: state.servicePct })}</p>`}
        ${state.taxPct && html`<p class="muted">${t('scan.tax', { pct: state.taxPct })}</p>`}
      </section>

      ${state.items.length > 0 && html`<section class="card">
        <div class="sum-head"><span class="muted">${t('scan.itemsTotal')}</span><span class="amt">${money(withExtras)}</span></div>
        ${state.total != null && html`<div class="sum-head"><span class="muted">${t('scan.receiptTotal')}</span><span class="amt">${money(state.total)}</span></div>`}
        ${mismatch && html`<p class="warn-text" role="status">${t('scan.mismatch')}</p>`}
      </section>`}

      <div class="stack">
        ${state.items.length > 0 && html`<button class="btn" onClick=${useItems}>${plural('scan.use', state.items.length)}</button>`}
        <${FilePick} class="btn ghost" accept=${c.data.scanTypes} onFile=${c.startScan}>${t('scan.again')}<//>
      </div>`;
  }

  // ---------- AI assistant ----------

  function aiMessage(code) {
    if (code === 'rate_limited') return t('ai.err.rate');
    if (code === 'image_rejected') return t('scan.err.image');
    if (code === 'session_expired') return t('scan.err.signin');
    if (code === 'refused') return t('ai.err.refused');
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].indexOf(code) !== -1) {
      return t('ai.err.unavailable');
    }
    return t('ai.err.generic');
  }

  // What the assistant is told each turn: today, who exists, and the bill as it
  // stands, with people written as names (it never sees ids).
  function aiContext(c, draft) {
    function nm(id) { return nameOf(c.byId[id]); }
    var known = c.people.filter(function (p) { return !p.archived; }).map(function (p) {
      return '- ' + p.name + (p.mine ? ' (me)' : c.group.memberIds.indexOf(p.id) !== -1 ? '' : ' (not in this group, comes sometimes)');
    });
    var bill = draftToBill(draft);
    var current = {
      title: bill.title,
      date: bill.date,
      payer: draft.payerAssumed ? null : nm(bill.payerId),
      people: bill.presentIds.map(nm),
      items: bill.items.map(function (it) {
        return {
          name: it.name, price: it.price,
          sharers: it.sharerIds.filter(function (id) { return bill.presentIds.indexOf(id) !== -1; }).map(nm)
        };
      }),
      servicePct: bill.servicePct,
      taxPct: bill.taxPct
    };
    return 'TODAY: ' + todayISO() + '\nKNOWN PEOPLE:\n' + known.join('\n') + '\nCURRENT BILL:\n' + JSON.stringify(current);
  }

  // Turn the assistant's bill (people as names) back into a draft (people as ids).
  // A name nobody has yet becomes a new "comes sometimes" person.
  function applyAiBill(c, draft, ai) {
    function key(name) { return String(name).trim().toLowerCase(); }
    var byName = {};
    c.people.filter(function (p) { return p.archived; })
      .concat(c.people.filter(function (p) { return !p.archived; }))
      .forEach(function (p) { byName[key(p.name)] = p.id; });

    var added = [];
    function idFor(name) {
      var k = key(name);
      if (!k) return null;
      if (!byName[k]) {
        var id = store.newId();
        store.put('people', id, newPerson(String(name).trim(), c.people.length + added.length, c.me.example ? { example: true } : null));
        byName[k] = id;
        added.push(String(name).trim());
      }
      return byName[k];
    }
    function idsFor(names) {
      var out = [];
      names.forEach(function (n) {
        var id = idFor(n);
        if (id && out.indexOf(id) === -1) out.push(id);
      });
      return out;
    }

    var present = idsFor(ai.people);
    var items = ai.items.map(function (it) {
      var sharers = idsFor(it.sharers);
      sharers.forEach(function (id) { if (present.indexOf(id) === -1) present.push(id); });
      return { id: store.newId(), name: it.name, price: String(it.price), sharerIds: sharers, unsure: it.unsure };
    });
    var payerId = ai.payer ? idFor(ai.payer) : null;
    if (payerId && present.indexOf(payerId) === -1) present.push(payerId);
    if (!present.length) present = draft.presentIds.slice();
    var fallbackPayer = present.indexOf(draft.payerId) !== -1 ? draft.payerId
      : present.indexOf(c.me.id) !== -1 ? c.me.id : present[0];

    return {
      added: added,
      draft: Object.assign({}, draft, {
        title: ai.title || draft.title,
        date: ai.date || draft.date,
        payerId: payerId || fallbackPayer,
        payerAssumed: payerId ? false : !!draft.payerAssumed,
        presentIds: present,
        items: items,
        serviceOn: !!ai.servicePct,
        servicePct: ai.servicePct ? String(ai.servicePct) : draft.servicePct,
        taxOn: !!ai.taxPct,
        taxPct: ai.taxPct ? String(ai.taxPct) : draft.taxPct
      })
    };
  }

  function Assistant(c) {
    var draft = c.draft;
    var tx = useState(''), text = tx[0], setText = tx[1];
    var ph = useState(null), photo = ph[0], setPhoto = ph[1];
    var bz = useState(false), busy = bz[0], setBusy = bz[1];
    var ctlRef = useRef(null);
    var endRef = useRef(null);
    var latest = useRef(c);
    latest.current = c;

    useEffect(function () {
      return function () { if (ctlRef.current) ctlRef.current.abort(); };
    }, []);
    useEffect(function () {
      if ((c.chat.length || busy) && endRef.current) endRef.current.scrollIntoView({ block: 'end' });
    }, [c.chat.length, busy]);

    function send(ev) {
      ev.preventDefault();
      var msg = text.trim();
      if (busy || (!msg && !photo)) return;
      var history = c.chat;
      var file = photo ? photo.file : null;
      c.setChat(history.concat({ role: 'user', text: msg, photoUrl: photo ? photo.url : null }));
      setText('');
      setPhoto(null);
      setBusy(true);
      var ctl = new AbortController();
      ctlRef.current = ctl;
      store.askAssistant({
        history: history, context: aiContext(c, draft), message: msg, file: file, signal: ctl.signal
      }).then(function (res) {
        if (ctl.signal.aborted) return;
        var now = latest.current;
        var applied = applyAiBill(now, now.draft, res.bill);
        now.setDraft(applied.draft);
        var next = now.chat.concat({ role: 'assistant', text: res.reply || t('ai.done') });
        applied.added.forEach(function (name) { next.push({ role: 'note', text: t('ai.added', { name: name }) }); });
        now.setChat(next);
        setBusy(false);
      }, function (err) {
        if (ctl.signal.aborted || (err && err.code === 'cancelled')) return;
        var now = latest.current;
        now.setChat(now.chat.concat({ role: 'error', text: aiMessage(err && err.code) }));
        setBusy(false);
      });
    }
    function stop() {
      if (ctlRef.current) ctlRef.current.abort();
      setBusy(false);
    }
    function pickPhoto(file) {
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto({ file: file, url: URL.createObjectURL(file) });
    }

    // On a phone the camera button opens the camera itself and a second button
    // picks an existing picture; a computer has only the file picker.
    var touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var chk = draftCheck(draft);
    var sh = chk.sh;
    var hasBill = chk.realItems.length > 0;
    var present = c.people.filter(function (p) { return draft.presentIds.indexOf(p.id) !== -1; });
    var friend = c.group.members.filter(function (p) { return !p.mine; })[0];
    var extras = extrasList(chk.bill);
    var sep = c.lang === 'zh-TW' ? '、' : ', ';
    function sharedBy(item) {
      var ids = item.sharerIds.filter(function (id) { return draft.presentIds.indexOf(id) !== -1; });
      if (!ids.length) return t('ai.nobody');
      if (ids.length === draft.presentIds.length && ids.length > 1) return t('ai.everyone');
      return ids.map(function (id) { return nameOf(c.byId[id]); }).join(sep);
    }

    return html`
      <${Head} onBack=${c.cancel} title=${t('ai.title')} sub=${draft.title || null} />

      <section class="chat grow">
        <div class="bubble ai">
          <p>${t('ai.intro')}</p>
          ${friend && html`<p class="muted">${t('ai.example', { a: friend.name })}</p>`}
        </div>
        ${c.chat.map(function (m, i) {
          if (m.role === 'user') {
            return html`<div class="bubble me" key=${i}>
              ${m.photoUrl && html`<img class="thumb" src=${m.photoUrl} alt=${t('ai.photo')} />`}
              ${m.text && html`<p>${m.text}</p>`}
              ${!m.text && !m.photoUrl && html`<p>${t('ai.photo')}</p>`}
            </div>`;
          }
          if (m.role === 'note') return html`<p class="chat-note" key=${i}>${m.text}</p>`;
          if (m.role === 'error') return html`<div class="bubble ai error" role="alert" key=${i}><p>${m.text}</p></div>`;
          return html`<div class="bubble ai" key=${i}><p>${m.text}</p></div>`;
        })}
        ${busy && html`<div class="bubble ai thinking" role="status">
          <span class="spinner small" aria-hidden="true"></span><span>${t('ai.thinking')}</span>
        </div>`}

        ${hasBill && html`<section class="card">
          <div class="sum-head">
            <h2 class="eyebrow">${t('ai.soFar')}</h2>
            <span class="amt">${money(sh.total)}</span>
          </div>
          ${!draft.payerAssumed && html`<p class="muted small">${[t('home.paid', { name: nameOf(c.byId[draft.payerId]), amount: money(sh.total) })].concat(extras).join(' · ')}</p>`}
          ${draft.payerAssumed && extras.length > 0 && html`<p class="muted small">${extras.join(' · ')}</p>`}
          ${draft.payerAssumed && html`<div class="section">
            <p class="warn-text">${t('ai.whoPaid')}</p>
            <div class="pills">
              ${present.map(function (p) {
                return html`<button key=${p.id} class="pill" onClick=${function () { c.setDraft(Object.assign({}, draft, { payerId: p.id, payerAssumed: false })); }}>${p.name}</button>`;
              })}
            </div>
          </div>`}
          <div class="list">
            ${draft.items.map(function (it) {
              var nobody = !it.sharerIds.some(function (id) { return draft.presentIds.indexOf(id) !== -1; });
              return html`<div class="ai-item" key=${it.id}>
                <span class="row-main">
                  <span class=${'ai-name' + (it.unsure ? ' owes' : '')}>${it.name}${it.unsure && html` <span class="tag warn">${t('scan.check')}</span>`}</span>
                  <span class=${'row-sub wrap' + (nobody ? ' owes' : '')}>${sharedBy(it)}</span>
                </span>
                <span class="amt">${money(Calc.num(it.price))}</span>
              </div>`;
            })}
          </div>
          <div class="summary">
            ${present.map(function (p) {
              return html`<div class="sum-cell" key=${p.id}>
                <span class="hint">${p.name}${!draft.payerAssumed && draft.payerId === p.id ? ' · ' + t('edit.paidTag') : ''}</span>
                <span class="amt">${money(sh.shares[p.id] || 0)}</span>
              </div>`;
            })}
          </div>
        </section>`}
        <div ref=${endRef}></div>
      </section>

      <div class="stack cta">
        ${hasBill && chk.problem && html`<p class="warn-text" role="status">${chk.problem}</p>`}
        ${hasBill && html`<div class="pay-actions">
          <button class="btn small secondary" onClick=${function () { c.go('edit'); }}><${Icon} name="pencil" size=${16} />${t('ai.edit')}</button>
          <button class="btn small" disabled=${!!chk.problem || !!draft.payerAssumed || busy} onClick=${function () { saveDraft(c, draft); }}>${t('edit.save')}</button>
        </div>`}
        ${photo && html`<div class="attached">
          <img src=${photo.url} alt="" />
          <span class="row-main">${t('ai.photo')}</span>
          <button class="icon-btn bare muted" aria-label=${t('ai.removePhoto')} onClick=${function () { URL.revokeObjectURL(photo.url); setPhoto(null); }}><${Icon} name="close" size=${18} /></button>
        </div>`}
        <form class="composer" onSubmit=${send}>
          ${c.data.canScan && touch && html`<${FilePick} class="icon-btn" accept=${c.data.scanTypes} capture="environment" disabled=${busy} onFile=${pickPhoto}>
            <${Icon} name="camera" /><span class="visually-hidden">${t('ai.takePhoto')}</span>
          <//>`}
          ${c.data.canScan && html`<${FilePick} class="icon-btn" accept=${c.data.scanTypes} disabled=${busy} onFile=${pickPhoto}>
            <${Icon} name=${touch ? 'image' : 'camera'} /><span class="visually-hidden">${t('ai.addPhoto')}</span>
          <//>`}
          <input id="ai-message" class="field" aria-label=${t('ai.placeholder')} placeholder=${t('ai.placeholder')} value=${text} autocomplete="off" onInput=${function (e) { setText(e.target.value); }} />
          ${busy
            ? html`<button type="button" class="btn small secondary" onClick=${stop}>${t('scan.stop')}</button>`
            : html`<button type="submit" class="icon-btn send" aria-label=${t('ai.send')} disabled=${!text.trim() && !photo}><${Icon} name="send" weight=${2.2} /></button>`}
        </form>
      </div>`;
  }

  // ---------- one bill ----------

  function billText(bill, sh, byId) {
    var extras = extrasList(bill);
    var lines = [bill.title + ' · ' + bill.date];
    lines.push(
      t('home.paid', { name: nameOf(byId[bill.payerId]), amount: money(sh.total) }) +
      (extras.length ? ' (' + t('bill.includes', { list: extras.join(' + ') }) + ')' : '')
    );
    (bill.presentIds || []).forEach(function (id) {
      if (id === bill.payerId) return;
      lines.push(t('copy.owes', { name: nameOf(byId[id]), amount: money(sh.shares[id] || 0) }));
    });
    return lines.join('\n');
  }

  function Detail(c) {
    var k = useState(false), confirming = k[0], setConfirming = k[1];
    var bill = c.data.bills.filter(function (b) { return b.id === c.id; })[0] ||
      (c.lastSaved && c.lastSaved.id === c.id ? c.lastSaved : null);
    if (!bill) return html`<${Head} onBack=${function () { c.go('group'); }} title=${t('bill.missing')} />`;

    var sh = Calc.billShares(bill);
    var payerName = nameOf(c.byId[bill.payerId]);
    var present = bill.presentIds || [];
    var owers = present.filter(function (id) { return id !== bill.payerId; });
    var back = owers.reduce(function (sum, id) { return sum + (sh.shares[id] || 0); }, 0);
    var extras = extrasList(bill);
    var sep = c.lang === 'zh-TW' ? '、' : ', ';
    function ate(id) {
      var ids = sh.itemIds[id] || [];
      var names = (bill.items || []).filter(function (it) { return ids.indexOf(it.id) !== -1; }).map(function (it) { return it.name; });
      return names.length ? names.join(sep) : t('bill.nothing');
    }
    function row(id, isPayer) {
      var person = c.byId[id] || {};
      return html`<div class="row top" key=${id}>
        <${Avatar} person=${person} size=${36} />
        <span class="row-main">
          <span class="row-title">${nameOf(person)}${isPayer && html`<span class="hint"> · ${t('bill.ownShare')}</span>`}</span>
          <span class="row-sub wrap">${ate(id)}</span>
        </span>
        <span class=${'amt ' + (isPayer ? 'muted' : 'owes')}>${money(sh.shares[id] || 0)}</span>
      </div>`;
    }

    return html`
      <${Head}
        onBack=${function () { c.go('group'); }}
        title=${bill.title}
        sub=${fmtDate(bill.date) + (bill.example ? ' · ' + t('bill.example') : '')}
        right=${html`<button class="btn small secondary" onClick=${function () { c.startEdit(bill); }}><${Icon} name="pencil" size=${16} />${t('bill.edit')}</button>`}
      />

      <section class="card hero">
        <p class="muted">${t('bill.paidBy', { name: payerName })}</p>
        <p class="big">${money(sh.total)}</p>
        <p class="muted">${[plural('bill.items', (bill.items || []).length)].concat(extras.length ? [t('bill.includes', { list: extras.join(' + ') })] : []).join(' · ')}</p>
      </section>

      <section class="section grow">
        <h2 class="eyebrow">${t('bill.whoOwes', { name: payerName })}</h2>
        <div class="list">
          ${owers.map(function (id) { return row(id, false); })}
          ${present.indexOf(bill.payerId) !== -1 && row(bill.payerId, true)}
        </div>
      </section>

      <div class="banner">
        <span>${t('bill.getsBack', { name: payerName })}</span>
        <span class="amt owed">${money(back)}</span>
      </div>

      <div class="stack">
        <button class="btn" onClick=${function () { c.copy(billText(bill, sh, c.byId)); }}><${Icon} name="copy" />${t('bill.copy')}</button>
        ${!confirming && html`<button class="btn ghost danger" onClick=${function () { setConfirming(true); }}><${Icon} name="trash" size=${18} />${t('bill.delete')}</button>`}
        ${confirming && html`<${Confirm} text=${t('bill.deleteAsk')} label=${t('common.delete')}
          onCancel=${function () { setConfirming(false); }}
          onConfirm=${function () { store.remove('bills', bill.id); c.go('group'); }} />`}
      </div>`;
  }

  // ---------- settle up ----------

  function Settle(c) {
    var plan = Calc.settle(c.group.net);
    var recent = c.group.payments.slice().sort(function (x, y) { return (y.createdAt || 0) - (x.createdAt || 0); }).slice(0, 5);
    var group = c.group.name;

    function markPaid(p) {
      var from = c.byId[p.fromId] || {};
      var to = c.byId[p.toId] || {};
      var doc = { groupId: c.group.id, fromId: p.fromId, toId: p.toId, amount: p.amount, date: todayISO(), createdAt: Date.now() };
      if (from.example || to.example) doc.example = true;
      store.put('payments', store.newId(), doc).catch(function () { c.say(t('app.saveFailed')); });
      c.say(t('settle.marked'));
    }
    function planText() {
      return [group + ' · ' + t('settle.title')].concat(plan.map(function (p) {
        return nameOf(c.byId[p.fromId]) + ' → ' + nameOf(c.byId[p.toId]) + ' ' + money(p.amount);
      })).join('\n');
    }

    return html`
      <${Head} onBack=${function () { c.go(c.from === 'settleAll' ? 'settleAll' : 'group'); }} title=${t('settle.title')} sub=${group} />

      ${plan.length === 0 && html`<section class="card"><p class="row-title">${t('settle.allSquare')}</p></section>`}

      ${plan.length > 0 && html`<section class="card hero">
        <p class="big">${plural('settle.count', plan.length)}</p>
        <p class="muted">${plural('settle.lead', c.group.bills.length)}</p>
      </section>`}

      ${plan.length > 0 && html`<section class="section grow">
        <h2 class="eyebrow">${t('settle.whoPays')}</h2>
        ${plan.map(function (p) {
          var from = c.byId[p.fromId] || {};
          var to = c.byId[p.toId] || {};
          return html`<div class="pay" key=${p.fromId + p.toId}>
            <div class="pay-line">
              <${Avatar} person=${from} size=${32} />
              <span class="row-title">${nameOf(from)}</span>
              <span class="pay-arrow" role="img" aria-label=${t('settle.pays')}><${Icon} name="arrow" size=${18} /></span>
              <${Avatar} person=${to} size=${32} />
              <span class="row-title row-main">${nameOf(to)}</span>
              <span class=${'amt ' + (p.toId === c.me.id ? 'owed' : p.fromId === c.me.id ? 'owes' : '')}>${money(p.amount)}</span>
            </div>
            <div class="pay-actions">
              <button class="btn small ghost" onClick=${function () { c.copy(t('settle.reminder', { from: nameOf(from), to: nameOf(to), amount: money(p.amount) })); }}>${t('settle.copyReminder')}</button>
              <button class="btn small secondary" onClick=${function () { markPaid(p); }}>${t('settle.markPaid')}</button>
            </div>
          </div>`;
        })}
      </section>`}

      ${recent.length > 0 && html`<section class="section">
        <h2 class="eyebrow">${t('settle.recent')}</h2>
        <div class="list">
          ${recent.map(function (p) {
            return html`<div class="row" key=${p.id}>
              <span class="row-main">
                <span class="row-title">${t('settle.paidLine', { from: nameOf(c.byId[p.fromId]), to: nameOf(c.byId[p.toId]) })}</span>
                <span class="row-sub">${fmtDate(p.date)}</span>
              </span>
              <span class="amt">${money(p.amount)}</span>
              <button class="btn small ghost" onClick=${function () { store.remove('payments', p.id); }}>${t('settle.undo')}</button>
            </div>`;
          })}
        </div>
      </section>`}

      ${plan.length > 0 && html`<button class="btn" onClick=${function () { c.copy(planText()); }}><${Icon} name="copy" />${t('settle.copyPlan')}</button>`}`;
  }

  // ---------- group chat ----------

  function Chat(c) {
    var g = c.group;
    var tx = useState(''), text = tx[0], setText = tx[1];
    var endRef = useRef(null);
    var messages = g.messages;

    // The group's ten most recent bills show up in the conversation as cards,
    // placed by when they were added.
    var bills = g.bills
      .filter(function (b) { return b.createdAt; })
      .sort(function (x, y) { return x.createdAt - y.createdAt; })
      .slice(-10);
    var timeline = messages.map(function (m) { return { at: m.at || 0, key: 'm' + m.id, message: m }; })
      .concat(bills.map(function (b) { return { at: b.createdAt, key: 'b' + b.id, bill: b }; }))
      .sort(function (x, y) { return x.at - y.at; });

    useEffect(function () {
      store.markChatRead(g.id);
      if (timeline.length && endRef.current) endRef.current.scrollIntoView({ block: 'end' });
    }, [timeline.length]);

    function send(ev) {
      ev.preventDefault();
      var msg = text.trim();
      if (!msg) return;
      setText('');
      store.sendMessage(g.id, c.me.id, msg).catch(function () { c.say(t('chat.failed')); });
    }

    var rows = [];
    var lastDay = '';
    timeline.forEach(function (entry) {
      var day = iso(new Date(entry.at));
      if (day !== lastDay) {
        lastDay = day;
        rows.push(html`<p class="day-sep" key=${'d' + day}>${fmtDate(day)}</p>`);
      }
      if (entry.bill) {
        var bill = entry.bill;
        rows.push(html`<button class="banner event" key=${entry.key} onClick=${function () { c.go('bill', bill.id); }}>
          <${Icon} name="receipt" size=${18} />
          <span class="row-main">${t('chat.billAdded', { name: nameOf(c.byId[bill.payerId]), amount: money(Calc.billShares(bill).total), title: bill.title })}</span>
          <span class="link-text">${t('chat.view')}</span>
        </button>`);
        return;
      }
      var m = entry.message;
      if (m.personId === c.me.id) {
        rows.push(html`<div class="bubble me" key=${entry.key}><p>${m.text}</p></div>`);
        return;
      }
      var person = c.byId[m.personId] || {};
      rows.push(html`<div class="msg" key=${entry.key}>
        <${Avatar} person=${person} size=${32} />
        <div class="msg-body">
          <span class="msg-name">${nameOf(person)}</span>
          <div class="bubble ai"><p>${m.text}</p></div>
        </div>
      </div>`);
    });

    return html`
      <${Head} onBack=${function () { c.go('group'); }} title=${g.name} sub=${plural('groups.members', g.members.length)} />

      <section class="chat grow">
        ${timeline.length === 0 && html`<p class="empty">${t('chat.empty')}</p>`}
        ${rows}
        <div ref=${endRef}></div>
      </section>

      <form class="composer cta" onSubmit=${send}>
        <input id="chat-message" class="field" aria-label=${t('chat.placeholder')} placeholder=${t('chat.placeholder')} value=${text} autocomplete="off" maxlength="1000" onInput=${function (e) { setText(e.target.value); }} />
        <button type="submit" class="icon-btn send" aria-label=${t('ai.send')} disabled=${!text.trim()}><${Icon} name="send" weight=${2.2} /></button>
      </form>`;
  }

  // ---------- groups ----------

  // Whoever makes a group runs it: only they add or remove its members.
  function NewGroup(c) {
    var n = useState(''), name = n[0], setName = n[1];
    var p = useState([]), picked = p[0], setPicked = p[1];
    var nn = useState([]), newNames = nn[0], setNewNames = nn[1];
    var f = useState(''), friend = f[0], setFriend = f[1];
    var e = useState(''), err = e[0], setErr = e[1];
    var others = c.people.filter(function (x) { return !x.archived && !x.mine; });

    function toggle(id) {
      setPicked(picked.indexOf(id) === -1 ? picked.concat(id) : picked.filter(function (x) { return x !== id; }));
    }
    function addFriend(ev) {
      ev.preventDefault();
      var clean = friend.trim();
      if (!clean) return;
      var match = findByName(others, clean);
      if (match) { if (picked.indexOf(match.id) === -1) setPicked(picked.concat(match.id)); }
      else if (newNames.indexOf(clean) === -1) setNewNames(newNames.concat(clean));
      setFriend('');
    }
    function create() {
      var clean = name.trim();
      if (!clean) { setErr(t('newGroup.needName')); return; }
      var memberIds = [c.me.id].concat(picked);
      var names = newNames.slice();
      var pending = friend.trim();
      if (pending) {
        var match = findByName(others, pending);
        if (match && memberIds.indexOf(match.id) === -1) memberIds.push(match.id);
        else if (!match && names.indexOf(pending) === -1) names.push(pending);
      }
      names.forEach(function (nm, i) {
        var id = store.newId();
        store.put('people', id, newPerson(nm, c.people.length + i));
        memberIds.push(id);
      });
      var gid = store.newId();
      store.put('groups', gid, {
        name: clean, ownerId: c.me.id, memberIds: memberIds, preset: c.allGroups.length % COLORS.length, createdAt: Date.now()
      }).catch(function () { c.say(t('app.saveFailed')); });
      c.go('group', null, gid);
    }

    return html`
      <${Head} onBack=${function () { c.go('home', null, null); }} title=${t('newGroup.title')} />

      <section class="section">
        <label class="eyebrow" for="new-group-name">${t('newGroup.name')}</label>
        <input id="new-group-name" class="field" placeholder=${t('newGroup.namePh')} value=${name} autocomplete="off" onInput=${function (ev) { setName(ev.target.value); setErr(''); }} />
        ${err && html`<p class="warn-text" role="alert">${err}</p>`}
      </section>

      <section class="section">
        <div class="eyebrow-row">
          <h2 class="eyebrow">${t('newGroup.who')}</h2>
          <span class="hint">${t('newGroup.picked', { n: picked.length + newNames.length })}</span>
        </div>
        <div class="who-row">
          <span class="who">
            <${Avatar} person=${c.me} size=${44} />
            <span class="who-name">${t('people.you')}</span>
          </span>
          ${others.map(function (x) {
            var on = picked.indexOf(x.id) !== -1;
            return html`<button key=${x.id} class=${'who' + (on ? '' : ' off')} aria-pressed=${on ? 'true' : 'false'} onClick=${function () { toggle(x.id); }}>
              <${Avatar} person=${x} size=${44} />
              <span class="who-name">${x.name}</span>
            </button>`;
          })}
          ${newNames.map(function (nm, i) {
            return html`<button key=${'new' + nm} class="who" aria-label=${t('item.remove', { name: nm })} onClick=${function () { setNewNames(newNames.filter(function (x) { return x !== nm; })); }}>
              <${Avatar} person=${{ name: nm, avatar: { kind: 'preset', preset: (c.people.length + i) % COLORS.length } }} size=${44} />
              <span class="who-name">${nm}</span>
            </button>`;
          })}
        </div>
        <form class="add-row" onSubmit=${addFriend}>
          <input id="new-group-friend" class="field" aria-label=${t('newGroup.newFriend')} placeholder=${t('newGroup.newFriend')} value=${friend} autocomplete="off" onInput=${function (ev) { setFriend(ev.target.value); }} />
          <button class="btn small secondary" type="submit">${t('setup.add')}</button>
        </form>
      </section>

      <p class="muted small">${t('newGroup.adminNote')}</p>
      <div class="stack cta">
        <button class="btn" onClick=${create}>${t('newGroup.create')}</button>
      </div>`;
  }

  function Members(c) {
    var g = c.group;
    var owner = c.byId[g.ownerId];
    // If whoever made the group is gone, the page's owner can look after it.
    var admin = g.ownerId === c.me.id || ((!owner || owner.archived) && c.data.isOwner === true);
    var ms = useState(g.memberIds), ids = ms[0], setIds = ms[1];
    var nm = useState(g.name), name = nm[0], setName = nm[1];
    var ak = useState(null), asking = ak[0], setAsking = ak[1]; // {kind: 'remove', id} | {kind: 'leave'} | {kind: 'delete'}
    var f = useState(''), friend = f[0], setFriend = f[1];

    // Kept here as well as in the store so quick taps build on each other.
    var key = g.memberIds.join(',');
    useEffect(function () { setIds(g.memberIds); }, [key]);

    var members = c.people.filter(function (p) { return !p.archived && ids.indexOf(p.id) !== -1; })
      .sort(function (x, y) { return (y.id === g.ownerId) - (x.id === g.ownerId); });
    var others = c.people.filter(function (p) { return !p.archived && ids.indexOf(p.id) === -1; });

    function setMembers(next) {
      setIds(next);
      saveGroup(g, { memberIds: next }).catch(function () { c.say(t('app.saveFailed')); });
    }
    function add(person) {
      setMembers(ids.concat(person.id));
      c.say(t('members.added', { name: person.name }));
    }
    function addNew(ev) {
      ev.preventDefault();
      var clean = friend.trim();
      if (!clean) return;
      setFriend('');
      var id = personFor(c, clean);
      if (ids.indexOf(id) !== -1) return;
      setMembers(ids.concat(id));
      c.say(t('members.added', { name: clean }));
    }
    function rename(value) {
      var clean = value.trim();
      if (!clean) { setName(g.name); return; }
      if (clean !== g.name) saveGroup(g, { name: clean }).catch(function () { c.say(t('app.saveFailed')); });
    }
    function leave() {
      saveGroup(g, { memberIds: ids.filter(function (x) { return x !== c.me.id; }) }).catch(function () { c.say(t('app.saveFailed')); });
      c.say(t('members.left', { group: g.name }));
      c.go('home', null, null);
    }
    function remove() {
      store.removeGroup(g.id).catch(function () { c.say(t('app.saveFailed')); });
      c.say(t('members.deleted'));
      c.go('home', null, null);
    }

    function owedLine(person) {
      var v = Math.round(g.net[person.id] || 0);
      var who = person.mine ? 'members.you' : 'members.they';
      if (v < 0) return t(who + 'Owe', { name: person.name, amount: money(-v) });
      if (v > 0) return t(who + 'AreOwed', { name: person.name, amount: money(v) });
      return '';
    }
    function confirmBox(text, extra, label, act) {
      return html`<${Confirm} text=${text} extra=${extra} label=${label} onCancel=${function () { setAsking(null); }} onConfirm=${act} />`;
    }
    var removing = asking && asking.kind === 'remove' ? c.byId[asking.id] : null;

    return html`
      <${Head} onBack=${function () { c.go('group'); }} title=${t('members.title')} sub=${g.name} />

      ${admin && html`<section class="section">
        <label class="eyebrow" for="group-name">${t('newGroup.name')}</label>
        <input id="group-name" class="field" value=${name} autocomplete="off"
          onInput=${function (e) { setName(e.target.value); }}
          onChange=${function (e) { rename(e.target.value); }} />
      </section>`}

      <section class="section">
        <h2 class="eyebrow">${plural('groups.members', members.length)}</h2>
        <div class="list">
          ${members.map(function (p) {
            var tags = [];
            if (p.mine) tags.push(t('people.you'));
            if (p.id === g.ownerId) tags.push(t('members.admin'));
            return html`<div class="row" key=${p.id}>
              <${Avatar} person=${p} size=${40} />
              <span class="row-main">
                <span class="row-title">${p.name}</span>
                ${tags.length > 0 && html`<span class="row-sub">${tags.join(' · ')}</span>`}
              </span>
              ${admin && !p.mine && p.id !== g.ownerId && html`<button class="icon-btn bare muted" aria-label=${t('members.remove', { name: p.name })} onClick=${function () { setAsking({ kind: 'remove', id: p.id }); }}><${Icon} name="close" size=${18} /></button>`}
            </div>`;
          })}
        </div>
        ${removing && confirmBox(
          t('members.removeAsk', { name: removing.name, group: g.name }), owedLine(removing), t('common.remove'),
          function () { setMembers(ids.filter(function (x) { return x !== removing.id; })); setAsking(null); }
        )}
        ${!admin && html`<p class="muted small">${t('members.onlyAdmin', { name: nameOf(owner) })}</p>`}
      </section>

      ${admin && html`<section class="section">
        <h2 class="eyebrow">${t('members.add')}</h2>
        ${others.length > 0 && html`<div class="pills">
          ${others.map(function (p) {
            return html`<button key=${p.id} class="pill chip" onClick=${function () { add(p); }}>
              <${Avatar} person=${p} size=${24} />${p.name}<${Icon} name="plus" size=${14} weight=${2.5} />
            </button>`;
          })}
        </div>`}
        <form class="add-row" onSubmit=${addNew}>
          <input id="member-name" class="field" aria-label=${t('newGroup.newFriend')} placeholder=${t('newGroup.newFriend')} value=${friend} autocomplete="off" onInput=${function (e) { setFriend(e.target.value); }} />
          <button class="btn small secondary" type="submit">${t('setup.add')}</button>
        </form>
        <p class="muted small">${t('members.inviteNote')} <button class="link inline" onClick=${function () { c.go('invite', null, undefined, 'members'); }}>${t('invite.open')}</button></p>
      </section>`}

      <div class="stack grow-top">
        ${admin && !asking && html`<button class="btn ghost danger" onClick=${function () { setAsking({ kind: 'delete' }); }}><${Icon} name="trash" size=${18} />${t('members.delete')}</button>`}
        ${admin && asking && asking.kind === 'delete' && confirmBox(
          t('members.deleteAsk', { group: g.name }), '', t('common.delete'), remove
        )}
        ${!admin && !asking && html`<button class="btn ghost danger" onClick=${function () { setAsking({ kind: 'leave' }); }}>${t('members.leave')}</button>`}
        ${!admin && asking && asking.kind === 'leave' && confirmBox(
          t('members.leaveAsk', { group: g.name }), owedLine(c.me), t('members.leave'), leave
        )}
      </div>`;
  }

  // ---------- people and profile ----------

  // Everyone the app knows, across all groups.
  function People(c) {
    var visible = c.people.filter(function (p) { return !p.archived; });
    function groupCount(p) {
      return c.allGroups.filter(function (g) { return g.memberIds.indexOf(p.id) !== -1; }).length;
    }

    return html`
      <${Head} title=${t('people.title')} />

      <section class="section">
        <div class="list">
          ${visible.map(function (p) {
            var n = groupCount(p);
            return html`<button class="row tap" key=${p.id} onClick=${function () { c.go('person', p.id); }}>
              <${Avatar} person=${p} size=${40} />
              <span class="row-main">
                <span class="row-title">${p.name}</span>
                ${p.mine && html`<span class="row-sub">${t('people.you')}</span>`}
              </span>
              <span class="hint">${n ? plural('people.inGroups', n) : t('people.noGroup')}</span>
              <${Icon} name="arrow" size=${16} />
            </button>`;
          })}
        </div>
        <button class="btn dashed" onClick=${function () { c.go('person', null); }}><${Icon} name="plus" size=${18} weight=${2.5} />${t('people.add')}</button>
        <button class="btn secondary" onClick=${function () { c.go('invite'); }}>${t('invite.open')}</button>
      </section>`;
  }

  // ---------- tabs: settle, me ----------

  // Clock time for today, the date for anything older.
  function when(at) {
    if (!at) return '';
    var d = new Date(at);
    if (iso(d) !== todayISO()) return fmtDate(iso(d));
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // What the viewer pays and gets back in each of their groups. Each line opens
  // that group's settle-up, where it is marked as paid.
  function SettleAll(c) {
    var pay = [], get = [];
    c.groups.forEach(function (g) {
      Calc.settle(g.net).forEach(function (p) {
        if (p.fromId === c.me.id) pay.push({ g: g, p: p, other: c.byId[p.toId] });
        else if (p.toId === c.me.id) get.push({ g: g, p: p, other: c.byId[p.fromId] });
      });
    });
    function sum(list) { return list.reduce(function (s, x) { return s + x.p.amount; }, 0); }
    var net = sum(get) - sum(pay);
    function rows(list, owed) {
      return html`<div class="list">
        ${list.map(function (x) {
          return html`<button class="row tap" key=${x.g.id + x.p.fromId + x.p.toId} onClick=${function () { c.go('settle', null, x.g.id, 'settleAll'); }}>
            <${Avatar} person=${x.other} size=${40} />
            <span class="row-main">
              <span class="row-title">${nameOf(x.other)}</span>
              <span class="row-sub">${x.g.name}</span>
            </span>
            <span class=${'amt ' + (owed ? 'owed' : 'owes')}>${money(x.p.amount)}</span>
            <${Icon} name="arrow" size=${16} />
          </button>`;
        })}
      </div>`;
    }

    return html`
      <${Head} title=${t('settle.title')} />
      <section class="card hero">
        <p class="muted">${net > 0 ? t('home.owed') : net < 0 ? t('home.owe') : t('home.square')}</p>
        <p class="big">${money(Math.abs(net))}</p>
        ${(pay.length > 0 || get.length > 0) && html`<p class="muted">${t('settleAll.summary', { get: money(sum(get)), pay: money(sum(pay)) })}</p>`}
      </section>
      ${!pay.length && !get.length && html`<p class="empty">${t('settleAll.none')}</p>`}
      ${pay.length > 0 && html`<section class="section">
        <h2 class="eyebrow">${t('settleAll.pay')}</h2>
        ${rows(pay, false)}
      </section>`}
      ${get.length > 0 && html`<section class="section">
        <h2 class="eyebrow">${t('settleAll.get')}</h2>
        ${rows(get, true)}
      </section>`}`;
  }

  function Me(c) {
    return html`
      <${Head} title=${t('me.title')} />
      <section class="section center">
        <${Avatar} person=${c.me} size=${96} />
        <p class="lead-title">${c.me.name}</p>
        <button class="btn small secondary" onClick=${function () { c.go('person', c.me.id, undefined, 'me'); }}><${Icon} name="pencil" size=${16} />${t('me.edit')}</button>
      </section>

      <section class="section">
        <h2 class="eyebrow">${t('people.language')}</h2>
        <div class="seg wide">
          <button class=${c.lang === 'en' ? 'on' : ''} aria-pressed=${c.lang === 'en' ? 'true' : 'false'} onClick=${function () { store.saveSettings({ lang: 'en' }); }}>English</button>
          <button class=${c.lang === 'zh-TW' ? 'on' : ''} aria-pressed=${c.lang === 'zh-TW' ? 'true' : 'false'} onClick=${function () { store.saveSettings({ lang: 'zh-TW' }); }}>繁體中文</button>
        </div>
      </section>

      <div class="stack grow-top">
        ${c.data.user && html`<p class="muted small">${t('me.signedInAs', { email: c.data.user.email })}</p>`}
        <button class="btn ghost" onClick=${function () { c.go('home', null, null); store.claim(null); }}>${t('person.notMe')}</button>
        <button class="btn ghost" onClick=${function () { c.go('home', null, null); store.signOut(); }}>${t('me.signOut')}</button>
      </div>`;
  }

  // Floating bar along the bottom of the four main screens. Groups carries the
  // count of unread chat messages across all groups.
  var TABS = [
    { name: 'home', icon: 'chat', label: 'tabs.groups' },
    { name: 'settleAll', icon: 'swap', label: 'tabs.settle' },
    { name: 'people', icon: 'users', label: 'tabs.friends' },
    { name: 'me', icon: 'user', label: 'tabs.me' }
  ];
  function TabBar(p) {
    return html`<nav class="tabbar" aria-label=${t('tabs.label')}>
      ${TABS.map(function (tab) {
        var on = p.current === tab.name;
        var n = tab.name === 'home' ? p.unread : 0;
        return html`<button key=${tab.name} class=${'tab' + (on ? ' on' : '')} aria-current=${on ? 'page' : null} onClick=${function () { p.go(tab.name, null, null); }}>
          <span class="tab-icon">
            <${Icon} name=${tab.icon} size=${24} weight=${1.8} />
            ${n > 0 && html`<span class="badge tab-badge" aria-hidden="true">${n > 9 ? '9+' : n}</span>`}
          </span>
          <span class="tab-label">${t(tab.label)}</span>
          ${n > 0 && html`<span class="visually-hidden">${plural('groups.unread', n)}</span>`}
        </button>`;
      })}
    </nav>`;
  }

  // A friend joins a group through its invite link: they open it, sign in
  // with Google and pick their name. Opened without a group (from Friends),
  // the screen asks which group first.
  function Invite(c) {
    var first = c.group || (c.groups.length === 1 ? c.groups[0] : null);
    var s = useState(first ? first.id : null), gid = s[0], setGid = s[1];
    var l = useState({ gid: null, link: '', failed: false }), made = l[0], setMade = l[1];
    var group = c.groups.filter(function (g) { return g.id === gid; })[0] || null;

    useEffect(function () {
      if (!gid) return undefined;
      var live = true;
      store.inviteFor(gid).then(function (code) {
        if (live) setMade({ gid: gid, link: inviteLink(code), failed: false });
      }, function () {
        if (live) setMade({ gid: gid, link: '', failed: true });
      });
      return function () { live = false; };
    }, [gid]);
    var link = made.gid === gid ? made.link : '';
    var failed = made.gid === gid && made.failed;

    return html`
      <${Head} onBack=${function () { c.go(c.from || 'people'); }} title=${t('invite.open')} />

      <p class="muted">${t('invite.lead')}</p>

      ${c.groups.length === 0 && html`<p class="banner">${t('invite.none')}</p>`}

      ${c.groups.length > 1 && html`<section class="section">
        <h2 class="eyebrow">${t('invite.pick')}</h2>
        <div class="pills">
          ${c.groups.map(function (g) {
            return html`<button key=${g.id} class=${'pill' + (g.id === gid ? ' on' : '')} aria-pressed=${g.id === gid ? 'true' : 'false'} onClick=${function () { setGid(g.id); }}>${g.name}</button>`;
          })}
        </div>
      </section>`}

      ${group && html`<section class="section">
        <label class="eyebrow" for="invite-link">${t('invite.link')}</label>
        <div class="add-row">
          <input id="invite-link" class="field" readonly value=${link || (failed ? '' : t('invite.making'))} onFocus=${function (e) { e.target.select(); }} />
          <button class="btn small secondary" disabled=${!link} onClick=${function () { c.copy(link); }}><${Icon} name="copy" size=${16} />${t('invite.copyLink')}</button>
        </div>
        ${failed && html`<p class="warn-text" role="alert">${t('invite.failed')}</p>`}
      </section>`}

      ${group && html`<section class="card">
        <h2 class="row-title">${t('invite.them')}</h2>
        <ol class="steps">
          <li>${t('invite.them1')}</li>
          <li>${t('invite.them2')}</li>
          <li>${t('invite.them3')}</li>
        </ol>
      </section>`}

      ${group && html`<div class="stack grow-top">
        <p class="muted small">${t('invite.expiry')}</p>
        <button class="btn" disabled=${!link} onClick=${function () { c.copy(t('invite.msg', { group: group.name, link: link })); }}><${Icon} name="copy" />${t('invite.copyMsg')}</button>
      </div>`}`;
  }

  function Person(c) {
    var existing = c.id ? c.byId[c.id] : null;
    var n = useState(existing ? existing.name : ''), name = n[0], setName = n[1];
    var a = useState(existing && existing.avatar ? existing.avatar : { kind: 'preset', preset: c.people.length % COLORS.length }), avatar = a[0], setAvatar = a[1];
    var b = useState(false), busy = b[0], setBusy = b[1];
    var e = useState(''), err = e[0], setErr = e[1];
    var k = useState(false), confirming = k[0], setConfirming = k[1];
    var unsaved = useRef(null); // photo uploaded on this screen that no saved row points at yet

    if (c.id && !existing) return html`<${Head} onBack=${function () { c.go(c.from || 'people'); }} title=${t('person.title')} />`;

    var isMe = !!(existing && existing.mine);
    var savedPhoto = existing && existing.avatar && existing.avatar.kind === 'photo' ? existing.avatar.assetId : null;

    function onPhoto(file) {
      setBusy(true);
      setErr('');
      squareJpeg(file, 256).then(store.uploadPhoto).then(function (assetId) {
        if (unsaved.current) store.deletePhoto(unsaved.current);
        unsaved.current = assetId;
        setAvatar({ kind: 'photo', assetId: assetId });
        setBusy(false);
      }, function () {
        setErr(t('person.uploadErr'));
        setBusy(false);
      });
    }
    function save() {
      var clean = name.trim();
      if (!clean) { setErr(t('person.needName')); return; }
      var id = c.id || store.newId();
      var doc = Object.assign({}, existing || newPerson(clean, 0), { name: clean, avatar: avatar });
      var kept = avatar.kind === 'photo' ? avatar.assetId : null;
      var stale = [savedPhoto, unsaved.current].filter(function (x) { return x && x !== kept; });
      unsaved.current = null;
      store.put('people', id, doc).then(function () {
        stale.forEach(store.deletePhoto);
      }, function () { c.say(t('app.saveFailed')); });
      c.say(t('person.saved'));
      c.go(c.from || 'people');
    }
    function removePerson() {
      var used = c.data.bills.some(function (bill) { return bill.payerId === c.id || (bill.presentIds || []).indexOf(c.id) !== -1; }) ||
        c.data.payments.some(function (p) { return p.fromId === c.id || p.toId === c.id; });
      if (used) {
        store.put('people', c.id, Object.assign({}, existing, { archived: true }));
      } else {
        store.remove('people', c.id).then(function () { store.deletePhoto(savedPhoto); }, function () {});
      }
      c.go(c.from || 'people');
    }

    return html`
      <${Head} onBack=${function () { c.go(c.from || 'people'); }} title=${existing ? t('person.title') : t('person.new')} />

      <section class="section center">
        <${Avatar} person=${{ name: name, avatar: avatar }} size=${112} />
        ${c.data.canUpload && html`<div class="pills center">
          <${FilePick} class="btn small" disabled=${busy} onFile=${onPhoto}>
            <${Icon} name="camera" size=${18} />${busy ? t('person.uploading') : t('person.upload')}
          <//>
          ${avatar.kind === 'photo' && html`<button class="btn small secondary" onClick=${function () { setAvatar({ kind: 'preset', preset: 0 }); }}>${t('person.removePhoto')}</button>`}
        </div>`}
      </section>

      <section class="section">
        <h2 class="eyebrow">${c.data.canUpload ? t('person.pick') : t('person.pickOnly')}</h2>
        <div class="swatches">
          ${COLORS.map(function (color, i) {
            var on = avatar.kind === 'preset' && avatar.preset === i;
            return html`<button key=${color} class=${'swatch' + (on ? ' on' : '')} style=${'background:' + color} aria-label=${t('person.color', { n: i + 1 })} aria-pressed=${on ? 'true' : 'false'} onClick=${function () { setAvatar({ kind: 'preset', preset: i }); }}></button>`;
          })}
        </div>
      </section>

      <section class="section">
        <label class="eyebrow" for="person-name">${t('person.name')}</label>
        <input id="person-name" class="field" value=${name} autocomplete="off" onInput=${function (ev) { setName(ev.target.value); setErr(''); }} />
        ${err && html`<p class="warn-text" role="alert">${err}</p>`}
      </section>

      <div class="stack grow-top">
        <button class="btn" disabled=${busy} onClick=${save}>${t('person.save')}</button>
        ${isMe && html`<button class="btn ghost" onClick=${function () { c.go('home', null, null); store.claim(null); }}>${t('person.notMe')}</button>`}
        ${existing && !isMe && !confirming && html`<button class="btn ghost danger" onClick=${function () { setConfirming(true); }}>${t('person.remove')}</button>`}
        ${confirming && html`<${Confirm} text=${t('person.removeAsk', { name: existing.name })} label=${t('common.remove')}
          onCancel=${function () { setConfirming(false); }} onConfirm=${removePerson} />`}
      </div>`;
  }

  // ---------- app shell ----------

  var live = { route: null, draft: null, chat: [] };

  function App(props) {
    var init = props.initial || {};
    var s = useState(store.getState()), data = s[0], setData = s[1];
    var r = useState(init.route || { name: 'home' }), route = r[0], setRoute = r[1];
    var d = useState(init.draft || null), draft = d[0], setDraft = d[1];
    var f = useState(null), scanFile = f[0], setScanFile = f[1];
    var ch = useState(init.chat || []), chat = ch[0], setChat = ch[1];
    var ls = useState(null), lastSaved = ls[0], setLastSaved = ls[1];
    var ts = useState(''), toast = ts[0], setToast = ts[1];
    var cp = useState(''), copyText = cp[0], setCopyText = cp[1];

    useEffect(function () {
      var stop = store.subscribe(setData);
      setData(store.getState()); // catch anything that arrived before this effect ran
      return stop;
    }, []);
    useEffect(function () { window.scrollTo(0, 0); }, [route.name, route.id, route.gid]);
    useEffect(function () {
      if (!toast) return undefined;
      var h = setTimeout(function () { setToast(''); }, 2600);
      return function () { clearTimeout(h); };
    }, [toast]);

    var lang = data.settings.lang || I18n.detect();
    I18n.setLang(lang);
    useEffect(function () { document.documentElement.lang = lang; }, [lang]);

    live.route = route;
    live.draft = draft;
    live.chat = chat;

    // Who the viewer is: what this device remembers, or, for the page's owner,
    // the person they set up as themselves. Anyone else is asked once.
    function active(id) { return data.people.some(function (p) { return p.id === id && !p.archived; }); }
    var ownerPerson = data.people.filter(function (p) { return p.isMe && !p.archived; })[0];
    var meId = data.meId && active(data.meId) ? data.meId
      : data.isOwner === true && ownerPerson && !data.choosing ? ownerPerson.id
      : null;
    useEffect(function () {
      if (data.ready && meId && meId !== data.meId) store.claim(meId);
    }, [data.ready, meId, data.meId]);
    // An invite link that didn't work, opened by someone already in: just say so.
    useEffect(function () {
      if (!data.joinError || !data.inCircle) return;
      setToast(joinErrorText(data.joinError));
      store.clearJoinError();
    }, [data.joinError, data.inCircle]);

    if (!data.ready) return html`<main class="app"><p class="boot">${t('app.loading')}</p></main>`;
    if (data.auth === 'out') return html`<main class="app"><${SignIn} data=${data} lang=${lang} /></main>`;
    if (data.auth === 'in' && data.inCircle === false) return html`<main class="app"><${NotInvited} data=${data} lang=${lang} /></main>`;
    if (data.platform && !data.persistent) return html`<main class="app"><${Disconnected} /></main>`;

    var people = data.people.map(function (p) { return Object.assign({}, p, { mine: p.id === meId }); }).sort(function (x, y) {
      if (x.mine !== y.mine) return x.mine ? -1 : 1;
      return String(x.name).localeCompare(String(y.name));
    });
    var byId = {};
    people.forEach(function (p) { byId[p.id] = p; });
    var me = meId ? byId[meId] : null;
    var anyone = people.some(function (p) { return !p.archived; });

    // Each group with what the screens need: its people, bills, chat and sums.
    function groupView(g) {
      var memberIds = Array.isArray(g.memberIds) ? g.memberIds : [];
      var bills = data.bills.filter(function (b) { return store.groupOf(b) === g.id; });
      var payments = data.payments.filter(function (p) { return store.groupOf(p) === g.id; });
      var messages = data.chats[g.id] || [];
      var last = messages[messages.length - 1];
      var lastAt = bills.reduce(function (m, b) { return Math.max(m, b.createdAt || 0); }, Math.max(g.createdAt || 0, last ? last.at || 0 : 0));
      var lastLine = !last ? ''
        : me && last.personId === me.id ? t('groups.you', { text: last.text })
        : t('groups.said', { name: nameOf(byId[last.personId]), text: last.text });
      return Object.assign({}, g, {
        name: g.name || t('group.default'),
        memberIds: memberIds,
        members: people.filter(function (p) { return !p.archived && memberIds.indexOf(p.id) !== -1; }),
        bills: bills,
        payments: payments,
        messages: messages,
        net: Calc.balances(bills, payments),
        unread: me ? messages.filter(function (m) { return m.at > (data.chatRead[g.id] || 0) && m.personId !== me.id; }).length : 0,
        lastLine: lastLine,
        lastMessageAt: last ? last.at || 0 : 0,
        lastAt: lastAt
      });
    }
    var allGroups = data.groups.map(groupView);
    var groups = allGroups
      .filter(function (g) { return me && g.memberIds.indexOf(me.id) !== -1; })
      .sort(function (x, y) { return y.lastAt - x.lastAt; });
    var group = route.gid ? groups.filter(function (g) { return g.id === route.gid; })[0] || null : null;

    // Leaving out the group keeps the one already open. `from` names the screen
    // that Back returns to, where a screen can be reached from more than one place.
    function go(name, id, gid, from) {
      setRoute({ name: name, id: id == null ? null : id, gid: gid === undefined ? route.gid || null : gid, from: from || null });
    }
    function copy(text) {
      function ok() { setToast(t('bill.copied')); }
      function manual() { setCopyText(text); }
      try { navigator.clipboard.writeText(text).then(ok, manual); } catch (e) { manual(); }
    }

    function resetChat() {
      chat.forEach(function (m) { if (m.photoUrl) URL.revokeObjectURL(m.photoUrl); });
      setChat([]);
    }

    var c = {
      data: data, people: people, byId: byId, me: me, lang: lang, go: go, copy: copy, say: setToast,
      groups: groups, allGroups: allGroups, group: group, from: route.from || null,
      draft: draft, setDraft: setDraft, lastSaved: lastSaved, chat: chat, setChat: setChat,
      startNew: function () { resetChat(); setDraft(newDraft({ group: group, me: me })); go('edit'); },
      startAi: function () {
        resetChat();
        setDraft(Object.assign(newDraft({ group: group, me: me }), { payerAssumed: true }));
        go('ai');
      },
      startEdit: function (bill) { resetChat(); setDraft(draftFromBill(bill)); go('edit'); },
      startScan: function (file) { setScanFile(file); go('scan'); },
      cancel: function () {
        var id = draft && draft.id;
        resetChat();
        setDraft(null);
        if (id) go('bill', id); else go('group');
      },
      saved: function (bill) { resetChat(); setLastSaved(bill); setDraft(null); go('bill', bill.id); }
    };

    // Screens inside a group fall back to the list of groups when that group is
    // gone, or the viewer is no longer in it.
    var inGroup = ['group', 'members', 'chat', 'settle', 'bill', 'edit', 'ai', 'scan'].indexOf(route.name) !== -1;

    var view;
    var tab = null; // which tab of the bottom bar this screen is, if any
    if (!anyone && data.canWrite === false) {
      view = html`<${Head} title="Tab" /><p class="empty">${t('ro.empty')}</p>`;
    } else if (!anyone) {
      view = html`<${Setup} ...${c} />`;
    } else if (!me) {
      view = data.isOwner === null
        ? html`<p class="boot">${t('app.loading')}</p>`
        : html`<${WhoAmI} ...${c} />`;
    } else if (inGroup && !group) {
      view = html`<${Home} ...${c} />`;
      tab = 'home';
    } else if (route.name === 'settleAll') {
      view = html`<${SettleAll} ...${c} />`;
      tab = 'settleAll';
    } else if (route.name === 'me') {
      view = html`<${Me} ...${c} />`;
      tab = 'me';
    } else if (route.name === 'group') {
      view = html`<${GroupHome} key=${group.id} ...${c} />`;
    } else if (route.name === 'members') {
      view = html`<${Members} key=${group.id} ...${c} />`;
    } else if (route.name === 'newGroup') {
      view = html`<${NewGroup} ...${c} />`;
    } else if (route.name === 'chat') {
      view = html`<${Chat} ...${c} />`;
    } else if (route.name === 'invite') {
      view = html`<${Invite} ...${c} />`;
    } else if (route.name === 'edit' && draft) {
      view = html`<${Editor} ...${c} />`;
    } else if (route.name === 'ai' && draft) {
      view = html`<${Assistant} ...${c} />`;
    } else if (route.name === 'scan' && draft && scanFile) {
      view = html`<${Scan} ...${c} file=${scanFile} back=${function () { go('edit'); }} />`;
    } else if (route.name === 'bill') {
      view = html`<${Detail} key=${route.id} ...${c} id=${route.id} />`;
    } else if (route.name === 'settle') {
      view = html`<${Settle} ...${c} />`;
    } else if (route.name === 'people') {
      view = html`<${People} ...${c} />`;
      tab = 'people';
    } else if (route.name === 'person') {
      view = html`<${Person} key=${route.id || 'new'} ...${c} id=${route.id} />`;
    } else {
      view = html`<${Home} ...${c} />`;
      tab = 'home';
    }
    var unread = groups.reduce(function (n, g) { return n + g.unread; }, 0);

    return html`<main class=${'app' + (tab ? ' with-tabs' : '')}>
      ${!data.persistent && html`<p class="banner warn" role="status">${t('app.notSaved')}</p>`}
      ${data.canWrite === false && html`<p class="banner warn" role="status">${t('ro.banner')}</p>`}
      ${view}
      ${tab && html`<${TabBar} current=${tab} unread=${unread} go=${go} />`}
      <div class="toast-wrap" aria-live="polite">${toast && html`<div class="toast">${toast}</div>`}</div>
      ${copyText && html`<div class="sheet" role="dialog" aria-label=${t('copy.manual')}>
        <div class="sheet-card">
          <h2 class="eyebrow">${t('copy.manual')}</h2>
          <textarea id="copy-text" class="field area" readonly rows="8" value=${copyText} onFocus=${function (e) { e.target.select(); }}></textarea>
          <button class="btn" onClick=${function () { setCopyText(''); }}>${t('common.close')}</button>
        </div>
      </div>`}
    </main>`;
  }

  function boot(saved) {
    saved = saved || {};
    var route = saved.route && saved.route.name ? saved.route : null;
    if (route && route.name === 'scan') route = { name: 'edit' };
    if (route && (route.name === 'edit' || route.name === 'ai') && !saved.draft) route = null;
    mount.textContent = '';
    render(html`<${App} initial=${{ route: route, draft: saved.draft || null, chat: saved.chat || [] }} />`, mount);
  }

  // Keep an open bill draft across a republish of the page.
  var hot = window.claude && window.claude.hot;
  try {
    if (hot && hot.snapshot) {
      hot.snapshot(function () {
        return {
          route: live.route,
          draft: live.draft,
          chat: live.chat.map(function (m) { return { role: m.role, text: m.text }; })
        };
      });
    }
  } catch (e) { /* no hot reload here */ }

  // Every button glows out from the point it is pressed (.tap-glow in app.css).
  // The class is taken off and put back so a quick second press restarts it.
  document.addEventListener('pointerdown', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('button, label.btn, label.icon-btn') : null;
    if (!el || el.disabled || reducedMotion()) return;
    var box = el.getBoundingClientRect();
    el.style.setProperty('--x', (e.clientX - box.left) + 'px');
    el.style.setProperty('--y', (e.clientY - box.top) + 'px');
    el.classList.remove('tap-glow');
    void el.offsetWidth;
    el.classList.add('tap-glow');
    clearTimeout(el.tabGlowTimer);
    el.tabGlowTimer = setTimeout(function () { el.classList.remove('tap-glow'); }, 600);
  });
  // Lets :active (the press-in) show on iPhone.
  document.addEventListener('touchstart', function () {}, { passive: true });

  store.start();
  if (hot && hot.ready) hot.ready(boot);
  else boot((hot && hot.data) || {});
})();
