import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Badge, Card, Loading } from '../components/ui';
import { useApp } from '../context/AppContext';
import { api, sectors } from '../services/api';
import { colors } from '../theme';
import { Incident, WaterQuality } from '../types';

const qColor = { apta: colors.ok, precaucion: colors.warn, no_apta: colors.danger };
const qText = { apta: 'Apta para consumo', precaucion: 'Precaución', no_apta: 'No apta' };

export default function HomeScreen() {
  const { sector, setSector } = useApp();
  const [q, setQ] = useState<WaterQuality | null>(null);
  const [inc, setInc] = useState<Incident[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      setQ(null);
      setInc(null);
      api.getQuality(sector.id).then(setQ);
      api.getIncidents(sector.id).then(setInc);
    }, [sector.id])
  );

  return (
    <ScrollView contentContainerStyle={st.c}>
      <Text style={st.label}>Mi sector</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {sectors.map((s) => (
          <Text
            key={s.id}
            accessibilityRole="button"
            onPress={() => setSector(s)}
            style={[st.chip, s.id === sector.id && st.chipOn]}
          >
            {s.name}
          </Text>
        ))}
      </ScrollView>

      <Card>
        <Text style={st.h}>Servicio</Text>
        {inc === null ? (
          <Loading />
        ) : inc.length === 0 ? (
          <Badge text="Servicio normal" color={colors.ok} />
        ) : (
          inc.map((i) => (
            <View key={i.id} style={{ marginTop: 6 }}>
              <Badge text={i.type === 'corte_programado' ? 'Corte programado' : 'Falla'} color={colors.danger} />
              <Text style={st.title}>{i.title}</Text>
              <Text style={st.muted}>{i.description}</Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text style={st.h}>Calidad del agua</Text>
        {!q ? (
          <Loading />
        ) : (
          <>
            <Badge text={qText[q.status]} color={qColor[q.status]} />
            <Text style={st.muted}>Cloro: {q.chlorine} mg/L · pH: {q.ph} · Turbidez: {q.turbidity} NTU</Text>
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  c: { padding: 16 },
  label: { color: colors.muted, marginBottom: 6 },
  h: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  title: { fontWeight: '600', color: colors.text, marginTop: 6 },
  muted: { color: colors.muted, marginTop: 6 },
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
