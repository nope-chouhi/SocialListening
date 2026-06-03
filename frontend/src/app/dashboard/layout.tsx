'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { SidebarBadge } from '@/components/dashboard/Badges';
import { canAccessAdmin, type User } from '@/lib/permissions';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import { ThemeToggle } from '@/components/ThemeToggle';
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
  Award,
  Search,
  HelpCircle,
  Package,
  Zap
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
    { name: 'Email reports', href: '/dashboard/reports/email', icon: Mail },
    { name: 'PDF report', href: '/dashboard/reports', icon: FileText },
    { name: 'Excel report', href: '/dashboard/reports/excel', icon: FileSpreadsheet },
    { name: 'Infographic', href: '/dashboard/reports/infographic', icon: ImageIcon },
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
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#1A202C] border-r border-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } flex flex-col`}
    >
      
      {/* Logo */}
      <div className="flex items-center justify-between h-[64px] px-6 border-b border-gray-800 relative z-10 bg-[#1A202C]">
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
              className="w-full px-5 py-2 flex items-center justify-between group cursor-pointer hover:bg-[#2D3748] transition-colors"
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
                        activeProject?.id === p.id ? 'bg-[#2D3748] text-emerald-400 font-medium' : 'text-gray-300 hover:bg-[#2D3748]'
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
                      ? 'text-white bg-[#2D3748]'
                      : 'text-gray-400 hover:text-white hover:bg-[#2D3748]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`w-4 h-4 mr-3 ${isActive ? 'text-emerald-400' : 'text-gray-500'}`} />
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
                      ? 'text-white bg-[#2D3748]'
                      : 'text-gray-400 hover:text-white hover:bg-[#2D3748]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`w-4 h-4 mr-3 ${isActive ? 'text-emerald-400' : 'text-gray-500'}`} />
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
            Get a Social Listening certificate with Nope
          </p>
          <p className="text-[11px] text-zinc-500 mb-3">
            Date: <strong className="text-zinc-400">Wednesday, June 3, 2026</strong>
          </p>
          <Link href="/dashboard/webinar" className="flex items-center text-xs font-bold text-blue-500 hover:text-blue-400">
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
                      ? 'text-white bg-[#2D3748]'
                      : 'text-gray-400 hover:text-white hover:bg-[#2D3748]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`w-4 h-4 mr-3 ${isActive ? 'text-emerald-400' : 'text-gray-500'}`} />
                  <span className="truncate flex-1">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Legal Footer & User Profile Combine */}
      <div className="p-4 bg-[#1A202C] z-10 flex flex-col gap-4 mt-auto">
        <div className="flex flex-col items-center gap-1 text-[10px] font-bold text-gray-400 mb-2">
          <div className="flex items-center gap-2">
            <Link href="#" className="hover:text-white transition-colors">Legal Information</Link>
            <span className="text-gray-600">|</span>
            <Link href="#" className="hover:text-white transition-colors">Customize cookie</Link>
          </div>
          <p className="text-[10px] text-gray-500 leading-relaxed mt-2">
            Copyrights © 2026 Nope, Inc. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
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
  }, []);

  if (loading) return <LoadingSpinner message="Đang khởi động..." />;

  return (
    <div className="min-h-screen bg-[#F4F5F7] dark:bg-[#000511]">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      
      <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} user={user} badges={badges} />

      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Brand24 Top Header */}
        <div className="sticky top-0 z-20 flex items-center h-16 px-4 bg-white dark:bg-[#050A15] border-b border-gray-200 dark:border-white/10 lg:px-8 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900 mr-2">
            <Menu className="w-5 h-5" />
          </button>

          {/* Search bar */}
          <form 
            className="flex-1 flex items-center max-w-xl relative"
            onSubmit={(e) => {
              e.preventDefault();
              const val = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value;
              if (val) {
                router.push(`/dashboard/mentions?q=${encodeURIComponent(val)}`);
              } else {
                router.push('/dashboard/mentions');
              }
            }}
          >
            <Search className="w-4 h-4 text-gray-400 absolute left-3" />
            <input 
              name="q"
              type="text"
              defaultValue={q}
              placeholder="Search through mentions, authors & domains..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </form>

          <div className="ml-auto flex items-center space-x-4">
            <button className="hidden sm:flex items-center px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-full transition-colors tracking-wide shadow-sm">
              UPGRADE
            </button>
            <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block"></div>
            <button className="text-gray-400 hover:text-gray-600">
              <HelpCircle className="w-5 h-5" />
            </button>
            <button className="text-gray-400 hover:text-gray-600 hidden sm:block">
              <Package className="w-5 h-5" />
            </button>
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hidden sm:block">
              <Zap className="w-5 h-5" />
            </button>
            <ThemeToggle />
            
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold ml-2 cursor-pointer shadow-sm">
              {(user?.full_name || user?.email || 'K')[0].toUpperCase()}
            </div>
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
      <Suspense fallback={<LoadingSpinner message="Đang khởi động..." />}>
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
      </Suspense>
    </ProjectProvider>
  );
}
