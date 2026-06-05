from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter()


def _normalize_category(category: str) -> str:
    normalized = category.strip()
    if not normalized:
        raise HTTPException(status_code=422, detail="Category is required")
    return normalized


@router.get("", response_model=list[schemas.CategoryBudgetOut])
def list_category_budgets(db: Session = Depends(get_db)):
    return db.query(models.CategoryBudget).order_by(models.CategoryBudget.category).all()


@router.post("", response_model=schemas.CategoryBudgetOut, status_code=201)
def create_category_budget(budget_in: schemas.CategoryBudgetCreate, db: Session = Depends(get_db)):
    category = _normalize_category(budget_in.category)
    existing = db.query(models.CategoryBudget).filter(models.CategoryBudget.category == category).first()
    if existing:
        raise HTTPException(status_code=409, detail="Category budget already exists")

    budget = models.CategoryBudget(category=category, monthly_budget=budget_in.monthly_budget)
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.put("/{budget_id}", response_model=schemas.CategoryBudgetOut)
def update_category_budget(
    budget_id: int,
    budget_in: schemas.CategoryBudgetUpdate,
    db: Session = Depends(get_db),
):
    budget = db.query(models.CategoryBudget).filter(models.CategoryBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Category budget not found")

    category = _normalize_category(budget_in.category)
    duplicate = (
        db.query(models.CategoryBudget)
        .filter(models.CategoryBudget.category == category, models.CategoryBudget.id != budget_id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Category budget already exists")

    budget.category = category
    budget.monthly_budget = budget_in.monthly_budget
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=204)
def delete_category_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = db.query(models.CategoryBudget).filter(models.CategoryBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Category budget not found")

    db.delete(budget)
    db.commit()
