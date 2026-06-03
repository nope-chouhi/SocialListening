'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Twitter, MessageCircle, Globe, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Mention {
  id: number;
  keyword: string;
  source: string;
  content: string;
  author: string;
  created_at: string;
  sentiment: string;
  sentiment_score: number;
}

export default function MentionsPage() {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMentions = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.get('/api/echomind/mentions');
      setMentions(res.data);
    } catch (error) {
      toast.error('Failed to load mentions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Poll every 10 seconds for real-time feel (Disabled to stop spam)
  useEffect(() => {
    fetchMentions();
  }, []);

  const getSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case 'x': return <Twitter size={18} className="text-blue-400" />;
      case 'reddit': return <MessageCircle size={18} className="text-orange-500" />;
      default: return <Globe size={18} className="text-emerald-500" />;
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    const baseClasses = "px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border";
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return <span className={`${baseClasses} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`}>{sentiment}</span>;
      case 'negative':
        return <span className={`${baseClasses} bg-red-500/10 text-red-400 border-red-500/20`}>{sentiment}</span>;
      default:
        return <span className={`${baseClasses} bg-slate-500/10 text-slate-400 border-slate-500/20`}>{sentiment}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Mentions Feed</h2>
          <p className="text-slate-400 mt-1">Live stream of conversations across the web.</p>
        </div>
        <button
          onClick={() => fetchMentions(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin text-blue-500" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="space-y-4">
        {loading && !mentions.length ? (
          <div className="p-8 text-center text-slate-400 bg-slate-900 rounded-xl border border-slate-800">Loading mentions...</div>
        ) : mentions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-900 rounded-xl border border-slate-800">No mentions found yet. Make sure you have active keywords!</div>
        ) : (
          mentions.map((mention) => (
            <div key={mention.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    {getSourceIcon(mention.source)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-200">@{mention.author}</h3>
                    <p className="text-xs text-slate-500">{new Date(mention.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    #{mention.keyword}
                  </span>
                  {getSentimentBadge(mention.sentiment)}
                </div>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">{mention.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
