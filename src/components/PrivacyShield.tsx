import React from 'react';
import { View, StyleSheet, TouchableWithoutFeedback } from 'react-native';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function PrivacyShield({ visible, onDismiss }: Props) {
  if (!visible) return null;

  return (
    <TouchableWithoutFeedback onPress={onDismiss}>
      <View style={styles.shield} />
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  shield: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 9999,
  },
});
