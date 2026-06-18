import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "茶饮连锁经营系统",
  description: "面向俄罗斯经营环境的茶饮连锁经营与结算系统"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
