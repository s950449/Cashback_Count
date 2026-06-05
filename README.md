# Cashback Count - 信用卡回饋追蹤系統

追蹤多張信用卡的消費記錄，自動計算回饋金額，掌握每月回饋進度。

## 功能特色

- 多卡管理：支援不同銀行、不同回饋規則的信用卡
- 自動計算回饋：固定回饋率 / 分級累進回饋（類似累進稅率）
- 四種計算模式：逐筆 or 合併 × 四捨五入 or 無條件捨去
- 月度上限追蹤：即時顯示回饋上限使用進度
- 儀表板：月度消費與回饋摘要、各卡明細
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
│   ├── models.py            # ORM models (Card, CashbackTier, Transaction)
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
│   │       ├── card/                # CardList, CardFormModal, TierEditor
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

### transactions 表
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | 自動遞增 |
| card_id | INTEGER FK | 關聯 cards.id |
| amount | REAL | 消費金額 |
| cashback | REAL | 計算後的回饋金額 |
| note | TEXT | 備註 |
| transaction_date | DATE | 消費日期 |

## API 端點

### 卡片管理
```
GET    /api/cards              # 列出所有卡片
POST   /api/cards              # 新增卡片 (含 tiers)
GET    /api/cards/{id}         # 取得單一卡片詳情
PUT    /api/cards/{id}         # 更新卡片 (含 tiers 整批替換)
DELETE /api/cards/{id}         # 刪除卡片
```

### 消費記錄
```
GET    /api/transactions                # 列出記錄 (?card_id=&month= 篩選)
POST   /api/transactions               # 新增消費記錄 (自動計算 cashback)
PUT    /api/transactions/{id}          # 更新記錄
DELETE /api/transactions/{id}          # 刪除記錄
```

### 儀表板
```
GET    /api/dashboard/summary?month=YYYY-MM   # 月度摘要
```

### 匯出
```
POST   /api/export/google-sheets       # 匯出至 Google Sheets
```

## 回饋計算邏輯

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
