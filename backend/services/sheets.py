import os
from sqlalchemy.orm import Session

from .. import models, schemas
from .dates import parse_month_range


def export_to_sheets(db: Session, req: schemas.ExportRequest) -> str:
    """Export transaction data to Google Sheets. Returns the spreadsheet URL."""
    import gspread
    from google.oauth2.service_account import Credentials

    creds_path = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if not creds_path or not os.path.exists(creds_path):
        raise FileNotFoundError(
            "Google service account credentials JSON not found. "
            "Set GOOGLE_CREDENTIALS_JSON env var."
        )

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    credentials = Credentials.from_service_account_file(creds_path, scopes=scopes)
    gc = gspread.authorize(credentials)

    # Build query
    query = db.query(models.Transaction).join(models.Card)
    if req.month:
        start, end = parse_month_range(req.month)
        query = query.filter(
            models.Transaction.transaction_date >= start,
            models.Transaction.transaction_date < end,
        )

    txns = query.order_by(models.Transaction.transaction_date).all()

    # Create or open spreadsheet
    spreadsheet_name = req.spreadsheet_name or "Cashback Report"
    try:
        sh = gc.open(spreadsheet_name)
    except gspread.SpreadsheetNotFound:
        sh = gc.create(spreadsheet_name)

    worksheet_title = req.month or "All"
    try:
        ws = sh.worksheet(worksheet_title)
        ws.clear()
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title=worksheet_title, rows=str(len(txns) + 10), cols="10")

    # Header
    headers = ["日期", "銀行", "卡片", "商店", "分類", "支付工具", "金額", "回饋", "備註"]
    rows = [headers]

    for t in txns:
        card = db.query(models.Card).filter(models.Card.id == t.card_id).first()
        rows.append([
            str(t.transaction_date),
            card.bank_name if card else "",
            card.card_name if card else "",
            t.merchant or "",
            t.category or "",
            t.payment_method or "",
            t.amount,
            t.cashback or 0,
            t.note or "",
        ])

    # Summary row
    total_amount = sum(t.amount for t in txns)
    total_cashback = sum(t.cashback or 0 for t in txns)
    rows.append([])
    rows.append(["合計", "", "", "", "", "", total_amount, total_cashback, ""])

    ws.update(range_name="A1", values=rows)

    return sh.url
