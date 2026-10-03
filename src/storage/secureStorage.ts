import * as SecureStore from 'expo-secure-store';
import { generateRandomHex } from '../crypto/aes';

const KEY_CONFIGURED = 'gp_configured';
const KEY_SALT = 'gp_master_salt';
const KEY_MASTER_HASH = 'gp_master_hash';
const KEY_EMERGENCY_HASH = 'gp_emergency_hash';
const KEY_KDF_ITERATIONS = 'gp_kdf_iterations';
const KEY_FAILED_ATTEMPTS = 'gp_failed_attempts';
const KEY_LOCKOUT_UNTIL = 'gp_lockout_until';
const KEY_DEVICE_PEPPER = 'gp_device_pepper';
const KEY_LOG_KEY = 'gp_log_key';

// Chaves de versoes anteriores: apenas removidas no wipe / ao iniciar sessao.
const LEGACY_KEYS = [
  'gp_session_key',
  'gp_daily_hash',
  'gp_daily_vault_key',
  'gp_sec_question',
  'gp_sec_answer_hash',
];

export async function isVaultConfigured(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(KEY_CONFIGURED);
  return value === 'true';
}

export async function setVaultConfigured(status: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEY_CONFIGURED, status ? 'true' : 'false');
}

export async function getMasterSalt(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_SALT);
}

export async function setMasterSalt(saltHex: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_SALT, saltHex);
}

export async function getMasterHash(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_MASTER_HASH);
}

export async function setMasterHash(hash: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_MASTER_HASH, hash);
}

export async function getEmergencyHash(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_EMERGENCY_HASH);
}

export async function setEmergencyHash(hash: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_EMERGENCY_HASH, hash);
}

/** Iteracoes PBKDF2 usadas no hash do PIN (null = instalacao antiga). */
export async function getKdfIterations(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(KEY_KDF_ITERATIONS);
  return raw ? parseInt(raw, 10) : null;
}

export async function setKdfIterations(iterations: number): Promise<void> {
  await SecureStore.setItemAsync(KEY_KDF_ITERATIONS, String(iterations));
}

// ---------- Tentativas de login (persistidas para sobreviver ao fechar o app) ----------

export interface AttemptState {
  failedAttempts: number;
  lockoutUntil: number;
}

export async function getAttemptState(): Promise<AttemptState> {
  const [attempts, until] = await Promise.all([
    SecureStore.getItemAsync(KEY_FAILED_ATTEMPTS),
    SecureStore.getItemAsync(KEY_LOCKOUT_UNTIL),
  ]);
  return {
    failedAttempts: attempts ? parseInt(attempts, 10) || 0 : 0,
    lockoutUntil: until ? parseInt(until, 10) || 0 : 0,
  };
}

export async function setAttemptState(s: AttemptState): Promise<void> {
  await SecureStore.setItemAsync(KEY_FAILED_ATTEMPTS, String(s.failedAttempts));
  await SecureStore.setItemAsync(KEY_LOCKOUT_UNTIL, String(s.lockoutUntil));
}

// ---------- Segredos de dispositivo (protegidos pelo Keystore/Keychain) ----------

async function getOrCreateRandom(key: string, bytes: number): Promise<string> {
  const existing = await SecureStore.getItemAsync(key);
  if (existing) return existing;
  const created = await generateRandomHex(bytes);
  await SecureStore.setItemAsync(key, created);
  return created;
}

/**
 * "Pepper" aleatorio do aparelho combinado ao PIN na derivacao da chave do
 * cofre. Sem ele (que fica no Keystore), copiar o AsyncStorage nao permite
 * forca bruta offline dos 10.000 PINs possiveis.
 */
export function getDevicePepper(): Promise<string> {
  return getOrCreateRandom(KEY_DEVICE_PEPPER, 32);
}

/** Chave aleatoria de 256 bits para criptografar o registro de acessos. */
export function getLogKey(): Promise<string> {
  return getOrCreateRandom(KEY_LOG_KEY, 32);
}

// ---------- Segredo de sessao (somente em memoria) ----------

let sessionSecret: string | null = null;

/** O PIN da sessao fica apenas em memoria e nunca e gravado em disco. */
export async function getSessionSecret(): Promise<string | null> {
  return sessionSecret;
}

export async function setSessionSecret(secret: string | null): Promise<void> {
  sessionSecret = secret;
  // Remove a copia em texto puro que versoes anteriores gravavam.
  try {
    await SecureStore.deleteItemAsync('gp_session_key');
  } catch {
    // ignora
  }
}

export async function clearAllSecureStorage(): Promise<void> {
  sessionSecret = null;
  const keys = [
    KEY_CONFIGURED,
    KEY_SALT,
    KEY_MASTER_HASH,
    KEY_EMERGENCY_HASH,
    KEY_KDF_ITERATIONS,
    KEY_FAILED_ATTEMPTS,
    KEY_LOCKOUT_UNTIL,
    KEY_DEVICE_PEPPER,
    KEY_LOG_KEY,
    ...LEGACY_KEYS,
  ];

  for (const key of keys) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignora erro se chave nao existir
    }
  }
}
