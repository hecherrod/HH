import { auctionAccess, json, paymentSettings } from '../../../../lib/auction-api';
import { advanceAuction } from '../../../../lib/auction';
import { lots, closes } from '../../../../lib/catalog';
export const dynamic = 'force-dynamic';
export async function GET() {
  const access = await auctionAccess();
  if (access.response) return access.response;
  await advanceAuction(access.db, lots.map(lot => lot.id), closes);
  const result = await access.db.prepare('SELECT * FROM offers WHERE user_id = ? ORDER BY created_at DESC').bind(access.user.userId).all();
  // Expired instructions must never remain payable from this app.
  const offers = result.results.map(row => ({ ...row, mercado_pago_url: row.status === 'pending' ? row.mercado_pago_url : null }));
  return json({ offers, paymentSettings: paymentSettings(), now: Date.now(), mode: 'trial' });
}
