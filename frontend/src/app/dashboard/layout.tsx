'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { SidebarBadge } from '@/components/dashboard/Badges';
import { canAccessAdmin, type User } from '@/lib/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import toast, { Toaster } from 'react-hot-toast';
import { withTimeout } from '@/lib/utils/timeout';
import WebinarRegistrationModal from '@/components/dashboard/WebinarRegistrationModal';
import WebinarSuccessModal from '@/components/dashboard/WebinarSuccessModal';
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
  ChevronLeft,
  ChevronRight,
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
  Zap
} from 'lucide-react';

function DashboardSidebar({ sidebarOpen, setSidebarOpen, user, badges, setIsWebinarModalOpen, sidebarCollapsed, setSidebarCollapsed }: any) {
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
    { name: 'Integrations', href: '/dashboard/integrations', icon: Link2 },
    { name: 'Project Settings', href: '/dashboard/project-settings', icon: SearchCode },
  ];

  const reportsNav = [
    { name: 'Email reports', href: '/dashboard/reports/email', icon: Mail },
    { name: 'PDF report', href: '/dashboard/reports', icon: FileText },
    { name: 'Excel report', href: '/dashboard/reports/excel', icon: FileSpreadsheet },
    { name: 'Infographic', href: '/dashboard/reports/infographic', icon: ImageIcon },
  ];

  const systemNav = [
    { name: 'Services', href: '/dashboard/services', icon: Briefcase },
  ];

  const handleLogout = () => {
    auth.logout();
    router.push('/login');
  };

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 bg-[#1A202C] border-r border-gray-800 shadow-xl transform transition-all duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } ${sidebarCollapsed ? 'w-20' : 'w-64'} flex flex-col`}
    >
      
      {/* Logo + Collapse Toggle */}
      <div className={`flex items-center h-[64px] border-b border-gray-800 relative z-10 bg-[#1A202C] ${sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)] border border-white/20 shrink-0">
            <span className="text-white font-bold text-lg leading-none">N</span>
          </div>
          {!sidebarCollapsed && <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">Nope</h1>}
        </div>
        <div className="flex items-center gap-1">
          {/* Close on mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
          {/* Collapse/Expand on desktop */}
          <button
            onClick={() => {
              const next = !sidebarCollapsed;
              setSidebarCollapsed(next);
              if (typeof window !== 'undefined') {
                localStorage.setItem('sidebar_collapsed', String(next));
              }
            }}
            title={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide relative z-10">
        
        {/* Project Contextual Nav */}
        <div className="space-y-1 mb-6">
          {!sidebarCollapsed ? (
            <div className="px-5 mb-2 flex items-center justify-between text-xs font-bold tracking-widest text-zinc-400 uppercase">
              <span>PROJECTS</span>
              <Link href="/dashboard/projects/new" className="text-zinc-800 hover:text-zinc-900">
                <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
              </Link>
            </div>
          ) : (
            <div className="flex justify-center mb-2">
              <Link href="/dashboard/projects/new" title="New Project" className="text-zinc-800 hover:text-zinc-900">
                <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
              </Link>
            </div>
          )}

          {/* Active project selector */}
          <div className="relative mb-3">
            <button
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              title={activeProject?.name || 'Select Project'}
              className={`w-full py-2 flex items-center group cursor-pointer hover:bg-[#2D3748] transition-colors ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-5'}`}
            >
              <div className="text-left flex-1 min-w-0 flex items-center justify-center lg:justify-start">
                {!sidebarCollapsed ? (
                  <div>
                    <p className="text-sm font-bold text-white flex items-center gap-2">
                      {projectsLoading ? 'Loading...' : activeProject?.name || 'Select Project'}
                    </p>
                    <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      {activeProject ? `${badges.unreviewed_mentions > 0 ? `${badges.unreviewed_mentions} mentions chưa xem` : 'Không có mention mới'}` : 'Chọn project để xem'}
                    </p>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded bg-[#2D3748] flex items-center justify-center text-white font-bold text-xs">
                    {activeProject?.name?.charAt(0) || '?'}
                  </div>
                )}
              </div>
              {!sidebarCollapsed && (
                <div className="flex items-center gap-3 text-zinc-400">
                  <Settings className="w-4 h-4 hover:text-white" onClick={(e) => { e.stopPropagation(); router.push('/dashboard/project-settings'); }} />
                  <ChevronDown className={`w-4 h-4 hover:text-white transition-transform ${projectDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              )}
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
                  title={sidebarCollapsed ? item.name : undefined}
                  className={`group relative flex items-center py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'text-white bg-[#2D3748]'
                      : 'text-gray-400 hover:text-white hover:bg-[#2D3748]'
                  } ${sidebarCollapsed ? 'justify-center px-0' : 'px-3'}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-gray-500'} ${!sidebarCollapsed && 'mr-3'}`} />
                  {!sidebarCollapsed && <span className="truncate flex-1">{item.name}</span>}
                  {!sidebarCollapsed && (item as any).badge ? <SidebarBadge count={(item as any).badge} /> : null}
                  {/* Tooltip for collapsed mode */}
                  {sidebarCollapsed && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Reports Nav */}
        <div className="space-y-1 mb-6 border-t border-white/5 pt-4">
          {!sidebarCollapsed && (
            <div className="px-5 mb-2 text-xs font-bold tracking-widest text-zinc-400 uppercase">
              REPORTS
            </div>
          )}
          <div className="px-2">
            {reportsNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={sidebarCollapsed ? item.name : undefined}
                  className={`group relative flex items-center py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'text-white bg-[#2D3748]'
                      : 'text-gray-400 hover:text-white hover:bg-[#2D3748]'
                  } ${sidebarCollapsed ? 'justify-center px-0' : 'px-3'}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-gray-500'} ${!sidebarCollapsed && 'mr-3'}`} />
                  {!sidebarCollapsed && <span className="truncate flex-1">{item.name}</span>}
                  {sidebarCollapsed && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Webinar Banner */}
        {!sidebarCollapsed && (
          <div className="px-5 mb-6">
            <div className="mb-2 text-[11px] font-bold tracking-widest text-white uppercase">
              UPCOMING WEBINAR
            </div>
            <p className="text-xs text-zinc-300 mb-2 leading-relaxed font-medium">
              Get a Social Listening certificate with Nope
            </p>
            <p className="text-[11px] text-zinc-500 mb-3">
              Date: <strong className="text-zinc-400">Wednesday, June 10, 2026</strong>
            </p>
            <button onClick={() => setIsWebinarModalOpen(true)} className="flex items-center text-xs font-bold text-blue-500 hover:text-blue-400">
              <Award className="w-4 h-4 mr-2" />
              Sign up for webinar
            </button>
          </div>
        )}

        {/* System/Admin Nav */}
        <div className="space-y-1 pt-4 border-t border-white/5">
          {!sidebarCollapsed && (
            <div className="px-5 mb-2 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              SYSTEM
            </div>
          )}
          <div className="px-2">
            {systemNav.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={sidebarCollapsed ? item.name : undefined}
                  className={`group relative flex items-center py-2 text-sm font-medium rounded-lg transition-all ${
                    isActive
                      ? 'text-white bg-[#2D3748]'
                      : 'text-gray-400 hover:text-white hover:bg-[#2D3748]'
                  } ${sidebarCollapsed ? 'justify-center px-0' : 'px-3'}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-gray-500'} ${!sidebarCollapsed && 'mr-3'}`} />
                  {!sidebarCollapsed && <span className="truncate flex-1">{item.name}</span>}
                  {sidebarCollapsed && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

    </div>
  );
}

function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';

  return (
    <div className="flex-1 max-w-xl relative group">
      <div className="flex items-center relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3" />
        <input 
          name="q"
          type="text"
          defaultValue={q}
          onChange={(e) => {
            const val = e.target.value;
            window.dispatchEvent(new CustomEvent('topbar_search_typing'));
            if ((window as any).searchTimeout) clearTimeout((window as any).searchTimeout);
            (window as any).searchTimeout = setTimeout(() => {
              if (val) {
                router.push(`/dashboard/mentions?q=${encodeURIComponent(val)}`);
              } else {
                router.push('/dashboard/mentions');
              }
            }, 1000);
          }}
          placeholder="Tìm từ khóa và tự động quét nếu chưa có dữ liệu..."
          className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
        />
      </div>
      <div className="absolute top-full left-0 mt-1 hidden group-hover:block w-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[11px] px-3 py-1.5 rounded-md border border-blue-100 dark:border-blue-800/50 shadow-sm z-50">
        Nhập từ khóa, hệ thống sẽ tìm trong DB trước. Nếu chưa có dữ liệu, Nope sẽ tự quét internet.
      </div>
    </div>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isWebinarModalOpen, setIsWebinarModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [badges, setBadges] = useState<{ new_alerts: number, open_incidents: number, unreviewed_mentions: number }>({
    new_alerts: 0, open_incidents: 0, unreviewed_mentions: 0
  });

  // Hydration guard: only read localStorage after client mount
  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    const savedCollapse = localStorage.getItem('sidebar_collapsed');
    if (savedCollapse === 'true') {
      setSidebarCollapsed(true);
    }
  }, [router]);

  useEffect(() => {
    if (user) {
      const fetchBadges = async () => {
        try {
          const { dashboard } = await import('@/lib/api');
          setBadges(await withTimeout(dashboard.sidebarBadges(), 8000));
        } catch (error) {}
      };
      fetchBadges();
      const interval = setInterval(fetchBadges, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-[#F4F5F7] dark:bg-[#000511]">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      
      <DashboardSidebar 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        user={user} 
        badges={badges} 
        setIsWebinarModalOpen={setIsWebinarModalOpen}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
      />

      <Toaster 
        position="top-right" 
        toastOptions={{ 
          duration: 4000,
          className: 'dark:!bg-[#1E293B] dark:!text-white dark:!border-gray-700 dark:border shadow-lg'
        }} 
      />
      <div className={`transition-all duration-300 flex flex-col min-h-screen ${mounted ? (sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64') : 'lg:pl-64'}`}>
        <div className="sticky top-0 z-20 flex items-center h-16 px-4 bg-white dark:bg-[#050A15] border-b border-gray-200 dark:border-white/10 lg:px-8 shadow-sm">
          {/* Mobile hamburger */}
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900 mr-2">
            <Menu className="w-5 h-5" />
          </button>

          <Suspense fallback={<div className="flex-1 max-w-xl animate-pulse bg-gray-100 dark:bg-gray-800 h-10 rounded-lg" />}>
            <SearchBar />
          </Suspense>

          <div className="ml-auto flex items-center space-x-4">
            <button onClick={() => toast('Billing/Upgrade coming soon', { icon: '⏳' })} className="hidden sm:flex items-center px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-full transition-colors tracking-wide shadow-sm">
              UPGRADE
            </button>
            <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block"></div>
            <button onClick={() => toast.success('Vui lòng gửi email hỗ trợ đến support@nope.com')} title="Help Center" className="text-gray-400 hover:text-gray-600">
              <HelpCircle className="w-5 h-5" />
            </button>
            <button disabled title="Quick Actions (Coming soon)" className="text-gray-400 opacity-50 cursor-not-allowed hidden sm:block">
              <Zap className="w-5 h-5" />
            </button>
            <ThemeToggle />
            
            <div className="relative group">
              <div suppressHydrationWarning className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold ml-2 cursor-pointer shadow-sm hover:ring-2 hover:ring-indigo-500 transition-all">
                {authLoading ? '...' : (user?.full_name || user?.email || 'K')[0].toUpperCase()}
              </div>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1E293B] rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p suppressHydrationWarning className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.full_name || 'User'}</p>
                  <p suppressHydrationWarning className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                </div>
                <div className="py-1">
                  <Link href="/dashboard/settings" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                    System Settings
                  </Link>
                  <button onClick={() => { auth.logout(); router.push('/login'); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium">
                    Log out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <main className="flex-1 p-4 lg:p-8 w-full max-w-[1920px] mx-auto flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          {/* Footer — legal/copyright, NOT in sidebar */}
          <footer className="mt-10 pt-4 border-t border-gray-200 dark:border-white/10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400 dark:text-gray-500">
              <div className="flex items-center gap-4">
                <Link href="#" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Legal Information</Link>
                <Link href="#" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Customize cookie</Link>
              </div>
              <p className="text-center sm:text-right">Copyrights © 2026 Nope, Inc. All rights reserved.</p>
            </div>
          </footer>
        </main>
      </div>

      <WebinarRegistrationModal 
        isOpen={isWebinarModalOpen} 
        onClose={() => setIsWebinarModalOpen(false)} 
        onSuccess={() => {
          setIsWebinarModalOpen(false);
          setIsSuccessModalOpen(true);
        }} 
      />
      
      <WebinarSuccessModal 
        isOpen={isSuccessModalOpen} 
        onClose={() => setIsSuccessModalOpen(false)} 
      />
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
