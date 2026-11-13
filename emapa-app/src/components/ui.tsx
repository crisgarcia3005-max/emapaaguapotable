import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[s.card, style]}>{children}</View>
);

export const Button = ({
  title,
  onPress,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={title}
    onPress={onPress}
    disabled={disabled || loading}
    style={[s.btn, (disabled || loading) && { opacity: 0.5 }]}
  >
    {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{title}</Text>}
  </Pressable>
);

export const Badge = ({ text, color }: { text: string; color: string }) => (
  <View style={[s.badge, { backgroundColor: color }]}>
    <Text style={s.badgeText}>{text}</Text>
  </View>
);

export const Loading = () => <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />;

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
