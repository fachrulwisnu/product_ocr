import React, { useState, useEffect, useRef } from 'react';
import { ReceiptImage, ExtractedField } from '../types';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Save, 
  Sparkles,
  Bot,
  Database,
  Tag,
  Crop,
  Loader2,
  AlertCircle,
  BrainCircuit
} from 'lucide-react';
import { extractCroppedRegion, extractFullReceipt, convertVlmJsonToFields } from '../lib/nvidiaVlm';
import { saveVerifiedExtraction, fetchFewShotExamples } from '../lib/supabaseClient';

interface AnnotationWorkspaceProps {
  images: ReceiptImage[];
  selectedImage: ReceiptImage | null;
  setSelectedImage: (img: ReceiptImage) => void;
  onSaveLabels: (imageId: string, fields: ExtractedField[], status: 'approved' | 'needs_review' | 'rejected') => void;
  onTrainTrigger?: () => void;
  isDarkMode: boolean;
}

interface VisualBBox {
  id: string;
  text: string;
  confidence: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const AnnotationWorkspace: React.FC<AnnotationWorkspaceProps> = ({
  images,
  selectedImage,
  setSelectedImage,
  onSaveLabels,
  isDarkMode
}) => {
  const currentImage = selectedImage || images[0];

  // Viewer Controls State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Editable Dynamic Key-Value Pairs State
  const [fieldsState, setFieldsState] = useState<ExtractedField[]>(currentImage ? currentImage.fields : []);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);

  // Persistence & Few-Shot State
  const [isSavingSupabase, setIsSavingSupabase] = useState(false);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fewShotExamples, setFewShotExamples] = useState<Record<string, any>[]>([]);
  const [isReExtractingVlm, setIsReExtractingVlm] = useState(false);

  // Google Lens Drag-to-Crop State
  const [isCroppingVlm, setIsCroppingVlm] = useState(false);
  const [dragRect, setDragRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Dual-Engine Client-Side Visual Bounding Boxes (Tesseract.js)
  const [tesseractBoxes, setTesseractBoxes] = useState<VisualBBox[]>([]);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 1200 });
  const [hoveredFieldValue, setHoveredFieldValue] = useState<string | null>(null);
  const [hoveredFieldKey, setHoveredFieldKey] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Run Tesseract.js in background for client-side visual bounding boxes overlay
  useEffect(() => {
    if (!currentImage?.fileUrl) return;

    let isMounted = true;
    setIsOcrRunning(true);

    const img = new Image();
    img.src = currentImage.fileUrl;
    img.onload = () => {
      if (isMounted) {
        setImageDimensions({ width: img.naturalWidth || 800, height: img.naturalHeight || 1200 });
      }
    };

    import('tesseract.js').then((Tesseract) => {
      Tesseract.recognize(currentImage.fileUrl, 'eng', { logger: () => {} })
        .then(({ data }) => {
          if (!isMounted) return;
          const wordsList = (data as any).words || (data as any).lines || [];
          const boxes: VisualBBox[] = wordsList.map((w: any, idx: number) => ({
            id: `tess-${idx}-${Date.now()}`,
            text: (w.text || '').trim(),
            confidence: Math.round(w.confidence || 0) / 100,
            x0: w.bbox?.x0 || 0,
            y0: w.bbox?.y0 || 0,
            x1: w.bbox?.x1 || 0,
            y1: w.bbox?.y1 || 0
          })).filter((b: VisualBBox) => b.text.length > 0);

          setTesseractBoxes(boxes);
          setIsOcrRunning(false);
        })
        .catch(err => {
          console.warn('Client-side Tesseract OCR failed:', err);
          if (isMounted) setIsOcrRunning(false);
        });
    });

    return () => {
      isMounted = false;
    };
  }, [currentImage?.id, currentImage?.fileUrl]);

  // Sync state & fetch Few-Shot Examples when selected image changes
  useEffect(() => {
    if (selectedImage) {
      setFieldsState(selectedImage.fields);
      setSaveError(null);
      setSaveNotification(null);

      fetchFewShotExamples(selectedImage.projectId, 5)
        .then(examples => {
          setFewShotExamples(examples);
        })
        .catch(err => console.warn('Could not fetch few shot examples:', err));
    }
  }, [selectedImage]);

  if (!currentImage) {
    return (
      <div className="p-12 text-center text-slate-500">
        No receipt images available for annotation. Upload an image to begin.
      </div>
    );
  }

  // Google Lens Drag-to-Select Crop Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      setIsDragging(true);
      setDragStart({ x, y });
      setDragRect({ x, y, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStart || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const x = Math.min(dragStart.x, currentX);
    const y = Math.min(dragStart.y, currentY);
    const width = Math.abs(currentX - dragStart.x);
    const height = Math.abs(currentY - dragStart.y);

    setDragRect({ x, y, width, height });
  };

  const handleMouseUp = async () => {
    if (!isDragging || !dragRect || !imgRef.current) {
      setIsDragging(false);
      return;
    }
    setIsDragging(false);

    // If drag area is larger than 10x10 px, crop and invoke VLM
    if (dragRect.width > 10 && dragRect.height > 10) {
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;

      const sx = dragRect.x * scaleX;
      const sy = dragRect.y * scaleY;
      const sw = dragRect.width * scaleX;
      const sh = dragRect.height * scaleY;

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        const croppedBase64 = canvas.toDataURL('image/png');

        setIsCroppingVlm(true);
        try {
          const extractedCropValue = await extractCroppedRegion(croppedBase64);
          
          // Auto-add new row to Dynamic Field Studio: empty Key, pre-filled Value
          const newCroppedField: ExtractedField = {
            id: `field-crop-${Date.now()}`,
            key: '', // Left side empty key for user to define
            label: 'New Cropped Field',
            value: extractedCropValue || '',
            confidence: 0.99,
            status: 'manual_added',
            category: 'google_lens_crop'
          };

          setFieldsState(prev => [...prev, newCroppedField]);
        } catch (err) {
          console.error('Cropped region extraction failed:', err);
        } finally {
          setIsCroppingVlm(false);
        }
      }
    }

    setDragRect(null);
    setDragStart(null);
  };

  // Handle Field Value Change
  const handleFieldValueChange = (fieldId: string, val: string) => {
    setFieldsState(prev => prev.map(f => f.id === fieldId ? { ...f, value: val, status: 'edited' } : f));
  };

  // Handle Field Key Name Change (Left Side Input)
  const handleFieldKeyChange = (fieldId: string, newKeyName: string) => {
    const formattedKey = newKeyName.toUpperCase().replace(/\s+/g, '_');
    setFieldsState(prev => prev.map(f => f.id === fieldId ? { 
      ...f, 
      key: formattedKey, 
      label: newKeyName, 
      status: 'edited' 
    } : f));
  };

  // Add Custom Key-Value Pair
  const handleAddCustomField = () => {
    if (!newFieldKey.trim()) return;
    const formattedKey = newFieldKey.toUpperCase().trim().replace(/\s+/g, '_');
    const newField: ExtractedField = {
      id: `field-vlm-${Date.now()}`,
      key: formattedKey,
      label: newFieldKey,
      value: newFieldValue || '',
      confidence: 1.0,
      status: 'manual_added',
      category: 'other'
    };
    setFieldsState(prev => [...prev, newField]);
    setNewFieldKey('');
    setNewFieldValue('');
    setShowAddFieldModal(false);
  };

  // Delete Key-Value Pair
  const handleDeleteField = (fieldId: string) => {
    setFieldsState(prev => prev.filter(f => f.id !== fieldId));
  };

  // Re-run VLM with Few-Shot Prompt Injection
  const handleReExtractWithFewShot = async () => {
    if (!currentImage.fileUrl) return;
    setIsReExtractingVlm(true);
    try {
      const extractedJson = await extractFullReceipt(currentImage.fileUrl, fewShotExamples);
      const newFields = convertVlmJsonToFields(extractedJson);
      if (newFields.length > 0) {
        setFieldsState(newFields);
      }
    } catch (err) {
      console.error('Few-Shot Re-extraction failed:', err);
    } finally {
      setIsReExtractingVlm(false);
    }
  };

  // TASK 1 & TASK 2: VERIFY & SAVE with Explicit Try/Catch & Error Toasts (Pessimistic UI)
  const handleApprove = async () => {
    setIsSavingSupabase(true);
    setSaveError(null);
    setSaveNotification(null);

    // 1. Validate project_id and image_id before calling Supabase
    if (!currentImage?.projectId || !currentImage?.id) {
      setSaveError('Invalid Document: project_id or image_id is null or undefined.');
      setIsSavingSupabase(false);
      return;
    }

    // Convert fields state to clean JSON object
    const jsonExtraction: Record<string, any> = {};
    fieldsState.forEach(f => {
      if (f.key && f.key.trim()) {
        jsonExtraction[f.key.trim().toUpperCase()] = f.value;
      }
    });

    try {
      // 2. Call saveVerifiedExtraction which inserts to vlm_results, dynamic_labels, and few_shot_library
      // Throws error if any Supabase insert fails
      await saveVerifiedExtraction(
        currentImage.projectId,
        currentImage.id,
        jsonExtraction
      );

      // 3. ONLY if all Supabase inserts return successfully, update document status & trigger Audit Log
      await onSaveLabels(currentImage.id, fieldsState, 'approved');

      // Toast Success ONLY fires at the end of the try block
      setSaveNotification('Successfully Saved to Supabase & Added to Few-Shot Learning Library!');
      setTimeout(() => setSaveNotification(null), 4000);

      // Move to next image if available
      const nextIdx = images.findIndex(i => i.id === currentImage.id) + 1;
      if (nextIdx < images.length) {
        setSelectedImage(images[nextIdx]);
      }
    } catch (err: any) {
      console.error('Verification & Save Error:', err);
      // Catch block MUST trigger error message and keep status unchanged
      setSaveError(err?.message || 'Failed to persist to Supabase database.');
    } finally {
      setIsSavingSupabase(false);
    }
  };

  // Reject
  const handleReject = () => {
    onSaveLabels(currentImage.id, fieldsState, 'rejected');
  };

  return (
    <div className="space-y-4">
      
      {/* Top Selector & Action Bar */}
      <div className={`p-4 rounded border flex flex-col md:flex-row items-center justify-between gap-4 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {/* Document Switcher */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Document:</span>
          <select
            value={currentImage.id}
            onChange={(e) => {
              const found = images.find(i => i.id === e.target.value);
              if (found) setSelectedImage(found);
            }}
            className="text-xs font-semibold px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 focus:outline-hidden"
          >
            {images.map((img) => (
              <option key={img.id} value={img.id}>
                {img.fileName} ({img.status.toUpperCase()})
              </option>
            ))}
          </select>

          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
            currentImage.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
            currentImage.status === 'rejected' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
            'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
          }`}>
            {currentImage.status}
          </span>

          {fewShotExamples.length > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
              <BrainCircuit className="w-3 h-3 text-indigo-400" /> Few-Shot Active ({fewShotExamples.length} samples)
            </span>
          )}

          {saveNotification && (
            <span className="text-xs font-bold text-emerald-500 animate-pulse flex items-center gap-1">
              <Database className="w-3.5 h-3.5" /> {saveNotification}
            </span>
          )}

          {saveError && (
            <span className="text-xs font-bold text-rose-500 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Error: {saveError}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleReExtractWithFewShot}
            disabled={isReExtractingVlm}
            className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            title="Re-run VLM with Instant Few-Shot Prompt Injection"
          >
            {isReExtractingVlm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
            Few-Shot Re-Run
          </button>

          <button
            onClick={handleReject}
            className="px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            REJECT
          </button>

          <button
            onClick={() => onSaveLabels(currentImage.id, fieldsState, 'needs_review')}
            className="px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </button>

          <button
            onClick={handleApprove}
            disabled={isSavingSupabase}
            className="px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer shadow-md transition-all disabled:opacity-50"
          >
            {isSavingSupabase ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isSavingSupabase ? 'SAVING TO SUPABASE...' : 'VERIFY & SAVE'}
          </button>
        </div>
      </div>

      {/* Main Dual-Pane Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px]">
        
        {/* LEFT PANE: Interactive High-Res Receipt Image Viewer with Google Lens Crop (7 Cols) */}
        <div className={`lg:col-span-7 flex flex-col rounded border overflow-hidden ${
          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-200 border-slate-200'
        }`}>
          
          {/* Canvas Zoom & Google Lens Toolbar */}
          <div className={`h-12 border-b flex items-center justify-between px-4 text-xs ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white/80 backdrop-blur-sm border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.2))}
                title="Zoom In"
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(z => Math.max(0.6, z - 0.2))}
                title="Zoom Out"
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setZoomLevel(1); setRotation(0); }}
                title="Reset Zoom"
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer font-mono font-bold text-[11px]"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                onClick={() => setRotation(r => (r + 90) % 360)}
                title="Rotate Image"
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {isCroppingVlm && (
                <span className="text-[10px] text-indigo-400 font-mono flex items-center gap-1 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> VLM Reading Region Crop...
                </span>
              )}
              <div className="flex items-center gap-1.5 text-indigo-400 font-mono text-[11px] font-bold">
                <Crop className="w-4 h-4 text-indigo-400" />
                <span>Google Lens Crop Selection</span>
              </div>
            </div>
          </div>

          {/* Canvas Image Display with Drag-to-Select Google Lens Crop & Tesseract Bounding Boxes */}
          <div 
            ref={imageContainerRef}
            className="flex-1 overflow-auto p-8 flex items-center justify-center relative select-none bg-slate-300 dark:bg-slate-950 cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <div 
              className="relative transition-transform duration-200 origin-center"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                maxWidth: '480px'
              }}
            >
              <img
                ref={imgRef}
                src={currentImage.fileUrl}
                alt={currentImage.fileName}
                className="w-full h-auto rounded shadow-2xl border border-slate-300 dark:border-slate-700 pointer-events-none select-none"
                draggable={false}
              />

              {/* Client-Side Visual Bounding Boxes (Tesseract.js Dual-Engine) */}
              {tesseractBoxes.map((box) => {
                const leftPct = (box.x0 / imageDimensions.width) * 100;
                const topPct = (box.y0 / imageDimensions.height) * 100;
                const widthPct = Math.max(1, ((box.x1 - box.x0) / imageDimensions.width) * 100);
                const heightPct = Math.max(1, ((box.y1 - box.y0) / imageDimensions.height) * 100);

                const cleanBoxText = box.text.toLowerCase().replace(/[^a-z0-9]/g, '');
                const cleanHoverVal = (hoveredFieldValue || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const cleanHoverKey = (hoveredFieldKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');

                const isMatched = (
                  cleanBoxText.length > 0 && (
                    (cleanHoverVal.length > 0 && (cleanHoverVal.includes(cleanBoxText) || cleanBoxText.includes(cleanHoverVal))) ||
                    (cleanHoverKey.length > 0 && (cleanHoverKey.includes(cleanBoxText) || cleanBoxText.includes(cleanHoverKey)))
                  )
                );

                return (
                  <div
                    key={box.id}
                    className={`absolute transition-all duration-150 pointer-events-auto rounded-xs ${
                      isMatched
                        ? 'border-2 border-emerald-400 bg-emerald-400/30 shadow-lg shadow-emerald-500/50 z-30 ring-2 ring-emerald-400/60 scale-105 animate-pulse'
                        : 'border-2 border-blue-600 bg-blue-600/10 hover:border-blue-400 hover:bg-blue-500/20 z-10'
                    }`}
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`
                    }}
                    title={`Text: ${box.text} (Confidence: ${(box.confidence * 100).toFixed(0)}%)`}
                  >
                    <span
                      className={`absolute -top-4 left-0 text-[8px] font-mono px-1 py-0.2 rounded whitespace-nowrap shadow-xs pointer-events-none ${
                        isMatched
                          ? 'bg-emerald-500 text-white font-extrabold z-40'
                          : 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border border-blue-400 dark:border-blue-600 font-bold'
                      }`}
                    >
                      [{box.text}] {box.confidence.toFixed(2)}
                    </span>
                  </div>
                );
              })}

              {/* Bounding Box Selection Drag Overlay */}
              {dragRect && (
                <div 
                  className="absolute border-2 border-indigo-500 bg-indigo-500/20 rounded-xs pointer-events-none shadow-lg transition-all"
                  style={{
                    left: `${dragRect.x}px`,
                    top: `${dragRect.y}px`,
                    width: `${dragRect.width}px`,
                    height: `${dragRect.height}px`
                  }}
                >
                  <div className="absolute -top-5 left-0 bg-indigo-600 text-white text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
                    <Crop className="w-2.5 h-2.5" /> Crop Region
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-2.5 bg-slate-900 text-slate-400 text-[10px] font-mono flex items-center justify-between border-t border-slate-800 px-4">
            <span className="flex items-center gap-1.5">
              <Crop className="w-3 h-3 text-indigo-400" /> Google Lens Mode: Drag crop box
              {isOcrRunning ? (
                <span className="text-amber-400 flex items-center gap-1 ml-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Scanning Visual Layer...
                </span>
              ) : (
                <span className="text-blue-400 ml-2">
                  • {tesseractBoxes.length} Visual BBoxes Rendered (Tesseract OCR)
                </span>
              )}
            </span>
            <span className="text-indigo-300">Dual-Engine (VLM + Client OCR)</span>
          </div>
        </div>

        {/* RIGHT PANE: Dynamic Field Studio (5 Cols) */}
        <div className={`lg:col-span-5 flex flex-col rounded border overflow-hidden ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          
          {/* Header */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" /> Dynamic Field Studio
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Hover over any field to highlight its bounding box on the left canvas.
              </p>
            </div>

            <button
              onClick={() => setShowAddFieldModal(true)}
              className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Field
            </button>
          </div>

          {/* Fields Editable List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {fieldsState.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs font-mono space-y-2">
                <p>No fields extracted yet.</p>
                <p className="text-[10px] text-indigo-400">Drag a crop rectangle on the receipt to extract with Google Lens!</p>
              </div>
            ) : (
              fieldsState.map((field) => (
                <div
                  key={field.id}
                  onMouseEnter={() => {
                    setHoveredFieldValue(field.value);
                    setHoveredFieldKey(field.key);
                  }}
                  onMouseLeave={() => {
                    setHoveredFieldValue(null);
                    setHoveredFieldKey(null);
                  }}
                  className={`p-3 rounded border space-y-2 transition-all ${
                    hoveredFieldKey === field.key || (hoveredFieldValue === field.value && field.value)
                      ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50'
                      : field.category === 'google_lens_crop' 
                      ? 'border-indigo-500/50 bg-indigo-950/20 dark:bg-indigo-950/40'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300'
                  }`}
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Left Input: Key Name */}
                    <div className="col-span-5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-1">
                        <span>Discovered Key</span>
                        {field.category === 'google_lens_crop' && (
                          <span className="text-[8px] text-indigo-400 font-mono uppercase font-bold">Crop</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={field.key}
                        onChange={(e) => handleFieldKeyChange(field.id, e.target.value)}
                        placeholder="NAME_KEY..."
                        className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 focus:outline-hidden"
                      />
                    </div>

                    {/* Right Input: Extracted Value */}
                    <div className="col-span-6">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Extracted Value
                      </label>
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                        placeholder="Extracted value..."
                        className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-100 focus:outline-hidden"
                      />
                    </div>

                    {/* Delete Action */}
                    <div className="col-span-1 flex items-center justify-center pt-4">
                      <button
                        onClick={() => handleDeleteField(field.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer transition-colors"
                        title="Delete key-value pair"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Action Panel */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors uppercase tracking-wider cursor-pointer"
              >
                REJECT
              </button>
              <button
                onClick={handleApprove}
                disabled={isSavingSupabase}
                className="flex-[2] py-2.5 bg-indigo-600 text-white text-xs font-bold rounded shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-colors uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSavingSupabase ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                VERIFY & SAVE
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Add Custom Field Modal */}
      {showAddFieldModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`p-6 rounded max-w-md w-full space-y-4 border ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="font-bold text-sm uppercase tracking-wider">Define New Key-Value Label</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Key Name (e.g. RECORD_NUMBER)</label>
                <input
                  type="text"
                  placeholder="e.g. SURCHARGE_FEE or CASSETTE_5"
                  value={newFieldKey}
                  onChange={(e) => setNewFieldKey(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Value (e.g. $2.50)</label>
                <input
                  type="text"
                  placeholder="e.g. $2.50"
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddFieldModal(false)}
                className="px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomField}
                className="px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              >
                Add Key-Value
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
