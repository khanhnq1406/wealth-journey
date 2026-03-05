export interface ReduxAction {
  type: string;
  payload?: object;
}

export interface AuthPayload {
  isAuthenticated: boolean;
  email: string;
  fullname: string;
  picture: string;
  preferredCurrency?: string;  // ISO 4217 currency code (e.g., "USD", "VND", "EUR")
}

export interface AuthAction extends ReduxAction {
  payload: AuthPayload;
}

export type ConfirmationAction = {
  type: "deleteTransaction" | "deleteWallet" | "deleteCategory" | "deleteBudget" | string;
  payload?: any;
};

export interface ConfirmationConfig {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  action: ConfirmationAction;
  variant?: "default" | "danger";
}

export interface ModalPayload {
  isOpen: boolean;
  type: string; // 'Add' or 'Transfer' or 'Create' or 'Edit Transaction' or 'Confirm'
  transactionId?: number; // Transaction ID for edit operations
  onSuccess?: () => void; // Callback to refetch data after successful mutation
  confirmConfig?: ConfirmationConfig; // Configuration for confirmation dialog
  data?: any; // Additional data for modals (budget, budgetId, item, etc.)
}
export interface ModalAction extends ReduxAction {
  payload: ModalPayload;
}
