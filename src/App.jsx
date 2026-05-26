import { useState, useMemo, useEffect } from "react";

// ─── utils ───────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const fmtNum = (n) => Math.abs(Math.round(n)).toLocaleString("ja-JP");
const fmt = (n) => "¥" + fmtNum(n);
const today = new Date();
const cy = today.getFullYear(), cm = today.getMonth(), cd = today.getDate();
const toDS = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function getBillingDate(useDateStr, card) {
  const [y, m, d] = useDateStr.split("-").map(Number);
  const closeDay = card.closeDay === 99 ? new Date(y, m - 1 + 1, 0).getDate() : card.closeDay;
  let bm = m - 1, by = y;
  if (d > closeDay) { bm++; if (bm > 11) { bm = 0; by++; } }
  const monthsToAdd = card.payMonths || 1; // 翌月=1, 翌々月=2
  for (let i = 0; i < monthsToAdd; i++) {
    bm++; if (bm > 11) { bm = 0; by++; }
  }
  return `${by}-${pad(bm + 1)}-${pad(card.payDay)}`;
}

// ─── seed data ────────────────────────────────────────────────
const SEED_ACCOUNTS = [
  { id: "a1", name: "楽天銀行",     balance: 124000, color: "#BF0000" },
  { id: "a2", name: "三井住友銀行", balance: 88000,  color: "#006934" },
];
const SEED_CARDS = [
  { id: "c1", name: "楽天カード",       accountId: "a1", closeDay: 15, payDay: 27, payMonths: 1, color: "#BF0000" },
  { id: "c2", name: "PayPayカード",     accountId: "a1", closeDay: 15, payDay: 27, payMonths: 1, color: "#FF0033" },
  { id: "c3", name: "三井住友カード",   accountId: "a2", closeDay: 15, payDay: 26, payMonths: 1, color: "#006934" },
];
const SEED_SUBS = [];

const PRESET_SUBS = [
  { category: "動画", name: "Netflix" },
  { category: "動画", name: "Amazon Prime" },
  { category: "動画", name: "Disney+" },
  { category: "動画", name: "Hulu" },
  { category: "動画", name: "U-NEXT" },
  { category: "動画", name: "ABEMAプレミアム" },
  { category: "動画", name: "dアニメストア" },
  { category: "動画", name: "DMM TV" },
  { category: "動画", name: "DAZN" },
  { category: "動画", name: "YouTube Premium" },
  { category: "音楽", name: "Spotify" },
  { category: "音楽", name: "Apple Music" },
  { category: "音楽", name: "Amazon Music" },
  { category: "生活・固定費", name: "家賃" },
  { category: "生活・固定費", name: "電気代" },
  { category: "生活・固定費", name: "水道代" },
  { category: "生活・固定費", name: "ガス代" },
  { category: "生活・固定費", name: "スマホ代" },
  { category: "生活・固定費", name: "ジム" },
  { category: "生活・固定費", name: "その他" },
];

const PRESET_CATEGORIES = ["動画", "音楽", "生活・固定費"];

const SEED_INSTANT = [
  { id: "i1", name: "現金", icon: "💴", color: "#57534e" },
  { id: "i2", name: "PayPay", icon: "🔵", color: "#FF0033" },
  { id: "i3", name: "Suica", icon: "🚃", color: "#00A55E" },
];

const SEED_TX = [];
const SEED_INSTALLMENTS = []; // 分割払いリスト
const SEED_CYCLE_PAYMENTS = []; // サイクル払いリスト

// ─── design tokens ───────────────────────────────────────────
const PRESET_COLORS = [
  // 虹順（赤スタート）
  "#ef4444", "#f97316", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#0ea5e9", "#6366f1",
  "#a855f7", "#ec4899",
  // 無彩色
  "#111111", "#374151", "#9ca3af", "#ffffff",
];

const THEMES = {
  light: {
    bg:        "#f5f4f0",
    surface:   "#ffffff",
    surface2:  "#f0efeb",
    border:    "#e8e6e0",
    text:      "#1a1917",
    textSub:   "#78716c",
    accent:    "#1a1917",
    accentFg:  "#ffffff",
    red:       "#dc2626",
    green:     "#16a34a",
    tag:       "#1a191712",
    tagText:   "#1a1917",
    navBg:     "#ffffff",
    navBorder: "#e8e6e0",
  },
  dark: {
    bg:        "#111110",
    surface:   "#1c1b19",
    surface2:  "#242320",
    border:    "#2e2c28",
    text:      "#f5f4f0",
    textSub:   "#78716c",
    accent:    "#f5f4f0",
    accentFg:  "#111110",
    red:       "#f87171",
    green:     "#4ade80",
    tag:       "#f5f4f018",
    tagText:   "#f5f4f0",
    navBg:     "#1c1b19",
    navBorder: "#2e2c28",
  },
  warm: {
    bg:        "#1c1410",
    surface:   "#2a1f16",
    surface2:  "#36271c",
    border:    "#4a3728",
    text:      "#fef3c7",
    textSub:   "#a78a6e",
    accent:    "#f59e0b",
    accentFg:  "#1c1410",
    red:       "#fca5a5",
    green:     "#86efac",
    tag:       "#fef3c718",
    tagText:   "#fef3c7",
    navBg:     "#2a1f16",
    navBorder: "#4a3728",
  },
};

// ─── app ─────────────────────────────────────────────────────
export default function App() {
  const [themeKey, setThemeKey] = useState("light");
  const [isPremium, setIsPremium] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const T = THEMES[themeKey];

  const [page, setPage] = useState(0); // 0=record 1=home 2=subs 3=settings

  // localStorage ユーティリティ
  const loadLS = (key, fallback) => {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  };

  const [accounts, setAccounts] = useState(() => loadLS("kb_accounts_v4", SEED_ACCOUNTS));
  const [cards, setCards]       = useState(() => loadLS("kb_cards_v4", SEED_CARDS));
  const [subs, setSubs]         = useState(() => loadLS("kb_subs_v4", SEED_SUBS));
  const [txs, setTxs]           = useState(() => loadLS("kb_txs_v4", SEED_TX));
  const [installments, setInstallments] = useState(() => loadLS("kb_installments_v4", SEED_INSTALLMENTS));
  const [cyclePayments, setCyclePayments] = useState(() => loadLS("kb_cycle_v4", SEED_CYCLE_PAYMENTS));
  const [instantMethods, setInstantMethods] = useState(() => loadLS("kb_instant_v4", SEED_INSTANT));

  // localStorage sync

  // localStorage sync
  useEffect(() => { try { localStorage.setItem("kb_txs_v4", JSON.stringify(txs)); } catch {} }, [txs]);
  useEffect(() => { try { localStorage.setItem("kb_accounts_v4", JSON.stringify(accounts)); } catch {} }, [accounts]);
  useEffect(() => { try { localStorage.setItem("kb_cards_v4", JSON.stringify(cards)); } catch {} }, [cards]);
  useEffect(() => { try { localStorage.setItem("kb_subs_v4", JSON.stringify(subs)); } catch {} }, [subs]);
  useEffect(() => { try { localStorage.setItem("kb_instant_v4", JSON.stringify(instantMethods)); } catch {} }, [instantMethods]);

  // home state
  const [openAcc, setOpenAcc]   = useState(null);
  const [viewYear, setViewYear] = useState(cy);
  const [detailViewMode, setDetailViewMode] = useState("summary"); // summary | calendar
  const [viewMonth, setViewMonth] = useState(cm);

  // record form
  const [form, setForm] = useState({
    amount: "", note: "",
    method: "instant", refId: "i1",
    date: toDS(cy, cm, cd),
  });
  const [addOk, setAddOk] = useState(false);

  // subs
  const [subModal, setSubModal] = useState(false);
  const [cycleModal, setCycleModal] = useState(false);
  const [newCycle, setNewCycle] = useState({ name: "", amount: "", cycleDays: 30, startDate: toDS(cy, cm, cd) });
  const [newSub, setNewSub]     = useState({ name:"", icon:"📋", day:1, cardId:"c1", amount:"", active:true });
  const [subStep, setSubStep]     = useState(0); // 0=プリセット選択 1=詳細入力
  const [openCategory, setOpenCategory] = useState(null);

  // 編集モーダル
  const [editTx, setEditTx] = useState(null); // 編集中のtx
  const [editSub, setEditSub] = useState(null); // 編集中のサブスク

  // settings
  const [settingsSection, setSettingsSection] = useState(null);

  // サブスクの現在有効な金額を返す（次の更新日を境に切り替わる）
  const getSubAmount = (sub) => {
    if (!sub.priceHistory || sub.priceHistory.length === 0) return sub.amount;
    const now = new Date(cy, cm, cd);
    // 次の更新日を計算
    let nextUpdate = new Date(cy, cm, sub.day);
    if (cd >= sub.day) nextUpdate = new Date(cy, cm + 1, sub.day);
    // 次の更新日より前の最新の金額
    const validHistory = sub.priceHistory
      .filter(h => new Date(h.effectiveDate) <= now)
      .sort((a, b) => new Date(b.effectiveDate) - new Date(a.effectiveDate));
    return validHistory.length > 0 ? validHistory[0].amount : sub.amount;
  };

  // 分割払いの月ごとのイベントを生成
  const installmentEvents = useMemo(() => {
    const events = {};
    installments.forEach(inst => {
      for (let i = 0; i < inst.count; i++) {
        let m = inst.startMonth + i;
        let y = inst.startYear;
        while (m > 11) { m -= 12; y++; }
        const dateStr = `${y}-${pad(m + 1)}-${pad(inst.payDay || 27)}`;
        if (!events[dateStr]) events[dateStr] = [];
        events[dateStr].push({ ...inst, isInstallment: true, currentCount: i + 1 });
      }
    });
    return events;
  }, [installments]);

  // サイクル払いの発生日を計算（指定月の発生日一覧を返す）
  const getCyclePaymentDates = (payment, year, month) => {
    const dates = [];
    const start = new Date(payment.startDate);
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    let current = new Date(start);
    // 月の開始より前ならスキップしながら進める
    while (current < monthStart) {
      current = new Date(current.getTime() + payment.cycleDays * 24 * 60 * 60 * 1000);
    }
    // 月内の発生日を収集
    while (current <= monthEnd) {
      dates.push(new Date(current));
      current = new Date(current.getTime() + payment.cycleDays * 24 * 60 * 60 * 1000);
    }
    return dates;
  };

  // ── derived ──────────────────────────────────────────────
  const thisMonthStr = `${viewYear}-${pad(viewMonth + 1)}`;
  const lastMonthCm = viewMonth === 0 ? 11 : viewMonth - 1;
  const lastMonthCy = viewMonth === 0 ? viewYear - 1 : viewYear;
  const lastMonthStr = `${lastMonthCy}-${pad(lastMonthCm + 1)}`;
  const nextMonthCm = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextMonthCy = viewMonth === 11 ? viewYear + 1 : viewYear;

  // 今月引き落とし：先月のカード利用分 + 今月アクティブなサブスク（カード払い）
  const thisMonthDrop = useMemo(() => {
    const map = {}; // cardId → { card, items[], total }
    // 先月のカード取引
    txs.filter(t => t.method === "card" && t.amount > 0 && t.date.startsWith(lastMonthStr)).forEach(t => {
      if (!map[t.refId]) map[t.refId] = { items: [], total: 0 };
      map[t.refId].items.push({ label: t.note, amount: t.amount, date: t.date });
      map[t.refId].total += t.amount;
    });
    // 今月アクティブなサブスク（カード払い）
    subs.filter(s => s.active && cards.some(c => c.id === s.cardId)).forEach(s => {
      if (!map[s.cardId]) map[s.cardId] = { items: [], total: 0 };
      map[s.cardId].items.push({ label: s.name, amount: s.amount, isSub: true, icon: s.icon });
      map[s.cardId].total += s.amount;
    });
    return map;
  }, [txs, subs, lastMonthStr]);

  // 口座ごとにまとめる
  const dropByAccount = useMemo(() => {
    const map = {};
    accounts.forEach(a => { map[a.id] = { total: 0, cardLines: [] }; });
    cards.forEach(c => {
      const b = thisMonthDrop[c.id];
      if (!b || !map[c.accountId]) return;
      map[c.accountId].total += b.total;
      map[c.accountId].cardLines.push({ card: c, billing: b });
    });
    return map;
  }, [accounts, cards, thisMonthDrop]);

  // 今月引き落とし総計
  const totalDrop = Object.values(dropByAccount).reduce((s, a) => s + a.total, 0);

  // 今月の即時払い（現金・電子マネー等）= 今月のcash/即時系tx
  const instantTxs = useMemo(() => {
    return txs.filter(t => t.method === "instant" && t.amount > 0 && t.date.startsWith(thisMonthStr));
  }, [txs, thisMonthStr]);

  // 即時払いを支払い方法別にグループ
  const instantByMethod = useMemo(() => {
    const map = {};
    instantMethods.forEach(m => { map[m.id] = { method: m, items: [], total: 0 }; });
    instantTxs.forEach(t => {
      const key = t.refId;
      if (!map[key]) map[key] = { method: instantMethods.find(m => m.id === key) || { name: key, icon: "💴", color: "#57534e" }, items: [], total: 0 };
      map[key].items.push(t);
      map[key].total += t.amount;
    });
    // 合計0のものは除外
    return Object.fromEntries(Object.entries(map).filter(([, v]) => v.total > 0));
  }, [instantTxs, instantMethods]);

  const totalInstant = instantTxs.reduce((s, t) => s + t.amount, 0);

  // 今月の合計（引き落とし＋即時払い）
  const grandTotal = totalDrop + totalInstant;

  // 来月の支払い予定 = 今月のカード利用分が来月引き落とされる
  const nextMonthScheduled = useMemo(() => {
    const map = {};
    txs.filter(t => t.method === "card" && t.amount > 0 && t.date.startsWith(thisMonthStr)).forEach(t => {
      if (!map[t.refId]) map[t.refId] = { items: [], total: 0 };
      map[t.refId].items.push({ id: t.id, label: t.note, amount: t.amount, date: t.date });
      map[t.refId].total += t.amount;
    });
    // 分割払いも追加
    Object.entries(installmentEvents).forEach(([dateStr, insts]) => {
      if (!dateStr.startsWith(thisMonthStr)) return;
      insts.forEach(inst => {
        const card = cards.find(c => c.id === inst.cardId);
        if (!card) return;
        if (!map[inst.cardId]) map[inst.cardId] = { items: [], total: 0 };
        map[inst.cardId].items.push({ id: inst.id + "_" + inst.currentCount, label: `${inst.note}（${inst.currentCount}/${inst.count}回）`, amount: inst.amount, date: dateStr });
        map[inst.cardId].total += inst.amount;
      });
    });
    return cards.filter(c => map[c.id]).map(c => {
      const bd = getBillingDate(toDS(viewYear, viewMonth, c.closeDay + 1), c);
      return { card: c, billing: map[c.id], billingDate: bd };
    });
  }, [txs, cards, thisMonthStr]);

  // payment options for form
  const payOpts = [
    ...instantMethods.map(m => ({ label: m.name, method: "instant", refId: m.id, color: m.color, icon: m.icon })),
    ...cards.map(c => ({ label: c.name, method: "card", refId: c.id, color: c.color, icon: "💳" })),
  ];

  function handleAdd() {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return;
    setTxs(p => [{ id: Date.now(), ...form, amount: amt }, ...p]);
    setForm(f => ({ ...f, amount: "", note: "" }));
    setAddOk(true);
    setTimeout(() => setAddOk(false), 1800);
  }

  function handleSaveEdit() {
    if (!editTx || !editTx.amount) return;
    setTxs(p => p.map(t => t.id === editTx.id ? { ...editTx, amount: Number(editTx.amount) } : t));
    setEditTx(null);
  }

  function addSub() {
    if (!newSub.name || !newSub.amount) return;
    setSubs(p => [...p, { ...newSub, id: "s" + Date.now(), amount: Number(newSub.amount) }]);
    setSubModal(false);
    setSubStep(0);
    setNewSub({ name:"", icon:"📋", day:1, cardId:"c1", amount:"", active:true });
  }

  // ── styles ───────────────────────────────────────────────
  const root = {
    minHeight: "100vh",
    width: "100%",
    overflowX: "hidden",
    background: T.bg,
    color: T.text,
    fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflowX: "hidden",
  };

  const card = (extra={}) => ({
    background: T.surface,
    borderRadius: 24,
    border: `1px solid ${T.border}`,
    ...extra,
  });

  const inputStyle = {
    width: "100%",
    background: T.surface2,
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    padding: "14px 16px",
    fontSize: 15,
    color: T.text,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  };

  const NAV = [
    { id: 0, icon: "＋", label: "記録" },
    { id: 1, icon: "⊟", label: "明細" },
    { id: 2, icon: "↻", label: "固定費" },
    { id: 3, icon: "◎", label: "設定" },
  ];

  return (
    <div style={root}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>

        {/* PAGE 1 — 明細 */}
        {page === 1 && (
          <div>
            {/* タブ切り替え */}
            <div style={{ display: "flex", background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 16px" }}>
              {[["summary","集計"],["calendar","カレンダー"]].map(([mode, label]) => (
                <button key={mode} onClick={() => setDetailViewMode(mode)} style={{
                  flex: 1, padding: "12px 0", background: "none", border: "none",
                  borderBottom: `2px solid ${detailViewMode === mode ? T.accent : "transparent"}`,
                  color: detailViewMode === mode ? T.text : T.textSub,
                  fontWeight: detailViewMode === mode ? 700 : 400,
                  fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                }}>{label}</button>
              ))}
            </div>

            {/* 集計モード */}
            {detailViewMode === "summary" && (
            <div style={{ padding: "20px 18px 16px" }}>
            {/* ── 月切り替え＋合計 ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <button onClick={() => {
                  if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
                  else setViewMonth(m => m - 1);
                  setOpenAcc(null);
                }} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: "pointer", color: T.textSub, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{viewYear}年{viewMonth + 1}月</p>
                  {(viewYear !== cy || viewMonth !== cm) && (
                    <button onClick={() => { setViewYear(cy); setViewMonth(cm); setOpenAcc(null); }}
                      style={{ fontSize: 10, color: T.textSub, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>今月に戻る</button>
                  )}
                </div>
                <button onClick={() => {
                  if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
                  else setViewMonth(m => m + 1);
                  setOpenAcc(null);
                }} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: "pointer", color: T.textSub, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
              </div>
              <p style={{ fontSize: 14, color: T.textSub, marginBottom: 6 }}>合計</p>
              <p style={{ fontSize: 46, fontWeight: 900, letterSpacing: -2, color: T.text }}>
                {fmt(grandTotal)}
              </p>
            </div>

            {/* ── 今月引き落とし（先月クレカ分）── */}
            <Section label={`${viewMonth + 1}月の引き落とし`} sub={`${lastMonthCm + 1}月のクレカ利用分`} total={fmt(totalDrop)} T={T}>
              {accounts.map((acc, idx) => {
                const ab = dropByAccount[acc.id] || { total: 0, cardLines: [] };
                if (ab.total === 0) return null;
                const isOpen = openAcc === acc.id;
                return (
                  <div key={acc.id}>
                    {idx > 0 && <div style={{ height: 1, background: T.border }} />}
                    <button onClick={() => setOpenAcc(isOpen ? null : acc.id)} style={{
                      width: "100%", display: "flex", alignItems: "center",
                      padding: "14px 14px", background: "none", border: "none",
                      cursor: "pointer", textAlign: "left",
                    }}>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.text }}>{acc.name}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.text, marginRight: 8 }}>{fmt(ab.total)}</span>
                      <span style={{ fontSize: 11, color: T.textSub, display: "inline-block", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▽</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: "0 14px 14px" }}>
                        {ab.cardLines.map(({ card: c, billing }) => (
                          <div key={c.id} style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: T.textSub }}>{c.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{fmt(billing.total)}</span>
                            </div>
                            {billing.items.map((item, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: T.surface2, marginBottom: 3 }}>
                                <span style={{ fontSize: 12, color: T.text }}>{item.icon ? item.icon + " " : item.isSub ? "🔄 " : ""}{item.label}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{fmt(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {totalDrop === 0 && <p style={{ fontSize: 12, color: T.textSub, padding: "12px 14px" }}>先月のカード利用なし</p>}
            </Section>

            {/* ── 即時払い合計（現金・電子マネー等）── */}
            <Section label="即時払い" sub={`現金・電子マネー等 ${viewMonth + 1}月分`} total={fmt(totalInstant)} T={T}>
              {Object.values(instantByMethod).length === 0
                ? <p style={{ fontSize: 12, color: T.textSub, padding: "12px 14px" }}>今月の即時払いなし</p>
                : Object.values(instantByMethod).map(({ method: m, items, total }, idx) => {
                  const isOpen = openAcc === "instant_" + m.id;
                  return (
                    <div key={m.id}>
                      {idx > 0 && <div style={{ height: 1, background: T.border }} />}
                      <button onClick={() => setOpenAcc(isOpen ? null : "instant_" + m.id)} style={{
                        width: "100%", display: "flex", alignItems: "center",
                        padding: "13px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, marginRight: 10, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.text }}>{m.name}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.text, marginRight: 8 }}>{fmt(total)}</span>
                        <span style={{ fontSize: 11, color: T.textSub, display: "inline-block", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▽</span>
                      </button>
                      {isOpen && (
                        <div style={{ padding: "0 14px 14px" }}>
                          {items.sort((a,b) => b.date.localeCompare(a.date)).map((t, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderRadius: 8, background: T.surface2, marginBottom: 3, gap: 8 }}>
                              <span style={{ flex: 1, fontSize: 12, color: T.text }}>{t.date.slice(5).replace("-","/")} {t.note}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{fmt(t.amount)}</span>
                              <button onClick={() => setEditTx({ ...t, amount: String(t.amount) })}
                                style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 10, color: T.textSub, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>編集</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              }
            </Section>

            {/* ── 来月の支払い予定（今月のカード利用分）── */}
            {nextMonthScheduled.length > 0 && (
              <Section
                label={`${nextMonthCm + 1}月の支払い予定`}
                sub={`${viewMonth + 1}月のカード利用分`}
                total={fmt(nextMonthScheduled.reduce((s, x) => s + x.billing.total, 0))}
                T={T}
              >
                {nextMonthScheduled.map(({ card: c, billing, billingDate }, idx) => {
                  const isOpen = openAcc === "next_" + c.id;
                  return (
                    <div key={c.id}>
                      {idx > 0 && <div style={{ height: 1, background: T.border }} />}
                      <button onClick={() => setOpenAcc(isOpen ? null : "next_" + c.id)} style={{
                        width: "100%", display: "flex", alignItems: "center",
                        padding: "14px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, marginRight: 10, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 1 }}>{c.name}</p>
                          <p style={{ fontSize: 10, color: T.textSub }}>{billingDate.slice(5).replace("-","/")} 引き落とし予定</p>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.text, marginRight: 8 }}>{fmt(billing.total)}</span>
                        <span style={{ fontSize: 11, color: T.textSub, display: "inline-block", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▽</span>
                      </button>
                      {isOpen && (
                        <div style={{ padding: "0 14px 14px" }}>
                          {billing.items.map((item, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderRadius: 8, background: T.surface2, marginBottom: 3, gap: 8 }}>
                              <span style={{ flex: 1, fontSize: 12, color: T.text }}>
                                {item.date ? item.date.slice(5).replace("-","/") + " " : ""}{item.label}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{fmt(item.amount)}</span>
                              {item.id && (
                                <button onClick={() => setEditTx({ ...txs.find(t => t.id === item.id), amount: String(item.amount) })}
                                  style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 10, color: T.textSub, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>編集</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Section>
            )}
            <div style={{ height: 8 }} />
            </div>
            )}

            {/* カレンダーモード */}
            {detailViewMode === "calendar" && (() => {
              const fd2 = new Date(viewYear, viewMonth, 1).getDay();
              const td2 = new Date(viewYear, viewMonth + 1, 0).getDate();
              const cells2 = Array.from({length: fd2 + td2}, (_, i) => i < fd2 ? null : i - fd2 + 1);
              while (cells2.length % 7 !== 0) cells2.push(null);
              const WD = ["日","月","火","水","木","金","土"];
              const dayEvts = {};
              txs.filter(t => t.date && t.date.startsWith(`${viewYear}-${pad(viewMonth+1)}`)).forEach(t => {
                const d = Number(t.date.split("-")[2]);
                if (!dayEvts[d]) dayEvts[d] = [];
                dayEvts[d].push({ amount: t.amount, note: t.note, kind: t.method });
              });
              subs.filter(s => s.active).forEach(s => {
                if (s.day >= 1 && s.day <= td2) {
                  if (!dayEvts[s.day]) dayEvts[s.day] = [];
                  dayEvts[s.day].push({ amount: s.amount, note: s.name, kind: "subscription" });
                }
              });
              // サイクル払い
              cyclePayments.forEach(cp => {
                const dates = getCyclePaymentDates(cp, viewYear, viewMonth);
                dates.forEach(d => {
                  const day = d.getDate();
                  if (!dayEvts[day]) dayEvts[day] = [];
                  dayEvts[day].push({ amount: cp.amount, note: cp.name, kind: "cycle" });
                });
              });
              return (
                <div style={{ paddingBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px" }}>
                    <button onClick={() => { if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); setOpenAcc(null); }} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: "pointer", color: T.textSub }}>‹</button>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{viewYear}年{viewMonth + 1}月</p>
                      {(viewYear !== cy || viewMonth !== cm) && (
                        <button onClick={() => { setViewYear(cy); setViewMonth(cm); }} style={{ fontSize: 10, color: T.textSub, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>今月に戻る</button>
                      )}
                    </div>
                    <button onClick={() => { if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); setOpenAcc(null); }} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: "pointer", color: T.textSub }}>›</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                    {WD.map((w,i) => <div key={w} style={{ textAlign: "center", fontSize: 10, padding: "6px 0", color: i===0?"#ef4444":i===6?"#3b82f6":T.textSub }}>{w}</div>)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, background: T.border }}>
                    {cells2.map((day, idx) => {
                      if (!day) return <div key={idx} style={{ background: T.surface, minHeight: 58 }} />;
                      const evts = dayEvts[day] || [];
                      const total = evts.reduce((s, e) => s + e.amount, 0);
                      const isToday2 = viewYear===cy && viewMonth===cm && day===cd;
                      const dow2 = (fd2 + day - 1) % 7;
                      return (
                        <div key={day} style={{ background: T.surface, minHeight: 58, padding: "5px 4px" }}>
                          <div style={{ fontSize: 11, fontWeight: isToday2?900:400, color: dow2===0?"#ef4444":dow2===6?"#3b82f6":T.text, marginBottom: 2 }}>
                            {isToday2 ? <span style={{ background: T.accent, color: T.accentFg, borderRadius: "50%", width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>{day}</span> : day}
                          </div>
                          {total > 0 && <div style={{ fontSize: 9, fontWeight: 700, color: T.textSub }}>{total >= 10000 ? `¥${(total/10000).toFixed(1)}万` : `¥${total.toLocaleString()}`}</div>}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 1, marginTop: 2 }}>
                            {evts.slice(0,3).map((e,i) => <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: e.kind==="subscription"?"#ea580c":e.kind==="card"?"#7c3aed":"#e11d48" }} />)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 14, padding: "10px 16px" }}>
                    {[["#e11d48","即時払い"],["#7c3aed","カード"],["#ea580c","サブスク"],["#0ea5e9","振込予定"]].map(([color, label]) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                        <span style={{ fontSize: 10, color: T.textSub }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {/* PAGE 0 — 記録 */}
        {page === 0 && (
          <div style={{ padding: "14px 16px 16px", overflowX: "hidden" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* 金額 */}
              <div style={{ ...card(), padding: "14px 16px" }}>
                <p style={{ fontSize: 11, color: T.textSub, letterSpacing: 2, marginBottom: 10 }}>金額</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 22, color: T.textSub, fontWeight: 300 }}>¥</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    style={{
                      flex: 1, background: "none", border: "none", outline: "none",
                      fontSize: 32, fontWeight: 900, color: T.text, fontFamily: "inherit",
                      letterSpacing: -1,
                    }}
                  />
                </div>
              </div>

              {/* メモ */}
              <div style={{ ...card(), padding: "12px 16px" }}>
                <p style={{ fontSize: 11, color: T.textSub, letterSpacing: 2, marginBottom: 10 }}>メモ</p>
                <input
                  type="text"
                  placeholder="スーパー、外食..."
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: 17, color: T.text, fontFamily: "inherit", boxSizing: "border-box" }}
                />
              </div>

              {/* 種別 */}
              <div style={{ ...card(), padding: "12px 16px" }}>
                <p style={{ fontSize: 11, color: T.textSub, letterSpacing: 2, marginBottom: 12 }}>種別</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 0 }}>
                  {[
                    ["instant", "即時払い"],
                    ["card",    "カード"],
                    ["income",  "収入"],
                    ["installment", "分割払い"],
                  ].map(([val, lbl]) => (
                    <button key={val}
                      onClick={() => setForm(f => ({ ...f, type: val }))}
                      style={{
                        padding: "11px 8px", borderRadius: 12, border: "2px solid",
                        borderColor: form.type === val ? T.accent : T.border,
                        background: form.type === val ? T.accent + "18" : "transparent",
                        color: form.type === val ? T.text : T.textSub,
                        fontWeight: form.type === val ? 700 : 400,
                        fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                      }}>{lbl}</button>
                  ))}
                </div>
              </div>

              {/* 支払い方法 */}
              {(form.type === "instant" || form.type === "card") && (
              <div style={{ ...card(), padding: "12px 16px" }}>
                <p style={{ fontSize: 11, color: T.textSub, letterSpacing: 2, marginBottom: 12 }}>支払い方法</p>
                <select
                  value={`${form.method}__${form.refId || "null"}`}
                  onChange={e => {
                    const [method, refId] = e.target.value.split("__");
                    setForm(f => ({ ...f, method, refId: refId === "null" ? null : refId }));
                  }}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 12,
                    border: `1.5px solid ${T.border}`, background: T.surface2,
                    color: T.text, fontSize: 14, fontFamily: "inherit", outline: "none",
                  }}
                >
                  {payOpts.map(opt => (
                    <option key={opt.method + opt.refId} value={`${opt.method}__${opt.refId || "null"}`}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              )}

              {/* 分割払いトグル */}
              <div style={{ ...card(), padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: T.text }}>分割払い</p>

                  </div>
                  <button onClick={() => setForm(f => ({ ...f, isInstallment: !f.isInstallment, date: !f.isInstallment ? f.date.slice(0,7) : f.date.slice(0,7) + "-01" }))}
                    style={{ width: 44, height: 24, borderRadius: 99, border: "none", cursor: "pointer",
                      background: form.isInstallment ? T.accent : T.surface2, position: "relative", transition: "background .2s" }}>
                    <span style={{ position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%",
                      background: form.isInstallment ? T.accentFg : T.textSub,
                      left: form.isInstallment ? 22 : 3, transition: "left .2s" }} />
                  </button>
                </div>
                {form.isInstallment && (
                  <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 10, color: T.textSub, marginBottom: 6 }}>分割回数</p>
                      <select value={form.installCount || 12}
                        onChange={e => setForm(f => ({ ...f, installCount: Number(e.target.value) }))}
                        style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 14, color: T.text, fontFamily: "inherit", outline: "none" }}>
                        {[2,3,6,10,12,15,18,24,30,36,48,60,72,84,96].map(n => <option key={n} value={n}>{n}回払い</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 10, color: T.textSub, marginBottom: 6 }}>月々の金額入力</p>
                      <p style={{ fontSize: 11, color: T.textSub, background: T.surface2, borderRadius: 10, padding: "8px 12px" }}>上の金額欄に入力</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 日付 */}
              <div style={{ ...card(), padding: "12px 16px" }}>
                <input
                  type={form.isInstallment ? "month" : "date"}
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={{ background: "none", border: "none", outline: "none", fontSize: 17, fontWeight: 600, color: T.text, fontFamily: "inherit" }}
                />
                {/* クレカ請求予定日 */}
                {form.method === "card" && form.refId && (() => {
                  const c = cards.find(x => x.id === form.refId);
                  if (!c) return null;
                  const bd = getBillingDate(form.date, c);
                  return (
                    <p style={{ fontSize: 11, color: T.textSub, marginTop: 8 }}>
                      📅 請求予定日：{bd.slice(5).replace("-","/")} ({c.name})
                    </p>
                  );
                })()}
              </div>

              {/* 送信 */}
              <button
                onClick={handleAdd}
                style={{
                  width: "100%", padding: "14px", borderRadius: 18, border: "none",
                  background: addOk ? "#16a34a" : T.accent,
                  color: addOk ? "#fff" : T.accentFg,
                  fontSize: 16, fontWeight: 800, cursor: "pointer",
                  fontFamily: "inherit", transition: "background .3s",
                  marginTop: 4,
                }}
              >
                {addOk ? "✓ 記録しました" : "記録する"}
              </button>

            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            PAGE 2 — サブスク / 固定費
        ══════════════════════════════════ */}
        {page === 2 && (
          <div style={{ padding: "28px 18px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <p style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>
                サブスク / 固定費
              </p>
              <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setCycleModal(true)}
                style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 12, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                振込追加
              </button>
              <button
                onClick={() => setSubModal(true)}
                style={{
                  background: T.accent, color: T.accentFg, border: "none",
                  borderRadius: 12, padding: "8px 16px", fontSize: 13,
                  fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                ＋ 追加
              </button>
            </div>

            {/* 合計 */}
            <div style={{ ...card(), padding: "18px 20px", marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: T.textSub, letterSpacing: 2, marginBottom: 4 }}>月額合計（有効）</p>
              <p style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>
                {fmt(subs.filter(s => s.active).reduce((a, s) => a + getSubAmount(s), 0))}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* サイクル払い一覧 */}
            {cyclePayments.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: T.textSub, marginBottom: 10, letterSpacing: 1 }}>サイクル払い</p>
                {cyclePayments.map(cp => {
                  const nextDates = getCyclePaymentDates(cp, cy, cm);
                  const nextDate = nextDates[0] ? `${nextDates[0].getMonth()+1}/${nextDates[0].getDate()}` : "-";
                  return (
                    <div key={cp.id} style={{ ...card(), padding: "12px 16px", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <p style={{ fontSize: 14, fontWeight: 700 }}>{cp.name}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <p style={{ fontSize: 14, fontWeight: 700 }}>{fmt(cp.amount)}</p>
                          <button onClick={() => setCyclePayments(p => p.filter(x => x.id !== cp.id))}
                            style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "3px 8px", fontSize: 11, color: T.textSub, cursor: "pointer", fontFamily: "inherit" }}>削除</button>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 11, color: T.textSub, background: T.surface2, borderRadius: 8, padding: "3px 8px" }}>{cp.cycleDays}日ごと</span>
                        <span style={{ fontSize: 11, color: T.textSub, background: T.surface2, borderRadius: 8, padding: "3px 8px" }}>次回 {nextDate}</span>
                        <span style={{ fontSize: 11, color: T.textSub, background: T.surface2, borderRadius: 8, padding: "3px 8px" }}>手動振込</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {subs.map(sub => {
                const c = cards.find(x => x.id === sub.cardId) || accounts.find(x => x.id === sub.cardId);
                return (
                  <div key={sub.id} style={{
                    ...card(),
                    padding: "16px 18px",
                    opacity: sub.active ? 1 : 0.45,
                    transition: "opacity .2s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <p style={{ fontSize: 15, fontWeight: 700 }}>{sub.name}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 15, fontWeight: 700 }}>{fmt(getSubAmount(sub))}</p>
                          {sub.priceHistory && sub.priceHistory.length > 0 && (() => {
                            const now = new Date(cy, cm, cd);
                            let nextUpdate = new Date(cy, cm, sub.day);
                            if (cd >= sub.day) nextUpdate = new Date(cy, cm + 1, sub.day);
                            const pending = sub.priceHistory.find(h => new Date(h.effectiveDate) > now);
                            if (pending) return <p style={{ fontSize: 9, color: T.textSub }}>{pending.effectiveDate.slice(5).replace("-","/")}〜 {fmt(pending.amount)}</p>;
                          })()}
                        </div>
                        <button onClick={() => setEditSub({ ...sub, newAmount: String(getSubAmount(sub)) })}
                          style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: T.textSub, cursor: "pointer", fontFamily: "inherit" }}>編集</button>
                        {/* toggle */}
                        <button
                          onClick={() => setSubs(p => p.map(s => s.id === sub.id ? { ...s, active: !s.active } : s))}
                          style={{
                            width: 44, height: 24, borderRadius: 99, border: "none",
                            background: sub.active ? T.accent : T.surface2,
                            cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0,
                          }}
                        >
                          <span style={{
                            position: "absolute", top: 3, width: 18, height: 18,
                            borderRadius: "50%",
                            background: sub.active ? T.accentFg : T.textSub,
                            left: sub.active ? 23 : 3,
                            transition: "left .2s",
                          }} />
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{
                        fontSize: 11, color: T.textSub,
                        background: T.surface2, borderRadius: 8, padding: "3px 8px",
                      }}>
                        毎月{sub.day}日更新
                      </span>
                      {c && (
                        <span style={{
                          fontSize: 11, color: T.textSub,
                          background: T.surface2, borderRadius: 8, padding: "3px 8px",
                        }}>
                          {c.name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            PAGE 3 — 設定
        ══════════════════════════════════ */}
        {page === 3 && (
          <div style={{ padding: "28px 18px 16px" }}>
            <p style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, marginBottom: 24 }}>設定</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* クレジット/口座設定 */}
              <div style={card({ overflow: "hidden" })}>
                <button
                  onClick={() => setSettingsSection(settingsSection === "cards" ? null : "cards")}
                  style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 20px", background:"none", border:"none", cursor:"pointer", color:T.text, fontFamily:"inherit" }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600 }}>クレジット / 口座設定</span>
                  <span style={{ fontSize: 12, color: T.textSub, transform: settingsSection==="cards"?"rotate(180deg)":"none", transition:"transform .2s" }}>▽</span>
                </button>
                {settingsSection === "cards" && (
                  <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${T.border}` }}>

                    {/* カード一覧 */}
                    {cards.map((c, idx) => (
                      <div key={c.id} style={{ paddingTop: 16, borderTop: idx > 0 ? `1px solid ${T.border}` : "none", marginTop: idx > 0 ? 16 : 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{c.name}</p>
                          <button
                            onClick={() => setCards(p => p.filter(x => x.id !== c.id))}
                            style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "3px 10px", fontSize: 11, color: T.textSub, cursor: "pointer", fontFamily: "inherit" }}
                          >削除</button>
                        </div>
                        {/* カード名編集 */}
                        <div style={{ marginBottom: 8 }}>
                          <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>カード名</p>
                          <input value={c.name}
                            onChange={e => setCards(p => p.map(x => x.id===c.id?{...x,name:e.target.value}:x))}
                            style={{ ...inputStyle, padding: "9px 12px", fontSize: 13 }} />
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <p style={{ fontSize: 10, color: T.textSub, marginBottom: 6 }}>カラー</p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {PRESET_COLORS.map(col => (
                              <button key={col} onClick={() => setCards(p => p.map(x => x.id===c.id?{...x,color:col}:x))}
                                style={{
                                  width: 28, height: 28, borderRadius: "50%", border: "none",
                                  background: col, cursor: "pointer", flexShrink: 0,
                                  outline: c.color === col ? `3px solid ${T.text}` : "none",
                                  outlineOffset: 2,
                                }} />
                            ))}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>締め日</p>
                            <select value={c.closeDay}
                              onChange={e => setCards(p => p.map(x => x.id===c.id?{...x,closeDay:Number(e.target.value)}:x))}
                              style={{ ...inputStyle, padding: "9px 12px", fontSize: 13 }}>
                              {Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}日</option>)}<option value={99}>月末</option>
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>引き落とし日</p>
                            <select value={c.payDay}
                              onChange={e => setCards(p => p.map(x => x.id===c.id?{...x,payDay:Number(e.target.value)}:x))}
                              style={{ ...inputStyle, padding: "9px 12px", fontSize: 13 }}>
                              {Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}日</option>)}<option value={99}>月末</option>
                            </select>
                          </div>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>引き落とし月</p>
                          <div style={{ display: "flex", gap: 8 }}>
                            {[["翌月", 1], ["翌々月", 2]].map(([label, val]) => (
                              <button key={val} onClick={() => setCards(p => p.map(x => x.id===c.id?{...x,payMonths:val}:x))}
                                style={{
                                  flex: 1, padding: "8px", borderRadius: 8, border: "2px solid",
                                  borderColor: (c.payMonths||1) === val ? T.text : T.border,
                                  background: (c.payMonths||1) === val ? T.text : "transparent",
                                  color: (c.payMonths||1) === val ? T.surface : T.textSub,
                                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                                }}>{label}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>引き落とし口座</p>
                          <input
                            value={c.accountName || ""}
                            placeholder="例）楽天銀行、三菱UFJ..."
                            onChange={e => setCards(p => p.map(x => x.id===c.id?{...x,accountName:e.target.value}:x))}
                            style={{ ...inputStyle, padding: "9px 12px", fontSize: 13 }}
                          />
                        </div>
                      </div>
                    ))}

                    {/* カード追加ボタン */}
                    <button
                      onClick={() => {
                        if (!isPremium && cards.length >= 3) { setShowUpgrade(true); return; }
                        setCards(p => [...p, {
                          id: "c" + Date.now(),
                          name: "新しいカード",
                          accountId: accounts[0]?.id || "a1",
                          closeDay: 15,
                          payDay: 27,
                          color: "#6366f1",
                        }]);
                      }}
                      style={{
                        width: "100%", marginTop: 16, padding: "12px",
                        borderRadius: 12, border: `1.5px dashed ${T.border}`,
                        background: "none", color: T.textSub,
                        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {!isPremium && cards.length >= 3 ? "🔒 ＋ カードを追加（プレミアム）" : "＋ カードを追加"}
                    </button>


                  </div>
                )}
              </div>

              {/* 即時払い方法設定 */}
              <div style={card({ overflow: "hidden" })}>
                <button
                  onClick={() => setSettingsSection(settingsSection === "instant" ? null : "instant")}
                  style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 20px", background:"none", border:"none", cursor:"pointer", color:T.text, fontFamily:"inherit" }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600 }}>即時払い方法の設定</span>
                  <span style={{ fontSize: 12, color: T.textSub, transform: settingsSection==="instant"?"rotate(180deg)":"none", transition:"transform .2s" }}>▽</span>
                </button>
                {settingsSection === "instant" && (
                  <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${T.border}` }}>
                    {instantMethods.map((m, idx) => (
                      <div key={m.id} style={{ paddingTop: 14, borderTop: idx > 0 ? `1px solid ${T.border}` : "none", marginTop: idx > 0 ? 14 : 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{m.name}</span>
                          <button onClick={() => setInstantMethods(p => p.filter(x => x.id !== m.id))}
                            style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "3px 10px", fontSize: 11, color: T.textSub, cursor: "pointer", fontFamily: "inherit" }}>削除</button>
                        </div>
                        <input value={m.name} placeholder="名前（例：PayPay）"
                          onChange={e => setInstantMethods(p => p.map(x => x.id===m.id?{...x,name:e.target.value}:x))}
                          style={{ ...inputStyle, marginBottom: 8, padding: "9px 12px", fontSize: 13 }} />
                        <p style={{ fontSize: 10, color: T.textSub, marginBottom: 6 }}>カラー</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {PRESET_COLORS.map(col => (
                            <button key={col} onClick={() => setInstantMethods(p => p.map(x => x.id===m.id?{...x,color:col}:x))}
                              style={{
                                width: 28, height: 28, borderRadius: "50%", border: "none",
                                background: col, cursor: "pointer", flexShrink: 0,
                                outline: m.color === col ? `3px solid ${T.text}` : "none",
                                outlineOffset: 2,
                              }} />
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => setInstantMethods(p => [...p, { id: "i" + Date.now(), name: "新しい支払い方法", icon: "💳", color: "#6366f1" }])}
                      style={{ width: "100%", marginTop: 14, padding: "12px", borderRadius: 12, border: `1.5px dashed ${T.border}`, background: "none", color: T.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >＋ 追加</button>
                  </div>
                )}
              </div>

              {/* テーマ設定 */}
              <div style={card({ overflow: "hidden" })}>
                <button
                  onClick={() => setSettingsSection(settingsSection === "theme" ? null : "theme")}
                  style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 20px", background:"none", border:"none", cursor:"pointer", color:T.text, fontFamily:"inherit" }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600 }}>テーマ</span>
                  <span style={{ fontSize: 12, color: T.textSub, transform: settingsSection==="theme"?"rotate(180deg)":"none", transition:"transform .2s" }}>▽</span>
                </button>
                {settingsSection === "theme" && (
                  <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, marginTop: 16 }}>
                    {[["light","ライト","#f5f4f0","#1a1917"],["dark","ダーク","#111110","#f5f4f0"]].map(([key, label, bg, fg]) => (
                      <button key={key} onClick={() => setThemeKey(key)} style={{
                        flex: 1, padding: "14px 8px", borderRadius: 14,
                        background: bg, color: fg,
                        border: `2px solid ${themeKey===key ? T.accent : "transparent"}`,
                        fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                      }}>{label}</button>
                    ))}
                    <div style={{ width: "100%", marginTop: 8 }}>
                      <button onClick={() => { if (!isPremium) { setShowUpgrade(true); return; } }}
                        style={{
                          width: "100%", padding: "14px 8px", borderRadius: 14,
                          background: "linear-gradient(135deg, #f59e0b, #ec4899)",
                          color: "#fff", border: "none",
                          fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                          opacity: isPremium ? 1 : 0.7,
                        }}>
                        🔒 追加テーマ（プレミアム）
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* サブスクについて */}
              <div style={card({ overflow: "hidden" })}>
                <button
                  onClick={() => setSettingsSection(settingsSection === "about" ? null : "about")}
                  style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 20px", background:"none", border:"none", cursor:"pointer", color:T.text, fontFamily:"inherit" }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600 }}>サブスクについて</span>
                  <span style={{ fontSize: 12, color: T.textSub, transform: settingsSection==="about"?"rotate(180deg)":"none", transition:"transform .2s" }}>▽</span>
                </button>
                {settingsSection === "about" && (
                  <div style={{ padding: "16px 20px 20px", borderTop: `1px solid ${T.border}`, fontSize: 13, color: T.textSub, lineHeight: 1.8 }}>
                    <p>サブスク / 固定費画面では毎月自動的に発生する支払いを管理できます。</p>
                    <p style={{ marginTop: 8 }}>登録したサブスクは1ページ目の「引き落とし詳細」に自動で反映され、カードの請求合計に含まれます。</p>
                    <p style={{ marginTop: 8 }}>ON / OFF トグルで一時的に計算から除外することができます。</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>

      {/* 編集モーダル */}
      {editTx && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setEditTx(null); }}>
          <div style={{ background: T.surface, borderRadius: "24px 24px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: "100%", border: `1px solid ${T.border}` }}>
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 18, fontWeight: 800 }}>記録を編集</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* 金額 */}
              <div style={{ background: T.surface2, borderRadius: 16, border: `1px solid ${T.border}`, padding: "14px 18px" }}>
                <p style={{ fontSize: 10, color: T.textSub, letterSpacing: 2, marginBottom: 8 }}>金額</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 20, color: T.textSub }}>¥</span>
                  <input type="number" value={editTx.amount}
                    onChange={e => setEditTx(f => ({ ...f, amount: e.target.value }))}
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 32, fontWeight: 900, color: T.text, fontFamily: "inherit" }} />
                </div>
              </div>
              {/* メモ */}
              <div style={{ background: T.surface2, borderRadius: 16, border: `1px solid ${T.border}`, padding: "14px 18px" }}>
                <p style={{ fontSize: 10, color: T.textSub, letterSpacing: 2, marginBottom: 8 }}>メモ</p>
                <input type="text" value={editTx.note}
                  onChange={e => setEditTx(f => ({ ...f, note: e.target.value }))}
                  style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: 16, color: T.text, fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              {/* 支払い方法 */}
              <div style={{ background: T.surface2, borderRadius: 16, border: `1px solid ${T.border}`, padding: "14px 18px" }}>
                <p style={{ fontSize: 10, color: T.textSub, letterSpacing: 2, marginBottom: 10 }}>支払い方法</p>
                <select
                  value={`${editTx.method}__${editTx.refId || "null"}`}
                  onChange={e => {
                    const [method, refId] = e.target.value.split("__");
                    setEditTx(f => ({ ...f, method, refId: refId === "null" ? null : refId }));
                  }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}
                >
                  {payOpts.map(opt => (
                    <option key={opt.method + opt.refId} value={`${opt.method}__${opt.refId || "null"}`}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {/* 日付 */}
              <div style={{ background: T.surface2, borderRadius: 16, border: `1px solid ${T.border}`, padding: "14px 18px" }}>
                <p style={{ fontSize: 10, color: T.textSub, letterSpacing: 2, marginBottom: 8 }}>日付</p>
                <input type="date" value={editTx.date}
                  onChange={e => setEditTx(f => ({ ...f, date: e.target.value }))}
                  style={{ background: "none", border: "none", outline: "none", fontSize: 16, fontWeight: 600, color: T.text, fontFamily: "inherit" }} />
              </div>
              <button onClick={handleSaveEdit} style={{ padding: 15, borderRadius: 16, border: "none", background: T.accent, color: T.accentFg, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                保存する
              </button>
              <button onClick={() => { setTxs(p => p.filter(t => t.id !== editTx.id)); setEditTx(null); }}
                style={{ padding: 13, borderRadius: 16, border: `1px solid ${T.border}`, background: "none", color: T.textSub, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
                この明細を削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* アップグレードモーダル */}
      {showUpgrade && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}
          onClick={e => { if (e.target === e.currentTarget) setShowUpgrade(false); }}>
          <div style={{ background: T.surface, borderRadius: 24, padding: "32px 24px", width: "100%", maxWidth: "100%", border: `1px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
            <p style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, color: T.text }}>プレミアムプラン</p>
            <p style={{ fontSize: 13, color: T.textSub, marginBottom: 24, lineHeight: 1.7 }}>
              クレジットカードを無制限に登録できます。追加テーマカラーも使い放題。
            </p>
            <div style={{ background: T.surface2, borderRadius: 16, padding: "16px", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 13, color: T.textSub }}>クレジットカード登録</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>無制限</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                <span style={{ fontSize: 13, color: T.textSub }}>テーマカラー</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>全カラー解放</span>
              </div>
            </div>
            {/* デモ用：実際はここに課金処理 */}
            <button onClick={() => { setIsPremium(true); setShowUpgrade(false); }}
              style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #f59e0b, #ec4899)", color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
              プレミアムにアップグレード
            </button>
            <button onClick={() => setShowUpgrade(false)}
              style={{ width: "100%", padding: "12px", borderRadius: 14, border: `1px solid ${T.border}`, background: "none", color: T.textSub, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              無料版を続ける
            </button>
          </div>
        </div>
      )}

      {/* サブスク編集モーダル */}
      {editSub && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setEditSub(null); }}>
          <div style={{ background: T.surface, borderRadius: "24px 24px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: "100%", border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 18, fontWeight: 800 }}>{editSub.name} を編集</p>
              <button onClick={() => { setSubs(p => p.filter(s => s.id !== editSub.id)); setEditSub(null); }}
                style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.textSub, cursor: "pointer", fontFamily: "inherit" }}>削除</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* 名前 */}
              <div style={{ background: T.surface2, borderRadius: 14, border: `1px solid ${T.border}`, padding: "12px 16px" }}>
                <p style={{ fontSize: 10, color: T.textSub, letterSpacing: 2, marginBottom: 6 }}>サービス名</p>
                <input value={editSub.name} onChange={e => setEditSub(f => ({ ...f, name: e.target.value }))}
                  style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: 15, color: T.text, fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              {/* 新しい金額 */}
              <div style={{ background: T.surface2, borderRadius: 14, border: `1px solid ${T.border}`, padding: "12px 16px" }}>
                <p style={{ fontSize: 10, color: T.textSub, letterSpacing: 2, marginBottom: 6 }}>新しい月額料金</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 18, color: T.textSub }}>¥</span>
                  <input type="number" value={editSub.newAmount} onChange={e => setEditSub(f => ({ ...f, newAmount: e.target.value }))}
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 28, fontWeight: 900, color: T.text, fontFamily: "inherit" }} />
                </div>
              </div>
              {/* 更新日 */}
              <div style={{ background: T.surface2, borderRadius: 14, border: `1px solid ${T.border}`, padding: "12px 16px" }}>
                <p style={{ fontSize: 10, color: T.textSub, letterSpacing: 2, marginBottom: 6 }}>更新日</p>
                <select value={editSub.day} onChange={e => setEditSub(f => ({ ...f, day: Number(e.target.value) }))}
                  style={{ background: "none", border: "none", outline: "none", fontSize: 15, fontWeight: 600, color: T.text, fontFamily: "inherit" }}>
                  {Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}日</option>)}<option value={99}>月末</option>
                </select>
              </div>
              {/* 適用プレビュー */}
              {(() => {
                const newAmt = Number(editSub.newAmount);
                const currentAmt = getSubAmount(editSub);
                if (!newAmt || newAmt === currentAmt) return null;
                let nextUpdate = new Date(cy, cm, editSub.day);
                if (cd >= editSub.day) nextUpdate = new Date(cy, cm + 1, editSub.day);
                const dateStr = `${nextUpdate.getFullYear()}-${pad(nextUpdate.getMonth()+1)}-${pad(nextUpdate.getDate())}`;
                return (
                  <div style={{ background: T.accent + "18", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: T.text }}>
                    📅 {dateStr.slice(5).replace("-","/")}（次の更新日）以降から {fmt(newAmt)} が適用されます
                  </div>
                );
              })()}
              <button onClick={() => {
                const newAmt = Number(editSub.newAmount);
                const currentAmt = getSubAmount(editSub);
                let nextUpdate = new Date(cy, cm, editSub.day);
                if (cd >= editSub.day) nextUpdate = new Date(cy, cm + 1, editSub.day);
                const effectiveDate = `${nextUpdate.getFullYear()}-${pad(nextUpdate.getMonth()+1)}-${pad(nextUpdate.getDate())}`;
                setSubs(p => p.map(s => s.id === editSub.id ? {
                  ...s,
                  name: editSub.name,
                  day: editSub.day,
                  amount: newAmt !== currentAmt ? newAmt : s.amount,
                  priceHistory: newAmt !== currentAmt
                    ? [...(s.priceHistory || [{ amount: currentAmt, effectiveDate: toDS(cy, cm, 1) }]), { amount: newAmt, effectiveDate }]
                    : s.priceHistory,
                } : s));
                setEditSub(null);
              }} style={{ padding: 15, borderRadius: 14, border: "none", background: T.accent, color: T.accentFg, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* サイクル払い追加モーダル */}
      {cycleModal && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setCycleModal(false); }}>
          <div style={{ background: T.surface, borderRadius: "24px 24px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 430, border: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>サイクル払いを追加</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input placeholder="名前（例：○○ローン）" value={newCycle.name}
                onChange={e => setNewCycle(f => ({ ...f, name: e.target.value }))}
                style={{ ...inputStyle }} />
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.textSub, fontSize: 16 }}>¥</span>
                <input type="number" placeholder="金額" value={newCycle.amount}
                  onChange={e => setNewCycle(f => ({ ...f, amount: e.target.value }))}
                  style={{ ...inputStyle, paddingLeft: 32 }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, color: T.textSub, marginBottom: 6 }}>サイクル（日数）</p>
                  <input type="number" placeholder="30" value={newCycle.cycleDays}
                    onChange={e => setNewCycle(f => ({ ...f, cycleDays: Number(e.target.value) }))}
                    style={{ ...inputStyle }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, color: T.textSub, marginBottom: 6 }}>開始日</p>
                  <input type="date" value={newCycle.startDate}
                    onChange={e => setNewCycle(f => ({ ...f, startDate: e.target.value }))}
                    style={{ ...inputStyle }} />
                </div>
              </div>
              <button onClick={() => {
                if (!newCycle.name || !newCycle.amount) return;
                setCyclePayments(p => [...p, { ...newCycle, id: "cp" + Date.now(), amount: Number(newCycle.amount) }]);
                setCycleModal(false);
                setNewCycle({ name: "", amount: "", cycleDays: 30, startDate: toDS(cy, cm, cd) });
              }} style={{ padding: 15, borderRadius: 16, border: "none", background: T.accent, color: T.accentFg, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                追加する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          サブスク追加モーダル
      ══════════════════════════════════ */}
      {subModal && (
        <div style={{
          position: "fixed", inset: 0, background: "#00000088", zIndex: 50,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
        }}
          onClick={e => { if (e.target === e.currentTarget) setSubModal(false); }}
        >
          <div style={{
            background: T.surface, borderRadius: "0 0 24px 24px",
            padding: "16px 20px 28px", width: "100%", maxWidth: "100%",
            border: `1px solid ${T.border}`,
            maxHeight: "85vh", overflowY: "auto",
          }}>
            {/* STEP 0: プリセット選択 */}
            {subStep === 0 && (<>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <p style={{ fontSize: 18, fontWeight: 800 }}>追加するサービスを選択</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {PRESET_CATEGORIES.map(cat => {
                  const isOpen = openCategory === cat;
                  return (
                    <div key={cat} style={{ borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                      <button onClick={() => setOpenCategory(isOpen ? null : cat)} style={{
                        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "13px 16px", background: T.surface2, border: "none",
                        cursor: "pointer", fontFamily: "inherit",
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{cat}</span>
                        <span style={{ fontSize: 11, color: T.textSub, display: "inline-block", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▽</span>
                      </button>
                      {isOpen && (
                        <div style={{ borderTop: `1px solid ${T.border}` }}>
                          {PRESET_SUBS.filter(p => p.category === cat).map((p, i) => (
                            <button key={p.name} onClick={() => { setNewSub(f => ({ ...f, name: p.name, icon: "📋" })); setSubStep(1); }}
                              style={{
                                width: "100%", padding: "11px 20px",
                                borderTop: i > 0 ? `1px solid ${T.border}` : "none",
                                background: T.surface, border: "none",
                                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                fontSize: 13, color: T.text,
                              }}>
                              {p.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => { setNewSub(f => ({ ...f, name: "", icon: "📋" })); setSubStep(1); }}
                style={{
                  width: "100%", padding: "12px", borderRadius: 12,
                  border: `1.5px dashed ${T.border}`, background: "none",
                  color: T.textSub, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                ✏️ 名前を直接入力する
              </button>
            </>)}

            {/* STEP 1: 詳細入力 */}
            {subStep === 1 && (<>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <button onClick={() => setSubStep(0)} style={{ background: T.surface2, border: "none", borderRadius: 10, padding: "6px 12px", fontSize: 12, color: T.textSub, cursor: "pointer", fontFamily: "inherit" }}>← 戻る</button>
                <p style={{ fontSize: 18, fontWeight: 800 }}>{newSub.name || "カスタム"}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input placeholder="名前を入力..." value={newSub.name}
                  onChange={e => setNewSub(f => ({ ...f, name: e.target.value }))}
                  style={{ ...inputStyle }} />
                <div>
                  <p style={{ fontSize: 11, color: T.textSub, marginBottom: 6 }}>月額料金</p>
                  <div style={{ display: "flex", alignItems: "center", background: T.surface2, borderRadius: 14, border: `1px solid ${T.border}`, padding: "12px 16px" }}>
                    <span style={{ fontSize: 18, color: T.textSub, marginRight: 6 }}>¥</span>
                    <input type="number" placeholder="0" value={newSub.amount}
                      onChange={e => setNewSub(f => ({ ...f, amount: e.target.value }))}
                      style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 24, fontWeight: 800, color: T.text, fontFamily: "inherit" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, color: T.textSub, marginBottom: 6 }}>更新日</p>
                    <select value={newSub.day} onChange={e => setNewSub(f=>({...f,day:Number(e.target.value)}))} style={{ ...inputStyle }}>
                      {Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}日</option>)}<option value={99}>月末</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, color: T.textSub, marginBottom: 6 }}>支払いカード</p>
                    <select value={newSub.cardId} onChange={e => setNewSub(f=>({...f,cardId:e.target.value}))} style={{ ...inputStyle }}>
                      {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={addSub} style={{
                  padding: 16, borderRadius: 16, border: "none", marginTop: 4,
                  background: T.accent, color: T.accentFg,
                  fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                }}>追加する</button>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          ボトムナビ
      ══════════════════════════════════ */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: "100%",
        background: T.navBg,
        borderTop: `1px solid ${T.navBorder}`,
        display: "flex", padding: "10px 0 23px",
        zIndex: 30,
      }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "4px 0",
          }}>
            <span style={{
              width: 40, height: 40, borderRadius: 14,
              background: page === n.id ? T.accent : "transparent",
              color: page === n.id ? T.accentFg : T.textSub,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, transition: "all .15s",
            }}>{n.icon}</span>
            <span style={{
              fontSize: 10,
              color: page === n.id ? T.text : T.textSub,
              fontWeight: page === n.id ? 700 : 400,
            }}>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ label, sub, total, T, children }) {
  return (
    <div style={{
      background: T.surface, borderRadius: 20, border: `1px solid ${T.border}`,
      marginBottom: 12, overflow: "hidden",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 10px" }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{label}</p>
          <p style={{ fontSize: 10, color: T.textSub, marginTop: 1 }}>{sub}</p>
        </div>
        <p style={{ fontSize: 18, fontWeight: 900, color: T.text }}>{total}</p>
      </div>
      <div style={{ borderTop: `1px solid ${T.border}` }}>
        {children}
      </div>
    </div>
  );
}
