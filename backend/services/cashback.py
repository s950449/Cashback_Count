import math
from sqlalchemy.orm import Session
from .. import models
from datetime import date
from dateutil.relativedelta import relativedelta


def get_billing_cycle_range(billing_day: int | None, ref_date: date) -> tuple[date, date]:
    """Get the start and end dates of the billing cycle containing ref_date."""
    if billing_day is None:
        billing_day = 1

    # Billing cycle: from billing_day of previous month to billing_day-1 of current month
    # If ref_date.day >= billing_day, cycle is [billing_day this month, billing_day next month - 1]
    # If ref_date.day < billing_day, cycle is [billing_day last month, billing_day this month - 1]
    if ref_date.day >= billing_day:
        start = ref_date.replace(day=billing_day)
        end_month = ref_date + relativedelta(months=1)
        end = end_month.replace(day=billing_day) - relativedelta(days=1)
    else:
        start_month = ref_date - relativedelta(months=1)
        start = start_month.replace(day=billing_day)
        end = ref_date.replace(day=billing_day) - relativedelta(days=1)

    return start, end


def _apply_rounding(value: float, rounding_rule: str) -> float:
    if rounding_rule == "floor":
        return float(math.floor(value))
    else:  # "round"
        return float(round(value))


def _calc_fixed_cashback(amount: float, rate: float) -> float:
    return amount * rate


def _calc_tiered_cashback(amount: float, tiers: list[models.CashbackTier], spent_so_far: float = 0) -> float:
    """Calculate cashback using marginal/progressive tiers based on cumulative spending."""
    sorted_tiers = sorted(tiers, key=lambda t: t.min_amount)
    total_cashback = 0.0
    remaining = amount
    current_pos = spent_so_far

    for tier in sorted_tiers:
        if remaining <= 0:
            break

        tier_min = tier.min_amount
        tier_max = tier.max_amount if tier.max_amount is not None else float("inf")

        if current_pos >= tier_max:
            continue

        # How much room is left in this tier
        effective_start = max(current_pos, tier_min)
        room_in_tier = tier_max - effective_start

        applicable = min(remaining, room_in_tier)
        if applicable > 0:
            total_cashback += applicable * tier.rate
            remaining -= applicable
            current_pos += applicable

    return total_cashback


def get_monthly_cashback_used(db: Session, card: models.Card, ref_date: date, exclude_tx_id: int | None = None) -> float:
    """Sum of cashback already earned in the billing cycle."""
    start, end = get_billing_cycle_range(card.billing_day, ref_date)
    query = db.query(models.Transaction).filter(
        models.Transaction.card_id == card.id,
        models.Transaction.transaction_date >= start,
        models.Transaction.transaction_date <= end,
    )
    if exclude_tx_id:
        query = query.filter(models.Transaction.id != exclude_tx_id)
    txns = query.all()
    return sum(t.cashback or 0 for t in txns)


def get_monthly_spent_so_far(db: Session, card: models.Card, ref_date: date, exclude_tx_id: int | None = None) -> float:
    """Sum of amounts spent in the billing cycle before the current transaction."""
    start, end = get_billing_cycle_range(card.billing_day, ref_date)
    query = db.query(models.Transaction).filter(
        models.Transaction.card_id == card.id,
        models.Transaction.transaction_date >= start,
        models.Transaction.transaction_date <= end,
    )
    if exclude_tx_id:
        query = query.filter(models.Transaction.id != exclude_tx_id)
    txns = query.all()
    return sum(t.amount for t in txns)


def calculate_cashback_per_tx(
    db: Session, card: models.Card, amount: float, ref_date: date, exclude_tx_id: int | None = None
) -> float:
    """Calculate cashback for a single transaction in per_transaction mode."""
    if card.cashback_type == "fixed":
        raw = _calc_fixed_cashback(amount, card.fixed_rate or 0)
    else:
        spent_so_far = get_monthly_spent_so_far(db, card, ref_date, exclude_tx_id)
        raw = _calc_tiered_cashback(amount, card.tiers, spent_so_far)

    raw = _apply_rounding(raw, card.rounding_rule or "floor")

    if card.monthly_cap is not None:
        used = get_monthly_cashback_used(db, card, ref_date, exclude_tx_id)
        if used + raw > card.monthly_cap:
            raw = max(0, card.monthly_cap - used)

    return raw


def recalculate_per_transaction(db: Session, card: models.Card, ref_date: date) -> None:
    """Recalculate per-transaction cashback for a billing cycle in transaction order."""
    start, end = get_billing_cycle_range(card.billing_day, ref_date)
    txns = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.card_id == card.id,
            models.Transaction.transaction_date >= start,
            models.Transaction.transaction_date <= end,
        )
        .order_by(models.Transaction.transaction_date, models.Transaction.id)
        .all()
    )

    spent_so_far = 0.0
    cashback_used = 0.0
    for txn in txns:
        if card.cashback_type == "fixed":
            raw = _calc_fixed_cashback(txn.amount, card.fixed_rate or 0)
        else:
            raw = _calc_tiered_cashback(txn.amount, card.tiers, spent_so_far)

        raw = _apply_rounding(raw, card.rounding_rule or "floor")
        if card.monthly_cap is not None and cashback_used + raw > card.monthly_cap:
            raw = max(0, card.monthly_cap - cashback_used)

        txn.cashback = raw
        spent_so_far += txn.amount
        cashback_used += raw


def recalculate_aggregate(db: Session, card: models.Card, ref_date: date) -> None:
    """Recalculate all transaction cashbacks for the entire billing cycle in aggregate mode."""
    start, end = get_billing_cycle_range(card.billing_day, ref_date)
    txns = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.card_id == card.id,
            models.Transaction.transaction_date >= start,
            models.Transaction.transaction_date <= end,
        )
        .order_by(models.Transaction.transaction_date, models.Transaction.id)
        .all()
    )

    if not txns:
        return

    total_amount = sum(t.amount for t in txns)
    if total_amount == 0:
        for t in txns:
            t.cashback = 0
        return

    if card.cashback_type == "fixed":
        raw_total = _calc_fixed_cashback(total_amount, card.fixed_rate or 0)
    else:
        raw_total = _calc_tiered_cashback(total_amount, card.tiers)

    raw_total = _apply_rounding(raw_total, card.rounding_rule or "floor")

    if card.monthly_cap is not None:
        raw_total = min(raw_total, card.monthly_cap)

    # Distribute proportionally
    distributed = 0.0
    for i, t in enumerate(txns):
        if i == len(txns) - 1:
            t.cashback = round(raw_total - distributed, 2)
        else:
            share = round(raw_total * (t.amount / total_amount), 2)
            t.cashback = share
            distributed += share


def recalculate_cashback_cycle(db: Session, card: models.Card, ref_date: date) -> None:
    if card.calc_method == "aggregate":
        recalculate_aggregate(db, card, ref_date)
    else:
        recalculate_per_transaction(db, card, ref_date)
