"use client";
import { useEffect, useRef } from "react";
import { mountPayoutTimeline } from "./mount";

// 表單與結果區的 DOM 由 mount.js 直接操作（沿用原 HTML 的寫法），
// React 只負責把骨架畫出來，之後不再重繪。
export default function PayoutTimeline({ fontClass }: { fontClass: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    return mountPayoutTimeline(rootRef.current);
  }, []);

  return (
    <div ref={rootRef} className={`pt ${fontClass}`}>
      <div className="wrap">
        <header>
          <h1>代管撥款時間軸</h1>
          <p>輸入契約條件，算出房客每月繳租和租寓撥款給屋主的時間與金額，並產生給屋主的說明。</p>
        </header>

        <div className="layout">
          <form className="panel" id="f" autoComplete="off" onSubmit={e => e.preventDefault()}>
            <label className="f">
              載入範例
              <select id="ex" defaultValue="">
                <option value="">選擇範例案件</option>
                <option value="a">源峰醇萃實驗室（10/19 簽約）</option>
                <option value="b">11/8 簽約案（押金交屋主）</option>
              </select>
            </label>

            <fieldset>
              <legend>契約</legend>
              <label className="f">
                房源名稱
                <input data-k="name" placeholder="選填，會帶入給屋主的說明" />
              </label>
              <div className="grid2">
                <label className="f">
                  簽約日
                  <input type="date" data-k="sign" />
                </label>
                <label className="f">
                  起租日
                  <input type="date" data-k="start" />
                </label>
                <label className="f">
                  租期
                  <select data-k="term">
                    <option value="12">1 年</option>
                    <option value="24">2 年</option>
                    <option value="36">3 年</option>
                  </select>
                </label>
                <label className="f">
                  月租金
                  <input data-k="rent" inputMode="numeric" placeholder="21500" />
                </label>
                <label className="f">
                  每月繳租日
                  <select data-k="payDay" id="payDay"></select>
                </label>
                <label className="f">
                  押金
                  <select data-k="depMonths">
                    <option value="0">不收</option>
                    <option value="1">一個月</option>
                    <option value="2">二個月</option>
                    <option value="3">三個月</option>
                  </select>
                </label>
              </div>
              <label className="f">
                押金保管
                <select data-k="depHolder">
                  <option value="zuyou">租寓保管</option>
                  <option value="owner">首期撥給屋主</option>
                </select>
              </label>
              <p className="hint">首期租金固定在簽約時與押金一起收。</p>
            </fieldset>

            <fieldset>
              <legend>費用</legend>
              <div className="fee-info" id="feeInfo"></div>
              <p className="hint">
                仲介服務費依租期：1 年收半個月租金，2 至 3 年收一個月租金，算在簽約當月。代管費固定為月租金 10%。
              </p>
            </fieldset>

            <fieldset>
              <legend>其他扣款</legend>
              <p className="hint">公證費、水電代墊、修繕等，選擇要算在哪個計費月份。金額先空著會標成待確認。</p>
              <div id="extras"></div>
              <button type="button" className="btn" id="addEx">
                新增扣款
              </button>
            </fieldset>

            <fieldset>
              <legend>顯示</legend>
              <div className="grid2">
                <label className="f">
                  顯示期數
                  <select data-k="periods">
                    <option value="6">前 6 期</option>
                    <option value="12">前 12 期</option>
                    <option value="999">整個租期</option>
                  </select>
                </label>
              </div>
              <p className="hint">
                每月 5 日撥款給屋主，遇國定假日順延下一工作日。每月 5 日前一工作日，租寓官方 LINE 發送代管表。
              </p>
            </fieldset>
            <button type="button" className="btn" id="clear">
              清空重填
            </button>
          </form>

          <main className="res" id="res"></main>
        </div>
      </div>
    </div>
  );
}
