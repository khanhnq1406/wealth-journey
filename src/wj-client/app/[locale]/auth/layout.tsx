import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const t = await getTranslations("auth");
  return (
    <div className="bg-v2-red-primary h-screen">
      <div className="block sm:grid grid-cols-[40%_60%]">
        <div className="hidden sm:flex justify-center content-center flex-wrap gap-[20px]">
          <div className="flex gap-2 items-center px-5">
            <Image
              src="/logo.svg"
              alt="Logo"
              width={80}
              height={80}
              className="rounded-md"
            />
            <div className="text-v2-gold-accent">
              <p className="font-extrabold text-[30px]">congdongvang.com</p>
              <p>{t("tagline")}</p>
            </div>
          </div>
          <img src="/login-stock.svg" className="w-3/5" alt="Login picture" />
        </div>
        <div className="bg-v2-maroon-900 h-screen">{children}</div>
      </div>
    </div>
  );
}
