import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVault } from '../../context/VaultContext';
import { useThemeColors } from '../../theme/useThemeColors';
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
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0);
  const colors = useThemeColors();
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

    const durationMs =
      autoDestructDays === -10
        ? 10 * 1000
        : autoDestructDays > 0
        ? autoDestructDays * 24 * 60 * 60 * 1000
        : 0;
    const expiresAt = durationMs > 0 ? Date.now() + durationMs : undefined;

    if (editingItem) {
      await updateNote(editingItem.id, {
        title: title.trim(),
        content: content.trim(),
        observations: observations.trim() || undefined,
        isFavorite,
        autoDestructDays: autoDestructDays !== 0 ? autoDestructDays : undefined,
        expiresAt,
        linkedPasswordId,
      });
    } else {
      await addNote({
        title: title.trim(),
        content: content.trim(),
        observations: observations.trim() || undefined,
        isFavorite,
        autoDestructDays: autoDestructDays !== 0 ? autoDestructDays : undefined,
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.safeArea, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { paddingTop: Math.max(topPad, 12) + 6, backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerBtn}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Voltar</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {editingItem ? 'Editar Nota' : 'Nova Nota Confidencial'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.headerBtn, styles.saveBtn, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            activeOpacity={0.7}
          >
            <Text style={[styles.saveText, { color: colors.accent }]}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Titulo</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong, color: colors.text }]}
              placeholder="Ex: Chave de Seguranca / Perguntas"
              placeholderTextColor={colors.placeholder}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Conteudo Confidencial</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong, color: colors.text }]}
              placeholder="Digite o texto sigiloso..."
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={4}
              value={content}
              onChangeText={setContent}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Observacoes Adicionais</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong, color: colors.text }]}
              placeholder="Notas secundarias ou dicas"
              placeholderTextColor={colors.placeholder}
              value={observations}
              onChangeText={setObservations}
            />

            <View style={styles.rowItem}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Marcar como Favorita</Text>
              <Switch
                value={isFavorite}
                onValueChange={setIsFavorite}
                trackColor={{ false: colors.borderStrong, true: colors.accent }}
              />
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Auto-destruicao da Nota</Text>
            <View style={styles.destructRow}>
              {[
                { label: 'Nunca', days: 0 },
                { label: '10 seg', days: -10 },
                { label: '1 dia', days: 1 },
                { label: '7 dias', days: 7 },
                { label: '30 dias', days: 30 },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.days}
                  style={[
                    styles.destructChip,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong },
                    autoDestructDays === opt.days && { backgroundColor: colors.accentBg, borderColor: colors.accent },
                  ]}
                  onPress={() => setAutoDestructDays(opt.days)}
                >
                  <Text
                    style={[
                      styles.destructText,
                      { color: colors.textSecondary },
                      autoDestructDays === opt.days && { color: colors.accent, fontWeight: '700' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {vault && vault.passwords.length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Vincular a uma Senha</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.linkedScroll}>
                  <TouchableOpacity
                    style={[
                      styles.linkChip,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong },
                      !linkedPasswordId && { backgroundColor: colors.accentBg, borderColor: colors.accent },
                    ]}
                    onPress={() => setLinkedPasswordId(undefined)}
                  >
                    <Text style={[styles.linkChipText, { color: colors.textSecondary }, !linkedPasswordId && { color: colors.accent, fontWeight: '700' }]}>
                      Nenhuma
                    </Text>
                  </TouchableOpacity>
                  {vault.passwords.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.linkChip,
                        { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong },
                        linkedPasswordId === p.id && { backgroundColor: colors.accentBg, borderColor: colors.accent },
                      ]}
                      onPress={() => setLinkedPasswordId(p.id)}
                    >
                      <Text style={[styles.linkChipText, { color: colors.textSecondary }, linkedPasswordId === p.id && { color: colors.accent, fontWeight: '700' }]}>
                        {p.service}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {editingItem && (
              <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: colors.dangerBg }]} onPress={handleDelete}>
                <Text style={[styles.deleteBtnText, { color: colors.danger }]}>Excluir Nota</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#EFEAE2',
    backgroundColor: '#FFFFFF',
  },
  headerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  saveBtn: {
    backgroundColor: '#FFF9EE',
    borderWidth: 1,
    borderColor: '#EED8A1',
  },
  cancelText: { color: '#756F68', fontSize: 15, fontWeight: '600' },
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
  destructRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
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
