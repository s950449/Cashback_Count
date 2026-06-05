export interface CashbackTier {
  id?: number;
  card_id?: number;
  min_amount: number;
  max_amount: number | null;
  rate: number;
}

export type PaymentMethod =
  | 'Apple Pay'
  | 'Google Pay'
  | '臺灣行動支付'
  | '臺灣Pay'
  | 'Line Pay'
  | '街口支付'
  | 'iCash Pay'
  | 'iPass Money'
  | '全支付'
  | '悠遊付'
  | '其他';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Apple Pay',
  'Google Pay',
  '臺灣行動支付',
  '臺灣Pay',
  'Line Pay',
  '街口支付',
  'iCash Pay',
  'iPass Money',
  '全支付',
  '悠遊付',
  '其他',
];

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

export interface RewardRuleTier {
  id?: number;
  reward_rule_id?: number;
  min_amount: number;
  max_amount: number | null;
  rate: number;
}

export interface RewardRule {
  id: number;
  card_id: number;
  rule_name: string;
  reward_kind: 'base' | 'mission_bonus' | 'campaign_bonus' | 'other_bonus';
  cycle_type: 'billing_cycle' | 'calendar_month';
  cashback_type: 'fixed' | 'tiered';
  fixed_rate: number | null;
  monthly_cap: number | null;
  calc_method: 'per_transaction' | 'aggregate';
  rounding_rule: 'floor' | 'round';
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  payment_methods: PaymentMethod[] | null;
  stacking_mode: 'stackable' | 'exclusive';
  exclusive_group: string | null;
  merchant_keywords: string[] | null;
  category_names: string[] | null;
  tiers: RewardRuleTier[];
  created_at: string | null;
}

export interface RewardRuleFormData {
  card_id: number;
  rule_name: string;
  reward_kind: 'base' | 'mission_bonus' | 'campaign_bonus' | 'other_bonus';
  cycle_type: 'billing_cycle' | 'calendar_month';
  cashback_type: 'fixed' | 'tiered';
  fixed_rate: number | null;
  monthly_cap: number | null;
  calc_method: 'per_transaction' | 'aggregate';
  rounding_rule: 'floor' | 'round';
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  payment_methods: PaymentMethod[] | null;
  stacking_mode: 'stackable' | 'exclusive';
  exclusive_group: string | null;
  merchant_keywords: string[] | null;
  category_names: string[] | null;
  tiers: Omit<RewardRuleTier, 'id' | 'reward_rule_id'>[];
}

export interface Transaction {
  id: number;
  card_id: number;
  amount: number;
  cashback: number | null;
  note: string | null;
  merchant: string | null;
  category: string | null;
  payment_method: PaymentMethod | null;
  transaction_date: string;
  created_at: string | null;
}

export interface TransactionFormData {
  card_id: number;
  amount: number;
  note: string;
  merchant: string;
  category: string;
  payment_method: PaymentMethod | null | '';
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

export interface CategorySummary {
  category: string;
  total_spent: number;
  total_cashback: number;
  transaction_count: number;
  cashback_rate: number;
  monthly_budget: number | null;
  budget_usage_pct: number | null;
}

export interface DashboardSummary {
  month: string;
  total_spent: number;
  total_cashback: number;
  cards: CardSummary[];
  categories: CategorySummary[];
}

export interface CategoryBudget {
  id: number;
  category: string;
  monthly_budget: number;
  created_at: string | null;
}

export interface CategoryBudgetFormData {
  category: string;
  monthly_budget: number;
}
