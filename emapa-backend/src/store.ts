// Almacén en memoria para desarrollo. Reemplazar por base de datos (PostgreSQL)
// y por integraciones con los sistemas comercial y SCADA de EMAPA.
import bcrypt from 'bcryptjs';

export type Role = 'user' | 'admin';
export type User = {
  id: string;
  cedula: string;
  accountNumber: string;
  name: string;
  passwordHash: string;
  sectorId: string;
  role: Role;
  pushTokens: string[];
};
export type Incident = {
  id: string;
  sectorIds: string[];
  type: 'corte_programado' | 'falla' | 'baja_presion';
  title: string;
  description: string;
  startsAt: string;
  estimatedEnd: string;
  resolved: boolean;
};
export type Invoice = {
  id: string;
  accountNumber: string;
  period: string;
  consumptionM3: number;
  amount: number;
  dueDate: string;
  paid: boolean;
};
export type Payment = {
  id: string;
  invoiceId: string;
  userId: string;
  amount: number;
  status: 'pendiente' | 'pagado' | 'fallido';
  createdAt: string;
};
export type Procedure = {
  id: string;
  userId: string;
  typeId: string;
  typeName: string;
  detail: string;
  createdAt: string;
  status: 'recibido' | 'en_revision' | 'atendido';
};
export type Notification = {
  id: string;
  sectorIds: string[] | null; // null = individual
  userId: string | null;
  title: string;
  body: string;
  createdAt: string;
};
export type Quality = {
  sectorId: string;
  updatedAt: string;
  chlorine: number;
  ph: number;
  turbidity: number;
};

export const sectors = [
  { id: 'centro', name: 'Centro' },
  { id: 'caranqui', name: 'Caranqui' },
  { id: 'azaya', name: 'La Victoria / Azaya' },
  { id: 'priorato', name: 'Priorato' },
  { id: 'yacucalle', name: 'Yacucalle' },
];

export const procedureTypes = [
  { id: 'reclamo', name: 'Reclamo de facturación' },
  { id: 'fuga', name: 'Reporte de fuga' },
  { id: 'nueva', name: 'Nueva conexión' },
  { id: 'cambio', name: 'Cambio de titular' },
  { id: 'medidor', name: 'Revisión de medidor' },
];

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

export const users: User[] = [];
export const incidents: Incident[] = [];
export const payments: Payment[] = [];
export const procedures: Procedure[] = [];
export const notifications: Notification[] = [];

// Registros del sistema comercial (clientes válidos para registrarse)
export const customerRecords = [
  { cedula: '1000000000', accountNumber: '100001', name: 'Usuario Demo' },
];

export const invoices: Invoice[] = [
  { id: 'f-100001-2026-10', accountNumber: '100001', period: 'Octubre 2026', consumptionM3: 18, amount: 12.4, dueDate: hoursFromNow(240), paid: false },
  { id: 'f-100001-2026-09', accountNumber: '100001', period: 'Septiembre 2026', consumptionM3: 21, amount: 14.9, dueDate: hoursFromNow(-480), paid: true },
];

export const quality: Record<string, Quality> = Object.fromEntries(
  sectors.map((s, i) => [
    s.id,
    {
      sectorId: s.id,
      updatedAt: new Date().toISOString(),
      chlorine: [0.8, 0.6, 0.25, 1.0, 0.7][i],
      ph: [7.2, 7.4, 7.0, 7.6, 7.3][i],
      turbidity: [0.8, 1.1, 3.9, 0.6, 1.0][i],
    },
  ])
);

export function seed(adminPassword: string) {
  users.push({
    id: 'u-admin',
    cedula: 'admin',
    accountNumber: '',
    name: 'Administrador EMAPA',
    passwordHash: bcrypt.hashSync(adminPassword, 10),
    sectorId: 'centro',
    role: 'admin',
    pushTokens: [],
  });
  users.push({
    id: 'u-demo',
    cedula: '1000000000',
    accountNumber: '100001',
    name: 'Usuario Demo',
    passwordHash: bcrypt.hashSync('demo1234', 10),
    sectorId: 'centro',
    role: 'user',
    pushTokens: [],
  });
}

export const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function qualityStatus(q: Quality): 'apta' | 'precaucion' | 'no_apta' {
  if (q.chlorine < 0.1 || q.chlorine > 2 || q.ph < 6 || q.ph > 9 || q.turbidity > 5) return 'no_apta';
  if (q.chlorine < 0.3 || q.chlorine > 1.5 || q.ph < 6.5 || q.ph > 8.5 || q.turbidity > 3) return 'precaucion';
  return 'apta';
}
