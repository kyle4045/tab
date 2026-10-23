// Money maths for Tab. No DOM, no storage: everything here is a pure function
// over plain bill / payment objects, in the group's currency. decimals is how
// many places that currency keeps: 0 (NT$, ¥: whole units, the default) or 2
// (US$, €: cents). Sums are kept in whole minor units (cents) so they stay exact.
(function (root) {
  'use strict';

  // 10 ** decimals: how many minor units (cents) make one unit.
  function unit(decimals) { return Math.pow(10, decimals > 0 ? Math.floor(decimals) : 0); }
  // A number rounded to the currency's smallest coin.
  function roundTo(v, decimals) { var f = unit(decimals); return Math.round(num(v) * f) / f; }

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  // One bill -> what each person who came owes for it.
  // Items are split equally between the people ticked for them; service and tax
  // percentages are both taken on the item subtotal and added together. Everyone
  // but the payer is rounded to the currency's smallest coin and the payer's own
  // share absorbs the difference, so the shares always add up to what was assigned.
  function billShares(bill, decimals) {
    var f = unit(decimals);
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
    var total = Math.round(subtotal * mult * f) / f;
    var assigned = Math.round((subtotal - unassigned) * mult * f); // in minor units

    var shares = {};
    var payerHere = present.indexOf(bill.payerId) !== -1;
    var others = 0;
    present.forEach(function (id) {
      if (payerHere && id === bill.payerId) return;
      var s = Math.round(raw[id] * mult * f);
      others += s;
      shares[id] = s / f;
    });
    if (payerHere) shares[bill.payerId] = (assigned - others) / f;

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
  // Positive = is owed money, negative = owes money. Added up in minor units.
  function balances(bills, payments, decimals) {
    var f = unit(decimals);
    var net = {};
    function add(id, v) { net[id] = (net[id] || 0) + Math.round(v * f); }

    (bills || []).forEach(function (bill) {
      if (!bill.payerId || (bill.presentIds || []).indexOf(bill.payerId) === -1) return;
      var sh = billShares(bill, decimals).shares;
      Object.keys(sh).forEach(function (id) {
        add(id, 0);
        if (id === bill.payerId) return;
        add(id, -sh[id]);
        add(bill.payerId, sh[id]);
      });
    });

    (payments || []).forEach(function (p) {
      var amount = roundTo(p.amount, decimals);
      if (!p.fromId || !p.toId || !amount) return;
      add(p.fromId, amount);
      add(p.toId, -amount);
    });

    Object.keys(net).forEach(function (id) { net[id] = net[id] / f; });
    return net;
  }

  // Fewest practical payments: keep matching the biggest debtor with the
  // biggest creditor until everyone is at zero.
  function settle(net, decimals) {
    var f = unit(decimals);
    var debtors = [];
    var creditors = [];
    Object.keys(net || {}).forEach(function (id) {
      var v = Math.round(net[id] * f);
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
      out.push({ fromId: d.id, toId: c.id, amount: amount / f });
      d.v -= amount;
      c.v -= amount;
      if (!d.v) debtors.shift();
      if (!c.v) creditors.shift();
    }
    return out;
  }

  var api = { num: num, roundTo: roundTo, billShares: billShares, balances: balances, settle: settle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Tab = root.Tab || {};
  root.Tab.calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
