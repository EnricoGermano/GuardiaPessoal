import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { AuthState, SecurityConfig, AccessLog } from '../types/auth';
import { hashPin, generateRandomHex, encryptData, decryptData } from '../crypto/aes';
import {
  isVaultConfigured, setVaultConfigured,
  getMasterSalt, setMasterSalt,
  getMasterHash, setMasterHash,
  getDailyHash, setDailyHash,
  getDailyVaultKey, setDailyVaultKey,
  getEmergencyHash, setEmergencyHash,
  setSecurityQuestion, setSecurityAnswerHash,
  getSecurityQuestion, getSecurityAnswerHash,
  setSessionSecret, clearAllSecureStorage,
} from '../storage/secureStorage';
import { deleteVault, saveAccessLog } from '../storage/vaultStorage';

const DEFAULT_CONFIG: SecurityConfig = {
  isConfigured: false,
  biometricsEnabled: true,
  faceRecognitionEnabled: true,
  autoLockMinutes: 5,
  biometricPerItem: false,
  locationLockEnabled: false,
  offlineOnly: true,
  highContrast: false,
  fullScreen: false,
  securityQuestion: '',
};

const initialState: AuthState = {
  isReady: false,
  mode: 'setup',
  failedAttempts: 0,
  lockoutSeconds: 0,
  config: DEFAULT_CONFIG,
};

type Action =
  | { type: 'INIT'; configured: boolean; config: SecurityConfig }
  | { type: 'UNLOCK'; decoy?: boolean }
  | { type: 'LOCK' }
  | { type: 'FAIL_ATTEMPT' }
  | { type: 'RESET_ATTEMPTS' }
  | { type: 'SET_LOCKOUT'; seconds: number }
  | { type: 'UPDATE_CONFIG'; config: Partial<SecurityConfig> }
  | { type: 'WIPE' };

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case 'INIT':
      return {
        ...state,
        isReady: true,
        mode: action.configured ? 'locked' : 'setup',
        config: action.config,
      };
    case 'UNLOCK':
      return {
        ...state,
        mode: action.decoy ? 'decoy' : 'unlocked',
        failedAttempts: 0,
        lockoutSeconds: 0,
        lastAccessTime: Date.now(),
      };
    case 'LOCK':
      return { ...state, mode: 'locked' };
    case 'FAIL_ATTEMPT': {
      const attempts = state.failedAttempts + 1;
      let lockout = 0;
      if (attempts >= 5) lockout = 30;
      else if (attempts >= 3) lockout = 5;
      return { ...state, failedAttempts: attempts, lockoutSeconds: lockout };
    }
    case 'RESET_ATTEMPTS':
      return { ...state, failedAttempts: 0, lockoutSeconds: 0 };
    case 'SET_LOCKOUT':
      return { ...state, lockoutSeconds: action.seconds };
    case 'UPDATE_CONFIG':
      return { ...state, config: { ...state.config, ...action.config } };
    case 'WIPE':
      return { ...initialState, isReady: true, mode: 'setup' };
    default:
      return state;
  }
}

interface AuthContextType {
  state: AuthState;
  setupVault: (pin: string, emergencyPin: string, dailyPin: string | null, secQuestion: string, secAnswer: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<'master' | 'daily' | 'emergency' | false>;
  unlock: (secret: string, decoy?: boolean) => Promise<void>;
  unlockDaily: (dailyPin: string) => Promise<boolean>;
  lock: () => void;
  wipeAll: () => Promise<void>;
  changeMasterPin: (oldPin: string, newPin: string) => Promise<boolean>;
  updateConfig: (config: Partial<SecurityConfig>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa do AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    (async () => {
      const configured = await isVaultConfigured();
      dispatch({ type: 'INIT', configured, config: { ...DEFAULT_CONFIG, isConfigured: configured } });
    })();
  }, []);

  const logAccess = useCallback(async (success: boolean, method: AccessLog['method'], detail?: string) => {
    await saveAccessLog({
      id: Date.now().toString(),
      timestamp: Date.now(),
      success,
      method,
      detail,
    });
  }, []);

  const setupVault = useCallback(async (
    pin: string,
    emergencyPin: string,
    dailyPin: string | null,
    secQuestion: string,
    secAnswer: string,
  ) => {
    const salt = await generateRandomHex(16);
    const masterHash = hashPin(pin, salt);
    const emergencyHash = hashPin(emergencyPin, salt);

    await setMasterSalt(salt);
    await setMasterHash(masterHash);
    await setEmergencyHash(emergencyHash);

    if (dailyPin) {
      const dHash = hashPin(dailyPin, salt);
      await setDailyHash(dHash);
      const encryptedMaster = await encryptData(pin, dailyPin);
      await setDailyVaultKey(JSON.stringify(encryptedMaster));
    }

    await setSecurityQuestion(secQuestion);
    const answerHash = hashPin(secAnswer.toLowerCase().trim(), salt);
    await setSecurityAnswerHash(answerHash);

    await setSessionSecret(pin);
    await setVaultConfigured(true);

    dispatch({ type: 'UNLOCK' });
  }, []);

  const unlockDaily = useCallback(async (dailyPin: string): Promise<boolean> => {
    const dailyVaultKeyStr = await getDailyVaultKey();
    if (!dailyVaultKeyStr) return false;
    try {
      const bundle = JSON.parse(dailyVaultKeyStr);
      const masterSecret = decryptData(bundle, dailyPin);
      await setSessionSecret(masterSecret);
      dispatch({ type: 'UNLOCK', decoy: false });
      return true;
    } catch {
      return false;
    }
  }, []);

  const verifyPin = useCallback(async (pin: string): Promise<'master' | 'daily' | 'emergency' | false> => {
    if (state.lockoutSeconds > 0) return false;

    const salt = await getMasterSalt();
    if (!salt) return false;

    const inputHash = hashPin(pin, salt);

    const emergencyHash = await getEmergencyHash();
    if (emergencyHash && inputHash === emergencyHash) {
      await logAccess(true, 'duress');
      return 'emergency';
    }

    const masterHash = await getMasterHash();
    if (masterHash && inputHash === masterHash) {
      await logAccess(true, 'pin');
      return 'master';
    }

    const dailyHash = await getDailyHash();
    if (dailyHash && inputHash === dailyHash) {
      await logAccess(true, 'pin', 'daily');
      return 'daily';
    }

    dispatch({ type: 'FAIL_ATTEMPT' });
    await logAccess(false, 'pin');

    if (state.failedAttempts + 1 >= 10) {
      await wipeAll();
    }

    return false;
  }, [state.lockoutSeconds, state.failedAttempts]);

  const unlock = useCallback(async (secret: string, decoy = false) => {
    await setSessionSecret(secret);
    dispatch({ type: 'UNLOCK', decoy });
  }, []);

  const lock = useCallback(() => {
    dispatch({ type: 'LOCK' });
  }, []);

  const wipeAll = useCallback(async () => {
    await deleteVault();
    await clearAllSecureStorage();
    dispatch({ type: 'WIPE' });
  }, []);

  const changeMasterPin = useCallback(async (oldPin: string, newPin: string): Promise<boolean> => {
    const salt = await getMasterSalt();
    if (!salt) return false;

    const oldHash = hashPin(oldPin, salt);
    const masterHash = await getMasterHash();
    if (oldHash !== masterHash) return false;

    const newHash = hashPin(newPin, salt);
    await setMasterHash(newHash);
    await setSessionSecret(newPin);
    return true;
  }, []);

  const updateConfig = useCallback((config: Partial<SecurityConfig>) => {
    dispatch({ type: 'UPDATE_CONFIG', config });
  }, []);

  return (
    <AuthContext.Provider value={{
      state,
      setupVault,
      verifyPin,
      unlock,
      unlockDaily,
      lock,
      wipeAll,
      changeMasterPin,
      updateConfig,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
