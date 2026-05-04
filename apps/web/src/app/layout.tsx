import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Reactive Game Flow Agent",
  description: "Real-time voice reaction classifier for gaming streams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-900 text-white min-h-screen">{children}</body>
    </html>
  );
}
