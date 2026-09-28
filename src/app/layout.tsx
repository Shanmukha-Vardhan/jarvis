import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JARVIS // Personal Operating System",
  description: "Executive AI briefing, real-time schedule, bike commute decision, and assignments for Shanmukha.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-white text-zinc-900 antialiased">
      <body className="min-h-full bg-white text-zinc-900 flex flex-col font-sans selection:bg-zinc-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
