import { auctionAccess, json, paymentSettings } from '../../../../lib/auction-api';
import { advanceAuction, activateOffer, confirmPayment, validateMercadoPagoUrl, type Offer } from '../../../../lib/auction';
import { lots, closes } from '../../../../lib/catalog';
export const dynamic = 'force-dynamic';
export async function GET() {
  const access = await auctionAccess(undefined, true);
  if (access.response) return access.response;
  await advanceAuction(access.db, lots.map(lot => lot.id), closes);
  const result = await access.db.prepare(`SELECT offers.*, participants.name, participants.email, participants.whatsapp,
    participants.whatsapp_consent FROM offers LEFT JOIN participants ON participants.user_id=offers.user_id
    ORDER BY offers.lot, offers.created_at DESC`).all();
  return json({ offers: result.results, paymentSettings: paymentSettings(), now: Date.now(), closes });
}
export async function POST(request: Request) {
  const access = await auctionAccess(request, true);
  if (access.response) return access.response;
  let data: { action?: string; id?: string; url?: string; reference?: string; confirmed?: boolean };
  try { data = await request.json() as typeof data; } catch { return json({ error: 'Datos inválidos.' }, 400); }
  if (!data || typeof data !== 'object') return json({ error: 'Datos inválidos.' }, 400);
  if (typeof data.id !== 'string') return json({ error: 'Selecciona una oferta.' }, 400);
  await advanceAuction(access.db, lots.map(lot => lot.id), closes);
  const offer = await access.db.prepare('SELECT * FROM offers WHERE id = ?').bind(data.id).first<Offer>();
  if (!offer) return json({ error: 'Oferta no encontrada.' }, 404);
  if (data.action === 'instructions') {
    if (offer.status !== 'ready') return json({ error: 'Las instrucciones ya se enviaron o la oferta terminó.' }, 409);
    try {
      const url = validateMercadoPagoUrl(typeof data.url === 'string' ? data.url : '');
      await access.db.prepare("UPDATE offers SET mercado_pago_url = ? WHERE id = ? AND status = 'ready'").bind(url, offer.id).run();
    } catch { return json({ error: 'Enlace de Mercado Pago inválido.' }, 400); }
    return json({ ok: true });
  }
  if (data.action === 'disable-link') {
    if (offer.status !== 'expired' || data.confirmed !== true) return json({ error: 'Confirma la desactivación del enlace vencido.' }, 400);
    await access.db.prepare("UPDATE offers SET link_disabled_at = ? WHERE id = ? AND status = 'expired'").bind(Date.now(), offer.id).run();
    return json({ ok: true });
  }
  if (data.action === 'notify') {
    const previous = await access.db.prepare("SELECT id FROM offers WHERE lot = ? AND status = 'expired' AND mercado_pago_url IS NOT NULL AND link_disabled_at IS NULL").bind(offer.lot).first();
    if (previous) return json({ error: 'Desactiva en Mercado Pago el enlace del postor anterior y confírmalo en el panel antes de ofrecer esta obra.' }, 409);
    const settings = paymentSettings();
    if (!offer.mercado_pago_url && !(settings.bankAccount && settings.beneficiary)) return json({ error: 'Configura el enlace de Mercado Pago o los datos de transferencia antes de enviar el aviso.' }, 409);
    if (data.confirmed !== true) return json({ error: 'Confirma que ya enviaste el aviso al participante.' }, 400);
    const result = await activateOffer(access.db, offer.id);
    return result.meta.changes ? json({ ok: true }) : json({ error: 'La oferta cambió. Actualiza el panel.' }, 409);
  }
  if (data.action === 'paid') {
    const reference = typeof data.reference === 'string' ? data.reference.trim() : '';
    if (reference.length < 3 || reference.length > 200 || data.confirmed !== true) return json({ error: 'Verifica el abono e indica su referencia.' }, 400);
    const result = await confirmPayment(access.db, offer.id, reference);
    return result.meta.changes ? json({ ok: true }) : json({ error: 'El plazo venció o esta oferta ya fue procesada. Revisa el abono antes de devolver un pago tardío.' }, 409);
  }
  return json({ error: 'Acción no permitida.' }, 400);
}
