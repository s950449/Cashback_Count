from sqlalchemy import Boolean, Column, Integer, Text, Float, DateTime, Date, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from .database import Base


class Card(Base):
    __tablename__ = "cards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    card_name = Column(Text, nullable=False)
    bank_name = Column(Text, nullable=False)
    billing_day = Column(Integer)
    cashback_type = Column(Text, default="fixed")  # "fixed" / "tiered"
    fixed_rate = Column(Float)
    monthly_cap = Column(Float)
    calc_method = Column(Text, default="per_transaction")  # "per_transaction" / "aggregate"
    rounding_rule = Column(Text, default="floor")  # "floor" / "round"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    tiers = relationship("CashbackTier", back_populates="card", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="card", cascade="all, delete-orphan")
    reward_rules = relationship("RewardRule", back_populates="card", cascade="all, delete-orphan")
    reward_rule_drafts = relationship("RewardRuleDraft", back_populates="card", cascade="all, delete-orphan")


class CashbackTier(Base):
    __tablename__ = "cashback_tiers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    card_id = Column(Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    min_amount = Column(Float, nullable=False)
    max_amount = Column(Float)  # NULL = no upper limit
    rate = Column(Float, nullable=False)

    card = relationship("Card", back_populates="tiers")


class RewardRule(Base):
    __tablename__ = "reward_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    card_id = Column(Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    rule_name = Column(Text, nullable=False)
    reward_kind = Column(Text, nullable=False)  # "base" / "mission_bonus" / "campaign_bonus" / "other_bonus"
    cycle_type = Column(Text, nullable=False)  # "billing_cycle" / "calendar_month"
    cashback_type = Column(Text, default="fixed")  # "fixed" / "tiered"
    fixed_rate = Column(Float)
    monthly_cap = Column(Float)
    calc_method = Column(Text, default="per_transaction")  # "per_transaction" / "aggregate"
    rounding_rule = Column(Text, default="floor")  # "floor" / "round"
    is_active = Column(Boolean, default=True)
    start_date = Column(Date)
    end_date = Column(Date)
    payment_methods = Column(JSON)
    stacking_mode = Column(Text, default="stackable")  # "stackable" / "exclusive"
    exclusive_group = Column(Text)
    merchant_keywords = Column(JSON)
    category_names = Column(JSON)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    card = relationship("Card", back_populates="reward_rules")
    tiers = relationship("RewardRuleTier", back_populates="reward_rule", cascade="all, delete-orphan")


class RewardRuleTier(Base):
    __tablename__ = "reward_rule_tiers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reward_rule_id = Column(Integer, ForeignKey("reward_rules.id", ondelete="CASCADE"), nullable=False)
    min_amount = Column(Float, nullable=False)
    max_amount = Column(Float)
    rate = Column(Float, nullable=False)

    reward_rule = relationship("RewardRule", back_populates="tiers")


class RewardRuleDraft(Base):
    __tablename__ = "reward_rule_drafts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    card_id = Column(Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    source_text = Column(Text, nullable=False)
    parsed_payload = Column(JSON, nullable=False)
    status = Column(Text, default="draft")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    card = relationship("Card", back_populates="reward_rule_drafts")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    card_id = Column(Integer, ForeignKey("cards.id"), nullable=False)
    amount = Column(Float, nullable=False)
    cashback = Column(Float)
    note = Column(Text)
    merchant = Column(Text)
    category = Column(Text)
    payment_method = Column(Text)
    transaction_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    card = relationship("Card", back_populates="transactions")


class CategoryBudget(Base):
    __tablename__ = "category_budgets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(Text, nullable=False)
    monthly_budget = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
