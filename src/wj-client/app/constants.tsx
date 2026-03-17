// Legacy backend URL (without /api prefix)
// @deprecated Use API_URL instead
// New API URL with /api prefix
export const BACKEND_URL =
  process.env.NODE_ENV === "production"
    ? `${process.env.NEXT_PUBLIC_PROD_BACKEND_URL}/api/v1`
    : "http://localhost:5000/api/v1";

export enum NotificationCode {
  SUCCESS = "Success",
  ERROR = "Error",
  INFO = "Info",
  WARNING = "Warning",
}

export enum HttpStatus {
  CONTINUE = 100,
  SWITCHING_PROTOCOLS = 101,
  PROCESSING = 102,
  EARLYHINTS = 103,
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NON_AUTHORITATIVE_INFORMATION = 203,
  NO_CONTENT = 204,
  RESET_CONTENT = 205,
  PARTIAL_CONTENT = 206,
  AMBIGUOUS = 300,
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  SEE_OTHER = 303,
  NOT_MODIFIED = 304,
  TEMPORARY_REDIRECT = 307,
  PERMANENT_REDIRECT = 308,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  PAYMENT_REQUIRED = 402,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  NOT_ACCEPTABLE = 406,
  PROXY_AUTHENTICATION_REQUIRED = 407,
  REQUEST_TIMEOUT = 408,
  CONFLICT = 409,
  GONE = 410,
  LENGTH_REQUIRED = 411,
  PRECONDITION_FAILED = 412,
  PAYLOAD_TOO_LARGE = 413,
  URI_TOO_LONG = 414,
  UNSUPPORTED_MEDIA_TYPE = 415,
  REQUESTED_RANGE_NOT_SATISFIABLE = 416,
  EXPECTATION_FAILED = 417,
  I_AM_A_TEAPOT = 418,
  MISDIRECTED = 421,
  UNPROCESSABLE_ENTITY = 422,
  FAILED_DEPENDENCY = 424,
  PRECONDITION_REQUIRED = 428,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
  HTTP_VERSION_NOT_SUPPORTED = 505,
}

export const LOCAL_STORAGE_TOKEN_NAME = "token";

export enum REDUX_TYPE {
  SET_AUTH = "SET_AUTH",
  REMOVE_AUTH = "REMOVE_AUTH",
  OPEN_MODAL = "OPEN_MODAL",
  CLOSE_MODAL = "CLOSE_MODAL",
}

export const routes = {
  login: "/auth/login",
  register: "/auth/register",
  dashboard: "/dashboard",
  home: `/dashboard/home`,
  transaction: `/dashboard/transaction`,
  report: `/dashboard/report`,
  budget: `/dashboard/budget`,
  finance: `/dashboard/finance`,
  wallets: `/dashboard/wallets`,
  portfolio: `/dashboard/portfolio`,
  prices: `/dashboard/prices`,
  community: `/dashboard/community`,
  communityProfile: `/dashboard/community?view=profile`,
  feedback: `/dashboard/feedback`,
  admin: `/dashboard/admin`,
};

export const resources = "/resources/icons/";

// Green-based fintech chart colors - professional pastel palette
export const chartColors = [
  "#22C55E", // Primary green (success, growth)
  "#14B8A6", // Teal accent (modern, tech-forward)
  "#86EFAC", // Light green (optimistic)
  "#5EEAD4", // Mint fresh (clean)
  "#10B981", // Emerald green (wealth)
  "#2DD4BF", // Sea green (calm)
  "#A7F3D0", // Sage green (natural)
  "#6EE7B7", // Pale green (subtle)
  "#84CC16", // Lime accent (energetic)
  "#06B6D4", // Cyan highlight (balance)
];

// Pie chart colors - harmonized with green theme
export const pieChartColors = [
  "#22C55E", // Primary green
  "#14B8A6", // Teal
  "#10B981", // Emerald
  "#84CC16", // Lime
  "#06B6D4", // Cyan
  "#DC2626", // Red (expenses/losses - contrast)
  "#F59E0B", // Orange (warning)
  "#8B5CF6", // Purple (alternative category)
  "#EC4899", // Pink (another category)
  "#6366F1", // Indigo (final category)
];

// V2 chart colors - Crimson & Gold palette
export const v2ChartColors = [
  "#B8860B", // Gold primary
  "#B91C1C", // Red primary
  "#15803D", // Green positive
  "#D4A017", // Gold accent
  "#8B929E", // Silver primary
  "#374151", // Silver dark
  "#92710C", // Gold dark
  "#7F1D1D", // Red dark
];

export const ButtonType = {
  PRIMARY: "primary",
  SECONDARY: "secondary",
  IMG: "img",
};

export const ModalType = {
  ADD_TRANSACTION: "Add Transaction",
  EDIT_TRANSACTION: "Edit Transaction",
  TRANSFER_MONEY: "Transfer Money",
  CREATE_WALLET: "Create New Wallet",
  EDIT_WALLET: "Edit Wallet",
  DELETE_WALLET: "Delete Wallet",
  SUCCESS: "Success",
  CONFIRM: "Confirm",
  ADD_BUDGET: "Add Budget",
  EDIT_BUDGET: "Edit Budget",
  ADD_BUDGET_ITEM: "Add Budget Item",
  EDIT_BUDGET_ITEM: "Edit Budget Item",
  ADD_INVESTMENT: "Add Investment",
  INVESTMENT_DETAIL: "Investment Details",
  CREATE_POST: "Create Post",
  EDIT_POST: "Edit Post",
  REPORT_CONTENT: "Report Content",
};

export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "VND", symbol: "₫", name: "Vietnamese Đồng" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
];
