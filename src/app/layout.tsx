import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Manrope, Archivo } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "Tereverus TV — Live Broadcast",
  description:
    "Tereverus TV. Inspire. Inform. Entertain. Your continuous live broadcast channel.",
};

export const viewport: Viewport = {
  themeColor: "#08080b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${archivo.variable}`}
    >
      <body className="bg-ink-950 font-sans text-zinc-200 antialiased">
        {children}
      </body>
    </html>
  );
}
