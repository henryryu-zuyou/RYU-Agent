import { NextRequest, NextResponse } from "next/server";

// /sign-form（代管簽約資料表）送出後的 Google Chat 通知。公開 API（刻意不進 middleware matcher）。
// 資料與檔案已由 Apps Script「租寓簽約資料表上傳」存進公司 Google Drive，
// 這裡只發通知：姓名、電話、地址、檔案數與資料夾連結，不放身分證字號、帳號等個資。
// 兩種通知：
//   status 省略/"ok"  → 送出成功（必須帶 Drive 資料夾連結）
//   status "failed"   → 送出失敗（資料沒進 Drive），發警示讓承辦人主動聯絡屋主
// 想發到別的聊天室就設 SIGN_FORM_CHAT_WEBHOOK_URL；沒設則沿用房客詢問的 GOOGLE_CHAT_WEBHOOK_URL。
const WEBHOOK = process.env.SIGN_FORM_CHAT_WEBHOOK_URL || process.env.GOOGLE_CHAT_WEBHOOK_URL;

// 去掉換行與 Chat 格式符號，避免被拿來塞連結或排版
const clean = (v: unknown, n = 80) =>
  String(v ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[*_~`<>]/g, "")
    .trim()
    .slice(0, n);
const count = (v: unknown) => Math.max(0, Math.min(99, Number(v) || 0));

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const failed = b.status === "failed";
    const name = clean(b.name, 40) || "未填寫";
    const phone = clean(b.phone, 30) || "未填寫";
    const address = clean(b.address, 120) || "未填寫";

    let text: string;
    if (failed) {
      text = [
        "⚠️ *屋主送出代管簽約資料表失敗！資料沒有存進 Drive*",
        `🙋 屋主：${name}`,
        `📞 電話：${phone}`,
        `🏠 物件：${address}`,
        `❌ 原因：${clean(b.error, 120) || "未知"}`,
        "請主動聯絡屋主，請他重新按送出，或用 LINE 傳「複製內容」與文件。",
      ].join("\n");
    } else {
      // 資料夾 ID 會有底線，不能用 clean()；下面的 regex 已限制只能是 Drive 資料夾連結
      const folderUrl = String(b.folderUrl ?? "").trim().slice(0, 200);
      // 成功通知只接受 Drive 資料夾連結，避免這支 API 被拿去亂發訊息
      if (!/^https:\/\/drive\.google\.com\/drive\/folders\/[\w-]+$/.test(folderUrl)) {
        return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      const fails = count(b.failCount);
      const missing = clean(b.missing, 300);
      text = [
        "✍️ *有屋主送出代管簽約資料表！*",
        `🙋 屋主：${name}`,
        `🏠 物件：${address}`,
        `📎 上傳檔案：${count(b.fileCount)} 個` + (fails ? `（另有 ${fails} 個上傳失敗，請屋主改用 LINE 傳）` : ""),
        ...(missing ? [`📝 未填欄位：${missing}`] : []),
        `📁 資料夾：${folderUrl}`,
        "（身分證字號、帳號等個資請到資料夾查看）",
      ].join("\n");
    }

    if (!WEBHOOK) return NextResponse.json({ ok: true, notified: false });
    const r = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ text }),
    });
    return NextResponse.json({ ok: r.ok, notified: r.ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
