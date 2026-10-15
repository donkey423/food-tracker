import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../core.js';

test('num 處理字串與非法值', () => {
  assert.equal(C.num('12g'), 12);
  assert.equal(C.num(-3), 0);
  assert.equal(C.num('abc'), 0);
  assert.equal(C.num(undefined), 0);
});

test('scale 依份數換算', () => {
  const r = C.scale({ kcal: 120, protein: 7.5, fat: 3, carbs: 15, fiber: 1, sodium: 85 }, 1.5);
  assert.deepEqual(r, { kcal: 180, protein: 11.3, fat: 4.5, carbs: 22.5, fiber: 1.5, sodium: 127.5 });
});

test('sumEntries 加總', () => {
  const t = C.sumEntries([{ nutrients: { kcal: 100, protein: 10 } }, { nutrients: { kcal: 50.5, protein: 2.2 } }]);
  assert.equal(t.kcal, 150.5);
  assert.equal(t.protein, 12.2);
  assert.equal(t.sodium, 0);
});

test('macroSplit 加總為 100', () => {
  const m = C.macroSplit({ protein: 30, carbs: 50, fat: 20 });
  assert.equal(m.protein + m.carbs + m.fat, 100);
  assert.deepEqual(C.macroSplit({}), { protein: 0, carbs: 0, fat: 0 });
});

test('energyCheck 偵測不一致', () => {
  assert.equal(C.energyCheck({ kcal: 200, protein: 10, carbs: 20, fat: 8 }).ok, true);
  assert.equal(C.energyCheck({ kcal: 500, protein: 10, carbs: 20, fat: 8 }).ok, false);
});

test('parseAIResult 解析 code fence 與正規化', () => {
  const r = C.parseAIResult('```json\n{"type":"label","items":[{"name":"豆漿","kcal":"120","protein":7,"confidence":"high"}],"servings_per_package":2}\n```');
  assert.equal(r.type, 'label');
  assert.equal(r.items[0].name, '豆漿');
  assert.equal(r.items[0].nutrients.kcal, 120);
  assert.equal(r.items[0].nutrients.sodium, 0);
  assert.equal(r.servingsPerPackage, 2);
});

test('parseAIResult 從雜訊中擷取 JSON、處理範圍與可信度', () => {
  const r = C.parseAIResult('結果如下 {"type":"food","items":[{"name":"雞腿便當","kcal":850,"kcal_low":700,"kcal_high":1000,"confidence":"x"}]} 完');
  assert.equal(r.type, 'food');
  assert.deepEqual(r.items[0].kcalRange, [700, 1000]);
  assert.equal(r.items[0].confidence, 'low');
});

test('parseAIResult 無效輸入丟出錯誤', () => {
  assert.throws(() => C.parseAIResult('not json'), /無法解析/);
});

test('lastNDates 跨月', () => {
  assert.deepEqual(C.lastNDates('2026-03-02', 3), ['2026-02-28', '2026-03-01', '2026-03-02']);
});

test('defaultMeal 依時間', () => {
  assert.equal(C.defaultMeal(new Date(2026, 0, 1, 8, 0)), '早餐');
  assert.equal(C.defaultMeal(new Date(2026, 0, 1, 12, 30)), '午餐');
  assert.equal(C.defaultMeal(new Date(2026, 0, 1, 19, 0)), '晚餐');
  assert.equal(C.defaultMeal(new Date(2026, 0, 1, 23, 0)), '點心');
});

test('summarize 平均只計有紀錄的天數', () => {
  const es = [
    { date: '2026-10-01', nutrients: { kcal: 2000 } },
    { date: '2026-10-03', nutrients: { kcal: 1000 } },
  ];
  const s = C.summarize(es, ['2026-10-01', '2026-10-02', '2026-10-03']);
  assert.equal(s.loggedDays, 2);
  assert.equal(s.avg.kcal, 1500);
  assert.equal(s.perDay[1].n, 0);
});

test('topContributors 依名稱合併排序', () => {
  const r = C.topContributors([
    { name: 'A', nutrients: { protein: 10 } },
    { name: 'B', nutrients: { protein: 30 } },
    { name: 'A', nutrients: { protein: 20 } },
  ], 'protein');
  assert.deepEqual(r.map((x) => [x.name, x.value, x.pct]), [['A', 30, 50], ['B', 30, 50]]);
});

test('foodLibrary 常用優先且去重', () => {
  const es = [
    { name: 'A', date: '2026-10-01', time: '08:00', perServing: { kcal: 1 } },
    { name: 'B', date: '2026-10-02', time: '08:00', perServing: { kcal: 2 } },
    { name: 'A', date: '2026-10-03', time: '08:00', perServing: { kcal: 3 } },
  ];
  const lib = C.foodLibrary(es, ['B']);
  assert.deepEqual(lib.map((f) => f.name), ['B', 'A']);
  assert.equal(lib[1].perServing.kcal, 3);
});

test('mergeEntries 依 id 去重並略過無效', () => {
  const r = C.mergeEntries([{ id: '1', date: 'd', name: 'x' }], [{ id: '1', date: 'd', name: 'x' }, { id: '2', date: 'd', name: 'y' }, { id: '3' }]);
  assert.equal(r.added, 1);
  assert.equal(r.merged.length, 2);
});

test('toCSV 跳脫逗號與引號', () => {
  const csv = C.toCSV([{ date: '2026-10-01', time: '08:00', meal: '早餐', name: '蛋餅, "加蛋"', servings: 1, nutrients: { kcal: 300 }, source: 'manual' }]);
  assert.ok(csv.startsWith('\uFEFF日期'));
  assert.ok(csv.includes('"蛋餅, ""加蛋"""'));
});

test('summarize 排除標記為沒記完整的日子，但逐日資料仍保留', () => {
  const es = [
    { date: '2026-10-01', nutrients: { kcal: 2000 } },
    { date: '2026-10-03', nutrients: { kcal: 1000 } },
  ];
  const s = C.summarize(es, ['2026-10-01', '2026-10-02', '2026-10-03'], ['2026-10-03', '2026-10-02']);
  assert.equal(s.loggedDays, 1);
  assert.equal(s.avg.kcal, 2000);
  assert.equal(s.skipped, 1); // 10-02 沒有紀錄，不算「被排除」
  assert.equal(s.perDay[2].skip, true);
  assert.equal(s.perDay[2].kcal, 1000);
});
