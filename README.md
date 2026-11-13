# EMAPA Ibarra – App móvil y panel de administración

Prototipo para la Empresa Municipal de Agua Potable y Alcantarillado de Ibarra.

- **emapa-app/**: app móvil (Expo / React Native). Calidad del agua, cortes y fallas, pagos, trámites y notificaciones por sector.
- **emapa-backend/**: API (Node.js + Express) y panel web de administración en `/panel`.

> Estado: prototipo. Los datos se guardan en memoria (se borran al reiniciar el backend) y los pagos están en modo simulado (`mock`).

## Requisitos

- Node.js 20.12 o superior
- App **Expo Go** en el teléfono, con sesión iniciada en una cuenta de Expo
- PC y teléfono en la misma red Wi-Fi

## 1. Backend

```bat
cd emapa-backend
npm install
copy .env.example .env
```

Edita `.env` y define `JWT_SECRET` (texto largo aleatorio) y `ADMIN_PASSWORD`. Luego:

```bat
npm run dev
```

Debe mostrar `API EMAPA en http://localhost:4000`.

Panel de administración: http://localhost:4000/panel (usuario `admin`, contraseña la de `ADMIN_PASSWORD`).

## 2. App móvil

Averigua la IP de tu PC con `ipconfig` (Dirección IPv4) y ejecuta:

```bat
cd emapa-app
npm install
set EXPO_PUBLIC_API_URL=http://TU-IP:4000
npx expo start -c
```

Escanea el código QR con Expo Go.

Usuario de prueba: cédula `1000000000`, contraseña `demo1234` (sector Centro, cuenta `100001`).

## Qué probar

1. En el panel, publica un corte para el sector **Centro** → debe llegar una notificación al teléfono.
2. En el panel, marca el corte como restablecido → llega el aviso.
3. En **Calidad del agua**, pon cloro `0.05` en Centro → alerta "No apta".
4. En la app, paga una factura (simulado) y envía un trámite; cambia su estado en el panel → llega el aviso.

## Problemas frecuentes

| Problema | Solución |
|---|---|
| "No hay conexión con el servidor" | Revisa la IP en `EXPO_PUBLIC_API_URL`, que el backend esté corriendo y que el firewall de Windows permita Node.js. Prueba abrir `http://TU-IP:4000/sectors` en el navegador del teléfono. |
| "Credenciales incorrectas" en el panel | Una variable `ADMIN_PASSWORD` definida con `set` tiene prioridad sobre `.env`. Abre una ventana nueva de CMD. |
| "El puerto 4000 ya está en uso" | Hay otro backend corriendo: `taskkill /IM node.exe /F`. |
| "You need to be signed in to Expo Go" | Inicia sesión en Expo Go y en la PC (`npx expo login`) con una cuenta que tenga acceso al proyecto. |
| No llegan notificaciones | Acepta el permiso de notificaciones. La terminal de Expo y la del backend muestran mensajes `[push]` con el motivo. |

## Pendiente para producción

- Base de datos (PostgreSQL) en lugar de memoria.
- Pasarela de pago real (PayPhone / Datafast) en `emapa-backend/src/payments.ts`.
- Integración con los sistemas comercial y de monitoreo de EMAPA.
- Despliegue del backend con HTTPS y publicación en App Store / Google Play con EAS.
