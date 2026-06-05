export interface CashbackTier {
  id?: number;
  card_id?: number;
  min_amount: number;
  max_amount: number | null;
  rate: number;
}

export interface Card {
  id: number;
  card_name: string;
  bank_name: string;
  billing_day: number | null;
  cashback_type: 'fixed' | 'tiered';
  fixed_rate: number | null;
  monthly_cap: number | null;
  calc_method: 'per_transaction' | 'aggregate';
  rounding_rule: 'floor' | 'round';
  tiers: CashbackTier[];
  created_at: string | null;
}

export interface CardFormData {
  card_name: string;
  bank_name: string;
  billing_day: number | null;
  cashback_type: 'fixed' | 'tiered';
  fixed_rate: number | null;
  monthly_cap: number | null;
  calc_method: 'per_transaction' | 'aggregate';
  rounding_rule: 'floor' | 'round';
  tiers: Omit<CashbackTier, 'id' | 'card_id'>[];
}

export interface Transaction {
  id: number;
  card_id: number;
  amount: number;
  cashback: number | null;
  note: string | null;
  merchant: string | null;
  category: string | null;
  transaction_date: string;
  created_at: string | null;
}

export interface TransactionFormData {
  card_id: number;
  amount: number;
  note: string;
  merchant: string;
  category: string;
  transaction_date: string;
}

export interface TransactionImportResult {
  imported_count: number;
  transactions: Transaction[];
}

export interface CardSummary {
  card_id: number;
  card_name: string;
  bank_name: string;
  total_spent: number;
  total_cashback: number;
  monthly_cap: number | null;
  cap_usage_pct: number | null;
}

export interface DashboardSummary {
  month: string;
  total_spent: number;
  total_cashback: number;
  cards: CardSummary[];
}
