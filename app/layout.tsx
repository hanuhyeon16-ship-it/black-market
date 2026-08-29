import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "블랙마켓 — 부동산 블러핑 보드게임",
  description:
    "각자 자기 컴퓨터에서 접속해 구역을 사고, 포커 블러프로 상대를 파산시키는 온라인 1대1 보드게임.",
  openGraph: {
    title: "블랙마켓 — 부동산 블러핑 보드게임",
    description:
      "방 코드를 친구에게 보내 온라인으로 대결하세요. 구역을 인수하고 통행료를 올리며 단 한 장의 카드로 판을 뒤집을 수 있습니다.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "블랙마켓 — 부동산 블러핑 보드게임",
    description:
      "구역 · 블러프 · 파산. 친구와 온라인으로 마지막 부자를 가려보세요.",
    images: ["/og.png"],
  },
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
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
