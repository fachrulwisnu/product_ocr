import React, { useState } from 'react';
import { ReceiptImage, ReviewStatus } from '../types';
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Filter, 
  Edit3, 
  FileText, 
  ChevronRight,
  AlertTriangle,
  Search
} from 'lucide-react';

interface ReviewQueueProps {
  images: ReceiptImage[];
  onSelectForAnnotation: (image: ReceiptImage) => void;
  onBatchApprove?: (imageIds: string[]) => void;
  isDarkMode: boolean;
}

export const ReviewQueue: React.FC<ReviewQueueProps> = ({
  images,
  onSelectForAnnotation,
  onBatchApprove,
  isDarkMode
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('needs_review');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredImages = images.filter(img => {
    const matchesStatus = statusFilter === 'all' || img.status === statusFilter;
    const matchesSearch = img.fileName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          img.receiptType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight uppercase">Receipt Review Queue</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Review AI predictions with low confidence before dataset approval and model training.
          </p>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search receipt filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider">
            <button
              onClick={() => setStatusFilter('needs_review')}
              className={`px-3 py-1 rounded transition-all cursor-pointer ${
                statusFilter === 'needs_review' ? 'bg-amber-500 text-white' : 'text-slate-500'
              }`}
            >
              Needs Review ({images.filter(i => i.status === 'needs_review').length})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1 rounded transition-all cursor-pointer ${
                statusFilter === 'approved' ? 'bg-indigo-600 text-white' : 'text-slate-500'
              }`}
            >
              Approved ({images.filter(i => i.status === 'approved').length})
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-500'
              }`}
            >
              All ({images.length})
            </button>
          </div>
        </div>
      </div>

      {/* Review Queue Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredImages.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-500 font-mono text-xs">
            No receipts found matching filter criteria.
          </div>
        ) : (
          filteredImages.map((img) => {
            const lowConfFields = img.fields.filter(f => f.confidence < 0.85);

            return (
              <div
                key={img.id}
                className={`p-4 rounded border transition-all flex flex-col justify-between space-y-4 ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'
                } shadow-xs hover:shadow-md`}
              >
                <div className="space-y-3">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500" />
                      <span className="font-bold font-mono text-xs truncate max-w-[180px]">{img.fileName}</span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                      img.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' :
                      img.status === 'rejected' ? 'bg-rose-500/10 text-rose-600' :
                      'bg-amber-500/10 text-amber-600'
                    }`}>
                      {img.status}
                    </span>
                  </div>

                  {/* Thumbnail / Receipt Preview */}
                  <div className="h-32 rounded bg-slate-950 overflow-hidden flex items-center justify-center p-2 relative group cursor-pointer" onClick={() => onSelectForAnnotation(img)}>
                    <img
                      src={img.fileUrl}
                      alt={img.fileName}
                      className="h-full w-auto object-contain rounded-xs opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-indigo-600 text-white shadow-md flex items-center gap-1">
                        <Edit3 className="w-3.5 h-3.5" /> Annotate
                      </span>
                    </div>
                  </div>

                  {/* Extracted Field Summary */}
                  <div className="space-y-1.5 text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="flex justify-between text-slate-500">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document Type:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{img.receiptType}</span>
                    </div>

                    <div className="flex justify-between text-slate-500">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Fields:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{img.fields.length}</span>
                    </div>

                    {lowConfFields.length > 0 && (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[10px] uppercase tracking-wider">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{lowConfFields.length} fields require verification</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action */}
                <button
                  onClick={() => onSelectForAnnotation(img)}
                  className="w-full py-2 rounded font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Review & Correct Labels</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
