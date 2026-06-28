'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, ArrowRight, AlertTriangle, Settings, Trash2, Plus, MessageSquare } from 'lucide-react';
import { aiChat } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface ChatConfig {
  is_configured: boolean;
  is_enabled: boolean;
  provider: string | null;
  model_name: string | null;
}

interface ChatSession {
  id: number;
  title: string;
  created_at: string;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatConfig, setChatConfig] = useState<ChatConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    loadChatConfig();
    loadSessions();
  }, []);

  const loadChatConfig = async () => {
    try {
      const config = await aiChat.getConfig();
      setChatConfig(config);
    } catch (err) {
      setChatConfig({ is_configured: false, is_enabled: false, provider: null, model_name: null });
    } finally {
      setConfigLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const data = await aiChat.getSessions();
      setSessions(data || []);
      if (data && data.length > 0 && !activeSessionId) {
        // Option: Auto-select latest session, or let user create new.
        // Let's not auto-select to show the intro screen unless explicitly clicked
      }
    } catch (err) {
      console.error('Failed to load sessions', err);
    }
  };

  const handleCreateSession = async () => {
    try {
      const newSession = await aiChat.createSession('Hội thoại mới');
      setSessions([newSession, ...sessions]);
      setActiveSessionId(newSession.id);
      setMessages([{ role: 'assistant', content: 'Xin chào! Tôi là AI Brand Assistant. Bạn muốn phân tích điều gì hôm nay?' }]);
    } catch (err) {
      toast.error('Không thể tạo hội thoại mới');
    }
  };

  const handleSelectSession = async (id: number) => {
    setActiveSessionId(id);
    setIsLoading(true);
    try {
      const sessionData = await aiChat.getSession(id);
      if (sessionData && sessionData.messages) {
        const msgs = sessionData.messages.map((m: any) => ({ role: m.role, content: m.content }));
        setMessages(msgs);
      } else {
        setMessages([]);
      }
    } catch (err) {
      toast.error('Không thể tải hội thoại');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await aiChat.deleteSession(id);
      setSessions(sessions.filter(s => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      toast.error('Không thể xóa hội thoại');
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      try {
        const newSession = await aiChat.createSession(input.trim().substring(0, 30));
        setSessions([newSession, ...sessions]);
        targetSessionId = newSession.id;
        setActiveSessionId(newSession.id);
      } catch (err) {
        toast.error('Lỗi khởi tạo session');
        return;
      }
    }

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await aiChat.sendMessageToSession(targetSessionId!, userMessage);
      setMessages([...newMessages, { role: 'assistant', content: response.content }]);
      loadSessions(); // refresh titles
    } catch (error: any) {
      const detail = error?.response?.data?.detail || 'Có lỗi xảy ra khi kết nối với AI Assistant.';
      toast.error(detail);
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${detail}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
  };

  const providerLabel = chatConfig?.model_name
    ? `${chatConfig.provider === 'openai' ? 'GPT' : chatConfig.provider === 'gemini' ? 'Gemini' : 'Custom'} • ${chatConfig.model_name}`
    : 'Enterprise LLM';

  // Not configured state
  if (!configLoading && chatConfig && (!chatConfig.is_configured || !chatConfig.is_enabled)) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] max-w-lg mx-auto text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-600/20 flex items-center justify-center mb-6 border border-purple-500/20">
          <AlertTriangle className="w-10 h-10 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">AI Assistant chưa được cấu hình</h2>
        <p className="text-slate-600 dark:text-gray-400 mb-6 leading-relaxed">
          {!chatConfig.is_configured
            ? 'Quản trị viên cần thiết lập API key và chọn AI model trong phần Cài đặt để kích hoạt tính năng này.'
            : 'AI Assistant hiện đang tắt. Quản trị viên có thể bật lại trong phần Cài đặt → Cấu hình AI.'
          }
        </p>
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-purple-500/20"
        >
          <Settings className="w-4 h-4" />
          Đi tới Cài đặt
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] max-w-6xl mx-auto bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden relative">
      
      {/* Sidebar Sessions */}
      <div className="w-64 shrink-0 border-r border-slate-200 dark:border-gray-800 flex flex-col bg-slate-50 dark:bg-[#0B1220]/50 hidden sm:flex">
        <div className="p-4">
          <button
            onClick={handleCreateSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Hội thoại mới
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar pb-4">
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => handleSelectSession(s.id)}
              className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                activeSessionId === s.id ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold' : 'hover:bg-slate-200 dark:hover:bg-white/5 text-slate-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                <span className="truncate text-sm">{s.title || 'Hội thoại mới'}</span>
              </div>
              <button 
                onClick={(e) => handleDeleteSession(e, s.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#1E293B]/50 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide">AI Brand Assistant</h1>
              <p className="text-xs text-purple-400 font-medium">
                {configLoading ? 'Đang kết nối...' : `Powered by ${providerLabel}`}
              </p>
            </div>
          </div>
          {activeSessionId && (
            <button
              onClick={(e) => handleDeleteSession(e, activeSessionId)}
              title="Xóa hội thoại"
              className="p-2 text-slate-400 dark:text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors sm:hidden"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-white dark:bg-[#111827]">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
              <Sparkles className="w-12 h-12 mb-4" />
              <p>Bắt đầu một hội thoại mới</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
              <div className={`flex max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${
                  msg.role === 'user' ? 'bg-indigo-600 ml-3' : 'bg-purple-600 mr-3'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                </div>

                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-slate-100 dark:bg-[#1E293B] text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-700 rounded-tl-none shadow-sm whitespace-pre-wrap'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start w-full">
              <div className="flex max-w-[85%] sm:max-w-[75%] flex-row">
                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 bg-purple-600 mr-3">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="px-5 py-4 rounded-2xl bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-gray-700 rounded-tl-none shadow-sm flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-[#111827] shrink-0">
          {messages.length <= 1 && (
            <div className="mb-4 hidden sm:flex flex-wrap gap-2 justify-center">
              {[
                "Tóm tắt tình hình thương hiệu tuần qua",
                "Có thảo luận tiêu cực nào đáng chú ý không?",
                "So sánh Share of Voice với đối thủ",
              ].map((s, i) => (
                <button 
                  key={i}
                  onClick={() => handleSuggestion(s)}
                  className="text-xs bg-slate-50 dark:bg-[#1E293B] hover:bg-purple-500/10 border border-slate-200 dark:border-gray-700 hover:border-purple-500/30 text-slate-700 dark:text-gray-300 hover:text-purple-300 px-3 py-1.5 rounded-full transition-colors flex items-center"
                >
                  {s} <ArrowRight className="w-3 h-3 ml-1.5 opacity-50" />
                </button>
              ))}
            </div>
          )}
          
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi để phân tích dữ liệu..."
              className="w-full pl-5 pr-14 py-4 bg-slate-50 dark:bg-[#1E293B] border border-slate-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-900 dark:text-white placeholder-gray-500 shadow-inner"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-500 disabled:bg-gray-400 dark:disabled:bg-gray-700 disabled:text-gray-200 dark:disabled:text-gray-500 transition-colors shadow-sm disabled:shadow-none"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
          <div className="mt-3 text-center">
            <p className="text-[10px] text-gray-400 dark:text-gray-500">AI Assistant có thể mắc sai lầm. Hãy kiểm tra lại các số liệu quan trọng.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
