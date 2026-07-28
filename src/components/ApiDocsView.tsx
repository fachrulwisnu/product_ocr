import React, { useState } from 'react';
import { 
  Code2, 
  Terminal, 
  Send, 
  Copy, 
  Check, 
  Layers, 
  Zap,
  Server
} from 'lucide-react';

interface ApiDocsViewProps {
  isDarkMode: boolean;
}

export const ApiDocsView: React.FC<ApiDocsViewProps> = ({ isDarkMode }) => {
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const endpoints = [
    {
      method: 'POST',
      path: '/api/vlm',
      description: 'NVIDIA Nemotron 30B VLM direct reasoning key-value extraction',
      body: '{\n  "image": "data:image/png;base64,..."\n}'
    },
    {
      method: 'POST',
      path: '/api/upload',
      description: 'Upload receipt image & run VLM key-value discovery',
      body: '{\n  "projectId": "proj-atm-main",\n  "receiptType": "ATM Cash Withdrawal",\n  "fileName": "ATM_Receipt.png"\n}'
    },

    {
      method: 'POST',
      path: '/api/predict',
      description: 'Run AI field extraction model on OCR output',
      body: '{\n  "projectId": "proj-atm-main",\n  "ocrData": { "rawText": "TERMINAL ID: ATM-8842-NY\\nAMOUNT: $200.00" }\n}'
    },
    {
      method: 'POST',
      path: '/api/train',
      description: 'Trigger Instant Learning background training',
      body: '{\n  "projectId": "proj-atm-main"\n}'
    },
    {
      method: 'GET',
      path: '/api/projects',
      description: 'List all active OCR annotation projects'
    },
    {
      method: 'GET',
      path: '/api/images',
      description: 'Retrieve project receipt images and bounding box annotations'
    },
    {
      method: 'GET',
      path: '/api/metrics',
      description: 'Get platform metrics & accuracy statistics'
    },
    {
      method: 'POST',
      path: '/api/export',
      description: 'Export dataset in JSON or CSV format',
      body: '{\n  "format": "json"\n}'
    }
  ];

  const handleTestCall = async (ep: typeof endpoints[0]) => {
    setIsLoading(true);
    setTestResponse(null);

    try {
      let res;
      if (ep.method === 'GET') {
        res = await fetch(ep.path);
      } else {
        res = await fetch(ep.path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: ep.body || '{}'
        });
      }

      const data = await res.json();
      setTestResponse(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setTestResponse(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h2 className="text-xl font-bold tracking-tight uppercase flex items-center gap-2">
          <Code2 className="w-5 h-5 text-indigo-500" />
          <span>REST API Documentation & Live Console</span>
        </h2>
        <p className="text-xs text-slate-500">
          Programmatic API integration endpoints for uploading receipts, querying NVIDIA NIM OCR API, and triggering training.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Endpoints List (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {endpoints.map((ep, idx) => (
            <div
              key={idx}
              className={`p-4 rounded border transition-all ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              } space-y-2`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    ep.method === 'GET' ? 'bg-blue-500/10 text-blue-500' : 'bg-indigo-500/10 text-indigo-500'
                  }`}>
                    {ep.method}
                  </span>
                  <span className="font-mono text-xs font-bold">{ep.path}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copyToClipboard(`curl -X ${ep.method} http://localhost:3000${ep.path}`, `ep-${idx}`)}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="Copy cURL command"
                  >
                    {copiedEndpoint === `ep-${idx}` ? <Check className="w-3.5 h-3.5 text-indigo-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => handleTestCall(ep)}
                    className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <Send className="w-3 h-3" /> Test
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500">{ep.description}</p>
            </div>
          ))}
        </div>

        {/* Live Response Console (5 cols) */}
        <div className={`lg:col-span-5 p-4 rounded border flex flex-col h-[520px] ${
          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 text-slate-100 border-slate-800'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
            <div className="flex items-center gap-2 font-bold font-mono">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] uppercase tracking-wider text-slate-300">Live API Response Console</span>
            </div>
            {isLoading && <span className="text-amber-400 font-mono text-[10px] uppercase font-bold animate-pulse">Executing...</span>}
          </div>

          <div className="flex-1 overflow-auto p-3 font-mono text-xs text-indigo-300 leading-relaxed">
            {testResponse ? (
              <pre className="whitespace-pre-wrap">{testResponse}</pre>
            ) : (
              <div className="text-slate-600 flex items-center justify-center h-full text-center font-mono text-[11px]">
                Click "Test" on any REST endpoint to execute live call.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
