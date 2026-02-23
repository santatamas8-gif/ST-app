import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ST AMS",
  description: "ST AMS – Wellness & RPE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
