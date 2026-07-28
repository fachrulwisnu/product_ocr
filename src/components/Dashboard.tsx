import React from 'react';
import { PlatformMetrics, ActivityLog, Project, ReceiptImage } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  FolderKanban, 
  FileText, 
  GraduationCap, 
  Target, 
  Clock, 
  ArrowUpRight, 
  Cpu, 
  CheckCircle2, 
  Upload, 
  Edit3, 
  BrainCircuit,
  Zap,
  Sparkles,
  TrendingUp,
  Terminal,
  UserCheck,
  Plus,
  FolderOpen
} from 'lucide-react';

interface DashboardProps {
  metrics: PlatformMetrics | null;
  activityLogs: ActivityLog[];
  activeProject: Project | null;
  projects: Project[];
  images: ReceiptImage[];
  onNavigateTab: (tab: string) => void;
  onTrainModel: () => void;
  onOpenNewProjectModal: () => void;
  isDarkMode: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  metrics,
  activityLogs,
  activeProject,
  projects,
  images,
  onNavigateTab,
  onTrainModel,
  onOpenNewProjectModal,
  isDarkMode
}) => {
  const { user } = useAuth();
  const trainedSamplesCount = activeProject?.trainedSampleCount || 0;
  const canTrain = trainedSamplesCount >= 3;

  return (
    <div className="space-y-6">
      
      {/* Welcome Email Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded bg-slate-900 border border-slate-800 text-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Welcome back, <span className="text-emerald-400 font-mono">{user?.email || 'operator@atm-ai.internal'}</span>
            </h2>
            <p className="text-xs text-slate-400">
              Supabase Auth Session Active • Phase 1 Core Infrastructure & Multi-Tenant SQL Schema
            </p>
          </div>
        </div>

        <button
          onClick={onOpenNewProjectModal}
          className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Project</span>
        </button>
      </div>

      {/* Projects OCR Supabase Table Summary Card */}
      <div className={`p-5 rounded border ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      } space-y-4`}>
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-indigo-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider">
              Supabase Projects (<code className="text-indigo-400 font-mono">projects_ocr</code> Table)
            </h2>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {projects.length} Active Projects
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className={`p-4 rounded border text-xs space-y-2 transition-all ${
                activeProject?.id === proj.id
                  ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200 ring-1 ring-indigo-500/30'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold uppercase text-white truncate max-w-[180px]">{proj.name}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 uppercase">
                  {proj.receiptType || 'ATM'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">{proj.description}</p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 text-[10px] font-mono text-slate-400">
                <span>Accuracy: <strong className="text-emerald-400">{proj.modelAccuracy}%</strong></span>
                <span>Samples: <strong className="text-indigo-300">{proj.trainedSampleCount}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Top Banner: Instant Learning Readiness */}
      <div className="relative overflow-hidden rounded bg-slate-900 border border-slate-800 p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Nanonets Instant Learning Workflow Active
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight uppercase">
              {activeProject ? activeProject.name : 'ATM RECEIPT EXTRACTOR V2'}
            </h1>
            <p className="text-slate-300 text-xs leading-relaxed">
              Continuous spatial AI layout model learning powered by NVIDIA NIM OCR API. Annotate 3-5 ATM receipts to automatically boost extraction accuracy.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => onNavigateTab('upload')}
              className="w-full sm:w-auto px-4 py-2 rounded text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Upload className="w-4 h-4 text-indigo-400" />
              Upload Receipt
            </button>

            <button
              onClick={() => onNavigateTab('annotate')}
              className="w-full sm:w-auto px-4 py-2 rounded text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Edit3 className="w-4 h-4" />
              Annotate & Review
            </button>

            {canTrain && (
              <button
                onClick={onTrainModel}
                className="w-full sm:w-auto px-5 py-2 rounded text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-400 hover:to-emerald-400 text-slate-950 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                <BrainCircuit className="w-4 h-4" />
                Train Model ({trainedSamplesCount} Samples)
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar towards 3-5 sample threshold */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Training Threshold:</span>
            <span className="font-bold text-indigo-400 font-mono">{trainedSamplesCount} / 3-5 Corrected Samples</span>
          </div>
          <div className="w-full sm:w-64 bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700">
            <div 
              className="bg-indigo-400 h-full transition-all duration-500 shadow-[0_0_8px_rgba(129,140,248,0.6)]"
              style={{ width: `${Math.min(100, (trainedSamplesCount / 3) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Projects */}
        <div className={`p-4 rounded border transition-all ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        } shadow-xs hover:shadow-md`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Projects</span>
            <div className="p-1.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono">{metrics?.totalProjects || 2}</span>
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              ATM Fleet
            </span>
          </div>
        </div>

        {/* Card 2: Images */}
        <div className={`p-4 rounded border transition-all ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        } shadow-xs hover:shadow-md`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Images</span>
            <div className="p-1.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono">{metrics?.totalImages || images.length}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Processed</span>
          </div>
        </div>

        {/* Card 3: Trained Samples */}
        <div className={`p-4 rounded border transition-all ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        } shadow-xs hover:shadow-md`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trained Samples</span>
            <div className="p-1.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">{trainedSamplesCount}</span>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              {canTrain ? 'Ready' : `${3 - trainedSamplesCount} needed`}
            </span>
          </div>
        </div>

        {/* Card 4: Model Accuracy */}
        <div className={`p-4 rounded border transition-all ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        } shadow-xs hover:shadow-md`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Model Accuracy</span>
            <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {activeProject?.modelAccuracy || 94.8}%
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +12%
            </span>
          </div>
        </div>

        {/* Card 5: Pending Reviews */}
        <div className={`p-4 rounded border transition-all ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        } shadow-xs hover:shadow-md`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Queue</span>
            <div className="p-1.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
              {metrics?.pendingReviewsCount || images.filter(i => i.status === 'needs_review').length}
            </span>
            <button
              onClick={() => onNavigateTab('review-queue')}
              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:underline flex items-center cursor-pointer"
            >
              Queue <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Main Grid: Architecture Status & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Architecture & AI Engine Card */}
        <div className={`lg:col-span-1 p-5 rounded border ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        } space-y-4`}>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">OCR & AI Architecture</h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
              Active
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>OCR Ingestion Engine</span>
                <span className="text-[10px] text-indigo-500 font-mono font-bold">NVIDIA NIM OCR</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Direct NVIDIA OCR API endpoint integration returning word/line spatial bounding boxes and raw thermal receipt text.
              </p>
            </div>

            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Extraction Model</span>
                <span className="text-[10px] text-indigo-500 font-mono font-bold">LayoutLMv3 Spatial AI</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Extracts key fields (ATM_ID, Date, Amount, Balance, Cassettes 1-4, Rejected) using spatial position & word relationships.
              </p>
            </div>

            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Instant Learning Engine</span>
                <span className="text-[10px] text-amber-500 font-mono font-bold">Nanonets Few-Shot</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Fine-tunes layout patterns and field positions after human review of 3-5 corrected receipt samples.
              </p>
            </div>
          </div>
        </div>

        {/* Activity Logs Table */}
        <div className={`lg:col-span-2 p-5 rounded border ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        } space-y-4`}>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-500" />
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Recent Activity & Audit Trail</h2>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Updates</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-2">Action</th>
                  <th className="pb-2">Details</th>
                  <th className="pb-2">User / Engine</th>
                  <th className="pb-2 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {activityLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 font-semibold">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-bold ${
                        log.action === 'ocr_processed' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                        log.action === 'training_completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        log.action === 'field_edited' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-700 dark:text-slate-300 max-w-xs truncate font-sans">
                      {log.details}
                    </td>
                    <td className="py-2.5 text-slate-500 font-medium">
                      {log.user}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-400 text-[10px]">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
