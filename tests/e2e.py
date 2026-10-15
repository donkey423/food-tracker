# 端到端測試：手動新增、拍照辨識（模擬 Gemini）、今日統計、分析、匯出
import json, sys, threading, http.server, functools, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
AI = {"candidates":[{"content":{"parts":[{"text":json.dumps({"type":"label","items":[{"name":"無糖豆漿","portion":"1 瓶 450ml","kcal":150,"protein":15,"fat":7,"carbs":6,"fiber":2,"sodium":40,"confidence":"high"}],"servings_per_package":1,"notes":""}, ensure_ascii=False)}]}}]}
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width':390,'height':844})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.route('https://generativelanguage.googleapis.com/**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(AI)))
    pg.goto(URL)
    assert pg.is_hidden('#backupHint')
    assert '還沒有紀錄' in pg.inner_text('#entries')
    # 手動新增
    pg.click('nav button[data-tab=add]'); pg.click('#manual')
    pg.fill('[data-f=name]', '雞胸肉'); pg.fill('[data-f=servings]', '2')
    for k, v in {'kcal':165,'protein':31,'fat':3.6,'carbs':0}.items(): pg.fill(f'[data-f={k}]', str(v))
    assert '330 kcal' in pg.inner_text('.sum')
    pg.click('#saveItems')
    t = pg.inner_text('#summary'); assert '330' in t and '62' in t, t
    # 拍照（模擬）：未設 Key 應導到設定
    pg.click('nav button[data-tab=add]')
    pg.set_input_files('#lib', os.path.join(ROOT, 'icons/icon-192.png'))
    assert not pg.is_hidden('#settings')
    pg.fill('#apiKey', 'TEST'); pg.click('#saveKey')
    pg.click('nav button[data-tab=add]')
    pg.set_input_files('#lib', os.path.join(ROOT, 'icons/icon-192.png'))
    pg.wait_for_selector('#cards fieldset')
    assert pg.input_value('[data-f=name]') == '無糖豆漿'
    pg.click('#saveItems')
    t = pg.inner_text('#summary'); assert '480' in t and '77' in t, t
    assert '無糖豆漿' in pg.inner_text('#entries')
    # 常用：加星後出現在快選並可一鍵帶入
    pg.click('[data-fav="無糖豆漿"]')
    pg.click('nav button[data-tab=add]')
    assert pg.inner_text('#quick').startswith('★')
    pg.click('[data-q="0"]'); assert pg.input_value('[data-f=name]') == '無糖豆漿'
    # 分析
    pg.click('nav button[data-tab=stats]')
    s = pg.inner_text('#statsBody'); assert '1/7 天有紀錄' in s and '雞胸肉' in s, s
    # 匯出 CSV
    pg.click('nav button[data-tab=settings]')
    with pg.expect_download() as d: pg.click('#exportCsv')
    csv = open(d.value.path(), encoding='utf-8-sig').read(); assert '雞胸肉' in csv and csv.count('\n') == 2, csv
    # 身體資料 → 每日目標與赤字
    pg.click('nav button[data-tab=body]')
    pg.click('#sexSeg [data-v=male]')
    for k, v in {'#pAge':'35','#pHeight':'183','#pWeight':'80'}.items(): pg.fill(k, v)
    pg.select_option('#pActivity', 'light'); pg.click('#rateSeg [data-v="0.5"]')
    b2 = pg.inner_text('#planTop'); assert '1,889' in b2 and '1,774' in b2 and '2,439' in b2 and '550' in b2 and '2,439 − 550 = 1,889' in b2, b2
    assert pg.evaluate("document.querySelector('#planTop').getBoundingClientRect().top < document.querySelector('#profileForm').getBoundingClientRect().top")
    pg.click('nav button[data-tab=today]')
    s2 = pg.inner_text('#summary'); assert '基礎代謝' in s2 and '赤字' in s2 and '還可以吃' in s2 and '1,409' in s2 and '77 / 128 g' in s2, s2
    pg.click('nav button[data-tab=stats]')
    v = pg.inner_text('#statsBody'); assert '今天還沒結束' in v and '計畫赤字' in v and '550' in v, v
    # 重新載入後資料仍在
    pg.reload(); assert '480' in pg.inner_text('#summary')
    if os.environ.get('SHOT'): pg.screenshot(path=os.environ['SHOT'], full_page=True)
    b.close()
srv.shutdown()
if errors: print('JS errors:', errors); sys.exit(1)
print('E2E OK')
