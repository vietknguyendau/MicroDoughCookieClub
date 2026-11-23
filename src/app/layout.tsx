import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Microdough Cookie Club", template: "%s · Microdough" },
  description: "Small Batch. Big Flavor. Rate our cookies, vote for your favorite, and enter to win a free 6-pack.",
  icons: { icon: "/brand/bunny-placeholder.png" },
};

export const viewport: Viewport = { themeColor: "#f8f5ef", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
