import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCP Server Demo — Model Context Protocol Live",
  description:
    "Watch Claude use the Model Context Protocol in real time. Every JSON-RPC message — initialize, tools/list, tools/call — visualized as it happens. Built by Harrison Dudley-Rode.",
  openGraph: {
    title: "MCP Server Demo",
    description: "The Model Context Protocol, live and transparent. Every tool call visible.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
