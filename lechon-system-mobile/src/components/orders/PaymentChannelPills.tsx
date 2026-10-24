import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type PaymentChannel = 'Cash' | 'GCash' | 'Maya' | 'Bank Transfer';

const CHANNELS: { value: PaymentChannel; label: string }[] = [
  { value: 'Cash', label: '💵 Cash' },
  { value: 'GCash', label: '📱 GCash' },
  { value: 'Maya', label: '💚 Maya' },
  { value: 'Bank Transfer', label: '🏦 Bank Transfer' },
];

interface PaymentChannelPillsProps {
  value: string;
  onChange: (value: PaymentChannel) => void;
}

export default function PaymentChannelPills({
  value,
  onChange,
}: PaymentChannelPillsProps) {
  return (
    <View style={styles.container}>
      {CHANNELS.map((channel) => {
        const active = value === channel.value;
        return (
          <Pressable
            key={channel.value}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(channel.value)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {channel.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  pill: {
    borderWidth: 1,
    borderColor: '#D6D3D1',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pillActive: { borderColor: '#059669', backgroundColor: '#ECFDF5' },
  label: { color: '#57534E', fontSize: 11, fontWeight: '700' },
  labelActive: { color: '#065F46', fontWeight: '900' },
});
