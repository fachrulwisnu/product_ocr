import React, { useState, useEffect } from 'react';
import { 
  FileCode2, 
  Plus, 
  Trash2, 
  FolderPlus, 
  Sparkles, 
  Tags, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Building2,
  Layers,
  Edit2
} from 'lucide-react';

interface DocumentCategory {
  id: string;
  name: string;
  description: string;
  created_at?: string;
}

interface ReceiptTemplate {
  id: string;
  category_id: string;
  template_name: string;
  schema_rule: string;
  keywords: string[];
  created_at?: string;
}

export const TemplateManager: React.FC = () => {
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [templates, setTemplates] = useState<ReceiptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Category Modal Form State
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatDesc, setNewCatDesc] = useState<string>('');
  const [isSubmittingCat, setIsSubmittingCat] = useState<boolean>(false);

  // Template Modal Form State
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tmplCatId, setTmplCatId] = useState<string>('');
  const [tmplName, setTmplName] = useState<string>('');
  const [tmplKeywords, setTmplKeywords] = useState<string>('');
  const [tmplSchemaRule, setTmplSchemaRule] = useState<string>('');
  const [isSubmittingTmpl, setIsSubmittingTmpl] = useState<boolean>(false);

  // Fetch Categories and Templates
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [catRes, tmplRes] = await Promise.all([
        fetch('/api/v1/templates/categories'),
        fetch('/api/v1/templates/receipt-templates')
      ]);

      if (catRes.ok) {
        const catJson = await catRes.json();
        setCategories(catJson.data || []);
      }

      if (tmplRes.ok) {
        const tmplJson = await tmplRes.json();
        setTemplates(tmplJson.data || []);
      }
    } catch (err: any) {
      setError('Failed to connect to templates endpoint');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showTemporarySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setIsSubmittingCat(true);
    try {
      const res = await fetch('/api/v1/templates/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName, description: newCatDesc })
      });

      if (res.ok) {
        setShowCategoryModal(false);
        setNewCatName('');
        setNewCatDesc('');
        showTemporarySuccess('Bank / Issuer category created successfully!');
        fetchData();
      } else {
        const errJson = await res.json();
        setError(errJson.error || 'Failed to create category');
      }
    } catch (err: any) {
      setError('Network error while creating category');
    } finally {
      setIsSubmittingCat(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Linked templates will be unassigned.')) return;
    try {
      const res = await fetch(`/api/v1/templates/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showTemporarySuccess('Category deleted successfully');
        fetchData();
      }
    } catch (err) {
      setError('Failed to delete category');
    }
  };

  // Open Template Modal (Create/Edit)
  const openTemplateModal = (tmpl?: ReceiptTemplate) => {
    if (tmpl) {
      setEditingTemplateId(tmpl.id);
      setTmplCatId(tmpl.category_id || (categories[0]?.id || ''));
      setTmplName(tmpl.template_name);
      setTmplKeywords(Array.isArray(tmpl.keywords) ? tmpl.keywords.join(', ') : '');
      setTmplSchemaRule(tmpl.schema_rule);
    } else {
      setEditingTemplateId(null);
      setTmplCatId(categories[0]?.id || '');
      setTmplName('');
      setTmplKeywords('');
      setTmplSchemaRule('Format as JSON with keys: BANK_NAME, ATM_ID, TRANSACTION_TYPE, AMOUNT, DATE, TIME.');
    }
    setShowTemplateModal(true);
  };

  // Save Template (Create or Update)
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tmplName.trim() || !tmplSchemaRule.trim()) return;

    setIsSubmittingTmpl(true);
    try {
      const keywordsArray = tmplKeywords.split(',').map(k => k.trim()).filter(Boolean);
      const url = editingTemplateId 
        ? `/api/v1/templates/receipt-templates/${editingTemplateId}`
        : '/api/v1/templates/receipt-templates';
      const method = editingTemplateId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: tmplCatId,
          template_name: tmplName,
          keywords: keywordsArray,
          schema_rule: tmplSchemaRule
        })
      });

      if (res.ok) {
        setShowTemplateModal(false);
        showTemporarySuccess(editingTemplateId ? 'Template updated successfully!' : 'New receipt template registered!');
        fetchData();
      } else {
        const errJson = await res.json();
        setError(errJson.error || 'Failed to save template');
      }
    } catch (err: any) {
      setError('Network error while saving template');
    } finally {
      setIsSubmittingTmpl(false);
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template rule?')) return;
    try {
      const res = await fetch(`/api/v1/templates/receipt-templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showTemporarySuccess('Template rule removed');
        fetchData();
      }
    } catch (err) {
      setError('Failed to delete template');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-600 rounded-lg text-white shadow-md">
              <FileCode2 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black tracking-wide uppercase">Template Manager & Rule Engine</h1>
          </div>
          <p className="text-slate-400 text-xs mt-1 max-w-2xl">
            Configure Bank Categories and dynamic Receipt Schema Rules. The OCR Classification engine auto-detects templates by matching keyword vectors in Nemotron raw text.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
          >
            <FolderPlus className="w-4 h-4 text-indigo-400" />
            Add Bank Category
          </button>
          <button
            onClick={() => openTemplateModal()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            Register Template
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Categories Sidebar & Templates List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Bank Categories */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                Issuer Categories ({categories.length})
              </h2>
            </div>

            {isLoading ? (
              <div className="py-8 flex justify-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs font-mono">
                No categories created yet.
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-3 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between group transition-all"
                  >
                    <div>
                      <h3 className="text-xs font-bold text-slate-200">{cat.name}</h3>
                      <p className="text-[10px] text-slate-500">{cat.description || 'No description'}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 cursor-pointer transition-all"
                      title="Delete category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Receipt Templates */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Active Receipt Templates ({templates.length})
              </h2>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/40">
                OCR Auto-Classification
              </span>
            </div>

            {isLoading ? (
              <div className="py-12 flex justify-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs font-mono space-y-2">
                <p>No receipt templates registered.</p>
                <p className="text-[10px] text-indigo-400">Click "Register Template" to add classification rules!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((tmpl) => {
                  const categoryObj = categories.find(c => c.id === tmpl.category_id);

                  return (
                    <div
                      key={tmpl.id}
                      className="p-4 bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-lg space-y-3 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-100">{tmpl.template_name}</h3>
                            {categoryObj && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {categoryObj.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openTemplateModal(tmpl)}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 cursor-pointer transition-colors"
                            title="Edit template"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(tmpl.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                            title="Delete template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Keywords Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Tags className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="text-[10px] text-slate-400 font-mono font-bold">Matching Keywords:</span>
                        {tmpl.keywords && tmpl.keywords.length > 0 ? (
                          tmpl.keywords.map((kw, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded text-[10px] font-mono font-bold"
                            >
                              {kw}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No keywords assigned</span>
                        )}
                      </div>

                      {/* Schema Rule Box */}
                      <div className="p-3 bg-slate-900 rounded border border-slate-800/80">
                        <div className="text-[9px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span>LLM Extraction Schema Rule</span>
                        </div>
                        <p className="text-xs text-slate-300 font-mono leading-relaxed">
                          {tmpl.schema_rule}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE CATEGORY MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-indigo-400" /> Add Bank / Issuer Category
            </h3>

            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Category Name (e.g., Bank Central Asia)
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Enter bank or issuer name..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Description
                </label>
                <textarea
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Optional details..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-3.5 py-1.5 rounded text-xs font-bold uppercase text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCat}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  {isSubmittingCat && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT TEMPLATE MODAL */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-emerald-400" />
              {editingTemplateId ? 'Edit Receipt Template' : 'Register Receipt Template'}
            </h3>

            <form onSubmit={handleSaveTemplate} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Document Category
                </label>
                <select
                  value={tmplCatId}
                  onChange={(e) => setTmplCatId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="">Unassigned General Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Template Name (e.g., CIMB Cassette Audit Form)
                </label>
                <input
                  type="text"
                  required
                  value={tmplName}
                  onChange={(e) => setTmplName(e.target.value)}
                  placeholder="Enter template name..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Trigger Keywords (Comma Separated, e.g., "CIMB, CASSETTE, AUDIT")
                </label>
                <input
                  type="text"
                  value={tmplKeywords}
                  onChange={(e) => setTmplKeywords(e.target.value)}
                  placeholder="Keywords that must appear in raw OCR text..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 font-mono focus:outline-hidden focus:border-emerald-500 text-emerald-300"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  LLM Extraction Schema Rule
                </label>
                <textarea
                  required
                  value={tmplSchemaRule}
                  onChange={(e) => setTmplSchemaRule(e.target.value)}
                  placeholder="Format as JSON with keys: BANK_NAME, ATM_ID, AMOUNT..."
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 font-mono focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-3.5 py-1.5 rounded text-xs font-bold uppercase text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTmpl}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  {isSubmittingTmpl && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
