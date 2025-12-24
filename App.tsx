
import React, { useState, useEffect } from 'react';
import CalendarView from './components/CalendarView';
import RecordView from './components/RecordView';
import MoodBackground from './components/MoodBackground';
import { getEntries, deleteEntry } from './services/storage';
import { JournalEntry } from './types';
import { formatDate } from './utils';

const App: React.FC = () => {
  const [view, setView] = useState<'calendar' | 'record'>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  // Default to 'en' as user likes the English aesthetic, allow toggle to 'zh'
  const [lang, setLang] = useState<'en' | 'zh'>('en');

  const loadData = () => {
    setEntries(getEntries());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectDate = (date: string) => {
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(10);
    
    setSelectedDate(date);
    setView('record');
  };

  const handleBack = () => {
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(10);

    setView('calendar');
    setSelectedDate('');
    loadData(); // Ensure data is fresh when returning
  };

  const handleSave = () => {
    loadData();
  };

  const handleDelete = (date: string) => {
    deleteEntry(date);
    loadData(); 
  };

  const toggleLanguage = () => {
    if (navigator.vibrate) navigator.vibrate(10);
    setLang(l => l === 'en' ? 'zh' : 'en');
  };

  // --- Mood Calculation for Background ---
  const activeEntry = entries.find(e => e.date === selectedDate);
  const todayStr = formatDate(new Date());
  const todayEntry = entries.find(e => e.date === todayStr);
  
  // Default values
  let currentMoodKey = 'neutral';
  let currentMoodScore = 0; 

  if (view === 'record') {
     if (activeEntry) {
         currentMoodKey = activeEntry.moodKey || 'neutral';
         currentMoodScore = activeEntry.moodScore || 5;
     } else {
         currentMoodKey = 'neutral';
         currentMoodScore = 3;
     }
  } else {
     if (todayEntry) {
         currentMoodKey = todayEntry.moodKey || 'neutral';
         currentMoodScore = todayEntry.moodScore || 5;
     } else {
         currentMoodKey = 'neutral';
         currentMoodScore = 2; 
     }
  }

  useEffect(() => {
    const metaThemeColor = document.querySelector("meta[name=theme-color]");
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", "#FFFCF5"); 
    }
  }, []);

  return (
    // Use h-[100dvh] for reliable mobile full screen
    <div className="h-[100dvh] w-full max-w-md mx-auto shadow-2xl overflow-hidden relative bg-slate-50">
      
      {/* GLOBAL MOOD BACKGROUND */}
      <MoodBackground moodKey={currentMoodKey} moodScore={currentMoodScore} />

      {view === 'calendar' ? (
        <CalendarView 
          entries={entries} 
          onSelectDate={handleSelectDate} 
          onDataUpdate={loadData}
          lang={lang} 
        />
      ) : (
        <RecordView 
          date={selectedDate} 
          existingEntry={activeEntry}
          onBack={handleBack}
          onSave={handleSave}
          onDelete={() => handleDelete(selectedDate)}
          themeColor="transparent"
          lang={lang}
          onToggleLang={toggleLanguage}
        />
      )}
    </div>
  );
};

export default App;
