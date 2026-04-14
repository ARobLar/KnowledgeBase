import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "KnowledgeBase",
  description: "AI-powered personal knowledge base stored in Google Drive",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-text min-h-screen">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
