import React from 'react';
import { Project } from '../types';
import { 
  Scan, 
  LayoutDashboard, 
  Upload, 
  Edit3, 
  CheckCircle2, 
  Database, 
  BrainCircuit, 
  Code2, 
  Plus, 
  Sparkles,
  Sun,
  Moon,
  DatabaseZap
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  projects: Project[];
  activeProject: Project | null;
  setActiveProject: (proj: Project) => void;
  onOpenNewProjectModal: () => void;
  pendingReviewsCount: number;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  isSupabaseConfigured: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  projects,
  activeProject,
  setActiveProject,
  onOpenNewProjectModal,
  pendingReviewsCount,
  isDarkMode,
  setIsDarkMode,
  isSupabaseConfigured
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'annotate', label: 'Annotation & Review', icon: Edit3 },
    { 
      id: 'review-queue', 
      label: 'Review Queue', 
      icon: CheckCircle2,
      badge: pendingReviewsCount > 0 ? pendingReviewsCount : undefined 
    },
    { id: 'dataset', label: 'Dataset Manager', icon: Database },
    { 
      id: 'training', 
      label: 'Instant Learning', 
      icon: BrainCircuit,
      highlight: activeProject && activeProject.trainedSampleCount >= 3
    },
    { id: 'api-docs', label: 'REST API', icon: Code2 },
  ];

  return (
    <header className={`border-b transition-colors ${
      isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
    } sticky top-0 z-40 shadow-xs`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">
          
          {/* Logo & Geometric Branding */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-base shadow-sm">
              N
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-slate-800 dark:text-slate-100 uppercase">
                ATM_RECEIPT_EXTRACTOR_V2
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider hidden md:inline-block border border-emerald-200 dark:border-emerald-800/60">
                Production Model v4.2
              </span>
            </div>
          </div>

          {/* Project Switcher Selector */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 hidden lg:inline">
              PROJECT:
            </span>
            <select
              value={activeProject?.id || ''}
              onChange={(e) => {
                const found = projects.find(p => p.id === e.target.value);
                if (found) setActiveProject(found);
              }}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer max-w-[180px] truncate"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                  {p.name} ({p.modelVersion})
                </option>
              ))}
            </select>
            <button
              onClick={onOpenNewProjectModal}
              title="Create New Project"
              className="p-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right Controls: NVIDIA NIM Status, Accuracy & Theme Toggle */}
          <div className="flex items-center gap-4">
            <div className="hidden xl:flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NVIDIA NIM:</span>
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Active</span>
            </div>

            {activeProject && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <div className="text-xs">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">ACC: </span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                    {activeProject.modelAccuracy}%
                  </span>
                </div>
              </div>
            )}

            {/* Supabase Status Indicator */}
            <div 
              title={isSupabaseConfigured ? "Supabase Database Connected" : "Local Database Running"}
              className={`p-1.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border ${
                isSupabaseConfigured 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              <DatabaseZap className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">{isSupabaseConfigured ? 'Supabase' : 'Local DB'}</span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex items-center space-x-1 overflow-x-auto py-1.5 border-t border-slate-100 dark:border-slate-800 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : item.highlight ? 'text-indigo-400 animate-bounce' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
                {item.highlight && !isActive && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
