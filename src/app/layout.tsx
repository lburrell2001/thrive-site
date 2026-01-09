// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Update these to your exact brand colors
const BRAND = {
  theme: "#E50586", // deep near-black (tab/mobile chrome)
  bg: "#3943B7",
};

export const metadata: Metadata = {
  title: {
    default: "Thrive Creative Studios",
    template: "%s · Thrive Creative Studios",
  },
  description: "Branding, Web, and UX Design Studio",
  applicationName: "Thrive Creative Studios",

  // Favicons / icons are auto-detected if you add:
  // app/icon.png, app/apple-icon.png, app/favicon.ico
  icons: {
    icon: [
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },

  // Optional: if you add app/manifest.ts (or public/manifest.webmanifest)
  // manifest: "/manifest.webmanifest",

  metadataBase: new URL("https://thrivecreativestudios.org"), // change if different
  openGraph: {
    title: "Thrive Creative Studios",
    description: "Branding, Web, and UX Design Studio",
    url: "https://thrivecreativestudios.org",
    siteName: "Thrive Creative Studios",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Thrive Creative Studios",
    description: "Branding, Web, and UX Design Studio",
  },
};

export const viewport: Viewport = {
  themeColor: BRAND.theme,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-[var(--bg)] text-[var(--fg)]">
        {children}
      </body>
    </html>
  );
}
