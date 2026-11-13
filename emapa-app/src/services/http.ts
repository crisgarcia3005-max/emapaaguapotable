import * as SecureStore from 'expo-secure-store';

// En un teléfono físico usa la IP de tu PC en la red local, p. ej. http://192.168.1.10:4000
// Define EXPO_PUBLIC_API_URL antes de ejecutar `npx expo start`. En producción debe ser HTTPS.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';

const TOKEN_KEY = 'emapa_token';
let token: string | null = null;

export const session = {
  async load() {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
    return token;
  },
  async set(t: string) {
    token = t;
    await SecureStore.setItemAsync(TOKEN_KEY, t);
  },
  async clear() {
    token = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

let onUnauthorized: (() => void) | null = null;
export const setOnUnauthorized = (fn: () => void) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function http<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor. Revisa tu internet.', 0);
  }
  if (res.status === 401 && token && !path.startsWith('/auth/')) onUnauthorized?.();
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as any).error ?? 'Error del servidor', res.status);
  return data as T;
}
