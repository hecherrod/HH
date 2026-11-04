import { env } from 'cloudflare:workers';
import { advanceAuction } from '../../../../lib/auction';
import { json } from '../../../../lib/auction-api';
import { lots, closes } from '../../../../lib/catalog';
export const dynamic = 'force-dynamic';
export async function POST() {
  // Enabled only for this owner-private Site. Sites dispatch authenticates service requests.
  // Disable before making the Site public and replace with a scoped service credential.
  if (env.AUCTION_PRIVATE_UPDATER !== 'enabled') return json({ error: 'Actualizador no disponible.' }, 403);
  await advanceAuction(env.DB!, lots.map(lot => lot.id), closes);
  return json({ ok: true, checkedAt: Date.now() });
}
