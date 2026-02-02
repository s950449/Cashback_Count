from sqlalchemy import Column, Integer, Text, Float, DateTime, Date, ForeignKey
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


class CashbackTier(Base):
    __tablename__ = "cashback_tiers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    card_id = Column(Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    min_amount = Column(Float, nullable=False)
    max_amount = Column(Float)  # NULL = no upper limit
    rate = Column(Float, nullable=False)

    card = relationship("Card", back_populates="tiers")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    card_id = Column(Integer, ForeignKey("cards.id"), nullable=False)
    amount = Column(Float, nullable=False)
    cashback = Column(Float)
    note = Column(Text)
    transaction_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    card = relationship("Card", back_populates="transactions")
