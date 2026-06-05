from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services.dates import parse_month_range

router = APIRouter()


@router.get("/summary", response_model=schemas.DashboardSummary)
def get_summary(
    month: str = Query(..., description="YYYY-MM format"),
    db: Session = Depends(get_db),
):
    start, end = parse_month_range(month)

    cards = db.query(models.Card).order_by(models.Card.id).all()
    card_summaries = []
    total_spent = 0.0
    total_cashback = 0.0

    for card in cards:
        txns = (
            db.query(models.Transaction)
            .filter(
                models.Transaction.card_id == card.id,
                models.Transaction.transaction_date >= start,
                models.Transaction.transaction_date < end,
            )
            .all()
        )
        spent = sum(t.amount for t in txns)
        cb = sum(t.cashback or 0 for t in txns)

        cap_pct = None
        if card.monthly_cap and card.monthly_cap > 0:
            cap_pct = round(cb / card.monthly_cap * 100, 1)

        card_summaries.append(
            schemas.CardSummary(
                card_id=card.id,
                card_name=card.card_name,
                bank_name=card.bank_name,
                total_spent=spent,
                total_cashback=cb,
                monthly_cap=card.monthly_cap,
                cap_usage_pct=cap_pct,
            )
        )
        total_spent += spent
        total_cashback += cb

    return schemas.DashboardSummary(
        month=month,
        total_spent=total_spent,
        total_cashback=total_cashback,
        cards=card_summaries,
    )
