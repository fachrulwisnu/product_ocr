/**
 * Golden Standard Bank Templates for ATM Cassette Audit & Replenishment Receipts
 * Ultra-lightweight schema descriptions to save LLM tokens and reduce latency.
 */

// Ultra-lightweight schema descriptions to save LLM tokens and reduce latency
export const GOLDEN_TEMPLATES: Record<string, string> = {
  "ATM_BILL_COUNTER": `
    You are a precise data extraction AI for ATM Replenishment receipts.
    Extract the Bill Counter (Cassette/Kaset) sheet values from the image text.
    
    STRICT JSON SCHEMA:
    {
      "documentType": "ATM_BILL_COUNTER",
      "bankCode": "String (Detect bank name like MNC, BCA, BRI, CIMB. Default: UNKNOWN)",
      "cassette1": Number (Integer value for Kaset/Cassette 1. E.g., 1998. If 0, output 0),
      "cassette2": Number (Integer value for Kaset/Cassette 2. Default to 0),
      "cassette3": Number (Integer value for Kaset/Cassette 3. Default to 0),
      "cassette4": Number (Integer value for Kaset/Cassette 4. Default to 0),
      "cassette5": Number (Integer value for Kaset/Cassette 5. Output null if missing or not present on receipt),
      "requiresReview": true
    }
    
    RULES:
    - Look for sections labeled "BILL COUNTER", "REMAINING", "CS1", "CS2", "DENOM", or "Kaset".
    - Do NOT output string values for cassettes. Use raw Integers (e.g., 2000, not "2000").
    - If a cassette is explicitly listed as 0, output 0.
    - If a cassette (like cassette5) is completely missing from the paper, output null.
    - Return ONLY valid JSON. No markdown wrappers.
  `,

  "Cassette Audit - MNC": "Format as JSON. Root keys: TYPE_1, TYPE_2, TYPE_3, TYPE_4. Each type maps sub-keys to: CASSETTE, REJECTED, REMAINING, DISPENSED, TOTAL. Include global keys: LAST_CLEARED_TIMESTAMP, CARDS_CAPTURED, ACTIVITY_COUNT.",
  
  "Cassette Audit - SMBC": "Format as JSON. Parse matrix header: CUR, DENO, CST, REJ, REM, DISP, TOTAL. Root keys: ROW_1, ROW_2, ROW_3, ROW_4. Each row contains sub-keys: CST, REJ, REM, DISP, TOTAL. Include global keys: INIT_AMOUNT, DISP_AMOUNT, REM_AMOUNT.",
  
  "Cassette Audit - BRI": "Format as JSON. Extract metadata: MACHINE, DATE, TIME. Table 1 (Print_Counters): parse rows DPC, RC2, RC3, RC4, RC5, RET with keys CUR, DENO, INIT, DISP, DEP, REM. Table 2 (Denom_Summary): parse rows 1, 2, 3 with keys DENOM, REM, +DPC, +RET, =TOTAL. Root financial summaries: INIT_AMOUNT, DISP_AMOUNT, DEP_AMOUNT, REM_AMOUNT, BILL_COUNT_LAST_CLEARED, RETAIN_CARD_COUNT.",
  
  "Cassette Audit - Permata": "Format as JSON. Extract header metadata: NO, TIME, DATE. Root matrix keys: TYPE_1, TYPE_2, TYPE_3, TYPE_4, where each contains sub-keys: CASSETTE, REJECTED, REMAINING, DISPENSED, TOTAL. Include footer global keys: LAST_CLEARED, CARDS_CAPTURED, ACTIVITY_COUNT.",
  
  "Cassette Audit - OCBC": "Format as JSON. Root matrix keys: TYPE_1, TYPE_2, TYPE_3, TYPE_4. Each type contains sub-keys: CASSETTE, REJECTED, REMAINING, DISPENSED, TOTAL. Include global footer key: CLEARED_TIMESTAMP.",

  "Cassette Audit - BCA": "Format as JSON. Root keys: TYPE_1, TYPE_2, TYPE_3, TYPE_4. Each type contains sub-keys: CASSETTE, REJECTED, REMAINING, DISPENSED, TOTAL. Include global keys: TOTAL_DISPENSED, TOTAL_REMAINING.",

  "KTP_INDONESIA": `
    You are a precise data extraction AI for Indonesian ID Cards (KTP - Kartu Tanda Penduduk).
    Extract the specific fields requested. Pay close attention to the top header for the city/regency.

    STRICT JSON SCHEMA:
    {
      "success": true,
      "documentType": "KTP",
      "nik": "String (16 digits)",
      "nama": "String (Full name)",
      "kotaAsal": "String (Extract the 'KOTA' or 'KABUPATEN' name located exactly below the PROVINSI at the very top of the card. E.g., 'KABUPATEN KEPULAUAN ANAMBAS')",
      "provinsi": "String (Topmost line, e.g., 'PROVINSI KEPULAUAN RIAU')",
      "tempatLahir": "String (City of birth, located before the comma in 'Tempat/Tgl Lahir')",
      "tanggalLahir": "String (Format: DD-MM-YYYY, located after the comma in 'Tempat/Tgl Lahir')",
      "jenisKelamin": "String (LAKI-LAKI or PEREMPUAN)",
      "alamatLengkap": "String (Combine Alamat, RT/RW, Kel/Desa, and Kecamatan into one string)"
    }

    RULES:
    - If a field is illegible, return null.
    - Do NOT output markdown wrappers (like \`\`\`json). Return raw valid JSON only.
  `,

  "SIM_INDONESIA": `
    You are a precise data extraction AI for Indonesian Driver's Licenses (SIM - Surat Izin Mengemudi).
    Extract the specific fields requested. Pay close attention to the stamps and regions for the issuing city.

    STRICT JSON SCHEMA:
    {
      "success": true,
      "documentType": "SIM",
      "jenisSim": "String (Look for the large letter at the top right, e.g., 'A', 'C', or 'B1')",
      "noSim": "String (Usually numbers with dashes, e.g., '1205-9202-58035' or listed under 'No. SIM')",
      "nama": "String (Full name)",
      "kotaAsalPenerbit": "String (The city where the SIM was issued. Look for the city name directly above the issue date at the bottom, e.g., 'JAKARTA', or the regional police name like 'METRO JAYA')",
      "tempatLahir": "String (City of birth, located before the comma in the birth date line, e.g., 'KUNINGAN')",
      "tanggalLahir": "String (Located after the comma in the birth date line)",
      "pekerjaan": "String (E.g., 'POLWAN', 'PENELITI')",
      "alamatLengkap": "String (Combine the full address lines)"
    }

    RULES:
    - Pay attention to older SIM formats (blue/white background) and newer Smart SIM formats (red/white header).
    - If a field is illegible, return null.
    - Do NOT output markdown wrappers (like \`\`\`json). Return raw valid JSON only.
  `
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

