from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .database import engine, Base
from .routers import cards, transactions, dashboard, export, category_budgets, reward_rules

Base.metadata.create_all(bind=engine)


def ensure_sqlite_schema():
    inspector = inspect(engine)
    if "transactions" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("transactions")}
    with engine.begin() as conn:
        if "merchant" not in existing_columns:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN merchant TEXT"))
        if "category" not in existing_columns:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN category TEXT"))
        if "payment_method" not in existing_columns:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN payment_method TEXT"))

    if "reward_rules" not in inspector.get_table_names():
        return

    existing_reward_rule_columns = {column["name"] for column in inspector.get_columns("reward_rules")}
    with engine.begin() as conn:
        if "payment_methods" not in existing_reward_rule_columns:
            conn.execute(text("ALTER TABLE reward_rules ADD COLUMN payment_methods JSON"))


ensure_sqlite_schema()

app = FastAPI(title="Cashback Count API", version="1.0.0")

STRICT_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
DOCS_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "img-src 'self' data: https://fastapi.tiangolo.com; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'none'; "
    "form-action 'none'"
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = (
        DOCS_CSP if request.url.path in {"/docs", "/redoc"} else STRICT_CSP
    )
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cards.router, prefix="/api/cards", tags=["cards"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(category_budgets.router, prefix="/api/category-budgets", tags=["category-budgets"])
app.include_router(reward_rules.router, prefix="/api/reward-rules", tags=["reward-rules"])


@app.get("/")
def root():
    return {"message": "Cashback Count API is running"}
