import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { lots, closes } from '../../../lib/catalog';
import { advanceAuction } from '../../../lib/auction';
import { json } from '../../../lib/auction-api';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getChatGPTUser();
    const db = env.DB!;
    await advanceAuction(db, lots.map(lot => lot.id), closes);
    const result = await db.prepare('SELECT lot, MAX(amount) AS amount, COUNT(*) AS count FROM bids GROUP BY lot').all();
    const mine = user ? await db.prepare('SELECT lot, MAX(amount) AS amount FROM bids WHERE user_id=? GROUP BY lot').bind(user.userId).all() : { results: [] };
    const profile = user ? await db.prepare('SELECT user_id FROM participants WHERE user_id = ?').bind(user.userId).first() : null;
    return json({
      bids: result.results, mine: mine.results, profileComplete: !!profile,
      user: user ? { name: user.displayName } : null,
      isAdmin: !!user && user.email.toLowerCase() === env.AUCTION_ADMIN_EMAIL?.toLowerCase(),
      now: Date.now(),
    });
  } catch {
    return json({ error: 'No pudimos consultar las pujas. Intenta nuevamente.' }, 503);
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Solicitud no permitida.' }, 403);
    const user = await getChatGPTUser();
    if (!user) return json({ error: 'Inicia sesión para realizar una puja.' }, 401);
    const data = await request.json() as { lot?: number; amount?: number } | null;
    const lot = data?.lot;
    const amount = data?.amount;
    const item = lots.find(item => item.id === lot);
    if (!item || typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount > 100000000 || amount < item.base + 500) {
      return json({ error: 'Ingresa un monto válido. El incremento mínimo es de $500 MXN.' }, 400);
    }
    const profile = await env.DB!.prepare('SELECT user_id FROM participants WHERE user_id = ?').bind(user.userId).first();
    if (!profile) return json({ error: 'Completa tu correo y WhatsApp en Mi cuenta antes de pujar. La participación es sin depósito.' }, 409);
    const now = Date.now();
    if (now >= closes) return json({ error: 'Esta subasta ha finalizado.' }, 409);
    const result = await env.DB!.prepare(`INSERT INTO bids (id, lot, amount, user_id, created_at)
      SELECT ?, ?, ?, ?, ? WHERE ? >= COALESCE((SELECT MAX(amount) FROM bids WHERE lot=?), ?)+500 AND ? < ?`)
      .bind(crypto.randomUUID(), lot, amount, user.userId, now, amount, lot, item.base, now, closes).run();
    if (!result.meta.changes) return json({ error: 'La oferta cambió. Actualizamos el monto; intenta con una puja mayor.' }, 409);
    return json({ ok: true });
  } catch {
    return json({ error: 'No se pudo guardar la puja. Intenta nuevamente.' }, 503);
  }
}
