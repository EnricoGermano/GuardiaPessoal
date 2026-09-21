import * as SecureStore from 'expo-secure-store';

const KEY_CONFIGURED = 'gp_configured';
const KEY_SALT = 'gp_master_salt';
const KEY_MASTER_HASH = 'gp_master_hash';
const KEY_DAILY_HASH = 'gp_daily_hash';
const KEY_EMERGENCY_HASH = 'gp_emergency_hash';
const KEY_SECURITY_QUESTION = 'gp_sec_question';
const KEY_SECURITY_ANSWER_HASH = 'gp_sec_answer_hash';
const KEY_SESSION_KEY = 'gp_session_key';

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

export async function getDailyHash(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_DAILY_HASH);
}

export async function setDailyHash(hash: string | null): Promise<void> {
  if (!hash) {
    await SecureStore.deleteItemAsync(KEY_DAILY_HASH);
  } else {
    await SecureStore.setItemAsync(KEY_DAILY_HASH, hash);
  }
}

export async function getEmergencyHash(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_EMERGENCY_HASH);
}

export async function setEmergencyHash(hash: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_EMERGENCY_HASH, hash);
}

export async function getSecurityQuestion(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_SECURITY_QUESTION);
}

export async function setSecurityQuestion(question: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_SECURITY_QUESTION, question);
}

export async function getSecurityAnswerHash(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_SECURITY_ANSWER_HASH);
}

export async function setSecurityAnswerHash(hash: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_SECURITY_ANSWER_HASH, hash);
}

export async function getSessionSecret(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_SESSION_KEY);
}

export async function setSessionSecret(secret: string | null): Promise<void> {
  if (!secret) {
    await SecureStore.deleteItemAsync(KEY_SESSION_KEY);
  } else {
    await SecureStore.setItemAsync(KEY_SESSION_KEY, secret);
  }
}

const KEY_DAILY_VAULT_KEY = 'gp_daily_vault_key';

export async function getDailyVaultKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_DAILY_VAULT_KEY);
}

export async function setDailyVaultKey(encryptedBundleStr: string | null): Promise<void> {
  if (!encryptedBundleStr) {
    await SecureStore.deleteItemAsync(KEY_DAILY_VAULT_KEY);
  } else {
    await SecureStore.setItemAsync(KEY_DAILY_VAULT_KEY, encryptedBundleStr);
  }
}

export async function clearAllSecureStorage(): Promise<void> {
  const keys = [
    KEY_CONFIGURED,
    KEY_SALT,
    KEY_MASTER_HASH,
    KEY_DAILY_HASH,
    KEY_DAILY_VAULT_KEY,
    KEY_EMERGENCY_HASH,
    KEY_SECURITY_QUESTION,
    KEY_SECURITY_ANSWER_HASH,
    KEY_SESSION_KEY,
  ];

  for (const key of keys) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignora erro se chave nao existir
    }
  }
}
