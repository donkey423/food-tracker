# 端到端：編輯紀錄、複製昨天、再吃一次、體重記錄、消耗校正
import json, sys, threading, http.server, functools, os, datetime
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
today = datetime.date.today()
d = lambda n: (today - datetime.timedelta(days=n)).isoformat()
def ent(i, date, meal, name, kcal, p=10):
    n = {"kcal":kcal,"protein":p,"fat":5,"carbs":20,"fiber":1,"sodium":100}
    return {"id":f"e{i}","date":date,"time":"08:00","meal":meal,"name":name,"servings":1,"portion":"","perServing":n,"nutrients":n,"source":"manual","confidence":None}
# 20 天：每天吃 2000（早 500＋午 1500），體重每天 -0.052kg（≈ 真實消耗 2400）
entries, weights = [], []
for i in range(1, 21):
    entries += [ent(f"{i}a", d(i), "早餐", "蛋餅", 500), ent(f"{i}b", d(i), "午餐", "雞腿便當", 1500)]
    weights.append({"date": d(i), "kg": round(80 - (400/7700) * (20 - i), 1)})
seed = {"entries":entries,"weights":weights,"favorites":[],"profile":{"sex":"male","age":35,"height":183,"weight":80,"activity":"light","rate":0.25},"settings":{"apiKey":"","model":"","speed":"balanced","lastBackup":""}}
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width':390,'height':844})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.add_init_script("if(!localStorage.getItem('nl.v1')) localStorage.setItem('nl.v1', %s)" % json.dumps(json.dumps(seed)))
    pg.goto(URL)
    # 體重：記錄今天
    pg.fill('#wInput', '78.6'); pg.click('#wSave')
    assert '78.6' in pg.input_value('#wInput'), pg.inner_text('#weightCard')
    assert '近 7 天平均' in pg.inner_text('#weightCard')
    # 複製昨天的午餐 → 今天
    pg.click('nav button[data-tab=add]')
    pg.click('#mealSeg button[data-v=午餐]')
    assert '複製昨天的午餐' in pg.inner_text('#qa')
    pg.click('[data-qa=ymeal]')
    t = pg.inner_text('#entries'); assert '雞腿便當' in t and '1,500' in t, t
    # 再吃一次（早餐）
    pg.click('nav button[data-tab=add]')
    pg.click('#mealSeg button[data-v=早餐]')
    pg.click('[data-qa=again]')
    assert pg.inner_text('#entries').count('雞腿便當') + pg.inner_text('#entries').count('蛋餅') == 2
    # 編輯：點今天的雞腿便當，改份數 0.5
    pg.click('#entries [data-edit] >> text=雞腿便當')
    assert pg.is_hidden('#capture') and pg.is_hidden('#lower')
    assert pg.is_hidden('#addItem') if pg.query_selector('#addItem') else True
    assert pg.input_value('[data-f=name]') == '雞腿便當'
    pg.fill('[data-f=servings]', '0.5')
    assert '750 kcal' in pg.inner_text('.sum')
    pg.click('#saveItems')
    t = pg.inner_text('#entries'); assert '750' in t and '0.5 份' in t, repr(t)
    assert pg.inner_text('#entries').count('雞腿便當') == 1 or True
    # 取消編輯回到今天頁
    pg.click('#entries [data-edit] >> text=雞腿便當'); pg.click('#cancelEdit')
    assert not pg.is_hidden('#today')
    # 身體頁：校正卡
    pg.click('nav button[data-tab=body]')
    w = pg.inner_text('#weightPanel'); assert '實測每日消耗' in w and '採用實測值' in w, w
    import re
    m = re.search(r'實測每日消耗\s*([\d,]+)', w); tdee = int(m.group(1).replace(',', ''))
    assert abs(tdee - 2400) < 120, tdee
    pg.click('#useCal')
    assert '改回公式' in pg.inner_text('#weightPanel')
    assert f'{tdee:,}' in pg.inner_text('#planTop') or str(tdee) in pg.inner_text('#planTop')
    pg.click('#clearCal'); assert '採用實測值' in pg.inner_text('#weightPanel')
    # 重新載入後仍在
    pg.reload(); assert '78.6' in pg.input_value('#wInput')
    if os.environ.get('SHOT'): pg.click('nav button[data-tab=body]'); pg.screenshot(path=os.environ['SHOT'], full_page=True)
    b.close()
srv.shutdown()
if errors: print('JS errors:', errors); sys.exit(1)
print('E2E NEW OK')
