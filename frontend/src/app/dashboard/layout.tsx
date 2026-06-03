'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { SidebarBadge } from '@/components/dashboard/Badges';
import { canAccessAdmin, type User } from '@/lib/permissions';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import ThemeToggle from '@/components/ThemeToggle';
import { 
  LayoutDashboard, 
  Globe, 
  FileText, 
  Bell, 
  LogOut,
  Menu,
  X,
  Settings,
  Briefcase,
  PieChart,
  MessageSquareText,
  ScanSearch,
  ClipboardList,
  ChevronDown,
  Plus,
  Users,
  SearchCode,
  Link2
} from 'lucide-react';

function DashboardSidebar({ sidebarOpen, setSidebarOpen, user, badges }: any) {
  const pathname = usePathname();
  const router = useRouter();
  const { projects, activeProject, setActiveProject, loading: projectsLoading } = useProject();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const projectNav = [
    { name: 'Dashboard', href: '/dashboard/overview', icon: LayoutDashboard },
    { name: 'Mentions', href: '/dashboard/mentions', icon: MessageSquareText },
    { name: 'Summary', href: '/dashboard/summary', icon: PieChart },
    { name: 'Sources', href: '/dashboard/sources', icon: Globe },
    { name: 'Comparison', href: '/dashboard/comparison', icon: PieChart },
    { name: 'Influencers', href: '/dashboard/influencers', icon: Users },
    { name: 'Alerts', href: '/dashboard/alerts', icon: Bell, badge: badges.new_alerts },
    { name: 'PDF Reports', href: '/dashboard/reports', icon: ClipboardList },
    { name: 'Project Settings', href: '/dashboard/project-settings', icon: Settings },
  ];

  const systemNav = [
    { name: 'Scan Center', href: '/dashboard/scan', icon: SearchCode },
    { name: 'Integrations', href: '/dashboard/integrations', icon: Link2 },
    { name: 'Services', href: '/dashboard/services', icon: Briefcase },
    { name: 'System Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const handleLogout = () => {
    auth.logout();
    router.push('/login');
  };

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#030614] border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.6)] transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } flex flex-col`}
    >
      <div className="absolute top-0 left-0 w-full h-64 bg-indigo-500/5 blur-3xl pointer-events-none" />
      
      {/* Logo */}
      <div className="flex items-center justify-between h-[72px] px-6 border-b border-white/5 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)] border border-white/20">
            <span className="text-white font-bold text-lg leading-none">N</span>
          </div>
          <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">Nope</h1>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-2 -mr-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Project Selector */}
      <div className="p-4 border-b border-white/5 relative z-20">
        <div className="relative">
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-[#111827] border border-gray-800 rounded-xl text-left hover:bg-gray-800 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Dự án hiện tại</p>
              <p className="text-sm font-semibold text-white truncate">
                {projectsLoading ? 'Đang tải...' : activeProject?.name || 'Chọn dự án'}
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${projectDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {projectDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1E293B] border border-gray-700 rounded-xl shadow-2xl overflow-hidden py-1 z-50">
              <div className="max-h-48 overflow-y-auto">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProject(p);
                      setProjectDropdownOpen(false);
                      router.push('/dashboard/mentions');
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      activeProject?.id === p.id ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'text-gray-300 hover:bg-[#111827]'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-gray-700">
                <Link
                  href="/dashboard/projects/new"
                  onClick={() => setProjectDropdownOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> Thêm Project
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto scrollbar-hide relative z-10">
        
        {/* Project Contextual Nav */}
        <div className="space-y-1">
          <div className="px-3 mb-2 text-[10px] font-bold tracking-widest text-indigo-400 uppercase">
            Phân tích Dự án
          </div>
          {projectNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'text-white bg-white/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className={`w-4 h-4 mr-3 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                <span className="truncate flex-1">{item.name}</span>
                {item.badge ? <SidebarBadge count={item.badge} /> : null}
              </Link>
            );
          })}
        </div>

        {/* System/Admin Nav */}
        <div className="space-y-1 pt-4 border-t border-white/5">
          <div className="px-3 mb-2 text-[10px] font-bold tracking-widest text-gray-500 uppercase">
            Hệ thống
          </div>
          {systemNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'text-white bg-white/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className={`w-4 h-4 mr-3 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                <span className="truncate flex-1">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-white/5 bg-[#030614] z-10">
        <div className="flex items-center justify-between group cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-xl transition-colors">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-xs">
              {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{user?.full_name || user?.email}</p>
              <p className="text-xs text-zinc-500 truncate capitalize">{user?.role || 'Guest'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-400 rounded-lg">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [badges, setBadges] = useState<{ new_alerts: number, open_incidents: number, unreviewed_mentions: number }>({
    new_alerts: 0, open_incidents: 0, unreviewed_mentions: 0
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) return router.push('/login');
        const userData = await auth.getCurrentUser();
        setUser(userData);
        setLoading(false);
      } catch (error: any) {
        if (error?.response?.status !== 401) setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (user) {
      const fetchBadges = async () => {
        try {
          const { dashboard } = await import('@/lib/api');
          setBadges(await dashboard.sidebarBadges());
        } catch (error) {}
      };
      fetchBadges();
      const interval = setInterval(fetchBadges, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  if (loading) return <LoadingSpinner message="Đang khởi động..." />;

  return (
    <div className="min-h-screen bg-[#050A15]">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} user={user} badges={badges} />

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <div className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 bg-[#050A15]/70 backdrop-blur-2xl border-b border-white/5 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-white mr-2">
            <Menu className="w-5 h-5" />
          </button>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
        <main className="flex-1 p-4 lg:p-8 w-full max-w-[1920px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </ProjectProvider>
  );
}
