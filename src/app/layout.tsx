import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tukkebaaz Admin | Control Center & Live Analytics",
  description: "High-fidelity stays booking analytics, catalog controls, and kitchen delivery order tracking console for the Tukkebaaz platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className="min-h-full bg-white text-[#111111] antialiased">
        {children}
      </body>
    </html>
  );
}
