// MSW handlers for API testing
import { http, HttpResponse } from "msw";
import { Transaction } from "@/gen/protobuf/v1/transaction";

const mockTransactions: Transaction[] = [
  {
    id: 1,
    walletId: 1,
    categoryId: 1,
    type: 2, // EXPENSE
    amount: { amount: 150000, currency: "VND" },
    displayAmount: { amount: 150000, currency: "VND" },
    date: Math.floor(new Date("2024-02-01").getTime() / 1000),
    note: "Lunch at restaurant",
    currency: "VND",
    displayCurrency: "VND",
    createdAt: Math.floor(new Date("2024-02-01").getTime() / 1000),
    updatedAt: Math.floor(new Date("2024-02-01").getTime() / 1000),
  },
  {
    id: 2,
    walletId: 1,
    categoryId: 2,
    type: 1, // INCOME
    amount: { amount: 5000000, currency: "VND" },
    displayAmount: { amount: 5000000, currency: "VND" },
    date: Math.floor(new Date("2024-02-05").getTime() / 1000),
    note: "Salary",
    currency: "VND",
    displayCurrency: "VND",
    createdAt: Math.floor(new Date("2024-02-05").getTime() / 1000),
    updatedAt: Math.floor(new Date("2024-02-05").getTime() / 1000),
  },
  {
    id: 3,
    walletId: 2,
    categoryId: 3,
    type: 2, // EXPENSE
    amount: { amount: 50000, currency: "VND" },
    displayAmount: { amount: 50000, currency: "VND" },
    date: Math.floor(new Date("2024-01-15").getTime() / 1000),
    note: "Coffee",
    currency: "VND",
    displayCurrency: "VND",
    createdAt: Math.floor(new Date("2024-01-15").getTime() / 1000),
    updatedAt: Math.floor(new Date("2024-01-15").getTime() / 1000),
  },
];

export const handlers = [
  // List transactions endpoint
  http.get("/api/v1/transactions", ({ request }) => {
    const url = new URL(request.url);
    const filterParam = url.searchParams.get("filter");

    let filteredTransactions = [...mockTransactions];

    // Apply date range filter if provided
    if (filterParam) {
      try {
        const filter = JSON.parse(filterParam);
        if (filter.startDate) {
          filteredTransactions = filteredTransactions.filter(
            (t) => t.date >= filter.startDate
          );
        }
        if (filter.endDate) {
          filteredTransactions = filteredTransactions.filter(
            (t) => t.date <= filter.endDate
          );
        }
      } catch (e) {
        console.error("Failed to parse filter:", e);
      }
    }

    return HttpResponse.json({
      success: true,
      message: "Transactions retrieved successfully",
      transactions: filteredTransactions,
      pagination: {
        page: 1,
        pageSize: 10000,
        totalCount: filteredTransactions.length,
        totalPages: 1,
      },
      timestamp: new Date().toISOString(),
    });
  }),

  // List categories endpoint
  http.get("/api/v1/categories", () => {
    return HttpResponse.json({
      success: true,
      message: "Categories retrieved successfully",
      categories: [
        { id: 1, userId: 1, name: "Food", type: 2, createdAt: Date.now() / 1000, updatedAt: Date.now() / 1000 },
        { id: 2, userId: 1, name: "Salary", type: 1, createdAt: Date.now() / 1000, updatedAt: Date.now() / 1000 },
        { id: 3, userId: 1, name: "Transport", type: 2, createdAt: Date.now() / 1000, updatedAt: Date.now() / 1000 },
      ],
      pagination: {
        page: 1,
        pageSize: 100,
        totalCount: 3,
        totalPages: 1,
      },
      timestamp: new Date().toISOString(),
    });
  }),

  // List wallets endpoint
  http.get("/api/v1/wallets", () => {
    return HttpResponse.json({
      success: true,
      message: "Wallets retrieved successfully",
      wallets: [
        { id: 1, userId: 1, walletName: "Cash", balance: 1000000, currency: "VND", type: 0, createdAt: Date.now() / 1000, updatedAt: Date.now() / 1000 },
        { id: 2, userId: 1, walletName: "Bank Account", balance: 5000000, currency: "VND", type: 0, createdAt: Date.now() / 1000, updatedAt: Date.now() / 1000 },
      ],
      pagination: {
        page: 1,
        pageSize: 100,
        totalCount: 2,
        totalPages: 1,
      },
      timestamp: new Date().toISOString(),
    });
  }),
];
