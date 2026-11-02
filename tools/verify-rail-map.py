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
   context=browser.new_context(viewport={'width':390,'height':844},timezone_id='Asia/Seoul',locale='ko-KR',is_mobile=True,has_touch=True)
   page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
   page.clock.install(time=datetime.datetime(2026,11,1,6,17,tzinfo=datetime.timezone.utc))
   page.goto('http://127.0.0.1:4196/Railrink/#my',wait_until='domcontentloaded',timeout=60000)
   page.wait_for_selector('a[href="#rail-map"]',timeout=60000);page.locator('a[href="#rail-map"]').click()
   page.wait_for_selector('#rail-map-canvas .rail-source-track',timeout=30000)
   assert page.locator('#rail-map-canvas .rail-source-track').count()==1
   assert '최신 원본 선로 지도' in page.locator('.rail-map-source').inner_text()
   assert '53,555개 선로 연결' in page.locator('.rail-map-source').inner_text()
   canvas=page.locator('#rail-map-canvas').bounding_box();assert canvas['width']>=360 and canvas['height']>=440
   page.locator('#rail-map-search input').fill('서울역');page.locator('#rail-map-search button').click();page.wait_for_selector('.station-hero')
   assert '서울역' in page.locator('.station-hero').inner_text();assert '역 시간표' in page.locator('.station-actions').inner_text()
   page.locator('[data-station-action="timetable"]').click();page.wait_for_selector('.station-timetable-list button');assert page.locator('.station-timetable-list button').count()>10
   page.evaluate("location.hash='rail-map'");page.wait_for_selector('#rail-map-search');page.locator('#rail-map-search input').fill('KTX 1');page.locator('#rail-map-search button').click();page.wait_for_selector('#train-map-canvas .rail-selected-path')
   assert '실시간 GPS 위치가 아닙니다' in page.locator('.train-map-estimate').inner_text();page.screenshot(path=str(out/'01-train-map-mobile.png'),full_page=True)
   page.evaluate("location.hash='settings-map'");page.wait_for_selector('#settings-map-form');page.locator('[name="background"]').uncheck(force=True);page.locator('[name="allTrains"]').check(force=True);page.locator('#settings-map-form [type="submit"]').click();page.wait_for_selector('#rail-map-canvas .rail-train-marker',timeout=30000)
   assert page.locator('.rail-map-tiles').is_hidden();assert page.locator('.rail-train-marker').count()>0;assert page.evaluate("JSON.parse(localStorage.getItem('raillink.settings.v1')).map.background")==False
   page.screenshot(path=str(out/'02-network-offline-style.png'),full_page=True)
   for width in [320,390,600]:
    page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
   assert not errors,errors
   print('PASS: OSM-backed exact save-file tracks, source disclosure, station details/timetable, train route estimate, map settings persistence, responsive layout, zero browser errors.')
   browser.close()
 finally:
  server.terminate();server.wait()
