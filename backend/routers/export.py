from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..services.sheets import export_to_sheets

router = APIRouter()


@router.post("/google-sheets")
def export_google_sheets(req: schemas.ExportRequest, db: Session = Depends(get_db)):
    try:
        url = export_to_sheets(db, req)
        return {"status": "ok", "url": url}
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
