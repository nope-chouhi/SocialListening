'use client';

import React, { useState, useCallback, createContext, useContext, ReactNode, useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, Tag, Mail, CheckCircle2, X, Info, AlertCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DialogVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  icon?: React.ReactNode;
}

interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: React.ReactNode;
}

interface AlertOptions {
  title: string;
  message: string;
  confirmText?: string;
  variant?: DialogVariant;
  icon?: React.ReactNode;
}

interface DialogContextType {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
  alert: (opts: AlertOptions) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const DialogContext = createContext<DialogContextType>({
  confirm: async () => false,
  prompt: async () => null,
  alert: async () => {},
});

export const useDialog = () => useContext(DialogContext);

// ─── Variant Styles ───────────────────────────────────────────────────────────

const variantConfig: Record<DialogVariant, {
  iconBg: string; iconColor: string; confirmBtn: string; defaultIcon: React.ReactNode;
}> = {
  danger: {
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-500',
    confirmBtn: 'bg-red-600 hover:bg-red-700 shadow-red-900/30',
    defaultIcon: <Trash2 className="w-6 h-6" />,
  },
  warning: {
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    confirmBtn: 'bg-amber-500 hover:bg-amber-600 shadow-amber-900/30',
    defaultIcon: <AlertTriangle className="w-6 h-6" />,
  },
  info: {
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    confirmBtn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/30',
    defaultIcon: <Info className="w-6 h-6" />,
  },
  success: {
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/30',
    defaultIcon: <CheckCircle2 className="w-6 h-6" />,
  },
};

// ─── Overlay / Backdrop ───────────────────────────────────────────────────────

function DialogOverlay({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="animate-in fade-in zoom-in-95 duration-200 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  opts, onConfirm, onCancel,
}: { opts: ConfirmOptions; onConfirm: () => void; onCancel: () => void }) {
  const variant = opts.variant || 'danger';
  const cfg = variantConfig[variant];

  return (
    <DialogOverlay onClose={onCancel}>
      <div className="bg-[#111827] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full ${cfg.iconBg} flex items-center justify-center`}>
              <span className={cfg.iconColor}>{opts.icon ?? cfg.defaultIcon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white mb-1">{opts.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{opts.message}</p>
            </div>
            <button onClick={onCancel} className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
          >
            {opts.cancelText || 'Hủy'}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all shadow-lg ${cfg.confirmBtn}`}
          >
            {opts.confirmText || 'Xác nhận'}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

// ─── Prompt Dialog ────────────────────────────────────────────────────────────

function PromptDialog({
  opts, onConfirm, onCancel,
}: { opts: PromptOptions; onConfirm: (val: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(opts.defaultValue || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(value);
  };

  return (
    <DialogOverlay onClose={onCancel}>
      <div className="bg-[#111827] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-500/15 flex items-center justify-center">
              <span className="text-indigo-400">{opts.icon ?? <Tag className="w-6 h-6" />}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white mb-1">{opts.title}</h3>
              {opts.message && <p className="text-sm text-gray-400">{opts.message}</p>}
            </div>
            <button onClick={onCancel} className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={opts.placeholder}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
            />
          </form>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
          >
            {opts.cancelText || 'Hủy'}
          </button>
          <button
            onClick={() => onConfirm(value)}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-lg shadow-indigo-900/30"
          >
            {opts.confirmText || 'Xác nhận'}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

// ─── Alert Dialog ─────────────────────────────────────────────────────────────

function AlertDialog({
  opts, onClose,
}: { opts: AlertOptions; onClose: () => void }) {
  const variant = opts.variant || 'info';
  const cfg = variantConfig[variant];

  return (
    <DialogOverlay onClose={onClose}>
      <div className="bg-[#111827] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full ${cfg.iconBg} flex items-center justify-center`}>
              <span className={cfg.iconColor}>{opts.icon ?? cfg.defaultIcon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white mb-1">{opts.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{opts.message}</p>
            </div>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end">
          <button
            onClick={onClose}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-xl transition-all shadow-lg ${cfg.confirmBtn}`}
          >
            {opts.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type PendingDialog =
  | { type: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { type: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void }
  | { type: 'alert'; opts: AlertOptions; resolve: () => void };

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDialog | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => setPending({ type: 'confirm', opts, resolve }));
  }, []);

  const prompt = useCallback((opts: PromptOptions): Promise<string | null> => {
    return new Promise(resolve => setPending({ type: 'prompt', opts, resolve }));
  }, []);

  const alert = useCallback((opts: AlertOptions): Promise<void> => {
    return new Promise(resolve => setPending({ type: 'alert', opts, resolve }));
  }, []);

  const dismiss = useCallback(() => setPending(null), []);

  return (
    <DialogContext.Provider value={{ confirm, prompt, alert }}>
      {children}

      {pending?.type === 'confirm' && (
        <ConfirmDialog
          opts={pending.opts}
          onConfirm={() => { pending.resolve(true); dismiss(); }}
          onCancel={() => { pending.resolve(false); dismiss(); }}
        />
      )}

      {pending?.type === 'prompt' && (
        <PromptDialog
          opts={pending.opts}
          onConfirm={val => { pending.resolve(val); dismiss(); }}
          onCancel={() => { pending.resolve(null); dismiss(); }}
        />
      )}

      {pending?.type === 'alert' && (
        <AlertDialog
          opts={pending.opts}
          onClose={() => { pending.resolve(); dismiss(); }}
        />
      )}
    </DialogContext.Provider>
  );
}
