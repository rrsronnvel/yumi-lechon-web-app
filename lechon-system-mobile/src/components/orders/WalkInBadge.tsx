import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isWalkInOrder, WalkInOrderLike } from '../../utils/walkIn';

export default function WalkInBadge(order: WalkInOrderLike) {
  if (!isWalkInOrder(order)) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>🚶 WALK-IN (WI)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0E7FF',
    borderColor: '#A5B4FC',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  text: {
    color: '#312E81',
    fontSize: 9,
    fontWeight: '900',
  },
});
