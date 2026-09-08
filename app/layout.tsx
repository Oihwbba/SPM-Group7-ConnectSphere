import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// Plus Jakarta Sans — a geometric, modern SaaS-dashboard sans matching the
// design reference. Loaded through next/font (no extra dependency, self-hosted
// at build time) and exposed as the --font-sans token the Tailwind theme reads.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ConnectSphere",
  description:
    "Event planning and venue booking for ConnectSphere Event Services.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
