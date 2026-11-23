import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { encryptData, decryptData } from '../crypto/aes';
import type { EncryptedBundle } from '../crypto/aes';
import { evaluateStrength } from '../crypto/generator';
import type { VaultData } from '../types/vault';

interface BackupPayload {
  format: 'guardiao-pessoal-backup';
  version: 1;
  exportedAt: number;
  vault: VaultData;
}

function buildTimestampTag(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * US24: Exporta todas as senhas e notas em arquivo criptografado (AES-256 + PBKDF2)
 * protegido pela senha de backup informada pelo usuario.
 */
export async function exportEncryptedBackup(
  vault: VaultData,
  backupPassword: string
): Promise<string> {
  if (!backupPassword || backupPassword.length < 4) {
    throw new Error('A senha de backup deve ter pelo menos 4 caracteres.');
  }

  const payload: BackupPayload = {
    format: 'guardiao-pessoal-backup',
    version: 1,
    exportedAt: Date.now(),
    vault,
  };

  const bundle = await encryptData(JSON.stringify(payload), backupPassword);
  const filename = `guardiao_backup_${buildTimestampTag()}.gpbackup`;
  const file = new File(Paths.document, filename);
  file.create({ overwrite: true });
  file.write(JSON.stringify(bundle, null, 2));

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Exportar Backup Criptografado',
    });
  }

  return filename;
}

/**
 * US24: Abre o seletor de arquivos do sistema para escolher um backup criptografado.
 */
export async function pickBackupFileContent(): Promise<{
  name: string;
  content: string;
} | null> {
  const picked = await File.pickFileAsync({
    multipleFiles: false,
  });

  if (picked.canceled || !picked.result) {
    return null;
  }

  const content = await picked.result.text();
  return {
    name: picked.result.name,
    content,
  };
}

/**
 * US24: Descriptografa e valida um backup exportado pelo Guardiao Pessoal.
 */
export function decryptBackupContent(
  rawJson: string,
  backupPassword: string
): VaultData {
  let bundle: EncryptedBundle;
  try {
    bundle = JSON.parse(rawJson) as EncryptedBundle;
  } catch {
    throw new Error('Arquivo de backup inválido (JSON malformado).');
  }

  if (!bundle.ciphertext || !bundle.salt || !bundle.iv) {
    throw new Error('Arquivo não corresponde a um backup criptografado válido.');
  }

  let decryptedJson: string;
  try {
    decryptedJson = decryptData(bundle, backupPassword);
  } catch {
    throw new Error('Senha de backup incorreta ou arquivo corrompido.');
  }

  const parsed = JSON.parse(decryptedJson) as Partial<BackupPayload>;
  if (
    parsed.format !== 'guardiao-pessoal-backup' ||
    !parsed.vault ||
    !Array.isArray(parsed.vault.passwords) ||
    !Array.isArray(parsed.vault.notes)
  ) {
    throw new Error('Estrutura interna do backup inválida.');
  }

  return parsed.vault;
}

/**
 * US25: Exporta um relatorio de forca das senhas e resumo das notas em texto simples.
 */
export async function exportStrengthReportPlaintext(
  vault: VaultData
): Promise<string> {
  const passwords = vault.passwords || [];
  const notes = vault.notes || [];

  let strong = 0;
  let medium = 0;
  let weak = 0;
  const counts = new Map<string, number>();

  passwords.forEach(p => {
    const s = evaluateStrength(p.password);
    if (s >= 3) strong++;
    else if (s === 2) medium++;
    else weak++;
    counts.set(p.password, (counts.get(p.password) || 0) + 1);
  });

  let reused = 0;
  counts.forEach(c => {
    if (c > 1) reused += c;
  });

  const total = passwords.length;
  const score =
    total === 0
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((strong * 100 + medium * 50 + weak * 10) / total) -
                (reused / total) * 30
            )
          )
        );

  const lines: string[] = [
    '====================================================',
    'GUARDIAO PESSOAL - RELATORIO DE FORCA E AUDITORIA',
    '====================================================',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Indice de Saude do Cofre: ${score}%`,
    '',
    '--- RESUMO DAS CREDENCIAIS ---',
    `Total de senhas: ${total}`,
    `Fortes: ${strong}`,
    `Medias: ${medium}`,
    `Fracas: ${weak}`,
    `Reutilizadas: ${reused}`,
    '',
    '--- DETALHAMENTO DE SENHAS ---',
  ];

  if (passwords.length === 0) {
    lines.push('Nenhuma credencial cadastrada.');
  } else {
    passwords.forEach((p, idx) => {
      const s = evaluateStrength(p.password);
      const label = s >= 3 ? 'FORTE' : s === 2 ? 'MEDIA' : 'FRACA';
      const isReused = (counts.get(p.password) || 0) > 1;
      lines.push(
        `${idx + 1}. ${p.service} (${p.username}) | Forca: ${label} | Tamanho: ${p.password.length} chars${
          isReused ? ' | [REUTILIZADA]' : ''
        }`
      );
      if (p.warning) {
        lines.push(`   Observacao: ${p.warning}`);
      }
    });
  }

  lines.push('');
  lines.push('--- RESUMO DAS NOTAS CONFIDENCIAIS ---');
  lines.push(`Total de notas: ${notes.length}`);

  if (notes.length === 0) {
    lines.push('Nenhuma nota cadastrada.');
  } else {
    notes.forEach((n, idx) => {
      const flags: string[] = [];
      if (n.isFavorite) flags.push('Favorita');
      if (n.linkedPasswordId) flags.push('Vinculada a senha');
      if (n.expiresAt) {
        flags.push(`Expira em ${new Date(n.expiresAt).toLocaleString('pt-BR')}`);
      }
      lines.push(
        `${idx + 1}. ${n.title} (${n.content.length} caracteres)${
          flags.length > 0 ? ` | ${flags.join(', ')}` : ''
        }`
      );
    });
  }

  lines.push('');
  lines.push('AVISO: Arquivo exportado em texto simples conforme solicitacao.');

  const filename = `guardiao_relatorio_forca_${buildTimestampTag()}.txt`;
  const file = new File(Paths.document, filename);
  file.create({ overwrite: true });
  file.write(lines.join('\n'));

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/plain',
      dialogTitle: 'Exportar Relatório de Força',
    });
  }

  return filename;
}
