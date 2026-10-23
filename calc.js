// Money maths for Tab. No DOM, no storage: everything here is a pure function
// over plain bill / payment objects, in whole New Taiwan Dollars.
(function (root) {
  'use strict';

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  // One bill -> what each person who came owes for it.
  // Items are split equally between the people ticked for them; service and tax
  // percentages are both taken on the item subtotal and added together. Everyone
  // but the payer is rounded to the nearest dollar and the payer's own share
  // absorbs the difference, so the shares always add up to what was assigned.
  function billShares(bill) {
    var present = bill.presentIds || [];
    var raw = {};
    var itemIds = {};
    present.forEach(function (id) { raw[id] = 0; itemIds[id] = []; });

    var subtotal = 0;
    var unassigned = 0;
    (bill.items || []).forEach(function (it) {
      var price = num(it.price);
      var sharers = (it.sharerIds || []).filter(function (id) { return present.indexOf(id) !== -1; });
      subtotal += price;
      if (!sharers.length) { unassigned += price; return; }
      sharers.forEach(function (id) {
        raw[id] += price / sharers.length;
        itemIds[id].push(it.id);
      });
    });

    var pct = Math.max(0, num(bill.servicePct)) + Math.max(0, num(bill.taxPct));
    var mult = 1 + pct / 100;
    var total = Math.round(subtotal * mult);
    var assigned = Math.round((subtotal - unassigned) * mult);

    var shares = {};
    var payerHere = present.indexOf(bill.payerId) !== -1;
    var others = 0;
    present.forEach(function (id) {
      if (payerHere && id === bill.payerId) return;
      shares[id] = Math.round(raw[id] * mult);
      others += shares[id];
    });
    if (payerHere) shares[bill.payerId] = assigned - others;

    return {
      subtotal: subtotal,
      mult: mult,
      total: total,
      unassigned: unassigned,
      shares: shares,
      itemIds: itemIds
    };
  }

  // Running balance per person across every bill and recorded payment.
  // Positive = is owed money, negative = owes money.
  function balances(bills, payments) {
    var net = {};
    function add(id, v) { net[id] = (net[id] || 0) + v; }

    (bills || []).forEach(function (bill) {
      if (!bill.payerId || (bill.presentIds || []).indexOf(bill.payerId) === -1) return;
      var sh = billShares(bill).shares;
      Object.keys(sh).forEach(function (id) {
        add(id, 0);
        if (id === bill.payerId) return;
        add(id, -sh[id]);
        add(bill.payerId, sh[id]);
      });
    });

    (payments || []).forEach(function (p) {
      var amount = Math.round(num(p.amount));
      if (!p.fromId || !p.toId || !amount) return;
      add(p.fromId, amount);
      add(p.toId, -amount);
    });

    return net;
  }

  // Fewest practical payments: keep matching the biggest debtor with the
  // biggest creditor until everyone is at zero.
  function settle(net) {
    var debtors = [];
    var creditors = [];
    Object.keys(net || {}).forEach(function (id) {
      var v = Math.round(net[id]);
      if (v < 0) debtors.push({ id: id, v: -v });
      else if (v > 0) creditors.push({ id: id, v: v });
    });
    function biggestFirst(a, b) { return b.v - a.v || (a.id < b.id ? -1 : 1); }

    var out = [];
    while (debtors.length && creditors.length) {
      debtors.sort(biggestFirst);
      creditors.sort(biggestFirst);
      var d = debtors[0];
      var c = creditors[0];
      var amount = Math.min(d.v, c.v);
      out.push({ fromId: d.id, toId: c.id, amount: amount });
      d.v -= amount;
      c.v -= amount;
      if (!d.v) debtors.shift();
      if (!c.v) creditors.shift();
    }
    return out;
  }

  var api = { num: num, billShares: billShares, balances: balances, settle: settle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Tab = root.Tab || {};
  root.Tab.calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
