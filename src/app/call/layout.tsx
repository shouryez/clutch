import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Incoming call · Clutch" };
export const viewport: Viewport = { themeColor: "#0b0b0a", width: "device-width", initialScale: 1, maximumScale: 1 };

export default function CallLayout({ children }: LayoutProps<"/call">) {
  return children;
}
