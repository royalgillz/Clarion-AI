import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clarion AI - Understand Your Lab Results",
  description:
    "Upload a CBC lab report and get a clear, plain-English explanation with clinical reasoning. Educational only - not medical advice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
