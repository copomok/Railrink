import subprocess,tempfile,os,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
source=Path(os.environ.get('RAIL_SOURCE',str(root.parent/'NIMBYRAILTABLE')))
out=root/'artifacts'/'rail-map';out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='rail-map-') as directory:
 os.symlink(root/'dist',directory+'/Railrink');os.symlink(source,directory+'/NIMBYRAILTABLE')
 server=subprocess.Popen(['python3','-m','http.server','4196','--bind','127.0.0.1','--directory',directory],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   context=browser.new_context(viewport={'width':480,'height':1040},device_scale_factor=3,timezone_id='Asia/Seoul',locale='ko-KR',is_mobile=True,has_touch=True)
   page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
   page.clock.install(time=datetime.datetime(2026,11,1,6,17,tzinfo=datetime.timezone.utc))
   page.goto('http://127.0.0.1:4196/Railrink/#my',wait_until='domcontentloaded',timeout=60000)
   page.wait_for_selector('a[href="#rail-map"]',timeout=60000);page.locator('a[href="#rail-map"]').click()
   page.wait_for_selector('#rail-map-canvas .rail-source-track',timeout=60000)
   assert page.locator('#rail-map-canvas .rail-source-track').count()==1
   source_text=page.locator('.rail-live-source').inner_text();assert 'NIMBY Rails 원본 선로 12,980개' in source_text;assert '원본 연결 168개' in source_text;assert '노선 확인 13개' in source_text;assert '대표 본선 293개' in source_text
   canvas=page.locator('#rail-map-canvas').bounding_box();assert canvas['width']>=480 and canvas['height']>=950
   assert not page.locator('.navigation').is_visible();assert page.locator('.rail-live-header').is_visible()
   page.locator('[data-map-search-toggle]').click();page.locator('#rail-map-search input').fill('2038');page.locator('#rail-map-search button[type="submit"]').click()
   page.wait_for_selector('#rail-map-canvas .rail-selected-path',timeout=60000);page.wait_for_selector('.rail-sheet-primary h3')
   assert '2038' in page.locator('.rail-sheet-primary h3').inner_text();assert page.url.endswith('#rail-map')
   point_count=page.locator('#rail-map-canvas .rail-selected-path').first.get_attribute('points').count(' ')+1;assert point_count>10
   assert '시간표 기준 예상 위치' in page.locator('#rail-train-sheet').inner_text();assert '확인 불가' in page.locator('#rail-train-sheet').text_content()
   page.locator('[data-sheet-level]').click();assert page.locator('#rail-train-sheet').get_attribute('data-level')=='middle'
   page.locator('[data-sheet-close]').click();assert page.locator('#rail-train-sheet').is_hidden();page.locator('[data-selected-reopen]').click();assert page.locator('#rail-train-sheet').is_visible()
   page.locator('#rail-map-canvas').evaluate("element=>element.dataset.instance='kept'")
   page.locator('[data-map-mode="all"]').click();assert page.locator('#rail-map-canvas').get_attribute('data-instance')=='kept'
   other=page.locator('#rail-map-canvas .rail-train-marker:not([aria-label*="2038"])').first
   if other.count():
    before=page.locator('.rail-sheet-primary h3').inner_text();other.click(force=True);page.wait_for_timeout(1000);assert page.locator('.rail-sheet-primary h3').inner_text()!=before
   for train_number in ['2038','8039','1142','1198']:
    page.locator('[data-map-search-toggle]').click();page.locator('#rail-map-search input').fill(train_number);page.locator('#rail-map-search button[type="submit"]').click();page.wait_for_function("number=>document.querySelector('.rail-sheet-primary h3')?.textContent.includes(number)",arg=train_number);assert page.locator('#rail-map-canvas .rail-selected-path').count()>0;assert '확인 불가' in page.locator('#rail-train-sheet').text_content()
   while page.locator('#rail-train-sheet').get_attribute('data-level')!='compact':page.locator('[data-sheet-level]').click()
   page.screenshot(path=str(out/'01-fullscreen-train-map.png'),full_page=False)
   page.locator('.rail-live-header a[href="#settings-map"]').click();page.wait_for_selector('#settings-map-form');page.locator('[name="background"]').uncheck(force=True);page.locator('#settings-map-form [type="submit"]').click()
   page.wait_for_selector('#rail-map-canvas .rail-source-track',timeout=60000);assert page.locator('.rail-map-tiles').is_hidden();assert page.evaluate("JSON.parse(localStorage.getItem('raillink.settings.v1')).map.background")==False
   page.screenshot(path=str(out/'02-fullscreen-map-offline.png'),full_page=False)
   for width in [320,390,480,600,720]:
    page.set_viewport_size({'width':width,'height':1040});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
   assert not errors,errors
   print('PASS: continuous exact/representative mainline routes for 2038/8039/1142/1198, no synthetic links, persistent full-screen map/settings, responsive layout, zero browser errors.')
   browser.close()
 finally:
  server.terminate();server.wait()
