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
  guide: "/guide",
};

export const resources = "/resources/icons/";

// Maroon & Gold chart colors - mihong.vn dark theme palette
export const chartColors = [
  "#D78B1C", // Gold primary
  "#F1BD61", // Gold accent
  "#F5D38E", // Gold light
  "#9B0111", // Red primary
  "#FFF8EC", // Cream
  "#E8A535", // Gold warm
  "#C0392B", // Red accent
  "#F7DC6F", // Gold pale
  "#7B0A0E", // Dark red
  "#DBA944", // Gold mid
];

// Pie chart colors - maroon/gold/cream palette
export const pieChartColors = [
  "#D78B1C", // Gold primary
  "#9B0111", // Red primary
  "#F1BD61", // Gold accent
  "#FFF8EC", // Cream
  "#F5D38E", // Gold light
  "#7B0A0E", // Dark red
  "#E8A535", // Gold warm
  "#C0392B", // Red accent
  "#F7DC6F", // Gold pale
  "#3D0101", // Dark maroon surface
];

// V2 chart colors - Maroon & Gold palette
export const v2ChartColors = [
  "#D78B1C", // Gold primary
  "#9B0111", // Red primary
  "#F1BD61", // Gold accent
  "#F5D38E", // Gold light
  "#FFF8EC", // Cream
  "#7B0A0E", // Dark red
  "#E8A535", // Gold warm
  "#3D0101", // Dark maroon surface
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
  CREATE_PRICE_ALERT: "Create Price Alert",
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
