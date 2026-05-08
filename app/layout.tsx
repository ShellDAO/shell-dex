import type { Metadata } from "next";
import "./globals.css";
import { WagmiProviderWrapper } from "@/components/WagmiProvider";

export const metadata: Metadata = {
  title: "Shell DEX",
  description: "Bootstrap workspace for the Shell DEX frontend.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <WagmiProviderWrapper>{children}</WagmiProviderWrapper>
      </body>
    </html>
  );
}
