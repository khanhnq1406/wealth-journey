"use client";

/**
 * Enhanced Budget Page with Data Visualization
 *
 * Combines the original working budget item management functionality
 * with enhanced visual design from the redesign.
 */

import { useState, useCallback } from "react";
import {
  EVENT_BudgetGetBudgetItems,
  useQueryListBudgets,
} from "@/utils/generated/hooks";
import { BaseCard } from "@/components/BaseCard";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { ButtonType, resources } from "@/app/constants";
import { Button } from "@/components/Button";
import Image from "next/image";
import { BudgetCard } from "./BudgetCard";
import { BaseModal } from "@/components/modals/BaseModal";
import {
  CreateBudgetForm,
  EditBudgetForm,
  CreateBudgetItemForm,
  EditBudgetItemForm,
} from "@/components/lazy/OptimizedComponents";
import { useQueryClient } from "@tanstack/react-query";
import { EVENT_BudgetListBudgets } from "@/utils/generated/hooks";
import { Budget, BudgetItem } from "@/gen/protobuf/v1/budget";
import { PlusIcon } from "@/components/icons";
import { useTranslations } from "next-intl";

type ModalState =
  | { type: "create-budget" }
  | { type: "edit-budget"; budget: Budget }
  | { type: "add-budget-item"; budgetId: number }
  | { type: "edit-budget-item"; budgetId: number; item: BudgetItem }
  | null;

export function BudgetContent() {
  const t = useTranslations("budget");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<ModalState>(null);

  const getListBudgets = useQueryListBudgets(
    { pagination: { page: 1, pageSize: 10, orderBy: "", order: "" } },
    { refetchOnMount: "always" },
  );

  const handleCreateBudget = () => {
    setModalState({ type: "create-budget" });
  };

  const handleEditBudget = useCallback((budget: Budget) => {
    setModalState({ type: "edit-budget", budget });
  }, []);

  const handleAddBudgetItem = useCallback((budgetId: number) => {
    setModalState({ type: "add-budget-item", budgetId });
  }, []);

  const handleEditBudgetItem = useCallback(
    (budgetId: number, item: BudgetItem) => {
      setModalState({ type: "edit-budget-item", budgetId, item });
    },
    [],
  );

  const handleDeleteBudget = useCallback(() => {
    // Deletion is handled within BudgetCard component
    // Just refetch after deletion
    getListBudgets.refetch();
  }, [getListBudgets]);

  const handleModalClose = useCallback(() => {
    setModalState(null);
  }, []);

  const handleModalSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [EVENT_BudgetListBudgets] });
    queryClient.invalidateQueries({ queryKey: [EVENT_BudgetGetBudgetItems] });
    handleModalClose();
  }, [queryClient, handleModalClose]);

  const getModalTitle = useCallback(() => {
    switch (modalState?.type) {
      case "create-budget":
        return t("modal.createBudget");
      case "edit-budget":
        return t("modal.editBudget");
      case "add-budget-item":
        return t("modal.addBudgetItem");
      case "edit-budget-item":
        return t("modal.editBudgetItem");
      default:
        return "";
    }
  }, [modalState, t]);

  if (getListBudgets.isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner text={t("loadingBudgets")} />
      </div>
    );
  }

  if (getListBudgets.error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-lred">{t("errorLoading")}</div>
        <Button
          type={ButtonType.PRIMARY}
          onClick={() => getListBudgets.refetch()}
          className="w-fit px-5"
        >
          {tCommon("retry")}
        </Button>
      </div>
    );
  }

  const budgets = getListBudgets.data?.budgets ?? [];

  return (
    <div className="flex flex-col gap-3 sm:gap-4 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <h1 className="text-lg sm:text-xl font-bold">{t("title")}</h1>
        <Button
          type={ButtonType.PRIMARY}
          onClick={handleCreateBudget}
          fullWidth={false}
          className="px-4 py-2 rounded-md drop-shadow-round"
        >
          <div className="flex items-center gap-2">
            <PlusIcon />
            <span className="hidden sm:inline">{t("createBudget")}</span>
            <span className="sm:hidden">{t("newBudget")}</span>
          </div>
        </Button>
      </div>

      {/* Budget Cards Grid */}
      {budgets.length === 0 ? (
        <BaseCard className="p-6 sm:p-8">
          <div className="flex flex-col items-center justify-center gap-4 py-8 sm:py-12">
            <div className="text-v2-text-tertiary text-base sm:text-lg">
              {t("noBudgetsYet")}
            </div>
            <div className="text-v2-text-tertiary text-sm sm:text-base text-center">
              {t("createFirstBudget")}
            </div>
          </div>
        </BaseCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onRefresh={() => getListBudgets.refetch()}
              onEditBudget={handleEditBudget}
              onAddBudgetItem={handleAddBudgetItem}
              onEditBudgetItem={handleEditBudgetItem}
              onDeleteBudget={handleDeleteBudget}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modalState && (
        <BaseModal
          isOpen={modalState !== null}
          onClose={handleModalClose}
          title={getModalTitle()}
        >
          {modalState.type === "create-budget" && (
            <CreateBudgetForm onSuccess={handleModalSuccess} />
          )}
          {modalState.type === "edit-budget" && (
            <EditBudgetForm
              budget={modalState.budget}
              onSuccess={handleModalSuccess}
            />
          )}
          {modalState.type === "add-budget-item" && (
            <CreateBudgetItemForm
              budgetId={modalState.budgetId}
              onSuccess={handleModalSuccess}
            />
          )}
          {modalState.type === "edit-budget-item" && (
            <EditBudgetItemForm
              budgetId={modalState.budgetId}
              item={modalState.item}
              onSuccess={handleModalSuccess}
            />
          )}
        </BaseModal>
      )}
    </div>
  );
}

export default function BudgetPage() {
  return <BudgetContent />;
}
