"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { store } from "@/features/auth/store/store";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check auth state from store
    const authState = store.getState().setAuthReducer.isAuthenticated;

    if (authState) {
      router.push("/dashboard/home");
    } else {
      router.push("/landing");
    }
  }, [router]);

  return null;
}
