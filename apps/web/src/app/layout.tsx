import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Greyfall",
  description: "A Souls-themed auto-battler. Buy an army, arrange it, watch it fight.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Gochi+Hand&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
