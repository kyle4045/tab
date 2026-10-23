// Checks the money maths in calc.js: whole units (NT$, ¥) exactly as before,
// and cents (US$, €) without float noise. Runs with the rules tests: npm --prefix tests test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const Calc = createRequire(import.meta.url)('../calc.js');
const it = (price, ids) => ({ id: String(price) + ids.join(''), price, sharerIds: ids });
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
// No more than two decimals, and no 0.30000000000000004.
const tidy = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9;

test('whole units: the Hotpot night bill splits exactly as it always has', () => {
  const all = ['me', 'mei', 'arjun', 'dana'];
  const bill = {
    payerId: 'mei', presentIds: all, servicePct: 10,
    items: [it(400, all), it(720, ['me', 'mei', 'arjun']), it(640, ['mei', 'dana']), it(240, all), it(360, ['me', 'arjun', 'dana'])]
  };
  for (const sh of [Calc.billShares(bill), Calc.billShares(bill, 0)]) {
    assert.equal(sh.total, 2596);
    assert.deepEqual(sh.shares, { me: 572, mei: 792, arjun: 572, dana: 660 });
  }
});

test('whole units: balances and settling are unchanged', () => {
  const bills = [{ payerId: 'a', presentIds: ['a', 'b', 'c'], items: [it(1000, ['a', 'b', 'c'])] }];
  const payments = [{ fromId: 'b', toId: 'a', amount: 333 }];
  const net = Calc.balances(bills, payments);
  assert.deepEqual(net, { a: 333, b: 0, c: -333 });
  assert.deepEqual(Calc.settle(net), [{ fromId: 'c', toId: 'a', amount: 333 }]);
});

test('cents: US$10.00 three ways is 3.33, 3.33 and the payer 3.34', () => {
  const sh = Calc.billShares({ payerId: 'a', presentIds: ['a', 'b', 'c'], items: [it(10, ['a', 'b', 'c'])] }, 2);
  assert.equal(sh.total, 10);
  assert.deepEqual(sh.shares, { a: 3.34, b: 3.33, c: 3.33 });
});

test('cents: service and tax round to the cent, and shares add up to the total', () => {
  const bill = {
    payerId: 'a', presentIds: ['a', 'b', 'c'], servicePct: 10, taxPct: 5,
    items: [it(12.99, ['a', 'b']), it(0.1, ['a', 'b', 'c']), it(0.2, ['c']), it(7.35, ['b', 'c'])]
  };
  const sh = Calc.billShares(bill, 2);
  assert.ok(tidy(sh.total), 'total ' + sh.total);
  Object.values(sh.shares).forEach((v) => assert.ok(tidy(v), 'share ' + v));
  assert.equal(Math.round(sum(sh.shares) * 100), Math.round(sh.total * 100));
  assert.equal(sh.total, 23.74); // (12.99 + 0.1 + 0.2 + 7.35) * 1.15 = 23.736
});

test('cents: balances and the settle-up plan stay exact', () => {
  const bills = [
    { payerId: 'a', presentIds: ['a', 'b', 'c'], items: [it(10, ['a', 'b', 'c'])] },
    { payerId: 'b', presentIds: ['a', 'b', 'c'], items: [it(0.1, ['a', 'c']), it(0.2, ['a', 'b', 'c'])] }
  ];
  const payments = [{ fromId: 'c', toId: 'a', amount: 1.1 }];
  const net = Calc.balances(bills, payments, 2);
  Object.values(net).forEach((v) => assert.ok(tidy(v), 'balance ' + v));
  assert.equal(Math.round(sum(net) * 100), 0);
  const plan = Calc.settle(net, 2);
  plan.forEach((p) => assert.ok(tidy(p.amount) && p.amount > 0, 'payment ' + p.amount));
  // Paying the plan leaves everyone at zero.
  const after = Object.assign({}, net);
  plan.forEach((p) => { after[p.fromId] += p.amount; after[p.toId] -= p.amount; });
  Object.values(after).forEach((v) => assert.equal(Math.round(v * 100), 0));
});

test('roundTo rounds to the smallest coin', () => {
  assert.equal(Calc.roundTo('12.345', 2), 12.35);
  assert.equal(Calc.roundTo('12.5', 0), 13);
  assert.equal(Calc.roundTo(0.1 + 0.2, 2), 0.3);
});
