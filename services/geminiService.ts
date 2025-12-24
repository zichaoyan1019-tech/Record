
import { AnalysisResult } from "../types";

// --- CONFIGURATION ---
// SECURITY: Leave this empty for GitHub. Users should enter their key in the App Settings.
const DEFAULT_KEY = ""; 
const OPENAI_BASE_URL = "https://api.openai.com/v1";

const getApiKey = () => {
  // 1. Try Local Storage (User Settings) - This is the primary way now
  const local = localStorage.getItem("openai_api_key");
  if (local && local.startsWith("sk-")) {
      console.log("Using API Key from Local Storage");
      return local;
  }
  
  // 2. Fallback to env/hardcoded (will be empty in production/github)
  return process.env.API_KEY || DEFAULT_KEY;
};

// --- MOCK DATA GENERATORS (Fallback for Quota Errors) ---
const getMockAnalysis = (text: string): AnalysisResult => ({
    transcription: text || "今天天气真不错，心情也很好。虽然工作有点忙，但还是抽出时间去公园散步了。感觉到久违的放松。",
    moodEmoji: "🌤️",
    moodDescription: "演示模式(需配置Key)",
    moodKey: "happy",
    moodScore: 8,
    tasks: ["Go to Settings", "Enter OpenAI API Key"]
});

const isQuotaError = (error: any): boolean => {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    return msg.includes("quota") || msg.includes("429") || msg.includes("billing") || msg.includes("insufficient_quota");
};

// Helper: Convert Data URL to File object for Whisper API
const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'audio/webm';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, {type:mime});
};

// Helper: Call OpenAI Chat Completion
const callGPT = async (messages: any[], model: string = "gpt-4o", jsonMode: boolean = false) => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing. Please set it in Settings.");

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
    };

    const body: any = {
        model: model,
        messages: messages,
    };

    if (jsonMode) {
        body.response_format = { type: "json_object" };
    }

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "OpenAI API Error");
    }

    const data = await response.json();
    return data.choices[0].message.content;
};

// Helper: Call OpenAI Whisper for Audio Transcription
const callWhisper = async (audioBase64: string): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing. Please set it in Settings.");

    // Convert base64 back to a file object
    const file = dataURLtoFile(audioBase64, "audio.webm");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", "whisper-1");

    const response = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`
        },
        body: formData
    });

    if (!response.ok) {
        const err = await response.json();
        // If quota error on whisper, throw it so we can catch it upstream
        throw new Error(err.error?.message || "Whisper Transcription Error");
    }

    const data = await response.json();
    return data.text;
};

// --- EXPORTED FUNCTIONS ---

export const summarizeChatSession = async (chatHistory: {role: string, text: string}[]): Promise<string> => {
    try {
        const transcript = chatHistory.map(m => `${m.role === 'user' ? 'Me' : 'AI'}: ${m.text}`).join('\n');
        
        const messages = [
            { 
                role: "system", 
                content: "You are an expert writer. Rewrite the following conversation into a cohesive, natural, first-person journal entry in Chinese. Keep it within 300 words." 
            },
            { role: "user", content: transcript }
        ];

        const text = await callGPT(messages, "gpt-4o");
        return text || "";
    } catch (e: any) {
        console.error("Summarization failed", e);
        if (isQuotaError(e)) return "【演示摘要】今天和AI聊得很开心，虽然API额度用完了，但我体验了整个流程。";
        return "无法生成摘要，请稍后再试。";
    }
}

export const getChatReply = async (history: {role: string, text: string}[], lastMessage: string) => {
    try {
        const gptHistory = history.map(h => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.text
        }));

        const messages = [
            { 
                role: "system", 
                content: "You are an empathetic, soft-spoken journaling companion. Ask ONE simple, open-ended follow-up question in Chinese. Be brief and warm." 
            },
            ...gptHistory,
            { role: "user", content: lastMessage }
        ];

        const text = await callGPT(messages, "gpt-4o");
        return text;
    } catch(e: any) {
        console.error("Chat reply failed", e);
        if (isQuotaError(e)) return "（模拟回复）看来你今天过得很充实呢！能多跟我说说那个细节吗？[API额度已耗尽，这是自动回复]";
        return "（AI 连接中断，请检查网络或配置Key）";
    }
}

export const analyzeJournalEntry = async (
  audioBase64: string | null,
  textInput: string,
  imageUserBase64: string[],
  audioMimeType: string = 'audio/webm'
): Promise<AnalysisResult> => {
  
  try {
    let finalTranscription = textInput;

    // 1. If there is audio, transcribe it first using Whisper
    if (audioBase64) {
        try {
            const audioText = await callWhisper(audioBase64);
            if (finalTranscription) {
                finalTranscription = `${finalTranscription}\n\n[语音记录]: ${audioText}`;
            } else {
                finalTranscription = audioText;
            }
        } catch (err: any) {
            console.warn("Audio transcription failed", err);
            if (isQuotaError(err)) {
                finalTranscription += "\n(语音转文字演示：API额度已耗尽)";
            } else {
                finalTranscription += "\n(语音转文字失败：请检查Key)";
            }
        }
    }

    // 2. Prepare content for GPT-4o Vision
    const contentPayload: any[] = [
        { type: "text", text: `Analyze this journal entry. The user text/transcription is: "${finalTranscription}".` }
    ];

    // Add images if any
    if (imageUserBase64 && imageUserBase64.length > 0) {
        imageUserBase64.forEach(img => {
            contentPayload.push({
                type: "image_url",
                image_url: {
                    url: img 
                }
            });
        });
    }

    contentPayload.push({
        type: "text", 
        text: `Return a JSON object with the following fields:
        - moodEmoji: a single emoji representing the mood.
        - moodDescription: a very short, poetic 3-5 word summary in Chinese (e.g. "静谧的午后时光").
        - moodKey: one of ["happy", "calm", "neutral", "sad", "anxious", "angry", "tired"].
        - moodScore: integer 1-10.
        - tasks: an array of strings strings (extract actionable items or key takeaways).
        - transcription: the full cleaned up text of the journal entry in Chinese (merge user text and speech).`
    });

    const messages = [
        { role: "system", content: "You are a helpful AI assistant that outputs raw JSON." },
        { role: "user", content: contentPayload }
    ];

    // 3. Call GPT-4o with JSON mode
    const jsonStr = await callGPT(messages, "gpt-4o", true); // Enable JSON mode
    const parsed = JSON.parse(jsonStr);

    return {
        transcription: parsed.transcription || finalTranscription,
        moodEmoji: parsed.moodEmoji || "📝",
        moodDescription: parsed.moodDescription || "记录中",
        moodKey: parsed.moodKey || "neutral",
        moodScore: parsed.moodScore || 5,
        tasks: parsed.tasks || []
    };

  } catch (error: any) {
    console.error("OpenAI Analysis Error:", error);
    
    // FALLBACK FOR QUOTA EXCEEDED
    if (isQuotaError(error)) {
        console.warn("Quota exceeded, returning mock data");
        return getMockAnalysis(textInput);
    }

    return {
        transcription: textInput || `[分析未完成]`,
        moodEmoji: "⚙️",
        moodDescription: "请配置Key",
        moodKey: "neutral",
        moodScore: 5,
        tasks: []
    };
  }
};
