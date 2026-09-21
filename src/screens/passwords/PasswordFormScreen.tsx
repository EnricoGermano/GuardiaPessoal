import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVault } from '../../context/VaultContext';
import { generateRandomPassword, generateWordPassword, evaluateStrength } from '../../crypto/generator';
import { PasswordStrengthBar } from '../../components/PasswordStrengthBar';
import type { ImportanceLevel, PasswordItem } from '../../types/vault';

interface Props {
  onDone: () => void;
  editingItem?: PasswordItem | null;
}

export function PasswordFormScreen({ onDone, editingItem }: Props) {
  const { vault, addPassword, updatePassword } = useVault();

  const [service, setService] = useState(editingItem?.service || '');
  const [username, setUsername] = useState(editingItem?.username || '');
  const [password, setPassword] = useState(editingItem?.password || '');
  const [url, setUrl] = useState(editingItem?.url || '');
  const [category, setCategory] = useState(editingItem?.category || '1');
  const [importance, setImportance] = useState<ImportanceLevel>(editingItem?.importance || 'media');
  const [hint, setHint] = useState(editingItem?.hint || '');
  const [warning, setWarning] = useState(editingItem?.warning || '');
  const [showPassword, setShowPassword] = useState(false);
  const [genLength, setGenLength] = useState(16);
  const [genSymbols, setGenSymbols] = useState(true);

  const handleGenerate = () => {
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
    try {
      const pwd = generateWordPassword(4);
      setPassword(pwd);
      setShowPassword(true);
    } catch (err: any) {
      Alert.alert('Erro ao gerar', err?.message || 'Falha na geracao da senha');
    }
  };

  const handleSave = async () => {
    if (!service.trim()) return Alert.alert('Erro', 'Informe o nome do servico.');
    if (!username.trim()) return Alert.alert('Erro', 'Informe o usuario.');
    if (!password.trim()) return Alert.alert('Erro', 'Informe ou gere uma senha.');

    if (editingItem) {
      await updatePassword(editingItem.id, {
        service: service.trim(),
        username: username.trim(),
        password,
        url: url.trim() || undefined,
        category,
        importance,
        hint: hint.trim() || undefined,
        warning: warning.trim() || undefined,
      });
    } else {
      await addPassword({
        service: service.trim(),
        username: username.trim(),
        password,
        url: url.trim() || undefined,
        category,
        tags: [],
        importance,
        hint: hint.trim() || undefined,
        warning: warning.trim() || undefined,
      });
    }

    onDone();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={onDone}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{editingItem ? 'Editar Senha' : 'Nova Credencial'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveText}>Salvar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Servico</Text>
              <TextInput
                style={styles.input}
                value={service}
                onChangeText={setService}
                placeholder="Ex: Google"
                placeholderTextColor="#A8A199"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Usuario</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
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
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Digite ou gere uma senha"
                  placeholderTextColor="#A8A199"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
                </TouchableOpacity>
              </View>
              {password.length > 0 && <PasswordStrengthBar score={evaluateStrength(password)} />}
            </View>

            <View style={styles.genRow}>
              <TouchableOpacity style={styles.genButton} onPress={handleGenerate}>
                <Text style={styles.genText}>Gerar Aleatoria</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.genButton} onPress={handleGenerateWords}>
                <Text style={styles.genText}>Gerar por Palavras</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.genOptions}>
              <Text style={styles.smallLabel}>Tamanho da senha: {genLength}</Text>
              <View style={styles.lengthRow}>
                <TouchableOpacity onPress={() => setGenLength(Math.max(8, genLength - 1))}>
                  <Text style={styles.lengthBtn}>-</Text>
                </TouchableOpacity>
                <View style={styles.lengthBar}>
                  <View style={[styles.lengthFill, { width: `${((genLength - 8) / 24) * 100}%` }]} />
                </View>
                <TouchableOpacity onPress={() => setGenLength(Math.min(32, genLength + 1))}>
                  <Text style={styles.lengthBtn}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.smallLabel}>Incluir Simbolos</Text>
                <Switch
                  value={genSymbols}
                  onValueChange={setGenSymbols}
                  trackColor={{ true: '#B5824C', false: '#E6DFD5' }}
                  thumbColor={genSymbols ? '#FFFFFF' : '#F4F1EA'}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>URL (opcional)</Text>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder="https://..."
                placeholderTextColor="#A8A199"
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Categoria</Text>
              <View style={styles.categoryRow}>
                {vault?.categories.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catChip, category === c.id && styles.catChipActive]}
                    onPress={() => setCategory(c.id)}
                  >
                    <Text style={[styles.catText, category === c.id && styles.catTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Importancia</Text>
              <View style={styles.categoryRow}>
                {(['baixa', 'media', 'alta'] as ImportanceLevel[]).map(level => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.catChip,
                      importance === level && styles.catChipActive,
                    ]}
                    onPress={() => setImportance(level)}
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
                onChangeText={setHint}
                placeholder="Uma pista para lembrar da senha"
                placeholderTextColor="#A8A199"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Aviso (opcional)</Text>
              <TextInput
                style={styles.input}
                value={warning}
                onChangeText={setWarning}
                placeholder="Lembrete exibido ao ver esta senha"
                placeholderTextColor="#A8A199"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    marginBottom: 20,
    paddingTop: 8,
  },
  headerTitle: { color: '#1E1E1E', fontSize: 18, fontWeight: '700' },
  cancelText: { color: '#756F68', fontSize: 15 },
  saveText: { color: '#B5824C', fontSize: 15, fontWeight: '700' },
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
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DFD5',
  },
  catChipActive: {
    backgroundColor: '#FFF9EE',
    borderColor: '#B5824C',
  },
  catText: { color: '#756F68', fontSize: 13 },
  catTextActive: { color: '#996515', fontWeight: '700' },
});
