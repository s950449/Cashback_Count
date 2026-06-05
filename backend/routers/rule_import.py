from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from .. import models, schemas
from ..database import get_db
from ..services.rule_import import parse_reward_rule_draft

router = APIRouter()


def _get_card(db: Session, card_id: int) -> models.Card:
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


def _get_draft(db: Session, draft_id: int) -> models.RewardRuleDraft:
    draft = db.query(models.RewardRuleDraft).filter(models.RewardRuleDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Reward rule draft not found")
    return draft


@router.get("/reward-rule-drafts", response_model=list[schemas.RewardRuleDraftOut])
def list_reward_rule_drafts(
    card_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.RewardRuleDraft)
    if card_id is not None:
        query = query.filter(models.RewardRuleDraft.card_id == card_id)
    return query.order_by(models.RewardRuleDraft.card_id, models.RewardRuleDraft.id).all()


@router.post("/reward-rule-drafts", response_model=schemas.RewardRuleDraftOut, status_code=201)
def create_reward_rule_draft(
    import_in: schemas.RewardRuleDraftImportRequest,
    db: Session = Depends(get_db),
):
    _get_card(db, import_in.card_id)
    normalized_text, payload = parse_reward_rule_draft(import_in.source_text)
    draft = models.RewardRuleDraft(
        card_id=import_in.card_id,
        source_text=normalized_text,
        parsed_payload=payload,
        status="draft",
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


@router.delete("/reward-rule-drafts/{draft_id}", status_code=204)
def delete_reward_rule_draft(draft_id: int, db: Session = Depends(get_db)):
    draft = _get_draft(db, draft_id)
    db.delete(draft)
    db.commit()
