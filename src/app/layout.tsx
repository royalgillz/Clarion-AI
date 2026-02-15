import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lab RAG – Patient Lab Explainer",
  description: "Upload a lab PDF and get a patient-friendly explanation powered by Neo4j + Gemini",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
