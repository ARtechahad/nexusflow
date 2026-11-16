/**
 * Client-Side Local Storage & Offline Database Fallback Service
 *
 * Strictly scoped per (userId, companyId) so cached data never leaks across users
 * or across separate companies owned by the same user.
 */

import { ProjectLead, ChatMessage } from '../types';

const BASE_KEYS = {
  PROJECTS: 'clientops_local_projects',
  TASKS: 'clientops_local_tasks',
  CHAT: 'clientops_local_chat_messages',
  PREFERENCES: 'clientops_local_preferences',
  USER_PROFILES: 'clientops_local_user_profiles',
  SYNC_STATUS: 'clientops_storage_mode'
};

export interface LocalTaskItem {
  id: string;
  projectId: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  step?: number;
  completedAt?: string;
  updatedAt: string;
}

class LocalDatabaseFallback {
  private isStorageAvailable: boolean = true;
  private activeScopeKey: string = '';

  constructor() {
    this.checkStorage();
  }

  public setActiveScope(userId?: string | null, companyId?: string | null): void {
    if (userId && companyId) {
      this.activeScopeKey = `${userId}::${companyId}`;
    } else if (userId) {
      this.activeScopeKey = userId;
    } else {
      this.activeScopeKey = '';
    }
  }

  private getScopedKey(baseKey: string, scopeOverride?: string): string {
    const scope = scopeOverride || this.activeScopeKey;
    if (!scope) {
      return `${baseKey}::unscoped`;
    }
    return `${baseKey}::${scope}`;
  }

  private checkStorage(): boolean {
    if (typeof window === 'undefined') {
      this.isStorageAvailable = false;
      return false;
    }
    try {
      const testKey = '__test_storage__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      this.isStorageAvailable = true;
      return true;
    } catch {
      this.isStorageAvailable = false;
      return false;
    }
  }

  public clearScopedCaches(): void {
    if (!this.checkStorage()) return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (
          k.startsWith(BASE_KEYS.PROJECTS) ||
          k.startsWith(BASE_KEYS.TASKS) ||
          k.startsWith(BASE_KEYS.CHAT) ||
          k === 'clientops_cached_projects'
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[LocalStorageDB] Failed to clear scoped caches:', e);
    }
  }

  // ==========================================
  // PROJECTS & LEADS
  // ==========================================

  public getProjects(scopeOverride?: string): ProjectLead[] {
    if (!this.checkStorage()) return [];
    const scope = scopeOverride || this.activeScopeKey;
    if (!scope) return [];
    try {
      const raw = localStorage.getItem(this.getScopedKey(BASE_KEYS.PROJECTS, scope));
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[LocalStorageDB] Failed to parse projects:', e);
    }
    return [];
  }

  public saveProjects(projects: ProjectLead[], scopeOverride?: string): boolean {
    if (!this.checkStorage()) return false;
    const scope = scopeOverride || this.activeScopeKey;
    if (!scope) return false;
    try {
      localStorage.setItem(this.getScopedKey(BASE_KEYS.PROJECTS, scope), JSON.stringify(projects));
      return true;
    } catch (e) {
      console.warn('[LocalStorageDB] Failed to save projects:', e);
      return false;
    }
  }

  public saveProject(project: Partial<ProjectLead> & { id: string }, scopeOverride?: string): boolean {
    if (!this.checkStorage()) return false;
    const scope = scopeOverride || this.activeScopeKey;
    if (!scope) return false;
    try {
      const current = this.getProjects(scope);
      const idx = current.findIndex(p => p.id === project.id);
      let updated: ProjectLead[];
      const now = new Date().toISOString();

      if (idx >= 0) {
        updated = [...current];
        updated[idx] = {
          ...updated[idx],
          ...project,
          updatedAt: now
        } as ProjectLead;
      } else {
        const newProj = {
          ...project,
          createdAt: project.createdAt || now,
          updatedAt: now
        } as ProjectLead;
        updated = [newProj, ...current];
      }

      this.saveProjects(updated, scope);
      return true;
    } catch (e) {
      console.warn('[LocalStorageDB] Failed to update project:', e);
      return false;
    }
  }

  public deleteProject(projectId: string, scopeOverride?: string): boolean {
    if (!this.checkStorage()) return false;
    const scope = scopeOverride || this.activeScopeKey;
    if (!scope) return false;
    try {
      const current = this.getProjects(scope);
      const filtered = current.filter(p => p.id !== projectId);
      this.saveProjects(filtered, scope);
      return true;
    } catch (e) {
      console.warn('[LocalStorageDB] Failed to delete project:', e);
      return false;
    }
  }

  // ==========================================
  // TASKS
  // ==========================================

  public getTasks(projectId?: string, scopeOverride?: string): LocalTaskItem[] {
    if (!this.checkStorage()) return [];
    const scope = scopeOverride || this.activeScopeKey;
    if (!scope) return [];
    try {
      const raw = localStorage.getItem(this.getScopedKey(BASE_KEYS.TASKS, scope));
      if (raw) {
        const tasks: LocalTaskItem[] = JSON.parse(raw);
        if (projectId) {
          return tasks.filter(t => t.projectId === projectId);
        }
        return tasks;
      }
    } catch (e) {
      console.warn('[LocalStorageDB] Failed to load tasks:', e);
    }
    return [];
  }

  public saveTask(task: LocalTaskItem, scopeOverride?: string): boolean {
    if (!this.checkStorage()) return false;
    const scope = scopeOverride || this.activeScopeKey;
    if (!scope) return false;
    try {
      const current = this.getTasks(undefined, scope);
      const idx = current.findIndex(t => t.id === task.id);
      let updated: LocalTaskItem[];
      if (idx >= 0) {
        updated = [...current];
        updated[idx] = { ...updated[idx], ...task, updatedAt: new Date().toISOString() };
      } else {
        updated = [task, ...current];
      }
      localStorage.setItem(this.getScopedKey(BASE_KEYS.TASKS, scope), JSON.stringify(updated));
      return true;
    } catch (e) {
      console.warn('[LocalStorageDB] Failed to save task:', e);
      return false;
    }
  }

  // ==========================================
  // CHAT MESSAGES
  // ==========================================

  public getChatMessages(channel?: string, scopeOverride?: string): ChatMessage[] {
    if (!this.checkStorage()) return [];
    const scope = scopeOverride || this.activeScopeKey;
    if (!scope) return [];
    try {
      const raw = localStorage.getItem(this.getScopedKey(BASE_KEYS.CHAT, scope));
      if (raw) {
        const messages: ChatMessage[] = JSON.parse(raw);
        if (channel) {
          return messages.filter(m => (m as any).channel === channel);
        }
        return messages;
      }
    } catch (e) {
      console.warn('[LocalStorageDB] Failed to load chat messages:', e);
    }
    return [];
  }

  public saveChatMessage(
    msg: {
      channel: string;
      sender: string;
      role: string;
      text: string;
      timestamp?: string;
    },
    scopeOverride?: string
  ): boolean {
    if (!this.checkStorage()) return false;
    const scope = scopeOverride || this.activeScopeKey;
    if (!scope) return false;
    try {
      const current = this.getChatMessages(undefined, scope);
      const newMsg: ChatMessage = {
        id: `local_chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sender: msg.sender,
        role: msg.role as any,
        text: msg.text,
        content: msg.text,
        timestamp: msg.timestamp || new Date().toISOString(),
        channel: msg.channel
      };

      const updated = [...current.slice(-100), newMsg];
      localStorage.setItem(this.getScopedKey(BASE_KEYS.CHAT, scope), JSON.stringify(updated));
      return true;
    } catch (e) {
      console.warn('[LocalStorageDB] Failed to save chat message:', e);
      return false;
    }
  }

  // ==========================================
  // USER PREFERENCES & PROFILES
  // ==========================================

  public savePreferences(userId: string, prefs: Record<string, any>): boolean {
    if (!this.checkStorage()) return false;
    try {
      const allPrefsRaw = localStorage.getItem(BASE_KEYS.PREFERENCES);
      const allPrefs = allPrefsRaw ? JSON.parse(allPrefsRaw) : {};
      allPrefs[userId] = {
        ...allPrefs[userId],
        ...prefs,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(BASE_KEYS.PREFERENCES, JSON.stringify(allPrefs));
      return true;
    } catch (e) {
      console.warn('[LocalStorageDB] Failed to save preferences:', e);
      return false;
    }
  }

  public getPreferences(userId: string): Record<string, any> | null {
    if (!this.checkStorage()) return null;
    try {
      const allPrefsRaw = localStorage.getItem(BASE_KEYS.PREFERENCES);
      if (allPrefsRaw) {
        const allPrefs = JSON.parse(allPrefsRaw);
        return allPrefs[userId] || null;
      }
    } catch {
      return null;
    }
    return null;
  }
}

export const localDatabase = new LocalDatabaseFallback();
