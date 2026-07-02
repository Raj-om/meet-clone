import type { Metadata, Viewport } from "next";
import "./globals.css";
import AdvancedGraphicsCanvas from "@/components/AdvancedGraphicsCanvas";
import PwaRegistrar from "@/components/PwaRegistrar";
import { Providers } from "@/components/Providers";

import SuppressWasmAbort from "@/components/SuppressWasmAbort";

export const metadata: Metadata = {
  title: "Meet Clone",
  description: "Premium video meetings without the premium price tag",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
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
