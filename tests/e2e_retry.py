# 503 重試與備用模型測試（模擬 Gemini）
import json, sys, threading, http.server, functools, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
OK = {"candidates":[{"content":{"parts":[{"text":json.dumps({"type":"label","items":[{"name":"測試餅乾","portion":"1 份","kcal":112,"protein":1.7,"fat":5.7,"carbs":13.5,"fiber":1.1,"sodium":160,"confidence":"high"}],"servings_per_package":5,"notes":""}, ensure_ascii=False)}]}}]}
IMG = os.path.join(ROOT, 'icons/icon-192.png')
calls = []; mode = {'v': 'fallback'}
def handler(route):
    model = route.request.url.split('/models/')[1].split(':')[0]
    calls.append(model)
    if mode['v'] == 'all503' or model == 'gemini-flash-latest':
        route.fulfill(status=503, content_type='application/json', body=json.dumps({"error":{"message":"This model is currently experiencing high demand."}}))
    else:
        route.fulfill(status=200, content_type='application/json', body=json.dumps(OK))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':390,'height':844})
    pg.route('https://generativelanguage.googleapis.com/**', handler)
    pg.goto(URL)
    pg.evaluate("localStorage.setItem('nl.v1', JSON.stringify({entries:[],favorites:[],settings:{apiKey:'K',model:'gemini-flash-latest'}}))"); pg.reload()
    # 1) 主模型 503（重試一次仍失敗）→ 備用模型成功
    pg.click('nav button[data-tab=add]'); pg.set_input_files('#lib', IMG)
    pg.wait_for_selector('#cards fieldset', timeout=20000)
    assert pg.input_value('[data-f=name]') == '測試餅乾'
    assert calls == ['gemini-flash-latest','gemini-flash-latest','gemini-flash-lite-latest'], calls
    # 2) 全部 503 → 中文錯誤＋重試按鈕；恢復後重試成功
    calls.clear(); mode['v'] = 'all503'
    pg.click('#cancelEdit'); pg.set_input_files('#lib', IMG)
    pg.wait_for_selector('#retryPhoto', timeout=30000)
    assert '伺服器目前忙碌' in pg.inner_text('#editor'), pg.inner_text('#editor')
    assert len(calls) == 6, calls
    mode['v'] = 'ok'; calls.clear()
    pg.click('#retryPhoto'); pg.wait_for_selector('#cards fieldset', timeout=20000)
    assert pg.input_value('[data-f=name]') == '測試餅乾'
    b.close()
srv.shutdown(); print('RETRY E2E OK')
