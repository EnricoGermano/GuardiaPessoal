import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';

export interface EncryptedBundle {
  ciphertext: string;
  iv: string;
  salt: string;
  checksum: string;
}

const keyCache = new Map<string, CryptoJS.lib.WordArray>();

export async function generateRandomHex(byteCount = 16): Promise<string> {
  try {
    const bytes = await Crypto.getRandomBytesAsync(byteCount);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    const bytes = new Uint8Array(byteCount);
    for (let i = 0; i < byteCount; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

export function computeSha256(text: string): string {
  return CryptoJS.SHA256(text).toString(CryptoJS.enc.Hex);
}

export function deriveKey(secret: string, saltHex: string): CryptoJS.lib.WordArray {
  const cacheKey = `${secret}:${saltHex}`;
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;

  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const derived = CryptoJS.PBKDF2(secret, salt, {
    keySize: 256 / 32,
    iterations: 5000,
    hasher: CryptoJS.algo.SHA256,
  });

  keyCache.set(cacheKey, derived);
  return derived;
}

export async function encryptData(data: string, secret: string): Promise<EncryptedBundle> {
  const saltHex = await generateRandomHex(16);
  const ivHex = await generateRandomHex(16);
  const key = deriveKey(secret, saltHex);
  const iv = CryptoJS.enc.Hex.parse(ivHex);

  const encrypted = CryptoJS.AES.encrypt(data, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const ciphertext = encrypted.toString();
  const checksum = computeSha256(ciphertext);

  return {
    ciphertext,
    iv: ivHex,
    salt: saltHex,
    checksum,
  };
}

export function decryptData(bundle: EncryptedBundle, secret: string): string {
  const currentChecksum = computeSha256(bundle.ciphertext);
  if (currentChecksum !== bundle.checksum) {
    throw new Error('Falha de integridade: os dados foram corrompidos ou alterados.');
  }

  const key = deriveKey(secret, bundle.salt);
  const iv = CryptoJS.enc.Hex.parse(bundle.iv);

  const decrypted = CryptoJS.AES.decrypt(bundle.ciphertext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const plainText = decrypted.toString(CryptoJS.enc.Utf8);
  if (!plainText) {
    throw new Error('Senha incorreta ou falha na decriptacao.');
  }

  return plainText;
}

export function hashPin(pin: string, saltHex: string): string {
  const key = deriveKey(pin, saltHex);
  return key.toString(CryptoJS.enc.Hex);
}
