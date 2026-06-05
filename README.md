# Cashback Count - 信用卡回饋追蹤系統

追蹤多張信用卡的消費記錄，自動計算回饋金額，掌握每月回饋進度。

## 功能特色

- 多卡管理：支援不同銀行、不同回饋規則的信用卡
- 自動計算回饋：固定回饋率 / 分級累進回饋（類似累進稅率）
- 四種計算模式：逐筆 or 合併 × 四捨五入 or 無條件捨去
- 月度上限追蹤：即時顯示回饋上限使用進度
- 儀表板：月度消費與回饋摘要、分類統計、分類預算追蹤、各卡明細
- Google Sheets 匯出

## Tech Stack

| 層級 | 技術 |
|------|------|
| Frontend | React + Vite + TypeScript |
| Backend | Python FastAPI |
| ORM | SQLAlchemy + SQLite |
| Export | gspread (Google Sheets API) |
| UI | 繁體中文介面 |

## 專案結構

```
Cashback_Count/
├── backend/
│   ├── main.py              # FastAPI app + CORS
│   ├── database.py          # SQLAlchemy engine + session
│   ├── models.py            # ORM models (Card, CashbackTier, RewardRule, Transaction)
│   ├── schemas.py           # Pydantic schemas
│   ├── routers/
│   │   ├── cards.py         # 卡片 CRUD
│   │   ├── transactions.py  # 消費記錄 CRUD + 自動回饋計算
│   │   ├── dashboard.py     # 月度摘要
│   │   └── export.py        # Google Sheets 匯出
│   ├── services/
│   │   ├── cashback.py      # 回饋計算引擎
│   │   └── sheets.py        # Google Sheets 匯出邏輯
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/client.ts           # axios API 呼叫
│   │   ├── types/index.ts          # TypeScript 型別定義
│   │   ├── pages/
│   │   │   ├── TransactionPage.tsx  # 消費記錄頁
│   │   │   ├── CardSettingsPage.tsx # 卡片設定頁
│   │   │   └── DashboardPage.tsx    # 儀表板
│   │   └── components/
│   │       ├── layout/              # Navbar, Layout
│   │       ├── transaction/         # TransactionForm, TransactionList
│   │       ├── card/                # CardList, CardFormModal, RewardRuleList, RewardRuleFormModal, TierEditor
│   │       └── dashboard/           # MonthlySummary, CashbackProgress
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## 快速開始

### 前置需求

- Python 3.10+
- Node.js 18+

### 安裝與啟動

```bash
# 1. 建立 Python 虛擬環境並安裝後端依賴
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt python-dateutil

# 2. 啟動後端 (預設 http://localhost:8000)
python -m uvicorn backend.main:app --reload

# 3. 安裝前端依賴並啟動 (另開終端)
cd frontend
npm install
npm run dev
```

前端預設跑在 `http://localhost:5173`，後端 API 在 `http://localhost:8000`。

Swagger API 文件：`http://localhost:8000/docs`

## 資料庫設計

### cards 表
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | 自動遞增 |
| card_name | TEXT | 卡片名稱 |
| bank_name | TEXT | 銀行名稱 |
| billing_day | INTEGER (1-28) | 結帳日 |
| cashback_type | TEXT | `fixed` / `tiered` |
| fixed_rate | REAL | 固定回饋率 (如 0.02 = 2%) |
| monthly_cap | REAL | 每月回饋上限金額 (NULL = 無上限) |
| calc_method | TEXT | `per_transaction` / `aggregate` |
| rounding_rule | TEXT | `floor` (無條件捨去) / `round` (四捨五入) |

### cashback_tiers 表
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | 自動遞增 |
| card_id | INTEGER FK | 關聯 cards.id |
| min_amount | REAL | 區間起始金額 (含) |
| max_amount | REAL | 區間結束金額 (NULL = 無上限) |
| rate | REAL | 該區間回饋率 |

### reward_rules 表
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | 自動遞增 |
| card_id | INTEGER FK | 關聯 cards.id |
| rule_name | TEXT | 規則名稱 |
| reward_kind | TEXT | `base` / `mission_bonus` / `campaign_bonus` / `other_bonus` |
| cycle_type | TEXT | `billing_cycle` / `calendar_month` |
| cashback_type | TEXT | `fixed` / `tiered` |
| fixed_rate | REAL | 固定回饋率 |
| monthly_cap | REAL | 此規則自己的週期上限 |
| calc_method | TEXT | `per_transaction` / `aggregate` |
| rounding_rule | TEXT | `floor` / `round` |
| is_active | BOOLEAN | 是否啟用 |
| start_date | DATE | 活動起始日 (NULL = 不限制) |
| end_date | DATE | 活動結束日 (NULL = 不限制) |
| payment_methods | JSON | 適用支付工具清單 (NULL = 不限制) |
| stacking_mode | TEXT | `stackable` / `exclusive` |
| exclusive_group | TEXT | 擇優群組名稱 |
| merchant_keywords | JSON | 適用店家關鍵字清單 (NULL = 不限制) |
| category_names | JSON | 適用分類清單 (NULL = 不限制) |

### reward_rule_tiers 表
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | 自動遞增 |
| reward_rule_id | INTEGER FK | 關聯 reward_rules.id |
| min_amount | REAL | 區間起始金額 (含) |
| max_amount | REAL | 區間結束金額 (NULL = 無上限) |
| rate | REAL | 該規則在此區間的回饋率 |

### transactions 表
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | 自動遞增 |
| card_id | INTEGER FK | 關聯 cards.id |
| amount | REAL | 消費金額 |
| cashback | REAL | 計算後的回饋金額 |
| note | TEXT | 備註 |
| merchant | TEXT | 商店名稱 |
| category | TEXT | 消費分類 |
| payment_method | TEXT | 支付工具 |
| transaction_date | DATE | 消費日期 |

### category_budgets 表
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | 自動遞增 |
| category | TEXT | 消費分類 |
| monthly_budget | REAL | 每月預算 |

## API 端點

### 卡片管理
```
GET    /api/cards              # 列出所有卡片
POST   /api/cards              # 新增卡片 (含 tiers)
GET    /api/cards/{id}         # 取得單一卡片詳情
PUT    /api/cards/{id}         # 更新卡片 (含 tiers 整批替換)
DELETE /api/cards/{id}         # 刪除卡片
```

### 回饋規則
```
GET    /api/reward-rules             # 列出回饋規則 (?card_id= 篩選)
POST   /api/reward-rules             # 新增回饋規則 (含 tiers)
GET    /api/reward-rules/{id}        # 取得單一回饋規則
PUT    /api/reward-rules/{id}        # 更新回饋規則 (含 tiers 整批替換)
DELETE /api/reward-rules/{id}        # 刪除回饋規則
```

### 消費記錄
```
GET    /api/transactions                # 列出記錄 (?card_id=&month=&merchant=&category=&payment_method=&min_amount=&max_amount= 篩選)
POST   /api/transactions               # 新增消費記錄 (自動計算 cashback)
POST   /api/transactions/import-csv    # 匯入 CSV (card_id, amount, transaction_date, note；可選 merchant, category, payment_method)
PUT    /api/transactions/{id}          # 更新記錄
DELETE /api/transactions/{id}          # 刪除記錄
```

### 儀表板
```
GET    /api/dashboard/summary?month=YYYY-MM   # 月度摘要
```

### 分類預算
```
GET    /api/category-budgets          # 列出分類預算
POST   /api/category-budgets          # 新增分類預算
PUT    /api/category-budgets/{id}     # 更新分類預算
DELETE /api/category-budgets/{id}     # 刪除分類預算
```

### 匯出
```
POST   /api/export/google-sheets       # 匯出至 Google Sheets
```

## 回饋計算邏輯

若卡片已設定 `reward_rules`，交易回饋會依每個規則各自計算、各自套用週期與上限，最後再加總到交易的 `cashback`。若卡片尚未設定 `reward_rules`，系統會保留卡片層級的舊版單一回饋規則作為相容 fallback。

`reward_rules.cycle_type` 可選：

- `billing_cycle`：依卡片結帳日切帳單週期
- `calendar_month`：依自然月統計

`reward_kind` 可用來拆分基本回饋、任務加碼、活動回饋與其他加碼；這些規則不會先合併 rate 或上限，而是分別計算後加總。

`reward_rules.payment_methods` 可限制支付工具加碼，例如 Apple Pay、Google Pay、臺灣行動支付、臺灣Pay、Line Pay、街口支付、iCash Pay、iPass Money、全支付、悠遊付；未設定時代表不限支付工具。

`stacking_mode` 控制是否可疊加：`stackable` 規則會全部加總；`exclusive` 規則會依 `exclusive_group` 分組，同一群組內同一筆交易只取最高回饋。`merchant_keywords` 與 `category_names` 可限制特殊店家或分類加碼，例如台鐵加碼與 Apple Pay 加碼同群組擇優。

每張卡由兩個維度組合出 4 種計算模式：

| | 四捨五入 (`round`) | 無條件捨去 (`floor`) |
|---|---|---|
| **逐筆** (`per_transaction`) | 每筆各自算回饋後四捨五入 | 每筆各自算回饋後無條件捨去 |
| **合併** (`aggregate`) | 當期總金額合併算回饋後四捨五入 | 當期總金額合併算回饋後無條件捨去 |

### 分級回饋 (Tiered)

採用邊際計算，類似累進稅率。例如設定 0\~5000 為 1%、5000 以上為 2%：

- 消費 8000 元：前 5000 × 1% = 50，後 3000 × 2% = 60，合計回饋 110 元

### 月度上限

當月累計回饋達到上限後，後續消費不再給予回饋。

### 合併模式注意事項

合併模式下，每次新增、修改或刪除交易，都會重新計算整個結帳週期內所有交易的回饋金額，並按消費金額比例分配到各筆交易。

## Google Sheets 匯出

需要 Google Cloud 服務帳戶的 JSON 憑證檔。設定方式：

1. 在 Google Cloud Console 建立服務帳戶並下載 JSON 金鑰
2. 啟用 Google Sheets API 和 Google Drive API
3. 設定環境變數：
   ```bash
   export GOOGLE_CREDENTIALS_JSON=/path/to/credentials.json
   ```
