import { notifications, newId, users } from './store';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Guarda la notificación y envía push a todos los usuarios de los sectores indicados. */
export async function notifySectors(sectorIds: string[], title: string, body: string) {
  notifications.unshift({
    id: newId('n'),
    sectorIds,
    userId: null,
    title,
    body,
    createdAt: new Date().toISOString(),
  });

  const tokens = users
    .filter((u) => u.role === 'user' && sectorIds.includes(u.sectorId))
    .flatMap((u) => u.pushTokens);
  await sendPush(tokens, title, body);
}

export async function notifyUser(userId: string, title: string, body: string) {
  notifications.unshift({
    id: newId('n'),
    sectorIds: null,
    userId,
    title,
    body,
    createdAt: new Date().toISOString(),
  });
  const u = users.find((x) => x.id === userId);
  if (u) await sendPush(u.pushTokens, title, body);
}

async function sendPush(tokens: string[], title: string, body: string) {
  const valid = [...new Set(tokens)].filter((t) => /^Expo(nent)?PushToken\[.+\]$/.test(t));
  if (valid.length === 0) {
    console.warn(`[push] "${title}": ningún dispositivo registrado para recibirla (0 tokens).`);
    return;
  }
  // Expo permite hasta 100 mensajes por solicitud
  for (let i = 0; i < valid.length; i += 100) {
    const chunk = valid.slice(i, i + 100).map((to) => ({ to, title, body, sound: 'default' }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      const data: any = await res.json().catch(() => null);
      const tickets: any[] = Array.isArray(data?.data) ? data.data : [];
      const errors = tickets.filter((t) => t.status === 'error');
      if (!res.ok || errors.length > 0) {
        console.error(`[push] Expo respondió con errores (HTTP ${res.status}):`, JSON.stringify(errors.length ? errors : data));
      } else {
        console.log(`[push] "${title}" enviada a ${chunk.length} dispositivo(s).`);
      }
    } catch (e) {
      console.error('[push] Error de red enviando a Expo:', e);
    }
  }
}
