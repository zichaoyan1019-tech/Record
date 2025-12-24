
export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  audioBase64?: string; // Stored as base64
  images: string[]; // Array of base64 images
  transcription: string;
  moodEmoji: string;
  moodDescription: string;
  moodKey: string; // 'happy', 'sad', 'calm', etc.
  moodScore: number; // 1-10
  tasks: TaskItem[]; // Updated from string[]
  createdAt: number;
}

export interface DayStats {
  date: string;
  hasEntry: boolean;
  mood?: string;
}

export interface AnalysisResult {
  transcription: string;
  moodEmoji: string;
  moodDescription: string;
  moodKey: string;
  moodScore: number;
  tasks: string[]; // Raw strings from AI
}
