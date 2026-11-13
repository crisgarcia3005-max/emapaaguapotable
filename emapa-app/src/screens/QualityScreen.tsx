import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Badge, Card, fmtDate, Loading } from '../components/ui';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { colors } from '../theme';
import { WaterQuality } from '../types';

const status = { apta: 'Apta', precaucion: 'Precaución', no_apta: 'No apta' };
const sc = { apta: colors.ok, precaucion: colors.warn, no_apta: colors.danger };

export default function QualityScreen() {
  const { sector } = useApp();
  const [q, setQ] = useState<WaterQuality | null>(null);

  useEffect(() => {
    setQ(null);
    api.getQuality(sector.id).then(setQ);
  }, [sector.id]);

  if (!q) return <Loading />;

  const rows: [string, string, boolean][] = [
    ['Cloro residual', `${q.chlorine} mg/L (0.3 - 1.5)`, q.chlorine >= 0.3 && q.chlorine <= 1.5],
    ['pH', `${q.ph} (6.5 - 8.5)`, q.ph >= 6.5 && q.ph <= 8.5],
    ['Turbidez', `${q.turbidity} NTU (máx. 5)`, q.turbidity <= 5],
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Text style={st.h}>{sector.name}</Text>
        <Badge text={status[q.status]} color={sc[q.status]} />
        <Text style={st.muted}>Actualizado: {fmtDate(q.updatedAt)}</Text>
      </Card>
      {rows.map(([n, v, ok]) => (
        <Card key={n}>
          <Text style={st.n}>{n}</Text>
          <Text style={[st.v, { color: ok ? colors.ok : colors.danger }]}>{v}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  h: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  muted: { color: colors.muted, marginTop: 8 },
  n: { color: colors.muted },
  v: { fontSize: 18, fontWeight: '700', marginTop: 4 },
});
