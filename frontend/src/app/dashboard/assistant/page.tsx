'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { aiChat } from '@/lib/api';
import toast from 'react-hot-toast';

export default function AssistantPage() {
  const [messages, setMessages] = useState<{role: string, content: string}[]>([
    { role: 'assistant', content: 'Xin chào! Tôi là AI Brand Assistant. Tôi đã được cung cấp toàn bộ dữ liệu Social Listening (Mentions, Cảnh báo, Đối thủ) của dự án. Bạn muốn phân tích điều gì hôm nay?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await aiChat.chat(newMessages);
      setMessages([...newMessages, response]);
    } catch (error: any) {
      toast.error('Có lỗi xảy ra khi kết nối với AI Assistant.');
      setMessages([...newMessages, { role: 'assistant', content: 'Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
  };

  const suggestions = [
    "Tóm tắt tình hình thương hiệu tuần qua",
    "Có thảo luận tiêu cực nào đáng chú ý không?",
    "So sánh Share of Voice với đối thủ",
    "Ai là Influencer mang lại nhiều reach nhất?"
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-5xl mx-auto bg-[#111827] border border-gray-800 rounded-2xl shadow-xl overflow-hidden relative">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#1E293B]/50 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">AI Brand Assistant</h1>
            <p className="text-xs text-purple-400 font-medium">Powered by Enterprise LLM</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-[#0B1220]/50">
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
                  : 'bg-[#1E293B] text-gray-200 border border-gray-700 rounded-tl-none shadow-sm whitespace-pre-wrap'
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
              <div className="px-5 py-4 rounded-2xl bg-[#1E293B] border border-gray-700 rounded-tl-none shadow-sm flex items-center space-x-2">
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
      <div className="p-4 border-t border-gray-800 bg-[#111827] shrink-0">
        {messages.length === 1 && (
          <div className="mb-4 hidden sm:flex flex-wrap gap-2 justify-center">
            {suggestions.map((s, i) => (
              <button 
                key={i}
                onClick={() => handleSuggestion(s)}
                className="text-xs bg-[#1E293B] hover:bg-purple-500/10 border border-gray-700 hover:border-purple-500/30 text-gray-300 hover:text-purple-300 px-3 py-1.5 rounded-full transition-colors flex items-center"
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
            className="w-full pl-5 pr-14 py-4 bg-[#1E293B] border border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white placeholder-gray-500 shadow-inner"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 transition-colors shadow-sm disabled:shadow-none"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
        <div className="mt-3 text-center">
          <p className="text-[10px] text-gray-500">AI Assistant có thể mắc sai lầm. Hãy kiểm tra lại các số liệu quan trọng.</p>
        </div>
      </div>
    </div>
  );
}
