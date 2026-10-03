export type AuthMode = 'setup' | 'locked' | 'unlocked';

export interface SecurityConfig {
  isConfigured: boolean;
  biometricsEnabled: boolean;
  faceRecognitionEnabled: boolean;
  autoLockMinutes: 1 | 5 | 15;
  biometricPerItem: boolean;
  locationLockEnabled: boolean;
  safeLatitude?: number;
  safeLongitude?: number;
  safeRadiusMeters?: number;
  offlineOnly: boolean;
  highContrast: boolean;
  fullScreen: boolean;
}

export interface AccessLog {
  id: string;
  timestamp: number;
  success: boolean;
  method: 'pin' | 'biometric' | 'face' | 'fallback' | 'duress';
  detail?: string;
}

export interface AuthState {
  isReady: boolean;
  mode: AuthMode;
  failedAttempts: number;
  /** Timestamp (ms) ate quando o teclado fica bloqueado. 0 = sem bloqueio. */
  lockoutUntil: number;
  lastAccessTime?: number;
  config: SecurityConfig;
}
