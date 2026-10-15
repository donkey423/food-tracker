import * as C from './core.js';

const LS = 'nl.v1';
const MODELS = {
  balanced: ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash'],
  fast: ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash-lite'],
};
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x) => (Math.round(x * 10) / 10).toLocaleString('zh-TW');
const int = (x) => Math.round(x).toLocaleString('zh-TW');
const confLabel = (c) => ({ high: '高', medium: '中', low: '低' }[c] || '低');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ICON = {
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  starO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

let db = load();
let curDate = C.localDateStr(new Date());
let curMeal = C.defaultMeal(new Date());
let editing = null;
let quickFoods = [];
let lastPhoto = '';
let range = 7;
const noThinking = new Set();

function load() {
  const base = { entries: [], favorites: [], profile: { activity: 'light', rate: 0.5 }, settings: { apiKey: '', model: '', speed: 'balanced', lastBackup: '' } };
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '{}');
    const settings = { ...base.settings, ...(d.settings || {}) };
    if (settings.model === 'gemini-flash-latest') settings.model = ''; // 舊版預設值改為自動
    return { entries: d.entries || [], favorites: d.favorites || [], profile: { ...base.profile, ...(d.profile || {}) }, settings };
  } catch {
    return base;
  }
}
function save() {
  try { localStorage.setItem(LS, JSON.stringify(db)); } catch (e) { toast('儲存失敗：' + e.message); }
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), 2600);
}
const plan = () => C.energyPlan(db.profile);

function show(tab) {
  $$('section.tab').forEach((s) => (s.hidden = s.id !== tab));
  $$('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  ({ today: renderToday, add: renderAdd, stats: renderStats, body: renderBody, settings: renderSettings })[tab]();
  window.scrollTo(0, 0);
}
function seg(el, value) {
  [...el.children].forEach((b) => b.classList.toggle('on', String(b.dataset.v) === String(value)));
}

// ---------- 今日 ----------
function dateText(d) {
  const today = C.localDateStr(new Date());
  const [y, m, dd] = d.split('-').map(Number);
  const wk = '日一二三四五六'[new Date(y, m - 1, dd).getDay()];
  const rel = d === today ? '今天' : d === C.addDays(today, -1) ? '昨天' : d === C.addDays(today, 1) ? '明天' : '';
  return { main: rel || `${m}月${dd}日`, sub: rel ? `${m}月${dd}日 週${wk}` : `週${wk}` };
}

function ringSVG(pct) {
  const r = 56, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, pct));
  return `<svg viewBox="0 0 132 132"><circle class="track" cx="66" cy="66" r="${r}" fill="none" stroke-width="12"/>
    <circle class="val" cx="66" cy="66" r="${r}" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>`;
}
function macroRow(cls, label, val, target, unit = 'g', range) {
  const max = range ? range[1] : target;
  const pct = max ? Math.min(100, (val / max) * 100) : 0;
  const shown = unit === 'mg' ? int(val) : fmt(val);
  const goal = range ? `${range[0]}–${range[1]}` : int(target || 0);
  const right = max ? `${shown} / ${goal} ${unit}${range && val > range[1] ? '（偏高）' : ''}` : `${shown} ${unit}`;
  const over = (cls === 's' && target && val > target) || (range && val > range[1]) ? ' over' : '';
  const tick = range ? `<u class="tick" style="left:${((range[0] / range[1]) * 100).toFixed(1)}%"></u>` : '';
  return `<div class="macro ${cls}${over}"><div class="top"><b>${label}</b><span>${right}</span></div><div class="meter"><i style="width:${max ? pct : 0}%"></i>${tick}</div></div>`;
}
function remainCard(t, mt) {
  if (!mt) return '';
  const pL = Math.round(mt.protein - t.protein), kL = Math.round(mt.kcal - t.kcal);
  const fL = Math.round(mt.fiber - t.fiber), sL = Math.round(mt.sodium - t.sodium);
  const rows = [
    pL > 0 ? `蛋白質還差 <b>${pL} g</b>` : `蛋白質 <span class="ok">已達標</span>`,
    kL >= 0 ? `熱量還有 <b>${int(kL)} kcal</b>` : `<span class="err">熱量已超出 ${int(-kL)} kcal</span>`,
    fL > 0 ? `纖維還差 <b>${fL} g</b>` : `纖維 <span class="ok">已達標</span>`,
    sL >= 0 ? `鈉還可以吃 <b>${int(sL)} mg</b>` : `<span class="err">鈉已超過 ${int(-sL)} mg</span>`,
  ];
  const sug = C.suggestFoods(C.foodLibrary(db.entries, db.favorites), pL, kL);
  let tip = '';
  if (sug.length) tip = `<p class="explain" style="margin:10px 0 0">常吃的食物裡，可以補：${sug.map((x) => `<b>${esc(x.name)}</b>（蛋白質 ${x.protein} g・${x.kcal} kcal）`).join('、')}</p>`;
  else if (pL >= 10 && kL < 100) tip = `<p class="explain warn" style="margin:10px 0 0">熱量快用完了，但蛋白質還差 ${pL} g，下一餐挑高蛋白、低熱量的食物（如蛋白、豆腐、雞胸肉）。</p>`;
  return `<h2>還差多少</h2><div class="card"><div class="remain">${rows.map((r) => `<span>${r}</span>`).join('')}</div>${tip}</div>`;
}

function renderToday() {
  const d = dateText(curDate);
  $('#dateLabel').textContent = d.main;
  $('#dateSub').textContent = d.sub;
  $('#date').value = curDate;
  const list = db.entries.filter((e) => e.date === curDate).sort((a, b) => a.time.localeCompare(b.time));
  const t = C.sumEntries(list);
  const p = plan();
  const mt = C.macroTargets(p);
  const split = C.macroSplit(t);
  let hero;
  if (p) {
    const left = p.target - t.kcal;
    hero = `<div class="hero">
      <div class="ring ${left < 0 ? 'over' : ''}">${ringSVG(t.kcal / p.target)}
        <div class="center"><span class="cap">${left >= 0 ? '還可以吃' : '已超出'}</span><span class="big">${int(Math.abs(left))}</span><span class="cap">kcal</span></div></div>
      <div class="facts">
        <div class="fact"><span>已攝取</span><b>${int(t.kcal)}<small>kcal</small></b></div>
        <div class="fact"><span>每日目標${p.rate ? `（減 ${p.rate} kg/週）` : ''}</span><b>${int(p.target)}<small>kcal</small></b></div>
      </div></div>
      <div class="plan-line"><span>基礎代謝 <b>${int(p.bmr)}</b></span><span>消耗 <b>${int(p.tdee)}</b></span><span>赤字 <b>${int(p.deficit)}</b></span></div>`;
  } else {
    hero = `<div class="hero"><div class="ring">${ringSVG(0)}<div class="center"><span class="cap">已攝取</span><span class="big">${int(t.kcal)}</span><span class="cap">kcal</span></div></div>
      <div class="facts"><div class="fact"><span>三大營養素熱量比</span><b style="font-size:16px">蛋白 ${split.protein}%・碳水 ${split.carbs}%・脂肪 ${split.fat}%</b></div></div></div>
      <button class="cta" id="gotoBody">→ 填寫身體資料，算出每日熱量目標與減脂赤字</button>`;
  }
  const extra = mt ? macroRow('n', '膳食纖維', t.fiber, mt.fiber) + macroRow('s', '鈉（上限）', t.sodium, mt.sodium, 'mg') : '';
  const minor = mt
    ? `<div class="minor"><span>熱量比 蛋白 ${split.protein}%・碳水 ${split.carbs}%・脂肪 ${split.fat}%</span></div>`
    : `<div class="minor"><span>纖維 <b>${fmt(t.fiber)}</b> g</span><span>鈉 <b>${int(t.sodium)}</b> mg</span></div>`;
  $('#summary').innerHTML = `${hero}<div style="height:16px"></div><div class="macros">
    ${macroRow('p', '蛋白質', t.protein, mt?.protein)}${macroRow('c', '碳水', t.carbs, mt?.carbs)}${macroRow('f', '脂肪', t.fat, mt?.fat, 'g', mt ? [mt.fatMin, mt.fatMax] : undefined)}${extra}</div>${minor}`;
  $('#remain').innerHTML = remainCard(t, mt);

  $('#entries').innerHTML = list.length
    ? C.MEALS.map((meal) => {
        const es = list.filter((e) => e.meal === meal);
        if (!es.length) return '';
        return `<h2>${meal}<small>${int(C.sumEntries(es).kcal)} kcal</small></h2><div class="card meal" style="padding:0">${es.map(entryRow).join('')}</div>`;
      }).join('')
    : `<div class="empty">這天還沒有紀錄<br><button class="btn primary" style="margin-top:12px" id="emptyAdd">＋ 新增第一筆</button></div>`;
  const last = db.settings.lastBackup;
  $('#backupHint').hidden = !(db.entries.length >= 10 && (!last || (Date.now() - new Date(last)) / 864e5 > 7));
}
function entryRow(e) {
  const fav = db.favorites.includes(e.name);
  const n = e.nutrients;
  const est = e.confidence && e.confidence !== 'high' ? `<span class="tag">估算</span>` : '';
  return `<div class="item"><div class="grow"><b>${esc(e.name)}${est}</b>
    <small>${fmt(e.servings)} 份・蛋白 ${fmt(n.protein)}g・碳水 ${fmt(n.carbs)}g・脂肪 ${fmt(n.fat)}g</small></div>
    <span class="kcal">${int(n.kcal)}</span>
    <button class="icon-btn ${fav ? 'on' : ''}" data-fav="${esc(e.name)}" aria-label="${fav ? '取消常用' : '設為常用'}">${fav ? ICON.star : ICON.starO}</button>
    <button class="icon-btn" data-del="${e.id}" aria-label="刪除">${ICON.x}</button></div>`;
}

// ---------- 新增 ----------
function renderAdd() {
  $('#mealSeg').innerHTML = C.MEALS.map((m) => `<button data-v="${m}">${m}</button>`).join('');
  seg($('#mealSeg'), curMeal);
  $('#addDate').textContent = dateText(curDate).main;
  if (!editing) $('#editor').innerHTML = '';
  $('#capture').hidden = !!editing;
  quickFoods = C.foodLibrary(db.entries, db.favorites).slice(0, 40);
  $('#quick').innerHTML = quickFoods.length
    ? quickFoods.map((f, i) => `<button class="qitem" data-q="${i}"><span class="grow">${f.fav ? '★ ' : ''}${esc(f.name)}</span><small>${int(f.perServing?.kcal || 0)} kcal</small><span class="plus">+</span></button>`).join('')
    : '<div class="empty">存過的食物會出現在這裡，下次一鍵加入</div>';
}
function blankItem() {
  return { name: '', portion: '', nutrients: C.normalizeNutrients({}), servings: 1, confidence: null, kcalRange: null };
}
function itemCard(it, i, meta) {
  const conf = it.confidence
    ? `<div class="conf ${it.confidence === 'high' ? 'ok' : 'warn'}">可信度${confLabel(it.confidence)}${it.kcalRange ? `・熱量約 ${it.kcalRange[0]}–${it.kcalRange[1]} kcal` : ''}</div>` : '';
  const chips = [0.5, 1, 1.5, 2, ...(meta.servingsPerPackage && ![0.5, 1, 1.5, 2].includes(meta.servingsPerPackage) ? [meta.servingsPerPackage] : [])]
    .map((v) => `<button type="button" class="chip" data-sv="${v}">${v === meta.servingsPerPackage ? `整包 ${v}` : v} 份</button>`).join('');
  return `<fieldset class="card edit" data-i="${i}">
    <div class="head"><input class="name grow" data-f="name" value="${esc(it.name)}" placeholder="食物名稱"><label class="check-inc"><input type="checkbox" data-f="include" checked>加入</label></div>
    ${conf}${it.portion ? `<div class="small muted">${meta.type === 'food' ? '估計份量' : '每份'}：${esc(it.portion)}</div>` : ''}
    <div class="row wrap"><div class="stepper"><button type="button" data-step="-0.5" aria-label="減少">−</button><input type="number" inputmode="decimal" step="0.1" min="0" data-f="servings" value="${it.servings ?? 1}" aria-label="份數"><button type="button" data-step="0.5" aria-label="增加">+</button></div><span class="muted small">份</span></div>
    <div class="chips">${chips}</div>
    <div class="nut">${C.NUTRIENTS.map((n) => `<label>${n.label}（${n.unit}）<input type="number" inputmode="decimal" step="any" min="0" data-f="${n.k}" value="${it.nutrients[n.k]}"></label>`).join('')}</div>
    <div class="small muted" style="margin-top:-4px">${meta.type === 'food' ? '以上為 AI 估算的整份數值，份數 1 ＝ 照片中這一份' : '以上為「每份」數值'}</div>
    <div class="sum"></div>
  </fieldset>`;
}
function openEditor(items, source, meta = {}, header = '') {
  editing = { source, meta, portions: items.map((it) => it.portion || '') };
  $('#capture').hidden = true;
  $('#editor').innerHTML = header + (meta.notes ? `<p class="note">${esc(meta.notes)}</p>` : '') +
    `<div id="cards">${items.map((it, i) => itemCard(it, i, meta)).join('')}</div>
    <button type="button" class="btn soft block" id="addItem">＋ 再加一項</button>
    <div class="actions" style="margin-top:10px"><button type="button" class="btn" id="cancelEdit">取消</button><button type="button" class="btn primary" id="saveItems">儲存到${curMeal}</button></div>`;
  updateChecks();
}
function closeEditor() {
  editing = null;
  $('#editor').innerHTML = '';
  $('#capture').hidden = false;
}
function readCards() {
  return $$('#cards fieldset').map((fs) => {
    const g = (f) => fs.querySelector(`[data-f="${f}"]`);
    const per = {};
    for (const k of C.KEYS) per[k] = g(k).value;
    return { include: g('include').checked, name: g('name').value.trim(), servings: C.num(g('servings').value), perServing: C.normalizeNutrients(per), i: +fs.dataset.i };
  });
}
function updateChecks() {
  readCards().forEach((c) => {
    const tot = C.scale(c.perServing, c.servings);
    const chk = C.energyCheck(c.perServing);
    $(`#cards fieldset[data-i="${c.i}"] .sum`).innerHTML = `合計 <b>${int(tot.kcal)} kcal</b>・蛋白 ${fmt(tot.protein)}g・碳水 ${fmt(tot.carbs)}g・脂肪 ${fmt(tot.fat)}g` +
      (chk.ok ? '' : `<div class="warn" style="margin-top:4px">⚠ 熱量和三大營養素換算（約 ${chk.calc} kcal）差距大，請確認數值</div>`);
  });
}
function saveEditor() {
  const cards = readCards().filter((c) => c.include && c.name && c.servings > 0);
  if (!cards.length) return toast('沒有可儲存的項目（需要名稱與份數）');
  const time = new Date().toTimeString().slice(0, 5);
  for (const c of cards) {
    db.entries.push({
      id: uid(), date: curDate, time, meal: curMeal, name: c.name, servings: c.servings,
      portion: editing.portions[c.i] || '', perServing: c.perServing, nutrients: C.scale(c.perServing, c.servings), source: editing.source,
      confidence: editing.source === 'photo-food' ? editing.meta.items?.[c.i]?.confidence || null : null,
    });
  }
  save();
  closeEditor();
  toast(`已加入 ${cards.length} 項到${curMeal}`);
  show('today');
}

// ---------- 照片辨識 ----------
// 縮到 1024px、品質 0.75：營養標示仍清楚，上傳量約為原本的一半
async function downscale(file, max = 1024) {
  let img;
  try { img = await createImageBitmap(file); } catch {
    img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('無法讀取照片'));
      i.src = URL.createObjectURL(file);
    });
  }
  const r = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * r);
  c.height = Math.round(img.height * r);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}
let job = null;
const DEADLINE = window.__NL_DEADLINE || 32000; // 整體最多等待毫秒
async function requestGemini(model, b64, mode) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(db.settings.apiKey)}`;
  const generationConfig = { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 2048 };
  // 降低思考強度以加速；輕量模型預設不思考，不需設定
  if (!model.includes('lite') && !noThinking.has(model)) generationConfig.thinkingConfig = { thinkingLevel: 'low' };
  const ctl = new AbortController();
  job.controller = ctl;
  const timer = setTimeout(() => ctl.abort(), Math.max(3000, Math.min(22000, DEADLINE - (Date.now() - job.t0))));
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: C.promptFor(mode) }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }], generationConfig }),
    });
  } catch (err) {
    const e = new Error(job.cancelled ? '已取消' : err.name === 'AbortError' ? '回應太慢' : '網路連線失敗，請確認網路後重試');
    e.cancelled = job.cancelled;
    e.timeout = !job.cancelled && err.name === 'AbortError';
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error?.message || ''; } catch {}
    const e = new Error(`HTTP ${res.status}`);
    e.status = res.status;
    e.detail = detail;
    throw e;
  }
  const j = await res.json();
  return j.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || '').join('') || '';
}
function explainError(e) {
  if (!e.status) return e;
  if (e.status === 429) return new Error('免費額度已用完或請求太頻繁，請稍後再試，或先改用手動輸入');
  if ([400, 401, 403].includes(e.status) && /api key/i.test(e.detail)) return new Error('API Key 無效，請到「設定」重新貼上');
  if (e.status >= 500) return new Error('Google 伺服器目前忙碌（已自動重試並切換備用模型），請過幾分鐘再按「重試辨識」');
  return new Error(`辨識失敗（HTTP ${e.status}）${e.detail ? '：' + e.detail : ''}`);
}
// 5xx 重試一次後換備用模型；逾時或 404 直接換下一個；整體超過 DEADLINE 就停止
async function callGemini(b64, mode) {
  const list = MODELS[db.settings.speed] || MODELS.balanced;
  const models = [...new Set([db.settings.model, ...list].filter(Boolean))];
  let last;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (job.cancelled) { const c = new Error('已取消'); c.cancelled = true; throw c; }
      if (Date.now() - job.t0 > DEADLINE) throw new Error(`等待超過 ${DEADLINE / 1000} 秒，先停止。可以按「重試辨識」，或改用手動輸入`);
      try {
        return C.parseAIResult(await requestGemini(model, b64, mode));
      } catch (e) {
        last = e;
        if (e.cancelled) throw e;
        if (e.timeout) break;
        if (e.status === 400 && /think/i.test(e.detail) && !noThinking.has(model)) { noThinking.add(model); continue; }
        if ([500, 502, 503, 504].includes(e.status)) {
          if (attempt === 0) { await sleep(1000); continue; }
          break;
        }
        if (e.status === 404) break;
        throw explainError(e);
      }
    }
  }
  if (last?.timeout) throw new Error('Google 回應太慢，先停止。可以按「重試辨識」，或改用手動輸入');
  throw explainError(last);
}
async function runAnalysis(dataUrl, mode = 'auto') {
  $('#capture').hidden = true;
  job = { t0: Date.now(), cancelled: false, controller: null };
  const mine = job;
  $('#editor').innerHTML = `<div class="card busy"><img class="thumb" src="${dataUrl}" alt=""><div class="spinner"></div><span>${mode === 'food' ? 'AI 正在判斷食物與份量' : '辨識中'}… <b id="elapsed">0</b> 秒</span><button type="button" class="btn" id="cancelJob" style="min-height:40px">取消</button></div>`;
  const timer = setInterval(() => { const el = $('#elapsed'); if (el) el.textContent = Math.floor((Date.now() - mine.t0) / 1000); }, 500);
  const thumb = `<img class="thumb" src="${dataUrl}" alt="">`;
  try {
    const r = await callGemini(dataUrl.split(',')[1], mode);
    if (mine.cancelled) return;
    const secs = ((Date.now() - mine.t0) / 1000).toFixed(1);
    if (!r.items.length) {
      const more = mode === 'food' ? '' : `<button type="button" class="btn primary block" id="asFood" style="margin-bottom:10px">當成食物，讓 AI 估算份量</button>`;
      return openEditor([blankItem()], 'manual', {}, thumb + `<p class="note err">${esc(r.notes || '無法辨識')}（${secs} 秒）</p>${more}<p class="note">或直接在下方手動輸入：</p>`);
    }
    const tip = r.type === 'label' ? '已讀取營養標示（每份數值），請確認份數。' : '這是 AI 依照片估算的重量與營養，油和醬汁誤差較大。吃得比較多或少，用下方份數調整。';
    openEditor(r.items, r.type === 'label' ? 'photo-label' : 'photo-food', { ...r }, thumb + `<p class="note">${tip}<span class="small">（${secs} 秒）</span></p>`);
  } catch (e) {
    if (mine.cancelled || e.cancelled) return;
    openEditor([blankItem()], 'manual', {}, thumb + `<p class="note err">${esc(e.message)}</p><button type="button" class="btn primary block" id="retryPhoto" style="margin-bottom:12px">重試辨識</button>`);
  } finally {
    clearInterval(timer);
  }
}
async function analyzePhoto(file) {
  if (!file) return;
  if (!db.settings.apiKey) {
    toast('請先在「設定」填入 Gemini API Key');
    return show('settings');
  }
  try {
    lastPhoto = await downscale(file);
  } catch (e) {
    return openEditor([blankItem()], 'manual', {}, `<p class="note err">${esc(e.message)}</p>`);
  }
  await runAnalysis(lastPhoto);
}

// ---------- 身體與目標 ----------
function renderBody() {
  const p = db.profile;
  seg($('#sexSeg'), p.sex);
  $('#pAge').value = p.age || '';
  $('#pHeight').value = p.height || '';
  $('#pWeight').value = p.weight || '';
  $('#pBodyFat').value = p.bodyFat || '';
  $('#pActivity').innerHTML = C.ACTIVITY.map((a) => `<option value="${a.k}">${a.label}：${a.desc}</option>`).join('');
  $('#pActivity').value = p.activity || 'light';
  $('#rateSeg').innerHTML = C.RATES.map((r) => `<button data-v="${r}">${r ? `減 ${r}` : '維持'}</button>`).join('');
  seg($('#rateSeg'), p.rate ?? 0);
  renderPlan();
}
function renderPlan() {
  const p = plan();
  if (!p) {
    const miss = [['sex', '性別'], ['age', '年齡'], ['height', '身高'], ['weight', '體重']].filter(([k]) => !db.profile[k]).map(([, n]) => n);
    $('#planTop').innerHTML = `<div class="card" style="margin-bottom:12px"><p class="muted" style="margin:0">還差：<b style="color:var(--fg)">${miss.join('、')}</b>。填完就會自動算出基礎代謝率、每日熱量目標和減脂赤字，不用按確定。</p></div>`;
    $('#planBody').innerHTML = '';
    return;
  }
  $('#planTop').innerHTML = `<div class="card" style="margin-bottom:12px"><div class="kpis">
      <div class="kpi main"><span>每日目標攝取${p.rate ? `（每週減 ${p.rate} 公斤）` : '（維持體重）'}</span><b>${int(p.target)}<small>kcal</small></b></div>
      <div class="kpi"><span>基礎代謝 BMR</span><b>${int(p.bmr)}<small>kcal</small></b></div>
      <div class="kpi"><span>每日總消耗 TDEE</span><b>${int(p.tdee)}<small>kcal</small></b></div>
      <div class="kpi" style="grid-column:1/-1"><span>每日熱量赤字</span><b>${int(p.deficit)}<small>kcal（${p.deficitPct}%）・預估每週減 ${p.weeklyKg} kg</small></b></div>
    </div><p class="explain" style="margin-top:10px">${int(p.tdee)} − ${int(p.deficit)} = ${int(p.target)} kcal${p.floorHit ? '（已調整到安全下限）' : ''}</p></div>`;
  const mt = C.macroTargets(p);
  const rateTxt = p.rate ? `每週減 ${p.rate} 公斤` : '維持體重';
  $('#planBody').innerHTML = `${p.floorHit ? `<div class="card"><p class="explain warn" style="margin:0">⚠ 這個速度需要的赤字太大，會讓攝取低於安全下限（${int(p.target)} kcal），已自動調整。實際約每週減 ${p.weeklyKg} kg，建議改選較慢的速度或增加活動量。</p></div>` : ''}
    <h2>建議營養素</h2><div class="card"><div class="kpis">
      <div class="kpi"><span>蛋白質</span><b>${p.protein[0]}–${p.protein[1]}<small>g</small></b></div>
      <div class="kpi"><span>脂肪（範圍）</span><b>${mt.fatMin}–${mt.fatMax}<small>g</small></b></div>
      <div class="kpi"><span>碳水</span><b>${mt.carbs}<small>g</small></b></div>
      <div class="kpi"><span>膳食纖維（至少）</span><b>${mt.fiber}<small>g</small></b></div>
      <div class="kpi" style="grid-column:1/-1"><span>鈉（上限）</span><b>${int(mt.sodium)}<small>mg</small></b></div>
    </div><p class="explain">${p.rate ? '減脂時蛋白質抓每公斤體重 1.6–2.2 g，有助於保留肌肉。' : '維持體重時蛋白質每公斤體重 1.2–1.6 g。'}脂肪建議占熱量 20–30%，落在範圍內就好，不用吃滿，也別長期低於下限；碳水以脂肪 25% 推算。今日頁蛋白質的進度條以下限為目標。</p><p class="explain" style="margin-top:8px">鈉上限 2,400 mg（約鹽 6 g）依衛福部建議。纖維為一般參考值（每 1,000 kcal 約 14 g，至少 25 g），非個人化醫療建議；有慢性病或特殊飲食需求，請依醫師或營養師指示。</p></div>
    <h2>怎麼算的</h2><div class="card"><ul class="explain" style="margin:0;padding-left:18px">
      <li>BMR 使用 ${p.method} 公式；TDEE ＝ BMR × 活動係數 ${p.activity.f}。</li>
      <li>1 公斤體脂約 ${C.KCAL_PER_KG.toLocaleString()} kcal，每週減 ${p.rate || 0} kg 需每日赤字約 ${int((p.rate * C.KCAL_PER_KG) / 7)} kcal。一般建議赤字在 TDEE 的 10–25%（你目前 ${p.deficitPct}%）。</li>
      <li>BMI ${p.bmi}。公式結果有 ±10% 誤差，請以連續 2–3 週的體重平均變化為準，再微調活動量或速度。</li>
    </ul></div>`;
}
function saveProfile() {
  const v = (id) => C.num($(id).value) || undefined;
  Object.assign(db.profile, { age: v('#pAge'), height: v('#pHeight'), weight: v('#pWeight'), bodyFat: v('#pBodyFat'), activity: $('#pActivity').value });
  save();
  renderPlan();
}

// ---------- 分析 ----------
function chartSVG(perDay, target) {
  const w = 340, h = 150, pad = 26, top = 10, base = h - 18;
  const max = Math.max(1, target || 0, ...perDay.map((d) => d.kcal)) * 1.08;
  const bw = (w - pad) / perDay.length;
  const y = (v) => base - (v / max) * (base - top);
  const bars = perDay.map((d, i) => {
    const x = pad + i * bw + bw * 0.18;
    return `<rect class="bar ${target && d.kcal > target ? 'over' : ''}" x="${x.toFixed(1)}" y="${y(d.kcal).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${(base - y(d.kcal)).toFixed(1)}" rx="3"><title>${d.date}：${Math.round(d.kcal)} kcal</title></rect>`;
  }).join('');
  const step = Math.ceil(perDay.length / 7);
  const labels = perDay.map((d, i) => (i % step === 0 || i === perDay.length - 1) ? `<text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${h - 4}" text-anchor="middle">${+d.date.slice(5, 7)}/${+d.date.slice(8)}</text>` : '').join('');
  const tl = target ? `<line class="tl" x1="${pad}" x2="${w}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}"/><text x="0" y="${(y(target) + 3).toFixed(1)}">目標</text>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="每日熱量">${tl}${bars}${labels}</svg>`;
}
function renderStats() {
  seg($('#rangeSeg'), range);
  const dates = C.lastNDates(C.localDateStr(new Date()), range);
  const es = db.entries.filter((e) => dates.includes(e.date));
  const s = C.summarize(es, dates);
  if (!s.loggedDays) {
    $('#statsBody').innerHTML = '<div class="empty">這段期間沒有紀錄</div>';
    return;
  }
  const p = plan();
  // 今天尚未結束，評估只用已完成的日子，避免高估赤字
  const today = C.localDateStr(new Date());
  const doneDates = dates.filter((d) => d < today);
  const done = C.summarize(es.filter((e) => e.date < today), doneDates);
  const rv = C.deficitReview(done.avg.kcal, p);
  let verdict = '<p class="muted" style="margin:0">到「身體」填寫資料後，這裡會評估你實際的熱量赤字與預估體重變化。</p>';
  if (p && !done.loggedDays) verdict = `<p class="verdict" style="margin:0">計畫赤字 <b>${int(p.deficit)} kcal/日</b>（消耗 ${int(p.tdee)} − 目標 ${int(p.target)}），預估每週減 <b>${p.weeklyKg} kg</b>。</p><p class="explain">今天還沒結束，不列入評估。累積至少一天完整紀錄後，這裡會改成用你實際吃的算出平均赤字。</p>`;
  if (rv) {
    const dir = rv.deficit > 0 ? `平均每日赤字 <b>${int(rv.deficit)} kcal</b>，預估每週<b>減少 ${Math.abs(rv.weeklyKg)} kg</b>` : `平均每日盈餘 <b>${int(-rv.deficit)} kcal</b>，預估每週<b>增加 ${Math.abs(rv.weeklyKg)} kg</b>`;
    const vs = Math.abs(rv.vsTarget) <= 100 ? '<span class="ok">和目標一致。</span>' : rv.vsTarget > 0 ? `<span class="warn">比目標多吃約 ${int(rv.vsTarget)} kcal/日。</span>` : `<span class="warn">比目標少吃約 ${int(-rv.vsTarget)} kcal/日${done.avg.kcal < p.bmr ? '，已低於基礎代謝，可能流失肌肉' : ''}。</span>`;
    verdict = `<p class="verdict" style="margin:0">${dir}。${vs}</p><p class="explain">依 ${done.loggedDays} 天完整紀錄（不含今天）、TDEE ${int(p.tdee)} kcal 計算；漏記的食物會讓赤字看起來比實際大。</p>`;
  }
  const keys = ['kcal', 'protein', 'carbs', 'fat'];
  const top = C.topContributors(es, 'kcal', 6);
  $('#statsBody').innerHTML = `
    <h2>熱量赤字評估 <small>${s.loggedDays}/${range} 天有紀錄</small></h2><div class="card">${verdict}</div>
    <h2>每日熱量</h2><div class="card">${chartSVG(s.perDay, p?.target)}</div>
    <h2>每日平均</h2><div class="card"><div class="kpis">${keys.map((k) => { const n = C.NUTRIENTS.find((x) => x.k === k); return `<div class="kpi"><span>${n.label}</span><b>${k === 'kcal' ? int(s.avg[k]) : fmt(s.avg[k])}<small>${n.unit}</small></b></div>`; }).join('')}</div>
      <p class="explain">纖維 ${fmt(s.avg.fiber)} g・鈉 ${int(s.avg.sodium)} mg・平均只計有紀錄的日子</p></div>
    <h2>熱量主要來源</h2><div class="card">${top.map((t) => `<div class="contrib"><span>${esc(t.name)}</span><div class="mini"><i style="width:${t.pct}%"></i></div><small>${int(t.value)} kcal・${t.pct}%</small></div>`).join('')}</div>`;
}

// ---------- 設定 ----------
function renderSettings() {
  $('#apiKey').value = db.settings.apiKey;
  $('#model').value = db.settings.model || '';
  seg($('#speedSeg'), db.settings.speed || 'balanced');
  $('#dataInfo').textContent = `共 ${db.entries.length} 筆紀錄${db.settings.lastBackup ? `・上次備份 ${db.settings.lastBackup.slice(0, 10)}` : '・尚未備份'}`;
}
async function shareOrDownload(name, text, type) {
  const blob = new Blob([text], { type });
  const file = new File([blob], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}

// ---------- 事件 ----------
function bind() {
  $$('nav button').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  $('#prev').onclick = () => { curDate = C.addDays(curDate, -1); renderToday(); };
  $('#next').onclick = () => { curDate = C.addDays(curDate, 1); renderToday(); };
  $('#date').onchange = (e) => { if (e.target.value) { curDate = e.target.value; renderToday(); } };
  $('#gotoBackup').onclick = () => show('settings');
  $('#summary').onclick = (e) => { if (e.target.closest('#gotoBody')) show('body'); };

  $('#entries').onclick = (e) => {
    const del = e.target.closest('[data-del]');
    const fav = e.target.closest('[data-fav]');
    if (e.target.closest('#emptyAdd')) return show('add');
    if (del && confirm('刪除這筆紀錄？')) {
      db.entries = db.entries.filter((x) => x.id !== del.dataset.del);
      save(); renderToday();
    } else if (fav) {
      const name = fav.dataset.fav;
      db.favorites = db.favorites.includes(name) ? db.favorites.filter((x) => x !== name) : [...db.favorites, name];
      save(); renderToday();
    }
  };

  $('#mealSeg').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    curMeal = b.dataset.v;
    seg($('#mealSeg'), curMeal);
    const s = $('#saveItems');
    if (s) s.textContent = `儲存到${curMeal}`;
  };
  $('#cam').onchange = (e) => { analyzePhoto(e.target.files[0]); e.target.value = ''; };
  $('#lib').onchange = (e) => { analyzePhoto(e.target.files[0]); e.target.value = ''; };
  $('#manual').onclick = () => openEditor([blankItem()], 'manual');
  $('#quick').onclick = (e) => {
    const q = e.target.closest('[data-q]');
    if (!q) return;
    const f = quickFoods[+q.dataset.q];
    openEditor([{ name: f.name, portion: f.portion, nutrients: C.normalizeNutrients(f.perServing), servings: 1 }], 'favorite');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const ed = $('#editor');
  ed.addEventListener('input', updateChecks);
  ed.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'saveItems') saveEditor();
    else if (t.id === 'retryPhoto') runAnalysis(lastPhoto);
    else if (t.id === 'asFood') runAnalysis(lastPhoto, 'food');
    else if (t.id === 'cancelJob') { if (job) { job.cancelled = true; job.controller?.abort(); } closeEditor(); }
    else if (t.id === 'cancelEdit') closeEditor();
    else if (t.id === 'addItem') {
      const cards = $('#cards');
      editing.portions.push('');
      cards.insertAdjacentHTML('beforeend', itemCard(blankItem(), cards.children.length, {}));
      updateChecks();
    } else if (t.dataset.step || t.dataset.sv) {
      const inp = t.closest('fieldset').querySelector('[data-f="servings"]');
      inp.value = t.dataset.sv ? t.dataset.sv : Math.max(0.5, C.round1(C.num(inp.value) + +t.dataset.step));
      updateChecks();
    }
  });

  $('#rangeSeg').onclick = (e) => { const b = e.target.closest('button'); if (b) { range = +b.dataset.v; renderStats(); } };

  $('#sexSeg').onclick = (e) => { const b = e.target.closest('button'); if (b) { db.profile.sex = b.dataset.v; seg($('#sexSeg'), b.dataset.v); saveProfile(); } };
  $('#rateSeg').onclick = (e) => { const b = e.target.closest('button'); if (b) { db.profile.rate = +b.dataset.v; seg($('#rateSeg'), b.dataset.v); saveProfile(); } };
  ['#pAge', '#pHeight', '#pWeight', '#pBodyFat'].forEach((id) => $(id).addEventListener('input', saveProfile));
  $('#pActivity').onchange = saveProfile;

  $('#speedSeg').onclick = (e) => { const b = e.target.closest('button'); if (b) { db.settings.speed = b.dataset.v; seg($('#speedSeg'), b.dataset.v); save(); } };
  $('#saveKey').onclick = () => {
    db.settings.apiKey = $('#apiKey').value.trim();
    db.settings.model = $('#model').value.trim();
    save(); toast('已儲存設定');
  };
  $('#exportJson').onclick = async () => {
    const data = { app: 'food-log', version: 2, exportedAt: new Date().toISOString(), entries: db.entries, favorites: db.favorites, profile: db.profile };
    if (await shareOrDownload(`營養記錄備份-${C.localDateStr(new Date())}.json`, JSON.stringify(data), 'application/json')) {
      db.settings.lastBackup = new Date().toISOString(); save(); renderSettings();
    }
  };
  $('#exportCsv').onclick = () => shareOrDownload(`營養記錄-${C.localDateStr(new Date())}.csv`, C.toCSV(db.entries), 'text/csv');
  $('#importFile').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      const r = C.mergeEntries(db.entries, d.entries);
      db.entries = r.merged;
      db.favorites = [...new Set([...db.favorites, ...(d.favorites || [])])];
      if (d.profile && !C.calcBMR(db.profile)) db.profile = { ...db.profile, ...d.profile };
      save(); renderSettings(); toast(`已匯入 ${r.added} 筆`);
    } catch { toast('檔案格式錯誤，無法匯入'); }
  };
}

bind();
show('today');
navigator.storage?.persist?.().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
