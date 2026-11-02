import { NextRequest, NextResponse } from "next/server";

// /sign-form（代管簽約資料表）：屋主上傳身分證、存摺、權狀／謄本、房屋稅單照片後，
// 用 Claude 讀出欄位，自動帶入表單。公開 API（刻意不進 middleware matcher）。
// 需要 Vercel 環境變數 ANTHROPIC_API_KEY；可用 ANTHROPIC_MODEL 換模型。
// 照片只用來辨識，不在這裡儲存（存檔走 Apps Script → Google Drive）。
export const maxDuration = 60;

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_FILES = 4;
const MAX_B64 = 4_000_000; // Vercel 單次請求上限約 4.5MB

type DocType = "id" | "passbook" | "deed" | "tax";
const S = (description: string) => ({ type: "string", description });

const DOCS: Record<DocType, { label: string; props: Record<string, unknown> }> = {
  id: {
    label: "中華民國國民身分證（可能是正面、背面或兩面）",
    props: {
      name: S("姓名（正面）"),
      idno: S("統一編號／身分證字號，1 個英文字母＋9 碼數字（正面）"),
      regAddr: S("住址＝戶籍地址（背面），完整照抄含鄰里"),
    },
  },
  passbook: {
    label: "銀行或郵局存摺封面（或封面內頁）",
    props: {
      bank: S("銀行名稱，例：國泰世華商業銀行；郵局填「中華郵政」"),
      branch: S("分行名稱，例：林口分行"),
      acctName: S("戶名"),
      acctNo: S("帳號，只留數字與連字號"),
    },
  },
  deed: {
    label: "建物所有權狀或建物登記謄本（第一類謄本）",
    props: {
      city: S("建物門牌的縣市，臺一律寫成台，例：桃園市"),
      dist: S("建物門牌的鄉鎮市區，例：龜山區"),
      addr: S("建物門牌縣市區之後的部分（路街段巷弄號樓之），例：文化二路34巷14弄6號6樓之2"),
      area: S("建物總面積（平方公尺）＝主建物＋附屬建物＋共有部分持分面積；只能找到總面積就填總面積；只填數字"),
      floors: S("建物總層數（整棟幾層），只填數字"),
      encumb: S("謄本才判斷：他項權利部有抵押權等登記填「是」、明載無他項權利填「否」；權狀或看不出來留空"),
      encumbType: S("他項權利種類，例：最高限額抵押權；權利人可一併寫，例：最高限額抵押權（國泰世華銀行）"),
      seizure: S("謄本才判斷：有查封、假扣押等限制登記填「是」、明確沒有填「否」；看不出來留空"),
    },
  },
  tax: {
    label: "房屋稅繳款書／房屋稅單",
    props: {
      taxNo: S("房屋稅籍編號（稅籍編號），只留數字"),
      city: S("房屋坐落的縣市，臺一律寫成台"),
      dist: S("房屋坐落的鄉鎮市區"),
      addr: S("房屋坐落縣市區之後的部分（路街段巷弄號樓之）"),
    },
  },
};

// 簡易防濫用：同一 IP 10 分鐘最多 30 次（serverless 各實例分開計，只擋明顯亂打）
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 600_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 30;
}

export async function POST(req: NextRequest) {
  // 只接受本站頁面呼叫
  const origin = req.headers.get("origin") || "";
  const host = req.headers.get("host") || "";
  if (origin && !origin.endsWith("//" + host)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  if (!API_KEY) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });

  try {
    const body = await req.json();
    const docType = body.docType as DocType;
    const doc = DOCS[docType];
    const files = Array.isArray(body.files) ? body.files.slice(0, MAX_FILES) : [];
    if (!doc || !files.length) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    let total = 0;
    const content: unknown[] = [];
    for (const f of files) {
      const data = String(f.data || "");
      const mime = String(f.mime || "");
      total += data.length;
      if (total > MAX_B64) return NextResponse.json({ ok: false, error: "too large" }, { status: 413 });
      if (mime === "application/pdf") {
        content.push({ type: "document", source: { type: "base64", media_type: mime, data } });
      } else if (/^image\/(jpeg|png|webp|gif)$/.test(mime)) {
        content.push({ type: "image", source: { type: "base64", media_type: mime, data } });
      }
    }
    if (!content.length) return NextResponse.json({ ok: false, error: "unsupported file" }, { status: 400 });
    content.push({
      type: "text",
      text:
        `以上是屋主上傳的「${doc.label}」。請讀出欄位並呼叫 extract 工具回傳。\n` +
        "規則：只填文件上清楚看得到的內容，看不清楚或沒有的欄位一律填空字串，不要猜測或補字。" +
        "如果圖片明顯不是這類文件，所有欄位都留空。",
    });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        tools: [
          {
            name: "extract",
            description: "回傳從文件讀出的欄位",
            input_schema: { type: "object", properties: doc.props, required: Object.keys(doc.props) },
          },
        ],
        tool_choice: { type: "tool", name: "extract" },
        messages: [{ role: "user", content }],
      }),
    });
    if (!r.ok) return NextResponse.json({ ok: false, error: "ai " + r.status }, { status: 502 });
    const j = await r.json();
    const use = (j.content || []).find((c: { type: string }) => c.type === "tool_use");
    const raw = (use?.input || {}) as Record<string, unknown>;
    const fields: Record<string, string> = {};
    for (const k of Object.keys(doc.props)) {
      const v = String(raw[k] ?? "").trim().slice(0, 200);
      if (v) fields[k] = v;
    }
    return NextResponse.json({ ok: true, fields });
  } catch {
    return NextResponse.json({ ok: false, error: "server error" }, { status: 500 });
  }
}
