import crypto from 'crypto';
import path from 'path';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { createCheckout, PROVIDER, verifyWebhookSignature } from './payments';
import { notifySectors, notifyUser } from './push';
import {
  customerRecords, incidents, invoices, newId, notifications, payments, procedures,
  procedureTypes, quality, qualityStatus, sectors, seed, users, User,
} from './store';

// Carga emapa-backend/.env si existe (Node 20.12+). No reemplaza variables ya definidas.
try {
  (process as any).loadEnvFile?.(path.join(__dirname, '..', '.env'));
} catch {
  // sin archivo .env: se usan las variables del sistema
}

// .trim(): en CMD, "set VAR=valor " guarda también los espacios finales
const envJwt = process.env.JWT_SECRET?.trim();
const envAdmin = process.env.ADMIN_PASSWORD?.trim();
const JWT_SECRET = envJwt || crypto.randomBytes(32).toString('hex');
if (!envJwt) console.warn('[aviso] JWT_SECRET no definido: se usa uno temporal (las sesiones se pierden al reiniciar).');
const ADMIN_PASSWORD = envAdmin || crypto.randomBytes(9).toString('base64url');
if (!envAdmin) console.warn(`[aviso] ADMIN_PASSWORD no definido. Contraseña temporal del admin: ${ADMIN_PASSWORD}`);
else console.log(`[ok] Contraseña de admin configurada (${ADMIN_PASSWORD.length} caracteres). Usuario: admin`);
seed(ADMIN_PASSWORD);

type AuthedRequest = Request & { user: User };
const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb', verify: (req, _res, buf) => { (req as any).rawBody = buf; } }));

// ---------- utilidades ----------
const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<unknown> | unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req as AuthedRequest, res)).catch(next);

const auth = (adminOnly = false) => (req: Request, res: Response, next: NextFunction) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' });
  try {
    const p = jwt.verify(h.slice(7), JWT_SECRET) as { sub: string };
    const u = users.find((x) => x.id === p.sub);
    if (!u) return res.status(401).json({ error: 'Sesión inválida' });
    if (adminOnly && u.role !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
    (req as AuthedRequest).user = u;
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
};

// Limitador simple de intentos de login por IP (15 intentos / 15 min)
const attempts = new Map<string, { n: number; reset: number }>();
const loginLimiter = (req: Request, res: Response, next: NextFunction) => {
  const k = req.ip ?? 'x';
  const now = Date.now();
  const a = attempts.get(k);
  if (!a || a.reset < now) attempts.set(k, { n: 1, reset: now + 15 * 60_000 });
  else if (++a.n > 15) return res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' });
  next();
};

const publicUser = (u: User) => ({
  id: u.id, name: u.name, cedula: u.cedula, accountNumber: u.accountNumber, sectorId: u.sectorId, role: u.role,
});
const sign = (u: User) => jwt.sign({ sub: u.id }, JWT_SECRET, { expiresIn: '7d' });
const parse = <T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> => schema.parse(data);

// ---------- panel web de administración (archivos estáticos) ----------
app.use('/panel', express.static(path.join(__dirname, '..', 'public')));
app.get('/', (_req, res) => res.redirect('/panel'));

// ---------- autenticación ----------
app.post('/auth/register', loginLimiter, wrap(async (req, res) => {
  const b = parse(z.object({
    cedula: z.string().regex(/^\d{10}$/),
    accountNumber: z.string().min(3).max(20),
    password: z.string().min(8).max(72),
    sectorId: z.string(),
  }), req.body);
  if (!sectors.some((s) => s.id === b.sectorId)) return res.status(400).json({ error: 'Sector inválido' });
  const rec = customerRecords.find((c) => c.cedula === b.cedula && c.accountNumber === b.accountNumber);
  if (!rec) return res.status(404).json({ error: 'No encontramos un cliente con esos datos' });
  if (users.some((u) => u.cedula === b.cedula)) return res.status(409).json({ error: 'Ya existe una cuenta' });
  const u: User = {
    id: newId('u'), cedula: b.cedula, accountNumber: b.accountNumber, name: rec.name,
    passwordHash: await bcrypt.hash(b.password, 10), sectorId: b.sectorId, role: 'user', pushTokens: [],
  };
  users.push(u);
  res.status(201).json({ token: sign(u), user: publicUser(u) });
}));

app.post('/auth/login', loginLimiter, wrap(async (req, res) => {
  const b = parse(z.object({ id: z.string().min(1).max(20), password: z.string().min(1).max(72) }), req.body);
  const u = users.find((x) => x.cedula === b.id);
  const ok = u ? await bcrypt.compare(b.password, u.passwordHash) : false;
  if (!u || !ok) return res.status(401).json({ error: 'Credenciales incorrectas' });
  res.json({ token: sign(u), user: publicUser(u) });
}));

// ---------- público ----------
app.get('/sectors', (_req, res) => res.json(sectors));
app.get('/procedure-types', (_req, res) => res.json(procedureTypes));

// ---------- usuario ----------
app.get('/me', auth(), (req, res) => res.json(publicUser((req as AuthedRequest).user)));

app.put('/me/sector', auth(), wrap((req, res) => {
  const { sectorId } = parse(z.object({ sectorId: z.string() }), req.body);
  if (!sectors.some((s) => s.id === sectorId)) return res.status(400).json({ error: 'Sector inválido' });
  req.user.sectorId = sectorId;
  res.json(publicUser(req.user));
}));

app.post('/me/push-token', auth(), wrap((req, res) => {
  const { token } = parse(z.object({ token: z.string().max(200) }), req.body);
  // Un token pertenece a un solo usuario (por si cambian de cuenta en el mismo teléfono)
  users.forEach((u) => { u.pushTokens = u.pushTokens.filter((t) => t !== token); });
  req.user.pushTokens.push(token);
  console.log(`[push] Dispositivo registrado para ${req.user.name} (sector ${req.user.sectorId}).`);
  res.status(204).end();
}));

app.get('/quality/:sectorId', auth(), (req, res) => {
  const q = quality[req.params.sectorId];
  if (!q) return res.status(404).json({ error: 'Sector no encontrado' });
  res.json({ ...q, status: qualityStatus(q) });
});

app.get('/incidents', auth(), (req, res) => {
  const sectorId = String(req.query.sectorId ?? (req as AuthedRequest).user.sectorId);
  res.json(incidents.filter((i) => !i.resolved && i.sectorIds.includes(sectorId)));
});

app.get('/notifications', auth(), (req, res) => {
  const u = (req as AuthedRequest).user;
  res.json(notifications.filter((n) => n.userId === u.id || n.sectorIds?.includes(u.sectorId)).slice(0, 100));
});

// ---------- facturas y pagos ----------
app.get('/invoices', auth(), (req, res) => {
  const u = (req as AuthedRequest).user;
  res.json(invoices.filter((f) => f.accountNumber === u.accountNumber));
});

app.post('/payments/checkout', auth(), wrap(async (req, res) => {
  const { invoiceId } = parse(z.object({ invoiceId: z.string() }), req.body);
  const inv = invoices.find((f) => f.id === invoiceId && f.accountNumber === req.user.accountNumber);
  if (!inv) return res.status(404).json({ error: 'Factura no encontrada' });
  if (inv.paid) return res.status(409).json({ error: 'La factura ya está pagada' });
  // El monto lo define el servidor, nunca el cliente
  const p = { id: newId('p'), invoiceId: inv.id, userId: req.user.id, amount: inv.amount, status: 'pendiente' as const, createdAt: new Date().toISOString() };
  payments.push(p);
  const c = await createCheckout(p, inv);
  res.status(201).json({ paymentId: p.id, amount: p.amount, paymentUrl: c.paymentUrl, mock: PROVIDER === 'mock' });
}));

async function settle(paymentId: string, success: boolean) {
  const p = payments.find((x) => x.id === paymentId);
  if (!p || p.status !== 'pendiente') return p;
  p.status = success ? 'pagado' : 'fallido';
  if (success) {
    const inv = invoices.find((f) => f.id === p.invoiceId);
    if (inv) inv.paid = true;
    await notifyUser(p.userId, 'Pago recibido', `Tu pago de $${p.amount.toFixed(2)} fue registrado.`);
  }
  return p;
}

// Confirmación real: la pasarela llama aquí con firma HMAC
app.post('/payments/webhook', wrap(async (req, res) => {
  const raw = (req as any).rawBody as Buffer | undefined;
  if (!raw || !verifyWebhookSignature(raw, req.headers['x-signature'] as string | undefined)) {
    return res.status(401).json({ error: 'Firma inválida' });
  }
  const b = parse(z.object({ paymentId: z.string(), status: z.enum(['approved', 'rejected']) }), req.body);
  await settle(b.paymentId, b.status === 'approved');
  res.status(204).end();
}));

// Solo desarrollo: simula la aprobación de la pasarela
app.post('/payments/:id/mock-confirm', auth(), wrap(async (req, res) => {
  if (PROVIDER !== 'mock') return res.status(404).end();
  const p = payments.find((x) => x.id === req.params.id && x.userId === req.user.id);
  if (!p) return res.status(404).json({ error: 'Pago no encontrado' });
  await settle(p.id, true);
  res.json({ status: p.status });
}));

app.get('/payments/:id', auth(), (req, res) => {
  const p = payments.find((x) => x.id === req.params.id && x.userId === (req as AuthedRequest).user.id);
  if (!p) return res.status(404).json({ error: 'Pago no encontrado' });
  res.json(p);
});

// ---------- trámites ----------
app.get('/procedures', auth(), (req, res) =>
  res.json(procedures.filter((p) => p.userId === (req as AuthedRequest).user.id)));

app.post('/procedures', auth(), wrap((req, res) => {
  const b = parse(z.object({ typeId: z.string(), detail: z.string().min(10).max(1000) }), req.body);
  const t = procedureTypes.find((x) => x.id === b.typeId);
  if (!t) return res.status(400).json({ error: 'Tipo de trámite inválido' });
  const p = {
    id: `T-${Math.floor(Math.random() * 90000 + 10000)}`, userId: req.user.id, typeId: t.id,
    typeName: t.name, detail: b.detail, createdAt: new Date().toISOString(), status: 'recibido' as const,
  };
  procedures.unshift(p);
  res.status(201).json(p);
}));

// ---------- administración ----------
app.post('/admin/incidents', auth(true), wrap(async (req, res) => {
  const b = parse(z.object({
    sectorIds: z.array(z.string()).min(1),
    type: z.enum(['corte_programado', 'falla', 'baja_presion']),
    title: z.string().min(3).max(100),
    description: z.string().max(500),
    startsAt: z.string().datetime(),
    estimatedEnd: z.string().datetime(),
  }), req.body);
  if (b.sectorIds.some((s) => !sectors.some((x) => x.id === s))) return res.status(400).json({ error: 'Sector inválido' });
  const inc = { id: newId('i'), ...b, resolved: false };
  incidents.push(inc);
  await notifySectors(b.sectorIds, b.title, b.description);
  res.status(201).json(inc);
}));

app.post('/admin/incidents/:id/resolve', auth(true), wrap(async (req, res) => {
  const inc = incidents.find((i) => i.id === req.params.id);
  if (!inc) return res.status(404).json({ error: 'No encontrado' });
  inc.resolved = true;
  await notifySectors(inc.sectorIds, 'Servicio restablecido', `${inc.title}: el servicio fue restablecido.`);
  res.json(inc);
}));

app.put('/admin/quality/:sectorId', auth(true), wrap(async (req, res) => {
  const b = parse(z.object({ chlorine: z.number(), ph: z.number(), turbidity: z.number() }), req.body);
  if (!quality[req.params.sectorId]) return res.status(404).json({ error: 'Sector no encontrado' });
  quality[req.params.sectorId] = { sectorId: req.params.sectorId, updatedAt: new Date().toISOString(), ...b };
  const q = quality[req.params.sectorId];
  if (qualityStatus(q) === 'no_apta') {
    await notifySectors([q.sectorId], 'Alerta de calidad del agua', 'Se detectaron valores fuera de norma. No consumas el agua hasta nuevo aviso.');
  }
  res.json({ ...q, status: qualityStatus(q) });
}));

app.get('/admin/incidents', auth(true), (_req, res) =>
  res.json([...incidents].sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.startsAt.localeCompare(a.startsAt))));

app.get('/admin/quality', auth(true), (_req, res) =>
  res.json(Object.values(quality).map((q) => ({ ...q, status: qualityStatus(q) }))));

app.get('/admin/procedures', auth(true), (_req, res) =>
  res.json(procedures.map((p) => {
    const u = users.find((x) => x.id === p.userId);
    return { ...p, userName: u?.name ?? '', cedula: u?.cedula ?? '', accountNumber: u?.accountNumber ?? '' };
  })));

app.get('/admin/stats', auth(true), (_req, res) => res.json({
  users: users.filter((u) => u.role === 'user').length,
  withPush: users.filter((u) => u.role === 'user' && u.pushTokens.length > 0).length,
  activeIncidents: incidents.filter((i) => !i.resolved).length,
  pendingProcedures: procedures.filter((p) => p.status !== 'atendido').length,
  paidToday: payments.filter((p) => p.status === 'pagado' && p.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10))
    .reduce((s, p) => s + p.amount, 0),
}));

app.patch('/admin/procedures/:id', auth(true), wrap(async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['recibido', 'en_revision', 'atendido']) }), req.body);
  const p = procedures.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  p.status = status;
  await notifyUser(p.userId, 'Actualización de trámite', `Tu trámite ${p.id} ahora está: ${status.replace('_', ' ')}.`);
  res.json(p);
}));

// ---------- errores ----------
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: 'Datos inválidos', details: err.flatten().fieldErrors });
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => console.log(`API EMAPA en http://localhost:${port} (pagos: ${PROVIDER})`));
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERROR] El puerto ${port} ya está en uso: hay otro backend corriendo (probablemente uno viejo).`);
    console.error(`Ciérralo con:  netstat -ano | findstr :${port}   y luego   taskkill /PID <número> /F\n`);
    process.exit(1);
  }
  throw err;
});
