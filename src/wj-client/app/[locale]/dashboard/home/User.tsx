"use client";

import { store } from "@/features/auth/store/store";
import { ButtonType, resources } from "@/app/constants";
import { Button } from "@/components/Button";
import { memo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { logout } from "@/app/[locale]/auth/utils/logout";
import Image from "next/image";

export const User = memo(function User() {
  const tCommon = useTranslations("common");
  const user = store.getState().setAuthReducer;
  const handleLogout = useCallback(() => {
    logout();
  }, [user]);
  return (
    <div className="flex justify-center items-center gap-3 my-5">
      <Image
        src={user.picture !== null ? user.picture : `${resources}/user.svg`}
        alt={user.fullname || tCommon("user")}
        className="rounded-full"
        width={40}
        height={40}
      />
      <p className="truncate">
        <p className="text-lg font-bold truncate">{user.fullname}</p>
        <p className="text-sm break-all truncate">{user.email}</p>
      </p>
      <div>
        <Button
          type={ButtonType.IMG}
          src={`${resources}/logout.svg`}
          onClick={handleLogout}
        />
      </div>
    </div>
  );
});
