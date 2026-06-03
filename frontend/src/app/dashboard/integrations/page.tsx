'use client';

import { useEffect, useState } from 'react';
import { Link2, CheckCircle2, AlertCircle, Clock, RefreshCcw, ExternalLink, Rss, Globe, Youtube, Facebook, Instagram, Twitter, Video, Mic } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Capabilities {
  web?: { status: string };
  youtube?: { status: string };
  facebook?: { status: string };
  instagram?: { status: string };
  rss?: { status: string };
  tiktok?: { status: string };
  twitter?: { status: string };
}

const STATUS_LABELS: Record<string, string> = {
  READY: 'Connected',
  CONFIG_REQUIRED: 'Config required',
  CONNECT_REQUIRED: 'Connect required',
  CONNECTOR_REQUIRED: 'Connector required',
  NO_SOURCES: 'No sources',
  COMING_SOON: 'Coming soon',
};

const STATUS_COLORS: Record<string, string> = {
  READY: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  CONFIG_REQUIRED: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  CONNECT_REQUIRED: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
  CONNECTOR_REQUIRED: 'text-gray-500 bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20',
  NO_SOURCES: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20',
  COMING_SOON: 'text-gray-500 bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20',
};

export default function IntegrationsPage() {
  const [caps, setCaps] = useState<Capabilities>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchCapabilities();
  }, []);

  const fetchCapabilities = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/integrations/capabilities');
      setCaps(res.data);
    } catch {
      toast.error('Lỗi tải trạng thái integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleMetaConnect = async () => {
    try {
      const res = await api.get('/api/integrations/meta/auth-url');
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error('Không nhận được OAuth URL từ server');
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '';
      if (detail.includes('cấu hình')) {
        toast.error('Config required: META_APP_ID/META_APP_SECRET chưa được cấu hình trên server');
      } else {
        toast.error(detail || 'Lỗi kết nối Meta');
      }
    }
  };

  const integrations = [
    {
      key: 'web',
      label: 'Web Search',
      icon: Globe,
      color: 'text-indigo-500',
      description: 'Thu thập mentions từ toàn bộ web qua Search API.',
      action: null,
      actionLabel: null,
    },
    {
      key: 'youtube',
      label: 'YouTube',
      icon: Youtube,
      color: 'text-red-500',
      description: 'Thu thập video, bình luận từ YouTube qua Data API v3.',
      action: null,
      actionLabel: null,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      icon: Facebook,
      color: 'text-blue-600',
      description: 'Kết nối Facebook Page qua Meta OAuth để theo dõi bình luận.',
      action: handleMetaConnect,
      actionLabel: 'Connect',
    },
    {
      key: 'instagram',
      label: 'Instagram',
      icon: Instagram,
      color: 'text-fuchsia-500',
      description: 'Kết nối Instagram Business qua Meta OAuth.',
      action: handleMetaConnect,
      actionLabel: 'Connect',
    },
    {
      key: 'rss',
      label: 'RSS Feeds',
      icon: Rss,
      color: 'text-orange-500',
      description: 'Theo dõi RSS/Atom feeds từ blog, báo điện tử.',
      action: () => router.push('/dashboard/sources'),
      actionLabel: 'Add RSS Source',
    },
    {
      key: 'twitter',
      label: 'X / Twitter',
      icon: Twitter,
      color: 'text-sky-500',
      description: 'Thu thập tweets, threads qua X API v2.',
      action: null,
      actionLabel: null,
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      icon: Video,
      color: 'text-pink-500',
      description: 'Chưa có connector TikTok hợp pháp khả dụng.',
      action: null,
      actionLabel: null,
      forceStatus: 'CONNECTOR_REQUIRED',
    },
    {
      key: 'podcasts',
      label: 'Podcasts',
      icon: Mic,
      color: 'text-purple-500',
      description: 'Thu thập từ podcast platforms.',
      action: null,
      actionLabel: null,
      forceStatus: 'COMING_SOON',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-wide flex items-center gap-2">
            <Link2 className="w-6 h-6 text-indigo-500" />
            Integrations
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Trạng thái kết nối với từng nguồn dữ liệu và nền tảng mạng xã hội.
          </p>
        </div>
        <button
          onClick={fetchCapabilities}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          <RefreshCcw className="w-5 h-5 animate-spin mr-2" /> Đang tải trạng thái...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((intg) => {
            const capStatus = (caps as any)[intg.key]?.status || intg.forceStatus || 'CONFIG_REQUIRED';
            const status = intg.forceStatus || capStatus;
            const isReady = status === 'READY';
            const statusLabel = STATUS_LABELS[status] || status;
            const statusClass = STATUS_COLORS[status] || STATUS_COLORS.CONFIG_REQUIRED;

            return (
              <div
                key={intg.key}
                className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center border border-gray-100 dark:border-white/10`}>
                      <intg.icon className={`w-6 h-6 ${intg.color}`} />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900 dark:text-white">{intg.label}</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-sm">{intg.description}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${statusClass}`}>
                    {statusLabel}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  {isReady ? (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      Đang hoạt động — dữ liệu đang được thu thập
                    </div>
                  ) : intg.action && (status === 'CONNECT_REQUIRED' || status === 'NO_SOURCES') ? (
                    <button
                      onClick={intg.action}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {intg.actionLabel}
                    </button>
                  ) : status === 'CONFIG_REQUIRED' ? (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Cần cấu hình API key trên server — liên hệ admin
                    </div>
                  ) : status === 'CONNECTOR_REQUIRED' ? (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Không có connector hợp pháp — Connector required
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      Coming soon
                    </div>
                  )}

                  {intg.key === 'facebook' || intg.key === 'instagram' ? (
                    <Link
                      href="/dashboard/integrations/meta"
                      className="ml-auto text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      Quản lý tài khoản <ExternalLink className="w-3 h-3" />
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
