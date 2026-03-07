"use client";
import { store } from "@/features/auth/store/store";
import { BACKEND_URL, LOCAL_STORAGE_TOKEN_NAME, routes } from "@/app/constants";
import { removeAuth } from "@/features/auth/store/actions";
import { redirect } from "next/navigation";
import { apiClient } from "@/utils/api-client";

export async function logout() {
  try {
    await apiClient.post(`${BACKEND_URL}/auth/logout`, {
      token: localStorage.getItem(LOCAL_STORAGE_TOKEN_NAME),
    });
  } finally {
    localStorage.removeItem(LOCAL_STORAGE_TOKEN_NAME);
    store.dispatch(removeAuth());
    redirect(routes.login);
  }
}
