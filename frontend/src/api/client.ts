import axios from 'axios';
import type {
  Card,
  CardFormData,
  Transaction,
  TransactionFormData,
  TransactionImportResult,
  DashboardSummary,
  CategoryBudget,
  CategoryBudgetFormData,
  RewardRule,
  RewardRuleFormData,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api',
});

// --- Cards ---

export async function fetchCards(): Promise<Card[]> {
  const res = await api.get('/cards');
  return res.data;
}

export async function fetchCard(id: number): Promise<Card> {
  const res = await api.get(`/cards/${id}`);
  return res.data;
}

export async function createCard(data: CardFormData): Promise<Card> {
  const res = await api.post('/cards', data);
  return res.data;
}

export async function updateCard(id: number, data: CardFormData): Promise<Card> {
  const res = await api.put(`/cards/${id}`, data);
  return res.data;
}

export async function deleteCard(id: number): Promise<void> {
  await api.delete(`/cards/${id}`);
}

// --- Reward Rules ---

export async function fetchRewardRules(params?: { card_id?: number }): Promise<RewardRule[]> {
  const res = await api.get('/reward-rules', { params });
  return res.data;
}

export async function fetchRewardRule(id: number): Promise<RewardRule> {
  const res = await api.get(`/reward-rules/${id}`);
  return res.data;
}

export async function createRewardRule(data: RewardRuleFormData): Promise<RewardRule> {
  const res = await api.post('/reward-rules', data);
  return res.data;
}

export async function updateRewardRule(
  id: number,
  data: RewardRuleFormData
): Promise<RewardRule> {
  const res = await api.put(`/reward-rules/${id}`, data);
  return res.data;
}

export async function deleteRewardRule(id: number): Promise<void> {
  await api.delete(`/reward-rules/${id}`);
}

// --- Transactions ---

export async function fetchTransactions(params?: {
  card_id?: number;
  month?: string;
  merchant?: string;
  category?: string;
  payment_method?: string;
  min_amount?: number;
  max_amount?: number;
}): Promise<Transaction[]> {
  const res = await api.get('/transactions', { params });
  return res.data;
}

export async function createTransaction(data: TransactionFormData): Promise<Transaction> {
  const res = await api.post('/transactions', data);
  return res.data;
}

export async function updateTransaction(
  id: number,
  data: Partial<TransactionFormData>
): Promise<Transaction> {
  const res = await api.put(`/transactions/${id}`, data);
  return res.data;
}

export async function deleteTransaction(id: number): Promise<void> {
  await api.delete(`/transactions/${id}`);
}

export async function importTransactionsCsv(csvText: string): Promise<TransactionImportResult> {
  const res = await api.post('/transactions/import-csv', { csv_text: csvText });
  return res.data;
}

// --- Dashboard ---

export async function fetchDashboardSummary(month: string): Promise<DashboardSummary> {
  const res = await api.get('/dashboard/summary', { params: { month } });
  return res.data;
}

// --- Export ---

export async function exportToGoogleSheets(params: {
  month?: string;
  spreadsheet_name?: string;
}): Promise<{ status: string; url: string }> {
  const res = await api.post('/export/google-sheets', params);
  return res.data;
}

// --- Category Budgets ---

export async function fetchCategoryBudgets(): Promise<CategoryBudget[]> {
  const res = await api.get('/category-budgets');
  return res.data;
}

export async function createCategoryBudget(data: CategoryBudgetFormData): Promise<CategoryBudget> {
  const res = await api.post('/category-budgets', data);
  return res.data;
}

export async function updateCategoryBudget(
  id: number,
  data: CategoryBudgetFormData
): Promise<CategoryBudget> {
  const res = await api.put(`/category-budgets/${id}`, data);
  return res.data;
}

export async function deleteCategoryBudget(id: number): Promise<void> {
  await api.delete(`/category-budgets/${id}`);
}
