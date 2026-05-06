import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GameFlow Agent",
  description: "Real-time voice reaction classifier for gaming streams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
