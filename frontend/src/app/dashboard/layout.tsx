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
  Link2,
  Scale,
  Mail,
  FileSpreadsheet,
  Image as ImageIcon,
  Award
} from 'lucide-react';

function DashboardSidebar({ sidebarOpen, setSidebarOpen, user, badges }: any) {
  const pathname = usePathname();
  const router = useRouter();
  const { projects, activeProject, setActiveProject, loading: projectsLoading } = useProject();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const projectNav = [
    { name: 'Dashboard', href: '/dashboard/overview', icon: LayoutDashboard },
    { name: 'Mentions', href: '/dashboard/mentions', icon: MessageSquareText },
    { name: 'Analysis', href: '/dashboard/summary', icon: PieChart },
    { name: 'Comparison', href: '/dashboard/comparison', icon: Scale },
    { name: 'Influencers & Sources', href: '/dashboard/influencers', icon: Users },
  ];

  const reportsNav = [
    { name: 'Email reports', href: '#', icon: Mail },
    { name: 'PDF report', href: '/dashboard/reports', icon: FileText },
    { name: 'Excel report', href: '#', icon: FileSpreadsheet },
    { name: 'Infographic', href: '#', icon: ImageIcon },
  ];

  const systemNav = [
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
          <h1 className="text-xl font-black text-white uppercase tracking-wider">BRAND24</h1>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-2 -mr-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide relative z-10">
        
        {/* Project Contextual Nav */}
        <div className="space-y-1 mb-6">
          <div className="px-5 mb-2 flex items-center justify-between text-xs font-bold tracking-widest text-zinc-400 uppercase">
            <span>PROJECTS</span>
            <Link href="/dashboard/projects/new" className="text-zinc-800 hover:text-zinc-900">
              <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
            </Link>
          </div>

          {/* Active project selector */}
          <div className="relative mb-3">
            <button
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className="w-full px-5 py-2 flex items-center justify-between group cursor-pointer hover:bg-white/5 transition-colors"
            >
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  {projectsLoading ? 'Loading...' : activeProject?.name || 'Select Project'}
                </p>
                <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  &gt;100 New mentions
                </p>
              </div>
              <div className="flex items-center gap-3 text-zinc-400">
                <Settings className="w-4 h-4 hover:text-white" onClick={(e) => { e.stopPropagation(); router.push('/dashboard/project-settings'); }} />
                <ChevronDown className={`w-4 h-4 hover:text-white transition-transform ${projectDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {projectDropdownOpen && (
              <div className="absolute top-full left-4 right-4 mt-1 bg-[#1E293B] border border-gray-700 rounded-lg shadow-2xl overflow-hidden py-1 z-50">
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
              </div>
            )}
          </div>

          <div className="px-2">
            {projectNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'text-white bg-white/5'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`w-4 h-4 mr-3 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span className="truncate flex-1">{item.name}</span>
                  {(item as any).badge ? <SidebarBadge count={(item as any).badge} /> : null}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Reports Nav */}
        <div className="space-y-1 mb-6 border-t border-white/5 pt-4">
          <div className="px-5 mb-2 text-xs font-bold tracking-widest text-zinc-400 uppercase">
            REPORTS
          </div>
          <div className="px-2">
            {reportsNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'text-white bg-white/5'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`w-4 h-4 mr-3 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span className="truncate flex-1">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Webinar Banner */}
        <div className="px-5 mb-6">
          <div className="mb-2 text-[11px] font-bold tracking-widest text-white uppercase">
            UPCOMING WEBINAR
          </div>
          <p className="text-xs text-zinc-300 mb-2 leading-relaxed font-medium">
            Get a Social Listening certificate with Brand24
          </p>
          <p className="text-[11px] text-zinc-500 mb-3">
            Date: <strong className="text-zinc-400">Wednesday, June 3, 2026</strong>
          </p>
          <Link href="#" className="flex items-center text-xs font-bold text-blue-500 hover:text-blue-400">
            <Award className="w-4 h-4 mr-2" />
            Sign up for webinar
          </Link>
        </div>

        {/* System/Admin Nav */}
        <div className="space-y-1 pt-4 border-t border-white/5">
          <div className="px-5 mb-2 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
            SYSTEM
          </div>
          <div className="px-2">
            {systemNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'text-white bg-white/5'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`w-4 h-4 mr-3 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span className="truncate flex-1">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Legal Footer & User Profile Combine */}
      <div className="p-4 border-t border-white/5 bg-[#030614] z-10 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-100">
          <Link href="#" className="hover:underline">Legal Information</Link>
          <span className="text-zinc-600">|</span>
          <Link href="#" className="hover:underline">Customize cookie</Link>
        </div>
        <p className="text-[10px] text-zinc-500 leading-relaxed mb-2">
          Copyrights © 2026 Brand24, Inc. All rights reserved.
        </p>

        {/* Minimal User Profile */}
        <div className="flex items-center justify-between group cursor-pointer border-t border-white/5 pt-3">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center text-white font-bold text-xs">
              {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-300 truncate">{user?.full_name || user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg">
            <LogOut className="w-3.5 h-3.5" />
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
