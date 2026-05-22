// mobile/src/components/ui/PresenceBadge.js
import React from 'react';
import { View, StyleSheet } from 'react-native';

const COLORS = {
  online:  '#22c55e',
  away:    '#facc15',
  dnd:     '#ef4444',
  offline: '#94a3b8',
};

export default function PresenceBadge({ status, size = 12 }) {
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS[status] || COLORS.offline,
          borderWidth: 2,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderColor: '#ffffff',
  },
});