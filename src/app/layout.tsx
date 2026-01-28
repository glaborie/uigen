import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UIGen - AI Component Generator",
  description: "AI-powered React component generator with live preview",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
