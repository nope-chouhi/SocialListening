'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface Keyword {
  id: number;
  keyword: string;
  created_at: string;
}

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchKeywords = async () => {
    try {
      const res = await api.get('/api/echomind/keywords');
      setKeywords(res.data);
    } catch (error) {
      toast.error('Failed to load keywords');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeywords();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    try {
      await api.post('/api/echomind/keywords', { keyword: newKeyword.trim() });
      setNewKeyword('');
      fetchKeywords();
      toast.success('Keyword added successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to add keyword');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/echomind/keywords/${id}`);
      fetchKeywords();
      toast.success('Keyword deleted');
    } catch (error) {
      toast.error('Failed to delete keyword');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">Keywords</h2>
        <p className="text-slate-400 mt-1">Manage the keywords you want to monitor across social platforms.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <form onSubmit={handleAdd} className="flex gap-4">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="e.g. Apple, ChatGPT..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            Add Keyword
          </button>
        </form>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading keywords...</div>
        ) : keywords.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No keywords added yet. Add one above to start listening.</div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {keywords.map((kw) => (
              <li key={kw.id} className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                <div className="flex flex-col">
                  <span className="font-medium text-slate-200">{kw.keyword}</span>
                  <span className="text-sm text-slate-500">Added {new Date(kw.created_at).toLocaleDateString()}</span>
                </div>
                <button
                  onClick={() => handleDelete(kw.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
