import type { Metadata } from "next";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Greyfall",
  description: "A Souls-themed auto-battler. Buy an army, arrange it, watch it fight.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* boot.ts gates Phaser boot on this font, so it must race the JS
          chunks, not wait for them. */}
      <link
        rel="preload"
        href={"@fontsource/medievalsharp/files/medievalsharp-latin-400-normal.woff2"}
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <body>{children}</body>
    </html>
  );
}
