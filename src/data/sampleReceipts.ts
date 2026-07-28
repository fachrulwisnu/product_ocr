import { Project, ReceiptImage, OCRResult, ExtractedField } from '../types';

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-atm-main',
    name: 'ATM Receipt OCR - Diebold & NCR Fleet',
    description: 'Production model for automated ATM cash withdrawal, balance inquiry, and cassette audit receipts.',
    receiptType: 'ATM Cash Withdrawal',
    createdAt: '2026-07-25T10:00:00Z',
    trainedSampleCount: 4,
    modelAccuracy: 94.8,
    modelStatus: 'trained',
    modelVersion: 'v1.2.0',
    updatedAt: '2026-07-27T18:30:00Z'
  },
  {
    id: 'proj-cassette-audit',
    name: 'Cassette Audit & Cleared Reports',
    description: 'Extraction model for ATM cassette cash balances, remaining bills, and card capture logs.',
    receiptType: 'Cassette Audit & Cleared',
    createdAt: '2026-07-26T14:15:00Z',
    trainedSampleCount: 2,
    modelAccuracy: 81.2,
    modelStatus: 'untrained',
    modelVersion: 'v1.0.0',
    updatedAt: '2026-07-27T19:10:00Z'
  }
];

// Helper SVG Canvas Receipt Generator to create realistic crisp thermal receipt images on the fly!
export function generateReceiptSVG(
  title: string,
  receiptType: string,
  atmId: string,
  amount: string,
  balance: string,
  cassette1: string,
  cassette2: string
): string {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
    <!-- Receipt Paper Background with paper texture/shadow -->
    <rect width="600" height="900" fill="#f8fafc" />
    <rect x="25" y="25" width="550" height="850" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />
    <path d="M 25 875 L 50 865 L 75 875 L 100 865 L 125 875 L 150 865 L 175 875 L 200 865 L 225 875 L 250 865 L 275 875 L 300 865 L 325 875 L 350 865 L 375 875 L 400 865 L 425 875 L 450 865 L 475 875 L 500 865 L 525 875 L 550 865 L 575 875 L 575 875" fill="none" stroke="#94a3b8" stroke-width="2" />
    
    <!-- Header -->
    <text x="300" y="70" font-family="'Courier New', monospace" font-size="22" font-weight="bold" text-anchor="middle" fill="#0f172a">${title}</text>
    <text x="300" y="100" font-family="'Courier New', monospace" font-size="14" text-anchor="middle" fill="#475569">ATM LOCATION #4829 - DOWNTOWN BRANCH</text>
    <line x1="50" y1="120" x2="550" y2="120" stroke="#64748b" stroke-width="1.5" stroke-dasharray="6 4" />
    
    <!-- Receipt Details -->
    <text x="60" y="155" font-family="'Courier New', monospace" font-size="15" font-weight="bold" fill="#1e293b">TERMINAL ID: <tspan fill="#0f172a">${atmId}</tspan></text>
    <text x="60" y="185" font-family="'Courier New', monospace" font-size="15" fill="#334155">DATE: 2026-07-27   TIME: 14:32:08</text>
    <text x="60" y="215" font-family="'Courier New', monospace" font-size="15" fill="#334155">RECORD NO: 0094182</text>
    <text x="60" y="250" font-family="'Courier New', monospace" font-size="15" fill="#334155">CARD NUMBER: ************4819</text>
    <text x="60" y="285" font-family="'Courier New', monospace" font-size="15" font-weight="bold" fill="#0369a1">TRANSACTION: ${receiptType.toUpperCase()}</text>
    <text x="60" y="315" font-family="'Courier New', monospace" font-size="15" fill="#334155">FROM ACCOUNT: CHECKING ***8821</text>
    
    <line x1="50" y1="340" x2="550" y2="340" stroke="#64748b" stroke-width="1.5" stroke-dasharray="6 4" />
    
    <!-- Amounts -->
    <text x="60" y="375" font-family="'Courier New', monospace" font-size="16" font-weight="bold" fill="#0f172a">AMOUNT DISPENSED: <tspan fill="#15803d">${amount}</tspan></text>
    <text x="60" y="410" font-family="'Courier New', monospace" font-size="15" fill="#334155">TRANSACTION FEE: $2.50</text>
    <text x="60" y="445" font-family="'Courier New', monospace" font-size="16" font-weight="bold" fill="#0f172a">TOTAL DEBIT: ${amount}</text>
    <text x="60" y="480" font-family="'Courier New', monospace" font-size="16" font-weight="bold" fill="#0f172a">AVAILABLE BALANCE: <tspan fill="#0369a1">${balance}</tspan></text>

    <line x1="50" y1="510" x2="550" y2="510" stroke="#64748b" stroke-width="1.5" stroke-dasharray="6 4" />
    
    <!-- Cassette Details -->
    <text x="300" y="545" font-family="'Courier New', monospace" font-size="14" font-weight="bold" text-anchor="middle" fill="#475569">--- CASSETTE HARDWARE STATUS ---</text>
    <text x="60" y="580" font-family="'Courier New', monospace" font-size="14" fill="#334155">CASSETTE 1 ($20): DISPENSED ${cassette1} | REMAINING 480</text>
    <text x="60" y="615" font-family="'Courier New', monospace" font-size="14" fill="#334155">CASSETTE 2 ($50): DISPENSED ${cassette2} | REMAINING 320</text>
    <text x="60" y="650" font-family="'Courier New', monospace" font-size="14" fill="#334155">CASSETTE 3 ($100): DISPENSED 0  | REMAINING 150</text>
    <text x="60" y="685" font-family="'Courier New', monospace" font-size="14" fill="#334155">CASSETTE 4 (AUDIT): DISPENSED 0 | REMAINING 500</text>
    <text x="60" y="720" font-family="'Courier New', monospace" font-size="14" fill="#334155">REJECTED NOTES: 0</text>
    <text x="60" y="750" font-family="'Courier New', monospace" font-size="14" fill="#334155">CARDS CAPTURED: 0</text>
    <text x="60" y="780" font-family="'Courier New', monospace" font-size="14" fill="#334155">LAST CLEARED DATE: 2026-07-25 08:00</text>

    <line x1="50" y1="800" x2="550" y2="800" stroke="#64748b" stroke-width="1.5" stroke-dasharray="6 4" />

    <text x="300" y="830" font-family="'Courier New', monospace" font-size="14" font-weight="bold" text-anchor="middle" fill="#166534">AUTH CODE: 981240 - APPROVED</text>
    <text x="300" y="855" font-family="'Courier New', monospace" font-size="13" text-anchor="middle" fill="#64748b">THANK YOU FOR USING OUR ATM</text>
  </svg>
  `;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// Generate Initial Receipt Images
export const INITIAL_RECEIPT_IMAGES: ReceiptImage[] = [
  {
    id: 'img-1',
    projectId: 'proj-atm-main',
    fileName: 'ATM_Withdrawal_Receipt_001.png',
    receiptType: 'ATM Cash Withdrawal',
    fileUrl: generateReceiptSVG('FIRST NATIONAL BANK', 'CASH WITHDRAWAL', 'ATM-8842-NY', '$200.00', '$1,482.10', '10', '0'),
    uploadDate: '2026-07-27T10:12:00Z',
    status: 'needs_review',
    overallConfidence: 0.88,
    isTrainingSample: true,
    ocrData: {
      rawText: "FIRST NATIONAL BANK\nATM LOCATION #4829 - DOWNTOWN BRANCH\nTERMINAL ID: ATM-8842-NY\nDATE: 2026-07-27   TIME: 14:32:08\nRECORD NO: 0094182\nCARD NUMBER: ************4819\nTRANSACTION: CASH WITHDRAWAL\nFROM ACCOUNT: CHECKING ***8821\nAMOUNT DISPENSED: $200.00\nTRANSACTION FEE: $2.50\nTOTAL DEBIT: $202.50\nAVAILABLE BALANCE: $1,482.10\n--- CASSETTE HARDWARE STATUS ---\nCASSETTE 1 ($20): DISPENSED 10 | REMAINING 480\nCASSETTE 2 ($50): DISPENSED 0  | REMAINING 320\nCASSETTE 3 ($100): DISPENSED 0 | REMAINING 150\nCASSETTE 4 (AUDIT): DISPENSED 0| REMAINING 500\nREJECTED NOTES: 0\nCARDS CAPTURED: 0\nLAST CLEARED DATE: 2026-07-25 08:00\nAUTH CODE: 981240 - APPROVED\nTHANK YOU FOR USING OUR ATM",
      lines: [
        { id: 'l1', text: 'FIRST NATIONAL BANK', confidence: 0.98, box: { x1: 20, y1: 6, x2: 80, y2: 8.5 }, words: [] },
        { id: 'l2', text: 'TERMINAL ID: ATM-8842-NY', confidence: 0.99, box: { x1: 10, y1: 15, x2: 90, y2: 17.5 }, words: [] },
        { id: 'l3', text: 'DATE: 2026-07-27   TIME: 14:32:08', confidence: 0.97, box: { x1: 10, y1: 18.5, x2: 90, y2: 21 }, words: [] },
        { id: 'l4', text: 'CARD NUMBER: ************4819', confidence: 0.99, box: { x1: 10, y1: 25, x2: 90, y2: 27.5 }, words: [] },
        { id: 'l5', text: 'TRANSACTION: CASH WITHDRAWAL', confidence: 0.98, box: { x1: 10, y1: 28.5, x2: 90, y2: 31 }, words: [] },
        { id: 'l6', text: 'AMOUNT DISPENSED: $200.00', confidence: 0.99, box: { x1: 10, y1: 37.5, x2: 90, y2: 40 }, words: [] },
        { id: 'l7', text: 'AVAILABLE BALANCE: $1,482.10', confidence: 0.96, box: { x1: 10, y1: 48, x2: 90, y2: 50.5 }, words: [] },
        { id: 'l8', text: 'CASSETTE 1 ($20): DISPENSED 10 | REMAINING 480', confidence: 0.97, box: { x1: 10, y1: 58, x2: 90, y2: 60.5 }, words: [] },
        { id: 'l9', text: 'CASSETTE 2 ($50): DISPENSED 0  | REMAINING 320', confidence: 0.96, box: { x1: 10, y1: 61.5, x2: 90, y2: 64 }, words: [] },
        { id: 'l10', text: 'REJECTED NOTES: 0', confidence: 0.98, box: { x1: 10, y1: 72, x2: 90, y2: 74.5 }, words: [] }
      ],
      width: 600,
      height: 900,
      engine: 'NVIDIA NIM OCR API',
      processedAt: '2026-07-27T10:12:05Z'
    },
    fields: [
      { id: 'f1', key: 'ATM_ID', label: 'ATM Terminal ID', value: 'ATM-8842-NY', confidence: 0.99, box: { x1: 10, y1: 15, x2: 90, y2: 17.5 }, status: 'auto', category: 'header' },
      { id: 'f2', key: 'TRANSACTION_DATE', label: 'Transaction Date', value: '2026-07-27', confidence: 0.97, box: { x1: 10, y1: 18.5, x2: 50, y2: 21 }, status: 'auto', category: 'header' },
      { id: 'f3', key: 'TRANSACTION_TIME', label: 'Transaction Time', value: '14:32:08', confidence: 0.97, box: { x1: 52, y1: 18.5, x2: 90, y2: 21 }, status: 'auto', category: 'header' },
      { id: 'f4', key: 'CARD_NUMBER', label: 'Card Number', value: '************4819', confidence: 0.99, box: { x1: 10, y1: 25, x2: 90, y2: 27.5 }, status: 'auto', category: 'transaction' },
      { id: 'f5', key: 'TRANSACTION_TYPE', label: 'Transaction Type', value: 'CASH WITHDRAWAL', confidence: 0.98, box: { x1: 10, y1: 28.5, x2: 90, y2: 31 }, status: 'auto', category: 'transaction' },
      { id: 'f6', key: 'AMOUNT', label: 'Amount Dispensed', value: '$200.00', confidence: 0.99, box: { x1: 10, y1: 37.5, x2: 90, y2: 40 }, status: 'auto', category: 'financial' },
      { id: 'f7', key: 'BALANCE', label: 'Available Balance', value: '$1,482.10', confidence: 0.96, box: { x1: 10, y1: 48, x2: 90, y2: 50.5 }, status: 'auto', category: 'financial' },
      { id: 'f8', key: 'CASSETTE1_DISPENSED', label: 'Cassette 1 ($20)', value: '10', confidence: 0.97, box: { x1: 10, y1: 58, x2: 90, y2: 60.5 }, status: 'auto', category: 'cassette' },
      { id: 'f9', key: 'CASSETTE2_DISPENSED', label: 'Cassette 2 ($50)', value: '0', confidence: 0.96, box: { x1: 10, y1: 61.5, x2: 90, y2: 64 }, status: 'auto', category: 'cassette' },
      { id: 'f10', key: 'REJECTED_NOTES', label: 'Rejected Notes', value: '0', confidence: 0.98, box: { x1: 10, y1: 72, x2: 90, y2: 74.5 }, status: 'auto', category: 'cassette' }
    ]
  },
  {
    id: 'img-2',
    projectId: 'proj-atm-main',
    fileName: 'ATM_Balance_Inquiry_002.png',
    receiptType: 'Balance Inquiry',
    fileUrl: generateReceiptSVG('CHASE BANK ATM', 'BALANCE INQUIRY', 'ATM-3301-SF', '$0.00', '$4,920.50', '0', '0'),
    uploadDate: '2026-07-27T11:45:00Z',
    status: 'needs_review',
    overallConfidence: 0.76,
    isTrainingSample: true,
    ocrData: {
      rawText: "CHASE BANK ATM\nATM LOCATION #4829 - DOWNTOWN BRANCH\nTERMINAL ID: ATM-3301-SF\nDATE: 2026-07-27   TIME: 15:10:22\nRECORD NO: 0094195\nCARD NUMBER: ************9012\nTRANSACTION: BALANCE INQUIRY\nFROM ACCOUNT: SAVINGS ***1190\nAMOUNT DISPENSED: $0.00\nAVAILABLE BALANCE: $4,920.50",
      lines: [],
      width: 600,
      height: 900,
      engine: 'NVIDIA NIM OCR API',
      processedAt: '2026-07-27T11:45:05Z'
    },
    fields: [
      { id: 'f21', key: 'ATM_ID', label: 'ATM Terminal ID', value: 'ATM-3301-SF', confidence: 0.95, box: { x1: 10, y1: 15, x2: 90, y2: 17.5 }, status: 'auto', category: 'header' },
      { id: 'f22', key: 'TRANSACTION_DATE', label: 'Transaction Date', value: '2026-07-27', confidence: 0.96, box: { x1: 10, y1: 18.5, x2: 50, y2: 21 }, status: 'auto', category: 'header' },
      { id: 'f23', key: 'TRANSACTION_TIME', label: 'Transaction Time', value: '15:10:22', confidence: 0.96, box: { x1: 52, y1: 18.5, x2: 90, y2: 21 }, status: 'auto', category: 'header' },
      { id: 'f24', key: 'CARD_NUMBER', label: 'Card Number', value: '************9012', confidence: 0.98, box: { x1: 10, y1: 25, x2: 90, y2: 27.5 }, status: 'auto', category: 'transaction' },
      { id: 'f25', key: 'TRANSACTION_TYPE', label: 'Transaction Type', value: 'BALANCE INQUIRY', confidence: 0.94, box: { x1: 10, y1: 28.5, x2: 90, y2: 31 }, status: 'auto', category: 'transaction' },
      { id: 'f26', key: 'AMOUNT', label: 'Amount Dispensed', value: '$0.00', confidence: 0.99, box: { x1: 10, y1: 37.5, x2: 90, y2: 40 }, status: 'auto', category: 'financial' },
      { id: 'f27', key: 'BALANCE', label: 'Available Balance', value: '$4,920.50', confidence: 0.95, box: { x1: 10, y1: 48, x2: 90, y2: 50.5 }, status: 'auto', category: 'financial' }
    ]
  },
  {
    id: 'img-3',
    projectId: 'proj-cassette-audit',
    fileName: 'Cassette_Audit_Cleared_003.png',
    receiptType: 'Cassette Audit & Cleared',
    fileUrl: generateReceiptSVG('DIEBOLD NIXDORF AUDIT', 'CASSETTE AUDIT', 'ATM-9912-CHI', '$0.00', '$0.00', '150', '210'),
    uploadDate: '2026-07-27T14:20:00Z',
    status: 'needs_review',
    overallConfidence: 0.68,
    isTrainingSample: false,
    ocrData: {
      rawText: "DIEBOLD NIXDORF AUDIT\nTERMINAL ID: ATM-9912-CHI\nDATE: 2026-07-27   TIME: 16:00:00\nCASSETTE 1 ($20): DISPENSED 150 | REMAINING 50\nCASSETTE 2 ($50): DISPENSED 210 | REMAINING 10\nREJECTED NOTES: 3\nCARDS CAPTURED: 1\nLAST CLEARED DATE: 2026-07-27 16:00",
      lines: [],
      width: 600,
      height: 900,
      engine: 'NVIDIA NIM OCR API',
      processedAt: '2026-07-27T14:20:05Z'
    },
    fields: [
      { id: 'f31', key: 'ATM_ID', label: 'ATM Terminal ID', value: 'ATM-9912-CHI', confidence: 0.92, box: { x1: 10, y1: 15, x2: 90, y2: 17.5 }, status: 'auto', category: 'header' },
      { id: 'f32', key: 'CASSETTE1_DISPENSED', label: 'Cassette 1 ($20)', value: '150', confidence: 0.88, box: { x1: 10, y1: 58, x2: 90, y2: 60.5 }, status: 'auto', category: 'cassette' },
      { id: 'f33', key: 'CASSETTE2_DISPENSED', label: 'Cassette 2 ($50)', value: '210', confidence: 0.86, box: { x1: 10, y1: 61.5, x2: 90, y2: 64 }, status: 'auto', category: 'cassette' },
      { id: 'f34', key: 'REJECTED_NOTES', label: 'Rejected Notes', value: '3', confidence: 0.82, box: { x1: 10, y1: 72, x2: 90, y2: 74.5 }, status: 'auto', category: 'cassette' },
      { id: 'f35', key: 'CARDS_CAPTURED', label: 'Cards Captured', value: '1', confidence: 0.85, box: { x1: 10, y1: 75, x2: 90, y2: 77.5 }, status: 'auto', category: 'cassette' },
      { id: 'f36', key: 'LAST_CLEARED', label: 'Last Cleared Date', value: '2026-07-27 16:00', confidence: 0.80, box: { x1: 10, y1: 78, x2: 90, y2: 80.5 }, status: 'auto', category: 'cassette' }
    ]
  }
];
