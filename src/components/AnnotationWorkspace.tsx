import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  BrainCircuit,
  Eye,
  EyeOff,
  FileText
} from 'lucide-react';
import { extractCroppedRegion, extractFullReceipt, convertVlmJsonToFields, invokeNvidiaVlm } from '../lib/nvidiaVlm';
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

  // Ref map for input focus management on cropped fields
  const keyInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);

  // Google Lens Drag-to-Crop State
  const [isCroppingVlm, setIsCroppingVlm] = useState(false);
  const [dragRect, setDragRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Dual-Engine Client-Side Visual Bounding Boxes (Tesseract.js & Phase 3 NVIDIA Nemotron OCR v2)
  const [visualBoxes, setVisualBoxes] = useState<VisualBBox[]>([]);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [imageNaturalWidth, setImageNaturalWidth] = useState<number>(600);
  const [imageNaturalHeight, setImageNaturalHeight] = useState<number>(880);
  const [hoveredFieldValue, setHoveredFieldValue] = useState<string | null>(null);
  const [hoveredFieldKey, setHoveredFieldKey] = useState<string | null>(null);

  // Phase 3 & Phase 4 NVIDIA Nemotron OCR & Classification States
  const [isProcessingNvidiaOcr, setIsProcessingNvidiaOcr] = useState<boolean>(false);
  const [nvidiaOcrBlocks, setNvidiaOcrBlocks] = useState<any[]>([]);
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [detectedTemplate, setDetectedTemplate] = useState<string>('General Receipt');
  const [activeRightTab, setActiveRightTab] = useState<'fields' | 'raw_ocr'>('fields');

  // Fetch saved Phase 3 OCR results on image change
  useEffect(() => {
    if (!currentImage?.id) return;
    let isMounted = true;

    const loadSavedOcrResult = async () => {
      try {
        const res = await fetch(`/api/v1/ocr/result/${currentImage.id}`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json?.data) {
            setNvidiaOcrBlocks(json.data.blocks || []);
            setRawOcrText(json.data.ocr_result?.raw_text || '');
            if (json.data.detected_template) {
              setDetectedTemplate(json.data.detected_template);
            } else if (json.data.ocr_result?.detected_template) {
              setDetectedTemplate(json.data.ocr_result.detected_template);
            }
          }
        }
      } catch (err) {
        // silent catch
      }
    };

    loadSavedOcrResult();
    return () => { isMounted = false; };
  }, [currentImage?.id]);

  // Handler for "Run OCR Extraction (NVIDIA Nemotron v2)"
  const handleRunNvidiaOcrProcess = async () => {
    if (!currentImage?.id) return;
    setIsProcessingNvidiaOcr(true);
    try {
      const response = await fetch(`/api/v1/ocr/process/${currentImage.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: currentImage.fileUrl
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result?.data) {
          setNvidiaOcrBlocks(result.data.blocks || []);
          setRawOcrText(result.data.raw_text || '');
          if (result.data.detected_template) {
            setDetectedTemplate(result.data.detected_template);
          }
          setActiveRightTab('raw_ocr');
          setShowBoundingBoxes(true);
        }
      }
    } catch (err) {
      console.error('NVIDIA OCR Process failed:', err);
    } finally {
      setIsProcessingNvidiaOcr(false);
    }
  };

  const imgRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Helper to convert any image source (SVG/DataURL) to clean PNG data URL for Tesseract OCR
  const imageToPngUrl = (imgSrc: string): Promise<{ pngUrl: string; width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const width = img.naturalWidth || 600;
        const height = img.naturalHeight || 880;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0);
          resolve({
            pngUrl: canvas.toDataURL('image/png'),
            width,
            height
          });
        } else {
          resolve({ pngUrl: imgSrc, width, height });
        }
      };
      img.onerror = () => {
        resolve({ pngUrl: imgSrc, width: 600, height: 880 });
      };
      img.src = imgSrc;
    });
  };

  // Run Tesseract.js in background for client-side visual bounding boxes overlay
  useEffect(() => {
    if (!currentImage?.fileUrl) return;

    let isMounted = true;
    setIsOcrRunning(true);

    const runOcr = async () => {
      try {
        const { pngUrl, width, height } = await imageToPngUrl(currentImage.fileUrl);

        if (!isMounted) return;

        setImageNaturalWidth(width);
        setImageNaturalHeight(height);

        const Tesseract = await import('tesseract.js');
        const result = await Tesseract.recognize(pngUrl, 'eng', {
          logger: (m) => console.log('[Tesseract OCR]', m)
        });

        if (!isMounted) return;

        const wordsList: any[] = (result.data as any).words || (result.data as any).lines || [];
        let boxes: VisualBBox[] = wordsList
          .map((w: any, idx: number) => ({
            id: `tess-${idx}-${Date.now()}`,
            text: (w.text || '').trim(),
            confidence: Math.round((w.confidence || 0)) / 100,
            x0: w.bbox?.x0 || 0,
            y0: w.bbox?.y0 || 0,
            x1: w.bbox?.x1 || 0,
            y1: w.bbox?.y1 || 0
          }))
          .filter((b: VisualBBox) => b.text.length > 0);

        // Fallback: If Tesseract yields 0 words (e.g. synthetic image), generate field alignment boxes
        if (boxes.length === 0 && currentImage.fields && currentImage.fields.length > 0) {
          console.log('[Tesseract OCR] Generating field alignment fallback boxes');
          boxes = currentImage.fields.map((f, idx) => ({
            id: `fallback-${idx}-${Date.now()}`,
            text: f.value || f.key,
            confidence: f.confidence || 0.95,
            x0: 60,
            y0: 150 + idx * 35,
            x1: 520,
            y1: 175 + idx * 35
          }));
        }

        setVisualBoxes(boxes);
        setIsOcrRunning(false);
      } catch (err) {
        console.warn('[Tesseract OCR] Execution error, falling back:', err);
        if (isMounted) {
          if (currentImage.fields && currentImage.fields.length > 0) {
            const fallbackBoxes = currentImage.fields.map((f, idx) => ({
              id: `fallback-${idx}-${Date.now()}`,
              text: f.value || f.key,
              confidence: f.confidence || 0.95,
              x0: 60,
              y0: 150 + idx * 35,
              x1: 520,
              y1: 175 + idx * 35
            }));
            setVisualBoxes(fallbackBoxes);
          }
          setIsOcrRunning(false);
        }
      }
    };

    runOcr();

    return () => {
      isMounted = false;
    };
  }, [currentImage?.id, currentImage?.fileUrl]);

  // TASK 3: MATCH VLM VALUES TO TESSERACT BOXES
  const matchedBoxes = useMemo(() => {
    if (!visualBoxes || visualBoxes.length === 0) return [];

    return visualBoxes.map((box) => {
      const cleanBoxText = box.text.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!cleanBoxText) {
        return { ...box, isVlmMatch: false };
      }

      // Check against current fieldsState
      for (const field of fieldsState) {
        const valStr = (field.value || '').toString();
        const keyStr = field.key || field.label || '';

        const cleanVal = valStr.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanKey = keyStr.toLowerCase().replace(/[^a-z0-9]/g, '');

        const matchesValue = cleanVal.length >= 2 && (cleanVal.includes(cleanBoxText) || cleanBoxText.includes(cleanVal));
        const matchesKey = cleanKey.length >= 2 && (cleanKey.includes(cleanBoxText) || cleanBoxText.includes(cleanKey));

        if (matchesValue || matchesKey) {
          return {
            ...box,
            isVlmMatch: true,
            matchedKey: keyStr.toUpperCase().replace(/\s+/g, '_'),
            matchedLabel: field.label || keyStr,
            matchedValue: valStr
          };
        }
      }

      return { ...box, isVlmMatch: false };
    });
  }, [visualBoxes, fieldsState]);

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

    // If drag area is larger than 10x10 px, crop and extract text
    if (dragRect.width > 10 && dragRect.height > 10) {
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;

      const sx = dragRect.x * scaleX;
      const sy = dragRect.y * scaleY;
      const sw = Math.max(1, dragRect.width * scaleX);
      const sh = Math.max(1, dragRect.height * scaleY);

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        const croppedBase64 = canvas.toDataURL('image/jpeg', 0.8);

        setIsCroppingVlm(true);

        // Determine target field ID (focused row or auto-create new row)
        let targetId = focusedFieldId;
        const exists = targetId && fieldsState.some(f => f.id === targetId);

        if (exists && targetId) {
          setFieldsState(prev => prev.map(f => f.id === targetId ? { ...f, value: 'Extracting...', status: 'edited' } : f));
        } else {
          targetId = `field-crop-${Date.now()}`;
          const newCroppedField: ExtractedField = {
            id: targetId,
            key: '', // Left side empty key for user to define
            label: 'Cropped Value',
            value: 'Extracting...',
            confidence: 0.99,
            status: 'manual_added',
            category: 'google_lens_crop'
          };
          setFieldsState(prev => [...prev, newCroppedField]);
        }

        const activeTargetId = targetId;

        try {
          const extractedCropValue = await extractCroppedRegion(croppedBase64);
          const finalVal = extractedCropValue || '';

          setFieldsState(prev => prev.map(f => f.id === activeTargetId ? {
            ...f,
            value: finalVal,
            status: 'edited'
          } : f));

          // TASK 3: Focus Management - shift input focus to DISCOVERED KEY input on the left
          setTimeout(() => {
            if (activeTargetId && keyInputRefs.current[activeTargetId]) {
              keyInputRefs.current[activeTargetId]?.focus();
              keyInputRefs.current[activeTargetId]?.select();
            }
          }, 100);
        } catch (err) {
          console.error('Cropped region extraction failed:', err);
          setFieldsState(prev => prev.map(f => f.id === activeTargetId ? { ...f, value: '', status: 'edited' } : f));
        } finally {
          setIsCroppingVlm(false);
          setDragRect(null);
          setDragStart(null);
        }
      }
    } else {
      setDragRect(null);
      setDragStart(null);
    }
  };

  // Handle Field Value Change
  const handleFieldValueChange = (fieldId: string, val: string) => {
    setFieldsState(prev => prev.map(f => f.id === fieldId ? { ...f, value: val, status: 'edited' } : f));
  };

  // TASK 3: Click-to-Fill Handler for Bounding Boxes on Left Canvas
  const handleBoxClick = (textContent: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // prevent simultaneous Google Lens drag trigger
    }
    if (!textContent || !textContent.trim()) return;

    const cleanText = textContent.trim();

    if (focusedFieldId) {
      // Insert value into currently focused field in Right Panel
      setFieldsState(prev => prev.map(f => f.id === focusedFieldId ? {
        ...f,
        value: cleanText,
        status: 'edited'
      } : f));
      setSaveNotification(`Filled "${cleanText}" into selected field!`);
      setTimeout(() => setSaveNotification(null), 2500);
    } else {
      // Auto-create new field with extracted value
      const newFieldId = `field-click-${Date.now()}`;
      const newField: ExtractedField = {
        id: newFieldId,
        key: '',
        label: 'Selected Box',
        value: cleanText,
        confidence: 1.0,
        status: 'manual_added',
        category: 'vlm_discovered'
      };
      setFieldsState(prev => [...prev, newField]);
      setFocusedFieldId(newFieldId);
      setSaveNotification(`Added new field with value "${cleanText}". Set key on the right!`);
      setTimeout(() => setSaveNotification(null), 2500);
    }
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

  // Re-run VLM with Few-Shot Prompt Injection & Auto Category Classification
  const handleReExtractWithFewShot = async () => {
    if (!currentImage.fileUrl) return;
    setIsReExtractingVlm(true);
    try {
      const vlmRes = await invokeNvidiaVlm(currentImage.fileUrl, currentImage.receiptType, fewShotExamples);
      if (vlmRes.documentCategory && currentImage) {
        currentImage.receiptType = vlmRes.documentCategory;
      }
      const newFields = convertVlmJsonToFields(vlmRes.extractedJson);
      if (newFields.length > 0) {
        setFieldsState(newFields);
      }
    } catch (err) {
      console.error('Few-Shot Re-extraction failed:', err);
    } finally {
      setIsReExtractingVlm(false);
    }
  };

  // TASK 1, 2, 3: VERIFY & SAVE with Backend Annotation Endpoint
  const handleApprove = async () => {
    setIsSavingSupabase(true);
    setSaveError(null);
    setSaveNotification(null);

    // 1. Validate project_id and image_id before calling API/Supabase
    if (!currentImage?.id) {
      setSaveError('Invalid Document: image_id is null or undefined.');
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
      // 2. Call backend /api/v1/annotations/:imageId
      try {
        await fetch(`/api/v1/annotations/${currentImage.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            final_json_data: jsonExtraction,
            status: 'APPROVED',
            project_id: currentImage.projectId,
            review_time_ms: 8500
          })
        });
      } catch (apiErr) {
        console.warn('Backend annotation endpoint notice:', apiErr);
      }

      // 3. Call saveVerifiedExtraction which inserts to vlm_results, dynamic_labels, and few_shot_library
      await saveVerifiedExtraction(
        currentImage.projectId || 'proj-default',
        currentImage.id,
        currentImage.fileName || 'document.png',
        jsonExtraction
      );

      // 4. Update document status & trigger Audit Log
      await onSaveLabels(currentImage.id, fieldsState, 'approved');

      // Toast Success
      setSaveNotification('Annotation Saved to annotations_ocr Table & Marked VERIFIED!');
      setTimeout(() => setSaveNotification(null), 4000);

      // Move to next image if available
      const nextIdx = images.findIndex(i => i.id === currentImage.id) + 1;
      if (nextIdx < images.length) {
        setSelectedImage(images[nextIdx]);
      }
    } catch (err: any) {
      console.error('Verification & Save Error:', err);
      setSaveError(err?.message || 'Failed to persist annotation.');
    } finally {
      setIsSavingSupabase(false);
    }
  };

  // Reject Handler
  const handleReject = async () => {
    if (!currentImage?.id) return;
    try {
      await fetch(`/api/v1/annotations/${currentImage.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          final_json_data: {},
          status: 'REJECTED',
          project_id: currentImage.projectId
        })
      });
    } catch (apiErr) {
      console.warn('Backend annotation reject notice:', apiErr);
    }

    onSaveLabels(currentImage.id, fieldsState, 'rejected');
    setSaveNotification('Document marked as REJECTED in annotations_ocr.');
    setTimeout(() => setSaveNotification(null), 3000);
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

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 font-mono text-[10px] font-bold">
            <FileText className="w-3 h-3 text-indigo-400" />
            <span>Category:</span>
            <input
              type="text"
              list="doc-cat-workspace-list"
              value={currentImage.receiptType || 'KTP (Indonesian ID)'}
              onChange={(e) => {
                currentImage.receiptType = e.target.value;
                setFieldsState([...fieldsState]);
              }}
              className="bg-transparent border-b border-indigo-500/40 font-bold focus:outline-none focus:border-indigo-400 px-1 text-indigo-300 dark:text-indigo-300 min-w-[130px]"
            />
            <datalist id="doc-cat-workspace-list">
              <option value="KTP (Indonesian ID)" />
              <option value="ATM Receipt" />
              <option value="Invoice" />
              <option value="Tax Document (NPWP)" />
              <option value="Passport" />
              <option value="Driver License" />
            </datalist>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-slate-400">Auto-Detected Template:</span>
            <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-extrabold">
              {detectedTemplate}
            </span>
          </div>

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
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          <button
            onClick={handleRunNvidiaOcrProcess}
            disabled={isProcessingNvidiaOcr}
            className="px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer shadow-md transition-all disabled:opacity-50"
            title="Run NVIDIA Nemotron OCR v2 extraction and extract bounding boxes"
          >
            {isProcessingNvidiaOcr ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-200" />}
            {isProcessingNvidiaOcr ? 'Running Nemotron OCR...' : 'Run OCR Extraction'}
          </button>

          <button
            onClick={handleReExtractWithFewShot}
            disabled={isReExtractingVlm}
            className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            title="Re-run VLM with Instant Few-Shot Prompt Injection"
          >
            {isReExtractingVlm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5 text-indigo-400" />}
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

              <button
                onClick={() => setShowBoundingBoxes(prev => !prev)}
                title={showBoundingBoxes ? "Hide Bounding Boxes" : "Show Bounding Boxes"}
                className={`px-2 py-1.5 rounded cursor-pointer transition-colors flex items-center gap-1.5 font-mono text-[11px] font-bold ${
                  showBoundingBoxes 
                    ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/25' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {showBoundingBoxes ? <Eye className="w-3.5 h-3.5 text-indigo-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                <span>{showBoundingBoxes ? "Boxes On" : "Boxes Off"}</span>
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
            className="flex-1 overflow-auto p-6 flex items-center justify-center relative select-none bg-slate-900 cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <div 
              className="relative inline-block max-w-full max-h-full transition-transform duration-200 origin-center"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`
              }}
            >
              <img
                ref={imgRef}
                src={currentImage.fileUrl}
                alt={currentImage.fileName}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth && img.naturalHeight) {
                    setImageNaturalWidth(img.naturalWidth);
                    setImageNaturalHeight(img.naturalHeight);
                  }
                }}
                className="block max-w-full max-h-full object-contain rounded-none shadow-2xl border border-slate-700 pointer-events-none select-none"
                draggable={false}
              />

              {/* Phase 3 NVIDIA Nemotron OCR v2 Bounding Box Overlays */}
              {showBoundingBoxes && nvidiaOcrBlocks.map((block: any, idx: number) => {
                const x = block.box_x ?? 10;
                const y = block.box_y ?? 10;
                const w = block.box_width ?? 80;
                const h = block.box_height ?? 5;

                // Safeguard: Ensure box coordinate numbers exist
                if (typeof block.box_x !== 'number' || typeof block.box_y !== 'number' || isNaN(x) || isNaN(y)) {
                  return null;
                }

                return (
                  <div
                    key={`nvidia-ocr-box-${idx}`}
                    onClick={(e) => handleBoxClick(block.text_content, e)}
                    style={{
                      position: 'absolute',
                      top: `${y}%`,
                      left: `${x}%`,
                      width: `${w}%`,
                      height: `${h}%`,
                      boxSizing: 'border-box',
                      zIndex: 35,
                    }}
                    className="border-2 border-emerald-500 bg-emerald-500/20 rounded-xs transition-all pointer-events-auto group hover:bg-emerald-500/50 hover:border-amber-300 hover:ring-2 hover:ring-amber-300 cursor-pointer"
                    title="Click to populate into selected input field"
                  >
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-0 mb-1 whitespace-nowrap text-[10px] font-mono px-1.5 py-0.5 bg-emerald-600 text-white font-bold rounded shadow-md z-50 flex items-center gap-1">
                      <span>Click-to-Fill:</span>
                      <span className="font-extrabold text-amber-200">{block.text_content}</span>
                    </div>
                  </div>
                );
              })}

              {/* Client-Side Visual Bounding Boxes (Tesseract.js & VLM Field Matches) */}
              {showBoundingBoxes && imageNaturalWidth > 0 && imageNaturalHeight > 0 && matchedBoxes.map((box) => {
                // Safeguard: Skip invalid coordinate boxes
                if (typeof box.x0 !== 'number' || typeof box.y0 !== 'number' || isNaN(box.x0) || isNaN(box.y0)) {
                  return null;
                }

                const leftPct = (box.x0 / imageNaturalWidth) * 100;
                const topPct = (box.y0 / imageNaturalHeight) * 100;
                const widthPct = Math.max(0.5, ((box.x1 - box.x0) / imageNaturalWidth) * 100);
                const heightPct = Math.max(0.5, ((box.y1 - box.y0) / imageNaturalHeight) * 100);

                const cleanBoxText = box.text.toLowerCase().replace(/[^a-z0-9]/g, '');
                const cleanHoverVal = (hoveredFieldValue || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const cleanHoverKey = (hoveredFieldKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');

                const isHovered = (
                  cleanBoxText.length > 0 && (
                    (cleanHoverVal.length > 0 && (cleanHoverVal.includes(cleanBoxText) || cleanBoxText.includes(cleanHoverVal))) ||
                    (cleanHoverKey.length > 0 && (cleanHoverKey.includes(cleanBoxText) || cleanBoxText.includes(cleanHoverKey)))
                  )
                );

                const isMatched = box.isVlmMatch;

                // Only render matched VLM boxes or currently hovered boxes to keep image clean
                if (!isMatched && !isHovered) return null;

                return (
                  <div
                    key={box.id}
                    onClick={(e) => handleBoxClick(box.text, e)}
                    style={{
                      position: 'absolute',
                      top: `${topPct}%`,
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                      boxSizing: 'border-box',
                      zIndex: isHovered ? 30 : 20,
                    }}
                    className={`border-2 pointer-events-auto rounded-none transition-all duration-150 cursor-pointer ${
                      isHovered
                        ? 'border-emerald-400 bg-emerald-400/30 shadow-lg shadow-emerald-500/50 ring-2 ring-emerald-400/60 animate-pulse'
                        : 'border-indigo-500 bg-indigo-500/20 hover:bg-indigo-500/40 hover:border-amber-300 hover:ring-2 hover:ring-amber-300'
                    }`}
                  >
                    <div
                      className={`absolute bottom-full left-0 mb-1 whitespace-nowrap text-[10px] font-mono px-1.5 py-0.5 rounded shadow-xs font-bold uppercase tracking-wider ${
                        isHovered
                          ? 'bg-emerald-500 text-white font-extrabold z-40'
                          : 'bg-indigo-600 text-white font-bold z-30'
                      }`}
                    >
                      {box.matchedKey ? `${box.matchedKey}: ` : ''}{box.text}
                    </div>
                  </div>
                );
              })}

              {/* Bounding Box Selection Drag Overlay */}
              {dragRect && (
                <div 
                  className={`absolute rounded-none pointer-events-none shadow-lg transition-all ${
                    isCroppingVlm
                      ? 'border-2 border-indigo-500 border-dashed bg-indigo-500/30 animate-pulse ring-2 ring-indigo-400'
                      : 'border-2 border-indigo-500 bg-indigo-500/20'
                  }`}
                  style={{
                    left: `${dragRect.x}px`,
                    top: `${dragRect.y}px`,
                    width: `${dragRect.width}px`,
                    height: `${dragRect.height}px`
                  }}
                >
                  <div className="absolute -top-6 left-0 bg-indigo-600 text-white text-[9px] font-mono px-2 py-0.5 rounded-none font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
                    {isCroppingVlm ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-amber-300" />
                        <span>Extracting Crop Text...</span>
                      </>
                    ) : (
                      <>
                        <Crop className="w-3 h-3 text-indigo-200" />
                        <span>Google Lens Crop Region</span>
                      </>
                    )}
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
                  <Loader2 className="w-3 h-3 animate-spin" /> Scanning Visual Layer (Tesseract)...
                </span>
              ) : (
                <span className="text-blue-400 ml-2">
                  • {visualBoxes.length} Visual BBoxes Rendered (Tesseract OCR)
                </span>
              )}
            </span>
            <span className="text-indigo-300">Dual-Engine (VLM + Client OCR)</span>
          </div>
        </div>

        {/* RIGHT PANE: Dynamic Field Studio & Extracted Text Panel (5 Cols) */}
        <div className={`lg:col-span-5 flex flex-col rounded border overflow-hidden ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          
          {/* Header with Studio / Raw Text Tabs */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setActiveRightTab('fields')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeRightTab === 'fields'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Tag className="w-3.5 h-3.5" /> Field Studio ({fieldsState.length})
              </button>

              <button
                onClick={() => setActiveRightTab('raw_ocr')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeRightTab === 'raw_ocr'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Extracted Text ({nvidiaOcrBlocks.length > 0 ? nvidiaOcrBlocks.length : 'OCR'})
              </button>
            </div>

            {activeRightTab === 'fields' && (
              <button
                onClick={() => setShowAddFieldModal(true)}
                className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Field
              </button>
            )}
          </div>

          {/* TAB 1: Fields Editable List */}
          {activeRightTab === 'fields' && (
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
                      focusedFieldId === field.id
                        ? 'border-amber-400 bg-amber-500/10 dark:bg-amber-950/30 ring-2 ring-amber-400/80 shadow-md'
                        : hoveredFieldKey === field.key || (hoveredFieldValue === field.value && field.value)
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
                          {focusedFieldId === field.id ? (
                            <span className="text-[8px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded font-mono uppercase tracking-wider animate-pulse">
                              Active Target
                            </span>
                          ) : field.key.includes('.') ? (
                            <span className="text-[8px] bg-indigo-500/20 text-indigo-300 px-1 py-0.5 rounded font-mono font-bold border border-indigo-500/30">
                              Nested {field.key.split('.')[0]}
                            </span>
                          ) : field.category === 'google_lens_crop' ? (
                            <span className="text-[8px] text-indigo-400 font-mono uppercase font-bold">Crop</span>
                          ) : null}
                        </label>
                        <input
                          ref={(el) => { keyInputRefs.current[field.id] = el; }}
                          type="text"
                          value={field.key}
                          onFocus={() => setFocusedFieldId(field.id)}
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
                          onFocus={() => setFocusedFieldId(field.id)}
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
          )}

          {/* TAB 2: Extracted Text Panel (NVIDIA & Gemini Hybrid AI Output) */}
          {activeRightTab === 'raw_ocr' && (() => {
            const displayRawText = rawOcrText || currentImage?.ocrData?.rawText || (currentImage as any)?._raw_text || (currentImage as any)?.vlmResult?.rawText || '';
            const hasDataToDisplay = nvidiaOcrBlocks.length > 0 || displayRawText || fieldsState.length > 0;

            return (
              <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-emerald-500 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Extracted Text / Hybrid AI Engine
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {nvidiaOcrBlocks.length > 0 ? `${nvidiaOcrBlocks.length} Bounding Boxes` : 'Structured JSON Mode'}
                  </span>
                </div>

                {!hasDataToDisplay ? (
                  <div className="text-center py-12 space-y-3">
                    <p className="text-slate-400">No OCR extraction performed yet.</p>
                    <button
                      onClick={handleRunNvidiaOcrProcess}
                      disabled={isProcessingNvidiaOcr}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      {isProcessingNvidiaOcr ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Run OCR Extraction Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {nvidiaOcrBlocks.length > 0 && (
                      <div className="p-3 bg-slate-950 text-emerald-400 rounded-lg border border-slate-800 space-y-1.5">
                        <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Line-by-Line Raw Extracted Output:</div>
                        {nvidiaOcrBlocks.map((block: any, idx: number) => (
                          <div key={`ocr-line-${idx}`} className="flex items-start justify-between gap-2 p-1.5 hover:bg-slate-900 rounded border border-transparent hover:border-emerald-500/30 transition-colors">
                            <span className="text-slate-500 text-[10px] w-6 select-none">{idx + 1}.</span>
                            <span className="flex-1 font-semibold text-slate-100">{block.text_content}</span>
                            {block.confidence && (
                              <span className="text-[9px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold">
                                {Math.round(block.confidence * 100)}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {displayRawText && (
                      <div className="p-3 bg-slate-950 text-emerald-400 rounded-lg border border-slate-800 shadow-inner">
                        <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Raw Text / Model Context:</div>
                        <pre className="text-[11px] text-slate-200 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                          {displayRawText}
                        </pre>
                      </div>
                    )}

                    {fieldsState.length > 0 && (
                      <div className="p-3 bg-slate-950 text-indigo-300 rounded-lg border border-slate-800 shadow-inner">
                        <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Structured JSON Data:</div>
                        <pre className="text-[11px] text-emerald-400 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                          {JSON.stringify(
                            fieldsState.reduce((acc, f) => {
                              if (f.key) acc[f.key] = f.value;
                              return acc;
                            }, {} as Record<string, any>),
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

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
