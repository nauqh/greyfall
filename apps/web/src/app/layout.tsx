import type { Metadata } from "next";
import { Cinzel, IM_Fell_English, IM_Fell_English_SC } from "next/font/google";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "./globals.css";

// The display face, for the title logo and menu only.
const cinzel = Cinzel({ subsets: ["latin"], weight: ["700", "900"], variable: "--display" });
// The book face, for the title's subtitle, hint and credit.
const fell = IM_Fell_English({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--book" });
const fellSc = IM_Fell_English_SC({ subsets: ["latin"], weight: "400", variable: "--bookSc" });

export const metadata: Metadata = {
  title: "Greyfall",
  description: "A small real-time strategy game for Discord. Build a town, raise an army, take the island.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${fell.variable} ${fellSc.variable}`}>
      <body>{children}</body>
    </html>
  );
}
