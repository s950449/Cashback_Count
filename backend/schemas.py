from pydantic import BaseModel, Field, model_validator
from datetime import date, datetime
from typing import Literal, Optional


# --- CashbackTier ---

class CashbackTierBase(BaseModel):
    min_amount: float = Field(ge=0)
    max_amount: Optional[float] = Field(default=None, ge=0)
    rate: float = Field(ge=0)

    @model_validator(mode="after")
    def validate_amount_range(self):
        if self.max_amount is not None and self.max_amount <= self.min_amount:
            raise ValueError("max_amount must be greater than min_amount")
        return self


class CashbackTierCreate(CashbackTierBase):
    pass


class CashbackTierOut(CashbackTierBase):
    id: int
    card_id: int

    model_config = {"from_attributes": True}


# --- Card ---

class CardBase(BaseModel):
    card_name: str = Field(min_length=1, max_length=120)
    bank_name: str = Field(min_length=1, max_length=120)
    billing_day: Optional[int] = Field(default=None, ge=1, le=28)
    cashback_type: Literal["fixed", "tiered"] = "fixed"
    fixed_rate: Optional[float] = Field(default=None, ge=0)
    monthly_cap: Optional[float] = Field(default=None, ge=0)
    calc_method: Literal["per_transaction", "aggregate"] = "per_transaction"
    rounding_rule: Literal["floor", "round"] = "floor"


class CardCreate(CardBase):
    tiers: list[CashbackTierCreate] = []


class CardUpdate(CardBase):
    tiers: list[CashbackTierCreate] = []


class CardOut(CardBase):
    id: int
    tiers: list[CashbackTierOut] = []
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- RewardRule ---

class RewardRuleTierBase(BaseModel):
    min_amount: float = Field(ge=0)
    max_amount: Optional[float] = Field(default=None, ge=0)
    rate: float = Field(ge=0)

    @model_validator(mode="after")
    def validate_amount_range(self):
        if self.max_amount is not None and self.max_amount <= self.min_amount:
            raise ValueError("max_amount must be greater than min_amount")
        return self


class RewardRuleTierCreate(RewardRuleTierBase):
    pass


class RewardRuleTierOut(RewardRuleTierBase):
    id: int
    reward_rule_id: int

    model_config = {"from_attributes": True}


class RewardRuleBase(BaseModel):
    card_id: int
    rule_name: str = Field(min_length=1, max_length=120)
    reward_kind: Literal["base", "mission_bonus", "campaign_bonus", "other_bonus"] = "base"
    cycle_type: Literal["billing_cycle", "calendar_month"] = "billing_cycle"
    cashback_type: Literal["fixed", "tiered"] = "fixed"
    fixed_rate: Optional[float] = Field(default=None, ge=0)
    monthly_cap: Optional[float] = Field(default=None, ge=0)
    calc_method: Literal["per_transaction", "aggregate"] = "per_transaction"
    rounding_rule: Literal["floor", "round"] = "floor"
    is_active: bool = True
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @model_validator(mode="after")
    def validate_active_date_range(self):
        if self.start_date is not None and self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class RewardRuleCreate(RewardRuleBase):
    tiers: list[RewardRuleTierCreate] = []


class RewardRuleUpdate(RewardRuleBase):
    tiers: list[RewardRuleTierCreate] = []


class RewardRuleOut(RewardRuleBase):
    id: int
    tiers: list[RewardRuleTierOut] = []
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Transaction ---

class TransactionBase(BaseModel):
    card_id: int
    amount: float = Field(gt=0)
    note: Optional[str] = Field(default=None, max_length=500)
    merchant: Optional[str] = Field(default=None, max_length=120)
    category: Optional[str] = Field(default=None, max_length=120)
    transaction_date: date


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    card_id: Optional[int] = None
    amount: Optional[float] = Field(default=None, gt=0)
    note: Optional[str] = Field(default=None, max_length=500)
    merchant: Optional[str] = Field(default=None, max_length=120)
    category: Optional[str] = Field(default=None, max_length=120)
    transaction_date: Optional[date] = None


class TransactionOut(TransactionBase):
    id: int
    cashback: Optional[float] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TransactionImportCsvRequest(BaseModel):
    csv_text: str = Field(min_length=1, max_length=200_000)


class TransactionImportCsvResult(BaseModel):
    imported_count: int
    transactions: list[TransactionOut]


# --- Dashboard ---

class CardSummary(BaseModel):
    card_id: int
    card_name: str
    bank_name: str
    total_spent: float
    total_cashback: float
    monthly_cap: Optional[float] = None
    cap_usage_pct: Optional[float] = None


class CategorySummary(BaseModel):
    category: str
    total_spent: float
    total_cashback: float
    transaction_count: int
    cashback_rate: float
    monthly_budget: Optional[float] = None
    budget_usage_pct: Optional[float] = None


class DashboardSummary(BaseModel):
    month: str
    total_spent: float
    total_cashback: float
    cards: list[CardSummary]
    categories: list[CategorySummary]


# --- Category Budget ---

class CategoryBudgetBase(BaseModel):
    category: str = Field(min_length=1, max_length=120)
    monthly_budget: float = Field(gt=0)


class CategoryBudgetCreate(CategoryBudgetBase):
    pass


class CategoryBudgetUpdate(CategoryBudgetBase):
    pass


class CategoryBudgetOut(CategoryBudgetBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Export ---

class ExportRequest(BaseModel):
    month: Optional[str] = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")  # YYYY-MM format
    spreadsheet_name: Optional[str] = Field(default="Cashback Report", min_length=1, max_length=100)

    model_config = {"extra": "forbid"}
