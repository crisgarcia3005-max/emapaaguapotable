import { Linking } from 'react-native';
import {
  AppNotification, Incident, Invoice, ProcedureRequest, ProcedureType, Sector, WaterQuality,
} from '../types';
import { http } from './http';

// Debe coincidir con los sectores del backend (GET /sectors)
export const sectors: Sector[] = [
  { id: 'centro', name: 'Centro' },
  { id: 'caranqui', name: 'Caranqui' },
  { id: 'azaya', name: 'La Victoria / Azaya' },
  { id: 'priorato', name: 'Priorato' },
  { id: 'yacucalle', name: 'Yacucalle' },
];

export const procedureTypes: ProcedureType[] = [
  { id: 'reclamo', name: 'Reclamo de facturación', description: 'Cobro incorrecto o consumo no reconocido.' },
  { id: 'fuga', name: 'Reporte de fuga', description: 'Fuga visible en vía pública o medidor.' },
  { id: 'nueva', name: 'Nueva conexión', description: 'Solicitud de instalación de servicio.' },
  { id: 'cambio', name: 'Cambio de titular', description: 'Transferencia de la cuenta a otro propietario.' },
  { id: 'medidor', name: 'Revisión de medidor', description: 'Solicitar verificación técnica del medidor.' },
];

export type User = {
  id: string; name: string; cedula: string; accountNumber: string; sectorId: string; role: 'user' | 'admin';
};
type AuthResponse = { token: string; user: User };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const api = {
  login: (id: string, password: string) => http<AuthResponse>('POST', '/auth/login', { id, password }),
  register: (b: { cedula: string; accountNumber: string; password: string; sectorId: string }) =>
    http<AuthResponse>('POST', '/auth/register', b),
  me: () => http<User>('GET', '/me'),
  setSector: (sectorId: string) => http<User>('PUT', '/me/sector', { sectorId }),
  savePushToken: (token: string) => http<void>('POST', '/me/push-token', { token }),

  getQuality: (sectorId: string) => http<WaterQuality>('GET', `/quality/${sectorId}`),
  getIncidents: (sectorId: string) => http<Incident[]>('GET', `/incidents?sectorId=${sectorId}`),
  getInvoices: () => http<Invoice[]>('GET', '/invoices'),

  /**
   * Flujo de pago:
   * 1) el servidor crea el cobro (el monto lo fija el servidor)
   * 2) modo mock: se confirma de inmediato; modo real: se abre la pasarela y se consulta el estado
   */
  async payInvoice(invoiceId: string): Promise<boolean> {
    const c = await http<{ paymentId: string; paymentUrl: string | null; mock: boolean }>(
      'POST', '/payments/checkout', { invoiceId });
    if (c.mock) {
      const r = await http<{ status: string }>('POST', `/payments/${c.paymentId}/mock-confirm`);
      return r.status === 'pagado';
    }
    if (!c.paymentUrl) throw new Error('La pasarela no devolvió una URL de pago');
    await Linking.openURL(c.paymentUrl);
    for (let i = 0; i < 40; i++) { // hasta ~2 min esperando la confirmación
      await sleep(3000);
      const p = await http<{ status: string }>('GET', `/payments/${c.paymentId}`);
      if (p.status === 'pagado') return true;
      if (p.status === 'fallido') return false;
    }
    return false;
  },

  getProcedureRequests: () => http<ProcedureRequest[]>('GET', '/procedures'),
  createProcedure: (typeId: string, detail: string) =>
    http<ProcedureRequest>('POST', '/procedures', { typeId, detail }),

  async getNotifications(_sectorId: string): Promise<AppNotification[]> {
    const l = await http<Omit<AppNotification, 'read'>[]>('GET', '/notifications');
    return l.map((n) => ({ ...n, read: false }));
  },
};
