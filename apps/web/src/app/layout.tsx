import type { Metadata } from "next";
import "@fontsource/cinzel/latin-700.css";
import "@fontsource/cinzel/latin-900.css";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import "@fontsource/eb-garamond/latin-600.css";
import { Clicks } from "./Clicks";
import "./globals.css";

// Served from the packages, not fetched from Google Fonts at build: that fetch failed CI whenever Google's answer
// carried no font file. The display face is for names, heads and numbers; the book face for anything read.
const fonts = { "--display": "'Cinzel'", "--book": "'EB Garamond'" } as React.CSSProperties;

export const metadata: Metadata = {
  title: "Greyfall",
  description: "A small real-time strategy game for Discord. Build a town, raise an army, take the island.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={fonts}>
      <body>
        <Clicks />
        {children}
      </body>
    </html>
  );
}
