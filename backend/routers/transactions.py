import csv
from datetime import date
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy.orm import Session
from typing import Optional

from .. import models, schemas
from ..database import get_db
from ..services.cashback import recalculate_cashback_cycle
from ..services.dates import parse_month_range

router = APIRouter()

REQUIRED_IMPORT_COLUMNS = {"card_id", "amount", "transaction_date", "note"}


def _parse_import_csv(csv_text: str) -> list[schemas.TransactionCreate]:
    reader = csv.DictReader(StringIO(csv_text))
    if reader.fieldnames is None:
        raise HTTPException(status_code=422, detail="CSV must include a header row")

    missing_columns = REQUIRED_IMPORT_COLUMNS - set(reader.fieldnames)
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise HTTPException(status_code=422, detail=f"CSV missing required columns: {missing}")

    parsed_rows = []
    for row_number, row in enumerate(reader, start=2):
        try:
            parsed_rows.append(
                schemas.TransactionCreate(
                    card_id=int((row.get("card_id") or "").strip()),
                    amount=float((row.get("amount") or "").strip()),
                    transaction_date=date.fromisoformat((row.get("transaction_date") or "").strip()),
                    note=(row.get("note") or "").strip() or None,
                    merchant=(row.get("merchant") or "").strip() or None,
                    category=(row.get("category") or "").strip() or None,
                )
            )
        except (ValueError, ValidationError) as exc:
            raise HTTPException(status_code=422, detail=f"Invalid CSV row {row_number}: {exc}") from exc

    if not parsed_rows:
        raise HTTPException(status_code=422, detail="CSV must include at least one transaction row")
    return parsed_rows


@router.get("", response_model=list[schemas.TransactionOut])
def list_transactions(
    card_id: Optional[int] = Query(None),
    month: Optional[str] = Query(None, description="YYYY-MM format"),
    merchant: Optional[str] = Query(None, min_length=1, max_length=120),
    category: Optional[str] = Query(None, min_length=1, max_length=120),
    min_amount: Optional[float] = Query(None, ge=0),
    max_amount: Optional[float] = Query(None, ge=0),
    db: Session = Depends(get_db),
):
    if min_amount is not None and max_amount is not None and min_amount > max_amount:
        raise HTTPException(status_code=422, detail="min_amount must be less than or equal to max_amount")

    query = db.query(models.Transaction)
    if card_id is not None:
        query = query.filter(models.Transaction.card_id == card_id)
    if month:
        start, end = parse_month_range(month)
        query = query.filter(
            models.Transaction.transaction_date >= start,
            models.Transaction.transaction_date < end,
        )
    if merchant:
        query = query.filter(models.Transaction.merchant.ilike(f"%{merchant.strip()}%"))
    if category:
        query = query.filter(models.Transaction.category == category.strip())
    if min_amount is not None:
        query = query.filter(models.Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(models.Transaction.amount <= max_amount)
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
        merchant=txn_in.merchant,
        category=txn_in.category,
        transaction_date=txn_in.transaction_date,
    )

    db.add(txn)
    db.flush()
    recalculate_cashback_cycle(db, card, txn.transaction_date)
    db.commit()
    db.refresh(txn)

    return txn


@router.post("/import-csv", response_model=schemas.TransactionImportCsvResult, status_code=201)
def import_transactions_csv(req: schemas.TransactionImportCsvRequest, db: Session = Depends(get_db)):
    rows = _parse_import_csv(req.csv_text)
    card_ids = {row.card_id for row in rows}
    cards = db.query(models.Card).filter(models.Card.id.in_(card_ids)).all()
    card_by_id = {card.id: card for card in cards}

    missing_card_ids = sorted(card_ids - set(card_by_id))
    if missing_card_ids:
        missing = ", ".join(str(card_id) for card_id in missing_card_ids)
        first_missing_row = next(index for index, row in enumerate(rows, start=2) if row.card_id in missing_card_ids)
        raise HTTPException(status_code=422, detail=f"Invalid CSV row {first_missing_row}: card_id not found ({missing})")

    transactions = [
        models.Transaction(
            card_id=row.card_id,
            amount=row.amount,
            note=row.note,
            merchant=row.merchant,
            category=row.category,
            transaction_date=row.transaction_date,
        )
        for row in rows
    ]
    db.add_all(transactions)
    db.flush()

    affected_cycles = {(row.card_id, row.transaction_date) for row in rows}
    for card_id, transaction_date in affected_cycles:
        recalculate_cashback_cycle(db, card_by_id[card_id], transaction_date)

    db.commit()
    for txn in transactions:
        db.refresh(txn)

    return schemas.TransactionImportCsvResult(imported_count=len(transactions), transactions=transactions)


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
    if txn_in.merchant is not None:
        txn.merchant = txn_in.merchant
    if txn_in.category is not None:
        txn.category = txn_in.category
    if txn_in.transaction_date is not None:
        txn.transaction_date = txn_in.transaction_date

    db.flush()
    recalculate_cashback_cycle(db, card, txn.transaction_date)
    if old_card_id != txn.card_id or old_date != txn.transaction_date:
        old_card = db.query(models.Card).filter(models.Card.id == old_card_id).first()
        if old_card:
            recalculate_cashback_cycle(db, old_card, old_date)
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

    if card:
        recalculate_cashback_cycle(db, card, txn_date)

    db.commit()
