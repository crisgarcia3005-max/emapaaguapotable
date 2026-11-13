import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Pide permiso y devuelve el token de Expo Push, o null si no es posible.
 *  Los motivos de fallo se muestran en la terminal de `npx expo start`. */
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[push] Es un simulador: no recibe notificaciones push.');
    return null;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Avisos de EMAPA',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') {
    console.warn('[push] Permiso de notificaciones denegado. Actívalo en Ajustes > Expo Go > Notificaciones.');
    return null;
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] Falta el projectId de EAS. Ejecuta "npx eas-cli@latest init" en emapa-app y reinicia Expo.');
    return null;
  }
  try {
    const t = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('[push] Token obtenido:', t.data);
    return t.data;
  } catch (e: any) {
    console.warn('[push] No se pudo obtener el token:', e?.message ?? e);
    return null;
  }
}
