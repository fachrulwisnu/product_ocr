/**
 * Golden Standard Bank Templates for ATM Cassette Audit & Replenishment Receipts
 * Provides immutable cheat-sheet schemas for MNC, Permata, OCBC, BRI, SMBC formats.
 */

export interface BankTemplateSchema {
  bankName: string;
  bankCode: 'MNC' | 'PERMATA' | 'OCBC' | 'BRI' | 'SMBC';
  description: string;
  schemaExample: Record<string, any>;
}

export const GOLDEN_BANK_TEMPLATES: Record<string, BankTemplateSchema> = {
  MNC: {
    bankName: "Bank MNC International",
    bankCode: "MNC",
    description: "Cassette Audit & Replenishment Matrix (TYPE 1-4)",
    schemaExample: {
      "MACHINE_ID": "MNC-ATM-0102",
      "LAST_CLEARED_DATE": "2026-07-28 10:15:00",
      "TYPE_1": { "CASSETTE": 1999, "REJECTED": 1, "REMAINING": 2000, "DISPENSED": 0, "TOTAL": 2000 },
      "TYPE_2": { "CASSETTE": 2000, "REJECTED": 0, "REMAINING": 2000, "DISPENSED": 0, "TOTAL": 2000 },
      "TYPE_3": { "CASSETTE": 1500, "REJECTED": 5, "REMAINING": 1495, "DISPENSED": 500, "TOTAL": 2000 },
      "TYPE_4": { "CASSETTE": 1000, "REJECTED": 2, "REMAINING": 998, "DISPENSED": 1000, "TOTAL": 2000 },
      "GRAND_TOTAL_REMAINING": 6493,
      "GRAND_TOTAL_DISPENSED": 1500
    }
  },
  PERMATA: {
    bankName: "Bank Permata",
    bankCode: "PERMATA",
    description: "Cassette Audit & Replenishment Matrix (TYPE 1-4)",
    schemaExample: {
      "MACHINE_ID": "PERMATA-ATM-4421",
      "LAST_CLEARED_DATE": "2026-07-28",
      "TYPE_1": { "CASSETTE": 2000, "REJECTED": 0, "REMAINING": 1850, "DISPENSED": 150, "TOTAL": 2000 },
      "TYPE_2": { "CASSETTE": 2000, "REJECTED": 2, "REMAINING": 1998, "DISPENSED": 0, "TOTAL": 2000 },
      "TYPE_3": { "CASSETTE": 2000, "REJECTED": 1, "REMAINING": 1200, "DISPENSED": 799, "TOTAL": 2000 },
      "TYPE_4": { "CASSETTE": 0, "REJECTED": 0, "REMAINING": 0, "DISPENSED": 0, "TOTAL": 0 },
      "TOTAL_DISPENSED": 949,
      "TOTAL_REMAINING": 5048
    }
  },
  OCBC: {
    bankName: "OCBC NISP",
    bankCode: "OCBC",
    description: "Cassette Audit & Cleared Matrix (TYPE 1-4)",
    schemaExample: {
      "ATM_ID": "OCBC-LA-902",
      "CLEAR_DATE": "28/07/2026 09:30",
      "TYPE_1": { "CASSETTE": 1990, "REJECTED": 10, "REMAINING": 1800, "DISPENSED": 190, "TOTAL": 2000 },
      "TYPE_2": { "CASSETTE": 2000, "REJECTED": 0, "REMAINING": 1500, "DISPENSED": 500, "TOTAL": 2000 },
      "TYPE_3": { "CASSETTE": 2000, "REJECTED": 0, "REMAINING": 2000, "DISPENSED": 0, "TOTAL": 2000 },
      "TYPE_4": { "CASSETTE": 2000, "REJECTED": 0, "REMAINING": 2000, "DISPENSED": 0, "TOTAL": 2000 }
    }
  },
  BRI: {
    bankName: "Bank Rakyat Indonesia (BRI)",
    bankCode: "BRI",
    description: "Denomination Audit Matrix (IDR 100K / 50K)",
    schemaExample: {
      "TERMINAL_ID": "BRI-ATM-7789",
      "TRANSACTION_DATE": "2026-07-28",
      "IDR_100K_RC1": { "INIT": 250, "DISP": 120, "DEP": 0, "REM": 130 },
      "IDR_100K_RC2": { "INIT": 250, "DISP": 200, "DEP": 0, "REM": 50 },
      "IDR_50K_RC3": { "INIT": 500, "DISP": 350, "DEP": 0, "REM": 150 },
      "IDR_50K_RC4": { "INIT": 500, "DISP": 400, "DEP": 0, "REM": 100 },
      "INIT_AMOUNT": 75000000,
      "DISP_AMOUNT": 49500000,
      "DEP_AMOUNT": 0,
      "REM_AMOUNT": 25500000
    }
  },
  SMBC: {
    bankName: "SMBC / BTPN",
    bankCode: "SMBC",
    description: "Denomination Replenishment & Audit Matrix",
    schemaExample: {
      "MACHINE_NO": "SMBC-ATM-301",
      "DATE_CLEARED": "2026-07-28 11:20",
      "IDR_100K": { "INIT": 2000, "DISP": 1850, "DEP": 0, "REM": 150 },
      "IDR_50K": { "INIT": 2000, "DISP": 1900, "DEP": 0, "REM": 100 },
      "INIT_AMOUNT": 300000000,
      "DISP_AMOUNT": 280000000,
      "DEP_AMOUNT": 0,
      "REM_AMOUNT": 20000000
    }
  }
};

/**
 * Returns formatted golden template instructions for insertion into the VLM prompt.
 */
export function getGoldenTemplatesPrompt(bankCode?: string): string {
  let prompt = `\nGOLDEN STANDARD BANK TEMPLATES (IMMUTABLE CHEAT SHEET SCHEMAS):\n`;
  prompt += `You are an expert OCR Data Engineer parsing Indonesian Cassette Audit receipts.\n`;
  prompt += `Your primary directive is to map the unstructured text into the exact nested JSON schema provided in the Golden Templates.\n`;
  prompt += `If the receipt is heavily folded or faded, use the Golden Template to infer the missing structural keys (e.g., if 'REMAINING' is unreadable but the number aligns with the 3rd row of TYPE_1, map it to TYPE_1.REMAINING).\n\n`;

  if (bankCode && GOLDEN_BANK_TEMPLATES[bankCode.toUpperCase()]) {
    const tpl = GOLDEN_BANK_TEMPLATES[bankCode.toUpperCase()];
    prompt += `Target Bank: ${tpl.bankName} (${tpl.bankCode})\nFormat Schema Requirement:\n${JSON.stringify(tpl.schemaExample, null, 2)}\n\n`;
  } else {
    prompt += `If this receipt belongs to one of our standard banks, strictly format your JSON output to match these exact template structures:\n\n`;
    prompt += `1. MNC / Permata / OCBC (Type 1-4 Matrix):\n${JSON.stringify({
      "TYPE_1": { "CASSETTE": 1999, "REJECTED": 1, "REMAINING": 2000, "DISPENSED": 0, "TOTAL": 2000 },
      "TYPE_2": { "CASSETTE": 2000, "REJECTED": 0, "REMAINING": 2000, "DISPENSED": 0, "TOTAL": 2000 },
      "TYPE_3": { "CASSETTE": 1500, "REJECTED": 5, "REMAINING": 1495, "DISPENSED": 500, "TOTAL": 2000 },
      "TYPE_4": { "CASSETTE": 1000, "REJECTED": 2, "REMAINING": 998, "DISPENSED": 1000, "TOTAL": 2000 }
    }, null, 2)}\n\n`;

    prompt += `2. BRI / SMBC (Denomination Matrix):\n${JSON.stringify({
      "IDR_100K_RC1": { "INIT": 250, "DISP": 200, "DEP": 0, "REM": 50 },
      "IDR_100K_RC2": { "INIT": 250, "DISP": 220, "DEP": 0, "REM": 30 },
      "IDR_50K_RC3": { "INIT": 500, "DISP": 350, "DEP": 0, "REM": 150 },
      "INIT_AMOUNT": 75000000,
      "DISP_AMOUNT": 49500000,
      "DEP_AMOUNT": 0,
      "REM_AMOUNT": 25500000
    }, null, 2)}\n\n`;
  }

  return prompt;
}
