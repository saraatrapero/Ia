import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRAPERO AI",
  description: "Centro de operaciones de inteligencia artificial",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
