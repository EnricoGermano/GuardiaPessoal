import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';

/** Iteracoes PBKDF2 usadas em novos dados. */
export const PBKDF2_ITERATIONS = 10000;
/** Iteracoes usadas pela versao antiga (bundles sem campo `iterations`). */
export const LEGACY_PBKDF2_ITERATIONS = 5000;

/**
 * Formato do pacote criptografado.
 * - v2: AES-256-CBC + HMAC-SHA256 (encrypt-then-MAC) sobre iv + ciphertext.
 * - v1 (legado, sem `v`): AES-256-CBC + SHA-256 sem chave (apenas leitura).
 */
export interface EncryptedBundle {
  v?: 2;
  ciphertext: string;
  iv: string;
  salt: string;
  iterations?: number;
  mac?: string;
  checksum?: string;
}

interface KeyPair {
  enc: CryptoJS.lib.WordArray;
  mac: CryptoJS.lib.WordArray;
}

/**
 * Cache de chaves derivadas (PBKDF2 e lento em JS). Fica apenas em memoria
 * durante a sessao e e limpo por `clearKeyCache()` ao trancar o cofre.
 */
const keyCache = new Map<string, CryptoJS.lib.WordArray>();

export function clearKeyCache(): void {
  keyCache.clear();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Gera bytes aleatorios com o CSPRNG nativo. Nao existe fallback para
 * Math.random: se o gerador seguro falhar, a operacao falha.
 */
export async function generateRandomHex(byteCount = 16): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteCount);
  if (!bytes || bytes.length !== byteCount) {
    throw new Error('Gerador aleatorio seguro indisponivel.');
  }
  return bytesToHex(bytes);
}

export function computeSha256(text: string): string {
  return CryptoJS.SHA256(text).toString(CryptoJS.enc.Hex);
}

export function deriveKey(
  secret: string,
  saltHex: string,
  iterations: number = PBKDF2_ITERATIONS,
): CryptoJS.lib.WordArray {
  const cacheKey = computeSha256(`${iterations}:${saltHex}:${secret}`);
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;

  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const derived = CryptoJS.PBKDF2(secret, salt, {
    keySize: 256 / 32,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });

  keyCache.set(cacheKey, derived);
  return derived;
}

/** Separa a chave mestra em chave de cifra e chave de MAC (HMAC-based KDF). */
function splitKeys(master: CryptoJS.lib.WordArray): KeyPair {
  return {
    enc: CryptoJS.HmacSHA256('guardiao-enc', master),
    mac: CryptoJS.HmacSHA256('guardiao-mac', master),
  };
}

function computeMac(macKey: CryptoJS.lib.WordArray, ivHex: string, ciphertext: string): string {
  return CryptoJS.HmacSHA256(`${ivHex}:${ciphertext}`, macKey).toString(CryptoJS.enc.Hex);
}

/** Comparacao em tempo constante para evitar vazamento por tempo. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function encryptWithKeys(
  data: string,
  keys: KeyPair,
  saltHex: string,
  iterations: number,
): Promise<EncryptedBundle> {
  const ivHex = await generateRandomHex(16);
  const encrypted = CryptoJS.AES.encrypt(data, keys.enc, {
    iv: CryptoJS.enc.Hex.parse(ivHex),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const ciphertext = encrypted.toString();

  return {
    v: 2,
    ciphertext,
    iv: ivHex,
    salt: saltHex,
    iterations,
    mac: computeMac(keys.mac, ivHex, ciphertext),
  };
}

function decryptWithKeys(bundle: EncryptedBundle, keys: KeyPair): string {
  if (!bundle.mac || !safeEqual(computeMac(keys.mac, bundle.iv, bundle.ciphertext), bundle.mac)) {
    throw new Error('Falha de autenticacao: PIN incorreto ou dados adulterados.');
  }
  const decrypted = CryptoJS.AES.decrypt(bundle.ciphertext, keys.enc, {
    iv: CryptoJS.enc.Hex.parse(bundle.iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * Criptografa com chave derivada do segredo via PBKDF2.
 * `reuseSaltHex` permite manter o salt do cofre entre salvamentos (o IV
 * continua aleatorio a cada vez), evitando refazer o PBKDF2 a cada save.
 */
export async function encryptData(
  data: string,
  secret: string,
  reuseSaltHex?: string,
): Promise<EncryptedBundle> {
  const saltHex = reuseSaltHex || (await generateRandomHex(16));
  const keys = splitKeys(deriveKey(secret, saltHex, PBKDF2_ITERATIONS));
  return encryptWithKeys(data, keys, saltHex, PBKDF2_ITERATIONS);
}

export function decryptData(bundle: EncryptedBundle, secret: string): string {
  if (bundle.v === 2) {
    const keys = splitKeys(deriveKey(secret, bundle.salt, bundle.iterations || PBKDF2_ITERATIONS));
    const plain = decryptWithKeys(bundle, keys);
    if (!plain) throw new Error('Senha incorreta ou falha na decriptacao.');
    return plain;
  }

  // Formato legado (v1): apenas leitura, sera regravado em v2 no proximo save.
  if (!bundle.checksum || computeSha256(bundle.ciphertext) !== bundle.checksum) {
    throw new Error('Falha de integridade: os dados foram corrompidos ou alterados.');
  }
  const key = deriveKey(secret, bundle.salt, LEGACY_PBKDF2_ITERATIONS);
  const decrypted = CryptoJS.AES.decrypt(bundle.ciphertext, key, {
    iv: CryptoJS.enc.Hex.parse(bundle.iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const plainText = decrypted.toString(CryptoJS.enc.Utf8);
  if (!plainText) throw new Error('Senha incorreta ou falha na decriptacao.');
  return plainText;
}

/** Criptografa com uma chave aleatoria de 256 bits (sem PBKDF2). */
export async function encryptWithRawKey(data: string, keyHex: string): Promise<EncryptedBundle> {
  const keys = splitKeys(CryptoJS.enc.Hex.parse(keyHex));
  return encryptWithKeys(data, keys, '', 0);
}

export function decryptWithRawKey(bundle: EncryptedBundle, keyHex: string): string {
  return decryptWithKeys(bundle, splitKeys(CryptoJS.enc.Hex.parse(keyHex)));
}

export function hashPin(pin: string, saltHex: string, iterations: number = PBKDF2_ITERATIONS): string {
  return deriveKey(pin, saltHex, iterations).toString(CryptoJS.enc.Hex);
}
