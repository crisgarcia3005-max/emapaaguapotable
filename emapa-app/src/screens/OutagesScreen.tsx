import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Badge, Card, fmtDate, Loading } from '../components/ui';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { colors } from '../theme';
import { Incident } from '../types';

const label = { corte_programado: 'Corte programado', falla: 'Falla', baja_presion: 'Baja presión' };

export default function OutagesScreen() {
  const { sector } = useApp();
  const [list, setList] = useState<Incident[] | null>(null);

  useEffect(() => {
    setList(null);
    api.getIncidents(sector.id).then(setList);
  }, [sector.id]);

  if (!list) return <Loading />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={st.sec}>Sector: {sector.name}</Text>
      {list.length === 0 && <Text style={st.muted}>No hay cortes ni fallas reportadas.</Text>}
      {list.map((i) => (
        <Card key={i.id}>
          <Badge text={label[i.type]} color={i.type === 'falla' ? colors.danger : colors.warn} />
          <Text style={st.t}>{i.title}</Text>
          <Text style={st.muted}>{i.description}</Text>
          <Text style={st.muted}>Inicio: {fmtDate(i.startsAt)}</Text>
          <Text style={st.muted}>Restablecimiento estimado: {fmtDate(i.estimatedEnd)}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  sec: { color: colors.muted, marginBottom: 10 },
  t: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 8 },
  muted: { color: colors.muted, marginTop: 4 },
});
