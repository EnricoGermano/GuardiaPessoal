export type ImportanceLevel = 'baixa' | 'media' | 'alta';

export interface PasswordHistoryItem {
  id: string;
  password: string;
  modifiedAt: number;
}

export interface PasswordItem {
  id: string;
  service: string;
  username: string;
  password: string;
  url?: string;
  category: string;
  folderId?: string;
  tags: string[];
  importance: ImportanceLevel;
  warning?: string;
  hint?: string;
  reminderDays?: 30 | 60 | 90;
  createdAt: number;
  updatedAt: number;
  history: PasswordHistoryItem[];
  isHidden?: boolean;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  observations?: string;
  linkedPasswordId?: string;
  isFavorite: boolean;
  imageUri?: string;
  autoDestructDays?: number;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  isHidden?: boolean;
}

export interface CategoryItem {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId?: string;
}

export interface VaultData {
  passwords: PasswordItem[];
  notes: NoteItem[];
  categories: CategoryItem[];
  folders: FolderItem[];
  updatedAt: number;
  version: number;
}
