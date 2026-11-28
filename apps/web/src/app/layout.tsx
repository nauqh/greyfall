import type { Metadata } from "next";
import "@fontsource/cinzel/latin-700.css";
import "@fontsource/cinzel/latin-900.css";
import "@fontsource/im-fell-english/latin-400.css";
import "@fontsource/im-fell-english/latin-400-italic.css";
import "@fontsource/im-fell-english-sc/latin-400.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import { Clicks } from "./Clicks";
import "./globals.css";

// Served from the packages, not fetched from Google Fonts at build: that fetch failed CI whenever Google's answer
// carried no font file. The display face is for the title logo and menus; the book face for subtitles and hints.
const fonts = { "--display": "'Cinzel'", "--book": "'IM Fell English'", "--bookSc": "'IM Fell English SC'" } as React.CSSProperties;

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
