import React, { useState } from 'react';
import { Project, TrainingJob } from '../types';
import { 
  BrainCircuit, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  TrendingUp, 
  Cpu, 
  Layers, 
  Zap, 
  Info,
  Flame
} from 'lucide-react';

interface TrainingStudioProps {
  activeProject: Project | null;
  onRunTraining: () => Promise<void>;
  isTraining: boolean;
  trainingJob: TrainingJob | null;
  isDarkMode: boolean;
}

export const TrainingStudio: React.FC<TrainingStudioProps> = ({
  activeProject,
  onRunTraining,
  isTraining,
  trainingJob,
  isDarkMode
}) => {
  const sampleCount = activeProject?.trainedSampleCount || 0;
  const isReady = sampleCount >= 3;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Top Banner */}
      <div className={`p-5 rounded border ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      } space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <BrainCircuit className="w-3.5 h-3.5" />
              Nanonets Instant Learning Studio
            </div>
            <h2 className="text-xl font-bold tracking-tight uppercase">LayoutLMv3 Spatial Extraction Training</h2>
            <p className="text-xs text-slate-500">
              Only 3-5 corrected human samples are needed to train spatial key-value layout embeddings for ATM receipts.
            </p>
          </div>

          <button
            onClick={onRunTraining}
            disabled={!isReady || isTraining}
            className={`px-5 py-2.5 rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
              isTraining
                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                : isReady
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isTraining ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                Training Spatial Layout...
              </>
            ) : (
              <>
                <Flame className="w-4 h-4 text-amber-300" />
                Train Model ({sampleCount} Samples)
              </>
            )}
          </button>
        </div>

        {/* Readiness Progress */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Threshold Status:</span>
          <span className={`font-bold font-mono text-xs ${isReady ? 'text-indigo-400' : 'text-amber-500'}`}>
            {isReady ? 'Ready for Instant Learning Training!' : `${3 - sampleCount} more approved samples needed`}
          </span>
        </div>
      </div>

      {/* Training Live Progress / Epoch Graph */}
      {trainingJob && (
        <div className={`p-5 rounded border space-y-4 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Training Job Results ({trainingJob.modelName})</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold uppercase tracking-wider">
              Accuracy: {trainingJob.accuracyAfter}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Accuracy Before</div>
              <div className="text-lg font-black font-mono text-slate-400 mt-1">{trainingJob.accuracyBefore}%</div>
            </div>

            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Accuracy After</div>
              <div className="text-lg font-black font-mono text-emerald-500 mt-1">{trainingJob.accuracyAfter}%</div>
            </div>

            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Accuracy Boost</div>
              <div className="text-lg font-black font-mono text-amber-500 mt-1">
                +{(trainingJob.accuracyAfter - trainingJob.accuracyBefore).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Epoch Log Table */}
          <div className="space-y-2 pt-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Epoch Loss & Optimization Curves</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    <th className="pb-2">Epoch</th>
                    <th className="pb-2">Training Loss</th>
                    <th className="pb-2">Validation Loss</th>
                    <th className="pb-2 text-right">Model Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  {trainingJob.epochs.map((ep) => (
                    <tr key={ep.epoch} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2 font-bold">Epoch {ep.epoch}</td>
                      <td className="py-2 text-rose-500">{ep.loss}</td>
                      <td className="py-2 text-amber-500">{ep.valLoss}</td>
                      <td className="py-2 text-right font-bold text-emerald-500">{ep.accuracy}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
