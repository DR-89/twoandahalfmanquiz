import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://twoandahalfmanquiz.droessler89.chatgpt.site"),
  title: "Two and a Half Men Quiz Club – Multiplayer-Lore-Quiz",
  description: "Spiele mit Freunden: Two-and-a-Half-Men-Folgen und Charaktere. Gemeinsame Räume, drei Schwierigkeitsgrade und eine Session-Rangliste.",
  robots: { index: true, follow: true },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
