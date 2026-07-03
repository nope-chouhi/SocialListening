import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle2, Tag, FileText, Eye, Trash2, MoreHorizontal } from 'lucide-react';

interface MentionActionMenuProps {
  mention: any;
  onReview: () => void;
  onTags: () => void;
  onToggleReport: () => void;
  onMuteAuthor: () => void;
  onMuteDomain: () => void;
  onDelete: () => void;
}

export function MentionActionMenu({
  mention,
  onReview,
  onTags,
  onToggleReport,
  onMuteAuthor,
  onMuteDomain,
  onDelete
}: MentionActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors shadow-sm dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
        title="More actions"
      >
        <MoreHorizontal className="w-3.5 h-3.5" /> More
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-1.5 w-44 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 overflow-hidden">
          <button
            onClick={() => { onReview(); setIsOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
              mention.is_reviewed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" /> {mention.is_reviewed ? 'Đã review' : 'Review'}
          </button>
          
          <button
            onClick={() => { onTags(); setIsOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <Tag className="w-4 h-4" /> Tags
          </button>

          <button
            onClick={() => { onToggleReport(); setIsOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
              mention.add_to_report ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" /> {mention.add_to_report ? 'Remove PDF' : 'Add PDF'}
          </button>

          <div className="h-px bg-slate-100 dark:bg-slate-700/50 my-1 mx-2" />

          <button
            disabled={!mention.author}
            onClick={() => { onMuteAuthor(); setIsOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50"
          >
            <Eye className="w-4 h-4" /> Mute author
          </button>

          <button
            disabled={!mention.domain}
            onClick={() => { onMuteDomain(); setIsOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50"
          >
            <Eye className="w-4 h-4" /> Mute site
          </button>

          <div className="h-px bg-slate-100 dark:bg-slate-700/50 my-1 mx-2" />

          <button
            onClick={() => { onDelete(); setIsOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-bold text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
