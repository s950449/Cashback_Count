from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from .. import models, schemas
from ..database import get_db
from ..services.cashback import calculate_cashback_per_tx, recalculate_aggregate

router = APIRouter()


def _compute_and_set_cashback(db: Session, txn: models.Transaction, card: models.Card, exclude_tx_id: int | None = None):
    if card.calc_method == "per_transaction":
        txn.cashback = calculate_cashback_per_tx(db, card, txn.amount, txn.transaction_date, exclude_tx_id)
    # For aggregate, we commit first then recalculate all


@router.get("", response_model=list[schemas.TransactionOut])
def list_transactions(
    card_id: Optional[int] = Query(None),
    month: Optional[str] = Query(None, description="YYYY-MM format"),
    db: Session = Depends(get_db),
):
    query = db.query(models.Transaction)
    if card_id is not None:
        query = query.filter(models.Transaction.card_id == card_id)
    if month:
        # Filter by year-month of transaction_date
        year, mon = month.split("-")
        from datetime import date
        start = date(int(year), int(mon), 1)
        if int(mon) == 12:
            end = date(int(year) + 1, 1, 1)
        else:
            end = date(int(year), int(mon) + 1, 1)
        query = query.filter(
            models.Transaction.transaction_date >= start,
            models.Transaction.transaction_date < end,
        )
    return query.order_by(models.Transaction.transaction_date.desc(), models.Transaction.id.desc()).all()


@router.post("", response_model=schemas.TransactionOut, status_code=201)
def create_transaction(txn_in: schemas.TransactionCreate, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == txn_in.card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    txn = models.Transaction(
        card_id=txn_in.card_id,
        amount=txn_in.amount,
        note=txn_in.note,
        transaction_date=txn_in.transaction_date,
    )

    if card.calc_method == "per_transaction":
        _compute_and_set_cashback(db, txn, card)
        db.add(txn)
        db.commit()
        db.refresh(txn)
    else:
        # aggregate: add transaction first, then recalculate all
        db.add(txn)
        db.flush()
        recalculate_aggregate(db, card, txn.transaction_date)
        db.commit()
        db.refresh(txn)

    return txn


@router.put("/{txn_id}", response_model=schemas.TransactionOut)
def update_transaction(txn_id: int, txn_in: schemas.TransactionUpdate, db: Session = Depends(get_db)):
    txn = db.query(models.Transaction).filter(models.Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    card = db.query(models.Card).filter(models.Card.id == (txn_in.card_id or txn.card_id)).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    old_date = txn.transaction_date
    old_card_id = txn.card_id

    if txn_in.card_id is not None:
        txn.card_id = txn_in.card_id
    if txn_in.amount is not None:
        txn.amount = txn_in.amount
    if txn_in.note is not None:
        txn.note = txn_in.note
    if txn_in.transaction_date is not None:
        txn.transaction_date = txn_in.transaction_date

    if card.calc_method == "per_transaction":
        _compute_and_set_cashback(db, txn, card, exclude_tx_id=txn.id)
        db.commit()
        db.refresh(txn)
    else:
        db.flush()
        recalculate_aggregate(db, card, txn.transaction_date)
        # If card or date changed, also recalculate old cycle
        if old_card_id != txn.card_id or old_date != txn.transaction_date:
            old_card = db.query(models.Card).filter(models.Card.id == old_card_id).first()
            if old_card and old_card.calc_method == "aggregate":
                recalculate_aggregate(db, old_card, old_date)
        db.commit()
        db.refresh(txn)

    return txn


@router.delete("/{txn_id}", status_code=204)
def delete_transaction(txn_id: int, db: Session = Depends(get_db)):
    txn = db.query(models.Transaction).filter(models.Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    card = db.query(models.Card).filter(models.Card.id == txn.card_id).first()
    txn_date = txn.transaction_date

    db.delete(txn)
    db.flush()

    if card and card.calc_method == "aggregate":
        recalculate_aggregate(db, card, txn_date)

    db.commit()
