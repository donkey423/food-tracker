import * as C from './core.js';

const LS = 'nl.v1';
const DEFAULT_MODEL = 'gemini-flash-latest';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x) => (Math.round(x * 10) / 10).toLocaleString('zh-TW');
const confLabel = (c) => ({ high: '高', medium: '中', low: '低' }[c] || '低');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

let db = load();
let curDate = C.localDateStr(new Date());
let editing = null;
let quickFoods = [];

function load() {
  const base = { entries: [], favorites: [], settings: { apiKey: '', model: DEFAULT_MODEL, lastBackup: '' } };
  try {
    const d = JSON.parse(localStorage.getItem(LS) || '{}');
    return { entries: d.entries || [], favorites: d.favorites || [], settings: { ...base.settings, ...(d.settings || {}) } };
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

// ---------- 分頁 ----------
function show(tab) {
  document.querySelectorAll('section.tab').forEach((s) => (s.hidden = s.id !== tab));
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  ({ today: renderToday, add: renderAdd, stats: renderStats, settings: renderSettings })[tab]();
  window.scrollTo(0, 0);
}

// ---------- 今日 ----------
function macroBar(m) {
  if (!m.protein && !m.carbs && !m.fat) return '';
  return `<div class="bar"><i class="p" style="width:${m.protein}%"></i><i class="c" style="width:${m.carbs}%"></i><i class="f" style="width:${m.fat}%"></i></div>
  <div class="legend"><span class="p">蛋白質 ${m.protein}%</span><span class="c">碳水 ${m.carbs}%</span><span class="f">脂肪 ${m.fat}%</span></div>`;
}
function totalsGrid(t) {
  return C.NUTRIENTS.map((n) => `<div class="stat"><span>${n.label}</span><b>${fmt(t[n.k])}</b><small>${n.unit}</small></div>`).join('');
}
function entryRow(e) {
  const fav = db.favorites.includes(e.name);
  const n = e.nutrients;
  const est = e.confidence && e.confidence !== 'high' ? ` · <span class="warn">估算・可信度${confLabel(e.confidence)}</span>` : '';
  return `<div class="entry"><div class="grow"><b>${esc(e.name)}</b>
    <small>${fmt(e.servings)} 份 · ${fmt(n.kcal)} kcal · 蛋白 ${fmt(n.protein)}g · 脂 ${fmt(n.fat)}g · 碳 ${fmt(n.carbs)}g${est}</small></div>
    <button class="icon" data-fav="${esc(e.name)}" aria-label="設為常用">${fav ? '★' : '☆'}</button>
    <button class="icon" data-del="${e.id}" aria-label="刪除">✕</button></div>`;
}
function renderToday() {
  $('#date').value = curDate;
  const list = db.entries.filter((e) => e.date === curDate).sort((a, b) => a.time.localeCompare(b.time));
  const t = C.sumEntries(list);
  $('#totals').innerHTML = totalsGrid(t);
  $('#macro').innerHTML = macroBar(C.macroSplit(t));
  $('#entries').innerHTML = list.length
    ? C.MEALS.map((meal) => {
        const es = list.filter((e) => e.meal === meal);
        if (!es.length) return '';
        return `<h3>${meal}<small>${fmt(C.sumEntries(es).kcal)} kcal</small></h3>` + es.map(entryRow).join('');
      }).join('')
    : '<p class="empty">這天還沒有紀錄，點下方「新增」開始。</p>';
  const last = db.settings.lastBackup;
  const stale = db.entries.length >= 10 && (!last || (Date.now() - new Date(last)) / 864e5 > 7);
  $('#backupHint').hidden = !stale;
}

// ---------- 新增 ----------
function renderAdd() {
  $('#meal').innerHTML = C.MEALS.map((m) => `<option>${m}</option>`).join('');
  $('#meal').value = curDate === C.localDateStr(new Date()) ? C.defaultMeal(new Date()) : '午餐';
  $('#addDate').textContent = curDate;
  if (!editing) $('#editor').innerHTML = '';
  quickFoods = C.foodLibrary(db.entries, db.favorites).slice(0, 40);
  $('#quick').innerHTML = quickFoods.length
    ? quickFoods.map((f, i) => `<button class="qitem" data-q="${i}"><span>${f.fav ? '★ ' : ''}${esc(f.name)}</span><small>${fmt(f.perServing?.kcal || 0)} kcal/份</small></button>`).join('')
    : '<p class="empty">存過的食物會出現在這裡，下次一鍵加入。</p>';
}

function blankItem() {
  return { name: '', portion: '', nutrients: C.normalizeNutrients({}), servings: 1, confidence: null, kcalRange: null };
}

function itemCard(it, i, meta) {
  const conf = it.confidence
    ? `<small class="${it.confidence === 'high' ? 'ok' : 'warn'}">可信度：${confLabel(it.confidence)}${it.kcalRange ? `，熱量約 ${it.kcalRange[0]}–${it.kcalRange[1]} kcal` : ''}</small>`
    : '';
  const pkg = meta.servingsPerPackage ? `<button type="button" class="ghost small" data-pkg="${meta.servingsPerPackage}">整包（${meta.servingsPerPackage} 份）</button>` : '';
  return `<fieldset class="card" data-i="${i}">
    <div class="row"><label class="inc"><input type="checkbox" data-f="include" checked> 加入</label>${conf}</div>
    <input class="name" data-f="name" value="${esc(it.name)}" placeholder="食物名稱">
    ${it.portion ? `<small>每份：${esc(it.portion)}</small>` : ''}
    <div class="row"><label class="sv">份數 <input type="number" inputmode="decimal" step="0.1" min="0" data-f="servings" value="${it.servings ?? 1}"></label>${pkg}</div>
    <div class="grid">${C.NUTRIENTS.map((n) => `<label>${n.label}<input type="number" inputmode="decimal" step="any" min="0" data-f="${n.k}" value="${it.nutrients[n.k]}"><small>${n.unit}／份</small></label>`).join('')}</div>
    <p class="check"></p>
  </fieldset>`;
}

function openEditor(items, source, meta = {}, header = '') {
  editing = { source, meta, portions: items.map((it) => it.portion || '') };
  $('#editor').innerHTML =
    header +
    (meta.notes ? `<p class="note">${esc(meta.notes)}</p>` : '') +
    `<div id="cards">${items.map((it, i) => itemCard(it, i, meta)).join('')}</div>
    <div class="row actions"><button type="button" class="ghost" id="addItem">＋ 再加一項</button>
    <button type="button" class="ghost" id="cancelEdit">取消</button><button type="button" class="primary" id="saveItems">儲存</button></div>`;
  updateChecks();
  $('#editor').scrollIntoView({ behavior: 'smooth' });
}

function readCards() {
  return [...document.querySelectorAll('#cards fieldset')].map((fs) => {
    const g = (f) => fs.querySelector(`[data-f="${f}"]`);
    const per = {};
    for (const k of C.KEYS) per[k] = g(k).value;
    return {
      include: g('include').checked,
      name: g('name').value.trim(),
      servings: C.num(g('servings').value),
      perServing: C.normalizeNutrients(per),
      i: +fs.dataset.i,
    };
  });
}

function updateChecks() {
  readCards().forEach((c) => {
    const tot = C.scale(c.perServing, c.servings);
    const chk = C.energyCheck(c.perServing);
    const el = document.querySelector(`#cards fieldset[data-i="${c.i}"] .check`);
    el.innerHTML = `合計：${fmt(tot.kcal)} kcal · 蛋白 ${fmt(tot.protein)}g · 脂 ${fmt(tot.fat)}g · 碳 ${fmt(tot.carbs)}g` +
      (chk.ok ? '' : `<br><span class="warn">⚠ 熱量和三大營養素換算（約 ${chk.calc} kcal）差距較大，請確認數值</span>`);
  });
}

function saveEditor() {
  const cards = readCards().filter((c) => c.include && c.name && c.servings > 0);
  if (!cards.length) return toast('沒有可儲存的項目（需要名稱與份數）');
  const time = new Date().toTimeString().slice(0, 5);
  const meal = $('#meal').value;
  for (const c of cards) {
    db.entries.push({
      id: uid(), date: curDate, time, meal, name: c.name, servings: c.servings,
      portion: editing.portions[c.i] || '', perServing: c.perServing,
      nutrients: C.scale(c.perServing, c.servings), source: editing.source,
      confidence: editing.source === 'photo-food' ? editing.meta.items?.[c.i]?.confidence || null : null,
    });
  }
  save();
  editing = null;
  toast(`已加入 ${cards.length} 項`);
  show('today');
}

// ---------- 照片辨識 ----------
async function downscale(file, max = 1280) {
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
  return c.toDataURL('image/jpeg', 0.82);
}

const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-2.5-flash'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastPhoto = '';

async function requestGemini(model, b64) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(db.settings.apiKey)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: C.PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    });
  } catch {
    throw new Error('網路連線失敗，請確認網路後重試');
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
  return j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
}

function explainError(e) {
  if (!e.status) return e;
  if (e.status === 429) return new Error('免費額度已用完或請求太頻繁，請稍後再試，或先改用手動輸入');
  if ([400, 401, 403].includes(e.status) && /api key/i.test(e.detail)) return new Error('API Key 無效，請到「設定」重新貼上');
  if (e.status >= 500) return new Error('Google 伺服器目前忙碌（已自動重試並切換備用模型），請過幾分鐘再按「重試辨識」');
  return new Error(`辨識失敗（HTTP ${e.status}）${e.detail ? '：' + e.detail : ''}`);
}

// 伺服器忙碌（5xx）時重試一次，再換備用模型；模型不存在（404）直接換下一個
async function callGemini(b64) {
  const models = [...new Set([db.settings.model || DEFAULT_MODEL, ...FALLBACK_MODELS])];
  let last;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return C.parseAIResult(await requestGemini(model, b64));
      } catch (e) {
        last = e;
        if ([500, 502, 503, 504].includes(e.status)) {
          if (attempt === 0) { await sleep(1500); continue; }
          break;
        }
        if (e.status === 404) break;
        throw explainError(e);
      }
    }
  }
  throw explainError(last);
}

async function runAnalysis(dataUrl) {
  $('#editor').innerHTML = '<p class="busy">照片辨識中…（伺服器忙碌時會自動重試，最多約十秒）</p>';
  const thumb = `<img class="thumb" src="${dataUrl}" alt="">`;
  try {
    const r = await callGemini(dataUrl.split(',')[1]);
    if (!r.items.length) {
      return openEditor([blankItem()], 'manual', {}, thumb + `<p class="err">無法辨識${r.notes ? '：' + esc(r.notes) : ''}，請手動輸入。</p>`);
    }
    const tip = r.type === 'label' ? '<p class="note">已讀取營養標示（每份數值），請確認份數。</p>' : '<p class="note">食物照為估算值，油和醬汁誤差較大，請依實際份量調整。</p>';
    openEditor(r.items, r.type === 'label' ? 'photo-label' : 'photo-food', { ...r }, thumb + tip);
  } catch (e) {
    openEditor([blankItem()], 'manual', {}, thumb + `<p class="err">${esc(e.message)}</p><div class="row"><button type="button" class="primary" id="retryPhoto">重試辨識</button></div>`);
  }
}

async function analyzePhoto(file) {
  if (!file) return;
  if (!db.settings.apiKey) {
    toast('請先在「設定」填入 Gemini API Key');
    return show('settings');
  }
  $('#editor').innerHTML = '<p class="busy">處理照片中…</p>';
  try {
    lastPhoto = await downscale(file);
  } catch (e) {
    return openEditor([blankItem()], 'manual', {}, `<p class="err">${esc(e.message)}</p>`);
  }
  await runAnalysis(lastPhoto);
}

// ---------- 分析 ----------
function chartSVG(perDay) {
  const w = 320, h = 140, pad = 18;
  const max = Math.max(1, ...perDay.map((d) => d.kcal));
  const bw = (w - pad) / perDay.length;
  const bars = perDay.map((d, i) => {
    const bh = (d.kcal / max) * (h - 30);
    const x = pad + i * bw + bw * 0.15;
    return `<rect x="${x.toFixed(1)}" y="${(h - 16 - bh).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${bh.toFixed(1)}" rx="2"><title>${d.date}：${Math.round(d.kcal)} kcal</title></rect>`;
  }).join('');
  const step = Math.ceil(perDay.length / 7);
  const labels = perDay.map((d, i) => (i % step === 0 || i === perDay.length - 1)
    ? `<text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${h - 3}" text-anchor="middle">${+d.date.slice(5, 7)}/${+d.date.slice(8)}</text>` : '').join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="每日熱量">
    <text x="0" y="10" class="axis">${Math.round(max)}</text>${bars}${labels}</svg>`;
}

function renderStats() {
  const n = +$('#range').value;
  const dates = C.lastNDates(C.localDateStr(new Date()), n);
  const es = db.entries.filter((e) => dates.includes(e.date));
  const s = C.summarize(es, dates);
  if (!s.loggedDays) {
    $('#statsBody').innerHTML = '<p class="empty">這段期間沒有紀錄。</p>';
    return;
  }
  const key = $('#contribKey').value;
  const unit = C.NUTRIENTS.find((x) => x.k === key).unit;
  const top = C.topContributors(es, key, 8);
  $('#statsBody').innerHTML = `
    <p class="muted">${n} 天中有 ${s.loggedDays} 天有紀錄，平均值只計算有紀錄的日子。</p>
    <h3>每日熱量</h3>${chartSVG(s.perDay)}
    <h3>每日平均</h3><div class="totals">${totalsGrid(s.avg)}</div>${macroBar(C.macroSplit(s.avg))}
    <h3>主要來源</h3>
    ${top.length ? top.map((t) => `<div class="contrib"><span>${esc(t.name)}</span><div class="mini"><i style="width:${t.pct}%"></i></div><small>${fmt(t.value)}${unit}・${t.pct}%</small></div>`).join('') : '<p class="empty">沒有資料</p>'}`;
}

// ---------- 設定與資料 ----------
function renderSettings() {
  $('#apiKey').value = db.settings.apiKey;
  $('#model').value = db.settings.model || DEFAULT_MODEL;
  $('#dataInfo').textContent = `共 ${db.entries.length} 筆紀錄${db.settings.lastBackup ? `，上次備份 ${db.settings.lastBackup.slice(0, 10)}` : '，尚未備份'}`;
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
  document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  $('#prev').onclick = () => { curDate = C.addDays(curDate, -1); renderToday(); };
  $('#next').onclick = () => { curDate = C.addDays(curDate, 1); renderToday(); };
  $('#date').onchange = (e) => { if (e.target.value) { curDate = e.target.value; renderToday(); } };
  $('#gotoBackup').onclick = () => show('settings');

  $('#entries').onclick = (e) => {
    const del = e.target.closest('[data-del]');
    const fav = e.target.closest('[data-fav]');
    if (del && confirm('刪除這筆紀錄？')) {
      db.entries = db.entries.filter((x) => x.id !== del.dataset.del);
      save(); renderToday();
    } else if (fav) {
      const name = fav.dataset.fav;
      db.favorites = db.favorites.includes(name) ? db.favorites.filter((x) => x !== name) : [...db.favorites, name];
      save(); renderToday();
    }
  };

  $('#cam').onchange = (e) => { analyzePhoto(e.target.files[0]); e.target.value = ''; };
  $('#lib').onchange = (e) => { analyzePhoto(e.target.files[0]); e.target.value = ''; };
  $('#manual').onclick = () => openEditor([blankItem()], 'manual');
  $('#quick').onclick = (e) => {
    const q = e.target.closest('[data-q]');
    if (!q) return;
    const f = quickFoods[+q.dataset.q];
    openEditor([{ name: f.name, portion: f.portion, nutrients: C.normalizeNutrients(f.perServing), servings: 1 }], 'favorite');
  };

  const ed = $('#editor');
  ed.addEventListener('input', updateChecks);
  ed.addEventListener('click', (e) => {
    if (e.target.id === 'saveItems') saveEditor();
    else if (e.target.id === 'retryPhoto') runAnalysis(lastPhoto);
    else if (e.target.id === 'cancelEdit') { editing = null; ed.innerHTML = ''; }
    else if (e.target.id === 'addItem') {
      const cards = $('#cards');
      editing.portions.push('');
      cards.insertAdjacentHTML('beforeend', itemCard(blankItem(), cards.children.length, {}));
      updateChecks();
    } else if (e.target.dataset.pkg) {
      e.target.closest('fieldset').querySelector('[data-f="servings"]').value = e.target.dataset.pkg;
      updateChecks();
    }
  });

  $('#range').onchange = renderStats;
  $('#contribKey').innerHTML = C.NUTRIENTS.map((n) => `<option value="${n.k}">${n.label}</option>`).join('');
  $('#contribKey').value = 'protein';
  $('#contribKey').onchange = renderStats;

  $('#saveKey').onclick = () => {
    db.settings.apiKey = $('#apiKey').value.trim();
    db.settings.model = $('#model').value.trim() || DEFAULT_MODEL;
    save(); toast('已儲存設定');
  };
  $('#exportJson').onclick = async () => {
    const data = { app: 'food-log', version: 1, exportedAt: new Date().toISOString(), entries: db.entries, favorites: db.favorites };
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
      save(); renderSettings(); toast(`已匯入 ${r.added} 筆`);
    } catch { toast('檔案格式錯誤，無法匯入'); }
  };
}

bind();
show('today');
navigator.storage?.persist?.().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
