'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { aiChat } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

interface WidgetMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
}

export function FloatingAssistantWidget() {
  const { t } = useLanguage();
  const initialMessage: WidgetMessage = {
    role: 'assistant',
    content: t('assistant.welcomeWidget'),
  };
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, isOpen]);

  useEffect(() => {
    if (!isOpen || isConfigured !== null) return;
    let mounted = true;
    aiChat.getChatConfig()
      .then((config) => {
        if (mounted) setIsConfigured(Boolean(config.is_configured && config.is_enabled));
      })
      .catch(() => {
        if (mounted) setIsConfigured(false);
      });
    return () => {
      mounted = false;
    };
  }, [isOpen, isConfigured]);

  const loadRecentHistory = async () => {
    try {
      const history = await aiChat.getHistory();
      setMessages(history.length ? history.slice(-12) : [initialMessage]);
    } catch {
      setMessages([initialMessage]);
    }
  };

  const toggleOpen = async () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) await loadRecentHistory();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;

    const optimistic: WidgetMessage = { role: 'user', content: text };
    setInput('');
    setMessages((prev) => [...prev, optimistic]);
    setIsSending(true);

    try {
      const response = await aiChat.send(text);
      setMessages((prev) => [
        ...prev.filter((message) => message !== optimistic),
        response.user_message,
        response.assistant_message,
      ].slice(-20));
      setIsConfigured(true);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || t('assistant.connectionError');
      toast.error(detail);
      setMessages((prev) => [...prev, { role: 'assistant' as const, content: detail }].slice(-20));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 hidden sm:block">
      {isOpen && (
        <div className="mb-3 flex h-[520px] w-[360px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#111827]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Nope360 AI</p>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">
                  {isConfigured === false ? t('assistant.notConfiguredShort') : t('assistant.assistantLabel')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
              title={t('assistant.close')}
              aria-label={t('assistant.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3 dark:bg-[#0B1220]">
            {messages.map((message, index) => (
              <div key={`${message.id || index}-${message.role}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'rounded-tr-sm bg-indigo-600 text-white'
                      : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800 dark:border-gray-700 dark:bg-[#1E293B] dark:text-gray-100'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 dark:border-gray-700 dark:bg-[#1E293B] dark:text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('assistant.readingData')}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 p-3 dark:border-gray-800">
            <div className="relative">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                disabled={isSending}
                maxLength={8000}
                rows={1}
                placeholder={t('assistant.widgetPlaceholder')}
                className="max-h-24 min-h-[44px] w-full resize-none rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-11 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-60 dark:border-gray-700 dark:bg-[#1E293B] dark:text-white"
              />
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="absolute right-1.5 top-1.5 rounded-lg bg-purple-600 p-2 text-white hover:bg-purple-500 disabled:bg-gray-400"
                title={t('assistant.send')}
                aria-label={t('assistant.send')}
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      )}

      <button
        onClick={toggleOpen}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 text-white shadow-xl transition-transform hover:scale-105 hover:bg-purple-500"
        title={t('assistant.openAssistant')}
        aria-label={t('assistant.openAssistant')}
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-6 w-6" />}
        {!isOpen && <Bot className="absolute h-3.5 w-3.5 translate-x-3 translate-y-3 rounded-full bg-purple-500" />}
      </button>
    </div>
  );
}
