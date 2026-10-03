import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { VaultData, PasswordItem, NoteItem, CategoryItem, FolderItem } from '../types/vault';
import { saveVault, loadVault } from '../storage/vaultStorage';
import { getSessionSecret } from '../storage/secureStorage';
import { useAuth } from './AuthContext';

interface VaultContextType {
  vault: VaultData | null;
  loading: boolean;
  /** Mensagem de erro ao abrir o cofre (ex.: dados corrompidos). */
  error: string | null;
  addPassword: (item: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt' | 'history'>) => Promise<void>;
  updatePassword: (id: string, changes: Partial<PasswordItem>) => Promise<void>;
  deletePassword: (id: string) => Promise<void>;
  addNote: (item: Omit<NoteItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateNote: (id: string, changes: Partial<NoteItem>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  addCategory: (item: Omit<CategoryItem, 'id'>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addFolder: (item: Omit<FolderItem, 'id'>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

const VaultContext = createContext<VaultContextType | null>(null);

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault precisa do VaultProvider');
  return ctx;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const [vault, setVault] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Criptografa e grava. Lanca erro se falhar (a tela deve avisar o usuario). */
  const persist = useCallback(async (data: VaultData) => {
    const secret = await getSessionSecret();
    if (!secret) throw new Error('Sessao expirada. Desbloqueie o cofre novamente.');
    const updated = { ...data, updatedAt: Date.now() };
    await saveVault(updated, secret);
    setVault(updated);
  }, []);

  const requireVault = useCallback((): VaultData => {
    if (!vault) throw new Error('O cofre nao esta carregado.');
    return vault;
  }, [vault]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const secret = await getSessionSecret();
      if (!secret) throw new Error('Sessao expirada.');
      const data = await loadVault(secret);
      setVault(data);
    } catch {
      setVault(null);
      setError('Nao foi possivel abrir o cofre. Os dados podem estar corrompidos ou foram alterados.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (state.mode === 'unlocked') {
      reload();
    }
  }, [state.mode, reload]);

  const addPassword = useCallback(async (item: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt' | 'history'>) => {
    const current = requireVault();
    const now = Date.now();
    const newItem: PasswordItem = {
      ...item,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      history: [],
    };
    await persist({ ...current, passwords: [...current.passwords, newItem] });
  }, [requireVault, persist]);

  const updatePassword = useCallback(async (id: string, changes: Partial<PasswordItem>) => {
    const current = requireVault();
    const passwords = current.passwords.map(p => {
      if (p.id !== id) return p;
      const historyEntry = changes.password && changes.password !== p.password
        ? [{ id: generateId(), password: p.password, modifiedAt: p.updatedAt }]
        : [];
      return {
        ...p,
        ...changes,
        updatedAt: Date.now(),
        history: [...p.history, ...historyEntry],
      };
    });
    await persist({ ...current, passwords });
  }, [requireVault, persist]);

  const deletePassword = useCallback(async (id: string) => {
    const current = requireVault();
    await persist({ ...current, passwords: current.passwords.filter(p => p.id !== id) });
  }, [requireVault, persist]);

  const addNote = useCallback(async (item: Omit<NoteItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!vault) return;
    const now = Date.now();
    const newItem: NoteItem = { ...item, id: generateId(), createdAt: now, updatedAt: now };
    await persist({ ...vault, notes: [...vault.notes, newItem] });
  }, [vault, persist]);

  const updateNote = useCallback(async (id: string, changes: Partial<NoteItem>) => {
    if (!vault) return;
    const notes = vault.notes.map(n =>
      n.id === id ? { ...n, ...changes, updatedAt: Date.now() } : n
    );
    await persist({ ...vault, notes });
  }, [vault, persist]);

  const deleteNote = useCallback(async (id: string) => {
    if (!vault) return;
    await persist({ ...vault, notes: vault.notes.filter(n => n.id !== id) });
  }, [vault, persist]);

  const addCategory = useCallback(async (item: Omit<CategoryItem, 'id'>) => {
    if (!vault) return;
    const newItem: CategoryItem = { ...item, id: generateId() };
    await persist({ ...vault, categories: [...vault.categories, newItem] });
  }, [vault, persist]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!vault) return;
    await persist({ ...vault, categories: vault.categories.filter(c => c.id !== id) });
  }, [vault, persist]);

  const addFolder = useCallback(async (item: Omit<FolderItem, 'id'>) => {
    if (!vault) return;
    const newItem: FolderItem = { ...item, id: generateId() };
    await persist({ ...vault, folders: [...vault.folders, newItem] });
  }, [vault, persist]);

  const deleteFolder = useCallback(async (id: string) => {
    if (!vault) return;
    await persist({ ...vault, folders: vault.folders.filter(f => f.id !== id) });
  }, [vault, persist]);

  return (
    <VaultContext.Provider value={{
      vault, loading, error,
      addPassword, updatePassword, deletePassword,
      addNote, updateNote, deleteNote,
      addCategory, deleteCategory,
      addFolder, deleteFolder,
      reload,
    }}>
      {children}
    </VaultContext.Provider>
  );
}
