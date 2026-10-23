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

  // Sticker colours: the only colour in the app, on people and groups.
  var COLORS = ['#FFD23F', '#8CC8FF', '#FF8A5B', '#B9A6FF', '#7AD3B5', '#FF9EC0', '#C6E36B', '#FFB86B'];
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
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20.5a7 7 0 0 1 14 0',
    chevron: 'M9 6l6 6-6 6',
    bell: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
    // group icons
    bowl: 'M3 11h18a9 9 0 0 1-18 0zM8 7.5c0-1.5 1-1.5 1-3M12 7.5c0-1.5 1-1.5 1-3M16 7.5c0-1.5 1-1.5 1-3',
    boba: 'M6 8h12l-1.6 13H7.6zM5 8h14M12 8l2.5-5M9.5 15.5h.01M12 17.5h.01M14.5 15.5h.01',
    beer: 'M5 6h10v14H5zM15 9h2.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H15M8.5 10v6M11.5 10v6',
    mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6',
    mountain: 'M2.5 19.5l6.5-11 4.5 7 2.5-3.5 5.5 7.5z',
    plane: 'M21 3L3 10.5l7 2.5 2.5 7zM10 13l5-5',
    home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5',
    cake: 'M4 20h16v-8H4zM4 15.5c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1.5 4 0M12 12V8.5M12 6a1 1 0 0 1-1-1c0-1 1-2.5 1-2.5s1 1.5 1 2.5a1 1 0 0 1-1 1z',
    heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z',
    bag: 'M5 8h14l-1.2 12H6.2zM9 8V6.5a3 3 0 0 1 6 0V8'
  };
  var GROUP_ICONS = ['bowl', 'boba', 'beer', 'mic', 'mountain', 'plane', 'home', 'cake', 'heart', 'bag'];

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
  // On screen the viewer is "You" rather than their own name ("Me" as a guest).
  // Text sent to LINE keeps real names. obj: "you" in the middle of a sentence.
  function whoName(c, id, obj) {
    return id === c.me.id ? t(obj ? 'people.youObj' : 'people.you') : nameOf(c.byId[id]);
  }
  // The title of a card sent into a chat (see ChatCard), in the reader's language.
  function cardTitle(card, groups) {
    var g = (groups || []).filter(function (x) { return x.id === card.groupId; })[0];
    var group = g && g.name ? g.name : '';
    if (card.kind === 'remind') return t('card.remind', { group: group });
    if (card.kind === 'plan') return t('card.plan', { group: group });
    return t('card.bill', { title: card.title || '', group: group });
  }
  // What a list shows for a chat message: a card by its title, anything else as written.
  function lineOf(m, groups) { return m.card && m.card.kind ? cardTitle(m.card, groups) : m.text; }
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

  // The screens work on copies of a group with extra working fields; only
  // these are stored.
  var GROUP_FIELDS = ['name', 'ownerId', 'memberIds', 'preset', 'icon', 'createdAt', 'example'];
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

  function groupColor(group) { return COLORS[((group && group.preset) || 0) % COLORS.length]; }
  function groupIcon(group) { return group && GROUP_ICONS.indexOf(group.icon) !== -1 ? group.icon : null; }

  // A group's sticker: its icon, or the first letter of its name until it has one.
  function GroupMark(p) {
    var icon = groupIcon(p.group);
    return icon ? html`<${Icon} name=${icon} size=${p.size} weight=${1.8} />` : html`<span class="group-letter" aria-hidden="true">${initialOf(p.group.name)}</span>`;
  }

  function GroupAvatar(p) {
    var group = p.group || {};
    var size = p.size || 44;
    var box = 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.42) + 'px;background:' + groupColor(group);
    return html`<span class="avatar group" style=${box} aria-hidden="true"><${GroupMark} group=${group} size=${Math.round(size * 0.55)} /></span>`;
  }

  // Picks the icon on a group's sticker; tapping the chosen one again clears it.
  function IconPicker(p) {
    return html`<div class="icon-pick" role="group" aria-label=${t('groupIcon.label')}>
      ${GROUP_ICONS.map(function (name) {
        var on = p.value === name;
        return html`<button type="button" key=${name} class=${'icon-choice' + (on ? ' on' : '')} style=${on ? 'background:' + p.color : ''}
          aria-label=${t('groupIcon.' + name)} aria-pressed=${on ? 'true' : 'false'} onClick=${function () { p.onPick(on ? null : name); }}><${Icon} name=${name} size=${24} weight=${1.8} /></button>`;
      })}
    </div>`;
  }

  // A few tilted group stickers, for the sign-in and empty screens.
  function Stickers() {
    return html`<div class="stickers" aria-hidden="true">
      ${[['bowl', 2], ['boba', 5], ['mic', 3], ['mountain', 4]].map(function (s) {
        return html`<span key=${s[0]} class="sticker" style=${'background:' + COLORS[s[1]]}><${Icon} name=${s[0]} size=${32} weight=${1.8} /></span>`;
      })}
    </div>`;
  }

  // A headline amount: a small "NT$" before a big number.
  function BigMoney(p) {
    return html`<span class="cur-sym">NT$</span>${Math.round(Math.abs(p.n)).toLocaleString('en-US')}`;
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

  // Keyed by its number, so a new count pops in (app.css, .badge).
  function Badge(p) {
    if (!p.n) return null;
    return html`<span key=${p.n} class="badge inline" aria-label=${plural('groups.unread', p.n)}>${p.n > 9 ? '9+' : p.n}</span>`;
  }

  // A headline amount that counts up to its value when it first shows.
  function CountMoney(p) {
    var v = useCountUp(Math.round(Math.abs(p.n)), 700);
    return html`<${BigMoney} n=${v} />`;
  }

  // A sheet that springs up from the bottom over a dimmed page and sinks away
  // before it goes. render(close) draws its contents; close() animates it out,
  // then calls onClose. Tapping the dimmed page closes it too.
  function Sheet(p) {
    var cl = useState(false), closing = cl[0], setClosing = cl[1];
    var timer = useRef(null);
    useEffect(function () { return function () { clearTimeout(timer.current); }; }, []);
    function close() {
      if (closing) return;
      setClosing(true);
      timer.current = setTimeout(p.onClose, reducedMotion() ? 0 : 200);
    }
    return html`<div class=${'sheet' + (closing ? ' closing' : '')} role="dialog" aria-label=${p.label}
      onClick=${function (e) { if (e.target === e.currentTarget) close(); }}>
      <div class="sheet-card">${p.render(close)}</div>
    </div>`;
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

  // Shown when the database can't be reached. Without it the page could only
  // pretend, and a group made here would exist on this screen alone.
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
      <${Stickers} />
      <section class="section">
        <p class="lead-title">${p.data.adding ? t('signin.addTitle') : p.data.joining ? t('signin.joinTitle') : t('signin.title')}</p>
        <p class="muted">${p.data.adding ? t('signin.addLead') : p.data.joining ? t('signin.joinLead') : t('signin.lead')}</p>
      </section>
      ${inApp && html`<p class="banner warn" role="status">${t('signin.inApp')}</p>`}
      <div class="stack">
        <button class="btn" disabled=${busy} onClick=${signIn}>${t('signin.google')}</button>
        ${!p.data.joining && html`<p class="muted small">${t('signin.googleHint')}</p>`}
        ${err && html`<p class="warn-text" role="alert">${err}</p>`}
      </div>
      ${!p.data.joining && html`<div class="stack">
        <button class="btn ghost" onClick=${function () { store.startGuest(); }}>${t('signin.guest')}</button>
        <p class="muted small">${p.data.hasGuestData ? t('signin.guestBack') : t('signin.guestHint')}</p>
      </div>`}`;
  }

  // A guest's group is made of names typed in: no accounts, nothing to accept.
  function AddByName(p) {
    function add(ev) {
      ev.preventDefault();
      var name = p.value.trim().slice(0, 40);
      if (!name) return;
      p.onAdd(name);
      p.onValue('');
    }
    return html`<form class="add-row" onSubmit=${add}>
      <input id="add-name" class="field" aria-label=${t('newGroup.newFriend')} placeholder=${t('newGroup.newFriend')} value=${p.value} autocomplete="off" maxlength="40" onInput=${function (e) { p.onValue(e.target.value); }} />
      <button class="btn small secondary" type="submit">${t('guest.add')}</button>
    </form>`;
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
        <button class="btn" onClick=${function () { store.signOut(true); }}>${t('signin.guest')}</button>
        <button class="btn secondary" onClick=${function () { store.signOut(); }}>${t('me.signOut')}</button>
      </div>`;
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
    var invitations = c.data.invitations;

    function join(inv) {
      store.acceptInvitation(inv.groupId).then(function () {
        c.say(t('groups.joined', { group: inv.groupName }));
      }, function () { c.say(t('app.saveFailed')); });
    }
    function decline(inv) {
      store.declineInvitation(inv.groupId).catch(function () { c.say(t('app.saveFailed')); });
    }

    return html`
      <${Head}
        title=${t('groups.title')}
        right=${html`<button class="icon-btn" aria-label=${t('groups.new')} onClick=${function () { c.go('newGroup', null, null); }}><${Icon} name="plus" weight=${2.5} /></button>`}
      />

      ${invitations.length > 0 && html`<section class="section">
        <h2 class="eyebrow">${t('groups.invitations')}</h2>
        <div class="list">
          ${invitations.map(function (inv) {
            return html`<div class="row" key=${inv.groupId}>
              <${Avatar} person=${c.byId[inv.from] || { name: '?' }} size=${40} />
              <span class="row-main">
                <span class="row-title">${inv.groupName}</span>
                <span class="row-sub">${t('groups.invitedBy', { name: nameOf(c.byId[inv.from]) })}</span>
              </span>
              <button class="btn small" onClick=${function () { join(inv); }}>${t('groups.join')}</button>
              <button class="btn small ghost" onClick=${function () { decline(inv); }}>${t('groups.decline')}</button>
            </div>`;
          })}
        </div>
      </section>`}

      ${c.groups.some(function (g) { return g.bills.length; }) && html`<button type="button" class=${'card hero live' + (pressed ? ' pressed' : '')} onClick=${openSettle}>
        <span class="muted">${mine > 0 ? t('home.owed') : mine < 0 ? t('home.owe') : t('home.square')}</span>
        <span class="big"><${BigMoney} n=${shown} /></span>
        <span class="muted">${plural('groups.across', c.groups.length)}</span>
        <span class="hero-go" aria-hidden="true"><${Icon} name="arrow" size=${20} /></span>
        <span class="visually-hidden">${t('home.openSettle')}</span>
      </button>`}

      <section class="section grow">
        ${c.groups.length === 0 && html`<div class="empty-state">
          <${Stickers} />
          <h2 class="display">${t('groups.emptyTitle')}</h2>
          <p class="muted">${t('groups.none')}</p>
          <button class="btn" onClick=${function () { c.go('newGroup', null, null); }}><${Icon} name="plus" weight=${2.5} />${t('groups.new')}</button>
        </div>`}
        ${c.groups.length > 0 && html`<div class="tiles stagger">
          ${c.groups.map(function (g, i) {
            var v = Math.round(g.net[c.me.id] || 0);
            return html`<button class="tile" key=${g.id} style=${'background:' + groupColor(g) + ';--i:' + Math.min(i, 8)} onClick=${function () { c.go('group', null, g.id); }}>
              <span class="tile-top"><${GroupMark} group=${g} size=${30} /><${Badge} n=${g.unread} /></span>
              <span class="tile-name">${g.name}</span>
              ${v !== 0 && html`<span class="tile-amt">${signed(v)}</span>`}
              ${v === 0 && g.bills.length > 0 && html`<span class="tile-amt">${t('home.even')}</span>`}
              <span class="tile-sub">${g.lastLine || plural('groups.members', g.members.length)}${g.lastMessageAt > 0 ? ' · ' + when(g.lastMessageAt) : ''}</span>
            </button>`;
          })}
          <button class="tile add" style=${'--i:' + Math.min(c.groups.length, 8)} onClick=${function () { c.go('newGroup', null, null); }}><${Icon} name="plus" size=${24} weight=${2} /><span>${t('groups.new')}</span></button>
        </div>`}
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

      ${!c.data.guest && html`<button class="chat-link" aria-label=${g.unread ? t('chat.openN', { n: g.unread }) : t('chat.open')} onClick=${function () { c.go('chat'); }}>
        <span class="chat-link-icon"><${Icon} name="chat" /></span>
        <span class="row-main">
          <span class="row-title">${t('chat.title')}</span>
          <span class="row-sub">${g.lastLine || t('group.noMessages')}</span>
        </span>
        <${Badge} n=${g.unread} />
        <${Icon} name="arrow" size=${16} />
      </button>`}

      <section class="card hero">
        <p class="muted">${mine > 0 ? t('group.owed') : mine < 0 ? t('group.owe') : t('home.square')}</p>
        <p class=${'big ' + (mine > 0 ? 'owed' : mine < 0 ? 'owes' : '')}><${CountMoney} n=${mine} /></p>
        <p class="muted">${plural('home.across', bills.length)}</p>
        ${plan.length > 0 && html`<button class="link-row" onClick=${function () { c.go('settle'); }}>
          <span>${plural('home.settle', plan.length)}</span><${Icon} name="arrow" size=${18} />
        </button>`}
      </section>

      <section class="section">
        <h2 class="eyebrow">${t('home.balances')}</h2>
        <div class="list stagger">
          ${rows.map(function (r, i) {
            return html`<div class="row" key=${r.p.id} style=${'--i:' + Math.min(i, 8)}>
              <${Avatar} person=${r.p} size=${32} />
              <span class="row-main row-title">${whoName(c, r.p.id)}</span>
              <span class="hint">${r.v > 0 ? t('home.isOwed') : r.v < 0 ? t('home.owes') : t('home.even')}</span>
              <span class=${'amt wide ' + (r.v > 0 ? 'owed' : r.v < 0 ? 'owes' : 'muted')}>${signed(r.v)}</span>
            </div>`;
          })}
        </div>
      </section>

      <section class="section grow">
        <h2 class="eyebrow">${t('home.outings')}</h2>
        ${bills.length === 0 && html`<p class="empty">${t('home.noOutings')}</p>`}
        <div class="list stagger">
          ${shown.map(function (bill, i) {
            var sh = Calc.billShares(bill);
            var there = (bill.presentIds || []).indexOf(c.me.id) !== -1;
            return html`<button class="row tap" key=${bill.id} style=${'--i:' + Math.min(i + 2, 8)} onClick=${function () { c.go('bill', bill.id); }}>
              <span class="row-main">
                <span class="row-title">${bill.title}</span>
                <span class="row-sub">${fmtDate(bill.date)} · ${t('home.paid', { name: whoName(c, bill.payerId), amount: money(sh.total) })}</span>
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
        ${(c.data.canAsk || c.data.guest) && html`<button class="btn secondary" onClick=${c.data.guest ? c.needSignIn : c.startAi}><${Icon} name="chat" />${t('ai.open')}</button>`}
      </div>`;
  }

  // ---------- add / edit a bill ----------

  function Editor(c) {
    var draft = c.draft;
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
        </div>
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
        ${c.data.guest && html`<button class="btn dashed" onClick=${c.needSignIn}>
          <${Icon} name="camera" size=${18} />${t('edit.scan')}
        </button>`}
        ${(c.data.canAsk || c.data.guest) && html`<button class="btn dashed" onClick=${function () { if (c.data.guest) c.needSignIn(); else c.go('ai'); }}>
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
    // Only the group's members can be on its bills.
    var known = c.group.members.map(function (p) { return '- ' + p.name + (p.mine ? ' (me)' : ''); });
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
  // Only the group's members can be on it: a name that isn't one of them is
  // left out and reported in `unknown`.
  function applyAiBill(c, draft, ai) {
    function key(name) { return String(name).trim().toLowerCase(); }
    var byName = {};
    c.group.members.forEach(function (p) { byName[key(p.name)] = p.id; });

    var unknown = [];
    function idFor(name) {
      var k = key(name);
      if (!k) return null;
      if (!byName[k]) {
        if (unknown.indexOf(String(name).trim()) === -1) unknown.push(String(name).trim());
        return null;
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
      unknown: unknown,
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
        applied.unknown.forEach(function (name) { next.push({ role: 'note', text: t('ai.notInGroup', { name: name }) }); });
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
          ${!draft.payerAssumed && html`<p class="muted small">${[t('home.paid', { name: whoName(c, draft.payerId), amount: money(sh.total) })].concat(extras).join(' · ')}</p>`}
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
    var payerName = whoName(c, bill.payerId);
    var iPaid = bill.payerId === c.me.id;
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
    var there = present.indexOf(c.me.id) !== -1;
    var mine = Math.round(sh.shares[c.me.id] || 0);
    function shareToGroup() {
      var payments = owers.map(function (id) { return { fromId: id, toId: bill.payerId, amount: Math.round(sh.shares[id] || 0) }; })
        .filter(function (x) { return x.amount > 0; });
      var cd = { kind: 'bill', groupId: c.group.id, billId: bill.id, title: bill.title, payments: payments };
      store.sendMessage(c.group.id, c.me.id, billText(bill, sh, c.byId), cd).catch(function () { c.say(t('chat.failed')); });
      c.say(t('share.sentGroup'));
    }
    function row(id, isPayer) {
      var person = c.byId[id] || {};
      return html`<div class="row top" key=${id}>
        <${Avatar} person=${person} size=${36} />
        <span class="row-main">
          <span class="row-title">${whoName(c, id)}${isPayer && html`<span class="hint"> · ${t('bill.ownShare')}</span>`}</span>
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
        <p class="muted">${[t('home.paid', { name: payerName, amount: money(sh.total) }), plural('bill.items', (bill.items || []).length)].concat(extras.length ? [t('bill.includes', { list: extras.join(' + ') })] : []).join(' · ')}</p>
        <p class="muted">${iPaid && back > 0 ? t('bill.youGetBack') : !iPaid && there ? t('bill.yourShare') : t('bill.total')}</p>
        <p class=${'big' + (iPaid && back > 0 ? ' owed' : '')}><${CountMoney} n=${iPaid && back > 0 ? back : !iPaid && there ? mine : sh.total} /></p>
      </section>

      <section class="section grow">
        <h2 class="eyebrow">${t('bill.everyone')}</h2>
        <div class="list">
          ${owers.map(function (id) { return row(id, false); })}
          ${present.indexOf(bill.payerId) !== -1 && row(bill.payerId, true)}
        </div>
      </section>

      <div class="stack">
        ${!c.data.guest && html`<button class="btn" onClick=${shareToGroup}><${Icon} name="chat" />${t('bill.shareGroup')}</button>`}
        ${c.data.guest && html`<button class="btn" onClick=${function () { c.line(billText(bill, sh, c.byId)); }}><${Icon} name="send" />${t('bill.copy')}</button>`}
        ${!confirming && html`<p class="links">
          ${!c.data.guest && html`<button class="link quiet" onClick=${function () { c.line(billText(bill, sh, c.byId)); }}>${t('bill.copy')}</button><span aria-hidden="true">·</span>`}
          <button class="link danger" onClick=${function () { setConfirming(true); }}>${t('bill.delete')}</button>
        </p>`}
        ${confirming && html`<${Confirm} text=${t('bill.deleteAsk')} label=${t('common.delete')}
          onCancel=${function () { setConfirming(false); }}
          onConfirm=${function () { store.remove('bills', bill.id); c.go('group'); }} />`}
      </div>`;
  }

  // ---------- settle up ----------

  function Settle(c) {
    var ak = useState(null), asking = ak[0], setAsking = ak[1]; // the payment a reminder is being sent for
    var inApp = !c.data.guest; // guests have no chat: LINE is their only way
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
    function reminder(p) {
      return t('settle.reminder', { from: nameOf(c.byId[p.fromId]), to: nameOf(c.byId[p.toId]), amount: money(p.amount) });
    }
    function card(kind, list) {
      return { kind: kind, groupId: c.group.id, payments: list.map(function (x) { return { fromId: x.fromId, toId: x.toId, amount: Math.round(x.amount) }; }) };
    }
    function toGroup(text, cd) {
      store.sendMessage(c.group.id, c.me.id, text, cd).catch(function () { c.say(t('chat.failed')); });
      c.say(t('share.sentGroup'));
    }
    function toFriend(uid, text, cd) {
      store.sendDm(uid, text, cd).catch(function () { c.say(t('chat.failed')); });
      c.say(t('share.sentFriend', { name: nameOf(c.byId[uid]) }));
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

      ${plan.length > 0 && html`<section class="section grow stagger">
        <h2 class="eyebrow">${t('settle.whoPays')}</h2>
        ${plan.map(function (p, i) {
          var from = c.byId[p.fromId] || {};
          var to = c.byId[p.toId] || {};
          return html`<div class="pay" key=${p.fromId + p.toId} style=${'--i:' + Math.min(i + 1, 8)}>
            <div class="pay-line">
              <${Avatar} person=${from} size=${32} />
              <span class="row-title">${whoName(c, p.fromId)}</span>
              <span class="pay-arrow" role="img" aria-label=${t('settle.pays')}><${Icon} name="arrow" size=${18} /></span>
              <${Avatar} person=${to} size=${32} />
              <span class="row-title row-main">${whoName(c, p.toId)}</span>
              <span class=${'amt ' + (p.toId === c.me.id ? 'owed' : p.fromId === c.me.id ? 'owes' : '')}>${money(p.amount)}</span>
            </div>
            <div class="pay-actions">
              ${p.fromId !== c.me.id && html`<button class="btn small ghost" onClick=${function () { if (inApp) setAsking(p); else c.line(reminder(p)); }}>${inApp ? t('settle.remind') : t('settle.copyReminder')}</button>`}
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
                <span class="row-title">${t('settle.paidLine', { from: whoName(c, p.fromId), to: whoName(c, p.toId, true) })}</span>
                <span class="row-sub">${fmtDate(p.date)}</span>
              </span>
              <span class="amt">${money(p.amount)}</span>
              <button class="btn small ghost" onClick=${function () { store.remove('payments', p.id); }}>${t('settle.undo')}</button>
            </div>`;
          })}
        </div>
      </section>`}

      ${plan.length > 0 && inApp && html`<div class="stack">
        <button class="btn" onClick=${function () { toGroup(planText(), card('plan', plan)); }}><${Icon} name="chat" />${t('settle.planToGroup')}</button>
        <p class="links"><button class="link quiet" onClick=${function () { c.line(planText()); }}>${t('bill.copy')}</button></p>
      </div>`}
      ${plan.length > 0 && !inApp && html`<button class="btn" onClick=${function () { c.line(planText()); }}><${Icon} name="send" />${t('settle.copyPlan')}</button>`}

      ${asking && html`<${Sheet} label=${t('settle.remindTitle', { name: nameOf(c.byId[asking.fromId]) })} onClose=${function () { setAsking(null); }} render=${function (close) {
        return html`
          <h2 class="eyebrow">${t('settle.remindTitle', { name: nameOf(c.byId[asking.fromId]) })}</h2>
          <p class="muted">${reminder(asking)}</p>
          <button class="btn" onClick=${function () { toGroup(reminder(asking), card('remind', [asking])); close(); }}><${Icon} name="chat" />${t('share.toGroup')}</button>
          ${c.data.friends.indexOf(asking.fromId) !== -1 && html`<button class="btn secondary" onClick=${function () { toFriend(asking.fromId, reminder(asking), card('remind', [asking])); close(); }}><${Icon} name="user" />${t('share.toFriend', { name: nameOf(c.byId[asking.fromId]) })}</button>`}
          <p class="links">
            <button class="link quiet" onClick=${function () { c.line(reminder(asking)); close(); }}>${t('bill.copy')}</button><span aria-hidden="true">·</span>
            <button class="link quiet" onClick=${close}>${t('common.cancel')}</button>
          </p>`;
      }} />`}`;
  }

  // ---------- group chat ----------

  // A conversation's rows, oldest first, with a date line where the day
  // changes. names: show who wrote each message (groups; not a two-person chat).
  // openedAt: when the chat was opened; messages newer than that pop in.
  function chatRows(c, timeline, names, openedAt) {
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
          <span class="row-main">${t('chat.billAdded', { name: whoName(c, bill.payerId), amount: money(Calc.billShares(bill).total), title: bill.title })}</span>
          <span class="link-text">${t('chat.view')}</span>
        </button>`);
        return;
      }
      var m = entry.message;
      var isCard = !!(m.card && m.card.kind);
      var fresh = !!openedAt && (m.at || 0) > openedAt;
      if (m.personId === c.me.id) {
        rows.push(isCard ? html`<${ChatCard} key=${entry.key} c=${c} card=${m.card} mine=${true} fresh=${fresh} />`
          : html`<div class=${'bubble me' + (fresh ? ' new' : '')} key=${entry.key}><p>${m.text}</p></div>`);
        return;
      }
      var person = c.byId[m.personId] || {};
      rows.push(html`<div class="msg" key=${entry.key}>
        <${Avatar} person=${person} size=${32} />
        <div class="msg-body">
          ${names && html`<span class="msg-name">${nameOf(person)}</span>`}
          ${isCard ? html`<${ChatCard} c=${c} card=${m.card} fresh=${fresh} />` : html`<div class=${'bubble ai' + (fresh ? ' new' : '')}><p>${m.text}</p></div>`}
        </div>
      </div>`);
    });
    return rows;
  }

  // A reminder, settle-up plan or bill sent into a chat. It is drawn for the
  // reader (their language, "you" for them), with a way to act on it.
  function ChatCard(p) {
    var c = p.c, card = p.card;
    var g = c.groups.filter(function (x) { return x.id === card.groupId; })[0];
    return html`<div class=${'chat-card' + (p.mine ? ' me' : '') + (p.fresh ? ' new' : '')}>
      <p class="chat-card-title"><${Icon} name=${card.kind === 'bill' ? 'receipt' : 'bell'} size=${16} />${cardTitle(card, c.groups)}</p>
      ${(card.payments || []).map(function (x, i) {
        return html`<p class="chat-card-line" key=${i}><span>${whoName(c, x.fromId)} → ${whoName(c, x.toId, true)}</span><span class="amt">${money(x.amount)}</span></p>`;
      })}
      ${g && card.kind === 'bill' && html`<button class="btn small" onClick=${function () { c.go('bill', card.billId, g.id); }}>${t('card.openBill')}</button>`}
      ${g && card.kind !== 'bill' && html`<button class="btn small" onClick=${function () { c.go('settle', null, g.id); }}>${t('card.openSettle')}</button>`}
    </div>`;
  }

  // The message box at the bottom of a conversation.
  function Composer(p) {
    var tx = useState(''), text = tx[0], setText = tx[1];
    function send(ev) {
      ev.preventDefault();
      var msg = text.trim();
      if (!msg) return;
      setText('');
      p.onSend(msg);
    }
    return html`<form class="composer cta" onSubmit=${send}>
      <input id="chat-message" class="field" aria-label=${p.placeholder} placeholder=${p.placeholder} value=${text} autocomplete="off" maxlength="1000" onInput=${function (e) { setText(e.target.value); }} />
      <button type="submit" class="icon-btn send" aria-label=${t('ai.send')} disabled=${!text.trim()}><${Icon} name="send" weight=${2.2} /></button>
    </form>`;
  }

  function Chat(c) {
    var g = c.group;
    var endRef = useRef(null);
    var opened = useRef(Date.now());
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

    return html`
      <${Head} onBack=${function () { c.go('group'); }} title=${g.name} sub=${plural('groups.members', g.members.length)} />

      <section class="chat grow">
        ${timeline.length === 0 && html`<p class="empty">${t('chat.empty')}</p>`}
        ${chatRows(c, timeline, true, opened.current)}
        <div ref=${endRef}></div>
      </section>

      <${Composer} placeholder=${t('chat.placeholder')} onSend=${function (msg) {
        store.sendMessage(g.id, c.me.id, msg).catch(function () { c.say(t('chat.failed')); });
      }} />`;
  }

  // A private conversation with one friend. Once they are no longer friends the
  // history stays, but nothing more can be sent.
  function Dm(c) {
    var p = c.person;
    var endRef = useRef(null);
    var opened = useRef(Date.now());
    var friend = c.data.friends.indexOf(p.id) !== -1;
    var timeline = (c.data.dms[p.id] || []).map(function (m) { return { at: m.at || 0, key: 'm' + m.id, message: m }; });

    useEffect(function () {
      store.markChatRead('dm:' + p.id);
      if (timeline.length && endRef.current) endRef.current.scrollIntoView({ block: 'end' });
    }, [timeline.length]);

    return html`
      <${Head} onBack=${function () { if (c.from === 'person') c.go('person', p.id); else c.go('people'); }} title=${p.name}
        right=${html`<button class="icon-btn bare" aria-label=${t('dm.profile', { name: p.name })} onClick=${function () { c.go('person', p.id, undefined, 'dm'); }}><${Avatar} person=${p} size=${40} /></button>`} />

      <section class="chat grow">
        ${timeline.length === 0 && html`<p class="empty">${t('dm.empty', { name: p.name })}</p>`}
        ${chatRows(c, timeline, false, opened.current)}
        <div ref=${endRef}></div>
      </section>

      ${friend && html`<${Composer} placeholder=${t('dm.placeholder', { name: p.name })} onSend=${function (msg) {
        store.sendDm(p.id, msg).catch(function () { c.say(t('chat.failed')); });
      }} />`}
      ${!friend && html`<p class="muted small">${t('dm.notFriends', { name: p.name })}</p>`}`;
  }

  // ---------- groups ----------

  // Whoever makes a group runs it: only they add or remove its members.
  // A new group starts with the viewer alone; the friends picked here get an
  // invitation and join when they accept it.
  function NewGroup(c) {
    var n = useState(''), name = n[0], setName = n[1];
    var p = useState([]), picked = p[0], setPicked = p[1];
    var e = useState(''), err = e[0], setErr = e[1];
    // A guest types the names of the people in the group instead.
    var ns = useState([]), names = ns[0], setNames = ns[1];
    var ty = useState(''), typed = ty[0], setTyped = ty[1];
    var ic = useState(null), icon = ic[0], setIcon = ic[1];
    var preset = c.allGroups.length % COLORS.length;

    function toggle(id) {
      setPicked(picked.indexOf(id) === -1 ? picked.concat(id) : picked.filter(function (x) { return x !== id; }));
    }
    function addName(n) { if (names.indexOf(n) === -1) setNames(names.concat(n)); }
    function createAsGuest(clean, gid) {
      // A name typed but not added yet counts too.
      var all = names.concat(typed.trim() && names.indexOf(typed.trim()) === -1 ? [typed.trim().slice(0, 40)] : []);
      var ids = all.map(function (n, i) {
        var id = store.newId() + i;
        store.put('people', id, newPerson(n, c.people.length + i));
        return id;
      });
      store.put('groups', gid, Object.assign({
        name: clean, ownerId: c.me.id, memberIds: [c.me.id].concat(ids), preset: preset, createdAt: Date.now()
      }, icon ? { icon: icon } : {}));
      c.go('group', null, gid);
    }
    function create() {
      var clean = name.trim();
      if (!clean) { setErr(t('newGroup.needName')); return; }
      var gid = store.newId();
      if (c.data.guest) { createAsGuest(clean, gid); return; }
      store.put('groups', gid, Object.assign({
        name: clean, ownerId: c.me.id, memberIds: [c.me.id], preset: preset, createdAt: Date.now()
      }, icon ? { icon: icon } : {})).then(function () {
        return Promise.all(picked.map(function (uid) { return store.inviteToGroup(gid, uid); }));
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
        <h2 class="eyebrow">${t('groupIcon.label')}</h2>
        <${IconPicker} value=${icon} color=${COLORS[preset]} onPick=${setIcon} />
      </section>

      ${c.data.guest && html`<section class="section">
        <div class="eyebrow-row">
          <h2 class="eyebrow">${t('guest.who')}</h2>
          <span class="hint">${t('newGroup.picked', { n: names.length })}</span>
        </div>
        <div class="pills">
          <span class="pill on">${t('people.you')}</span>
          ${names.map(function (n) {
            return html`<button key=${n} class="pill on" aria-label=${t('item.remove', { name: n })} onClick=${function () { setNames(names.filter(function (x) { return x !== n; })); }}>
              ${n}<${Icon} name="close" size=${14} />
            </button>`;
          })}
        </div>
        <${AddByName} value=${typed} onValue=${setTyped} onAdd=${addName} />
      </section>`}

      ${!c.data.guest && html`<section class="section">
        <div class="eyebrow-row">
          <h2 class="eyebrow">${t('newGroup.who')}</h2>
          <span class="hint">${t('newGroup.picked', { n: picked.length })}</span>
        </div>
        <div class="who-row">
          <span class="who">
            <${Avatar} person=${c.me} size=${44} />
            <span class="who-name">${t('people.you')}</span>
          </span>
          ${c.friends.map(function (x) {
            var on = picked.indexOf(x.id) !== -1;
            return html`<button key=${x.id} class=${'who' + (on ? '' : ' off')} aria-pressed=${on ? 'true' : 'false'} onClick=${function () { toggle(x.id); }}>
              <${Avatar} person=${x} size=${44} />
              <span class="who-name">${x.name}</span>
            </button>`;
          })}
        </div>
        <p class="muted small">${c.friends.length ? t('newGroup.inviteNote') : t('newGroup.noFriends')}</p>
      </section>`}

      ${!c.data.guest && html`<p class="muted small">${t('newGroup.adminNote')}</p>`}
      <div class="stack cta">
        <button class="btn" onClick=${create}>${t('newGroup.create')}</button>
      </div>`;
  }

  function Members(c) {
    var g = c.group;
    var owner = c.byId[g.ownerId];
    var admin = g.ownerId === c.me.id;
    var ms = useState(g.memberIds), ids = ms[0], setIds = ms[1];
    var nm = useState(g.name), name = nm[0], setName = nm[1];
    var ak = useState(null), asking = ak[0], setAsking = ak[1]; // {kind: 'remove', id} | {kind: 'leave'} | {kind: 'delete'}
    var ty = useState(''), typed = ty[0], setTyped = ty[1]; // a guest adds people by name

    // Kept here as well as in the store so quick taps build on each other.
    var key = g.memberIds.join(',');
    useEffect(function () { setIds(g.memberIds); }, [key]);

    var members = c.people.filter(function (p) { return !p.archived && ids.indexOf(p.id) !== -1; })
      .sort(function (x, y) { return (y.id === g.ownerId) - (x.id === g.ownerId); });
    // Invited and not answered yet; and the friends who could still be invited.
    var invites = c.data.groupInvites[g.id] || [];
    var invitedIds = invites.map(function (inv) { return inv.id; });
    var invited = invitedIds.map(function (id) { return c.byId[id] || { id: id, name: t('person.unknown') }; });
    var others = c.friends.filter(function (p) { return ids.indexOf(p.id) === -1 && invitedIds.indexOf(p.id) === -1; });

    function setMembers(next) {
      setIds(next);
      saveGroup(g, { memberIds: next }).catch(function () { c.say(t('app.saveFailed')); });
    }
    function addByName(n) {
      var id = store.newId();
      store.put('people', id, newPerson(n, c.people.length));
      setMembers(ids.concat(id));
    }
    function invite(person) {
      store.inviteToGroup(g.id, person.id).then(function () {
        c.say(t('members.inviteSent', { name: person.name }));
      }, function () { c.say(t('app.saveFailed')); });
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

      ${admin && html`<section class="section">
        <h2 class="eyebrow">${t('groupIcon.label')}</h2>
        <${IconPicker} value=${groupIcon(g)} color=${groupColor(g)} onPick=${function (v) { saveGroup(g, { icon: v }).catch(function () { c.say(t('app.saveFailed')); }); }} />
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

      ${invited.length > 0 && html`<section class="section">
        <h2 class="eyebrow">${t('members.invited')}</h2>
        <div class="list">
          ${invited.map(function (p) {
            return html`<div class="row" key=${p.id}>
              <${Avatar} person=${p} size=${40} />
              <span class="row-main">
                <span class="row-title">${p.name}</span>
                <span class="row-sub">${t('members.waiting')}</span>
              </span>
              ${admin && html`<button class="icon-btn bare muted" aria-label=${t('members.cancelInvite', { name: p.name })} onClick=${function () { store.cancelInvitation(g.id, p.id).catch(function () { c.say(t('app.saveFailed')); }); }}><${Icon} name="close" size=${18} /></button>`}
            </div>`;
          })}
        </div>
      </section>`}

      ${c.data.guest && html`<section class="section">
        <h2 class="eyebrow">${t('guest.addPeople')}</h2>
        <${AddByName} value=${typed} onValue=${setTyped} onAdd=${addByName} />
      </section>`}

      ${admin && !c.data.guest && html`<section class="section">
        <h2 class="eyebrow">${t('members.invite')}</h2>
        ${others.length > 0 && html`<div class="pills">
          ${others.map(function (p) {
            return html`<button key=${p.id} class="pill chip" onClick=${function () { invite(p); }}>
              <${Avatar} person=${p} size=${24} />${p.name}<${Icon} name="plus" size=${14} weight=${2.5} />
            </button>`;
          })}
        </div>`}
        <p class="muted small">${others.length ? t('members.inviteNote') : t('members.noFriends')} <button class="link inline" onClick=${function () { c.go('invite', null, undefined, 'members'); }}>${t('invite.open')}</button></p>
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

  // The viewer's friends, and the friend requests on their way in and out.
  function People(c) {
    function groupCount(p) {
      return c.groups.filter(function (g) { return g.memberIds.indexOf(p.id) !== -1; }).length;
    }
    function person(id) { return c.byId[id] || { id: id, name: t('person.unknown') }; }
    function accept(id) {
      store.acceptFriend(id).then(function () {
        c.say(t('friends.accepted', { name: nameOf(c.byId[id]) }));
      }, function () { c.say(t('app.saveFailed')); });
    }
    function fail() { c.say(t('app.saveFailed')); }
    var incoming = c.data.requestsIn.map(function (r) { return person(r.from); });
    var outgoing = c.data.requestsOut.map(function (r) { return person(r.to); });

    if (c.data.guest) {
      return html`
        <${Head} title=${t('people.title')} />
        <section class="card">
          <p class="row-title">${t('guest.friendsTitle')}</p>
          <p class="muted">${t('guest.friendsLead')}</p>
        </section>
        <button class="btn" onClick=${function () { c.go('home', null, null); store.leaveGuest(); }}>${t('guest.signIn')}</button>`;
    }

    return html`
      <${Head} title=${t('people.title')}
        right=${html`<button class="icon-btn" aria-label=${t('friends.add')} onClick=${function () { c.go('addFriend'); }}><${Icon} name="plus" weight=${2.5} /></button>`} />

      ${incoming.length > 0 && html`<section class="section">
        <h2 class="eyebrow">${t('friends.requests')}</h2>
        <div class="list">
          ${incoming.map(function (p) {
            return html`<div class="row" key=${p.id}>
              <${Avatar} person=${p} size=${40} />
              <span class="row-main row-title">${p.name}</span>
              <button class="btn small" onClick=${function () { accept(p.id); }}>${t('friends.accept')}</button>
              <button class="btn small ghost" onClick=${function () { store.declineFriend(p.id).catch(fail); }}>${t('friends.decline')}</button>
            </div>`;
          })}
        </div>
      </section>`}

      <section class="section">
        ${c.friends.length === 0 && html`<p class="empty">${t('friends.none')}</p>`}
        <div class="list stagger">
          ${c.friends.slice().sort(function (x, y) { return y.dm.lastAt - x.dm.lastAt; }).map(function (p, i) {
            var n = groupCount(p);
            return html`<div class="row" key=${p.id} style=${'--i:' + Math.min(i, 8)}>
              <button class="row-btn" onClick=${function () { c.go('person', p.id); }}>
                <${Avatar} person=${p} size=${44} />
                <span class="row-main">
                  <span class="row-title">${p.name}</span>
                  <span class="row-sub">${p.dm.lastLine || (n ? plural('people.inGroups', n) : t('people.noGroup'))}</span>
                </span>
              </button>
              <button class="icon-btn chat-btn" aria-label=${t('dm.placeholder', { name: p.name })} onClick=${function () { c.go('dm', p.id); }}>
                <${Icon} name="chat" />
                ${p.dm.unread > 0 && html`<span key=${p.dm.unread} class="badge" aria-hidden="true">${p.dm.unread > 9 ? '9+' : p.dm.unread}</span>`}
              </button>
            </div>`;
          })}
        </div>
        ${c.friends.length === 0 && html`<button class="btn" onClick=${function () { c.go('addFriend'); }}><${Icon} name="plus" size=${18} weight=${2.5} />${t('friends.add')}</button>`}
      </section>

      ${outgoing.length > 0 && html`<section class="section">
        <h2 class="eyebrow">${t('friends.sent')}</h2>
        <div class="list">
          ${outgoing.map(function (p) {
            return html`<div class="row" key=${p.id}>
              <${Avatar} person=${p} size=${40} />
              <span class="row-main">
                <span class="row-title">${p.name}</span>
                <span class="row-sub">${t('members.waiting')}</span>
              </span>
              <button class="btn small ghost" onClick=${function () { store.cancelFriendRequest(p.id).catch(fail); }}>${t('friends.cancel')}</button>
            </div>`;
          })}
        </div>
      </section>`}`;
  }

  // A QR code drawn as SVG squares, dark on light so phone cameras read it.
  function Qr(p) {
    if (!window.qrcode) return null;
    var qr = window.qrcode(0, 'M');
    qr.addData(p.text);
    qr.make();
    var n = qr.getModuleCount();
    var d = '';
    for (var r = 0; r < n; r++) {
      for (var col = 0; col < n; col++) if (qr.isDark(r, col)) d += 'M' + (col + 2) + ' ' + (r + 2) + 'h1v1h-1z';
    }
    return html`<svg class="qr" role="img" aria-label=${p.label} viewBox=${'0 0 ' + (n + 4) + ' ' + (n + 4)} width="208" height="208" shape-rendering="crispEdges">
      <rect width="100%" height="100%" fill="#fff" /><path d=${d} fill="#111" />
    </svg>`;
  }

  // The viewer's own friend link: whoever opens it and signs in sends them a
  // friend request. It also lets a new friend into Tab, which is invite-only.
  function AddFriend(c) {
    var l = useState({ link: '', failed: false }), made = l[0], setMade = l[1];
    useEffect(function () {
      var live = true;
      store.friendLink().then(function (code) {
        if (live) setMade({ link: location.origin + location.pathname + '?openExternalBrowser=1#add=' + code, failed: false });
      }, function () { if (live) setMade({ link: '', failed: true }); });
      return function () { live = false; };
    }, []);
    var link = made.link;

    return html`
      <${Head} onBack=${function () { c.go(c.from || 'people'); }} title=${t('friends.add')} />
      <p class="muted">${t('friends.linkLead')}</p>

      <section class="section center">
        ${link && html`<${Qr} text=${link} label=${t('friends.qr')} />`}
        ${!link && !made.failed && html`<p class="muted">${t('invite.making')}</p>`}
        ${made.failed && html`<p class="warn-text" role="alert">${t('friends.linkFailed')}</p>`}
      </section>

      <section class="section">
        <label class="eyebrow" for="friend-link">${t('friends.linkTitle')}</label>
        <div class="add-row">
          <input id="friend-link" class="field" readonly value=${link} onFocus=${function (e) { e.target.select(); }} />
          <button class="btn small secondary" disabled=${!link} onClick=${function () { c.copy(link); }}><${Icon} name="copy" size=${16} />${t('invite.copyLink')}</button>
        </div>
      </section>

      <div class="stack grow-top">
        <button class="btn" disabled=${!link} onClick=${function () { c.line(t('friends.shareMsg', { link: link })); }}><${Icon} name="send" />${t('friends.sendLine')}</button>
      </div>`;
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
      return html`<div class="list stagger">
        ${list.map(function (x, i) {
          return html`<button class="row tap" key=${x.g.id + x.p.fromId + x.p.toId} style=${'--i:' + Math.min(i, 8)} onClick=${function () { c.go('settle', null, x.g.id, 'settleAll'); }}>
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
        <p class="big"><${CountMoney} n=${net} /></p>
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
    var k = useState(false), clearing = k[0], setClearing = k[1];
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

      ${c.data.guest && html`<div class="stack grow-top">
        <p class="muted small">${t('guest.meNote')}</p>
        <button class="btn" onClick=${function () { c.go('home', null, null); store.leaveGuest(); }}>${t('guest.signIn')}</button>
        ${!clearing && html`<button class="btn ghost danger" onClick=${function () { setClearing(true); }}><${Icon} name="trash" size=${18} />${t('guest.clear')}</button>`}
        ${clearing && html`<${Confirm} text=${t('guest.clearAsk')} label=${t('common.delete')}
          onCancel=${function () { setClearing(false); }}
          onConfirm=${function () { c.go('home', null, null); store.clearGuest(); }} />`}
      </div>`}

      ${!c.data.guest && html`<div class="stack grow-top">
        ${c.data.user && html`<p class="muted small">${t('me.signedInAs', { email: c.data.user.email })}</p>`}
        <button class="btn secondary" onClick=${function () { c.go('addFriend', null, undefined, 'me'); }}><${Icon} name="users" size=${18} />${t('friends.myLink')}</button>
        <button class="btn ghost" onClick=${function () { c.go('home', null, null); store.signOut(); }}>${t('me.signOut')}</button>
      </div>`}`;
  }

  // Floating bar along the bottom of the four main screens. Groups carries the
  // count of unread chat messages across all groups.
  // How deep each screen sits: going deeper slides in from the right, going
  // back from the left, and screens at the same depth (the tabs) fade.
  var DEPTH = {
    home: 0, settleAll: 0, people: 0, me: 0,
    group: 1, newGroup: 1, addFriend: 1, invite: 1, person: 1,
    members: 2, chat: 2, settle: 2, bill: 2, edit: 2, ai: 2, dm: 2,
    scan: 3
  };
  function screenAnim(from, to) {
    if (!from) return 'in-tab';
    var a = DEPTH[from.name] || 0, b = DEPTH[to.name] || 0;
    return b > a ? 'in-fwd' : b < a ? 'in-back' : 'in-tab';
  }

  var TABS = [
    { name: 'home', icon: 'chat', label: 'tabs.groups' },
    { name: 'settleAll', icon: 'swap', label: 'tabs.settle' },
    { name: 'people', icon: 'users', label: 'tabs.friends' },
    { name: 'me', icon: 'user', label: 'tabs.me' }
  ];
  // The bottom bar. A grey pill sits behind the open tab and slides to the next
  // one. A finger can also press the bar and slide along it: the pill follows,
  // and letting go opens the tab underneath. A plain tap is just the button's click.
  function TabBar(p) {
    var current = TABS.map(function (x) { return x.name; }).indexOf(p.current);
    var dg = useState(null), drag = dg[0], setDrag = dg[1]; // {pos, over} while dragging
    var press = useRef(null); // {x, id, moved, over} from pointerdown until it lifts
    var navRef = useRef(null);
    // Where the pill sits under a finger at clientX: 0 = first tab, 3 = last.
    function posAt(clientX) {
      var box = navRef.current.getBoundingClientRect();
      var pos = (clientX - box.left - 6) / ((box.width - 12) / TABS.length) - 0.5;
      return Math.max(0, Math.min(TABS.length - 1, pos));
    }
    function down(e) {
      if (e.button > 0) return;
      press.current = { x: e.clientX, id: e.pointerId, moved: false, over: current };
    }
    function move(e) {
      var s = press.current;
      if (!s || e.pointerId !== s.id) return;
      if (!s.moved && Math.abs(e.clientX - s.x) < 8) return;
      if (!s.moved) {
        s.moved = true;
        try { navRef.current.setPointerCapture(e.pointerId); } catch (x) { /* fine without */ }
      }
      var pos = posAt(e.clientX);
      var over = Math.round(pos);
      if (over !== s.over && navigator.vibrate) { try { navigator.vibrate(8); } catch (x) { /* not supported */ } }
      s.over = over;
      setDrag({ pos: pos, over: over });
    }
    function up(e) {
      var s = press.current;
      press.current = null;
      if (!s || e.pointerId !== s.id || !s.moved) return; // a tap: the button's click handles it
      setDrag(null);
      if (s.over !== current) p.go(TABS[s.over].name, null, null);
    }
    function cancel() { press.current = null; setDrag(null); }
    var shownOn = drag ? drag.over : current;
    return html`<nav ref=${navRef} class=${'tabbar' + (drag ? ' dragging' : '')} aria-label=${t('tabs.label')}
      onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${cancel}>
      <span class="tab-pill" aria-hidden="true" style=${'--pos:' + (drag ? drag.pos : Math.max(current, 0))}></span>
      ${TABS.map(function (tab, i) {
        var on = shownOn === i;
        var n = tab.name === 'home' ? p.unread : tab.name === 'people' ? p.dmUnread : 0;
        return html`<button key=${tab.name} class=${'tab' + (on ? ' on' : '')} aria-current=${p.current === tab.name ? 'page' : null} onClick=${function () { p.go(tab.name, null, null); }}>
          <span class="tab-icon">
            <${Icon} name=${tab.icon} size=${24} weight=${1.8} />
            ${n > 0 && html`<span key=${n} class="badge tab-badge" aria-hidden="true">${n > 9 ? '9+' : n}</span>`}
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
        <button class="btn" disabled=${!link} onClick=${function () { c.line(t('invite.msg', { group: group.name, link: link })); }}><${Icon} name="send" />${t('invite.copyMsg')}</button>
      </div>`}`;
  }

  function Person(c) {
    var existing = c.id ? c.byId[c.id] : null;
    var n = useState(existing ? existing.name : ''), name = n[0], setName = n[1];
    var a = useState(existing && existing.avatar ? existing.avatar : { kind: 'preset', preset: c.people.length % COLORS.length }), avatar = a[0], setAvatar = a[1];
    var b = useState(false), busy = b[0], setBusy = b[1];
    var e = useState(''), err = e[0], setErr = e[1];
    var unsaved = useRef(null); // photo uploaded on this screen that no saved row points at yet

    if (c.id && !existing) return html`<${Head} onBack=${function () { c.go(c.from || 'people'); }} title=${t('person.title')} />`;

    var isMe = !!(existing && existing.mine);
    if (existing && !isMe) return html`<${FriendProfile} ...${c} person=${existing} />`;
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
      </div>`;
  }

  // Someone else's profile: only they can change it. A friend can be removed
  // here; groups you share stay as they are.
  function FriendProfile(c) {
    var p = c.person;
    var k = useState(false), confirming = k[0], setConfirming = k[1];
    var friend = c.data.friends.indexOf(p.id) !== -1;
    var shared = c.groups.filter(function (g) { return g.memberIds.indexOf(p.id) !== -1; });
    var me = c.friends.filter(function (f) { return f.id === p.id; })[0];
    var unread = me && me.dm ? me.dm.unread : 0;
    // What the two of them owe each other in a group's settle-up plan: + they owe the viewer.
    function between(g) {
      return Math.round(Calc.settle(g.net).reduce(function (v, x) {
        if (x.fromId === p.id && x.toId === c.me.id) return v + x.amount;
        if (x.fromId === c.me.id && x.toId === p.id) return v - x.amount;
        return v;
      }, 0));
    }
    function unfriend() {
      store.removeFriend(p.id).catch(function () { c.say(t('app.saveFailed')); });
      c.go('people');
    }
    function back() {
      if (c.from === 'dm') c.go('dm', p.id);
      else c.go(c.from || 'people');
    }
    return html`
      <${Head} onBack=${back} title=${t('person.title')} />
      <section class="section center">
        <${Avatar} person=${p} size=${96} />
        <h2 class="display">${p.name}</h2>
      </section>
      ${friend && html`<button class="btn" onClick=${function () { c.go('dm', p.id, undefined, 'person'); }}><${Icon} name="chat" />${t('dm.open')}${unread > 0 && html`<span key=${unread} class="badge inline">${unread > 9 ? '9+' : unread}</span>`}</button>`}
      <section class="section">
        <h2 class="eyebrow">${t('person.shared')}</h2>
        ${shared.length === 0 && html`<p class="empty">${t('people.noGroup')}</p>`}
        <div class="list stagger">
          ${shared.map(function (g, i) {
            var v = between(g);
            return html`<button class="row tap" key=${g.id} style=${'--i:' + Math.min(i, 8)} onClick=${function () { c.go(v ? 'settle' : 'group', null, g.id); }}>
              <${GroupAvatar} group=${g} size=${40} />
              <span class="row-main">
                <span class="row-title">${g.name}</span>
                <span class=${'row-sub' + (v > 0 ? ' owed' : v < 0 ? ' owes' : '')}>${v > 0 ? t('person.owesYou', { name: p.name, amount: money(v) }) : v < 0 ? t('person.youOwe', { name: p.name, amount: money(-v) }) : t('person.even')}</span>
              </span>
              <${Icon} name="chevron" size=${18} />
            </button>`;
          })}
        </div>
      </section>
      <div class="stack grow-top">
        ${friend && !confirming && html`<p class="links"><button class="link danger" onClick=${function () { setConfirming(true); }}>${t('friends.remove')}</button></p>`}
        ${confirming && html`<${Confirm} text=${t('friends.removeAsk', { name: p.name })} label=${t('common.remove')}
          onCancel=${function () { setConfirming(false); }} onConfirm=${unfriend} />`}
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
    var na = useState(false), needSignIn = na[0], setNeedSignIn = na[1]; // a guest tapped an AI button
    var tl = useState(false), toastLeaving = tl[0], setToastLeaving = tl[1];
    var screen = useRef({ key: null, route: null, anim: '' }); // the shown screen and how it came in

    useEffect(function () {
      var stop = store.subscribe(setData);
      setData(store.getState()); // catch anything that arrived before this effect ran
      return stop;
    }, []);
    useEffect(function () { window.scrollTo(0, 0); }, [route.name, route.id, route.gid]);
    useEffect(function () {
      if (!toast) return undefined;
      setToastLeaving(false);
      var fade = setTimeout(function () { setToastLeaving(true); }, 2350);
      var h = setTimeout(function () { setToast(''); }, 2600);
      return function () { clearTimeout(fade); clearTimeout(h); };
    }, [toast]);

    var lang = data.settings.lang || I18n.detect();
    I18n.setLang(lang);
    useEffect(function () { document.documentElement.lang = lang; }, [lang]);

    live.route = route;
    live.draft = draft;
    live.chat = chat;

    // The viewer is their own account: their person is their profile, people/{uid}.
    var meId = data.meId;
    // An invite link that didn't work, opened by someone already in: just say so.
    useEffect(function () {
      if (!data.joinError || !data.inCircle) return;
      setToast(joinErrorText(data.joinError));
      store.clearJoinError();
    }, [data.joinError, data.inCircle]);
    // What happened to a friend link opened on this device.
    var noticeName = data.notice && data.notice.uid ? nameOf(data.people.filter(function (p) { return p.id === data.notice.uid; })[0]) : '';
    // It waits until the profiles have arrived, so it can say whose link it was.
    useEffect(function () {
      if (!data.notice || !data.inCircle || !data.ready) return;
      setToast(t('friends.' + data.notice.code, { name: noticeName }));
      store.clearNotice();
    }, [data.notice, data.inCircle, data.ready]);

    if (!data.ready) return html`<main class="app"><p class="boot">${t('app.loading')}</p></main>`;
    if (data.auth === 'out' && !data.guest) return html`<main class="app"><${SignIn} data=${data} lang=${lang} /></main>`;
    if (data.auth === 'in' && data.inCircle === false) return html`<main class="app"><${NotInvited} data=${data} lang=${lang} /></main>`;
    if (data.platform && !data.persistent) return html`<main class="app"><${Disconnected} /></main>`;

    var people = data.people.map(function (p) { return Object.assign({}, p, { mine: p.id === meId }); }).sort(function (x, y) {
      if (x.mine !== y.mine) return x.mine ? -1 : 1;
      return String(x.name).localeCompare(String(y.name));
    });
    var byId = {};
    people.forEach(function (p) { byId[p.id] = p; });
    var me = meId ? byId[meId] : null;
    // Each friend with their private conversation: its last line and unread count.
    function dmView(p) {
      var messages = data.dms[p.id] || [];
      var last = messages[messages.length - 1];
      return {
        lastAt: last ? last.at || 0 : 0,
        lastLine: !last ? '' : me && last.personId === me.id ? t('groups.you', { text: lineOf(last, data.groups) }) : lineOf(last, data.groups),
        unread: me ? messages.filter(function (m) { return m.at > (data.chatRead['dm:' + p.id] || 0) && m.personId !== me.id; }).length : 0
      };
    }
    var friends = people.filter(function (p) { return data.friends.indexOf(p.id) !== -1; })
      .map(function (p) { return Object.assign({}, p, { dm: dmView(p) }); });

    // Each group with what the screens need: its people, bills, chat and sums.
    function groupView(g) {
      var memberIds = Array.isArray(g.memberIds) ? g.memberIds : [];
      var bills = data.bills.filter(function (b) { return store.groupOf(b) === g.id; });
      var payments = data.payments.filter(function (p) { return store.groupOf(p) === g.id; });
      var messages = data.chats[g.id] || [];
      var last = messages[messages.length - 1];
      var lastAt = bills.reduce(function (m, b) { return Math.max(m, b.createdAt || 0); }, Math.max(g.createdAt || 0, last ? last.at || 0 : 0));
      var lastLine = !last ? ''
        : me && last.personId === me.id ? t('groups.you', { text: lineOf(last, data.groups) })
        : t('groups.said', { name: nameOf(byId[last.personId]), text: lineOf(last, data.groups) });
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
    // Opens LINE's own share screen with the message written; the viewer picks
    // the chat and sends it. Where nothing opens (a pop-up blocker), it falls
    // back to copying.
    function line(text) {
      var w = window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank');
      if (!w) { copy(text); return; }
      try { w.opener = null; } catch (e) { /* the new page is already on its own */ }
    }

    function resetChat() {
      chat.forEach(function (m) { if (m.photoUrl) URL.revokeObjectURL(m.photoUrl); });
      setChat([]);
    }

    var c = {
      data: data, people: people, byId: byId, me: me, friends: friends, lang: lang, go: go, copy: copy, line: line, say: setToast,
      needSignIn: function () { setNeedSignIn(true); },
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
    if (!me) {
      // A new account's profile is being made.
      view = html`<p class="boot">${t('app.loading')}</p>`;
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
    } else if (route.name === 'dm' && byId[route.id]) {
      view = html`<${Dm} key=${route.id} ...${c} person=${byId[route.id]} />`;
    } else if (route.name === 'addFriend') {
      view = html`<${AddFriend} ...${c} />`;
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
    // A new screen slides in (deeper from the right, back from the left, a fade
    // between tabs). Decided once per screen, so updates while it's open don't restart it.
    var screenKey = route.name + ':' + (route.id || '') + ':' + (route.gid || '');
    if (screen.current.key !== screenKey) {
      screen.current = { key: screenKey, route: route, anim: screenAnim(screen.current.route, route) };
    }
    var dmUnread = friends.reduce(function (n, p) { return n + p.dm.unread; }, 0);

    return html`<main class=${'app' + (tab ? ' with-tabs' : '')}>
      ${!data.persistent && html`<p class="banner warn" role="status">${t('app.notSaved')}</p>`}
      ${data.canWrite === false && html`<p class="banner warn" role="status">${t('ro.banner')}</p>`}
      ${data.guest && tab && html`<div class="banner guest" role="status">
        <span>${t('guest.bar')}</span>
        <button class="link" onClick=${function () { go('home', null, null); store.leaveGuest(); }}>${t('guest.signIn')}</button>
      </div>`}
      <div class=${'screen ' + screen.current.anim} key=${screenKey}>${view}</div>
      ${tab && html`<${TabBar} current=${tab} unread=${unread} dmUnread=${dmUnread} go=${go} />`}
      <div class="toast-wrap" aria-live="polite">${toast && html`<div key=${toast} class=${'toast' + (toastLeaving ? ' leaving' : '')}>${toast}</div>`}</div>
      ${copyText && html`<${Sheet} label=${t('copy.manual')} onClose=${function () { setCopyText(''); }} render=${function (close) {
        return html`
          <h2 class="eyebrow">${t('copy.manual')}</h2>
          <textarea id="copy-text" class="field area" readonly rows="8" value=${copyText} onFocus=${function (e) { e.target.select(); }}></textarea>
          <button class="btn" onClick=${close}>${t('common.close')}</button>`;
      }} />`}
      ${needSignIn && html`<${Sheet} label=${t('guest.aiTitle')} onClose=${function () { setNeedSignIn(false); }} render=${function (close) {
        return html`
          <h2 class="row-title">${t('guest.aiTitle')}</h2>
          <p class="muted">${t('guest.aiLead')}</p>
          <button class="btn" onClick=${function () { setNeedSignIn(false); setDraft(null); go('home', null, null); store.leaveGuest(); }}>${t('guest.signIn')}</button>
          <button class="btn ghost" onClick=${close}>${t('guest.notNow')}</button>`;
      }} />`}
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
