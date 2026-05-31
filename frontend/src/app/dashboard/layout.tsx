'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { SidebarBadge } from '@/components/dashboard/Badges';
import { canAccessAdmin, type User } from '@/lib/permissions';
import { 
  LayoutDashboard, 
  Key, 
  Globe, 
  FileText, 
  Bell, 
  AlertTriangle, 
  LogOut,
  Menu,
  X,
  Settings,
  Briefcase,
  Radar,
  BarChart,
  Users,
  Trophy,
  Bot,
  PieChart,
  MessageSquareText,
  ScanSearch,
  ShieldAlert,
  ClipboardList
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [badges, setBadges] = useState<{ new_alerts: number, open_incidents: number, unreviewed_mentions: number }>({
    new_alerts: 0,
    open_incidents: 0,
    unreviewed_mentions: 0
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check token first
        const token = localStorage.getItem('access_token');
        if (!token) {
          console.log('No token, redirecting to login');
          router.push('/login');
          return;
        }

        // Try to get user info
        const userData = await auth.getCurrentUser();
        setUser(userData);
        setLoading(false);
      } catch (error: any) {
        console.error('Auth error:', error);
        // 401 is handled globally by the API interceptor (redirects to /login?expired=1)
        // For non-401 errors (network issues, 500, etc.), still show the dashboard in degraded mode
        if (error?.response?.status !== 401) {
          setLoading(false);
        }
        // If it's 401, the interceptor will redirect — don't set loading=false to avoid flash
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (user) {
      const fetchBadges = async () => {
        try {
          const { dashboard } = await import('@/lib/api');
          const data = await dashboard.sidebarBadges();
          setBadges(data);
        } catch (error) {
          console.error('Failed to fetch sidebar badges', error);
        }
      };
      fetchBadges();
      
      // Refresh badges every minute
      const interval = setInterval(fetchBadges, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Load theme from localStorage
  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleLogout = () => {
    auth.logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <LoadingSpinner 
        message="Đang khởi động..."
        submessage="Lần đầu truy cập có thể mất 30-60 giây để server khởi động. Vui lòng đợi trong giây lát."
      />
    );
  }

  const navigationGroups = [
    {
      group: 'TỔNG QUAN',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Lượt đề cập', href: '/dashboard/mentions', icon: MessageSquareText, badge: badges.unreviewed_mentions },
        { name: 'Phân tích', href: '/dashboard/analysis', icon: PieChart, disabled: true },
      ]
    },
    {
      group: 'THU THẬP DỮ LIỆU',
      items: [
        { name: 'Trung tâm quét', href: '/dashboard/scan', icon: ScanSearch },
        { name: 'Từ khóa', href: '/dashboard/keywords', icon: Key },
        { name: 'Nguồn', href: '/dashboard/sources', icon: Globe },
      ]
    },
    {
      group: 'CẢNH BÁO & XỬ LÝ',
      items: [
        { name: 'Cảnh báo', href: '/dashboard/alerts', icon: Bell, badge: badges.new_alerts },
        { name: 'Sự cố', href: '/dashboard/incidents', icon: AlertTriangle, badge: badges.open_incidents },
        { name: 'Xử lý truyền thông', href: '/dashboard/services', icon: ShieldAlert },
      ]
    },
    {
      group: 'TRÍ TUỆ AI',
      items: [
        { name: 'Trợ lý AI', href: '/dashboard/assistant', icon: Bot },
        { name: 'Đối thủ', href: '/dashboard/competitors', icon: Users },
        { name: 'Người ảnh hưởng', href: '/dashboard/influencers', icon: Trophy },
      ]
    },
    {
      group: 'BÁO CÁO',
      items: [
        { name: 'Báo cáo', href: '/dashboard/reports', icon: ClipboardList },
      ]
    },
    {
      group: 'HỆ THỐNG',
      items: [
        { name: 'Cài đặt', href: '/dashboard/settings', icon: Settings },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#0B1220]">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#080D19] border-r border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo with premium styling */}
          <div className="flex items-center justify-between h-[72px] px-6 border-b border-gray-800/50">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/20">
                <span className="text-white font-bold text-lg leading-none tracking-tight">N</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-wide">Nope</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 -mr-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation with refined active/hover states */}
          <nav className="flex-1 px-3 py-6 space-y-5 overflow-y-auto scrollbar-hide">
            {navigationGroups.map((group) => (
              <div key={group.group} className="space-y-1.5">
                <div className="px-3 mb-2 text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                  {group.group}
                </div>
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  if (item.disabled) {
                    return (
                      <div
                        key={item.name}
                        className="group flex items-center px-3 py-2 text-sm font-medium rounded-lg text-gray-600 cursor-not-allowed bg-transparent"
                        title="Chưa tích hợp"
                      >
                        <item.icon className="w-5 h-5 mr-3 flex-shrink-0 text-gray-700" />
                        <span className="truncate flex-1">{item.name}</span>
                        <span className="text-[9px] uppercase font-bold text-gray-500 bg-gray-800/40 px-1.5 py-0.5 rounded border border-gray-700/50">Chưa có</span>
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'sidebar-item-active text-white bg-[#1E293B]/80 shadow-sm border border-gray-700/50'
                          : 'text-gray-400 sidebar-item-hover hover:text-gray-100 hover:bg-gray-800/50'
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon 
                        className={`w-5 h-5 mr-3 flex-shrink-0 transition-colors duration-200 ${
                          isActive ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300'
                        }`} 
                      />
                      <span className="truncate">{item.name}</span>
                      {(item as any).badge ? (
                        <SidebarBadge count={(item as any).badge} />
                      ) : isActive ? (
                        <div className="ml-auto w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.8)]"></div>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Premium User Profile Bottom */}
          <div className="p-4 border-t border-gray-800/80 bg-[#0B1220]">
            <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-800/50 p-2 -m-2 rounded-xl transition-colors">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-sm border border-gray-700/50 shadow-sm">
                  {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">
                    {user?.full_name || user?.email || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5 capitalize">
                    {user?.role || 'Guest'}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                className="p-2 ml-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Premium Top bar */}
        <div className="sticky top-0 z-10 flex items-center h-16 px-4 bg-[#0B1020]/80 backdrop-blur-md border-b border-gray-800/50 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors mr-2"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex-1 flex items-center">
            {/* Optional: Add breadcrumbs or page title here later if needed */}
          </div>
          
          {/* Top Bar Actions */}
          <div className="flex items-center space-x-2">
            {/* Dark mode toggle - hidden since we are forcing premium dark theme, but kept functional if needed */}
            <button
              onClick={() => {
                const html = document.documentElement;
                const isDark = html.classList.contains('dark');
                if (isDark) {
                  html.classList.remove('dark');
                  localStorage.setItem('theme', 'light');
                } else {
                  html.classList.add('dark');
                  localStorage.setItem('theme', 'dark');
                }
              }}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Chuyển chế độ sáng/tối"
            >
              <svg className="w-5 h-5 dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <svg className="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 w-full max-w-[1920px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
