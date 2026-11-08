import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import PayoutTimeline from "./PayoutTimeline";
import "./payout-timeline.css";

// /payout-timeline：代管撥款時間軸（內部工具，middleware 保護需登入）。
// 由原本的獨立 HTML 搬過來：計算與畫面邏輯在 mount.js（原樣保留），
// 樣式在 payout-timeline.css（全部包在 .pt 底下，不影響其他頁）。
const notoSansTC = Noto_Sans_TC({
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
  variable: "--font-noto-tc",
});

export const metadata: Metadata = {
  title: "代管撥款時間軸",
  robots: { index: false, follow: false },
};

export default function PayoutTimelinePage() {
  return <PayoutTimeline fontClass={notoSansTC.variable} />;
}
