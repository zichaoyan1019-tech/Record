
import React, { useMemo, useState, useEffect } from 'react';
import { getMonthDays, getWeekDayStart, formatDate, getMoodColor, MOOD_LABELS, MOOD_PALETTE } from '../utils';
import { JournalEntry, TaskItem } from '../types';
import { saveEntry } from '../services/storage';
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, ListStart, Calendar as CalendarIcon, Edit2, Trash2, X, Check, Archive, Smartphone, Share2, Settings, Key, AlertCircle } from 'lucide-react';

interface CalendarViewProps {
  entries: JournalEntry[];
  onSelectDate: (date: string) => void;
  onDataUpdate: () => void;
  lang: 'en' | 'zh';
}

const CalendarView: React.FC<CalendarViewProps> = ({ entries, onSelectDate, onDataUpdate, lang }) => {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  
  // Task Editing Modal State
  const [editingTask, setEditingTask] = useState<{ entryDate: string, task: TaskItem } | null>(null);
  const [editText, setEditText] = useState("");

  // QR Code Modal State
  const [showQR, setShowQR] = useState(false);
  
  // Settings/Key Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    // Check if key exists
    const stored = localStorage.getItem("openai_api_key");
    if (stored && stored.startsWith("sk-")) {
        setHasKey(true);
        setApiKeyInput(stored);
    } else {
        setHasKey(false);
        // AUTO OPEN SETTINGS IF NO KEY (Delay slightly for UX)
        const timer = setTimeout(() => {
            setShowSettings(true);
        }, 500);
        return () => clearTimeout(timer);
    }
  }, []); // Run once on mount

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = formatDate(new Date());

  const daysInMonth = useMemo(() => getMonthDays(year, month), [year, month]);
  const startDay = useMemo(() => getWeekDayStart(year, month), [year, month]);

  // Vibration Helper
  const vibrate = (ms: number = 10) => {
      if (navigator.vibrate) navigator.vibrate(ms);
  }

  const entryMap = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    entries.forEach(e => map.set(e.date, e));
    return map;
  }, [entries]);

  // Helper: Safely get tasks ensuring legacy string arrays are converted (visually)
  const getTasksForEntry = (entry: JournalEntry): TaskItem[] => {
      if (!entry.tasks) return [];
      // Legacy compatibility check: if it's an array of strings
      if (entry.tasks.length > 0 && typeof entry.tasks[0] === 'string') {
          return (entry.tasks as unknown as string[]).map((t, i) => ({
              id: `legacy-${entry.date}-${i}`,
              text: t,
              completed: false
          }));
      }
      return entry.tasks;
  };

  // 1. Today's Tasks
  const todayTasks = useMemo(() => {
      const entry = entryMap.get(todayStr);
      if (!entry) return [];
      return getTasksForEntry(entry);
  }, [entryMap, todayStr]);

  // 2. Monthly Highlights
  const monthlyHighlights = useMemo(() => {
    const highlights: { date: string, task: TaskItem, color: string }[] = [];
    
    entryMap.forEach((entry) => {
       const entryDate = new Date(entry.date);
       if (entryDate.getMonth() === month && entryDate.getFullYear() === year) {
          if (entry.date === todayStr) return;

          const tasks = getTasksForEntry(entry);
          if (tasks.length > 0) {
             tasks.filter(t => !t.completed).slice(0, 2).forEach(t => {
                 highlights.push({
                   date: entry.date,
                   task: t,
                   color: getMoodColor(entry.moodKey, entry.moodScore, 'strong')
                 });
             });
          }
       }
    });
    return highlights.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10); 
  }, [entryMap, month, year, todayStr]);

  const changeMonth = (delta: number) => {
    vibrate(10);
    setCurrentDate(new Date(year, month + delta, 1));
  };

  // --- Task Operations ---
  const handleTaskClick = (entryDate: string, task: TaskItem) => {
      vibrate(10);
      setEditingTask({ entryDate, task });
      setEditText(task.text);
  };

  const saveTaskChanges = (action: 'update' | 'delete' | 'toggle') => {
      vibrate(20);
      if (!editingTask) return;
      const entry = entryMap.get(editingTask.entryDate);
      if (!entry) return;

      const currentTasks = getTasksForEntry(entry); // Normalize existing
      let newTasks = [...currentTasks];

      if (action === 'delete') {
          newTasks = newTasks.filter(t => t.id !== editingTask.task.id);
      } else if (action === 'update') {
          newTasks = newTasks.map(t => t.id === editingTask.task.id ? { ...t, text: editText } : t);
      } else if (action === 'toggle') {
          newTasks = newTasks.map(t => t.id === editingTask.task.id ? { ...t, completed: !t.completed } : t);
      }

      // Create updated entry
      const updatedEntry: JournalEntry = {
          ...entry,
          tasks: newTasks
      };

      saveEntry(updatedEntry);
      onDataUpdate(); // Refresh UI
      setEditingTask(null);
  };

  const saveApiKey = () => {
      if (apiKeyInput.startsWith("sk-")) {
          localStorage.setItem("openai_api_key", apiKeyInput);
          setHasKey(true);
          alert("API Key Saved!");
          setShowSettings(false);
      } else {
          alert("Invalid API Key format (must start with sk-)");
      }
  };

  const clearApiKey = () => {
      localStorage.removeItem("openai_api_key");
      setApiKeyInput("");
      setHasKey(false);
      alert("API Key Removed. Using default/demo mode.");
  };

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Current URL for QR Code
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="flex flex-col h-full bg-transparent transition-colors duration-700 relative z-10 pt-safe-top">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-8">
        <div>
          <h1 className="text-3xl font-light text-gray-800 tracking-tight">{lang === 'en' ? 'Journal' : '我的生活'}</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest mt-1 opacity-80">{year} . {String(month + 1).padStart(2, '0')}</p>
        </div>
        <div className="flex items-center space-x-2">
           {/* Install/Share Button */}
           <button 
             onClick={() => setShowQR(true)}
             className="p-3 bg-white/50 backdrop-blur-sm rounded-full shadow-sm border border-white/60 text-gray-600 hover:bg-white transition-all active:scale-90 hidden sm:flex"
             title="Install on Phone"
           >
              <Smartphone className="w-5 h-5" />
           </button>

           {/* Settings Button - HIGH VISIBILITY */}
           <button 
             onClick={() => setShowSettings(true)}
             className={`flex items-center space-x-2 px-3 py-2 rounded-full transition-all active:scale-95 border ${
                 !hasKey 
                 ? 'bg-white text-indigo-600 shadow-md border-indigo-100 animate-pulse' 
                 : 'bg-white/50 text-gray-600 shadow-sm border-white/60 hover:bg-white'
             }`}
             title="Settings / API Key"
           >
              <div className="relative">
                  <Settings className="w-5 h-5" />
                  {!hasKey && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                  )}
              </div>
              {!hasKey && <span className="text-xs font-bold whitespace-nowrap">{lang === 'en' ? 'Set Key' : '配置 Key'}</span>}
           </button>

          <div className="flex items-center bg-white/50 rounded-full p-1 border border-white/60 shadow-sm ml-2">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white rounded-full transition-colors active:scale-90">
                <ChevronLeft className="w-4 h-4 text-gray-800" />
              </button>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white rounded-full transition-colors active:scale-90">
                <ChevronRight className="w-4 h-4 text-gray-800" />
              </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-24 scroll-container no-scrollbar pb-safe-bottom">
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 mb-4">
          {weekDays.map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-2">
              {d}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-y-4 gap-x-2 mb-10">
          {/* Padding for empty days */}
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {daysInMonth.map(day => {
            const dateStr = formatDate(day);
            const entry = entryMap.get(dateStr);
            const isToday = formatDate(new Date()) === dateStr;
            
            // Resolve Colors
            const moodKey = entry?.moodKey || 'neutral';
            const moodScore = entry?.moodScore || 5;
            const bgFill = getMoodColor(moodKey, moodScore, 'light');
            const borderCol = getMoodColor(moodKey, moodScore, 'medium');

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                className="relative flex flex-col items-center justify-center aspect-square group rounded-2xl transition-all duration-300 active:scale-90"
              >
                {/* Visual Container */}
                <div 
                   className="absolute inset-0 rounded-2xl transition-all duration-300 border-[2px]"
                   style={{ 
                     backgroundColor: entry ? bgFill : 'transparent',
                     borderColor: entry ? borderCol : (isToday ? '#1f2937' : 'transparent'),
                     borderStyle: isToday && !entry ? 'dashed' : 'solid',
                     opacity: entry ? 1 : 0.8,
                     transform: isToday ? 'scale(1.05)' : 'scale(1)',
                   }}
                />
                
                {/* Date Number */}
                <span 
                    className="relative text-sm font-medium z-10"
                    style={{ color: entry ? '#374151' : (isToday ? '#111827' : '#9CA3AF') }}
                >
                  {day.getDate()}
                </span>
                
                {/* Small Dot Indicator */}
                {entry && (
                   <div 
                     className="absolute bottom-2 w-2 h-2 rounded-full"
                     style={{ backgroundColor: borderCol }}
                   />
                )}
              </button>
            );
          })}
        </div>

        {/* --- SECTION 1: TODAY'S FOCUS --- */}
        <div className="mb-8">
             <div className="flex items-center space-x-2 mb-4 px-2">
                <CalendarIcon className="w-4 h-4 text-gray-800" />
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest">
                    {lang === 'en' ? `TODAY'S FOCUS (${todayStr})` : `本日重要事项 (${todayStr})`}
                </h3>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 border border-white/50 shadow-sm space-y-3 min-h-[100px]">
                {todayTasks.length > 0 ? (
                    todayTasks.map((task, idx) => (
                        <div 
                            key={task.id || idx} 
                            onClick={() => handleTaskClick(todayStr, task)}
                            className={`flex items-start group cursor-pointer p-2 rounded-xl transition-all hover:bg-white/50 active:scale-98 ${task.completed ? 'opacity-50' : ''}`}
                        >
                            <div className={`w-5 h-5 rounded-md border-2 mr-3 mt-0.5 flex items-center justify-center transition-colors ${task.completed ? 'bg-gray-800 border-gray-800' : 'border-gray-400'}`}>
                                {task.completed && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={`text-sm font-medium leading-relaxed flex-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                {task.text}
                            </span>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-20 text-gray-400 active:scale-95 transition-transform" onClick={() => onSelectDate(todayStr)}>
                        <p className="text-xs">{lang === 'en' ? 'No records yet today' : '今天还没有记录哦'}</p>
                        <button className="mt-2 text-xs font-bold text-indigo-500 hover:underline">{lang === 'en' ? 'Start Recording +' : '去记录 +'}</button>
                    </div>
                )}
            </div>
        </div>

        {/* --- SECTION 2: MONTHLY HIGHLIGHTS --- */}
        <div className="mb-10">
            <div className="flex items-center space-x-2 mb-4 px-2">
                <ListStart className="w-4 h-4 text-gray-500" />
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    {lang === 'en' ? 'MONTHLY HIGHLIGHTS' : '本月高光回顾'}
                </h3>
            </div>
            
            {monthlyHighlights.length > 0 ? (
                <div className="bg-white/40 backdrop-blur-sm rounded-3xl p-5 border border-white/50 shadow-sm space-y-4">
                    {monthlyHighlights.map((item, idx) => (
                        <div 
                            key={`${item.date}-${item.task.id || idx}`} 
                            onClick={() => handleTaskClick(item.date, item.task)}
                            className="flex items-start group cursor-pointer hover:bg-white/30 p-2 -mx-2 rounded-xl transition-colors active:scale-98"
                        >
                             <div className="flex flex-col items-center mr-3 pt-1">
                                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                             </div>
                             <div className="flex-1 pb-2 border-b border-gray-200/50 last:border-0">
                                 <p className="text-gray-800 text-sm leading-relaxed font-medium line-clamp-2">{item.task.text}</p>
                                 <p className="text-[10px] text-gray-500 mt-1 font-mono">{item.date}</p>
                             </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8 opacity-50">
                    <p className="text-xs text-gray-500">{lang === 'en' ? 'No highlights yet' : '本月暂无重点记录'}</p>
                </div>
            )}
        </div>
        
        {/* --- ELEGANT MOOD LEGEND --- */}
        <div className="mb-20">
             <div className="flex items-center justify-center space-x-2 mb-4">
                <div className="h-px w-8 bg-gray-300"></div>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {lang === 'en' ? 'MOOD PALETTE' : '情绪色彩'}
                </h3>
                <div className="h-px w-8 bg-gray-300"></div>
             </div>
             
             <div className="bg-white/30 backdrop-blur-md rounded-full px-4 py-4 border border-white/40 shadow-sm flex justify-between items-center overflow-x-auto no-scrollbar">
                 {Object.entries(MOOD_LABELS).map(([key, label]) => {
                     const color = MOOD_PALETTE[key]?.strong || '#ccc';
                     return (
                         <div key={key} className="flex flex-col items-center space-y-1.5 min-w-[3rem] shrink-0">
                             <div 
                                className="w-3 h-3 rounded-full shadow-sm transition-transform hover:scale-125"
                                style={{ backgroundColor: color }}
                             />
                             <span className="text-[9px] text-gray-500 font-medium">
                                 {lang === 'en' ? key.charAt(0).toUpperCase() + key.slice(1) : label}
                             </span>
                         </div>
                     );
                 })}
             </div>
        </div>

      </div>

       {/* Floating Action Button for Today */}
      <div className="absolute bottom-10 right-8 pb-safe-bottom">
        <button
          onClick={() => onSelectDate(formatDate(new Date()))}
          className="bg-gray-900 text-white p-5 rounded-full shadow-2xl hover:bg-black transition-transform hover:scale-105 active:scale-95 flex items-center justify-center z-20"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* --- TASK EDIT MODAL --- */}
      {editingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900">{lang === 'en' ? 'Edit Task' : '编辑事项'}</h3>
                      <button onClick={() => setEditingTask(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 active:scale-90">
                          <X className="w-4 h-4" />
                      </button>
                  </div>
                  
                  <textarea 
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] text-gray-800 mb-6 resize-none"
                  />

                  <div className="flex flex-col space-y-3">
                      <button 
                        onClick={() => saveTaskChanges('toggle')}
                        className={`w-full py-3 rounded-xl flex items-center justify-center font-semibold transition-colors active:scale-98 ${editingTask.task.completed ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}
                      >
                          {editingTask.task.completed ? (
                              <><Archive className="w-4 h-4 mr-2" /> {lang === 'en' ? 'Mark as Incomplete' : '标记为未完成'}</>
                          ) : (
                              <><CheckCircle2 className="w-4 h-4 mr-2" /> {lang === 'en' ? 'Complete / Archive' : '完成 / 归档'}</>
                          )}
                      </button>

                      <div className="flex space-x-3">
                          <button 
                            onClick={() => saveTaskChanges('update')}
                            className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-black flex items-center justify-center active:scale-95"
                          >
                             <Edit2 className="w-4 h-4 mr-2" /> {lang === 'en' ? 'Save' : '保存修改'}
                          </button>
                          <button 
                            onClick={() => saveTaskChanges('delete')}
                            className="w-14 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 active:scale-95"
                          >
                             <Trash2 className="w-5 h-5" />
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- SETTINGS / API KEY MODAL --- */}
      {showSettings && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
             <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm p-6 flex flex-col relative">
                <button 
                   onClick={() => setShowSettings(false)}
                   className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                   <X className="w-5 h-5 text-gray-600" />
                </button>
                
                <h3 className="text-xl font-bold text-gray-900 mt-2 mb-2 flex items-center">
                    <Key className="w-5 h-5 mr-2 text-indigo-500" />
                    OpenAI API Configuration
                </h3>
                
                {!hasKey && (
                   <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-xs mb-4 flex items-start border border-amber-100">
                      <AlertCircle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                      <span>
                        {lang === 'en' 
                          ? 'Missing API Key. AI features (Summary, Mood, Voice) are disabled.'
                          : '检测到未配置 Key。AI 功能（语音转文字、情绪分析）暂不可用。'
                        }
                      </span>
                   </div>
                )}

                <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                    {lang === 'en' 
                        ? 'Enter your own OpenAI API Key (starts with sk-...). The key is stored securely in your browser\'s local storage.' 
                        : '请输入您的 OpenAI API Key (以 sk- 开头)。密钥将安全存储在您的浏览器本地缓存中，不会上传到我们的服务器。'
                    }
                </p>
                
                <div className="space-y-4">
                    <input 
                        type="text" 
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value.trim())}
                        placeholder="sk-proj-..."
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none font-mono text-xs text-gray-600 break-all"
                    />

                    <button 
                        onClick={saveApiKey}
                        className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
                    >
                        {lang === 'en' ? 'Save API Key' : '保存密钥'}
                    </button>
                    
                    {apiKeyInput && (
                         <button 
                            onClick={clearApiKey}
                            className="w-full py-3 bg-red-50 text-red-500 font-bold rounded-xl hover:bg-red-100 active:scale-95 transition-all"
                        >
                            {lang === 'en' ? 'Clear Key' : '清除密钥'}
                        </button>
                    )}
                </div>
             </div>
          </div>
      )}

      {/* --- QR CODE MODAL FOR MOBILE INSTALL --- */}
      {showQR && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
             <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xs p-6 flex flex-col items-center relative">
                <button 
                   onClick={() => setShowQR(false)}
                   className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                   <X className="w-5 h-5 text-gray-600" />
                </button>
                
                <h3 className="text-lg font-bold text-gray-900 mt-2 mb-1">
                    {lang === 'en' ? 'Install on Phone' : '手机扫码安装'}
                </h3>
                <p className="text-xs text-gray-500 mb-6 text-center px-4">
                    {lang === 'en' ? 'Scan with your camera to open on mobile, then Add to Home Screen.' : '使用手机相机扫码打开，然后点击“添加到主屏幕”即可获得原生 App 体验。'}
                </p>
                
                <div className="bg-white p-2 rounded-2xl shadow-inner border border-gray-100 mb-6">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}&bgcolor=ffffff`} 
                      alt="QR Code" 
                      className="w-48 h-48 rounded-lg mix-blend-multiply"
                    />
                </div>

                <div className="flex items-center space-x-2 text-[10px] text-gray-400 font-mono bg-gray-50 px-3 py-1 rounded-full">
                    <Share2 className="w-3 h-3" />
                    <span>Safari &gt; Share &gt; Add to Home Screen</span>
                </div>
             </div>
          </div>
      )}

    </div>
  );
};

export default CalendarView;
