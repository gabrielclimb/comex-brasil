import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Neo4j Comex — Grafo de Comércio Exterior",
  description:
    "Visualização do comércio exterior brasileiro a partir dos dados oficiais do Comex Stat (MDIC), conectado num grafo Neo4j.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-slate-950 text-slate-200 font-sans antialiased">{children}</body>
    </html>
  );
}
