import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ST App",
  description: "ST App – Wellness & RPE",
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
