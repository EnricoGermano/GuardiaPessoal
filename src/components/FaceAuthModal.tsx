import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface FaceAuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const FaceAuthModal: React.FC<FaceAuthModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    if (visible) {
      setScanning(true);
      const timer = setTimeout(() => {
        setScanning(false);
        setTimeout(() => {
          onSuccess();
        }, 300);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [visible, onSuccess]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>Reconhecimento Facial</Text>
          <Text style={styles.subtitle}>Posicione o rosto na moldura</Text>

          <View style={styles.viewfinder}>
            {scanning ? (
              <ActivityIndicator size="large" color="#996515" />
            ) : (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </View>

          <Text style={styles.statusText}>
            {scanning ? 'Identificando biometria...' : 'Rosto reconhecido!'}
          </Text>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar e Usar PIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1E1E',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#7A7265',
    marginBottom: 20,
  },
  viewfinder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: '#996515',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FFF9EE',
  },
  checkmark: {
    fontSize: 48,
    color: '#4A7C59',
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#996515',
    marginBottom: 20,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 13,
    color: '#8A8175',
    fontWeight: '600',
  },
});
