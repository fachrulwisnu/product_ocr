import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { Project, ReceiptType } from '../types';
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
  FolderOpen,
  Cpu,
  Trash2,
  Eye,
  X,
  Maximize2,
  HardDrive
} from 'lucide-react';

interface UploadedImageItem {
  id: string;
  project_id: string;
  original_file_name: string;
  storage_path: string;
  public_url: string;
  file_size_bytes: number;
  mime_type: string;
  width: number;
  height: number;
  status: string;
  created_at: string;
}

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadProgressPercentage, setUploadProgressPercentage] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('nvidia/nemotron-3-ultra-550b-a55b');
  
  // Phase 2 Image Gallery & Modal Preview states
  const [galleryImages, setGalleryImages] = useState<UploadedImageItem[]>([]);
  const [previewImage, setPreviewImage] = useState<UploadedImageItem | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Fetch images for active project from /api/v1/images/project/:projectId
  const fetchProjectImages = useCallback(async () => {
    if (!activeProject) return;
    try {
      const res = await axios.get(`/api/v1/images/project/${activeProject.id}`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        setGalleryImages(res.data.data);
      }
    } catch (err) {
      console.warn('Could not fetch project images gallery:', err);
    }
  }, [activeProject]);

  useEffect(() => {
    fetchProjectImages();
  }, [fetchProjectImages]);

  // Phase 1 loading progress simulation effect
  useEffect(() => {
    if (!isProcessing) {
      setProgress(0);
      setStatusMessage('');
      setUploadProgressPercentage(null);
      return;
    }

    if (uploadProgressPercentage === null) {
      setProgress(20);
      setStatusMessage("Compressing & optimizing image payload with Sharp...");

      const t1 = setTimeout(() => {
        setProgress(40);
        setStatusMessage("Uploading to Supabase receipt-images bucket & NVIDIA VLM...");
      }, 1000);

      const t2 = setTimeout(() => {
        setProgress(70);
        setStatusMessage("Running text extraction & applying Golden Templates...");
      }, 2500);

      const t3 = setTimeout(() => {
        setProgress(90);
        setStatusMessage("Synthesizing Instant Learning context from Dataset Manager...");
      }, 4500);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [isProcessing, uploadProgressPercentage]);

  // Handle file upload with Axios onUploadProgress & Express Sharp Pipeline
  const handleFileUpload = async (files: File[]) => {
    if (!files || files.length === 0 || !activeProject) return;

    if (!selectedType) {
      setErrorMessage('Please select a Document Category before uploading.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // 1. Send file via FormData to /api/v1/images/upload with real-time Axios progress
        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_id', activeProject.id);

        const uploadRes = await axios.post('/api/v1/images/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgressPercentage(percent);
              setProgress(percent);
              setStatusMessage(`Uploading file to Supabase receipt-images (${percent}%)...`);
            }
          }
        });

        const uploadedItem = uploadRes.data?.data;
        if (uploadedItem) {
          setGalleryImages(prev => [uploadedItem, ...prev]);
        }

        // 2. Perform AI Extraction via /api/upload
        const rawBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const compressedImageData = await compressImageForVlm(rawBase64, 1024, 0.8);

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: activeProject.id,
            fileName: file.name,
            receiptType: selectedType,
            imageData: compressedImageData,
            modelId: selectedModel
          })
        });

        if (response.ok) {
          const data = await response.json();
          setProgress(100);
          setStatusMessage("Finalizing structured JSON output...");
          await new Promise(r => setTimeout(r, 400));
          onUploadSuccess(data);
        } else {
          const errData = await response.json().catch(() => ({ message: 'VLM API request failed' }));
          setErrorMessage(`Extraction Notice: ${errData.message || 'Image uploaded but OCR pending'}`);
        }
      } catch (err: any) {
        console.error('Upload failed:', err);
        setErrorMessage(`Upload Error: ${err.message || 'Failed to upload image'}`);
      }
    }

    setIsProcessing(false);
    setProgress(0);
    setStatusMessage('');
    setUploadProgressPercentage(null);
    fetchProjectImages();
  };

  // react-dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    handleFileUpload(acceptedFiles);
  }, [activeProject, selectedType, selectedModel]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf']
    },
    disabled: !selectedType || isProcessing
  } as any);

  // Delete image from Supabase storage & database
  const handleDeleteImage = async (imageId: string) => {
    setIsDeletingId(imageId);
    try {
      await axios.delete(`/api/v1/images/${imageId}`);
      setGalleryImages(prev => prev.filter(item => item.id !== imageId));
      if (previewImage?.id === imageId) {
        setPreviewImage(null);
      }
    } catch (err) {
      console.error('Failed to delete image:', err);
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight uppercase">Receipt Ingestion & Storage Pipeline</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Phase 2 Image Pipeline: Sharp image compression, Supabase receipt-images bucket storage, and metadata tracking in images_ocr.
          </p>
        </div>
      </div>

      {/* AI Model & Document Category Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
            <span>Select AI Extraction Model</span>
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-xs font-bold px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="gemini-1.5-flash">
              Gemini 1.5 Flash - Fast, Cost-Effective Multimodal
            </option>
            <option value="gemini-1.5-pro">
              Gemini 1.5 Pro - High Reasoning & Complex Documents
            </option>
            <option value="nvidia/nemotron-3-ultra-550b-a55b">
              Nemotron 3 Ultra 550B - Advanced Reasoning & Invoices
            </option>
            <option value="meta/llama-3.2-90b-vision-instruct">
              Llama 3.2 90B Vision - High Accuracy
            </option>
            <option value="nvidia/nemotron-nano-ocr-v2">
              Nemotron Nano OCR v2 - Ultra Fast (Bounding Boxes)
            </option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-500" />
            <span>Select Document Category *</span>
          </label>
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setErrorMessage(null);
            }}
            className={`text-xs font-bold px-3 py-2 rounded border focus:outline-none focus:ring-1 cursor-pointer ${
              !selectedType 
                ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400' 
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
            }`}
          >
            <option value="">-- Select Bank or Document Category --</option>
            <option value="ATM Cash Withdrawal">ATM Cash Withdrawal</option>
            <option value="Balance Inquiry">Balance Inquiry</option>
            <option value="Cash Deposit">Cash Deposit</option>
            <option value="Cassette Audit & Cleared">Cassette Audit & Cleared</option>
            <option value="Fund Transfer">Fund Transfer</option>
            <option value="Commercial Invoice">Commercial Invoice</option>
          </select>
        </div>
      </div>

      {/* Dropzone Upload Section using react-dropzone & Axios Progress */}
      <div 
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-500/10 scale-[0.99]'
            : !selectedType
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-slate-300 dark:border-slate-800 hover:border-indigo-500/50 bg-slate-50/50 dark:bg-slate-900/50'
        }`}
      >
        <input {...getInputProps()} />

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-4 text-center pointer-events-none">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            
            <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-1">
              PROCESSING & COMPRESSING IMAGE PIPELINE...
            </h3>
            <p className="text-slate-500 dark:text-gray-400 text-sm mb-4">
              Sharp compression active • Supabase receipt-images bucket storage
            </p>

            {/* Live Progress Bar Container */}
            <div className="w-full max-w-md bg-slate-200 dark:bg-gray-800 rounded-full h-3 mb-3 overflow-hidden border border-slate-300 dark:border-gray-700">
              <div 
                className="bg-blue-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            {/* Live Status Log Badge */}
            <div className="inline-flex items-center px-4 py-2 bg-blue-950/80 border border-blue-500/30 rounded-lg text-blue-300 text-xs font-mono shadow-inner">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse mr-2"></span>
              {statusMessage || 'Processing...'} ({progress}%)
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-md mx-auto pointer-events-none">
            <div className={`w-16 h-16 rounded-xl border mx-auto flex items-center justify-center transition-colors ${
              !selectedType
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500'
            }`}>
              {!selectedType ? (
                <AlertCircle className="w-8 h-8 text-amber-500" />
              ) : (
                <Upload className="w-8 h-8" />
              )}
            </div>

            <div>
              <h3 className={`font-bold text-sm uppercase tracking-wide ${
                !selectedType ? 'text-amber-600 dark:text-amber-400 font-extrabold' : ''
              }`}>
                {!selectedType 
                  ? '⚠️ PLEASE SELECT A DOCUMENT CATEGORY FIRST' 
                  : isDragActive
                  ? 'Drop Receipt Image Here Now'
                  : `Drag & Drop ${selectedType} Images`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {!selectedType
                  ? 'Select a category above to enable react-dropzone ingestion'
                  : 'Supports PNG, JPG, JPEG, or scanned PDF documents up to 25MB'}
              </p>
            </div>

            {errorMessage ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono font-bold uppercase tracking-wider">
                <AlertCircle className="w-4 h-4" />
                {errorMessage}
              </div>
            ) : (
              <button
                disabled={!selectedType}
                type="button"
                className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider shadow-md inline-flex items-center gap-2 transition-all ${
                  !selectedType
                    ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer pointer-events-auto'
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                {!selectedType ? '⚠️ Select Category First' : 'Browse Local Files'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Phase 2: Uploaded Image Grid Gallery */}
      {galleryImages.length > 0 && (
        <div className={`p-5 rounded-xl border ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        } space-y-4`}>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Uploaded Receipt Gallery (<code className="text-indigo-400 font-mono">images_ocr</code>)
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {galleryImages.length} Saved Items
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {galleryImages.map((img) => (
              <div 
                key={img.id}
                className="group relative rounded-lg border border-slate-800 bg-slate-950 overflow-hidden shadow-sm hover:border-indigo-500/60 transition-all flex flex-col"
              >
                <div className="relative aspect-3/4 bg-slate-900 overflow-hidden flex items-center justify-center">
                  {img.public_url ? (
                    <img 
                      src={img.public_url} 
                      alt={img.original_file_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-600" />
                  )}

                  {/* Overlay buttons */}
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPreviewImage(img)}
                      className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 transition-colors cursor-pointer"
                      title="Preview Receipt"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteImage(img.id)}
                      disabled={isDeletingId === img.id}
                      className="p-2 rounded-full bg-rose-600 text-white hover:bg-rose-500 transition-colors cursor-pointer"
                      title="Delete Receipt"
                    >
                      {isDeletingId === img.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-slate-900/80 text-emerald-400 border border-emerald-500/30">
                    {img.status || 'COMPRESSED'}
                  </span>
                </div>

                <div className="p-2.5 space-y-1">
                  <div className="text-xs font-bold text-slate-200 truncate" title={img.original_file_name}>
                    {img.original_file_name}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>{(img.file_size_bytes / 1024).toFixed(1)} KB</span>
                    <span>{img.width}x{img.height}px</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* Full Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm uppercase text-white truncate max-w-md">
                  {previewImage.original_file_name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 bg-slate-950 rounded-lg p-2 border border-slate-800 flex items-center justify-center overflow-auto">
              {previewImage.public_url ? (
                <img 
                  src={previewImage.public_url} 
                  alt={previewImage.original_file_name}
                  className="max-h-[50vh] object-contain rounded"
                />
              ) : (
                <p className="text-xs text-slate-500">No preview URL available</p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono p-3 bg-slate-950 rounded border border-slate-800 text-slate-300">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Storage Bucket</span>
                <span className="font-bold text-indigo-400">receipt-images</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">File Size</span>
                <span className="font-bold">{(previewImage.file_size_bytes / 1024).toFixed(1)} KB</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Resolution</span>
                <span className="font-bold">{previewImage.width} x {previewImage.height} px</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Status</span>
                <span className="font-bold text-emerald-400">{previewImage.status}</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
