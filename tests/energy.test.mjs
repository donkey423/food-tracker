import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../core.js';

test('Mifflin-St Jeor 男女', () => {
  assert.deepEqual(C.calcBMR({ sex: 'male', age: 35, height: 183, weight: 80 }), { value: 1774, method: 'Mifflin-St Jeor' });
  assert.equal(C.calcBMR({ sex: 'female', age: 35, height: 165, weight: 60 }).value, 1295);
});
test('有體脂率改用 Katch-McArdle', () => {
  const r = C.calcBMR({ sex: 'male', age: 35, height: 183, weight: 80, bodyFat: 20 });
  assert.equal(r.value, 1752);
  assert.match(r.method, /Katch/);
});
test('資料不足回傳 null', () => {
  assert.equal(C.calcBMR({ age: 35, height: 183, weight: 80 }), null);
  assert.equal(C.energyPlan({}), null);
});
test('energyPlan：TDEE、每週 0.5kg 赤字與蛋白質', () => {
  const p = C.energyPlan({ sex: 'male', age: 35, height: 183, weight: 80, activity: 'light', rate: 0.5 });
  assert.equal(p.tdee, 2439);
  assert.equal(p.deficit, 550);
  assert.equal(p.target, 1889);
  assert.equal(p.floorHit, false);
  assert.deepEqual(p.protein, [128, 176]);
  assert.equal(p.bmi, 23.9);
});
test('目標不低於 BMR 下限', () => {
  const p = C.energyPlan({ sex: 'male', age: 35, height: 183, weight: 80, activity: 'sedentary', rate: 0.75 });
  assert.equal(p.target, 1774);
  assert.equal(p.floorHit, true);
  assert.equal(p.deficit, 2129 - 1774);
});
test('macroTargets 加總接近目標熱量', () => {
  const m = C.macroTargets(C.energyPlan({ sex: 'male', age: 35, height: 183, weight: 80, activity: 'light', rate: 0.5 }));
  assert.ok(Math.abs(m.protein * 4 + m.fat * 9 + m.carbs * 4 - m.kcal) < 10);
});
test('deficitReview 預估每週變化', () => {
  const p = C.energyPlan({ sex: 'male', age: 35, height: 183, weight: 80, activity: 'light', rate: 0.5 });
  const r = C.deficitReview(1889, p);
  assert.equal(r.deficit, 550);
  assert.equal(r.weeklyKg, -0.5);
  assert.equal(r.vsTarget, 0);
});
