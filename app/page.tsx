"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  };

  type Option = {
    href: string;
    icon: string;
    title: string;
    desc: string;
    external?: boolean;
    isPublic?: boolean; // 免登入、可直接傳給房客／屋主
  };

  const groups: { title: string; options: Option[] }[] = [
    {
      title: "房源上架與招租",
      options: [
        {
          href: "/listing",
          icon: "🏢",
          title: "官網上架",
          desc: "上傳 PDF／照片，產生上架資料包",
        },
        {
          href: "/links",
          icon: "🔗",
          title: "詢問連結產生器",
          desc: "選擇房源、產生專屬詢問連結",
        },
        {
          href: "/inquiry",
          icon: "📋",
          title: "房客詢問表單",
          desc: "填寫看房需求與預約時段",
          isPublic: true,
        },
      ],
    },
    {
      title: "屋主溝通",
      options: [
        {
          href: "/ask",
          icon: "💬",
          title: "屋主問答（對話式）",
          desc: "屋主打字提問，從 37 題 FAQ 找答案",
          isPublic: true,
        },
        {
          href: "/faq",
          icon: "📖",
          title: "屋主常見問題 FAQ",
          desc: "37 題代管／包租對照",
          external: true, // public/ 靜態頁，免登入即可開
          isPublic: true,
        },
        {
          href: "/faq-diagrams",
          icon: "🗺️",
          title: "屋主常見問題 圖解",
          desc: "FAQ 裡最難用文字講清楚的 11 題，一題一張圖",
          external: true, // public/ 靜態頁，免登入即可開
          isPublic: true,
        },
        {
          href: "/daiguan",
          icon: "⚖️",
          title: "一般代管 vs 社宅代管",
          desc: "逐項比較，依房子條件給建議",
          external: true, // public/ 靜態頁，要整頁導向而非 client 路由
          isPublic: true,
        },
        {
          href: "/sign-form",
          icon: "✍️",
          title: "代管簽約資料表",
          desc: "屋主您好，為了先備妥代管合約，請協助填寫以下資料。大約需要 15–20 分鐘。",
          external: true, // public/ 靜態頁，免登入即可開
          isPublic: true,
        },
        {
          href: "/statement",
          icon: "🧾",
          title: "代管表說明",
          desc: "貼上代管表連結，白話說明這期屋主應收怎麼算",
          isPublic: true,
        },
      ],
    },
    {
      title: "試算與文件工具",
      options: [
        {
          href: "/rent-tax",
          icon: "🧮",
          title: "房東租賃所得稅試算",
          desc: "比較四種身分的年度應繳稅額",
          isPublic: true,
        },
        {
          href: "/watermark",
          icon: "🔒",
          title: "機密文件浮水印",
          desc: "權狀、契約影本蓋浮水印；照片不上傳",
          isPublic: true,
        },
        {
          href: "/payout-timeline",
          icon: "📅",
          title: "代管撥款時間軸",
          desc: "輸入契約條件，算出收租與撥款時間，產生給屋主的說明",
        },
      ],
    },
    {
      title: "內部參考",
      options: [
        {
          href: "/daiguan/guide",
          icon: "📊",
          title: "代管建議計分表",
          desc: "/daiguan 五題問卷的計分方式與談案注意事項",
          external: true, // route handler 回傳 HTML，整頁開啟
        },
        // 暫時隱藏，功能與 /scrm 頁面程式碼保留，要恢復把這段取消註解即可
        // {
        //   href: "/scrm",
        //   icon: "👤",
        //   title: "SCRM 補 UID／改名",
        //   desc: "每週一/四：補 LINE UID＋改真實姓名",
        // },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏠</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">工作助手</h1>
          <p className="text-sm text-gray-500">請選擇要使用的功能</p>
        </div>

        <div className="flex flex-col gap-8">
          {groups.map(g => (
            <section key={g.title}>
              <h2 className="text-sm font-semibold text-gray-500 mb-3 px-1">{g.title}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {g.options.map(o => (
                  <button
                    key={o.href}
                    onClick={() =>
                      o.external ? window.open(o.href, "_blank") : router.push(o.href)
                    }
                    className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:shadow-sm transition flex items-center gap-4"
                  >
                    <span className="text-2xl shrink-0">{o.icon}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-base font-semibold text-gray-800">{o.title}</span>
                        {o.isPublic && (
                          <span className="shrink-0 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                            公開
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">{o.desc}</span>
                    </span>
                    <span className="ml-auto text-gray-300">›</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={logout}
            className="mt-8 text-xs text-gray-400 hover:text-gray-600 transition"
          >
            登出
          </button>
        </div>
      </div>
    </div>
  );
}
