
import React, { useState, useRef, useEffect } from 'react';
import { JournalEntry, TaskItem } from '../types';
import { blobToBase64, getMoodColor, MOOD_LABELS } from '../utils';
import { analyzeJournalEntry, getChatReply, summarizeChatSession } from '../services/geminiService';
import { saveEntry } from '../services/storage';
import { ArrowLeft, Mic, Square, Image as ImageIcon, Loader2, Calendar, ListTodo, X, Wand2, Save, Trash2, MessageCircle, Send, Plus, Check, AlertTriangle, Languages } from 'lucide-react';

interface RecordViewProps {
  date: string;
  existingEntry?: JournalEntry;
  onBack: () => void;
  onSave: () => void;
  onDelete: () => void;
  themeColor: string; 
  lang: 'en' | 'zh';
  onToggleLang: () => void;
}

const RecordView: React.FC<RecordViewProps> = ({ date, existingEntry, onBack, onSave, onDelete, themeColor, lang, onToggleLang }) => {
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  
  const [textInput, setTextInput] = useState(existingEntry?.transcription || '');
  const [images, setImages] = useState<string[]>(existingEntry?.images || []);
  
  // Normalization helper for tasks
  const normalizeTasks = (tasks: any[]): TaskItem[] => {
      if (!tasks) return [];
      if (tasks.length === 0) return [];
      // Handle legacy string array
      if (typeof tasks[0] === 'string') {
          return tasks.map((t, i) => ({ id: `legacy-${Date.now()}-${i}`, text: t, completed: false }));
      }
      return tasks;
  };

  // Mood State
  const [moodData, setMoodData] = useState<{
    emoji: string, 
    desc: string, 
    key: string, 
    score: number, 
    tasks: TaskItem[]
  } | null>(
    existingEntry ? { 
      emoji: existingEntry.moodEmoji || '📝', 
      desc: existingEntry.moodDescription || '', 
      key: existingEntry.moodKey || 'neutral',
      score: existingEntry.moodScore || 5,
      tasks: normalizeTasks(existingEntry.tasks)
    } : null
  );

  const [newTaskText, setNewTaskText] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Chat Mode State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [currentChatInput, setCurrentChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Delete Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Vibration Helper
  const vibrate = (pattern: number | number[] = 10) => {
      if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // Sync state & Reset Logic
  useEffect(() => {
    if (existingEntry) {
        // Load Existing
        setTextInput(existingEntry.transcription || '');
        setImages(existingEntry.images || []);
        setMoodData({
            emoji: existingEntry.moodEmoji || '📝',
            desc: existingEntry.moodDescription || '',
            key: existingEntry.moodKey || 'neutral',
            score: existingEntry.moodScore || 5,
            tasks: normalizeTasks(existingEntry.tasks)
        });
        
        if (existingEntry.audioBase64) {
          setAudioUrl(existingEntry.audioBase64);
          const match = existingEntry.audioBase64.match(/data:(audio\/[^;]+);/);
          if (match) setAudioMimeType(match[1]);
        } else {
          setAudioUrl(null);
          setAudioBlob(null);
        }
    } else {
        // Reset to Blank (For new entry or after deletion)
        setTextInput('');
        setImages([]);
        setMoodData(null);
        setAudioUrl(null);
        setAudioBlob(null);
        
        // Also reset chat and task interaction states
        setChatMessages([]);
        setShowChat(false);
        setNewTaskText("");
        setIsAddingTask(false);
    }
  }, [existingEntry, date]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
      if(showChat && chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [chatMessages, showChat]);

  // --- RECORDING ---
  const startRecording = async () => {
    vibrate(50);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
      else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4'; 
      setAudioMimeType(mimeType);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = window.setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } catch (err) {
      console.error(err);
      alert("无法访问麦克风");
    }
  };

  const stopRecording = () => {
    vibrate(50);
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      vibrate(20);
      const base64 = await blobToBase64(e.target.files[0]);
      setImages(p => [...p, base64]);
    }
  };

  // --- TASK MANAGEMENT ---
  const toggleTask = (id: string) => {
      vibrate(10);
      if (!moodData) return;
      setMoodData({
          ...moodData,
          tasks: moodData.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
      });
  };

  const deleteTask = (id: string) => {
      vibrate(20);
      if (!moodData) return;
      setMoodData({
          ...moodData,
          tasks: moodData.tasks.filter(t => t.id !== id)
      });
  };

  const addNewTask = () => {
      if (!newTaskText.trim()) {
          setIsAddingTask(false);
          return;
      }
      vibrate(20);
      const newTask: TaskItem = {
          id: `manual-${Date.now()}`,
          text: newTaskText,
          completed: false
      };
      
      const currentTasks = moodData?.tasks || [];
      const currentMoodData = moodData || {
          emoji: '📝',
          desc: '记录中',
          key: 'neutral',
          score: 5,
          tasks: []
      };

      setMoodData({
          ...currentMoodData,
          tasks: [...currentTasks, newTask]
      });
      setNewTaskText("");
      setIsAddingTask(false);
  };

  // --- ANALYZE ---
  const handleAnalyze = async () => {
    vibrate(20);
    if (!audioBlob && !textInput && images.length === 0) return;
    setIsAnalyzing(true);
    try {
      let audioBase64 = null;
      if (audioBlob) audioBase64 = await blobToBase64(audioBlob);
      else if (existingEntry?.audioBase64 && audioUrl === existingEntry.audioBase64) audioBase64 = existingEntry.audioBase64;

      const analysis = await analyzeJournalEntry(audioBase64, textInput, images, audioMimeType);

      vibrate([50, 50, 50]); // Pulse success pattern
      setTextInput(analysis.transcription || "");
      
      const aiTasks: TaskItem[] = (analysis.tasks as unknown as string[]).map((t, i) => ({
          id: `ai-${Date.now()}-${i}`,
          text: t,
          completed: false
      }));

      const prevTasks = moodData?.tasks || [];
      const mergedTasks = [...prevTasks, ...aiTasks];

      setMoodData({
        emoji: analysis.moodEmoji || "📝",
        desc: analysis.moodDescription || "",
        key: analysis.moodKey || "neutral",
        score: analysis.moodScore || 5,
        tasks: mergedTasks
      });
    } catch (error) {
      console.error(error);
      alert("AI 分析出错");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- SAVE ---
  const handleSave = async () => {
    vibrate(20);
    setIsSaving(true);
    try {
      let audioBase64 = undefined;
      if (audioBlob) audioBase64 = await blobToBase64(audioBlob);
      else if (audioUrl && existingEntry?.audioBase64 && audioUrl === existingEntry.audioBase64) audioBase64 = existingEntry.audioBase64;

      const newEntry: JournalEntry = {
        id: existingEntry?.id || Date.now().toString(),
        date: date,
        audioBase64: audioBase64,
        images: images,
        transcription: textInput || "",
        moodEmoji: moodData?.emoji || '📝',
        moodDescription: moodData?.desc || '未分析',
        moodKey: moodData?.key || 'neutral',
        moodScore: moodData?.score || 5,
        tasks: moodData?.tasks || [],
        createdAt: Date.now(),
      };

      saveEntry(newEntry);
      vibrate(50); // Success
      onSave(); 
    } catch (e) {
      console.error(e);
      alert("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  // --- DELETE ENTRY LOGIC ---
  const handleDeleteClick = () => {
      vibrate(30);
      setShowDeleteConfirm(true);
  };

  const confirmDeleteEntry = () => {
      vibrate(50);
      onDelete(); // Call parent delete handler
      setShowDeleteConfirm(false); // Close modal
  };

  // --- CHAT LOGIC ---
  const startChat = () => {
      vibrate(20);
      setShowChat(true);
      if (chatMessages.length === 0) {
          setChatMessages([{ role: 'model', text: '你好呀，今天过得怎么样？发生了什么特别的事情吗？' }]);
      }
  };

  const sendChatMessage = async () => {
      if (!currentChatInput.trim()) return;
      vibrate(10);
      
      const userMsg = currentChatInput;
      setCurrentChatInput('');
      setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
      setIsChatLoading(true);

      const reply = await getChatReply(chatMessages, userMsg);
      vibrate(20); // Reply received
      
      setChatMessages(prev => [...prev, { role: 'model', text: reply || "抱歉，请再说一次。" }]);
      setIsChatLoading(false);
  };

  const endChatAndSummarize = async () => {
      vibrate(20);
      setIsChatLoading(true);
      const summary = await summarizeChatSession(chatMessages);
      setShowChat(false);
      setTextInput(summary);
      setIsChatLoading(false);
      setTimeout(() => handleAnalyze(), 100); 
  };

  const isReadOnly = isAnalyzing || isSaving;
  const showAnalyzeButton = (audioBlob || (textInput && textInput.length > 5) || images.length > 0) && !isAnalyzing;

  // Colors for Buttons/UI Elements
  const activeKey = moodData?.key || 'neutral';
  const activeScore = moodData?.score || 5;
  const colorStrong = getMoodColor(activeKey, activeScore, 'strong');
  const colorMedium = getMoodColor(activeKey, activeScore, 'medium');

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-transparent z-10 pt-safe-top">
      
      {/* Watermark Emoji */}
      {moodData && (
         <div className="absolute top-[40%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[18rem] opacity-[0.05] blur-sm select-none grayscale-[20%] filter pointer-events-none z-0">
             {moodData.emoji}
         </div>
      )}

      {/* --- HEADER --- */}
      <div className="flex items-center px-4 py-3 sticky top-0 z-20 backdrop-blur-sm border-b border-black/5 shadow-sm bg-white/30">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors active:scale-90">
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <div className="ml-2 flex-1">
          <div className="flex items-center text-gray-600 text-xs font-medium uppercase tracking-wider">
            <Calendar className="w-3 h-3 mr-1" />
            {date}
          </div>
          <h2 className="text-lg font-bold text-gray-900 leading-none mt-0.5">
            {existingEntry ? (lang === 'en' ? 'Reflections' : '这一刻') : (lang === 'en' ? 'New Entry' : '新篇章')}
          </h2>
        </div>
        
        <div className="flex items-center space-x-2">
            <button 
                onClick={onToggleLang}
                className="p-2 rounded-full hover:bg-black/5 text-xs font-bold text-gray-600 border border-transparent hover:border-gray-200 transition-all w-9 h-9 flex items-center justify-center active:scale-95"
                title="Switch Language"
            >
                {lang === 'en' ? 'CN' : 'EN'}
            </button>

            {existingEntry && (
                <button 
                  onClick={handleDeleteClick}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-all active:scale-90 border border-transparent hover:border-red-100"
                  aria-label="删除日记"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
            )}
            <button 
              onClick={handleSave}
              disabled={isSaving || isAnalyzing}
              className="group relative px-4 py-2 rounded-full overflow-hidden transition-all active:scale-95 disabled:opacity-50 shadow-md"
              style={{ backgroundColor: moodData ? colorStrong : '#1f2937' }}
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center space-x-2 relative z-10">
                 {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-white"/> : <Save className="w-4 h-4 text-white" />}
                 <span className="font-semibold text-xs text-white">
                     {lang === 'en' ? 'SAVE' : '保存'}
                 </span>
              </div>
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-40 scroll-container z-10 relative">
        
        {/* Content Area */}
        <div className="space-y-5">
          
          {/* Audio Player */}
          {audioUrl && (
            <div className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl p-3 pl-4 shadow-sm flex items-center transition-all hover:shadow-md hover:bg-white/60">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center mr-3 shadow-sm shrink-0 text-white transition-colors"
                style={{ backgroundColor: moodData ? colorStrong : '#4f46e5' }}
              >
                 <Mic className="w-4 h-4" />
              </div>
              <audio controls src={audioUrl} className="flex-1 h-8 opacity-80 min-w-0" />
              <button onClick={() => { setAudioBlob(null); setAudioUrl(null); }} className="ml-2 p-2 text-gray-500 hover:text-red-500 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
          
          {/* Analyze Button */}
          {showAnalyzeButton && (
             <button
               onClick={handleAnalyze}
               className="w-full py-4 text-white rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-95 hover:shadow-xl hover:-translate-y-0.5"
               style={{ 
                 backgroundColor: moodData ? colorStrong : '#6366f1',
                 boxShadow: `0 8px 20px -5px ${moodData ? colorMedium : '#a5b4fc'}`
               }}
             >
               <Wand2 className="w-5 h-5" />
               <span className="font-bold">
                   {lang === 'en' ? 'AI Analyze & Complete' : 'AI 智能分析 & 续写'}
               </span>
             </button>
          )}

          {/* Analysis Result Card */}
          {(moodData || isAnalyzing) && (
             <div className="bg-white/40 backdrop-blur-md border border-white/60 p-6 rounded-3xl shadow-sm ring-1 ring-white/50 transition-all duration-500">
                {isAnalyzing ? (
                  <div className="text-center py-8">
                     <Loader2 className="w-10 h-10 text-gray-600 animate-spin mx-auto mb-4" />
                     <p className="font-medium text-gray-800">
                         {lang === 'en' ? 'Analyzing vibes...' : '正在感知情绪...'}
                     </p>
                  </div>
                ) : (
                  moodData && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="flex items-center space-x-5 mb-6">
                           <div className="text-7xl drop-shadow-sm filter transform hover:scale-110 duration-300">
                             {moodData.emoji}
                           </div>
                           <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1.5 opacity-70">
                                  {/* BILINGUAL MOOD LABEL */}
                                  {lang === 'en' 
                                     ? `${moodData.key} · INTENSITY ${moodData.score}` 
                                     : `${MOOD_LABELS[moodData.key] || moodData.key} · 强度 ${moodData.score}`
                                  }
                                </div>
                              </div>
                              <div className="text-2xl text-gray-900 font-bold leading-tight">
                                {moodData.desc}
                              </div>
                              <div className="mt-3 h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                                <div 
                                    className="h-full rounded-full transition-all duration-1000"
                                    style={{ width: `${moodData.score * 10}%`, backgroundColor: colorStrong }}
                                />
                              </div>
                           </div>
                      </div>
                      
                      {/* TASKS IN RECORD VIEW (INTERACTIVE) */}
                      <div className="bg-white/50 rounded-2xl p-4 border border-white/40 shadow-sm">
                          <div className="flex items-center justify-between text-gray-600 mb-3 opacity-90">
                             <div className="flex items-center">
                                <ListTodo className="w-4 h-4 mr-2" style={{ color: colorStrong }} />
                                <span className="text-xs font-bold uppercase tracking-wide">
                                    {/* BILINGUAL TASK HEADER */}
                                    {lang === 'en' ? 'TODO / IMPORTANT' : '待办 / 重要事项'}
                                </span>
                             </div>
                             <button 
                                onClick={() => setIsAddingTask(true)}
                                className="p-1 hover:bg-black/5 rounded-full active:scale-90"
                             >
                                <Plus className="w-4 h-4" />
                             </button>
                          </div>
                          
                          <div className="space-y-2">
                             {moodData.tasks && moodData.tasks.map((task) => (
                               <div key={task.id} className="flex items-start group">
                                  <button 
                                    onClick={() => toggleTask(task.id)}
                                    className={`w-4 h-4 border-2 rounded-[5px] mr-3 mt-0.5 flex-shrink-0 transition-colors flex items-center justify-center ${task.completed ? 'bg-gray-600 border-gray-600' : 'border-gray-400'}`}
                                  >
                                      {task.completed && <Check className="w-3 h-3 text-white" />}
                                  </button>
                                  <span className={`text-sm leading-relaxed flex-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                      {task.text}
                                  </span>
                                  <button 
                                    onClick={() => deleteTask(task.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600"
                                  >
                                      <Trash2 className="w-3 h-3" />
                                  </button>
                               </div>
                             ))}
                             
                             {isAddingTask && (
                                 <div className="flex items-center animate-in fade-in">
                                     <input 
                                       autoFocus
                                       value={newTaskText}
                                       onChange={(e) => setNewTaskText(e.target.value)}
                                       onKeyDown={(e) => e.key === 'Enter' && addNewTask()}
                                       onBlur={addNewTask}
                                       placeholder={lang === 'en' ? "New Item..." : "输入新事项..."}
                                       className="flex-1 bg-transparent border-b border-gray-300 focus:border-indigo-500 outline-none text-sm py-1"
                                     />
                                 </div>
                             )}

                             {(!moodData.tasks || moodData.tasks.length === 0) && !isAddingTask && (
                                 <div className="text-center py-2 text-xs text-gray-400">
                                     {lang === 'en' ? 'Tap + to add items' : '点击 + 号添加事项'}
                                 </div>
                             )}
                          </div>
                      </div>
                    </div>
                  )
                )}
             </div>
          )}

          {/* Text Area */}
          <div className="relative group">
             <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={lang === 'en' ? "What's on your mind..." : "这一刻在想什么..."}
                className="w-full min-h-[240px] p-6 rounded-3xl bg-white/40 border border-white/40 shadow-sm focus:bg-white/60 focus:ring-4 focus:ring-white/30 backdrop-blur-sm resize-none text-gray-800 text-lg leading-relaxed transition-all placeholder:text-gray-500 outline-none"
                readOnly={isReadOnly}
              />
          </div>

          {/* Images Grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="aspect-square rounded-2xl overflow-hidden shadow-sm relative group ring-4 ring-white/30">
                  <img src={img} alt="attachment" className="w-full h-full object-cover" />
                  <button onClick={() => setImages(p => p.filter((_, i) => i !== idx))} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {!isRecording && !isAnalyzing && (
        <div className="fixed bottom-8 left-0 right-0 z-20 flex justify-center pointer-events-none pb-safe-bottom">
           <div 
             className="backdrop-blur-xl text-white px-3 py-3 rounded-full shadow-2xl flex items-center space-x-6 pointer-events-auto transform transition-all hover:scale-105 active:scale-95"
             style={{ backgroundColor: moodData ? 'rgba(30, 30, 30, 0.95)' : 'rgba(31, 41, 55, 0.95)' }}
           >
              <label className="cursor-pointer opacity-70 hover:opacity-100 p-2 active:scale-90 transition-transform">
                <ImageIcon className="w-6 h-6" />
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>

              {/* Chat Button (New) */}
               <button onClick={startChat} className="p-2 opacity-70 hover:opacity-100 active:scale-90 transition-transform">
                  <MessageCircle className="w-6 h-6" />
               </button>

              <div className="w-px h-6 bg-white/20"></div>
              
              {!audioUrl ? (
                  <button onClick={startRecording} className="group relative active:scale-90 transition-transform">
                    <div className="absolute -inset-4 bg-white/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="bg-white text-black p-4 rounded-full shadow-lg relative z-10"><Mic className="w-6 h-6" /></div>
                  </button>
              ) : (
                  <div className="opacity-30 p-2"><Mic className="w-6 h-6" /></div>
              )}
              
              <div className="w-px h-6 bg-white/20"></div>
              
              <button onClick={handleAnalyze} disabled={(!audioBlob && !textInput) && !existingEntry} className="opacity-70 hover:opacity-100 p-2 active:scale-90 transition-transform">
                 <Wand2 className="w-6 h-6" />
              </button>
           </div>
        </div>
      )}
      
      {/* Recording Full Screen Overlay */}
      {isRecording && (
          <div className="fixed inset-0 bg-white/90 backdrop-blur-xl z-50 flex flex-col items-center justify-center">
             <div className="relative p-10 bg-white rounded-full shadow-2xl animate-pulse">
                <Mic className="w-12 h-12 text-gray-900" />
             </div>
             <h3 className="mt-12 text-4xl font-light text-gray-900 font-mono">{formatDuration(recordingDuration)}</h3>
             <button onClick={stopRecording} className="mt-12 px-10 py-4 bg-gray-900 text-white rounded-full font-medium shadow-xl flex items-center space-x-3 active:scale-95 transition-transform">
                <Square className="w-4 h-4 fill-current" /><span>{lang === 'en' ? 'STOP' : '停止'}</span>
             </button>
          </div>
      )}

      {/* --- CHAT OVERLAY --- */}
      {showChat && (
          <div className="fixed inset-0 bg-gray-100/95 backdrop-blur-2xl z-50 flex flex-col pt-safe-top">
             {/* Chat Header */}
             <div className="flex items-center justify-between p-4 bg-white/50 border-b border-gray-200">
                 <div className="flex items-center space-x-2">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                     <span className="font-semibold text-gray-700">{lang === 'en' ? 'AI Listening' : 'AI 倾听模式'}</span>
                 </div>
                 <button onClick={() => setShowChat(false)} className="p-2 text-gray-500 hover:text-black active:scale-90">
                     <X className="w-6 h-6" />
                 </button>
             </div>

             {/* Chat Messages */}
             <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-container">
                 {chatMessages.map((msg, idx) => (
                     <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                         <div 
                             className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                 msg.role === 'user' 
                                 ? 'bg-gray-900 text-white rounded-tr-none' 
                                 : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                             }`}
                         >
                             {msg.text}
                         </div>
                     </div>
                 ))}
                 {isChatLoading && (
                     <div className="flex justify-start">
                         <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-200 flex space-x-1">
                             <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                             <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                             <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                         </div>
                     </div>
                 )}
                 <div ref={chatEndRef} />
             </div>

             {/* Chat Input Area */}
             <div className="p-4 bg-white border-t border-gray-200 pb-safe-bottom">
                 <div className="flex flex-col space-y-3">
                     <button 
                        onClick={endChatAndSummarize}
                        className="w-full py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors active:scale-98"
                     >
                        {lang === 'en' ? '✨ End & Generate Journal' : '✨ 结束对话并生成日记'}
                     </button>
                     
                     <div className="flex items-center space-x-2">
                         <input 
                            type="text" 
                            value={currentChatInput}
                            onChange={e => setCurrentChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                            placeholder={lang === 'en' ? "Type a message..." : "输入消息..."}
                            className="flex-1 bg-gray-100 text-gray-900 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all"
                         />
                         <button 
                            onClick={sendChatMessage}
                            disabled={!currentChatInput.trim()}
                            className="p-3 bg-gray-900 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black transition-colors shadow-lg active:scale-90"
                         >
                            <Send className="w-5 h-5 ml-0.5" />
                         </button>
                     </div>
                 </div>
             </div>
          </div>
      )}

      {/* --- DELETE CONFIRM MODAL --- */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-6 text-center transform scale-100 transition-all">
              <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
                  <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{lang === 'en' ? 'Delete Entry?' : '删除确认'}</h3>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed px-2">
                {lang === 'en' 
                    ? 'Are you sure you want to delete this entry? This action cannot be undone.'
                    : '确实要删除这条记录吗？此操作无法恢复，页面将被清空。'
                }
              </p>
              <div className="flex space-x-3">
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-colors active:scale-95"
                  >
                    {lang === 'en' ? 'Cancel' : '取消'}
                  </button>
                  <button 
                    onClick={confirmDeleteEntry} 
                    className="flex-1 py-3.5 bg-red-500 text-white font-bold rounded-2xl shadow-lg shadow-red-200 hover:bg-red-600 transition-colors active:scale-95"
                  >
                    {lang === 'en' ? 'Delete' : '删除'}
                  </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RecordView;
