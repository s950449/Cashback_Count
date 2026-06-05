import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.main import app
from backend.routers import export as export_router


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)


def create_card(client, **overrides):
    payload = {
        "card_name": "Rewards",
        "bank_name": "Bank",
        "billing_day": 1,
        "cashback_type": "fixed",
        "fixed_rate": 0.01,
        "monthly_cap": None,
        "calc_method": "per_transaction",
        "rounding_rule": "floor",
        "tiers": [],
    }
    payload.update(overrides)
    response = client.post("/api/cards", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def create_transaction(client, card_id, amount, transaction_date="2026-06-05"):
    response = client.post(
        "/api/transactions",
        json={
            "card_id": card_id,
            "amount": amount,
            "note": "",
            "transaction_date": transaction_date,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_updating_card_rules_recalculates_existing_transactions(client):
    card = create_card(client, fixed_rate=0.01)
    txn = create_transaction(client, card["id"], 1000)
    assert txn["cashback"] == 10

    response = client.put(
        f"/api/cards/{card['id']}",
        json={
            **card,
            "fixed_rate": 0.02,
            "tiers": [],
        },
    )

    assert response.status_code == 200, response.text
    txns = client.get("/api/transactions", params={"month": "2026-06"}).json()
    assert txns[0]["cashback"] == 20


def test_moving_transaction_from_aggregate_card_recalculates_old_card(client):
    old_card = create_card(client, card_name="Old", calc_method="aggregate", fixed_rate=0.015)
    new_card = create_card(client, card_name="New", calc_method="per_transaction", fixed_rate=0.01)
    moved_txn = create_transaction(client, old_card["id"], 1000)
    remaining_txn = create_transaction(client, old_card["id"], 1000)

    response = client.put(
        f"/api/transactions/{moved_txn['id']}",
        json={"card_id": new_card["id"]},
    )

    assert response.status_code == 200, response.text
    remaining = client.get("/api/transactions", params={"card_id": old_card["id"]}).json()
    assert remaining == [
        {
            **remaining[0],
            "id": remaining_txn["id"],
            "cashback": 15,
        }
    ]


@pytest.mark.parametrize(
    "payload",
    [
        {"billing_day": 0},
        {"billing_day": 29},
        {"cashback_type": "bogus"},
        {"calc_method": "bogus"},
        {"rounding_rule": "bogus"},
        {"fixed_rate": -0.01},
        {"monthly_cap": -1},
    ],
)
def test_card_validation_rejects_invalid_values(client, payload):
    response = client.post(
        "/api/cards",
        json={
            "card_name": "Rewards",
            "bank_name": "Bank",
            "billing_day": 1,
            "cashback_type": "fixed",
            "fixed_rate": 0.01,
            "monthly_cap": None,
            "calc_method": "per_transaction",
            "rounding_rule": "floor",
            "tiers": [],
            **payload,
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize("path", ["/api/transactions", "/api/dashboard/summary"])
def test_month_filter_validation_rejects_invalid_month(client, path):
    response = client.get(path, params={"month": "2026-99"})

    assert response.status_code == 422


def test_dashboard_summary_includes_category_breakdown(client):
    card = create_card(client, fixed_rate=0.02)
    create_transaction(client, card["id"], 1000, transaction_date="2026-06-01")
    client.put(
        "/api/transactions/1",
        json={"merchant": "Cafe", "category": "餐飲"},
    )
    create_transaction(client, card["id"], 500, transaction_date="2026-06-02")
    client.put(
        "/api/transactions/2",
        json={"merchant": "Bus", "category": "交通"},
    )
    create_transaction(client, card["id"], 200, transaction_date="2026-06-03")

    response = client.get("/api/dashboard/summary", params={"month": "2026-06"})

    assert response.status_code == 200, response.text
    assert response.json()["categories"] == [
        {
            "category": "餐飲",
            "total_spent": 1000,
            "total_cashback": 20,
            "transaction_count": 1,
            "cashback_rate": 0.02,
            "monthly_budget": None,
            "budget_usage_pct": None,
        },
        {
            "category": "交通",
            "total_spent": 500,
            "total_cashback": 10,
            "transaction_count": 1,
            "cashback_rate": 0.02,
            "monthly_budget": None,
            "budget_usage_pct": None,
        },
        {
            "category": "未分類",
            "total_spent": 200,
            "total_cashback": 4,
            "transaction_count": 1,
            "cashback_rate": 0.02,
            "monthly_budget": None,
            "budget_usage_pct": None,
        },
    ]


def test_category_budget_crud(client):
    created = client.post(
        "/api/category-budgets",
        json={"category": "餐飲", "monthly_budget": 8000},
    )

    assert created.status_code == 201, created.text
    assert created.json()["category"] == "餐飲"
    assert created.json()["monthly_budget"] == 8000

    listed = client.get("/api/category-budgets")
    assert listed.status_code == 200, listed.text
    assert listed.json() == [created.json()]

    updated = client.put(
        f"/api/category-budgets/{created.json()['id']}",
        json={"category": "餐飲", "monthly_budget": 9000},
    )

    assert updated.status_code == 200, updated.text
    assert updated.json()["monthly_budget"] == 9000

    deleted = client.delete(f"/api/category-budgets/{created.json()['id']}")
    assert deleted.status_code == 204
    assert client.get("/api/category-budgets").json() == []


def test_category_budget_rejects_duplicate_category(client):
    first = client.post(
        "/api/category-budgets",
        json={"category": "交通", "monthly_budget": 3000},
    )
    assert first.status_code == 201, first.text

    duplicate = client.post(
        "/api/category-budgets",
        json={"category": "交通", "monthly_budget": 4000},
    )

    assert duplicate.status_code == 409


def test_dashboard_summary_includes_category_budget_usage(client):
    card = create_card(client, fixed_rate=0.02)
    create_transaction(client, card["id"], 1000, transaction_date="2026-06-01")
    client.put("/api/transactions/1", json={"category": "餐飲"})
    budget = client.post(
        "/api/category-budgets",
        json={"category": "餐飲", "monthly_budget": 4000},
    )
    assert budget.status_code == 201, budget.text

    response = client.get("/api/dashboard/summary", params={"month": "2026-06"})

    assert response.status_code == 200, response.text
    category = response.json()["categories"][0]
    assert category["category"] == "餐飲"
    assert category["monthly_budget"] == 4000
    assert category["budget_usage_pct"] == 25.0


def test_export_rejects_request_supplied_credentials_path(client):
    response = client.post(
        "/api/export/google-sheets",
        json={"credentials_json": "/tmp/service-account.json"},
    )

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "credentials_json"]


def test_security_headers_are_present(client):
    response = client.get("/")

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["content-security-policy"] == (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    )
    assert response.headers["permissions-policy"] == "camera=(), microphone=(), geolocation=()"


def test_docs_security_headers_allow_swagger_assets(client):
    response = client.get("/docs")

    assert response.headers["x-frame-options"] == "DENY"
    assert "https://cdn.jsdelivr.net" in response.headers["content-security-policy"]
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def test_export_internal_errors_do_not_leak_details(client, monkeypatch):
    def raise_internal_error(db, req):
        raise RuntimeError("service account secret path leaked")

    monkeypatch.setattr(export_router, "export_to_sheets", raise_internal_error)

    response = client.post("/api/export/google-sheets", json={})

    assert response.status_code == 500
    assert response.json() == {"detail": "Export failed"}


@pytest.mark.parametrize(
    "payload",
    [
        {"card_name": ""},
        {"bank_name": ""},
        {"card_name": "x" * 121},
        {"bank_name": "x" * 121},
        {"tiers": [{"min_amount": 100, "max_amount": 50, "rate": 0.01}]},
        {"tiers": [{"min_amount": 0, "max_amount": None, "rate": -0.01}]},
    ],
)
def test_card_validation_rejects_unsafe_text_and_tiers(client, payload):
    response = client.post(
        "/api/cards",
        json={
            "card_name": "Rewards",
            "bank_name": "Bank",
            "billing_day": 1,
            "cashback_type": "fixed",
            "fixed_rate": 0.01,
            "monthly_cap": None,
            "calc_method": "per_transaction",
            "rounding_rule": "floor",
            "tiers": [],
            **payload,
        },
    )

    assert response.status_code == 422


def test_transaction_validation_rejects_oversized_note(client):
    card = create_card(client)

    response = client.post(
        "/api/transactions",
        json={
            "card_id": card["id"],
            "amount": 100,
            "note": "x" * 501,
            "transaction_date": "2026-06-05",
        },
    )

    assert response.status_code == 422


def test_transaction_create_and_update_preserve_merchant_and_category(client):
    card = create_card(client)

    created = client.post(
        "/api/transactions",
        json={
            "card_id": card["id"],
            "amount": 100,
            "note": "weekly groceries",
            "merchant": "PX Mart",
            "category": "grocery",
            "transaction_date": "2026-06-05",
        },
    )

    assert created.status_code == 201, created.text
    assert created.json()["merchant"] == "PX Mart"
    assert created.json()["category"] == "grocery"

    updated = client.put(
        f"/api/transactions/{created.json()['id']}",
        json={"merchant": "Carrefour", "category": "household"},
    )

    assert updated.status_code == 200, updated.text
    assert updated.json()["merchant"] == "Carrefour"
    assert updated.json()["category"] == "household"


def test_import_transactions_csv_creates_rows_and_recalculates_cashback(client):
    card = create_card(client, fixed_rate=0.02)

    response = client.post(
        "/api/transactions/import-csv",
        json={
            "csv_text": (
                "card_id,amount,transaction_date,note\n"
                f"{card['id']},1000,2026-06-01,早餐\n"
                f"{card['id']},500,2026-06-02,午餐\n"
            )
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["imported_count"] == 2
    txns = client.get("/api/transactions", params={"month": "2026-06"}).json()
    assert [txn["amount"] for txn in reversed(txns)] == [1000, 500]
    assert sum(txn["cashback"] for txn in txns) == 30


def test_import_transactions_csv_accepts_optional_merchant_and_category(client):
    card = create_card(client)

    response = client.post(
        "/api/transactions/import-csv",
        json={
            "csv_text": (
                "card_id,amount,transaction_date,note,merchant,category\n"
                f"{card['id']},120,2026-06-01,coffee,Local Cafe,food\n"
            )
        },
    )

    assert response.status_code == 201, response.text
    imported = response.json()["transactions"][0]
    assert imported["merchant"] == "Local Cafe"
    assert imported["category"] == "food"


def test_import_transactions_csv_rejects_missing_required_columns(client):
    response = client.post(
        "/api/transactions/import-csv",
        json={"csv_text": "card_id,amount,note\n1,100,missing date\n"},
    )

    assert response.status_code == 422
    assert "transaction_date" in response.json()["detail"]


def test_import_transactions_csv_is_all_or_nothing_when_card_missing(client):
    card = create_card(client)

    response = client.post(
        "/api/transactions/import-csv",
        json={
            "csv_text": (
                "card_id,amount,transaction_date,note\n"
                f"{card['id']},100,2026-06-01,valid row\n"
                "9999,200,2026-06-02,invalid card\n"
            )
        },
    )

    assert response.status_code == 422
    assert "row 3" in response.json()["detail"]
    assert client.get("/api/transactions", params={"month": "2026-06"}).json() == []
