import { PAYMENT_WINDOW_MS } from './auction-policy.ts';

export type OfferStatus = 'ready' | 'pending' | 'paid' | 'expired';
export type Offer = {
  id: string;
  lot: number;
  user_id: string;
  amount: number;
  status: OfferStatus;
  created_at: number;
  notified_at: number | null;
  deadline: number | null;
  paid_at: number | null;
  payment_reference: string | null;
  mercado_pago_url: string | null;
  link_disabled_at: number | null;
};

// One maximum bid per participant. All earlier offers stay in the audit history.
export const NEXT_BIDDER_SQL = `
  INSERT OR IGNORE INTO offers (id, lot, user_id, amount, status, created_at)
  SELECT ?, ?, candidate.user_id, candidate.amount, 'ready', ?
  FROM (
    SELECT user_id, amount, created_at, id,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY amount DESC, created_at ASC, id ASC) AS position
    FROM bids WHERE lot = ? AND created_at < ?
  ) AS candidate
  WHERE candidate.position = 1
    AND NOT EXISTS (SELECT 1 FROM offers WHERE lot = ? AND user_id = candidate.user_id)
    AND NOT EXISTS (SELECT 1 FROM offers WHERE lot = ? AND status IN ('ready', 'pending', 'paid'))
  ORDER BY candidate.amount DESC, candidate.created_at ASC, candidate.id ASC
  LIMIT 1
`;

export async function advanceAuction(db: D1Database, lotIds: number[], closesAt: number, now = Date.now()) {
  if (now < closesAt) return;
  // D1 batch is transactional. Conditional updates and unique indexes also make retries safe.
  const statements = [db.prepare(`UPDATE offers SET status = 'expired'
    WHERE status = 'pending' AND deadline <= ?`).bind(now)];
  for (const lot of lotIds) {
    statements.push(db.prepare(NEXT_BIDDER_SQL).bind(
      crypto.randomUUID(), lot, now, lot, closesAt, lot, lot,
    ));
  }
  await db.batch(statements);
}

export async function activateOffer(db: D1Database, id: string, now = Date.now()) {
  // Starts once, after the organizer has sent payment instructions to the bidder.
  return db.prepare(`UPDATE offers SET status = 'pending', notified_at = ?, deadline = ?
    WHERE id = ? AND status = 'ready'`)
    .bind(now, now + PAYMENT_WINDOW_MS, id).run();
}

export async function confirmPayment(db: D1Database, id: string, reference: string, now = Date.now()) {
  return db.prepare(`UPDATE offers SET status = 'paid', paid_at = ?, payment_reference = ?
    WHERE id = ? AND status = 'pending' AND deadline > ?`)
    .bind(now, reference, id, now).run();
}

export function validateMercadoPagoUrl(value: string) {
  if (!value) return null;
  const url = new URL(value);
  const allowed = ['mpago.la', 'www.mercadopago.com.mx', 'mercadopago.com.mx'];
  if (url.protocol !== 'https:' || !allowed.includes(url.hostname) || url.username || url.password) {
    throw new Error('Usa un enlace HTTPS de Mercado Pago México.');
  }
  return url.href;
}
