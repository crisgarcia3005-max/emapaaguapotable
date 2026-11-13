import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Badge, Button, Card, fmtDate } from '../components/ui';
import { api, procedureTypes } from '../services/api';
import { colors } from '../theme';
import { ProcedureRequest } from '../types';

export default function ProceduresScreen() {
  const [typeId, setTypeId] = useState(procedureTypes[0].id);
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);
  const [reqs, setReqs] = useState<ProcedureRequest[]>([]);

  useEffect(() => {
    api.getProcedureRequests().then(setReqs);
  }, []);

  const send = async () => {
    if (detail.trim().length < 10) {
      Alert.alert('Detalle requerido', 'Describe tu solicitud con al menos 10 caracteres.');
      return;
    }
    setSending(true);
    const r = await api.createProcedure(typeId, detail.trim());
    setReqs(await api.getProcedureRequests());
    setDetail('');
    setSending(false);
    Alert.alert('Solicitud enviada', `Tu número de trámite es ${r.id}.`);
  };

  const current = procedureTypes.find((p) => p.id === typeId)!;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={st.h}>Nuevo trámite</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {procedureTypes.map((p) => (
          <Text
            key={p.id}
            accessibilityRole="button"
            onPress={() => setTypeId(p.id)}
            style={[st.chip, p.id === typeId && st.chipOn]}
          >
            {p.name}
          </Text>
        ))}
      </ScrollView>
      <Text style={st.muted}>{current.description}</Text>
      <TextInput
        style={st.input}
        multiline
        placeholder="Describe tu solicitud (dirección, número de cuenta, etc.)"
        value={detail}
        onChangeText={setDetail}
      />
      <Button title="Enviar solicitud" onPress={send} loading={sending} />

      <Text style={[st.h, { marginTop: 24 }]}>Mis trámites</Text>
      {reqs.length === 0 && <Text style={st.muted}>Aún no has realizado trámites.</Text>}
      {reqs.map((r) => (
        <Card key={r.id}>
          <Text style={st.t}>{r.typeName}</Text>
          <Text style={st.muted}>{r.id} · {fmtDate(r.createdAt)}</Text>
          <Badge text={r.status === 'recibido' ? 'Recibido' : r.status === 'en_revision' ? 'En revisión' : 'Atendido'} color={colors.primary} />
        </Card>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  h: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  t: { fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, marginVertical: 4 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    minHeight: 100,
    padding: 12,
    textAlignVertical: 'top',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D5DEE8',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E1EAF3',
    color: colors.text,
    marginRight: 8,
    overflow: 'hidden',
  },
  chipOn: { backgroundColor: colors.primary, color: '#fff' },
});
