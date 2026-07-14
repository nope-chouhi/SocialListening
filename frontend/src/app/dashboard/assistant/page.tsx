'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Bot, Loader2, Send, Settings, Sparkles, Trash2, User } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

import { aiChat } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChatConfig {
  is_configured: boolean;
  is_enabled: boolean;
  provider: string | null;
  model_name: string | null;
  capabilities?: Record<string, unknown>;
}

interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  provider?: string | null;
  model?: string | null;
  used_tools?: string[];
  created_at?: string;
}

export default function AssistantPage() {
  const { t } = useLanguage();
  const welcomeMessage: ChatMessage = {
    role: 'assistant',
    content: t('assistant.welcomeFull'),
  };
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatConfig, setChatConfig] = useState<ChatConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    loadChatConfig();
    loadHistory();
  }, []);

  const loadChatConfig = async () => {
    try {
      const config = await aiChat.getChatConfig();
      setChatConfig(config);
    } catch {
      setChatConfig({ is_configured: false, is_enabled: false, provider: null, model_name: null });
    } finally {
      setConfigLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const history = await aiChat.getHistory();
      setMessages(history.length ? history : [welcomeMessage]);
    } catch {
      setMessages([welcomeMessage]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const userMessage = input.trim();
    if (!userMessage || isLoading) return;

    const optimisticUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };

    setInput('');
    setMessages((prev) => [...prev, optimisticUserMessage]);
    setIsLoading(true);

    try {
      const response = await aiChat.send(userMessage);
      setMessages((prev) => [
        ...prev.filter((msg) => msg !== optimisticUserMessage),
        response.user_message,
        response.assistant_message,
      ]);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || t('assistant.connectionError');
      toast.error(detail);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('assistant.cannotAnswerNow').replace('{error}', detail) },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
  };

  const handleClearChat = async () => {
    try {
      await aiChat.clearHistory();
      setMessages([welcomeMessage]);
      toast.success(t('assistant.historyCleared'));
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || t('assistant.clearHistoryError'));
    }
  };

  const suggestions = [
    t('assistant.suggestions.weeklySummary'),
    t('assistant.suggestions.negativeRisk'),
    t('assistant.suggestions.keywordContext'),
    t('assistant.suggestions.alertReports'),
  ];

  const providerLabel = chatConfig?.model_name
    ? `${chatConfig.provider === 'openai' ? 'OpenAI' : chatConfig.provider === 'gemini' ? 'Gemini' : 'Custom'} - ${chatConfig.model_name}`
    : t('assistant.enterpriseLlm');

  if (!configLoading && chatConfig && (!chatConfig.is_configured || !chatConfig.is_enabled)) {
    return (
      <div className="flex h-[calc(100vh-6rem)] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10">
          <AlertTriangle className="h-10 w-10 text-purple-500" />
        </div>
        <h2 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">{t('assistant.notConfiguredTitle')}</h2>
        <p className="mb-6 max-w-lg text-slate-600 dark:text-gray-400">
          {t('assistant.notConfiguredDesc')}
        </p>
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-3 font-medium text-white transition-colors hover:bg-purple-500"
        >
          <Settings className="h-4 w-4" />
          {t('assistant.goToSettings')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#111827]">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-[#111827]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{t('assistant.title')}</h1>
            <p className="text-xs font-medium text-purple-500">
              {configLoading ? t('assistant.checkingConfig') : t('assistant.poweredBy').replace('{provider}', providerLabel)}
            </p>
          </div>
        </div>
        <button
          onClick={handleClearChat}
          title={t('assistant.clearConversation')}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto bg-slate-50 p-4 dark:bg-[#0B1220] sm:p-6">
        {historyLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('assistant.loadingHistory')}
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={`${msg.id || idx}-${msg.role}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[86%] sm:max-w-[76%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div
                  className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    msg.role === 'user' ? 'ml-3 bg-indigo-600' : 'mr-3 bg-purple-600'
                  }`}
                >
                  {msg.role === 'user' ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'rounded-tr-sm bg-indigo-600 text-white'
                      : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-gray-700 dark:bg-[#1E293B] dark:text-gray-100'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.role === 'assistant' && msg.used_tools && msg.used_tools.length > 0 && (
                    <div className="mt-3 border-t border-slate-200 pt-2 text-[11px] text-slate-500 dark:border-gray-700 dark:text-gray-400">
                      {t('assistant.usedData')}: {msg.used_tools.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex max-w-[76%]">
              <div className="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-[#1E293B]">
                <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                <span className="text-sm text-slate-500 dark:text-gray-400">{t('assistant.thinking')}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-[#111827]">
        {messages.length <= 1 && (
          <div className="mb-4 hidden flex-wrap justify-center gap-2 sm:flex">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestion(suggestion)}
                className="flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition-colors hover:border-purple-400 hover:text-purple-600 dark:border-gray-700 dark:text-gray-300"
              >
                {suggestion}
                <ArrowRight className="ml-1.5 h-3 w-3 opacity-60" />
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('assistant.inputPlaceholder')}
            className="w-full rounded-2xl border border-slate-300 bg-white py-4 pl-5 pr-14 text-slate-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-60 dark:border-gray-700 dark:bg-[#1E293B] dark:text-white"
            disabled={isLoading || historyLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || historyLoading}
            className="absolute right-2 rounded-xl bg-purple-600 p-2.5 text-white transition-colors hover:bg-purple-500 disabled:bg-gray-400"
            title={t('assistant.send')}
            aria-label={t('assistant.send')}
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
        <p className="mt-3 text-center text-[11px] text-slate-500">
          {t('assistant.disclaimer')}
        </p>
      </div>
    </div>
  );
}
