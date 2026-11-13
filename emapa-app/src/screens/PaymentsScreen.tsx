import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { Badge, Button, Card, fmtDate, Loading } from '../components/ui';
import { api } from '../services/api';
import { colors } from '../theme';
import { Invoice } from '../types';

export default function PaymentsScreen() {
  const [list, setList] = useState<Invoice[] | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    api.getInvoices().then(setList);
  }, []);

  const pay = async (f: Invoice) => {
    setPaying(f.id);
    try {
      const ok = await api.payInvoice(f.id);
      setList(await api.getInvoices());
      if (ok) Alert.alert('Pago exitoso', `Factura ${f.period} pagada.`);
      else Alert.alert('Pago no confirmado', 'Si se te cobró, se reflejará en unos minutos.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo procesar el pago. Intenta nuevamente.');
    } finally {
      setPaying(null);
    }
  };

  if (!list) return <Loading />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {list.map((f) => (
        <Card key={f.id}>
          <Text style={st.t}>{f.period}</Text>
          <Text style={st.muted}>Consumo: {f.consumptionM3} m³</Text>
          <Text style={st.amount}>${f.amount.toFixed(2)}</Text>
          <Text style={st.muted}>Vence: {fmtDate(f.dueDate)}</Text>
          {f.paid ? (
            <Badge text="Pagada" color={colors.ok} />
          ) : (
            <Button title="Pagar ahora" onPress={() => pay(f)} loading={paying === f.id} />
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  t: { fontSize: 17, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, marginTop: 4 },
  amount: { fontSize: 26, fontWeight: '800', color: colors.primaryDark, marginVertical: 6 },
});
