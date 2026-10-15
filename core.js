// 純函式：營養計算、AI 結果解析、統計。可在 Node 測試。
export const NUTRIENTS = [
  { k: 'kcal', label: '熱量', unit: 'kcal' },
  { k: 'protein', label: '蛋白質', unit: 'g' },
  { k: 'fat', label: '脂肪', unit: 'g' },
  { k: 'carbs', label: '碳水', unit: 'g' },
  { k: 'fiber', label: '膳食纖維', unit: 'g' },
  { k: 'sodium', label: '鈉', unit: 'mg' },
];
export const KEYS = NUTRIENTS.map((n) => n.k);
export const MEALS = ['早餐', '午餐', '晚餐', '點心'];

export const PROMPT = `你是營養分析助手。先判斷照片是「營養標示」(label) 或「食物」(food)。只輸出 JSON，不要其他文字，格式：
{"type":"label"|"food","items":[{"name":"繁體中文名稱","portion":"每份份量描述","kcal":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"sodium":0,"confidence":"high"|"medium"|"low","kcal_low":0,"kcal_high":0}],"servings_per_package":null,"notes":"簡短說明"}
規則：
- 單位：kcal 為大卡，protein/fat/carbs/fiber 為公克，sodium 為毫克。
- label：items 只放一項，數值為標示上的「每一份」；servings_per_package 填「本包裝含幾份」；若只有每100公克的數值，portion 寫「100 公克」、servings_per_package 填 null。讀不到的欄位填 0 並在 notes 說明。confidence 依字跡清晰度判斷。
- food：每個可辨識的品項一項，數值為照片中的估計份量；考量台灣常見的烹調用油與醬汁；kcal_low/kcal_high 為合理熱量範圍；confidence 依辨識與份量估計把握度。
- 無法辨識時 items 為空陣列，並在 notes 說明原因。`;

export const round1 = (x) => Math.round(x * 10) / 10;

export function num(v) {
  const x = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(x) && x >= 0 ? x : 0;
}

export function normalizeNutrients(o = {}) {
  const r = {};
  for (const k of KEYS) r[k] = round1(num(o?.[k]));
  return r;
}

export function scale(n, f) {
  const r = {};
  for (const k of KEYS) r[k] = round1(num(n?.[k]) * num(f));
  return r;
}

export function sumEntries(entries) {
  const t = Object.fromEntries(KEYS.map((k) => [k, 0]));
  for (const e of entries) for (const k of KEYS) t[k] += num(e.nutrients?.[k]);
  for (const k of KEYS) t[k] = round1(t[k]);
  return t;
}

// 三大營養素占熱量比例（%）
export function macroSplit(n) {
  const p = num(n.protein) * 4, c = num(n.carbs) * 4, f = num(n.fat) * 9;
  const t = p + c + f;
  if (!t) return { protein: 0, carbs: 0, fat: 0 };
  const protein = Math.round((p / t) * 100), carbs = Math.round((c / t) * 100);
  return { protein, carbs, fat: 100 - protein - carbs };
}

// 熱量與三大營養素換算是否一致（容許 20%）
export function energyCheck(n) {
  const calc = Math.round(num(n.protein) * 4 + num(n.carbs) * 4 + num(n.fat) * 9);
  const kcal = num(n.kcal);
  if (!kcal || !calc) return { ok: true, calc };
  return { ok: Math.abs(calc - kcal) / kcal <= 0.2, calc };
}

export function parseAIResult(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  let o;
  try {
    o = JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    try { o = m ? JSON.parse(m[0]) : null; } catch { o = null; }
  }
  if (!o || typeof o !== 'object') throw new Error('AI 回傳格式無法解析，請重拍或改用手動輸入');
  const type = o.type === 'label' ? 'label' : 'food';
  const items = (Array.isArray(o.items) ? o.items : []).map((it) => {
    const lo = num(it.kcal_low), hi = num(it.kcal_high);
    return {
      name: String(it.name || '').trim() || '未命名食物',
      portion: String(it.portion || '').trim(),
      nutrients: normalizeNutrients(it),
      confidence: ['high', 'medium', 'low'].includes(it.confidence) ? it.confidence : 'low',
      kcalRange: hi > 0 && hi >= lo ? [Math.round(lo), Math.round(hi)] : null,
      servings: 1,
    };
  });
  const spp = num(o.servings_per_package);
  return { type, items, servingsPerPackage: spp > 0 ? round1(spp) : null, notes: String(o.notes || '') };
}

export function localDateStr(d) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDateStr(new Date(y, m - 1, d + n));
}

export function lastNDates(endStr, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(endStr, -i));
  return out;
}

export function defaultMeal(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return '早餐';
  if (h >= 10.5 && h < 14.5) return '午餐';
  if (h >= 17 && h < 21) return '晚餐';
  return '點心';
}

export function summarize(entries, dates) {
  const perDay = dates.map((date) => {
    const es = entries.filter((e) => e.date === date);
    return { date, n: es.length, ...sumEntries(es) };
  });
  const logged = perDay.filter((p) => p.n > 0);
  const avg = {};
  for (const k of KEYS) avg[k] = logged.length ? round1(logged.reduce((s, p) => s + p[k], 0) / logged.length) : 0;
  return { perDay, loggedDays: logged.length, avg };
}

export function topContributors(entries, key, n = 5) {
  const m = new Map();
  for (const e of entries) m.set(e.name, (m.get(e.name) || 0) + num(e.nutrients?.[key]));
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  return [...m.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, v]) => ({ name, value: round1(v), pct: total ? Math.round((v / total) * 100) : 0 }));
}

// 常用食物庫：依名稱去重，常用優先，其次最近使用
export function foodLibrary(entries, favorites = []) {
  const sorted = [...entries].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const seen = new Map();
  for (const e of sorted) {
    if (!seen.has(e.name)) seen.set(e.name, { name: e.name, portion: e.portion || '', perServing: e.perServing, fav: favorites.includes(e.name) });
  }
  const list = [...seen.values()];
  return [...list.filter((f) => f.fav), ...list.filter((f) => !f.fav)];
}

export function mergeEntries(existing, incoming) {
  const ids = new Set(existing.map((e) => e.id));
  const valid = (incoming || []).filter((e) => e && e.id && e.date && e.name && !ids.has(e.id));
  return { merged: [...existing, ...valid], added: valid.length };
}

export function toCSV(entries) {
  const head = ['日期', '時間', '餐別', '食物', '份數', ...NUTRIENTS.map((n) => `${n.label}(${n.unit})`), '來源'];
  const q = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [...entries]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map((e) => [e.date, e.time, e.meal, e.name, e.servings, ...KEYS.map((k) => e.nutrients?.[k] ?? 0), e.source].map(q).join(','));
  return '\uFEFF' + [head.join(','), ...rows].join('\n');
}

// ---------- 能量消耗與熱量赤字 ----------
export const ACTIVITY = [
  { k: 'sedentary', label: '久坐', desc: '辦公室工作，幾乎不運動', f: 1.2 },
  { k: 'light', label: '輕度', desc: '每週運動 1–3 天', f: 1.375 },
  { k: 'moderate', label: '中度', desc: '每週運動 3–5 天', f: 1.55 },
  { k: 'active', label: '高度', desc: '每週運動 6–7 天', f: 1.725 },
  { k: 'very', label: '非常高', desc: '勞力工作或一天兩練', f: 1.9 },
];
export const RATES = [0, 0.25, 0.5, 0.75]; // 每週減重公斤
export const KCAL_PER_KG = 7700; // 約 1 公斤體脂的熱量（近似值）

// 有體脂率用 Katch-McArdle，否則用 Mifflin-St Jeor
export function calcBMR(p = {}) {
  const w = num(p.weight), h = num(p.height), a = num(p.age), bf = num(p.bodyFat);
  if (w > 0 && bf > 3 && bf < 60) return { value: Math.round(370 + 21.6 * w * (1 - bf / 100)), method: 'Katch-McArdle（依體脂率）' };
  if (!(w > 0 && h > 0 && a > 0) || !['male', 'female'].includes(p.sex)) return null;
  const v = 10 * w + 6.25 * h - 5 * a + (p.sex === 'male' ? 5 : -161);
  return { value: Math.round(v), method: 'Mifflin-St Jeor' };
}

export function energyPlan(p = {}) {
  const b = calcBMR(p);
  if (!b) return null;
  const act = ACTIVITY.find((x) => x.k === p.activity) || ACTIVITY[0];
  const tdee = Math.round(b.value * act.f);
  const rate = RATES.includes(num(p.rate)) ? num(p.rate) : 0;
  const wanted = Math.round((rate * KCAL_PER_KG) / 7);
  const floor = Math.max(b.value, p.sex === 'female' ? 1200 : 1500);
  let target = tdee - wanted, floorHit = false;
  if (rate > 0 && target < floor) { target = floor; floorHit = true; }
  const deficit = tdee - target;
  const w = num(p.weight), h = num(p.height);
  return {
    bmr: b.value, method: b.method, tdee, activity: act, rate, target, deficit, floorHit,
    deficitPct: tdee ? Math.round((deficit / tdee) * 100) : 0,
    weeklyKg: round1(((deficit * 7) / KCAL_PER_KG) * 100) / 100,
    protein: rate > 0 ? [Math.round(w * 1.6), Math.round(w * 2.2)] : [Math.round(w * 1.2), Math.round(w * 1.6)],
    bmi: h ? round1(w / (h / 100) ** 2) : 0,
  };
}

// 依目標熱量分配三大營養素建議量：蛋白質取下限、脂肪 25%、其餘碳水
export function macroTargets(plan) {
  if (!plan) return null;
  const protein = plan.protein[0];
  const fat = Math.round((plan.target * 0.25) / 9);
  const carbs = Math.max(0, Math.round((plan.target - protein * 4 - fat * 9) / 4));
  return { kcal: plan.target, protein, fat, carbs };
}

// 以實際平均攝取評估赤字與預估每週體重變化（負值為減少）
export function deficitReview(avgKcal, plan) {
  if (!plan || !avgKcal) return null;
  const deficit = Math.round(plan.tdee - avgKcal);
  return { deficit, weeklyKg: Math.round((-deficit * 7 / KCAL_PER_KG) * 100) / 100, vsTarget: Math.round(avgKcal - plan.target) };
}
