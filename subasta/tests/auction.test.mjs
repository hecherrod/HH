import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { advanceAuction, activateOffer, confirmPayment, validateMercadoPagoUrl } from '../lib/auction.ts';
import { PAYMENT_WINDOW_MS } from '../lib/auction-policy.ts';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_needy_ronan.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../drizzle/0001_youthful_nova.sql', import.meta.url), 'utf8'));
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async run() { const result = statement.run(...values); return { meta: { changes: Number(result.changes) } }; },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const bid = (id, user, amount, created = 1, lot = 1) => sqlite.prepare('INSERT INTO bids VALUES (?, ?, ?, ?, ?)').run(id, lot, amount, user, created);
  const rows = () => sqlite.prepare('SELECT * FROM offers ORDER BY created_at, rowid').all();
  return { db, sqlite, bid, rows };
}

test('the next bidder is distinct and pays their own highest bid', async () => {
  const { db, bid, rows } = fixture();
  bid('a1', 'winner', 12000); bid('a2', 'winner', 15000); bid('b1', 'runner', 11000); bid('c1', 'third', 9000);
  await advanceAuction(db, [1], 100, 99);
  assert.equal(rows().length, 0);
  await advanceAuction(db, [1], 100, 100);
  const first = rows()[0];
  assert.equal(first.user_id, 'winner');
  assert.equal(first.amount, 15000);
  assert.equal(first.deadline, null);
  await activateOffer(db, first.id, 200);
  assert.equal(rows()[0].deadline, 200 + PAYMENT_WINDOW_MS);
  assert.equal((await activateOffer(db, first.id, 300)).meta.changes, 0);
  await advanceAuction(db, [1], 100, 199 + PAYMENT_WINDOW_MS);
  assert.equal(rows().length, 1);
  await advanceAuction(db, [1], 100, 200 + PAYMENT_WINDOW_MS);
  assert.equal(rows()[0].status, 'expired');
  assert.equal(rows()[1].user_id, 'runner');
  assert.equal(rows()[1].amount, 11000);
  await advanceAuction(db, [1], 100, 201 + PAYMENT_WINDOW_MS);
  assert.equal(rows().length, 2);
});

test('a confirmed payment prevents reallocation and late payments cannot confirm', async () => {
  const { db, bid, rows } = fixture();
  bid('a', 'winner', 15000); bid('b', 'runner', 10000);
  await advanceAuction(db, [1], 100, 100);
  const id = rows()[0].id;
  await activateOffer(db, id, 200);
  assert.equal((await confirmPayment(db, id, 'bank-123', 200 + PAYMENT_WINDOW_MS)).meta.changes, 0);
  assert.equal((await confirmPayment(db, id, 'bank-123', 199 + PAYMENT_WINDOW_MS)).meta.changes, 1);
  await advanceAuction(db, [1], 100, 201 + PAYMENT_WINDOW_MS);
  assert.equal(rows().length, 1);
  assert.equal(rows()[0].status, 'paid');
  assert.equal((await confirmPayment(db, id, 'duplicate', 202 + PAYMENT_WINDOW_MS)).meta.changes, 0);
});

test('exhausted lots remain unawarded and other lots proceed independently', async () => {
  const { db, bid, rows } = fixture();
  bid('one', 'a', 9000); bid('two', 'a', 7000, 1, 2);
  await advanceAuction(db, [1, 2, 3], 100, 100);
  assert.equal(rows().length, 2);
  const first = rows().find(row => row.lot === 1);
  await activateOffer(db, first.id, 200);
  await advanceAuction(db, [1, 2, 3], 100, 200 + PAYMENT_WINDOW_MS);
  assert.equal(rows().filter(row => row.lot === 1).length, 1);
  assert.equal(rows().find(row => row.lot === 2).status, 'ready');
  await advanceAuction(db, [1, 2, 3], 100, 201 + PAYMENT_WINDOW_MS);
  assert.equal(rows().length, 2);
});

test('deterministic ranking excludes bids after close and prevents duplicate active awards', async () => {
  const { db, sqlite, bid, rows } = fixture();
  bid('earlier', 'a', 10000, 1); bid('later', 'b', 10000, 2); bid('late', 'c', 99999, 101);
  await advanceAuction(db, [1], 100, 100);
  await advanceAuction(db, [1], 100, 101);
  assert.equal(rows()[0].user_id, 'a');
  assert.equal(rows().length, 1);
  assert.throws(() => sqlite.prepare("INSERT INTO offers (id, lot, user_id, amount, status, created_at) VALUES ('duplicate', 1, 'b', 9000, 'ready', 10)").run());
});

test('only supported Mercado Pago HTTPS hosts are accepted', () => {
  assert.equal(validateMercadoPagoUrl('https://mpago.la/example'), 'https://mpago.la/example');
  assert.equal(validateMercadoPagoUrl(''), null);
  for (const url of ['javascript:alert(1)', 'https://mpago.la.evil.test/a', 'http://mpago.la/a', 'https://name:pass@mpago.la/a']) {
    assert.throws(() => validateMercadoPagoUrl(url));
  }
});
