'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { auth, crawl } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { SidebarBadge } from '@/components/dashboard/Badges';
import { canAccessAdmin, type User } from '@/lib/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import toast, { Toaster } from 'react-hot-toast';
import { withTimeout } from '@/lib/utils/timeout';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
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
  HelpCircle,
  Zap,
  Sparkles
} from 'lucide-react';

function WorkerStatusBadge() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await crawl.getWorkerStatus();
        setStatus(data);
      } catch (err) {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  const isRunning = status.worker_running;
  const isEnabled = status.scheduler_enabled;
  
  if (!isEnabled) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-bold rounded-full border border-gray-200 dark:border-slate-300 dark:border-gray-700" title="Worker is disabled">
        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
        {t('header.workerOff')}
      </div>
    );
  }

  return (
    <div 
      className={`hidden sm:flex items-center gap-1.5 px-3 py-1 ${isRunning ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'} text-[10px] font-bold rounded-full cursor-help transition-colors`}
      title={isRunning ? `Worker Online. Running Jobs: ${status.running_jobs}. Due: ${status.due_sources}` : `Worker Offline! ${status.last_error || ''}`}
    >
      <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
      {isRunning ? t('header.workerOnline') : t('header.workerOffline')}
    </div>
  );
}

function DashboardSidebar({ sidebarOpen, setSidebarOpen, user, badges, setIsWebinarModalOpen, sidebarCollapsed, setSidebarCollapsed }: any) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const { projects, activeProject, setActiveProject, loading: projectsLoading } = useProject();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const projectNav = [
    { name: t('nav.dashboard'), href: '/dashboard/overview', icon: LayoutDashboard },
    { name: t('nav.mentions'), href: '/dashboard/mentions', icon: MessageSquareText },
    { name: t('nav.analysis'), href: '/dashboard/summary', icon: PieChart },
    { name: t('nav.comparison'), href: '/dashboard/comparison', icon: Scale },
    { name: t('nav.influencers'), href: '/dashboard/influencers', icon: Users },
    { name: t('nav.integrations'), href: '/dashboard/integrations', icon: Link2 },
    { name: t('nav.projectSettings'), href: '/dashboard/project-settings', icon: SearchCode },
  ];

  const reportsNav = [
    { name: t('nav.emailReports'), href: '/dashboard/reports/email', icon: Mail },
    { name: t('nav.pdfReport'), href: '/dashboard/reports', icon: FileText },
    { name: t('nav.excelReport'), href: '/dashboard/reports/excel', icon: FileSpreadsheet },
    { name: t('nav.infographic'), href: '/dashboard/reports/infographic', icon: ImageIcon },
  ];

  const systemNav = [
    { name: t('nav.aiAssistant'), href: '/dashboard/assistant', icon: Sparkles },
    { name: t('nav.services'), href: '/dashboard/services', icon: Briefcase },
  ];

  const handleLogout = () => {
    auth.logout();
    router.push('/login');
  };

  const toggleCollapse = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_collapsed', String(next));
    }
  };

  // Shared nav item renderer
  const NavItem = ({ item, isActive }: { item: { name: string; href: string; icon: any }, isActive: boolean }) => (
    <Link
      href={item.href}
      prefetch={false}
      title={item.name}
      className={`group relative flex items-center rounded-xl transition-all duration-200 ${
        isActive
          ? 'bg-white/10 text-white'
          : 'text-slate-500 dark:text-gray-400 hover:text-white hover:bg-white/5'
      } ${sidebarCollapsed
          ? 'justify-center w-10 h-10 mx-auto'
          : 'px-3 py-2.5 gap-3'
      }`}
      onClick={() => setSidebarOpen(false)}
    >
      {/* Active pill indicator */}
      {isActive && (
        <span className={`absolute ${sidebarCollapsed ? 'left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full' : 'left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full'} bg-indigo-400`} />
      )}
      <item.icon className={`shrink-0 transition-colors ${sidebarCollapsed ? 'w-[18px] h-[18px]' : 'w-[17px] h-[17px]'} ${isActive ? 'text-indigo-300' : 'text-gray-500 group-hover:text-slate-700 dark:text-gray-300'}`} />
      {!sidebarCollapsed && <span className="truncate text-sm font-medium">{item.name}</span>}
      {/* Tooltip in collapsed mode */}
      {sidebarCollapsed && (
        <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 bg-slate-50 dark:bg-[#0F172A] border border-white/10 text-slate-900 dark:text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-150 z-50 shadow-xl">
          {item.name}
        </span>
      )}
    </Link>
  );

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0D1117] border-r border-white/[0.06] shadow-2xl transform transition-all duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } ${sidebarCollapsed ? 'w-[68px]' : 'w-64'}`}
    >

      {/* ── Header: Logo + Collapse Button ─────────────────────────────── */}
      <div className={`flex items-center shrink-0 border-b border-white/[0.06] ${sidebarCollapsed ? 'flex-col justify-center py-4 gap-3' : 'h-[64px] justify-between px-4'}`}>
        {sidebarCollapsed ? (
          /* Collapsed: Logo and Toggle button */
          <>
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-white/20">
              <span className="text-white font-black text-base leading-none">N</span>
            </div>
            <button
              onClick={toggleCollapse}
              title="Mở rộng sidebar"
              className="group relative w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
              <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 bg-slate-50 dark:bg-[#0F172A] border border-white/10 text-slate-900 dark:text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all z-50 shadow-xl">
                {t('common.expand')}
              </span>
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-white/20 shrink-0">
                <span className="text-white font-black text-base leading-none">N</span>
              </div>
              <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 tracking-tight">Nope24</h1>
            </div>
            <div className="flex items-center gap-1">
              {/* Close on mobile */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              {/* Collapse on desktop */}
              <button
                onClick={toggleCollapse}
                title={t('common.collapse')}
                className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Scrollable Nav ─────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-3">

        {/* Project selector */}
        <div className={`mb-1 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{t('nav.projectsTitle')}</span>
              <Link href="/dashboard/projects/new" title="New Project" className="text-zinc-400 hover:text-emerald-400 transition-colors" prefetch={false}>
                <Plus className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {sidebarCollapsed ? (
            /* Collapsed project: avatar only */
            <div className="flex flex-col items-center gap-2 mt-1">
              <Link href="/dashboard/projects/new" title="New Project" className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-emerald-400 hover:bg-white/5 transition-colors" prefetch={false}>
                <Plus className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                title={activeProject?.name || t('mentions.page.selectProject')}
                className="group relative w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/[0.06] transition-all"
              >
                <span className="text-white font-bold text-xs">
                  {activeProject?.name?.charAt(0).toUpperCase() || '?'}
                </span>
                {/* Active dot */}
                <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-400 border-2 border-[#0D1117]" />
                {/* Tooltip */}
                <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 bg-slate-50 dark:bg-[#0F172A] border border-white/10 text-slate-900 dark:text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-150 z-50 shadow-xl">
                  {activeProject?.name || t('mentions.page.selectProject')}
                </span>
              </button>
              {projectDropdownOpen && (
                <div className="absolute left-[76px] top-[10px] w-52 bg-white dark:bg-[#1E293B] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1.5 z-50">
                  {projects.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => { setActiveProject(p); setProjectDropdownOpen(false); router.push('/dashboard/mentions'); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${activeProject?.id === p.id ? 'bg-white/10 text-emerald-400 font-semibold' : 'text-slate-700 dark:text-gray-300 hover:bg-white/5'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Expanded project selector */
            <div className="relative">
              <button
                onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {activeProject?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold text-white truncate leading-none">
                      {projectsLoading ? t('common.loading') : activeProject?.name || t('mentions.page.selectProject')}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      {activeProject ? t('common.active') : t('mentions.page.noProject')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-zinc-500 shrink-0">
                  <Settings className="w-3.5 h-3.5 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); router.push('/dashboard/project-settings'); }} />
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${projectDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {projectDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#1E293B] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1.5 z-50">
                  <div className="max-h-48 overflow-y-auto">
                    {projects.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => { setActiveProject(p); setProjectDropdownOpen(false); router.push('/dashboard/mentions'); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${activeProject?.id === p.id ? 'bg-white/10 text-emerald-400 font-semibold' : 'text-slate-700 dark:text-gray-300 hover:bg-white/5'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className={`my-3 border-t border-white/[0.06] ${sidebarCollapsed ? 'mx-3' : 'mx-4'}`} />

        {/* Project Nav */}
        <div className={`space-y-0.5 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {!sidebarCollapsed && (
            <p className="px-2 mb-1.5 text-[10px] font-bold tracking-widest text-slate-400 uppercase">{t('nav.workspace')}</p>
          )}
          {projectNav.map((item) => (
            <NavItem key={item.name} item={item} isActive={pathname === item.href} />
          ))}
        </div>

        {/* Divider */}
        <div className={`my-3 border-t border-white/[0.06] ${sidebarCollapsed ? 'mx-3' : 'mx-4'}`} />

        {/* Reports Nav */}
        <div className={`space-y-0.5 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {!sidebarCollapsed && (
            <p className="px-2 mb-1.5 text-[10px] font-bold tracking-widest text-slate-400 uppercase">{t('nav.reportsTitle')}</p>
          )}
          {reportsNav.map((item) => (
            <NavItem key={item.name} item={item} isActive={pathname === item.href} />
          ))}
        </div>

        {/* Divider */}
        <div className={`my-3 border-t border-white/[0.06] ${sidebarCollapsed ? 'mx-3' : 'mx-4'}`} />

        {/* System Nav */}
        <div className={`space-y-0.5 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {!sidebarCollapsed && (
            <p className="px-2 mb-1.5 text-[10px] font-bold tracking-widest text-slate-400 uppercase">{t('nav.systemTitle')}</p>
          )}
          {systemNav.map((item) => (
            <NavItem key={item.name} item={item} isActive={pathname.startsWith(item.href)} />
          ))}
        </div>

        {/* Webinar Banner (expanded only) */}
        {!sidebarCollapsed && (
          <div className="mx-3 mt-4 p-3 rounded-xl bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/20">
            <p className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase mb-1">{t('nav.webinar')}</p>
            <p className="text-xs text-zinc-300 leading-relaxed mb-2">{t('nav.webinarDesc')}</p>
            <button onClick={() => setIsWebinarModalOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
              <Award className="w-3.5 h-3.5" />
              {t('nav.signUp')}
            </button>
          </div>
        )}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className={`shrink-0 border-t border-white/[0.06] flex items-center ${sidebarCollapsed ? 'justify-center py-3' : 'justify-between px-4 py-3'}`}>
        <button onClick={handleLogout} className={`flex items-center gap-2 text-xs text-zinc-500 hover:text-red-400 transition-colors font-medium ${sidebarCollapsed ? 'justify-center w-10 h-10 rounded-xl hover:bg-white/5' : ''}`}>
          <LogOut className="w-4 h-4" />
          {!sidebarCollapsed && t('nav.logout')}
        </button>
      </div>
    </div>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
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
          className: 'dark:!bg-white dark:bg-[#1E293B] dark:!text-white dark:!border-slate-300 dark:border-gray-700 dark:border shadow-lg'
        }} 
      />
      <div className={`transition-all duration-300 flex flex-col min-h-screen ${mounted ? (sidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-64') : 'lg:pl-64'}`}>
        <div className="sticky top-0 z-20 flex items-center h-16 px-4 bg-white dark:bg-[#050A15] border-b border-gray-200 dark:border-white/10 lg:px-8 shadow-sm">
          {/* Mobile hamburger */}
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900 mr-2">
            <Menu className="w-5 h-5" />
          </button>

          <div className="ml-auto flex items-center space-x-4">
            <WorkerStatusBadge />
            <button onClick={() => toast('Billing/Upgrade coming soon', { icon: '⏳' })} className="hidden sm:flex items-center px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-full transition-colors tracking-wide shadow-sm">
              {t('header.upgrade')}
            </button>
            <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block"></div>
            <button onClick={() => toast.success('Vui lòng gửi email hỗ trợ đến support@nope.com')} title="Help Center" className="text-slate-500 dark:text-gray-400 hover:text-gray-600">
              <HelpCircle className="w-5 h-5" />
            </button>
            <button disabled title="Quick Actions (Coming soon)" className="text-slate-500 dark:text-gray-400 opacity-50 cursor-not-allowed hidden sm:block">
              <Zap className="w-5 h-5" />
            </button>
            <LanguageSwitcher />
            <ThemeToggle />
            
            <div className="relative group">
              <div suppressHydrationWarning className="w-8 h-8 rounded-full bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center text-xs font-bold ml-2 cursor-pointer shadow-sm hover:ring-2 hover:ring-indigo-500 transition-all">
                {authLoading ? '...' : (user?.full_name || user?.email || 'K')[0].toUpperCase()}
              </div>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1E293B] rounded-lg shadow-xl border border-gray-100 dark:border-slate-300 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-300 dark:border-gray-700">
                  <p suppressHydrationWarning className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.full_name || 'User'}</p>
                  <p suppressHydrationWarning className="text-xs text-slate-500 dark:text-gray-400 truncate">{user?.email}</p>
                </div>
                <div className="py-1">
                  <Link href="/dashboard/settings" className="block px-4 py-2 text-sm text-slate-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800" prefetch={false}>
                    {t('nav.projectSettings')}
                  </Link>
                  <button onClick={() => { auth.logout(); router.push('/login'); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium">
                    {t('nav.logout')}
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-gray-400 dark:text-gray-500">
              <div className="flex items-center gap-4">
                <Link href="#" className="hover:text-gray-700 dark:hover:text-slate-700 dark:text-gray-300 transition-colors">Legal Information</Link>
                <Link href="#" className="hover:text-gray-700 dark:hover:text-slate-700 dark:text-gray-300 transition-colors">Customize cookie</Link>
              </div>
              <p className="text-center sm:text-right">Copyrights © 2026 Nope24, Inc. All rights reserved.</p>
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
