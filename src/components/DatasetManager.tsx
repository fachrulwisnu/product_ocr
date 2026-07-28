import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ReceiptImage, Project } from '../types';
import { 
  FileJson, 
  FileSpreadsheet, 
  Search, 
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface DatasetManagerProps {
  images?: ReceiptImage[];
  activeProject?: Project | null;
  onExport?: (format: 'json' | 'csv' | 'excel') => void;
  isDarkMode?: boolean;
}

export const DatasetManager: React.FC<DatasetManagerProps> = ({
  images = [],
  activeProject = null,
  onExport = (_format: 'json' | 'csv' | 'excel') => {},
  isDarkMode = true
}) => {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch verified records from Supabase
      const { data, error: dbError } = await supabase
        .from('few_shot_library') // Ensure this matches your actual table name
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      if (data) {
        setDatasets(data);
      }
    } catch (err: any) {
      console.error("Failed to fetch dataset from Supabase:", err.message);
      setError(err.message || "Failed to fetch dataset from Supabase");
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch on initial component mount
  useEffect(() => {
    fetchDatasets();
  }, []);

  // Compute combined or fallback items for UI rendering
  const displayedItems = datasets.length > 0 
    ? datasets.map((d, index) => {
        const jsonOutput = d.verified_json_output || {};
        const fileName = jsonOutput.fileName || 
          (jsonOutput.MACHINE_ID ? `ATM_${jsonOutput.MACHINE_ID}.png` : 
          (jsonOutput.TERMINAL_ID ? `ATM_${jsonOutput.TERMINAL_ID}.png` : 
          (jsonOutput.ATM_ID ? `ATM_${jsonOutput.ATM_ID}.png` : `Verified_Receipt_${d.id ? d.id.substring(0, 8) : index + 1}.png`)));
        const receiptType = d.document_type || jsonOutput.document_category || 'Cassette Audit Receipt';
        const fieldsCount = Object.keys(jsonOutput).length;
        const uploadDate = d.created_at ? new Date(d.created_at).toLocaleDateString() : new Date().toLocaleDateString();

        return {
          id: d.id || `ds-${index}`,
          fileName,
          receiptType,
          status: 'approved',
          fieldsCount,
          overallConfidence: 1.0,
          uploadDate,
          rawJson: jsonOutput
        };
      })
    : images.map(img => ({
        id: img.id,
        fileName: img.fileName,
        receiptType: img.receiptType,
        status: img.status,
        fieldsCount: img.fields.length,
        overallConfidence: img.overallConfidence,
        uploadDate: new Date(img.uploadDate).toLocaleDateString(),
        rawJson: img.fields.reduce((acc: any, f) => {
          if (f.key) acc[f.key] = f.value;
          return acc;
        }, {})
      }));

  const filteredItems = displayedItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.status === selectedCategory;
    const matchesSearch = item.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.receiptType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(item.rawJson || {}).toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalAnnotated = datasets.length > 0 ? datasets.length : images.length;
  const trainingReady = datasets.length > 0 ? datasets.length : images.filter(i => i.isTrainingSample || i.status === 'approved').length;
  const totalExtractedLabels = datasets.length > 0 
    ? datasets.reduce((acc, d) => acc + (d.verified_json_output ? Object.keys(d.verified_json_output).length : 0), 0)
    : images.reduce((acc, i) => acc + i.fields.length, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2">
      
      {/* Header & Export / Refresh Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">ATM RECEIPT DATASET MANAGER</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            View, audit, import, and export annotated receipt datasets synced live from Supabase <code className="text-indigo-400 bg-slate-800 px-1 py-0.5 rounded">few_shot_library</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={fetchDatasets}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold transition flex items-center gap-2 text-white shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Dataset
          </button>

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

      {/* Loading & Error Indicators */}
      {loading && <p className="text-gray-400 font-mono text-sm">Loading dataset from database...</p>}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded flex items-center gap-2 text-red-400 text-sm font-mono">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>Error loading data: {error}</span>
        </div>
      )}

      {!loading && !error && datasets.length === 0 && images.length === 0 && (
        <p className="text-gray-400 font-mono text-sm">No annotated samples found in the database yet.</p>
      )}

      {/* Dataset Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Annotated Samples</div>
          <div className="text-2xl font-black font-mono mt-1">{totalAnnotated}</div>
        </div>

        <div className={`p-4 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Training-Ready Samples</div>
          <div className="text-2xl font-black font-mono text-emerald-500 mt-1">
            {trainingReady}
          </div>
        </div>

        <div className={`p-4 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Extracted Key Labels</div>
          <div className="text-2xl font-black font-mono text-indigo-500 mt-1">
            {totalExtractedLabels}
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
              placeholder="Search dataset images or key fields..."
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
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-semibold text-slate-800 dark:text-slate-200 font-mono">
                    {item.fileName}
                  </td>
                  <td className="p-3 text-slate-500 font-medium font-sans">
                    {item.receiptType}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                      item.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' :
                      item.status === 'rejected' ? 'bg-rose-500/10 text-rose-600' :
                      'bg-amber-500/10 text-amber-600'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      {item.status}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-semibold text-indigo-400">
                    {item.fieldsCount} labels
                  </td>
                  <td className="p-3 font-mono font-bold text-emerald-500">
                    {Math.round(item.overallConfidence * 100)}%
                  </td>
                  <td className="p-3 text-right text-slate-400 font-mono text-[10px]">
                    {item.uploadDate}
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

