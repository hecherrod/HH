import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function auctionAccess(request?: Request, admin = false) {
  if (request && request.headers.get('origin') !== new URL(request.url).origin) {
    return { response: json({ error: 'Solicitud no permitida.' }, 403) };
  }
  const user = await getChatGPTUser();
  if (!user) return { response: json({ error: 'Inicia sesión para continuar.' }, 401) };
  if (admin && user.email.toLowerCase() !== env.AUCTION_ADMIN_EMAIL?.toLowerCase()) {
    return { response: json({ error: 'Acceso reservado a la organización.' }, 403) };
  }
  return { user, db: env.DB! };
}

export function paymentSettings() {
  return {
    bankName: env.AUCTION_BANK_NAME || '',
    bankAccount: env.AUCTION_BANK_CLABE || '',
    beneficiary: env.AUCTION_BANK_BENEFICIARY || '',
  };
}
