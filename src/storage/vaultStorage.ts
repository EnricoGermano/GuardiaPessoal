import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptData, decryptData, computeSha256 } from '../crypto/aes';
import type { EncryptedBundle } from '../crypto/aes';
import type { VaultData } from '../types/vault';
import type { AccessLog } from '../types/auth';

const VAULT_KEY = 'gp_vault_data';
const LOGS_KEY = 'gp_access_logs';
const DECOY_KEY = 'gp_decoy_data';
const CONFIG_KEY = 'gp_user_config';

function emptyVault(): VaultData {
  return {
    passwords: [],
    notes: [],
    categories: [
      { id: '1', name: 'Pessoal', color: '#4A90D9', icon: 'person' },
      { id: '2', name: 'Trabalho', color: '#F5A623', icon: 'briefcase' },
      { id: '3', name: 'Financeiro', color: '#7ED321', icon: 'cash' },
    ],
    folders: [],
    updatedAt: Date.now(),
    version: 1,
  };
}

export async function saveVault(vault: VaultData, secret: string): Promise<void> {
  const json = JSON.stringify(vault);
  const bundle = await encryptData(json, secret);
  await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(bundle));
}

export async function loadVault(secret: string): Promise<VaultData> {
  const raw = await AsyncStorage.getItem(VAULT_KEY);
  if (!raw) return emptyVault();

  const bundle: EncryptedBundle = JSON.parse(raw);
  const json = decryptData(bundle, secret);
  return JSON.parse(json) as VaultData;
}

export async function hasVaultData(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(VAULT_KEY);
  return raw !== null;
}

export async function deleteVault(): Promise<void> {
  await AsyncStorage.multiRemove([VAULT_KEY, LOGS_KEY, DECOY_KEY, CONFIG_KEY]);
}

export async function saveAccessLog(log: AccessLog): Promise<void> {
  const raw = await AsyncStorage.getItem(LOGS_KEY);
  const logs: AccessLog[] = raw ? JSON.parse(raw) : [];
  logs.push(log);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const filtered = logs.filter(l => l.timestamp > sevenDaysAgo);

  await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(filtered));
}

export async function getAccessLogs(): Promise<AccessLog[]> {
  const raw = await AsyncStorage.getItem(LOGS_KEY);
  if (!raw) return [];

  const logs: AccessLog[] = JSON.parse(raw);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return logs.filter(l => l.timestamp > sevenDaysAgo);
}

export async function saveDecoyVault(data: VaultData): Promise<void> {
  await AsyncStorage.setItem(DECOY_KEY, JSON.stringify(data));
}

export async function loadDecoyVault(): Promise<VaultData> {
  const raw = await AsyncStorage.getItem(DECOY_KEY);
  if (!raw) {
    return {
      ...emptyVault(),
      passwords: [
        {
          id: 'decoy1',
          service: 'Email Pessoal',
          username: 'usuario@email.com',
          password: 'Exemplo1234!',
          category: '1',
          tags: [],
          importance: 'baixa',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          history: [],
        },
        {
          id: 'decoy2',
          service: 'Rede Social',
          username: 'meu_perfil',
          password: 'SenhaFalsa@99',
          category: '1',
          tags: [],
          importance: 'baixa',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          history: [],
        },
      ],
    };
  }
  return JSON.parse(raw);
}

export async function saveUserConfig(config: Record<string, unknown>): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export async function loadUserConfig(): Promise<Record<string, unknown>> {
  const raw = await AsyncStorage.getItem(CONFIG_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function verifyVaultIntegrity(secret: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VAULT_KEY);
    if (!raw) return true;

    const bundle: EncryptedBundle = JSON.parse(raw);
    const currentChecksum = computeSha256(bundle.ciphertext);
    return currentChecksum === bundle.checksum;
  } catch {
    return false;
  }
}
