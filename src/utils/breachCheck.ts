import * as Crypto from 'expo-crypto';
import type { PasswordItem } from '../types/vault';

const COMMON_BREACHED_PASSWORDS = new Set([
  '123456', 'password', '12345678', 'qwerty', '123456789', '12345',
  '1234', '111111', '1234567', 'dragon', 'admin', 'welcome', 'login',
  'senha', 'senha123', 'brasil', 'futebol', 'master', 'iloveyou',
  '123123', 'abc123', 'qwerty123', 'letmein', 'monkey', '000000',
  '654321', '1234567890', 'superman', 'batman', 'passw0rd', 'p@ssword',
  'admin123', 'root', 'toor', 'guest', 'teste', 'teste123', 'mudar123',
  '1234qwer', 'qwer1234', 'zxcvbnm', 'asdfgh', '1q2w3e4r', '1qaz2wsx',
  'sunshine', 'princess', 'football', 'baseball', 'soccer', 'chocolate',
  'freedom', 'whatever', 'trustno1', 'starwars', 'access', 'secret',
  'shadow', 'michael', 'jennifer', 'jordan', 'hunter', 'buster',
  'daniel', 'matthew', 'andrew', 'joshua', 'robert', 'gabriel',
  'lucas', 'pedro', 'joao', 'maria', 'amor', 'familia', 'deus',
  'flamengo', 'corinthians', 'palmeiras', 'saopaulo', 'gremio',
]);

export interface BreachCheckResult {
  compromised: boolean;
  source: 'local' | 'hibp' | 'offline_clean';
  occurrences?: number;
  message: string;
}

export function checkPasswordOffline(password: string): BreachCheckResult {
  const normalized = password.trim().toLowerCase();
  if (!normalized) {
    return {
      compromised: false,
      source: 'offline_clean',
      message: 'Digite uma senha para verificar.',
    };
  }

  if (COMMON_BREACHED_PASSWORDS.has(normalized)) {
    return {
      compromised: true,
      source: 'local',
      message: 'ALERTA CRÍTICO: Esta senha consta em listas públicas de senhas vazadas! Substitua imediatamente.',
    };
  }

  if (password.length < 8) {
    return {
      compromised: true,
      source: 'local',
      message: 'AVISO DE RISCO: Senha curta (< 8 caracteres), altamente vulnerável a ataques de força bruta e dicionários vazados.',
    };
  }

  if (/^(.)\1+$/.test(password) || '01234567890'.includes(password) || 'abcdefghijklmnopqrstuvwxyz'.includes(normalized)) {
    return {
      compromised: true,
      source: 'local',
      message: 'AVISO DE RISCO: Padrão sequencial ou repetitivo facilmente explorado em vazamentos.',
    };
  }

  return {
    compromised: false,
    source: 'offline_clean',
    message: 'Nenhuma ocorrência encontrada na base local offline de vazamentos.',
  };
}

/**
 * US26 + US28: Verifica exposicao via API k-Anonymity do HaveIBeenPwned (apenas os 5 primeiros
 * caracteres do hash SHA-1 sao enviados). Bloqueado estritamente quando offlineOnly = true.
 */
export async function checkPasswordBreach(
  password: string,
  offlineOnly: boolean
): Promise<BreachCheckResult> {
  const localResult = checkPasswordOffline(password);
  if (localResult.compromised || offlineOnly) {
    return localResult;
  }

  try {
    const sha1 = (
      await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA1,
        password
      )
    ).toUpperCase();

    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return localResult;
    }

    const body = await response.text();
    const lines = body.split('\n');
    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (hashSuffix === suffix) {
        const count = parseInt(countStr || '1', 10) || 1;
        return {
          compromised: true,
          source: 'hibp',
          occurrences: count,
          message: `ALERTA CRÍTICO (HIBP): Esta senha apareceu ${count.toLocaleString('pt-BR')} vez(es) em vazamentos de dados conhecidos!`,
        };
      }
    }

    return {
      compromised: false,
      source: 'hibp',
      message: 'Nenhuma exposição encontrada na base local nem no HaveIBeenPwned (k-Anonymity).',
    };
  } catch {
    return {
      ...localResult,
      message: 'Sem conexão com a internet. Nenhuma ocorrência encontrada na base local offline.',
    };
  }
}

export interface VaultBreachItem {
  id: string;
  service: string;
  username: string;
  result: BreachCheckResult;
}

export async function auditVaultBreaches(
  passwords: PasswordItem[],
  offlineOnly: boolean
): Promise<VaultBreachItem[]> {
  const compromised: VaultBreachItem[] = [];
  for (const item of passwords) {
    const result = await checkPasswordBreach(item.password, offlineOnly);
    if (result.compromised) {
      compromised.push({
        id: item.id,
        service: item.service,
        username: item.username,
        result,
      });
    }
  }
  return compromised;
}
