"use client";

import { useSelector } from "react-redux";
import { useRouter } from "@/lib/navigation";
import { useEffect } from "react";
import { FullPageLoading } from "@/components/loading/FullPageLoading";
import { routes } from "@/app/constants";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const auth = useSelector((state: any) => state.setAuthReducer);
  const router = useRouter();

  useEffect(() => {
    if (auth?.isAuthenticated && !auth?.isAdmin) {
      router.replace(routes.home);
    }
  }, [auth?.isAuthenticated, auth?.isAdmin, router]);

  if (!auth?.isAuthenticated || !auth?.isAdmin) {
    return <FullPageLoading />;
  }

  return <>{children}</>;
}
