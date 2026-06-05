import axios from 'axios';
import type {
  Card,
  CardFormData,
  Transaction,
  TransactionFormData,
  DashboardSummary,
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

// --- Transactions ---

export async function fetchTransactions(params?: {
  card_id?: number;
  month?: string;
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
