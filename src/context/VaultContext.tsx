import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { VaultData, PasswordItem, NoteItem, CategoryItem, FolderItem } from '../types/vault';
import { saveVault, loadVault, loadDecoyVault } from '../storage/vaultStorage';
import { getSessionSecret } from '../storage/secureStorage';
import { useAuth } from './AuthContext';

interface VaultContextType {
  vault: VaultData | null;
  loading: boolean;
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

  const persist = useCallback(async (data: VaultData) => {
    const secret = await getSessionSecret();
    if (!secret) return;
    const updated = { ...data, updatedAt: Date.now() };
    setVault(updated);
    await saveVault(updated, secret);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      if (state.mode === 'decoy') {
        const decoy = await loadDecoyVault();
        setVault(decoy);
      } else {
        const secret = await getSessionSecret();
        if (secret) {
          const data = await loadVault(secret);
          setVault(data);
        }
      }
    } catch {
      setVault(null);
    }
    setLoading(false);
  }, [state.mode]);

  useEffect(() => {
    if (state.mode === 'unlocked' || state.mode === 'decoy') {
      reload();
    }
  }, [state.mode, reload]);

  const addPassword = useCallback(async (item: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt' | 'history'>) => {
    if (!vault) return;
    const now = Date.now();
    const newItem: PasswordItem = {
      ...item,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      history: [],
    };
    await persist({ ...vault, passwords: [...vault.passwords, newItem] });
  }, [vault, persist]);

  const updatePassword = useCallback(async (id: string, changes: Partial<PasswordItem>) => {
    if (!vault) return;
    const passwords = vault.passwords.map(p => {
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
    await persist({ ...vault, passwords });
  }, [vault, persist]);

  const deletePassword = useCallback(async (id: string) => {
    if (!vault) return;
    await persist({ ...vault, passwords: vault.passwords.filter(p => p.id !== id) });
  }, [vault, persist]);

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
      vault, loading,
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
