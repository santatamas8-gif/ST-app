import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaProvider } from "@/components/PwaProvider";

export const metadata: Metadata = {
  title: "ST AMS",
  description: "ST AMS – Wellness & RPE",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu" className="dark">
      <body className="antialiased font-sans">
        {children}
        <PwaProvider />
      </body>
    </html>
  );
}
