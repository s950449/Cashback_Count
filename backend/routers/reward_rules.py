from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from .. import models, schemas
from ..database import get_db
from ..services.cashback import recalculate_cashback_cycle

router = APIRouter()


def _get_card(db: Session, card_id: int) -> models.Card:
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


def _get_reward_rule(db: Session, rule_id: int) -> models.RewardRule:
    rule = db.query(models.RewardRule).filter(models.RewardRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Reward rule not found")
    return rule


def _replace_tiers(rule: models.RewardRule, tiers: list[schemas.RewardRuleTierCreate]) -> None:
    rule.tiers.clear()
    for tier_in in tiers:
        rule.tiers.append(
            models.RewardRuleTier(
                min_amount=tier_in.min_amount,
                max_amount=tier_in.max_amount,
                rate=tier_in.rate,
            )
        )


def _recalculate_card_transactions(db: Session, card: models.Card) -> None:
    affected_dates = {
        row[0]
        for row in db.query(models.Transaction.transaction_date)
        .filter(models.Transaction.card_id == card.id)
        .distinct()
        .all()
    }
    db.expire(card, ["reward_rules"])
    for transaction_date in affected_dates:
        recalculate_cashback_cycle(db, card, transaction_date)


@router.get("", response_model=list[schemas.RewardRuleOut])
def list_reward_rules(
    card_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.RewardRule)
    if card_id is not None:
        query = query.filter(models.RewardRule.card_id == card_id)
    return query.order_by(models.RewardRule.card_id, models.RewardRule.id).all()


@router.post("", response_model=schemas.RewardRuleOut, status_code=201)
def create_reward_rule(rule_in: schemas.RewardRuleCreate, db: Session = Depends(get_db)):
    card = _get_card(db, rule_in.card_id)

    rule = models.RewardRule(
        card_id=rule_in.card_id,
        rule_name=rule_in.rule_name,
        reward_kind=rule_in.reward_kind,
        cycle_type=rule_in.cycle_type,
        cashback_type=rule_in.cashback_type,
        fixed_rate=rule_in.fixed_rate,
        monthly_cap=rule_in.monthly_cap,
        calc_method=rule_in.calc_method,
        rounding_rule=rule_in.rounding_rule,
        is_active=rule_in.is_active,
        start_date=rule_in.start_date,
        end_date=rule_in.end_date,
    )
    _replace_tiers(rule, rule_in.tiers)

    db.add(rule)
    db.flush()
    _recalculate_card_transactions(db, card)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/{rule_id}", response_model=schemas.RewardRuleOut)
def get_reward_rule(rule_id: int, db: Session = Depends(get_db)):
    return _get_reward_rule(db, rule_id)


@router.put("/{rule_id}", response_model=schemas.RewardRuleOut)
def update_reward_rule(rule_id: int, rule_in: schemas.RewardRuleUpdate, db: Session = Depends(get_db)):
    rule = _get_reward_rule(db, rule_id)
    old_card = rule.card
    new_card = _get_card(db, rule_in.card_id)

    rule.card_id = rule_in.card_id
    rule.rule_name = rule_in.rule_name
    rule.reward_kind = rule_in.reward_kind
    rule.cycle_type = rule_in.cycle_type
    rule.cashback_type = rule_in.cashback_type
    rule.fixed_rate = rule_in.fixed_rate
    rule.monthly_cap = rule_in.monthly_cap
    rule.calc_method = rule_in.calc_method
    rule.rounding_rule = rule_in.rounding_rule
    rule.is_active = rule_in.is_active
    rule.start_date = rule_in.start_date
    rule.end_date = rule_in.end_date
    _replace_tiers(rule, rule_in.tiers)

    db.flush()
    _recalculate_card_transactions(db, new_card)
    if old_card.id != new_card.id:
        _recalculate_card_transactions(db, old_card)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=204)
def delete_reward_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = _get_reward_rule(db, rule_id)
    card = rule.card
    db.delete(rule)
    db.flush()
    _recalculate_card_transactions(db, card)
    db.commit()
