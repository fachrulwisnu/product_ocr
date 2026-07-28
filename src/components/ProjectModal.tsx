import React, { useState } from 'react';
import { ReceiptType } from '../types';
import { X, FolderPlus } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (name: string, description: string, receiptType: ReceiptType) => void;
  isDarkMode: boolean;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  isDarkMode
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [receiptType, setReceiptType] = useState<ReceiptType>('ATM Cash Withdrawal');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateProject(name, description, receiptType);
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className={`p-5 rounded max-w-md w-full space-y-4 border shadow-2xl ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-sm uppercase tracking-wider">Create New ATM OCR Project</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Project Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. NCR SelfServ Receipt Extraction"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Document Category (Select or Type Custom)
            </label>
            <input
              type="text"
              list="document-categories-list"
              value={receiptType}
              onChange={(e) => setReceiptType(e.target.value)}
              placeholder="e.g. KTP (Indonesian ID), Invoice, Passport..."
              className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold focus:outline-hidden"
            />
            <datalist id="document-categories-list">
              <option value="ATM Cash Withdrawal" />
              <option value="KTP (Indonesian ID)" />
              <option value="Invoice" />
              <option value="Tax Document (NPWP)" />
              <option value="General Receipt" />
              <option value="Passport" />
              <option value="Driver License" />
              <option value="Bank Statement" />
            </datalist>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="e.g. Automated extraction model for Diebold ATM fleet cash balances and transaction logs."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-md"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
