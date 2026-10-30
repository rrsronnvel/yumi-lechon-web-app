import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { isWalkInOrder, WalkInOrderLike } from '../../utils/walkIn';

interface WalkInBadgeProps extends WalkInOrderLike {
  style?: StyleProp<ViewStyle>;
}

export default function WalkInBadge({ source, customerName, facebookName, style }: WalkInBadgeProps) {
  if (!isWalkInOrder({ source, customerName, facebookName })) return null;

  return (
    <View style={[styles.badge, style]}>
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
