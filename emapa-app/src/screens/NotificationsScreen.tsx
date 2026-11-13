import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, fmtDate, Loading } from '../components/ui';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { colors } from '../theme';
import { AppNotification } from '../types';

export default function NotificationsScreen() {
  const { sector } = useApp();
  const [list, setList] = useState<AppNotification[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.getNotifications(sector.id).then(setList);
    }, [sector.id])
  );

  if (!list) return <Loading />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {list.map((n) => (
        <Card key={n.id}>
          <Text style={st.t}>{n.title}</Text>
          <Text style={st.muted}>{n.body}</Text>
          <Text style={st.date}>{fmtDate(n.createdAt)}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  t: { fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, marginTop: 4 },
  date: { color: colors.muted, fontSize: 12, marginTop: 6 },
});
