/**
 * Golden Standard Bank Templates for ATM Cassette Audit & Replenishment Receipts
 * Ultra-lightweight schema descriptions to save LLM tokens and reduce latency.
 */

// Ultra-lightweight schema descriptions to save LLM tokens and reduce latency
export const GOLDEN_TEMPLATES: Record<string, string> = {
  "Cassette Audit - MNC": "Format as JSON. Root keys: TYPE_1, TYPE_2, TYPE_3, TYPE_4. Each type maps sub-keys to: CASSETTE, REJECTED, REMAINING, DISPENSED, TOTAL. Include global keys: LAST_CLEARED_TIMESTAMP, CARDS_CAPTURED, ACTIVITY_COUNT.",
  
  "Cassette Audit - SMBC": "Format as JSON. Parse matrix header: CUR, DENO, CST, REJ, REM, DISP, TOTAL. Root keys: ROW_1, ROW_2, ROW_3, ROW_4. Each row contains sub-keys: CST, REJ, REM, DISP, TOTAL. Include global keys: INIT_AMOUNT, DISP_AMOUNT, REM_AMOUNT.",
  
  "Cassette Audit - BRI": "Format as JSON. Extract metadata: MACHINE, DATE, TIME. Table 1 (Print_Counters): parse rows DPC, RC2, RC3, RC4, RC5, RET with keys CUR, DENO, INIT, DISP, DEP, REM. Table 2 (Denom_Summary): parse rows 1, 2, 3 with keys DENOM, REM, +DPC, +RET, =TOTAL. Root financial summaries: INIT_AMOUNT, DISP_AMOUNT, DEP_AMOUNT, REM_AMOUNT, BILL_COUNT_LAST_CLEARED, RETAIN_CARD_COUNT.",
  
  "Cassette Audit - Permata": "Format as JSON. Extract header metadata: NO, TIME, DATE. Root matrix keys: TYPE_1, TYPE_2, TYPE_3, TYPE_4, where each contains sub-keys: CASSETTE, REJECTED, REMAINING, DISPENSED, TOTAL. Include footer global keys: LAST_CLEARED, CARDS_CAPTURED, ACTIVITY_COUNT.",
  
  "Cassette Audit - OCBC": "Format as JSON. Root matrix keys: TYPE_1, TYPE_2, TYPE_3, TYPE_4. Each type contains sub-keys: CASSETTE, REJECTED, REMAINING, DISPENSED, TOTAL. Include global footer key: CLEARED_TIMESTAMP.",

  "Cassette Audit - BCA": "Format as JSON. Root keys: TYPE_1, TYPE_2, TYPE_3, TYPE_4. Each type contains sub-keys: CASSETTE, REJECTED, REMAINING, DISPENSED, TOTAL. Include global keys: TOTAL_DISPENSED, TOTAL_REMAINING."
};

/**
 * Returns formatted golden template prompt string if available.
 */
export function getGoldenTemplatesPrompt(bankCodeOrCategory?: string): string {
  if (!bankCodeOrCategory) return "";
  
  if (GOLDEN_TEMPLATES[bankCodeOrCategory]) {
    return `STRICT SCHEMA RULE: ${GOLDEN_TEMPLATES[bankCodeOrCategory]}`;
  }

  // Fallback check by bank code substring
  const upper = bankCodeOrCategory.toUpperCase();
  for (const [key, val] of Object.entries(GOLDEN_TEMPLATES)) {
    if (upper.includes(key.replace("Cassette Audit - ", "").toUpperCase())) {
      return `STRICT SCHEMA RULE: ${val}`;
    }
  }

  return "";
}

