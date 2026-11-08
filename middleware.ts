import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

// 需要登入的路由：首頁、連結產生器、官網上架、房源 API、代管說明書、代管撥款時間軸、代管表名稱查詢、SCRM 補 UID（含其名單 API，含房客個資）
// （/inquiry、/api/submit、/rent-tax、/daiguan 維持公開：房客/房東可直接使用）
export const config = {
  matcher: [
    "/",
    "/links/:path*",
    "/listing/:path*",
    "/daiguan/guide",
    "/payout-timeline/:path*",
    "/scrm/:path*",
    "/api/houses/:path*",
    "/api/listing-fill/:path*",
    "/api/missing-uid/:path*",
    "/api/statement/search",
  ],
};

export async function middleware(req: NextRequest) {
  const email = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (email) return NextResponse.next();

  // 未登入：API 回 401，頁面導向 /login（帶 next 讓登入後導回原頁）
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}
