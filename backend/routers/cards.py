from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services.cashback import recalculate_cashback_cycle

router = APIRouter()


@router.get("", response_model=list[schemas.CardOut])
def list_cards(db: Session = Depends(get_db)):
    return db.query(models.Card).order_by(models.Card.id).all()


@router.post("", response_model=schemas.CardOut, status_code=201)
def create_card(card_in: schemas.CardCreate, db: Session = Depends(get_db)):
    card = models.Card(
        card_name=card_in.card_name,
        bank_name=card_in.bank_name,
        billing_day=card_in.billing_day,
        cashback_type=card_in.cashback_type,
        fixed_rate=card_in.fixed_rate,
        monthly_cap=card_in.monthly_cap,
        calc_method=card_in.calc_method,
        rounding_rule=card_in.rounding_rule,
    )
    for tier_in in card_in.tiers:
        card.tiers.append(
            models.CashbackTier(
                min_amount=tier_in.min_amount,
                max_amount=tier_in.max_amount,
                rate=tier_in.rate,
            )
        )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


@router.get("/{card_id}", response_model=schemas.CardOut)
def get_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.put("/{card_id}", response_model=schemas.CardOut)
def update_card(card_id: int, card_in: schemas.CardUpdate, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    affected_dates = {txn.transaction_date for txn in card.transactions}

    card.card_name = card_in.card_name
    card.bank_name = card_in.bank_name
    card.billing_day = card_in.billing_day
    card.cashback_type = card_in.cashback_type
    card.fixed_rate = card_in.fixed_rate
    card.monthly_cap = card_in.monthly_cap
    card.calc_method = card_in.calc_method
    card.rounding_rule = card_in.rounding_rule

    # Replace tiers entirely
    card.tiers.clear()
    for tier_in in card_in.tiers:
        card.tiers.append(
            models.CashbackTier(
                min_amount=tier_in.min_amount,
                max_amount=tier_in.max_amount,
                rate=tier_in.rate,
            )
        )

    db.flush()
    for transaction_date in affected_dates:
        recalculate_cashback_cycle(db, card, transaction_date)

    db.commit()
    db.refresh(card)
    return card


@router.delete("/{card_id}", status_code=204)
def delete_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()
