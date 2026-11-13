import crypto from 'crypto';
import { Invoice, Payment } from './store';

export const PROVIDER = process.env.PAYMENT_PROVIDER ?? 'mock';
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? '';

export type Checkout = { paymentUrl: string | null };

/**
 * Crea la sesión de cobro en la pasarela.
 * - mock: no hay URL externa; la app confirma con /payments/:id/mock-confirm (solo desarrollo).
 * - payphone: implementar aquí la llamada a la API del proveedor (Cajita/Botón de pagos)
 *   y devolver la URL de pago para abrirla en el navegador del teléfono.
 *   Los datos de tarjeta los captura la pasarela, nunca esta app ni este servidor.
 */
export async function createCheckout(_payment: Payment, _invoice: Invoice): Promise<Checkout> {
  if (PROVIDER === 'mock') return { paymentUrl: null };
  throw new Error(`Proveedor de pago "${PROVIDER}" no implementado`);
}

/** Verifica la firma HMAC-SHA256 (hex) del cuerpo crudo del webhook. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
