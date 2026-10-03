import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptData, decryptData, encryptWithRawKey, decryptWithRawKey } from '../crypto/aes';
import type { EncryptedBundle } from '../crypto/aes';
import type { VaultData } from '../types/vault';
import type { AccessLog } from '../types/auth';
import { getDevicePepper, getLogKey } from './secureStorage';

const VAULT_KEY = 'gp_vault_data';
const LOGS_KEY = 'gp_access_logs';
// Chaves de versoes anteriores (dados em texto puro), removidas no wipe.
const LEGACY_KEYS = ['gp_decoy_data', 'gp_user_config'];

const LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

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

/** Segredo efetivo do cofre: PIN + pepper do aparelho (guardado no Keystore). */
async function vaultSecret(pin: string): Promise<string> {
  const pepper = await getDevicePepper();
  return `${pin}:${pepper}`;
}

export async function saveVault(vault: VaultData, pin: string): Promise<void> {
  const secret = await vaultSecret(pin);

  // Reaproveita o salt do cofre atual (v2) para nao refazer o PBKDF2 a cada save.
  let reuseSalt: string | undefined;
  const raw = await AsyncStorage.getItem(VAULT_KEY);
  if (raw) {
    try {
      const current: EncryptedBundle = JSON.parse(raw);
      if (current.v === 2) reuseSalt = current.salt;
    } catch {
      // ignora: gera salt novo
    }
  }

  const bundle = await encryptData(JSON.stringify(vault), secret, reuseSalt);
  await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(bundle));
}

export async function loadVault(pin: string): Promise<VaultData> {
  const raw = await AsyncStorage.getItem(VAULT_KEY);
  if (!raw) return emptyVault();

  const bundle: EncryptedBundle = JSON.parse(raw);
  // Bundles legados (v1) foram criptografados apenas com o PIN.
  const secret = bundle.v === 2 ? await vaultSecret(pin) : pin;
  const json = decryptData(bundle, secret);
  return JSON.parse(json) as VaultData;
}

export async function deleteVault(): Promise<void> {
  await AsyncStorage.multiRemove([VAULT_KEY, LOGS_KEY, ...LEGACY_KEYS]);
}

// ---------- Registro de acessos (criptografado em repouso) ----------

async function readLogs(): Promise<AccessLog[]> {
  const raw = await AsyncStorage.getItem(LOGS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as AccessLog[]; // formato legado em texto puro
    const key = await getLogKey();
    return JSON.parse(decryptWithRawKey(parsed as EncryptedBundle, key)) as AccessLog[];
  } catch {
    return [];
  }
}

async function writeLogs(logs: AccessLog[]): Promise<void> {
  const key = await getLogKey();
  const bundle = await encryptWithRawKey(JSON.stringify(logs), key);
  await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(bundle));
}

export async function saveAccessLog(log: AccessLog): Promise<void> {
  const cutoff = Date.now() - LOG_RETENTION_MS;
  const logs = (await readLogs()).filter(l => l.timestamp > cutoff);
  logs.push(log);
  await writeLogs(logs);
}

export async function getAccessLogs(): Promise<AccessLog[]> {
  const cutoff = Date.now() - LOG_RETENTION_MS;
  return (await readLogs()).filter(l => l.timestamp > cutoff);
}
