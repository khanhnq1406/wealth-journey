import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WealthJourney",
  description:
    "Welcome to WealthJourney - Your Trusted Guide to Financial Freedom",
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
  applicationName: "WealthJourney",
  appleWebApp: {
    capable: true,
    title: "WealthJourney",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#B91C1C" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
