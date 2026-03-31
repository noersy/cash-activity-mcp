# cash-activity-mcp

MCP (Model Context Protocol) server for the [Cash Activity](https://cash-api.noersy.my.id) personal finance API.

Exposes the full Cash Activity API as MCP tools — letting AI agents (Rin, Luvia, Illya) manage transactions, wallets, budgets, goals, debts, and analytics through natural language.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
CASH_API_URL=https://cash-api.noersy.my.id
CASH_API_EMAIL=your@email.com
CASH_API_PASSWORD=yourpassword
```

> ⚠️ Use a **dedicated service account**, not your personal login.

### 3. Build

```bash
npm run build
```

### 4. Run

```bash
npm start
```

---

## Register in OpenClaw

Add to your OpenClaw MCP config:

```json
{
  "name": "cash-activity",
  "transport": "stdio",
  "command": "node /home/noersy/repos/cash-activity-mcp/dist/index.js",
  "env": {
    "CASH_API_URL": "https://cash-api.noersy.my.id",
    "CASH_API_EMAIL": "...",
    "CASH_API_PASSWORD": "..."
  }
}
```

---

## Authentication

The server handles auth internally:
- Logs in automatically on startup using `CASH_API_EMAIL` + `CASH_API_PASSWORD`
- Decodes JWT expiry and **proactively refreshes 5 minutes before expiry**
- Falls back to re-login if refresh token is expired
- On any `401`: retries once with a fresh token

No token management needed from the agent side.

---

## Available Tools

### 🧾 Transactions
| Tool | Description |
|------|-------------|
| `list_transactions` | List all transactions |
| `create_transaction` | Add income or expense |
| `delete_transaction` ⚠️ | Delete a transaction (requires `confirm: true`) |

### 👛 Wallets
| Tool | Description |
|------|-------------|
| `list_wallets` | List all wallets |
| `create_wallet` | Create a wallet |
| `update_wallet` | Update wallet name/type |
| `delete_wallet` ⚠️ | Delete a wallet (requires `confirm: true`) |

### 🏷️ Categories
| Tool | Description |
|------|-------------|
| `list_categories` | List all categories |
| `create_category` | Create a category |
| `delete_category` ⚠️ | Delete a category (requires `confirm: true`) |

### 💰 Budgets
| Tool | Description |
|------|-------------|
| `list_budgets` | List all budgets |
| `upsert_budget` | Create or update a budget |
| `delete_budget` ⚠️ | Delete a budget (requires `confirm: true`) |

### 🎯 Goals
| Tool | Description |
|------|-------------|
| `list_goals` | List all savings goals |
| `create_goal` | Create a savings goal |
| `update_goal` | Update a savings goal |
| `delete_goal` ⚠️ | Delete a goal (requires `confirm: true`) |
| `deposit_to_goal` | Deposit savings into a goal |
| `withdraw_from_goal` ⚠️ | Withdraw from a goal (requires `confirm: true`) |

### 💸 Debt & Loans
| Tool | Description |
|------|-------------|
| `list_debt_loans` | List all debts and loans |
| `create_debt_loan` | Record a new debt or loan |
| `repay_debt_loan` ⚠️ | Record repayment (requires `confirm: true`) |

### 🔄 Wallet Transfers
| Tool | Description |
|------|-------------|
| `create_wallet_transfer` | Transfer between wallets |
| `get_transfer_settings` | Get transfer fee config |
| `update_transfer_settings` | Update transfer settings |

### 📊 Analytics
| Tool | Description |
|------|-------------|
| `get_category_breakdown` | Spending/income by category |
| `get_monthly_trend` | Monthly income vs expense trend |
| `bulk_categorize` | Auto-categorize transactions via AI |

### 👤 Profile
| Tool | Description |
|------|-------------|
| `get_profile` | Get user profile |
| `update_profile` | Update user profile |

---

## ⚠️ Destructive Action Safety

All destructive tools require `confirm: true`. Without it, the tool returns:
```
Set confirm: true to proceed with this destructive action.
```

---

## Not in v1 (future)

- `POST /api/ocr/scan-receipt` — binary file upload (not supported via MCP text protocol)
- `POST /api/ocr/scan-transfer-receipt` — same reason
- `POST /api/upload` — binary upload
