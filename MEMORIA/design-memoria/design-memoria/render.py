# Uso: python render.py modelos/B-boreal-slide.html saida/slide-01.png 1080 1350
import sys, os
from playwright.sync_api import sync_playwright
src, out, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': w, 'height': h})
    pg.goto('file://' + os.path.abspath(src)); pg.wait_for_timeout(300)
    # checagem: algum texto passou da borda do quadro?
    bad = pg.evaluate("""()=>[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return e.childNodes.length&&e.textContent.trim()&&(r.right>innerWidth+1||r.left<-1||r.bottom>innerHeight+1)}).map(e=>e.textContent.trim().slice(0,40))""")
    if bad: print('ATENCAO: texto fora do quadro ->', bad)
    pg.screenshot(path=out); b.close()
print('ok', out)
