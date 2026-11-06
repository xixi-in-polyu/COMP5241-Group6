import type { Metadata } from "next";
import "./globals.css";

import { SessionGuard } from "@/app/components/session-guard";

export const metadata: Metadata = {
  title: "Learning Platform | Sign in",
  description: "Sign in to your learning space.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SessionGuard />
        {children}
      </body>
    </html>
  );
}
