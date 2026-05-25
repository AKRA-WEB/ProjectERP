export interface ExportRow {
  entry_number: string;
  entry_date: string;
  entry_description: string;
  entry_type: string;
  debit_amount: number;
  credit_amount: number;
  line_description: string | null;
  account_code: string;
  account_name_th: string;
  account_name_en: string;
}
