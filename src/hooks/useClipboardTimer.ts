import { useCallback } from 'react';
import { AppState } from 'react-native';
import * as Clipboard from 'expo-clipboard';

/**
 * Limpeza automatica da area de transferencia (US07).
 *
 * O estado fica no nivel do modulo (e nao dentro de um componente) para que a
 * limpeza NAO seja cancelada quando a tela desmonta - o que acontece sempre
 * que o app vai para segundo plano e o cofre e trancado.
 *
 * Como o Android/iOS pausam timers JS em segundo plano, alem do setTimeout o
 * prazo e verificado sempre que o app volta ao primeiro plano.
 */

let pendingText: string | null = null;
let deadline = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

async function clearIfStillOurs(): Promise<void> {
  const copied = pendingText;
  pendingText = null;
  deadline = 0;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (copied === null) return;

  try {
    // Nao apaga se o usuario copiou outra coisa depois.
    // Em segundo plano o Android nao permite ler o clipboard (retorna vazio),
    // entao nesse caso limpamos por seguranca.
    const current = await Clipboard.getStringAsync().catch(() => '');
    if (current && current !== copied) return;
    await Clipboard.setStringAsync('');
  } catch {
    // ignora
  }
}

function checkDeadline(): void {
  if (pendingText !== null && Date.now() >= deadline) {
    clearIfStillOurs();
  }
}

AppState.addEventListener('change', state => {
  if (state === 'active') checkDeadline();
});

export async function copySensitive(text: string, seconds = 30): Promise<void> {
  await Clipboard.setStringAsync(text);
  pendingText = text;
  deadline = Date.now() + seconds * 1000;
  if (timer) clearTimeout(timer);
  timer = setTimeout(checkDeadline, seconds * 1000);
}

export function clearClipboardNow(): Promise<void> {
  return clearIfStillOurs();
}

export function useClipboardTimer() {
  const copyWithTimer = useCallback((text: string, seconds = 30) => copySensitive(text, seconds), []);
  const clearNow = useCallback(() => clearClipboardNow(), []);
  return { copyWithTimer, clearNow };
}
