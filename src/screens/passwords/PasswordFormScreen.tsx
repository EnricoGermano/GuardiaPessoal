import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVault } from '../../context/VaultContext';
import { generateRandomPassword, generateWordPassword, evaluateStrength } from '../../crypto/generator';
import { PasswordStrengthBar } from '../../components/PasswordStrengthBar';
import { NoteFormModal } from '../notes/NoteFormModal';
import type { ImportanceLevel, PasswordItem, NoteItem } from '../../types/vault';

interface Props {
  onDone: () => void;
  editingItem?: PasswordItem | null;
  onActivity?: () => void;
}

export function PasswordFormScreen({ onDone, editingItem, onActivity }: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0);
  const { vault, addPassword, updatePassword, addNote, updateNote } = useVault();

  const [service, setService] = useState(editingItem?.service || '');
  const [username, setUsername] = useState(editingItem?.username || '');
  const [password, setPassword] = useState(editingItem?.password || '');
  const [url, setUrl] = useState(editingItem?.url || '');
  const [category, setCategory] = useState(editingItem?.category || '1');
  const [tagsText, setTagsText] = useState(editingItem?.tags?.join(', ') || '');
  const [importance, setImportance] = useState<ImportanceLevel>(editingItem?.importance || 'media');
  const [hint, setHint] = useState(editingItem?.hint || '');
  const [warning, setWarning] = useState(editingItem?.warning || '');
  const [showPassword, setShowPassword] = useState(false);
  const [genLength, setGenLength] = useState(16);
  const [genSymbols, setGenSymbols] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados para vinculação e gerenciamento de notas confidenciais
  const [quickNoteTitle, setQuickNoteTitle] = useState('');
  const [quickNoteContent, setQuickNoteContent] = useState('');
  const [showNoteAdvanced, setShowNoteAdvanced] = useState(false);
  const [quickNoteDestructDays, setQuickNoteDestructDays] = useState(0);
  const [quickNoteFavorite, setQuickNoteFavorite] = useState(false);
  const [selectedNoteModalItem, setSelectedNoteModalItem] = useState<NoteItem | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);

  const notifyActivity = useCallback(() => {
    if (onActivity) onActivity();
  }, [onActivity]);

  const linkedNotes = editingItem && vault
    ? vault.notes.filter(n => n.linkedPasswordId === editingItem.id && !n.isHidden)
    : [];

  const isDirty =
    service !== (editingItem?.service || '') ||
    username !== (editingItem?.username || '') ||
    password !== (editingItem?.password || '') ||
    url !== (editingItem?.url || '') ||
    category !== (editingItem?.category || '1') ||
    tagsText !== (editingItem?.tags?.join(', ') || '') ||
    importance !== (editingItem?.importance || 'media') ||
    hint !== (editingItem?.hint || '') ||
    warning !== (editingItem?.warning || '') ||
    quickNoteContent.trim() !== '' ||
    quickNoteTitle.trim() !== '';

  const handleBack = () => {
    notifyActivity();
    if (isDirty) {
      Alert.alert(
        'Descartar alterações?',
        'Existem alterações não salvas. Deseja realmente voltar?',
        [
          { text: 'Continuar editando', style: 'cancel' },
          { text: 'Descartar', style: 'destructive', onPress: onDone },
        ]
      );
    } else {
      onDone();
    }
  };

  const handleUnlinkNote = (note: NoteItem) => {
    notifyActivity();
    Alert.alert(
      'Desvincular Nota',
      `Deseja desvincular a nota "${note.title}" desta credencial?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateNote(note.id, { linkedPasswordId: undefined });
            } catch (err: any) {
              Alert.alert('Erro ao desvincular', err?.message || 'Falha ao atualizar a nota.');
            }
          },
        },
      ]
    );
  };

  const handleGenerate = () => {
    notifyActivity();
    try {
      const pwd = generateRandomPassword({
        length: genLength,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: genSymbols,
      });
      setPassword(pwd);
      setShowPassword(true);
    } catch (err: any) {
      Alert.alert('Erro ao gerar', err?.message || 'Falha na geracao da senha');
    }
  };

  const handleGenerateWords = () => {
    notifyActivity();
    try {
      const pwd = generateWordPassword(4, '-', genSymbols);
      setPassword(pwd);
      setShowPassword(true);
    } catch (err: any) {
      Alert.alert('Erro ao gerar', err?.message || 'Falha na geracao da senha');
    }
  };

  const executeSave = async () => {
    setSaving(true);
    const parsedTags = tagsText
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    try {
      let targetPasswordId = editingItem?.id;
      if (editingItem) {
        await updatePassword(editingItem.id, {
          service: service.trim(),
          username: username.trim(),
          password,
          url: url.trim() || undefined,
          category,
          tags: parsedTags,
          importance,
          hint: hint.trim() || undefined,
          warning: warning.trim() || undefined,
        });
      } else {
        const created = await addPassword({
          service: service.trim(),
          username: username.trim(),
          password,
          url: url.trim() || undefined,
          category,
          tags: parsedTags,
          importance,
          hint: hint.trim() || undefined,
          warning: warning.trim() || undefined,
        });
        targetPasswordId = created.id;
      }

      // US14: Se preenchida, salva a nova nota confidencial vinculada à credencial
      if (quickNoteContent.trim() && targetPasswordId) {
        const durationMs =
          quickNoteDestructDays === -10
            ? 10 * 1000
            : quickNoteDestructDays > 0
            ? quickNoteDestructDays * 24 * 60 * 60 * 1000
            : 0;
        const expiresAt = durationMs > 0 ? Date.now() + durationMs : undefined;
        const noteTitle = quickNoteTitle.trim() || `Nota - ${service.trim() || 'Credencial'}`;

        await addNote({
          title: noteTitle,
          content: quickNoteContent.trim(),
          isFavorite: quickNoteFavorite,
          autoDestructDays: quickNoteDestructDays !== 0 ? quickNoteDestructDays : undefined,
          expiresAt,
          linkedPasswordId: targetPasswordId,
        });
      }

      onDone();
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err?.message || 'Falha ao gravar no cofre.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    notifyActivity();
    if (!service.trim()) return Alert.alert('Erro', 'Informe o nome do servico.');
    if (!username.trim()) return Alert.alert('Erro', 'Informe o usuario.');
    if (!password.trim()) return Alert.alert('Erro', 'Informe ou gere uma senha.');

    // US06: Confirmacao de seguranca para edicao de credenciais existentes
    if (editingItem) {
      Alert.alert(
        'Confirmar alteracao',
        `Deseja salvar as alteracoes na credencial "${service.trim()}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salvar', onPress: executeSave },
        ]
      );
    } else {
      executeSave();
    }
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['bottom', 'left', 'right']}
      onStartShouldSetResponderCapture={() => {
        notifyActivity();
        return false;
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={[styles.header, { paddingTop: Math.max(topPad, 12) + 6 }]}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleBack}
            disabled={saving}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {editingItem ? 'Editar Senha' : 'Nova Credencial'}
          </Text>
          <TouchableOpacity
            style={[styles.headerBtn, styles.saveBtn]}
            onPress={handleSave}
            disabled={saving}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            activeOpacity={0.7}
          >
            <Text style={[styles.saveText, saving && styles.saveTextDisabled]}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={notifyActivity}
        >

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Servico</Text>
              <TextInput
                style={styles.input}
                value={service}
                onChangeText={t => { notifyActivity(); setService(t); }}
                placeholder="Ex: Google"
                placeholderTextColor="#A8A199"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Usuario</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={t => { notifyActivity(); setUsername(t); }}
                placeholder="exemplo@gmail.com"
                placeholderTextColor="#A8A199"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.flex]}
                  value={password}
                  onChangeText={t => { notifyActivity(); setPassword(t); }}
                  placeholder="Senha"
                  placeholderTextColor="#A8A199"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => { notifyActivity(); setShowPassword(v => !v); }}
                >
                  <Text style={styles.eyeText}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {password.length > 0 && (
              <View style={styles.field}>
                <PasswordStrengthBar score={evaluateStrength(password)} />
              </View>
            )}

            <View style={styles.genRow}>
              <TouchableOpacity style={styles.genButton} onPress={handleGenerate}>
                <Text style={styles.genText}>Gerar Aleatória</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.genButton} onPress={handleGenerateWords}>
                <Text style={styles.genText}>Gerar Palavras</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.genOptions}>
              <Text style={styles.smallLabel}>Tamanho da senha aleatoria: {genLength}</Text>
              <View style={styles.lengthRow}>
                <TouchableOpacity
                  onPress={() => { notifyActivity(); setGenLength(l => Math.max(8, l - 1)); }}
                >
                  <Text style={styles.lengthBtn}>-</Text>
                </TouchableOpacity>
                <View style={styles.lengthBar}>
                  <View style={[styles.lengthFill, { width: `${((genLength - 8) / 24) * 100}%` }]} />
                </View>
                <TouchableOpacity
                  onPress={() => { notifyActivity(); setGenLength(l => Math.min(32, l + 1)); }}
                >
                  <Text style={styles.lengthBtn}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.smallLabel}>Incluir simbolos</Text>
                <Switch
                  value={genSymbols}
                  onValueChange={v => { notifyActivity(); setGenSymbols(v); }}
                  trackColor={{ false: '#E6DFD5', true: '#B5824C' }}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>URL (opcional)</Text>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={t => { notifyActivity(); setUrl(t); }}
                placeholder="https://exemplo.com"
                placeholderTextColor="#A8A199"
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Categoria</Text>
              <View style={styles.categoryRow}>
                {vault?.categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catChip,
                      category === cat.id && styles.catChipActive,
                    ]}
                    onPress={() => { notifyActivity(); setCategory(cat.id); }}
                  >
                    <Text style={[styles.catText, category === cat.id && styles.catTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Tags (separadas por virgula)</Text>
              <TextInput
                style={styles.input}
                value={tagsText}
                onChangeText={t => { notifyActivity(); setTagsText(t); }}
                placeholder="ex: pessoal, banco, email"
                placeholderTextColor="#A8A199"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Nivel de Importancia</Text>
              <View style={styles.categoryRow}>
                {(['baixa', 'media', 'alta'] as ImportanceLevel[]).map(level => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.catChip,
                      importance === level && styles.catChipActive,
                    ]}
                    onPress={() => { notifyActivity(); setImportance(level); }}
                  >
                    <Text style={[styles.catText, importance === level && styles.catTextActive]}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Dica (opcional)</Text>
              <TextInput
                style={styles.input}
                value={hint}
                onChangeText={t => { notifyActivity(); setHint(t); }}
                placeholder="Uma pista para lembrar da senha"
                placeholderTextColor="#A8A199"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Aviso (opcional)</Text>
              <TextInput
                style={styles.input}
                value={warning}
                onChangeText={t => { notifyActivity(); setWarning(t); }}
                placeholder="Lembrete exibido ao ver esta senha"
                placeholderTextColor="#A8A199"
              />
            </View>
          </View>

          {/* US14: Seção de Notas Confidenciais Vinculadas */}
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.sectionHeaderTitle}>Notas Confidenciais Vinculadas</Text>

            {editingItem && linkedNotes.length > 0 && (
              <View style={styles.linkedSection}>
                <Text style={styles.sublabel}>Notas já vinculadas a esta credencial:</Text>
                {linkedNotes.map(note => (
                  <View key={note.id} style={styles.linkedNoteCard}>
                    <TouchableOpacity
                      style={styles.linkedNoteContent}
                      onPress={() => {
                        notifyActivity();
                        setSelectedNoteModalItem(note);
                        setNoteModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.linkedNoteHeader}>
                        <Text style={styles.linkedNoteTitle} numberOfLines={1}>{note.title}</Text>
                        {note.isFavorite && (
                          <View style={styles.miniBadgeFav}>
                            <Text style={styles.miniBadgeFavText}>★ Favorita</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.linkedNoteSnippet} numberOfLines={1}>
                        {note.content}
                      </Text>
                      {note.observations ? (
                        <Text style={styles.linkedNoteObs} numberOfLines={1}>
                          Obs: {note.observations}
                        </Text>
                      ) : null}
                    </TouchableOpacity>

                    <View style={styles.linkedNoteActions}>
                      <TouchableOpacity
                        style={styles.openNoteBtn}
                        onPress={() => {
                          notifyActivity();
                          setSelectedNoteModalItem(note);
                          setNoteModalVisible(true);
                        }}
                      >
                        <Text style={styles.openNoteText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.unlinkBtn}
                        onPress={() => handleUnlinkNote(note)}
                      >
                        <Text style={styles.unlinkText}>Desvincular</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.newNoteSection}>
              <Text style={styles.sublabel}>
                {editingItem ? 'Criar nova nota vinculada:' : 'Adicionar nota sigilosa vinculada:'}
              </Text>

              <View style={styles.field}>
                <Text style={styles.label}>Título da Nota (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={quickNoteTitle}
                  onChangeText={t => { notifyActivity(); setQuickNoteTitle(t); }}
                  placeholder={`Nota - ${service.trim() || 'Credencial'}`}
                  placeholderTextColor="#A8A199"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Conteúdo Confidencial da Nota</Text>
                <TextInput
                  style={[styles.input, styles.noteTextArea]}
                  value={quickNoteContent}
                  onChangeText={t => { notifyActivity(); setQuickNoteContent(t); }}
                  placeholder="Ex: Perguntas de segurança, código PUK, chave de recuperação..."
                  placeholderTextColor="#A8A199"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={styles.toggleAdvancedBtn}
                onPress={() => {
                  notifyActivity();
                  setShowNoteAdvanced(prev => !prev);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleAdvancedText}>
                  {showNoteAdvanced ? '▲ Ocultar opções da nota' : '▼ Mais opções da nota (auto-destruição e favorita)'}
                </Text>
              </TouchableOpacity>

              {showNoteAdvanced && (
                <View style={styles.noteAdvancedBox}>
                  <View style={styles.switchRow}>
                    <Text style={styles.smallLabel}>Marcar como Favorita</Text>
                    <Switch
                      value={quickNoteFavorite}
                      onValueChange={v => { notifyActivity(); setQuickNoteFavorite(v); }}
                      trackColor={{ false: '#E6DFD5', true: '#B5824C' }}
                    />
                  </View>

                  <Text style={[styles.label, { marginTop: 12 }]}>Auto-destruição</Text>
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
                          quickNoteDestructDays === opt.days && styles.destructChipActive,
                        ]}
                        onPress={() => { notifyActivity(); setQuickNoteDestructDays(opt.days); }}
                      >
                        <Text
                          style={[
                            styles.destructText,
                            quickNoteDestructDays === opt.days && styles.destructTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {noteModalVisible && (
        <NoteFormModal
          visible={noteModalVisible}
          editingItem={selectedNoteModalItem}
          onClose={() => {
            setNoteModalVisible(false);
            setSelectedNoteModalItem(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF9F5' },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
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
  headerTitle: { color: '#1E1E1E', fontSize: 17, fontWeight: '700' },
  cancelText: { color: '#756F68', fontSize: 15, fontWeight: '600' },
  saveText: { color: '#996515', fontSize: 15, fontWeight: '700' },
  saveTextDisabled: { opacity: 0.5 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6DFD5',
    shadowColor: '#1E1E1E',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1E1E',
    marginBottom: 12,
  },
  sublabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#756F68',
    marginBottom: 8,
  },
  linkedSection: {
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#F0ECE6',
  },
  linkedNoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBF9F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6DFD5',
    padding: 10,
    marginBottom: 8,
  },
  linkedNoteContent: {
    flex: 1,
    marginRight: 8,
  },
  linkedNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  linkedNoteTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E1E1E',
  },
  miniBadgeFav: {
    backgroundColor: '#FFF9EE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EED8A1',
  },
  miniBadgeFavText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#996515',
  },
  linkedNoteSnippet: {
    fontSize: 11,
    color: '#756F68',
  },
  linkedNoteObs: {
    fontSize: 10,
    color: '#996515',
    marginTop: 2,
  },
  linkedNoteActions: {
    flexDirection: 'row',
    gap: 6,
  },
  openNoteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#F3EFE8',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },
  openNoteText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
  },
  unlinkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#FDEEE9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F9D5CB',
  },
  unlinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D9534F',
  },
  newNoteSection: {
    marginTop: 4,
  },
  noteTextArea: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  toggleAdvancedBtn: {
    paddingVertical: 6,
    marginBottom: 10,
  },
  toggleAdvancedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B5824C',
  },
  noteAdvancedBox: {
    backgroundColor: '#FAF9F6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },
  destructRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  destructChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },
  destructChipActive: {
    backgroundColor: '#FFF9EE',
    borderColor: '#B5824C',
  },
  destructText: {
    color: '#756F68',
    fontSize: 11,
    fontWeight: '500',
  },
  destructTextActive: {
    color: '#996515',
    fontWeight: '700',
  },
  field: { marginBottom: 16 },
  label: { color: '#756F68', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  smallLabel: { color: '#756F68', fontSize: 12, fontWeight: '500' },
  input: {
    backgroundColor: '#F3EFE8',
    color: '#1E1E1E',
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },
  passwordRow: { flexDirection: 'row', gap: 8 },
  eyeButton: { justifyContent: 'center', paddingHorizontal: 8 },
  eyeText: { color: '#B5824C', fontSize: 13, fontWeight: '600' },
  genRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  genButton: {
    flex: 1,
    backgroundColor: '#FFF9EE',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B5824C',
  },
  genText: { color: '#996515', fontSize: 13, fontWeight: '600' },
  genOptions: {
    backgroundColor: '#FAF9F6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },
  lengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  lengthBtn: { color: '#B5824C', fontSize: 20, paddingHorizontal: 8, fontWeight: '700' },
  lengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E6DFD5',
    borderRadius: 2,
  },
  lengthFill: {
    height: 4,
    backgroundColor: '#B5824C',
    borderRadius: 2,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E6DFD5',
  },
  catChipActive: {
    backgroundColor: '#FFF9EE',
    borderColor: '#B5824C',
  },
  catText: { color: '#756F68', fontSize: 13, fontWeight: '500' },
  catTextActive: { color: '#996515', fontWeight: '700' },
});
