import type { Metadata } from "next";
import { Cinzel } from "next/font/google";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "./globals.css";

// The display face, for the title logo and menu only.
const cinzel = Cinzel({ subsets: ["latin"], weight: ["700", "900"], variable: "--display" });

export const metadata: Metadata = {
  title: "Greyfall",
  description: "A small real-time strategy game for Discord. Build a town, raise an army, take the island.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cinzel.variable}>
      <body>{children}</body>
    </html>
  );
}
