from datetime import date
import re

from fastapi import HTTPException


MONTH_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def parse_month_range(month: str) -> tuple[date, date]:
    if not MONTH_PATTERN.match(month):
        raise HTTPException(status_code=422, detail="month must use YYYY-MM format")

    year_str, month_str = month.split("-")
    year = int(year_str)
    mon = int(month_str)

    start = date(year, mon, 1)
    if mon == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, mon + 1, 1)
    return start, end
