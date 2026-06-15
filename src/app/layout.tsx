import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Faultline — Dependency-aware incident response",
  description:
    "Faultline maps your service dependency graph and quantifies the financial blast radius of every outage in real time.",
  applicationName: "Faultline",
};

export const viewport: Viewport = {
  themeColor: "#1a1d24",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1 pb-20 md:pb-0">{children}</main>
            <MobileNav />
          </div>
        </Providers>
      </body>
    </html>
  );
}
