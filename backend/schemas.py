from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


# --- CashbackTier ---

class CashbackTierBase(BaseModel):
    min_amount: float
    max_amount: Optional[float] = None
    rate: float


class CashbackTierCreate(CashbackTierBase):
    pass


class CashbackTierOut(CashbackTierBase):
    id: int
    card_id: int

    model_config = {"from_attributes": True}


# --- Card ---

class CardBase(BaseModel):
    card_name: str
    bank_name: str
    billing_day: Optional[int] = None
    cashback_type: str = "fixed"
    fixed_rate: Optional[float] = None
    monthly_cap: Optional[float] = None
    calc_method: str = "per_transaction"
    rounding_rule: str = "floor"


class CardCreate(CardBase):
    tiers: list[CashbackTierCreate] = []


class CardUpdate(CardBase):
    tiers: list[CashbackTierCreate] = []


class CardOut(CardBase):
    id: int
    tiers: list[CashbackTierOut] = []
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Transaction ---

class TransactionBase(BaseModel):
    card_id: int
    amount: float
    note: Optional[str] = None
    transaction_date: date


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    card_id: Optional[int] = None
    amount: Optional[float] = None
    note: Optional[str] = None
    transaction_date: Optional[date] = None


class TransactionOut(TransactionBase):
    id: int
    cashback: Optional[float] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Dashboard ---

class CardSummary(BaseModel):
    card_id: int
    card_name: str
    bank_name: str
    total_spent: float
    total_cashback: float
    monthly_cap: Optional[float] = None
    cap_usage_pct: Optional[float] = None


class DashboardSummary(BaseModel):
    month: str
    total_spent: float
    total_cashback: float
    cards: list[CardSummary]


# --- Export ---

class ExportRequest(BaseModel):
    month: Optional[str] = None  # YYYY-MM format
    credentials_json: Optional[str] = None  # path to service account JSON
    spreadsheet_name: Optional[str] = "Cashback Report"
