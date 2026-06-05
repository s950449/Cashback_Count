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


def create_transaction(
    client,
    card_id,
    amount,
    transaction_date="2026-06-05",
    note="",
    merchant=None,
    category=None,
    payment_method=None,
):
    response = client.post(
        "/api/transactions",
        json={
            "card_id": card_id,
            "amount": amount,
            "note": note,
            "merchant": merchant,
            "category": category,
            "payment_method": payment_method,
            "transaction_date": transaction_date,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_reward_rule(client, card_id, **overrides):
    payload = {
        "card_id": card_id,
        "rule_name": "基本回饋",
        "reward_kind": "base",
        "cycle_type": "billing_cycle",
        "cashback_type": "fixed",
        "fixed_rate": 0.01,
        "monthly_cap": None,
        "calc_method": "per_transaction",
        "rounding_rule": "floor",
        "is_active": True,
        "start_date": None,
        "end_date": None,
        "payment_methods": None,
        "stacking_mode": "stackable",
        "exclusive_group": None,
        "merchant_keywords": None,
        "category_names": None,
        "tiers": [],
    }
    payload.update(overrides)
    response = client.post("/api/reward-rules", json=payload)
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


def test_transaction_filters_by_merchant_category_and_amount(client):
    card = create_card(client)
    cafe = create_transaction(
        client,
        card["id"],
        180,
        transaction_date="2026-06-01",
        merchant="Local Cafe",
        category="餐飲",
    )
    create_transaction(
        client,
        card["id"],
        80,
        transaction_date="2026-06-02",
        merchant="Coffee Cart",
        category="餐飲",
    )
    create_transaction(
        client,
        card["id"],
        500,
        transaction_date="2026-06-03",
        merchant="Book Store",
        category="娛樂",
    )

    response = client.get(
        "/api/transactions",
        params={
            "month": "2026-06",
            "merchant": "cafe",
            "category": "餐飲",
            "min_amount": 100,
            "max_amount": 200,
        },
    )

    assert response.status_code == 200, response.text
    assert [txn["id"] for txn in response.json()] == [cafe["id"]]


def test_transaction_filter_rejects_invalid_amount_range(client):
    response = client.get(
        "/api/transactions",
        params={"min_amount": 500, "max_amount": 100},
    )

    assert response.status_code == 422


def test_transaction_filters_by_payment_method(client):
    card = create_card(client)
    apple_pay = create_transaction(
        client,
        card["id"],
        300,
        transaction_date="2026-06-01",
        payment_method="Apple Pay",
    )
    create_transaction(
        client,
        card["id"],
        300,
        transaction_date="2026-06-02",
        payment_method="Line Pay",
    )

    response = client.get("/api/transactions", params={"payment_method": "Apple Pay"})

    assert response.status_code == 200, response.text
    assert [txn["id"] for txn in response.json()] == [apple_pay["id"]]


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


def test_reward_rule_crud_and_card_filter(client):
    card = create_card(client)
    other_card = create_card(client, card_name="Backup")

    created = client.post(
        "/api/reward-rules",
        json={
            "card_id": card["id"],
            "rule_name": "基本回饋",
            "reward_kind": "base",
            "cycle_type": "billing_cycle",
            "cashback_type": "tiered",
            "fixed_rate": None,
            "monthly_cap": 300,
            "calc_method": "aggregate",
            "rounding_rule": "floor",
            "is_active": True,
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "tiers": [
                {"min_amount": 0, "max_amount": 5000, "rate": 0.01},
                {"min_amount": 5000, "max_amount": None, "rate": 0.02},
            ],
        },
    )

    assert created.status_code == 201, created.text
    assert created.json()["rule_name"] == "基本回饋"
    assert created.json()["reward_kind"] == "base"
    assert len(created.json()["tiers"]) == 2

    hidden = client.post(
        "/api/reward-rules",
        json={
            "card_id": other_card["id"],
            "rule_name": "其他卡任務",
            "reward_kind": "mission_bonus",
            "cycle_type": "calendar_month",
            "cashback_type": "fixed",
            "fixed_rate": 0.01,
            "monthly_cap": None,
            "calc_method": "per_transaction",
            "rounding_rule": "round",
            "is_active": True,
            "tiers": [],
        },
    )
    assert hidden.status_code == 201, hidden.text

    listed = client.get("/api/reward-rules", params={"card_id": card["id"]})
    assert listed.status_code == 200, listed.text
    assert [rule["id"] for rule in listed.json()] == [created.json()["id"]]

    updated = client.put(
        f"/api/reward-rules/{created.json()['id']}",
        json={
            "card_id": card["id"],
            "rule_name": "活動加碼",
            "reward_kind": "campaign_bonus",
            "cycle_type": "calendar_month",
            "cashback_type": "fixed",
            "fixed_rate": 0.03,
            "monthly_cap": 100,
            "calc_method": "per_transaction",
            "rounding_rule": "round",
            "is_active": False,
            "start_date": None,
            "end_date": None,
            "tiers": [],
        },
    )

    assert updated.status_code == 200, updated.text
    assert updated.json()["rule_name"] == "活動加碼"
    assert updated.json()["is_active"] is False
    assert updated.json()["tiers"] == []

    deleted = client.delete(f"/api/reward-rules/{created.json()['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/reward-rules/{created.json()['id']}").status_code == 404


def test_reward_rule_rejects_missing_card(client):
    response = client.post(
        "/api/reward-rules",
        json={
            "card_id": 9999,
            "rule_name": "不存在卡片",
            "reward_kind": "base",
            "cycle_type": "billing_cycle",
            "cashback_type": "fixed",
            "fixed_rate": 0.01,
            "monthly_cap": None,
            "calc_method": "per_transaction",
            "rounding_rule": "floor",
            "is_active": True,
            "tiers": [],
        },
    )

    assert response.status_code == 404


def test_reward_rule_rejects_invalid_active_date_range(client):
    card = create_card(client)

    response = client.post(
        "/api/reward-rules",
        json={
            "card_id": card["id"],
            "rule_name": "錯誤日期",
            "reward_kind": "campaign_bonus",
            "cycle_type": "calendar_month",
            "cashback_type": "fixed",
            "fixed_rate": 0.01,
            "monthly_cap": None,
            "calc_method": "per_transaction",
            "rounding_rule": "floor",
            "is_active": True,
            "start_date": "2026-12-31",
            "end_date": "2026-01-01",
            "tiers": [],
        },
    )

    assert response.status_code == 422


def test_reward_rules_round_each_rule_before_summing(client):
    card = create_card(client, fixed_rate=0.012)
    create_reward_rule(
        client,
        card["id"],
        rule_name="基本回饋",
        reward_kind="base",
        fixed_rate=0.006,
        rounding_rule="floor",
    )
    create_reward_rule(
        client,
        card["id"],
        rule_name="任務加碼",
        reward_kind="mission_bonus",
        fixed_rate=0.006,
        rounding_rule="floor",
    )

    txn = create_transaction(client, card["id"], 150)

    assert txn["cashback"] == 0


def test_reward_rules_use_separate_calendar_and_billing_cycles(client):
    card = create_card(client, billing_day=15, fixed_rate=0)
    create_reward_rule(
        client,
        card["id"],
        rule_name="基本回饋",
        reward_kind="base",
        cycle_type="billing_cycle",
        calc_method="aggregate",
        fixed_rate=0.01,
    )
    create_reward_rule(
        client,
        card["id"],
        rule_name="任務加碼",
        reward_kind="mission_bonus",
        cycle_type="calendar_month",
        calc_method="aggregate",
        fixed_rate=0.02,
        monthly_cap=30,
    )

    first = create_transaction(client, card["id"], 1000, transaction_date="2026-06-10")
    second = create_transaction(client, card["id"], 1000, transaction_date="2026-06-20")

    txns = client.get("/api/transactions", params={"month": "2026-06"}).json()
    cashback_by_id = {txn["id"]: txn["cashback"] for txn in txns}
    assert cashback_by_id[first["id"]] == 25
    assert cashback_by_id[second["id"]] == 25


def test_reward_rule_changes_recalculate_existing_transactions(client):
    card = create_card(client, fixed_rate=0)
    txn = create_transaction(client, card["id"], 1000)
    assert txn["cashback"] == 0

    rule = create_reward_rule(client, card["id"], fixed_rate=0.01)
    txns = client.get("/api/transactions", params={"card_id": card["id"]}).json()
    assert txns[0]["cashback"] == 10

    updated = client.put(
        f"/api/reward-rules/{rule['id']}",
        json={
            **rule,
            "fixed_rate": 0.02,
            "tiers": [],
        },
    )
    assert updated.status_code == 200, updated.text
    txns = client.get("/api/transactions", params={"card_id": card["id"]}).json()
    assert txns[0]["cashback"] == 20

    deleted = client.delete(f"/api/reward-rules/{rule['id']}")
    assert deleted.status_code == 204
    txns = client.get("/api/transactions", params={"card_id": card["id"]}).json()
    assert txns[0]["cashback"] == 0


def test_payment_method_reward_rule_only_applies_to_matching_transactions(client):
    card = create_card(client, fixed_rate=0)
    create_reward_rule(
        client,
        card["id"],
        rule_name="Apple Pay 加碼",
        reward_kind="campaign_bonus",
        fixed_rate=0.05,
        payment_methods=["Apple Pay"],
    )

    apple_pay = create_transaction(client, card["id"], 1000, payment_method="Apple Pay")
    line_pay = create_transaction(client, card["id"], 1000, payment_method="Line Pay")

    txns = client.get("/api/transactions", params={"card_id": card["id"]}).json()
    cashback_by_id = {txn["id"]: txn["cashback"] for txn in txns}
    assert cashback_by_id[apple_pay["id"]] == 50
    assert cashback_by_id[line_pay["id"]] == 0


def test_unrestricted_reward_rule_applies_when_payment_method_is_blank(client):
    card = create_card(client, fixed_rate=0)
    create_reward_rule(client, card["id"], fixed_rate=0.02, payment_methods=None)

    txn = create_transaction(client, card["id"], 500)

    assert txn["payment_method"] is None
    assert txn["cashback"] == 10


def test_import_transactions_csv_accepts_payment_method(client):
    card = create_card(client, fixed_rate=0)
    create_reward_rule(
        client,
        card["id"],
        fixed_rate=0.05,
        payment_methods=["臺灣Pay"],
    )

    response = client.post(
        "/api/transactions/import-csv",
        json={
            "csv_text": (
                "card_id,amount,transaction_date,note,payment_method\n"
                f"{card['id']},1000,2026-06-01,scan,臺灣Pay\n"
            )
        },
    )

    assert response.status_code == 201, response.text
    imported = response.json()["transactions"][0]
    assert imported["payment_method"] == "臺灣Pay"
    assert imported["cashback"] == 50


def test_exclusive_reward_rules_choose_best_bonus_in_group(client):
    card = create_card(client, fixed_rate=0)
    create_reward_rule(
        client,
        card["id"],
        rule_name="基本回饋",
        reward_kind="base",
        fixed_rate=0.01,
    )
    create_reward_rule(
        client,
        card["id"],
        rule_name="台鐵加碼",
        reward_kind="campaign_bonus",
        fixed_rate=0.04,
        stacking_mode="exclusive",
        exclusive_group="transport_bonus",
        merchant_keywords=["台鐵"],
    )
    create_reward_rule(
        client,
        card["id"],
        rule_name="Apple Pay 加碼",
        reward_kind="campaign_bonus",
        fixed_rate=0.02,
        stacking_mode="exclusive",
        exclusive_group="transport_bonus",
        payment_methods=["Apple Pay"],
    )

    txn = create_transaction(
        client,
        card["id"],
        1000,
        merchant="台鐵",
        payment_method="Apple Pay",
    )

    assert txn["cashback"] == 50


def test_exclusive_reward_groups_stack_with_each_other(client):
    card = create_card(client, fixed_rate=0)
    create_reward_rule(
        client,
        card["id"],
        rule_name="台鐵擇優加碼",
        reward_kind="campaign_bonus",
        fixed_rate=0.04,
        stacking_mode="exclusive",
        exclusive_group="transport_bonus",
        merchant_keywords=["台鐵"],
    )
    create_reward_rule(
        client,
        card["id"],
        rule_name="週末擇優加碼",
        reward_kind="campaign_bonus",
        fixed_rate=0.03,
        stacking_mode="exclusive",
        exclusive_group="weekend_bonus",
        payment_methods=["Apple Pay"],
    )

    txn = create_transaction(
        client,
        card["id"],
        1000,
        merchant="台鐵",
        payment_method="Apple Pay",
    )

    assert txn["cashback"] == 70


def test_stackable_reward_rules_continue_to_add_together(client):
    card = create_card(client, fixed_rate=0)
    create_reward_rule(client, card["id"], fixed_rate=0.01)
    create_reward_rule(
        client,
        card["id"],
        fixed_rate=0.02,
        payment_methods=["Apple Pay"],
    )
    create_reward_rule(
        client,
        card["id"],
        fixed_rate=0.03,
        merchant_keywords=["台鐵"],
    )

    txn = create_transaction(
        client,
        card["id"],
        1000,
        merchant="台鐵",
        payment_method="Apple Pay",
    )

    assert txn["cashback"] == 60


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


def test_import_reward_rule_draft_parses_payment_bonus_terms(client):
    card = create_card(client)

    response = client.post(
        "/api/rule-import/reward-rule-drafts",
        json={
            "card_id": card["id"],
            "source_text": (
                "Apple Pay 台鐵加碼4%，每月上限100元，日曆月計算。"
                "本活動與其他行動支付加碼擇優適用，不得併用。"
            ),
        },
    )

    assert response.status_code == 201, response.text
    draft = response.json()
    assert draft["card_id"] == card["id"]
    assert draft["status"] == "draft"
    assert draft["source_text"] == (
        "Apple Pay 台鐵加碼4%，每月上限100元，日曆月計算。"
        "本活動與其他行動支付加碼擇優適用，不得併用。"
    )
    assert draft["parsed_payload"]["payment_methods"] == ["Apple Pay"]
    assert draft["parsed_payload"]["fixed_rate"] == 0.04
    assert draft["parsed_payload"]["monthly_cap"] == 100
    assert draft["parsed_payload"]["cycle_type"] == "calendar_month"
    assert draft["parsed_payload"]["reward_kind"] == "campaign_bonus"
    assert draft["parsed_payload"]["stacking_mode"] == "exclusive"
    assert draft["parsed_payload"]["exclusive_group"] == "imported_bonus"
    assert draft["parsed_payload"]["merchant_keywords"] == ["台鐵"]
    assert draft["parsed_payload"]["warnings"] == []


def test_import_reward_rule_draft_strips_html_and_scripts(client):
    card = create_card(client)

    response = client.post(
        "/api/rule-import/reward-rule-drafts",
        json={
            "card_id": card["id"],
            "source_text": "<h1>Google Pay 加碼2%</h1><script>alert('x')</script><p>帳單月上限50元</p>",
        },
    )

    assert response.status_code == 201, response.text
    draft = response.json()
    assert "<" not in draft["source_text"]
    assert "script" not in draft["source_text"].lower()
    assert "alert" not in draft["source_text"].lower()
    assert draft["parsed_payload"]["payment_methods"] == ["Google Pay"]
    assert draft["parsed_payload"]["fixed_rate"] == 0.02
    assert draft["parsed_payload"]["monthly_cap"] == 50
    assert draft["parsed_payload"]["cycle_type"] == "billing_cycle"


def test_import_reward_rule_drafts_can_be_listed_and_deleted(client):
    card = create_card(client)
    other_card = create_card(client, card_name="Other")
    created = client.post(
        "/api/rule-import/reward-rule-drafts",
        json={"card_id": card["id"], "source_text": "Line Pay 加碼3%，每月上限30元"},
    ).json()
    client.post(
        "/api/rule-import/reward-rule-drafts",
        json={"card_id": other_card["id"], "source_text": "街口支付加碼1%"},
    )

    listed = client.get("/api/rule-import/reward-rule-drafts", params={"card_id": card["id"]})
    assert listed.status_code == 200, listed.text
    assert [draft["id"] for draft in listed.json()] == [created["id"]]

    deleted = client.delete(f"/api/rule-import/reward-rule-drafts/{created['id']}")
    assert deleted.status_code == 204
    assert client.get("/api/rule-import/reward-rule-drafts", params={"card_id": card["id"]}).json() == []
