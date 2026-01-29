import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CardSense - Smart Credit Card Tracker",
  description: "Track your credit cards, manage spending, and get AI-powered insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
