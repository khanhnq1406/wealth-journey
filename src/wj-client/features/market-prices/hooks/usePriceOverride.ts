import { useQueryClient } from "@tanstack/react-query";
import {
  useMutationSetPriceOverride as useGeneratedSetPriceOverride,
  useMutationDeletePriceOverride as useGeneratedDeletePriceOverride,
  EVENT_InvestmentGetMarketPrices,
} from "@/utils/generated/hooks";
import type { ErrorType } from "@/utils/generated/hooks.types";
import type { SetPriceOverrideRequest, DeletePriceOverrideRequest } from "@/gen/protobuf/v1/admin";

export function usePriceOverrideSet(options?: {
  onSuccess?: () => void;
  onError?: (error: ErrorType) => void;
}) {
  const queryClient = useQueryClient();
  return useGeneratedSetPriceOverride({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENT_InvestmentGetMarketPrices] });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}

export function usePriceOverrideDelete(options?: {
  onSuccess?: () => void;
  onError?: (error: ErrorType) => void;
}) {
  const queryClient = useQueryClient();
  return useGeneratedDeletePriceOverride({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENT_InvestmentGetMarketPrices] });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}

export type { SetPriceOverrideRequest, DeletePriceOverrideRequest };
