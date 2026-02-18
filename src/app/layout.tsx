// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";

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
    default: `${SITE_NAME} | Branding, Web, and Social Media Design`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Thrive Creative Studios helps small businesses, creators, and organizations with branding, web design, UX, social media management, and graphics creation.",
  applicationName: SITE_NAME,
  metadataBase: new URL(SITE_URL),
  keywords: [
    "Thrive Creative Studios",
    "branding studio",
    "web design",
    "UX design",
    "social media management",
    "graphics creation",
    "Houston designer",
    "Houston branding studio",
    "Texas web design",
    "Instagram content management",
  ],
  authors: [{ name: "Lauren Burrell" }],
  creator: "Lauren Burrell",
  publisher: SITE_NAME,
  category: "design",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/appleicon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    title: SITE_NAME,
    description:
      "Branding, web design, UX, and social media management with graphics creation for growing brands.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} design showcase`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description:
      "Branding, web design, UX, social media management, and graphics creation.",
    images: [DEFAULT_OG_IMAGE],
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
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "en-US",
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: SITE_NAME,
    url: SITE_URL,
    image: `${SITE_URL}${DEFAULT_OG_IMAGE}`,
    description:
      "Branding, web design, UX, social media management, and graphics creation for small businesses and creators.",
    areaServed: "United States",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Houston",
      addressRegion: "TX",
      addressCountry: "US",
    },
    sameAs: [
      "https://www.instagram.com/thrivecreativestudio_/",
      "https://www.instagram.com/rootstowellnessnow/",
    ],
  };

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-[var(--bg)] text-[var(--fg)]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
