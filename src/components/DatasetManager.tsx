import React, { useState } from 'react';
import { ReceiptImage, Project } from '../types';
import { 
  Database, 
  Download, 
  Upload, 
  FileJson, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  Trash2, 
  CheckCircle2, 
  ExternalLink,
  Layers
} from 'lucide-react';

interface DatasetManagerProps {
  images: ReceiptImage[];
  activeProject: Project | null;
  onExport: (format: 'json' | 'csv' | 'excel') => void;
  isDarkMode: boolean;
}

export const DatasetManager: React.FC<DatasetManagerProps> = ({
  images,
  activeProject,
  onExport,
  isDarkMode
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredImages = images.filter(img => {
    const matchesCategory = selectedCategory === 'all' || img.status === selectedCategory;
    const matchesSearch = img.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header & Export Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight uppercase">ATM Receipt Dataset Manager</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            View, audit, import, and export annotated receipt datasets in JSON, CSV, or Excel formats.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onExport('json')}
            className="px-3.5 py-2 rounded font-bold text-xs uppercase tracking-wider bg-slate-800 text-white hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs border border-slate-700"
          >
            <FileJson className="w-4 h-4 text-indigo-400" />
            Export JSON
          </button>

          <button
            onClick={() => onExport('csv')}
            className="px-3.5 py-2 rounded font-bold text-xs uppercase tracking-wider bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV / Excel
          </button>
        </div>
      </div>

      {/* Dataset Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Annotated Samples</div>
          <div className="text-2xl font-black font-mono mt-1">{images.length}</div>
        </div>

        <div className={`p-4 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Training-Ready Samples</div>
          <div className="text-2xl font-black font-mono text-emerald-500 mt-1">
            {images.filter(i => i.isTrainingSample || i.status === 'approved').length}
          </div>
        </div>

        <div className={`p-4 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Extracted Key Labels</div>
          <div className="text-2xl font-black font-mono text-indigo-500 mt-1">
            {images.reduce((acc, i) => acc + i.fields.length, 0)}
          </div>
        </div>
      </div>

      {/* Dataset Samples Table */}
      <div className={`rounded border overflow-hidden ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search dataset images..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="needs_review">Needs Review</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/50 dark:bg-slate-800/40">
                <th className="p-3">File Name</th>
                <th className="p-3">Receipt Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Extracted Fields</th>
                <th className="p-3">Avg Confidence</th>
                <th className="p-3 text-right">Date Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {filteredImages.map((img) => (
                <tr key={img.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-semibold text-slate-800 dark:text-slate-200 font-mono">
                    {img.fileName}
                  </td>
                  <td className="p-3 text-slate-500 font-medium font-sans">
                    {img.receiptType}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                      img.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' :
                      img.status === 'rejected' ? 'bg-rose-500/10 text-rose-600' :
                      'bg-amber-500/10 text-amber-600'
                    }`}>
                      {img.status}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-semibold">
                    {img.fields.length} labels
                  </td>
                  <td className="p-3 font-mono font-bold text-emerald-500">
                    {Math.round(img.overallConfidence * 100)}%
                  </td>
                  <td className="p-3 text-right text-slate-400 font-mono text-[10px]">
                    {new Date(img.uploadDate).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
