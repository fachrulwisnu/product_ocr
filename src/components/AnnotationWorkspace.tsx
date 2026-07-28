import React, { useState } from 'react';
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
  Tag
} from 'lucide-react';
import { saveVlmExtraction, updateDynamicLabels } from '../lib/supabaseClient';

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
  isDarkMode
}) => {
  const currentImage = selectedImage || images[0];

  // Viewer Controls State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  // Editable Dynamic Key-Value Pairs State
  const [fieldsState, setFieldsState] = useState<ExtractedField[]>(currentImage ? currentImage.fields : []);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [isSavingSupabase, setIsSavingSupabase] = useState(false);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

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

  // Approve & Save (With Supabase Persistence)
  const handleApprove = async () => {
    setIsSavingSupabase(true);

    // Convert fields state to clean JSON object for Supabase
    const jsonExtraction: Record<string, any> = {};
    const labelKeys: string[] = [];

    fieldsState.forEach(f => {
      if (f.key) {
        jsonExtraction[f.key] = f.value;
        labelKeys.push(f.key);
      }
    });

    try {
      // 1. Save VLM Extraction to vlm_results in Supabase
      await saveVlmExtraction(
        currentImage.id,
        jsonExtraction,
        JSON.stringify(jsonExtraction, null, 2),
        1250,
        'NVIDIA_NEMOTRON'
      );

      // 2. Update dynamic_labels table in Supabase
      await updateDynamicLabels(currentImage.projectId, labelKeys);

      setSaveNotification('Saved to Supabase & Verified!');
      setTimeout(() => setSaveNotification(null), 3000);
    } catch (err) {
      console.warn('Saved locally (Supabase offline/not configured)');
    } finally {
      setIsSavingSupabase(false);
    }

    // Call parent handler
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

  return (
    <div className="space-y-4">
      
      {/* Top Selector & Action Bar */}
      <div className={`p-4 rounded border flex flex-col md:flex-row items-center justify-between gap-4 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {/* Document Switcher */}
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

          {saveNotification && (
            <span className="text-xs font-bold text-emerald-500 animate-pulse flex items-center gap-1">
              <Database className="w-3.5 h-3.5" /> {saveNotification}
            </span>
          )}
        </div>

        {/* Action Buttons */}
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
            disabled={isSavingSupabase}
            className="px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer shadow-md transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSavingSupabase ? 'SAVING TO SUPABASE...' : 'VERIFY & SAVE'}
          </button>
        </div>
      </div>

      {/* Main Dual-Pane Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px]">
        
        {/* LEFT PANE: Interactive High-Res Receipt Image Viewer (7 Cols) */}
        <div className={`lg:col-span-7 flex flex-col rounded border overflow-hidden ${
          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-200 border-slate-200'
        }`}>
          
          {/* Canvas Zoom Toolbar */}
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

            <div className="flex items-center gap-1.5 text-indigo-400 font-mono text-[11px] font-bold">
              <Bot className="w-4 h-4" />
              <span>NVIDIA Nemotron 30B VLM</span>
            </div>
          </div>

          {/* Canvas Image Display */}
          <div className="flex-1 overflow-auto p-8 flex items-center justify-center relative select-none bg-slate-300 dark:bg-slate-950">
            <div 
              className="relative transition-transform duration-200 origin-center"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                maxWidth: '480px'
              }}
            >
              <img
                src={currentImage.fileUrl}
                alt={currentImage.fileName}
                className="w-full h-auto rounded shadow-2xl border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="p-2.5 bg-slate-900 text-slate-400 text-[10px] font-mono flex items-center justify-between border-t border-slate-800 px-4">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" /> VLM Direct Reasoning Active
            </span>
            <span className="text-indigo-300">Unsupervised key-value discovery without spatial boxes</span>
          </div>
        </div>

        {/* RIGHT PANE: Dynamic Field Definition (5 Cols) */}
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
                VLM extracted dynamic keys & values. Edit both sides freely.
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
              <div className="text-center py-12 text-slate-500 text-xs font-mono">
                No fields extracted yet. Click "Add Field" to define a dynamic key-value pair.
              </div>
            ) : (
              fieldsState.map((field) => (
                <div
                  key={field.id}
                  className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2 hover:border-slate-300 transition-all"
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Left Input: Key Name */}
                    <div className="col-span-5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Discovered Key
                      </label>
                      <input
                        type="text"
                        value={field.key}
                        onChange={(e) => handleFieldKeyChange(field.id, e.target.value)}
                        placeholder="KEY_NAME"
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
                className="flex-[2] py-2.5 bg-indigo-600 text-white text-xs font-bold rounded shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-colors uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
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
