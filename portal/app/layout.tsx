import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jymmanuel | Document Portal",
  description: "Jymmanuel management document workflow — local demonstration.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
