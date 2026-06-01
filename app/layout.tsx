import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IdeaRadar",
  description: "Find similar startup ideas and differentiation angles with Qdrant.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
  <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
