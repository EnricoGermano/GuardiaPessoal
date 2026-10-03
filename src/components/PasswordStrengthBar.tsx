import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  score: number;
}

const LABELS = ['Muito fraca', 'Fraca', 'Media', 'Forte', 'Muito forte'];
const COLORS = ['#D9534F', '#D9822B', '#EED8A1', '#B5824C', '#4A7C59'];

export function PasswordStrengthBar({ score }: Props) {
  const clampedScore = Math.min(4, Math.max(0, score));

  return (
    <View style={styles.container}>
      <View style={styles.barTrack}>
        {[0, 1, 2, 3, 4].map(i => (
          <View
            key={i}
            style={[
              styles.barSegment,
              { backgroundColor: i <= clampedScore ? COLORS[clampedScore] : '#E6DFD5' },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: COLORS[clampedScore] }]}>
        {LABELS[clampedScore]}
      </Text>
    </View>
  );
}

export function calculatePinStrength(pin: string): number {
  if (pin.length < 4) return 0;
  const unique = new Set(pin.split('')).size;
  const sequential = /0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210/;
  const repeated = /(\d)\1{3}/;

  if (repeated.test(pin)) return 0;
  if (sequential.test(pin)) return 1;
  if (unique <= 2) return 1;
  if (unique === 3) return 2;

  // 4 digitos unicos: verifica se ha pares sequenciais adjacentes (ex: 1289, 7814)
  const hasSequentialPair = /01|12|23|34|45|56|67|78|89|98|87|76|65|54|43|32|21|10/.test(pin);

  if (hasSequentialPair) {
    return 3; // Forte (4 digitos unicos, mas contem par sequencial)
  }

  return 4; // Muito forte (4 digitos unicos e sem pares sequenciais, ex: 8193, 2719)
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  barTrack: {
    flexDirection: 'row',
    gap: 4,
  },
  barSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
});
