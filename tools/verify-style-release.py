"""New modules must restore missing styles even when a PWA retains older HTML."""
import subprocess,tempfile,os,re
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];source=Path(os.environ.get('RAIL_SOURCE',str(root.parent/'NIMBYRAILTABLE')))
out=root/'artifacts'/'ticketing';out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='raillink-style-') as directory:
 os.symlink(root/'dist',directory+'/Railrink');os.symlink(source,directory+'/NIMBYRAILTABLE')
 server=subprocess.Popen(['python','-m','http.server','4188','--bind','127.0.0.1','--directory',directory],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':390,'height':844},timezone_id='Asia/Seoul');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   html=(root/'dist/index.html').read_text();stale=re.sub(r'<link rel="stylesheet" href="[^\"]*(?:tourism|ticketing)\.css[^\"]*">','',html)
   page.route('http://127.0.0.1:4188/Railrink/',lambda route:route.fulfill(status=200,content_type='text/html',body=stale))
   page.goto('http://127.0.0.1:4188/Railrink/');page.wait_for_selector('[data-nav=travel]');page.locator('[data-nav=travel]').click();page.wait_for_selector('.tour-product-card')
   assert page.locator('.tour-product-card').first.evaluate("el=>getComputedStyle(el).display==='flex'&&getComputedStyle(el).borderRadius==='16px'")
   for file in ['tourism','ticketing']:
    assert page.evaluate("name=>[...document.querySelectorAll('link[rel=stylesheet]')].some(l=>l.href.includes('/'+name+'.css?v=')&&l.sheet)",file)
   for theme in ['light','dark']:
    page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
    for width in [320,390,768]:
     page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/('tour-cards-'+theme+'.png')))
   page.evaluate("document.documentElement.dataset.theme='light'");page.locator('[data-action=tour-grade][data-value=남도해양]').click();page.wait_for_selector('.tour-system-card');assert page.locator('.navigation').is_visible();assert page.locator('.top [aria-label=뒤로]').is_visible();page.screenshot(path=str(out/'tour-systems-light.png'))
   assert not errors,errors
   print('PASS: stale HTML without new styles restores versioned CSS before rendering; tourist cards, light/dark, 320/390/768 widths.')
   browser.close()
 finally:server.terminate();server.wait()
