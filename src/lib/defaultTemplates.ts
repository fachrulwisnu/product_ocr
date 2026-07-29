export interface DocumentCategory {
  id: string;
  name: string;
  description: string;
  created_at?: string;
}

export interface ReceiptTemplate {
  id: string;
  category_id: string;
  template_name: string;
  schema_rule: string;
  keywords: string[];
  created_at?: string;
}

export const DEFAULT_DOCUMENT_CATEGORIES: DocumentCategory[] = [
  { id: 'cat-1', name: 'Cassette Audit & Cleared', description: 'ATM Cassette Audit & Replenishment Reports' },
  { id: 'cat-2', name: 'Bank BCA', description: 'BCA ATM Transaction receipts' },
  { id: 'cat-3', name: 'CIMB Niaga', description: 'CIMB Niaga ATM receipts & cassette audit forms' },
  { id: 'cat-4', name: 'Bank BRI', description: 'BRI Cash Withdrawal & Deposit receipts' }
];

export const DEFAULT_RECEIPT_TEMPLATES: ReceiptTemplate[] = [
  {
    id: 'tmpl-1',
    category_id: 'cat-1',
    template_name: 'Cassette Audit',
    keywords: ['REMAINING NOTES', 'WITHDRAW COUNTER', 'DEPOSIT COUNTER', 'STORED REJECT', 'CASSETTE', 'REMAINING', 'COUNTER'],
    schema_rule: 'Format as JSON with keys: BANK_NAME, ATM_ID, CASSETTE_1_DISPENSED, CASSETTE_2_DISPENSED, TOTAL_AUDIT_BALANCE, AUDIT_DATE, AUDIT_TIME, OPERATOR_ID, REMAINING_NOTES, WITHDRAW_COUNTER, DEPOSIT_COUNTER, STORED_REJECT.'
  },
  {
    id: 'tmpl-2',
    category_id: 'cat-2',
    template_name: 'BCA ATM Withdrawal',
    keywords: ['BCA', 'TARIK', 'SALDO', 'SETOR'],
    schema_rule: 'Format as JSON with keys: BANK_NAME, ATM_LOCATION, TRANSACTION_TYPE, AMOUNT, ACCOUNT_NUMBER, REMAINING_BALANCE, TRACE_NUMBER, TRANSACTION_DATE.'
  },
  {
    id: 'tmpl-3',
    category_id: 'cat-3',
    template_name: 'CIMB Cassette Audit',
    keywords: ['CIMB', 'CASSETTE'],
    schema_rule: 'Format as JSON with keys: BANK_NAME, ATM_ID, CASSETTE_1_DISPENSED, CASSETTE_2_DISPENSED, TOTAL_AUDIT_BALANCE, AUDIT_DATE, AUDIT_TIME, OPERATOR_ID.'
  }
];
