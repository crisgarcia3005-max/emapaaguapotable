import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Button } from '../components/ui';
import { useApp } from '../context/AppContext';
import { sectors } from '../services/api';
import { colors } from '../theme';

export default function LoginScreen() {
  const { login, register } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [cedula, setCedula] = useState('');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [sectorId, setSectorId] = useState(sectors[0].id);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (mode === 'register') {
      if (!/^\d{10}$/.test(cedula)) return Alert.alert('Cédula inválida', 'Debe tener 10 dígitos.');
      if (account.trim().length < 3) return Alert.alert('Falta dato', 'Ingresa tu número de cuenta.');
      if (password.length < 8) return Alert.alert('Contraseña corta', 'Usa al menos 8 caracteres.');
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(cedula.trim(), password);
      else await register({ cedula: cedula.trim(), accountNumber: account.trim(), password, sectorId });
    } catch (e: any) {
      Alert.alert('No se pudo continuar', e.message ?? 'Intenta nuevamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.c} keyboardShouldPersistTaps="handled">
        <Text style={st.logo}>EMAPA Ibarra</Text>
        <Text style={st.sub}>{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</Text>

        <TextInput style={st.input} placeholder="Cédula" keyboardType="number-pad" maxLength={10}
          value={cedula} onChangeText={setCedula} accessibilityLabel="Cédula" />
        {mode === 'register' && (
          <>
            <TextInput style={st.input} placeholder="Número de cuenta (ver en tu factura)"
              value={account} onChangeText={setAccount} accessibilityLabel="Número de cuenta" />
            <Text style={st.label}>Tu sector</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {sectors.map((s) => (
                <Text key={s.id} accessibilityRole="button" onPress={() => setSectorId(s.id)}
                  style={[st.chip, s.id === sectorId && st.chipOn]}>{s.name}</Text>
              ))}
            </ScrollView>
          </>
        )}
        <TextInput style={st.input} placeholder="Contraseña" secureTextEntry value={password}
          onChangeText={setPassword} accessibilityLabel="Contraseña" />

        <Button title={mode === 'login' ? 'Entrar' : 'Registrarme'} onPress={submit} loading={busy} />
        <Text style={st.link} accessibilityRole="button"
          onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? '¿No tienes cuenta? Regístrate' : 'Ya tengo cuenta'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  c: { padding: 24, paddingTop: 80 },
  logo: { fontSize: 30, fontWeight: '800', color: colors.primaryDark, textAlign: 'center' },
  sub: { color: colors.muted, textAlign: 'center', marginBottom: 24, marginTop: 4 },
  label: { color: colors.muted, marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#D5DEE8',
  },
  link: { color: colors.primary, textAlign: 'center', marginTop: 18, fontWeight: '600' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E1EAF3',
    color: colors.text, marginRight: 8, overflow: 'hidden',
  },
  chipOn: { backgroundColor: colors.primary, color: '#fff' },
});
