import re
from datetime import date
from html import unescape
from html.parser import HTMLParser
from typing import Any

from ..schemas import PaymentMethod


PAYMENT_METHODS: list[PaymentMethod] = [
    "Apple Pay",
    "Google Pay",
    "臺灣行動支付",
    "臺灣Pay",
    "Line Pay",
    "街口支付",
    "iCash Pay",
    "iPass Money",
    "全支付",
    "悠遊付",
    "其他",
]

MERCHANT_KEYWORDS = ["台鐵", "臺鐵", "高鐵", "台灣高鐵", "蝦皮", "momo", "PChome"]
CATEGORY_KEYWORDS = ["交通", "餐飲", "旅遊", "網購", "超商", "量販", "百貨", "外送"]


class PlainTextHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self.skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in {"script", "style"}:
            self.skip_depth += 1
            return
        if tag.lower() in {"br", "p", "div", "li", "tr", "h1", "h2", "h3"}:
            self.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style"} and self.skip_depth:
            self.skip_depth -= 1
            return
        if tag.lower() in {"p", "div", "li", "tr", "h1", "h2", "h3"}:
            self.parts.append(" ")

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            self.parts.append(data)


def normalize_source_text(source_text: str) -> str:
    parser = PlainTextHTMLParser()
    parser.feed(source_text)
    text = unescape(" ".join(parser.parts) if parser.parts else source_text)
    return re.sub(r"\s+", " ", text).strip()


def parse_reward_rule_draft(source_text: str) -> tuple[str, dict[str, Any]]:
    text = normalize_source_text(source_text)
    warnings: list[str] = []
    fixed_rate = _parse_rate(text)
    monthly_cap = _parse_monthly_cap(text)
    payment_methods = _parse_payment_methods(text)
    merchant_keywords = _parse_keywords(text, MERCHANT_KEYWORDS)
    category_names = _parse_keywords(text, CATEGORY_KEYWORDS)
    start_date, end_date = _parse_date_range(text)
    stacking_mode = "exclusive" if _mentions_exclusive(text) else "stackable"

    if fixed_rate is None:
        warnings.append("未偵測到百分比回饋，請手動確認回饋率。")
    if not payment_methods:
        warnings.append("未偵測到特定支付工具，草稿將預設不限支付工具。")

    payload = {
        "rule_name": _build_rule_name(text),
        "reward_kind": "campaign_bonus" if _mentions_bonus(text) else "other_bonus",
        "cycle_type": "billing_cycle" if _mentions_billing_cycle(text) else "calendar_month",
        "cashback_type": "fixed",
        "fixed_rate": fixed_rate,
        "monthly_cap": monthly_cap,
        "calc_method": "per_transaction",
        "rounding_rule": "floor",
        "is_active": True,
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat() if end_date else None,
        "payment_methods": payment_methods or None,
        "stacking_mode": stacking_mode,
        "exclusive_group": "imported_bonus" if stacking_mode == "exclusive" else None,
        "merchant_keywords": merchant_keywords or None,
        "category_names": category_names or None,
        "warnings": warnings,
    }
    return text, payload


def _parse_rate(text: str) -> float | None:
    rates = [float(match.group(1)) for match in re.finditer(r"(\d+(?:\.\d+)?)\s*%", text)]
    if not rates:
        return None
    return round(max(rates) / 100, 6)


def _parse_monthly_cap(text: str) -> float | None:
    match = re.search(r"上限\s*(?:NT\$?|新臺幣|新台幣)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*元?", text, re.I)
    if not match:
        return None
    return float(match.group(1).replace(",", ""))


def _parse_payment_methods(text: str) -> list[PaymentMethod]:
    return [method for method in PAYMENT_METHODS if method != "其他" and method.lower() in text.lower()]


def _parse_keywords(text: str, candidates: list[str]) -> list[str]:
    found: list[str] = []
    for candidate in candidates:
        if candidate.lower() in text.lower():
            normalized = "台鐵" if candidate == "臺鐵" else candidate
            if normalized not in found:
                found.append(normalized)
    return found


def _parse_date_range(text: str) -> tuple[date | None, date | None]:
    dates: list[date] = []
    for match in re.finditer(r"(20\d{2})[/-](\d{1,2})[/-](\d{1,2})", text):
        try:
            dates.append(date(int(match.group(1)), int(match.group(2)), int(match.group(3))))
        except ValueError:
            continue
    if len(dates) >= 2:
        return min(dates[0], dates[1]), max(dates[0], dates[1])
    if len(dates) == 1:
        return dates[0], None
    return None, None


def _mentions_exclusive(text: str) -> bool:
    return any(term in text for term in ["擇優", "擇一", "不得併用", "不併用", "不可併用"])


def _mentions_billing_cycle(text: str) -> bool:
    return any(term in text for term in ["帳單月", "帳單週期", "帳單周期", "結帳"])


def _mentions_bonus(text: str) -> bool:
    return any(term in text for term in ["加碼", "活動", "回饋"])


def _build_rule_name(text: str) -> str:
    first_sentence = re.split(r"[。.!！?\n]", text, maxsplit=1)[0].strip()
    return (first_sentence or "匯入規則草稿")[:120]
