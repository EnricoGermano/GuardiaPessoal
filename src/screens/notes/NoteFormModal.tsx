import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { useVault } from '../../context/VaultContext';
import type { NoteItem } from '../../types/vault';

interface NoteFormModalProps {
  visible: boolean;
  editingItem?: NoteItem | null;
  onClose: () => void;
}

export const NoteFormModal: React.FC<NoteFormModalProps> = ({
  visible,
  editingItem,
  onClose,
}) => {
  const { vault, addNote, updateNote, deleteNote } = useVault();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [observations, setObservations] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [autoDestructDays, setAutoDestructDays] = useState(0);
  const [linkedPasswordId, setLinkedPasswordId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (editingItem) {
      setTitle(editingItem.title);
      setContent(editingItem.content);
      setObservations(editingItem.observations || '');
      setIsFavorite(editingItem.isFavorite || false);
      setAutoDestructDays(editingItem.autoDestructDays || 0);
      setLinkedPasswordId(editingItem.linkedPasswordId);
    } else {
      setTitle('');
      setContent('');
      setObservations('');
      setIsFavorite(false);
      setAutoDestructDays(0);
      setLinkedPasswordId(undefined);
    }
  }, [editingItem, visible]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Atencao', 'Informe um titulo para a nota.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Atencao', 'Informe o conteudo da nota.');
      return;
    }

    const expiresAt = autoDestructDays > 0 ? Date.now() + autoDestructDays * 24 * 60 * 60 * 1000 : undefined;

    if (editingItem) {
      await updateNote(editingItem.id, {
        title: title.trim(),
        content: content.trim(),
        observations: observations.trim() || undefined,
        isFavorite,
        autoDestructDays: autoDestructDays > 0 ? autoDestructDays : undefined,
        expiresAt,
        linkedPasswordId,
      });
    } else {
      await addNote({
        title: title.trim(),
        content: content.trim(),
        observations: observations.trim() || undefined,
        isFavorite,
        autoDestructDays: autoDestructDays > 0 ? autoDestructDays : undefined,
        expiresAt,
        linkedPasswordId,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (!editingItem) return;
    Alert.alert(
      'Confirmar Exclusao',
      `Deseja realmente apagar "${editingItem.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteNote(editingItem.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {editingItem ? 'Editar Nota' : 'Nova Nota Confidencial'}
          </Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
            <Text style={styles.saveText}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Titulo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Chave de Seguranca / Perguntas"
              placeholderTextColor="#A8A199"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.fieldLabel}>Conteudo Confidencial</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Digite o texto sigiloso..."
              placeholderTextColor="#A8A199"
              multiline
              numberOfLines={4}
              value={content}
              onChangeText={setContent}
            />

            <Text style={styles.fieldLabel}>Observacoes Adicionais</Text>
            <TextInput
              style={styles.input}
              placeholder="Notas secundarias ou dicas"
              placeholderTextColor="#A8A199"
              value={observations}
              onChangeText={setObservations}
            />

            <View style={styles.rowItem}>
              <Text style={styles.rowLabel}>Marcar como Favorita</Text>
              <Switch
                value={isFavorite}
                onValueChange={setIsFavorite}
                trackColor={{ false: '#E6DFD5', true: '#B5824C' }}
              />
            </View>

            <Text style={styles.fieldLabel}>Auto-destruicao da Nota</Text>
            <View style={styles.destructRow}>
              {[
                { label: 'Nunca', days: 0 },
                { label: '1 dia', days: 1 },
                { label: '7 dias', days: 7 },
                { label: '30 dias', days: 30 },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.days}
                  style={[
                    styles.destructChip,
                    autoDestructDays === opt.days && styles.destructChipActive,
                  ]}
                  onPress={() => setAutoDestructDays(opt.days)}
                >
                  <Text
                    style={[
                      styles.destructText,
                      autoDestructDays === opt.days && styles.destructTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {vault && vault.passwords.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Vincular a uma Senha</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.linkedScroll}>
                  <TouchableOpacity
                    style={[styles.linkChip, !linkedPasswordId && styles.linkChipActive]}
                    onPress={() => setLinkedPasswordId(undefined)}
                  >
                    <Text style={[styles.linkChipText, !linkedPasswordId && styles.linkChipTextActive]}>
                      Nenhuma
                    </Text>
                  </TouchableOpacity>
                  {vault.passwords.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.linkChip, linkedPasswordId === p.id && styles.linkChipActive]}
                      onPress={() => setLinkedPasswordId(p.id)}
                    >
                      <Text style={[styles.linkChipText, linkedPasswordId === p.id && styles.linkChipTextActive]}>
                        {p.service}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {editingItem && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Text style={styles.deleteBtnText}>Excluir Nota</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBF9F5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#EFEAE2',
    backgroundColor: '#FFFFFF',
  },
  headerBtn: { padding: 4 },
  cancelText: { color: '#8A8175', fontSize: 15 },
  saveText: { color: '#996515', fontSize: 15, fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1E1E1E' },
  content: { padding: 16 },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#4A4237', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E6DFD5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E1E1E',
    backgroundColor: '#FDFBF9',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#1E1E1E' },
  destructRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  destructChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6DFD5',
    backgroundColor: '#FDFBF9',
  },
  destructChipActive: {
    backgroundColor: '#FFF9EE',
    borderColor: '#996515',
  },
  destructText: { fontSize: 12, color: '#6A6255' },
  destructTextActive: { color: '#996515', fontWeight: '700' },
  linkedScroll: { flexDirection: 'row', marginVertical: 6 },
  linkChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E6DFD5',
    backgroundColor: '#FDFBF9',
    marginRight: 8,
  },
  linkChipActive: { backgroundColor: '#FFF9EE', borderColor: '#996515' },
  linkChipText: { fontSize: 12, color: '#6A6255' },
  linkChipTextActive: { color: '#996515', fontWeight: '700' },
  deleteBtn: {
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FBEAE5',
    alignItems: 'center',
  },
  deleteBtnText: { color: '#D9534F', fontSize: 14, fontWeight: '700' },
});
