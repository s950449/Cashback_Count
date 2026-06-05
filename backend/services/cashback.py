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


def get_calendar_month_range(ref_date: date) -> tuple[date, date]:
    start = ref_date.replace(day=1)
    end = start + relativedelta(months=1) - relativedelta(days=1)
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


def _get_reward_rule_cycle_range(card: models.Card, rule: models.RewardRule, ref_date: date) -> tuple[date, date]:
    if rule.cycle_type == "calendar_month":
        return get_calendar_month_range(ref_date)
    return get_billing_cycle_range(card.billing_day, ref_date)


def _is_reward_rule_active_on(rule: models.RewardRule, txn_date: date) -> bool:
    if not rule.is_active:
        return False
    if rule.start_date is not None and txn_date < rule.start_date:
        return False
    if rule.end_date is not None and txn_date > rule.end_date:
        return False
    return True


def _calc_reward_rule_raw(rule: models.RewardRule, amount: float, spent_so_far: float = 0) -> float:
    if rule.cashback_type == "fixed":
        return _calc_fixed_cashback(amount, rule.fixed_rate or 0)
    return _calc_tiered_cashback(amount, rule.tiers, spent_so_far)


def _get_reward_rule_recalc_range(
    db: Session, card: models.Card, rules: list[models.RewardRule], ref_date: date
) -> tuple[date, date]:
    cycle_ranges = [
        _get_reward_rule_cycle_range(card, rule, ref_date)
        for rule in rules
        if _is_reward_rule_active_on(rule, ref_date)
    ]
    if not cycle_ranges:
        return get_billing_cycle_range(card.billing_day, ref_date)

    start = min(cycle_start for cycle_start, _ in cycle_ranges)
    end = max(cycle_end for _, cycle_end in cycle_ranges)

    while True:
        txns = (
            db.query(models.Transaction)
            .filter(
                models.Transaction.card_id == card.id,
                models.Transaction.transaction_date >= start,
                models.Transaction.transaction_date <= end,
            )
            .all()
        )
        expanded = False
        for txn in txns:
            for rule in rules:
                if not _is_reward_rule_active_on(rule, txn.transaction_date):
                    continue
                cycle_start, cycle_end = _get_reward_rule_cycle_range(card, rule, txn.transaction_date)
                if cycle_start < start:
                    start = cycle_start
                    expanded = True
                if cycle_end > end:
                    end = cycle_end
                    expanded = True
        if not expanded:
            return start, end


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


def recalculate_reward_rules(db: Session, card: models.Card, ref_date: date) -> None:
    """Recalculate cashback by summing each reward rule after its own cycle, cap, and rounding."""
    rules = sorted(card.reward_rules, key=lambda rule: rule.id)
    if not rules:
        return

    start, end = _get_reward_rule_recalc_range(db, card, rules, ref_date)
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
    cashback_by_txn_id = {txn.id: 0.0 for txn in txns}

    for rule in rules:
        txns_by_cycle: dict[tuple[date, date], list[models.Transaction]] = {}
        for txn in txns:
            if not _is_reward_rule_active_on(rule, txn.transaction_date):
                continue
            cycle = _get_reward_rule_cycle_range(card, rule, txn.transaction_date)
            txns_by_cycle.setdefault(cycle, []).append(txn)

        for cycle_txns in txns_by_cycle.values():
            if rule.calc_method == "aggregate":
                total_amount = sum(txn.amount for txn in cycle_txns)
                if total_amount == 0:
                    continue

                raw_total = _calc_reward_rule_raw(rule, total_amount)
                raw_total = _apply_rounding(raw_total, rule.rounding_rule or "floor")
                if rule.monthly_cap is not None:
                    raw_total = min(raw_total, rule.monthly_cap)

                distributed = 0.0
                for index, txn in enumerate(cycle_txns):
                    if index == len(cycle_txns) - 1:
                        share = round(raw_total - distributed, 2)
                    else:
                        share = round(raw_total * (txn.amount / total_amount), 2)
                        distributed += share
                    cashback_by_txn_id[txn.id] += share
            else:
                spent_so_far = 0.0
                cashback_used = 0.0
                for txn in cycle_txns:
                    raw = _calc_reward_rule_raw(rule, txn.amount, spent_so_far)
                    raw = _apply_rounding(raw, rule.rounding_rule or "floor")
                    if rule.monthly_cap is not None and cashback_used + raw > rule.monthly_cap:
                        raw = max(0, rule.monthly_cap - cashback_used)

                    cashback_by_txn_id[txn.id] += raw
                    spent_so_far += txn.amount
                    cashback_used += raw

    for txn in txns:
        txn.cashback = round(cashback_by_txn_id[txn.id], 2)


def recalculate_cashback_cycle(db: Session, card: models.Card, ref_date: date) -> None:
    if card.reward_rules:
        recalculate_reward_rules(db, card, ref_date)
        return
    if card.calc_method == "aggregate":
        recalculate_aggregate(db, card, ref_date)
    else:
        recalculate_per_transaction(db, card, ref_date)
