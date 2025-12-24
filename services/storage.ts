import { JournalEntry } from '../types';

const STORAGE_KEY = 'soullog_entries_v1';

export const saveEntry = (entry: JournalEntry): void => {
  const existing = getEntries();
  // Filter out existing entry for this ID if updating, though we usually just append or overwrite by date
  const filtered = existing.filter(e => e.date !== entry.date); 
  filtered.push(entry);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    alert("存储空间已满，无法保存更多录音或图片。请清理浏览器缓存。");
    console.error("Storage full", e);
  }
};

export const getEntries = (): JournalEntry[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const getEntryByDate = (date: string): JournalEntry | undefined => {
  const entries = getEntries();
  return entries.find(e => e.date === date);
};

export const deleteEntry = (date: string): void => {
  const existing = getEntries();
  const filtered = existing.filter(e => e.date !== date);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};