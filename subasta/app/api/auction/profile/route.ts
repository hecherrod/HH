import { auctionAccess, json } from '../../../../lib/auction-api';
export const dynamic = 'force-dynamic';
export async function GET() {
  const access = await auctionAccess();
  if (access.response) return access.response;
  const profile = await access.db.prepare('SELECT name, email, whatsapp, whatsapp_consent FROM participants WHERE user_id = ?').bind(access.user.userId).first();
  return json({ profile, accountEmail: access.user.email });
}
export async function POST(request: Request) {
  const access = await auctionAccess(request);
  if (access.response) return access.response;
  let data: { name?: string; email?: string; whatsapp?: string; consent?: boolean; accepted?: boolean };
  try { data = await request.json() as typeof data; } catch { return json({ error: 'Datos inválidos.' }, 400); }
  if (!data || typeof data !== 'object') return json({ error: 'Datos inválidos.' }, 400);
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const whatsapp = typeof data.whatsapp === 'string' ? data.whatsapp.replace(/[\s()-]/g, '') : '';
  if (name.length < 2 || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+[1-9]\d{7,14}$/.test(whatsapp) || data.accepted !== true) {
    return json({ error: 'Completa nombre, correo, WhatsApp con código de país y acepta las condiciones.' }, 400);
  }
  await access.db.prepare(`INSERT INTO participants (user_id, name, email, whatsapp, whatsapp_consent, accepted_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name, email=excluded.email,
    whatsapp=excluded.whatsapp, whatsapp_consent=excluded.whatsapp_consent, accepted_at=excluded.accepted_at`)
    .bind(access.user.userId, name, email, whatsapp, data.consent === true ? 1 : 0, Date.now()).run();
  return json({ ok: true });
}
