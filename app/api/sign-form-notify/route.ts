import { NextRequest, NextResponse } from "next/server";

// /sign-form（代管簽約資料表）送出後的 Google Chat 通知。公開 API（刻意不進 middleware matcher）。
// 資料與檔案已由 Apps Script「租寓簽約資料表上傳」存進公司 Google Drive，
// 這裡只發通知：姓名、地址、檔案數與資料夾連結，不放身分證字號、帳號等個資。
// 想發到別的聊天室就設 SIGN_FORM_CHAT_WEBHOOK_URL；沒設則沿用房客詢問的 GOOGLE_CHAT_WEBHOOK_URL。
const WEBHOOK = process.env.SIGN_FORM_CHAT_WEBHOOK_URL || process.env.GOOGLE_CHAT_WEBHOOK_URL;

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const s = (v: unknown, n = 80) => String(v ?? "").slice(0, n);
    const folderUrl = s(b.folderUrl, 200);
    // 只接受 Drive 資料夾連結，避免這支 API 被拿去亂發訊息
    if (!/^https:\/\/drive\.google\.com\/drive\/folders\/[\w-]+$/.test(folderUrl)) {
      return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    }
    if (!WEBHOOK) return NextResponse.json({ ok: true, notified: false });

    const text = [
      "✍️ *有屋主送出代管簽約資料表！*",
      `🙋 屋主：${s(b.name, 40) || "未填寫"}`,
      `🏠 物件：${s(b.address, 120) || "未填寫"}`,
      `📎 上傳檔案：${Math.max(0, Math.min(99, Number(b.fileCount) || 0))} 個`,
      `📁 資料夾：${folderUrl}`,
      "（身分證字號、帳號等個資請到資料夾查看）",
    ].join("\n");

    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ text }),
    });
    return NextResponse.json({ ok: true, notified: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
