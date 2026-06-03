import Link from 'next/link';
import { LayoutDashboard, MessageSquare, Key } from 'lucide-react';
import { ReactNode } from 'react';

export default function EchoMindLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900 p-4 flex flex-col gap-6">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-blue-600 p-2 rounded-xl">
            <span className="font-bold text-xl text-white tracking-tighter">EM</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">EchoMind</h1>
        </div>
        
        <nav className="flex flex-col gap-2 mt-4">
          <Link href="/echomind/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </Link>
          <Link href="/echomind/mentions" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
            <MessageSquare size={20} />
            <span className="font-medium">Mentions Feed</span>
          </Link>
          <Link href="/echomind/keywords" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
            <Key size={20} />
            <span className="font-medium">Keywords</span>
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-950">
        <div className="max-w-7xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
