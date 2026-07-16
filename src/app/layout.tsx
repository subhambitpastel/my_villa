import type { Metadata } from "next";
import { Poppins, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { chatbotEnabled } from "@/lib/chatbot/config";
import ChatbotWidget from "@/components/chatbot/ChatbotWidget";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "MyVilla",
    template: "%s | MyVilla",
  },
  description: "Book best villas around you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${nunitoSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {/* Rendered only when CHATBOT=1. Gated on the server env var (never
            NEXT_PUBLIC), so when disabled the widget and its client bundle path
            are entirely absent — the feature can't be toggled on from the
            browser. Auth and audience (guest vs owner doc) are enforced by the
            API per request. */}
        {chatbotEnabled() && <ChatbotWidget />}
      </body>
    </html>
  );
}
