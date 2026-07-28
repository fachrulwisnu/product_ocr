import React, { useState, useRef } from 'react';
import { ReceiptImage, ExtractedField, OCRLine, BoundingBox } from '../types';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Eye, 
  EyeOff, 
  MousePointer, 
  Square, 
  Combine, 
  Scissors, 
  Save, 
  ChevronRight, 
  ChevronLeft,
  Crosshair,
  Info,
  Check,
  Edit2
} from 'lucide-react';

interface AnnotationWorkspaceProps {
  images: ReceiptImage[];
  selectedImage: ReceiptImage | null;
  setSelectedImage: (img: ReceiptImage) => void;
  onSaveLabels: (imageId: string, fields: ExtractedField[], status: 'approved' | 'needs_review' | 'rejected') => void;
  onTrainTrigger?: () => void;
  isDarkMode: boolean;
}

export const AnnotationWorkspace: React.FC<AnnotationWorkspaceProps> = ({
  images,
  selectedImage,
  setSelectedImage,
  onSaveLabels,
  onTrainTrigger,
  isDarkMode
}) => {
  const currentImage = selectedImage || images[0];

  // Viewer Controls State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [activeTool, setActiveTool] = useState<'pan' | 'box_select'>('pan');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  // Editable Fields State
  const [fieldsState, setFieldsState] = useState<ExtractedField[]>(currentImage ? currentImage.fields : []);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [highlightedBox, setHighlightedBox] = useState<BoundingBox | null>(null);

  // Sync state when selected image changes
  React.useEffect(() => {
    if (selectedImage) {
      setFieldsState(selectedImage.fields);
      setSelectedFieldId(selectedImage.fields[0]?.id || null);
    }
  }, [selectedImage]);

  if (!currentImage) {
    return (
      <div className="p-12 text-center text-slate-500">
        No receipt images available for annotation. Upload an image to begin.
      </div>
    );
  }

  // Handle Field Value Change
  const handleFieldValueChange = (fieldId: string, val: string) => {
    setFieldsState(prev => prev.map(f => f.id === fieldId ? { ...f, value: val, status: 'edited' } : f));
  };

  // Handle Field Key Change
  const handleFieldKeyChange = (fieldId: string, keyName: string) => {
    setFieldsState(prev => prev.map(f => f.id === fieldId ? { ...f, key: keyName.toUpperCase().replace(/\s+/g, '_'), label: keyName, status: 'edited' } : f));
  };

  // Add Custom Field Label
  const handleAddCustomField = () => {
    if (!newFieldKey.trim()) return;
    const newField: ExtractedField = {
      id: `field-custom-${Date.now()}`,
      key: newFieldKey.toUpperCase().replace(/\s+/g, '_'),
      label: newFieldKey,
      value: newFieldValue || '',
      confidence: 1.0,
      status: 'manual_added',
      category: 'other',
      box: { x1: 10, y1: 10, x2: 90, y2: 13 }
    };
    setFieldsState(prev => [...prev, newField]);
    setNewFieldKey('');
    setNewFieldValue('');
    setShowAddFieldModal(false);
  };

  // Delete Field
  const handleDeleteField = (fieldId: string) => {
    setFieldsState(prev => prev.filter(f => f.id !== fieldId));
  };

  // Assign Clicked OCR Text to Selected Field
  const handleOCRTextClick = (lineText: string, box?: BoundingBox) => {
    if (selectedFieldId) {
      setFieldsState(prev => prev.map(f => {
        if (f.id === selectedFieldId) {
          return {
            ...f,
            value: lineText,
            box: box || f.box,
            status: 'edited',
            confidence: 1.0
          };
        }
        return f;
      }));
    }
  };

  // Approve & Save
  const handleApprove = () => {
    onSaveLabels(currentImage.id, fieldsState, 'approved');
    // Move to next image if available
    const nextIdx = images.findIndex(i => i.id === currentImage.id) + 1;
    if (nextIdx < images.length) {
      setSelectedImage(images[nextIdx]);
    }
  };

  // Reject
  const handleReject = () => {
    onSaveLabels(currentImage.id, fieldsState, 'rejected');
  };

  const getConfidenceBadgeColor = (conf: number) => {
    if (conf >= 0.85) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
    if (conf >= 0.60) return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    return 'bg-rose-500/10 text-rose-600 border-rose-500/30';
  };

  return (
    <div className="space-y-4">
      
      {/* Top Selector & Action Bar */}
      <div className={`p-4 rounded border flex flex-col md:flex-row items-center justify-between gap-4 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {/* Receipt Switcher */}
        <div className="flex items-center gap-3 w-full md:w-auto">
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
        </div>

        {/* Workflow Approval Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
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
            className="px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            VERIFY & SAVE
          </button>
        </div>
      </div>

      {/* Main Dual-Pane Nanonets Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px]">
        
        {/* LEFT PANE: Interactive Image & OCR Bounding Box Canvas (7 Cols) */}
        <div className={`lg:col-span-7 flex flex-col rounded border overflow-hidden ${
          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-200 border-slate-200'
        }`}>
          
          {/* Canvas Toolbar */}
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
              <button
                onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                className={`px-3 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  showBoundingBoxes ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 text-slate-500'
                }`}
              >
                {showBoundingBoxes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>Bounding Boxes</span>
              </button>
            </div>
          </div>

          {/* Canvas Scroll Area */}
          <div className="flex-1 overflow-auto p-8 flex items-center justify-center relative select-none bg-slate-300 dark:bg-slate-950">
            
            <div 
              className="relative transition-transform duration-200 origin-center"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                maxWidth: '480px'
              }}
            >
              {/* Receipt Image */}
              <img
                src={currentImage.fileUrl}
                alt={currentImage.fileName}
                className="w-full h-auto rounded shadow-2xl border border-slate-300 dark:border-slate-700 pointer-events-none"
              />

              {/* Bounding Box Overlays */}
              {showBoundingBoxes && (
                <div className="absolute inset-0">
                  {/* OCR Line Overlays */}
                  {currentImage.ocrData.lines.map((line) => {
                    const box = line.box;
                    const isHovered = highlightedBox === box;
                    return (
                      <div
                        key={line.id}
                        onClick={() => handleOCRTextClick(line.text, box)}
                        onMouseEnter={() => setHighlightedBox(box)}
                        onMouseLeave={() => setHighlightedBox(null)}
                        style={{
                          left: `${box.x1}%`,
                          top: `${box.y1}%`,
                          width: `${box.x2 - box.x1}%`,
                          height: `${box.y2 - box.y1}%`
                        }}
                        className={`absolute border-2 transition-all cursor-pointer ring-1 ring-white ${
                          isHovered 
                            ? 'border-indigo-500 bg-indigo-500/20 z-20' 
                            : 'border-indigo-500/50 bg-indigo-500/10 hover:border-indigo-500 hover:bg-indigo-500/30'
                        }`}
                        title={`Click to fill selected field with: "${line.text}"`}
                      >
                        <span className="opacity-0 group-hover:opacity-100 absolute -top-5 left-0 bg-slate-900 text-indigo-300 font-mono text-[9px] px-1 rounded whitespace-nowrap z-30">
                          {line.text}
                        </span>
                      </div>
                    );
                  })}

                  {/* Field Bounding Boxes (Colored by confidence) */}
                  {fieldsState.map((f) => {
                    if (!f.box) return null;
                    const isSelected = selectedFieldId === f.id;
                    const confColor = f.confidence >= 0.85 ? 'border-emerald-500 bg-emerald-500/20' : f.confidence >= 0.60 ? 'border-amber-500 bg-amber-500/20' : 'border-rose-500 bg-rose-500/20';

                    return (
                      <div
                        key={`box-${f.id}`}
                        onClick={() => setSelectedFieldId(f.id)}
                        style={{
                          left: `${f.box.x1}%`,
                          top: `${f.box.y1}%`,
                          width: `${f.box.x2 - f.box.x1}%`,
                          height: `${f.box.y2 - f.box.y1}%`
                        }}
                        className={`absolute border-2 transition-all cursor-pointer ring-1 ring-white ${confColor} ${
                          isSelected ? 'ring-2 ring-indigo-500 z-30 shadow-lg' : ''
                        }`}
                      >
                        <span className="absolute -top-4 right-0 bg-slate-900 text-white font-mono text-[9px] px-1 rounded">
                          {f.key}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          <div className="p-2 bg-slate-900 text-slate-400 text-[10px] font-mono flex items-center justify-between border-t border-slate-800 px-4">
            <span>OCR Engine: NVIDIA NIM OCR API</span>
            <span className="text-indigo-400">Click any OCR block to set field value</span>
          </div>
        </div>

        {/* RIGHT PANE: Extracted Fields Property Panel (5 Cols) */}
        <div className={`lg:col-span-5 flex flex-col rounded border overflow-hidden ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          
          {/* Header */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Field Extraction</h2>
            </div>

            <button
              onClick={() => setShowAddFieldModal(true)}
              className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Define New Label
            </button>
          </div>

          {/* Fields Scroll List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {fieldsState.map((field) => {
              const isSelected = selectedFieldId === field.id;
              const isLowConf = field.confidence < 0.85;

              return (
                <div
                  key={field.id}
                  onClick={() => setSelectedFieldId(field.id)}
                  className={`space-y-1.5 p-3 rounded border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 ring-2 ring-amber-200/50 dark:ring-amber-900/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-end">
                    {/* Key Label Input */}
                    <div className="flex items-center gap-1.5 flex-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        {field.key}
                      </label>
                    </div>

                    {/* Confidence Score Gauge */}
                    <span className={`text-[9px] font-bold ${
                      field.confidence >= 0.85 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {Math.round(field.confidence * 100)}%
                    </span>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteField(field.id); }}
                      className="text-slate-300 hover:text-rose-500 p-1 cursor-pointer ml-2"
                      title="Delete Field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Field Value Input */}
                  <div className="relative flex">
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                      placeholder="Click OCR text or type value..."
                      className={`w-full px-3 py-2 border rounded text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none ${
                        isSelected 
                          ? 'border-amber-300 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold' 
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    />
                  </div>
                  {isLowConf && (
                    <p className="text-[9px] text-amber-600 italic">
                      NIM predicted from OCR block "{field.value}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Helper Note / Footer Action Panel */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors uppercase tracking-wider"
              >
                REJECT
              </button>
              <button
                onClick={handleApprove}
                className="flex-[2] py-2.5 bg-indigo-600 text-white text-xs font-bold rounded shadow-lg shadow-indigo-200/40 hover:bg-indigo-700 transition-colors uppercase tracking-wider"
              >
                VERIFY & SAVE
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 py-1 text-slate-400 text-[9px] font-medium uppercase tracking-wider">
              <span>Auto-save enabled</span>
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
            <h3 className="font-bold text-sm uppercase tracking-wider">Define New Label</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Field Label Name</label>
                <input
                  type="text"
                  placeholder="e.g. CASSETTE5_DISPENSED or SURCHARGE"
                  value={newFieldKey}
                  onChange={(e) => setNewFieldKey(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Initial Value (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. $1.50"
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
                Add Field
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
