import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { AuthState, SecurityConfig, AccessLog } from '../types/auth';
import {
  hashPin, generateRandomHex, clearKeyCache,
  PBKDF2_ITERATIONS, LEGACY_PBKDF2_ITERATIONS,
} from '../crypto/aes';
import {
  isVaultConfigured, setVaultConfigured,
  getMasterSalt, setMasterSalt,
  getMasterHash, setMasterHash,
  getEmergencyHash, setEmergencyHash,
  getKdfIterations, setKdfIterations,
  getAttemptState, setAttemptState,
  setSessionSecret, clearAllSecureStorage,
} from '../storage/secureStorage';
import { deleteVault, saveAccessLog } from '../storage/vaultStorage';

/** Numero de erros que apaga o cofre. */
export const MAX_FAILED_ATTEMPTS = 10;

/** Tempo de bloqueio (s) apos N erros consecutivos. */
export function lockoutSecondsFor(failedAttempts: number): number {
  if (failedAttempts >= 5) return 30;
  if (failedAttempts >= 3) return 5;
  return 0;
}

const DEFAULT_CONFIG: SecurityConfig = {
  isConfigured: false,
  // Biometria pertence a Sprint 2 (US09/US10): desativada nesta entrega.
  biometricsEnabled: false,
  faceRecognitionEnabled: false,
  autoLockMinutes: 5,
  biometricPerItem: false,
  locationLockEnabled: false,
  offlineOnly: true,
  highContrast: false,
  fullScreen: false,
};

const initialState: AuthState = {
  isReady: false,
  mode: 'setup',
  failedAttempts: 0,
  lockoutUntil: 0,
  config: DEFAULT_CONFIG,
};

type Action =
  | { type: 'INIT'; configured: boolean; failedAttempts: number; lockoutUntil: number }
  | { type: 'UNLOCK' }
  | { type: 'LOCK' }
  | { type: 'FAIL_ATTEMPT'; failedAttempts: number; lockoutUntil: number }
  | { type: 'WIPE' };

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case 'INIT':
      return {
        ...state,
        isReady: true,
        mode: action.configured ? 'locked' : 'setup',
        failedAttempts: action.failedAttempts,
        lockoutUntil: action.lockoutUntil,
        config: { ...DEFAULT_CONFIG, isConfigured: action.configured },
      };
    case 'UNLOCK':
      return {
        ...state,
        mode: 'unlocked',
        failedAttempts: 0,
        lockoutUntil: 0,
        lastAccessTime: Date.now(),
        config: { ...state.config, isConfigured: true },
      };
    case 'LOCK':
      return { ...state, mode: 'locked' };
    case 'FAIL_ATTEMPT':
      return { ...state, failedAttempts: action.failedAttempts, lockoutUntil: action.lockoutUntil };
    case 'WIPE':
      return { ...initialState, isReady: true, mode: 'setup' };
    default:
      return state;
  }
}

/**
 * Resultado da tentativa de desbloqueio:
 * - unlocked: PIN mestre correto, cofre aberto
 * - wrong: PIN incorreto (tentativa contabilizada)
 * - locked: ainda dentro do tempo de bloqueio (tentativa ignorada)
 * - emergency: PIN de emergencia digitado, dados apagados
 * - wiped: limite de tentativas atingido, dados apagados
 */
export type UnlockResult = 'unlocked' | 'wrong' | 'locked' | 'emergency' | 'wiped';

interface AuthContextType {
  state: AuthState;
  setupVault: (pin: string, emergencyPin: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<UnlockResult>;
  lock: () => void;
  wipeAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa do AuthProvider');
  return ctx;
}

async function logAccess(success: boolean, method: AccessLog['method'], detail?: string) {
  try {
    await saveAccessLog({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      success,
      method,
      detail,
    });
  } catch {
    // Falha no log nunca deve impedir o login.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    (async () => {
      const configured = await isVaultConfigured();
      const attempts = configured
        ? await getAttemptState()
        : { failedAttempts: 0, lockoutUntil: 0 };
      dispatch({ type: 'INIT', configured, ...attempts });
    })();
  }, []);

  const wipeAll = useCallback(async () => {
    await deleteVault();
    await clearAllSecureStorage();
    clearKeyCache();
    dispatch({ type: 'WIPE' });
  }, []);

  const setupVault = useCallback(async (pin: string, emergencyPin: string) => {
    // Garante que nao sobrou nenhum cofre antigo que nao poderia ser aberto.
    await deleteVault();

    const salt = await generateRandomHex(16);
    await setMasterSalt(salt);
    await setKdfIterations(PBKDF2_ITERATIONS);
    await setMasterHash(hashPin(pin, salt, PBKDF2_ITERATIONS));
    await setEmergencyHash(hashPin(emergencyPin, salt, PBKDF2_ITERATIONS));
    await setAttemptState({ failedAttempts: 0, lockoutUntil: 0 });

    await setSessionSecret(pin);
    await setVaultConfigured(true);

    dispatch({ type: 'UNLOCK' });
  }, []);

  const unlockWithPin = useCallback(async (pin: string): Promise<UnlockResult> => {
    // Le o estado persistido (fonte da verdade) em vez do estado React,
    // evitando closures desatualizadas e burla por reinicio do app.
    const attempts = await getAttemptState();
    if (Date.now() < attempts.lockoutUntil) return 'locked';

    const salt = await getMasterSalt();
    if (!salt) return 'wrong';

    const iterations = (await getKdfIterations()) ?? LEGACY_PBKDF2_ITERATIONS;
    const inputHash = hashPin(pin, salt, iterations);

    const emergencyHash = await getEmergencyHash();
    if (emergencyHash && inputHash === emergencyHash) {
      await wipeAll();
      return 'emergency';
    }

    const masterHash = await getMasterHash();
    if (masterHash && inputHash === masterHash) {
      await setAttemptState({ failedAttempts: 0, lockoutUntil: 0 });
      await setSessionSecret(pin);
      await logAccess(true, 'pin');
      dispatch({ type: 'UNLOCK' });
      return 'unlocked';
    }

    const failedAttempts = attempts.failedAttempts + 1;
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await wipeAll();
      return 'wiped';
    }

    const seconds = lockoutSecondsFor(failedAttempts);
    const lockoutUntil = seconds > 0 ? Date.now() + seconds * 1000 : 0;
    await setAttemptState({ failedAttempts, lockoutUntil });
    await logAccess(false, 'pin');
    dispatch({ type: 'FAIL_ATTEMPT', failedAttempts, lockoutUntil });
    return 'wrong';
  }, [wipeAll]);

  const lock = useCallback(() => {
    // Descarta o PIN e as chaves derivadas da memoria ao trancar.
    setSessionSecret(null).catch(() => {});
    clearKeyCache();
    dispatch({ type: 'LOCK' });
  }, []);

  return (
    <AuthContext.Provider value={{
      state,
      setupVault,
      unlockWithPin,
      lock,
      wipeAll,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
