/**
 * Golden Standard Bank Templates for ATM Cassette Audit & Replenishment Receipts
 * Ultra-lightweight schema descriptions to save LLM tokens and reduce latency.
 */

// Ultra-lightweight schema descriptions to save LLM tokens and reduce latency
export const GOLDEN_TEMPLATES: Record<string, string> = {
  "Cassette Audit - MNC": "Format as JSON. Root keys: TYPE_1, TYPE_2, TYPE_3, TYPE_4. Each type contains sub-keys: CASSETTE, REJECTED, REMAINING, DISPENSED, TOTAL. Include global keys: LAST_CLEARED, ACTIVITY_COUNT.",
  "Cassette Audit - SMBC": "Format as JSON. Root keys based on denominations (e.g., IDR_100K, IDR_50K). Each contains sub-keys: INIT, DISP, DEP, REM. Include global keys: INIT_AMOUNT, DISP_AMOUNT, DEP_AMOUNT, REM_AMOUNT.",
  "Cassette Audit - BRI": "Format as JSON. Root keys based on denominations (e.g., IDR_100K, IDR_50K). Each contains sub-keys: INIT, DISP, DEP, REM. Include global keys: INIT_AMOUNT, DISP_AMOUNT, DEP_AMOUNT, REM_AMOUNT.",
  "Cassette Audit - Permata": "Format as JSON. Root keys: TYPE_1, TYPE_2, TYPE_3, TYPE_4. Each type contains sub-keys: CASSETTE, REJECTED, REMAINING, DISPENSED, TOTAL. Include global keys: LAST_CLEARED, ACTIVITY_COUNT.",
  "Cassette Audit - OCBC": "Format as JSON. Root keys: TYPE_1, TYPE_2, TYPE_3, TYPE_4. Each type contains sub-keys: CASSETTE, REJECTED, REMAINING, DISPENSED, TOTAL. Include global keys: CLEARED_DATE.",
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

