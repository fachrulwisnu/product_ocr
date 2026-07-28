import React, { useState } from 'react';
import { Project, ReceiptType } from '../types';
import { generateReceiptSVG } from '../data/sampleReceipts';
import { compressImageForVlm } from '../utils/imageCompressor';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Sparkles,
  Zap,
  Image as ImageIcon,
  FolderOpen
} from 'lucide-react';

interface UploadViewProps {
  activeProject: Project | null;
  onUploadSuccess: (newReceipt: any) => void;
  isDarkMode: boolean;
}

export const UploadView: React.FC<UploadViewProps> = ({
  activeProject,
  onUploadSuccess,
  isDarkMode
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ReceiptType>('ATM Cash Withdrawal');

  const receiptTypes: ReceiptType[] = [
    'ATM Cash Withdrawal',
    'Balance Inquiry',
    'Cash Deposit',
    'Fund Transfer',
    'Cassette Audit & Cleared'
  ];

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeProject) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage('Invoking NVIDIA Nemotron 30B VLM & Extracting Key-Value Pairs...');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const rawBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Task 3: Compress image to max 1024px JPEG at 0.8 quality
        setStatusMessage(`Compressing & Sending ${file.name} to Nemotron VLM...`);
        const compressedImageData = await compressImageForVlm(rawBase64, 1024, 0.8);

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: activeProject.id,
            fileName: file.name,
            receiptType: selectedType,
            imageData: compressedImageData
          })
        });

        if (response.ok) {
          const data = await response.json();
          onUploadSuccess(data);
        } else {
          const errData = await response.json().catch(() => ({ message: 'VLM API request failed or timed out' }));
          console.error('Upload failed:', errData);
          setErrorMessage(`Extraction Failed: ${errData.message || 'VLM API error'}`);
        }
      } catch (err: any) {
        console.error('Upload failed:', err);
        setErrorMessage(`Upload Error: ${err.message || 'Failed to process file'}`);
      }
    }

    setIsProcessing(false);
    setStatusMessage('');
  };

  const handleSimulatePresetSample = async (presetType: ReceiptType, atmId: string, amount: string, balance: string) => {
    if (!activeProject) return;

    setIsProcessing(true);
    setStatusMessage(`Running NVIDIA NIM OCR for preset ${presetType}...`);

    const imageData = generateReceiptSVG(
      'FIRST NATIONAL BANK',
      presetType,
      atmId,
      amount,
      balance,
      '8',
      '2'
    );

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject.id,
          fileName: `Preset_${presetType.replace(/\s+/g, '_')}_${Date.now().toString().slice(-4)}.png`,
          receiptType: presetType,
          imageData
        })
      });

      if (response.ok) {
        const data = await response.json();
        onUploadSuccess(data);
      }
    } catch (err) {
      console.error('Preset upload error:', err);
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight uppercase">Receipt Ingestion & NVIDIA Nemotron VLM</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Upload thermal ATM receipts (JPG, PNG, PDF). NVIDIA Nemotron 30B VLM extracts dynamic key-value transaction details automatically.
          </p>
        </div>

        {/* Receipt Type Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document Category:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as ReceiptType)}
            className="text-xs font-bold px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden"
          >
            {receiptTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFileUpload(e.dataTransfer.files);
        }}
        className={`relative border-2 border-dashed rounded p-10 text-center transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10'
            : isDarkMode
            ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400'
        }`}
      >
        <input
          type="file"
          accept="image/png, image/jpeg, image/jpg, application/pdf"
          multiple
          onChange={(e) => handleFileUpload(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={isProcessing}
        />

        <div className="space-y-4 max-w-md mx-auto pointer-events-none">
          <div className="w-16 h-16 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 mx-auto flex items-center justify-center">
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <Upload className="w-8 h-8" />
            )}
          </div>

          <div>
            <h3 className="font-bold text-sm uppercase tracking-wide">
              {isProcessing ? 'Processing with NVIDIA NIM OCR API...' : 'Drag & Drop ATM Receipt Images'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports PNG, JPG, JPEG, or scanned PDF documents up to 25MB
            </p>
          </div>

          {errorMessage ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono font-bold uppercase tracking-wider">
              <AlertCircle className="w-4 h-4" />
              {errorMessage}
            </div>
          ) : statusMessage ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 animate-spin" />
              {statusMessage}
            </div>
          ) : (
            <button className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider bg-indigo-600 text-white shadow-md hover:bg-indigo-700 inline-flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Browse Local Files
            </button>
          )}
        </div>
      </div>

      {/* Preset ATM Receipt Quick Sample Ingestor */}
      <div className={`p-5 rounded border ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      } space-y-4`}>
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Pre-Loaded Synthetic ATM Receipts</h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Instant OCR Ingestion</span>
        </div>

        <p className="text-xs text-slate-500">
          Click any preset receipt below to immediately test NVIDIA NIM OCR API bounding box detection and extraction without uploading your own file:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          <button
            onClick={() => handleSimulatePresetSample('ATM Cash Withdrawal', 'ATM-7740-BOS', '$300.00', '$3,210.00')}
            disabled={isProcessing}
            className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-left transition-all cursor-pointer group space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs group-hover:text-indigo-600 uppercase tracking-wider">Withdrawal $300</span>
              <ImageIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500" />
            </div>
            <p className="text-[10px] font-mono text-slate-500">ATM-7740-BOS • Diebold</p>
          </button>

          <button
            onClick={() => handleSimulatePresetSample('Balance Inquiry', 'ATM-1102-MIA', '$0.00', '$12,450.00')}
            disabled={isProcessing}
            className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-left transition-all cursor-pointer group space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs group-hover:text-indigo-600 uppercase tracking-wider">Balance Inquiry</span>
              <ImageIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500" />
            </div>
            <p className="text-[10px] font-mono text-slate-500">ATM-1102-MIA • NCR</p>
          </button>

          <button
            onClick={() => handleSimulatePresetSample('Cash Deposit', 'ATM-5510-DAL', '$500.00', '$8,920.00')}
            disabled={isProcessing}
            className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-left transition-all cursor-pointer group space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs group-hover:text-indigo-600 uppercase tracking-wider">Deposit $500</span>
              <ImageIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500" />
            </div>
            <p className="text-[10px] font-mono text-slate-500">ATM-5510-DAL • Wincor</p>
          </button>

          <button
            onClick={() => handleSimulatePresetSample('Cassette Audit & Cleared', 'ATM-9900-SEA', '$0.00', '$0.00')}
            disabled={isProcessing}
            className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-left transition-all cursor-pointer group space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs group-hover:text-indigo-600 uppercase tracking-wider">Cassette Audit</span>
              <ImageIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500" />
            </div>
            <p className="text-[10px] font-mono text-slate-500">ATM-9900-SEA • Hyosung</p>
          </button>

        </div>
      </div>

    </div>
  );
};
