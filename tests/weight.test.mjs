import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../core.js';

const TODAY = '2026-10-15';
// 合成資料：真實 TDEE 2400、每天吃 2000 → 每天減 400/7700 公斤
function synth(days, intake = 2000, tdee = 2400, start = 80, noise = 0) {
  const weights = [], entries = [];
  for (let i = days; i >= 1; i--) {
    const date = C.addDays(TODAY, -i);
    const kg = start - ((tdee - intake) / C.KCAL_PER_KG) * (days - i) + (noise ? (i % 2 ? noise : -noise) : 0);
    weights.push({ date, kg: C.round1(kg * 10) / 10 });
    entries.push({ date, nutrients: { kcal: intake } });
  }
  return { weights, entries };
}

test('upsertWeight 同日覆寫並排序、拒絕不合理值', () => {
  let w = C.upsertWeight([], '2026-10-02', 80);
  w = C.upsertWeight(w, '2026-10-01', 80.4);
  w = C.upsertWeight(w, '2026-10-02', 79.6);
  assert.deepEqual(w, [{ date: '2026-10-01', kg: 80.4 }, { date: '2026-10-02', kg: 79.6 }]);
  assert.equal(C.upsertWeight(w, '2026-10-03', 5).length, 2);
});

test('weightTrend 取近 7 天平均', () => {
  const t = C.weightTrend([{ date: '2026-10-01', kg: 80 }, { date: '2026-10-02', kg: 81 }, { date: '2026-10-10', kg: 79 }]);
  assert.equal(t[1].avg, 80.5);
  assert.equal(t[2].avg, 79); // 前面的紀錄已超過 7 天
});

test('slopePerDay 線性', () => {
  const pts = [0, 1, 2, 3].map((i) => ({ date: C.addDays('2026-10-01', i), kg: 80 - 0.1 * i }));
  assert.ok(Math.abs(C.slopePerDay(pts) + 0.1) < 1e-9);
  assert.equal(C.slopePerDay([{ date: '2026-10-01', kg: 80 }]), 0);
});

test('calibrateTDEE 能從體重與攝取反推真實消耗', () => {
  const { weights, entries } = synth(21);
  const r = C.calibrateTDEE({ weights, entries, today: TODAY });
  assert.equal(r.ok, true);
  assert.ok(Math.abs(r.tdee - 2400) < 40, String(r.tdee));
  assert.ok(Math.abs(r.weeklyKg + 0.36) < 0.03, String(r.weeklyKg));
  assert.equal(r.avgIntake, 2000);
});

test('calibrateTDEE 對每日水分波動仍穩定', () => {
  const { weights, entries } = synth(28, 2000, 2400, 80, 0.4);
  const r = C.calibrateTDEE({ weights, entries, today: TODAY });
  assert.ok(Math.abs(r.tdee - 2400) < 150, String(r.tdee));
});

test('calibrateTDEE 資料不足不給結果', () => {
  const a = synth(4);
  assert.match(C.calibrateTDEE({ ...a, today: TODAY }).reason, /體重紀錄不足/);
  const b = synth(21);
  assert.match(C.calibrateTDEE({ weights: b.weights, entries: b.entries.slice(0, 3), today: TODAY }).reason, /飲食紀錄不足/);
  const c = synth(21);
  assert.match(C.calibrateTDEE({ weights: c.weights.slice(-6, -3), entries: c.entries, today: TODAY, minWeights: 3 }).reason, /不到 10 天/);
});

test('不完整的日子（<800 kcal）不列入平均攝取', () => {
  const { weights, entries } = synth(21);
  entries.push({ date: C.addDays(TODAY, -3), nutrients: { kcal: -1700 } }); // 該日加總降為 300
  const r = C.calibrateTDEE({ weights, entries, today: TODAY });
  assert.equal(r.avgIntake, 2000);
});

test('tdeeOverride 取代公式並反映在目標熱量', () => {
  const base = { sex: 'male', age: 35, height: 183, weight: 80, activity: 'light', rate: 0.25 };
  const a = C.energyPlan(base), b = C.energyPlan({ ...base, tdeeOverride: 2300 });
  assert.equal(a.calibrated, false);
  assert.equal(b.calibrated, true);
  assert.equal(b.tdee, 2300);
  assert.equal(b.formulaTdee, a.tdee);
  assert.equal(b.target, 2300 - Math.round(0.25 * C.KCAL_PER_KG / 7));
});

test('calibrationNote 差距過大時標記', () => {
  assert.equal(C.calibrationNote({ ok: true, tdee: 3200 }, 2400).big, true);
  assert.equal(C.calibrationNote({ ok: true, tdee: 2300 }, 2400).big, false);
  assert.equal(C.calibrationNote({ ok: false }, 2400), null);
});

test('mergeWeights 不覆蓋既有日期', () => {
  const r = C.mergeWeights([{ date: '2026-10-01', kg: 80 }], [{ date: '2026-10-01', kg: 70 }, { date: '2026-10-02', kg: 79.5 }, { date: 'x', kg: 1 }]);
  assert.equal(r.added, 1);
  assert.deepEqual(r.merged.map((w) => w.kg), [80, 79.5]);
});

test('標記「沒記完整」的日子（即使 ≥800 kcal）不列入校正的平均攝取', () => {
  const { weights, entries } = synth(21);
  const d = C.addDays(TODAY, -3);
  entries.find((e) => e.date === d).nutrients.kcal = 1000; // 漏記一餐，但仍超過 800 的門檻
  assert.notEqual(C.calibrateTDEE({ weights, entries, today: TODAY }).avgIntake, 2000);
  const r = C.calibrateTDEE({ weights, entries, today: TODAY, skipDates: [d] });
  assert.equal(r.avgIntake, 2000);
  assert.equal(r.fullDays, 20);
});

test('toggleIncompleteDay 加入、取消、不改動原陣列', () => {
  const a = ['2026-10-10'];
  const b = C.toggleIncompleteDay(a, '2026-10-05');
  assert.deepEqual(b, ['2026-10-05', '2026-10-10']);
  assert.deepEqual(a, ['2026-10-10']);
  assert.deepEqual(C.toggleIncompleteDay(b, '2026-10-05'), ['2026-10-10']);
  assert.deepEqual(C.toggleIncompleteDay(undefined, '2026-10-05'), ['2026-10-05']);
});
