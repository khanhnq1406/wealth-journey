# REST API Endpoint Snapshot (Pre-Restructure)

Captured from `handlers/routes.go` as a regression reference.

## Auth (Public)
| Method | Path | Handler |
|--------|------|---------|
| POST | /api/v1/auth/register | Register |
| POST | /api/v1/auth/login | Login |
| POST | /api/v1/auth/logout | Logout |
| GET | /api/v1/auth/verify | VerifyAuth |

## Auth (Protected)
| Method | Path | Handler |
|--------|------|---------|
| GET | /api/v1/auth | GetAuth |

## Sessions
| Method | Path | Handler |
|--------|------|---------|
| GET | /api/v1/sessions | ListSessions |
| DELETE | /api/v1/sessions/:session_id | RevokeSession |
| DELETE | /api/v1/sessions | RevokeAllSessions |

## Users
| Method | Path | Handler |
|--------|------|---------|
| GET | /api/v1/users | GetUser |
| GET | /api/v1/users/all | ListUsers |
| PUT | /api/v1/users/preferences | UpdatePreferences |
| GET | /api/v1/users/:email | GetUserByEmail |
| POST | /api/v1/users | CreateUser |
| PUT | /api/v1/users | UpdateUser |
| DELETE | /api/v1/users | DeleteUser |

## Wallets
| Method | Path | Handler |
|--------|------|---------|
| POST | /api/v1/wallets | CreateWallet |
| GET | /api/v1/wallets | ListWallets |
| GET | /api/v1/wallets/total-balance | GetTotalBalance |
| GET | /api/v1/wallets/balance-history | GetBalanceHistory |
| GET | /api/v1/wallets/monthly-dominance | GetMonthlyDominance |
| POST | /api/v1/wallets/transfer | TransferFunds |
| GET | /api/v1/wallets/:id/investments | ListInvestments |
| GET | /api/v1/wallets/:id/portfolio-summary | GetPortfolioSummary |
| GET | /api/v1/wallets/:id | GetWallet |
| PUT | /api/v1/wallets/:id | UpdateWallet |
| POST | /api/v1/wallets/:id/delete | DeleteWallet |
| POST | /api/v1/wallets/:id/add | AddFunds |
| POST | /api/v1/wallets/:id/withdraw | WithdrawFunds |
| POST | /api/v1/wallets/:id/adjust | AdjustBalance |

## Transactions
| Method | Path | Handler |
|--------|------|---------|
| POST | /api/v1/transactions | CreateTransaction |
| GET | /api/v1/transactions | ListTransactions |
| GET | /api/v1/transactions/available-years | GetAvailableYears |
| GET | /api/v1/transactions/financial-report | GetFinancialReport |
| GET | /api/v1/transactions/category-breakdown | GetCategoryBreakdown |
| GET | /api/v1/transactions/:id | GetTransaction |
| PUT | /api/v1/transactions/:id | UpdateTransaction |
| DELETE | /api/v1/transactions/:id | DeleteTransaction |

## Categories
| Method | Path | Handler |
|--------|------|---------|
| POST | /api/v1/categories | CreateCategory |
| GET | /api/v1/categories | ListCategories |
| GET | /api/v1/categories/:id | GetCategory |
| PUT | /api/v1/categories/:id | UpdateCategory |
| DELETE | /api/v1/categories/:id | DeleteCategory |

## Budgets
| Method | Path | Handler |
|--------|------|---------|
| POST | /api/v1/budgets | CreateBudget |
| GET | /api/v1/budgets | ListBudgets |
| GET | /api/v1/budgets/:id | GetBudget |
| PUT | /api/v1/budgets/:id | UpdateBudget |
| DELETE | /api/v1/budgets/:id | DeleteBudget |
| GET | /api/v1/budgets/:id/items | GetBudgetItems |
| POST | /api/v1/budgets/:id/items | CreateBudgetItem |
| PUT | /api/v1/budgets/:id/items/:itemId | UpdateBudgetItem |
| DELETE | /api/v1/budgets/:id/items/:itemId | DeleteBudgetItem |

## Investments
| Method | Path | Handler |
|--------|------|---------|
| GET | /api/v1/investments | ListUserInvestments |
| POST | /api/v1/investments | CreateInvestment |
| POST | /api/v1/investments/update-prices | UpdatePrices |
| GET | /api/v1/investments/symbols/search | SearchSymbols |
| GET | /api/v1/investments/market-price | GetMarketPrice |
| GET | /api/v1/investments/gold-types | GetGoldTypeCodes |
| GET | /api/v1/investments/silver-types | GetSilverTypeCodes |
| GET | /api/v1/investments/market-prices | GetMarketPrices |
| GET | /api/v1/investments/:id/transactions | ListTransactions |
| POST | /api/v1/investments/:id/transactions | AddTransaction |
| GET | /api/v1/investments/:id | GetInvestment |
| PUT | /api/v1/investments/:id | UpdateInvestment |
| DELETE | /api/v1/investments/:id | DeleteInvestment |

## Investment Transactions
| Method | Path | Handler |
|--------|------|---------|
| PUT | /api/v1/investment-transactions/:id | EditTransaction |
| DELETE | /api/v1/investment-transactions/:id | DeleteTransaction |

## Portfolio
| Method | Path | Handler |
|--------|------|---------|
| GET | /api/v1/portfolio-summary | GetAggregatedPortfolioSummary |
| GET | /api/v1/portfolio/historical-values | GetHistoricalPortfolioValues |

## Import (Standard Rate Limit)
| Method | Path | Handler |
|--------|------|---------|
| GET | /api/v1/import/templates | ListBankTemplates |
| GET | /api/v1/import/excel-sheets/:file_id | ListExcelSheets |
| GET | /api/v1/import/history | ListImportBatches |
| GET | /api/v1/import/user-templates | ListUserTemplates |
| POST | /api/v1/import/user-templates | CreateUserTemplate |
| GET | /api/v1/import/user-templates/:template_id | GetUserTemplate |
| PUT | /api/v1/import/user-templates/:template_id | UpdateUserTemplate |
| DELETE | /api/v1/import/user-templates/:template_id | DeleteUserTemplate |
| GET | /api/v1/import/jobs | ListUserJobs |
| GET | /api/v1/import/jobs/:job_id | GetJobStatus |
| POST | /api/v1/import/jobs/:job_id/cancel | CancelJob |
| GET | /api/v1/import/:id | GetImportBatch |

## Import (Strict Rate Limit)
| Method | Path | Handler |
|--------|------|---------|
| POST | /api/v1/import/upload | UploadFile |
| POST | /api/v1/import/parse | ParseFile |
| POST | /api/v1/import/convert-currency | ConvertCurrency |
| POST | /api/v1/import/detect-duplicates | DetectDuplicates |
| POST | /api/v1/import/execute | ConfirmImport |
| POST | /api/v1/import/:id/undo | UndoImport |

---
**Total: 75 endpoints**
**Captured: 2026-03-04**
