import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Geist_Mono } from "next/font/google";

import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700", "800", "900"],
});

const interDisplay = Inter({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://usekite.xyz";
const SITE_NAME = "Kite";
const TITLE = "Kite — Money, set free.";
const DESCRIPTION =
  "A dollar account on your phone. Earn 4.20% APY, send free to any @basename, and spend anywhere Visa works. Built on Base. No bank.";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f2" },
    { media: "(prefers-color-scheme: dark)",  color: "#000000" },
  ],
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Kite",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  keywords: [
    "Kite",
    "Kite.cash",
    "usekite.xyz",
    "stablecoin app",
    "USDC",
    "Base",
    "Coinbase Smart Wallet",
    "Basenames",
    "TestFlight",
    "money on your phone",
    "earn USDC",
    "send USDC free",
    "Visa USDC card",
    "no bank",
  ],
  authors: [{ name: "Kite by Schema Labs" }],
  creator: "Schema Labs",
  publisher: "Schema Labs",
  category: "finance",
  referrer: "origin-when-cross-origin",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@usekite",
    site: "@usekite",
  },
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
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    legalName: "Kite by Schema Labs",
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    description: DESCRIPTION,
    sameAs: [
      "https://twitter.com/usekite",
      "https://github.com/Schema-Labs-Dev/kite",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: DESCRIPTION,
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      name: "Kite by Schema Labs",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Kite",
    operatingSystem: "iOS",
    applicationCategory: "FinanceApplication",
    description: DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interDisplay.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen bg-bone text-ink font-sans">
        {children}
        <Script
          id="ld-json-organization"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
