import type { Metadata, Viewport } from "next";
import "./globals.css";
import AdvancedGraphicsCanvas from "@/components/AdvancedGraphicsCanvas";
import PwaRegistrar from "@/components/PwaRegistrar";
import { Providers } from "@/components/Providers";

import SuppressWasmAbort from "@/components/SuppressWasmAbort";

export const metadata: Metadata = {
  title: "AEXIS — Realistic & Futuristic Comms",
  description: "Aexis: The state-of-the-art AI-native communication platform featuring neural engagement and seamless connection.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="icon" href="/clarivox-logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/clarivox-logo.png" />
      </head>
      <body>
        <Providers>
          <SuppressWasmAbort />
          <PwaRegistrar />
          <AdvancedGraphicsCanvas />
          {children}
        </Providers>
      </body>
    </html>
  );
}
