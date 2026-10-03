import * as Crypto from 'expo-crypto';

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

const WORDLIST_PT = [
  'arvore', 'barco', 'campo', 'dente', 'escola', 'flor', 'gato', 'hora',
  'ilha', 'janela', 'lago', 'mesa', 'nuvem', 'ouro', 'pedra', 'queda',
  'rede', 'sol', 'terra', 'uva', 'vento', 'xadrez', 'zebra', 'abacate',
  'branco', 'casa', 'dado', 'estrela', 'fogo', 'gelo', 'heroi', 'ideia',
  'jardim', 'limao', 'manga', 'noite', 'oceano', 'porta', 'raio', 'selva',
  'tigre', 'urso', 'viagem', 'yoga', 'azul', 'bola', 'chuva', 'diamante',
];

export interface GeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

function getSecureBytes(count: number): Uint8Array {
  try {
    if (Crypto && typeof Crypto.getRandomBytes === 'function') {
      const nativeBytes = Crypto.getRandomBytes(count);
      if (nativeBytes && nativeBytes.length === count) {
        return nativeBytes;
      }
    }
  } catch {
    // Falha ou indisponivel no runtime especifico
  }

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(count);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  throw new Error('Gerador criptografico seguro indisponivel no dispositivo.');
}

export function generateRandomPassword(options: GeneratorOptions): string {
  let charset = '';
  if (options.lowercase) charset += LOWERCASE;
  if (options.uppercase) charset += UPPERCASE;
  if (options.numbers) charset += NUMBERS;
  if (options.symbols) charset += SYMBOLS;

  if (!charset) charset = LOWERCASE + NUMBERS;

  const bytes = getSecureBytes(options.length);
  let password = '';
  for (let i = 0; i < options.length; i++) {
    password += charset[bytes[i] % charset.length];
  }

  return password;
}

const WORD_SYMBOLS = '!@#$%&*?+=';

export function generateWordPassword(wordCount = 4, separator = '-', includeSymbols = false): string {
  const bytes = getSecureBytes(wordCount + 2);
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(WORDLIST_PT[bytes[i] % WORDLIST_PT.length]);
  }

  const num = (bytes[wordCount] % 99) + 1;
  const symbol = includeSymbols ? WORD_SYMBOLS[bytes[wordCount + 1] % WORD_SYMBOLS.length] : '';
  return words.join(separator) + separator + num + symbol;
}

export function evaluateStrength(password: string): number {
  if (!password) return 0;
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  return Math.min(4, score);
}
