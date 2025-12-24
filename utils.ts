
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getMonthDays = (year: number, month: number) => {
  const date = new Date(year, month, 1);
  const days = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

export const getWeekDayStart = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

export const hexToRgba = (hex: string, alpha: number): string => {
  let c: any;
  if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
      c= hex.substring(1).split('');
      if(c.length== 3){
          c= [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c= '0x'+c.join('');
      return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
  }
  return hex;
}

// --- MOOD PALETTE SYSTEM ---

type MoodIntensity = 'light' | 'medium' | 'strong';

interface MoodColorDefinition {
  light: string;
  medium: string;
  strong: string;
}

// Optimized Palette: Light colors are now distinct pastels for full-screen backgrounds
export const MOOD_PALETTE: Record<string, MoodColorDefinition> = {
  happy: { light: '#FFF5D1', medium: '#FFD166', strong: '#F4B942' },    // Buttery Yellow
  calm: { light: '#E0F5F5', medium: '#A8DADC', strong: '#457B9D' },     // Soft Mint/Teal
  neutral: { light: '#F2F0E9', medium: '#A3A398', strong: '#5C5C54' },  // Warm Parchment/Beige (Not Gray)
  sad: { light: '#E3E6F5', medium: '#7D8CC4', strong: '#5C6AA8' },      // Periwinkle
  anxious: { light: '#FFEBD6', medium: '#F4A261', strong: '#E76F51' },  // Pale Apricot
  angry: { light: '#FFE0DB', medium: '#E76F51', strong: '#C0392B' },    // Blush Red
  tired: { light: '#E8EDF2', medium: '#94A3B8', strong: '#475569' },    // Cool Mist
};

export const MOOD_LABELS: Record<string, string> = {
  happy: '开心',
  calm: '平静',
  neutral: '平淡',
  sad: '低落',
  anxious: '焦虑',
  angry: '生气',
  tired: '疲惫',
};

export const getMoodColor = (key: string, score: number, type: MoodIntensity = 'medium'): string => {
  const safeKey = MOOD_PALETTE[key] ? key : 'neutral';
  return MOOD_PALETTE[safeKey][type];
};

export const getMoodColorByScore = (key: string, score: number): string => {
  const safeKey = MOOD_PALETTE[key] ? key : 'neutral';
  if (score >= 8) return MOOD_PALETTE[safeKey].strong;
  if (score >= 4) return MOOD_PALETTE[safeKey].medium;
  return MOOD_PALETTE[safeKey].light;
}
