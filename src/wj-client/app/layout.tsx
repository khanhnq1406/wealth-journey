import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "congdongvang.com",
  description:
    "congdongvang.com - Theo dõi giá vàng & quản lý tài chính",
  icons: {
    icon: "/logo.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
  },
  applicationName: "congdongvang.com",
  appleWebApp: {
    capable: true,
    title: "congdongvang.com",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  themeColor: "#5F0202",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
