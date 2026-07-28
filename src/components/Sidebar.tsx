import React from 'react';
import { 
  LayoutDashboard, 
  Upload, 
  Edit3, 
  CheckCircle2, 
  Database, 
  BrainCircuit, 
  Code2, 
  FileCode2,
  Plus, 
  LogOut,
  UserCheck,
  ShieldAlert
} from 'lucide-react';
import { Project } from '../types';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  projects: Project[];
  activeProject: Project | null;
  setActiveProject: (proj: Project) => void;
  onOpenNewProjectModal: () => void;
  pendingReviewsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  projects,
  activeProject,
  setActiveProject,
  onOpenNewProjectModal,
  pendingReviewsCount
}) => {
  const { user, signOut, isDemoUser } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Ingestion & Upload', icon: Upload },
    { id: 'annotate', label: 'Annotation & Review', icon: Edit3 },
    { 
      id: 'review-queue', 
      label: 'Review Queue', 
      icon: CheckCircle2,
      badge: pendingReviewsCount > 0 ? pendingReviewsCount : undefined 
    },
    { id: 'dataset', label: 'Dataset Manager', icon: Database },
    { id: 'templates', label: 'Template Manager', icon: FileCode2 },
    { id: 'training', label: 'Instant Learning', icon: BrainCircuit },
    { id: 'api-docs', label: 'REST API & Scalar', icon: Code2 }
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col justify-between h-screen sticky top-0 z-30 shrink-0 select-none">
      <div>
        {/* Header Logo */}
        <div className="h-14 px-4 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-sm shadow-xs">
            ATM
          </div>
          <div>
            <h2 className="font-extrabold text-xs tracking-wider uppercase text-white">Document AI</h2>
            <p className="text-[10px] text-slate-400 font-mono">Phase 1 Infrastructure</p>
          </div>
        </div>

        {/* User Info Welcome Badge */}
        <div className="p-3 m-3 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div className="truncate pr-2">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-emerald-400" />
              <span>{isDemoUser ? 'Demo User' : 'Supabase Auth'}</span>
            </div>
            <div className="text-xs font-mono font-bold text-slate-200 truncate mt-0.5">
              {user?.email || 'operator@atm-ai.internal'}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign Out"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Project Selector Section */}
        <div className="px-3 mb-4">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Project (projects_ocr)
            </span>
            <button
              onClick={onOpenNewProjectModal}
              className="text-indigo-400 hover:text-indigo-300 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer uppercase"
            >
              <Plus className="w-3 h-3" /> New
            </button>
          </div>
          <select
            value={activeProject?.id || ''}
            onChange={(e) => {
              const found = projects.find(p => p.id === e.target.value);
              if (found) setActiveProject(found);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer truncate"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-bold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="uppercase tracking-wider">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-[10px] text-slate-500 font-mono space-y-1">
        <div className="flex items-center gap-1.5 text-slate-400 font-bold">
          <ShieldAlert className="w-3 h-3 text-emerald-400" />
          <span>RLS Disabled (Early Dev)</span>
        </div>
        <p>Bucket: storage.buckets (receipt-images)</p>
      </div>
    </aside>
  );
};
