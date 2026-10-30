import subprocess,tempfile,os,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];source=Path(os.environ.get('RAIL_SOURCE',str(root.parent/'NIMBYRAILTABLE')))
out=root/'artifacts'/'journey-spec';out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='raillink-spec-') as directory:
 os.symlink(root/'dist',directory+'/Railrink');os.symlink(source,directory+'/NIMBYRAILTABLE')
 server=subprocess.Popen(['python','-m','http.server','4184','--bind','127.0.0.1','--directory',directory],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':390,'height':844},timezone_id='Asia/Seoul',locale='ko-KR');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.clock.install(time=datetime.datetime(2026,10,29,3,0,tzinfo=datetime.timezone.utc))
   page.goto('http://127.0.0.1:4184/Railrink/');page.wait_for_selector('#open-date')
   def route():
    for field,station in [('from','서울'),('to','부산')]:
     page.locator('[data-station='+field+']').click();page.locator('#station-query').fill(station);page.locator('[data-st="'+station+'"]').click()
   def choose_seat():
    page.locator('.seat-auto-options summary').click();page.wait_for_selector('#auto-seat');page.locator('#auto-seat').click()
    if page.locator('#accept-auto').is_visible():page.locator('#accept-auto').click()
    page.locator('#next-passengers').click()
   def confirm():
    page.wait_for_selector('#passenger-form');page.locator('[name=discount0]').select_option('child');page.locator('#passenger-form [type=submit]').click();page.locator('#confirm-form [type=checkbox]').check();page.locator('#confirm-form [type=submit]').click();page.wait_for_url('**/#complete')
   route();page.locator('#search-form [type=submit]').click();page.wait_for_selector('[data-action=book]:enabled')
   assert page.locator('.train-card .journey-line strong').first.inner_text().split(':')[0]>='12'
   page.screenshot(path=str(out/'01-future-trains.png'),full_page=True)
   # Advance through the first listed departure; its row must disappear without another search.
   first=page.locator('[data-inventory]').first;time=first.locator('.journey-line strong').first.inner_text();h,m=map(int,time.split(':'));page.clock.fast_forward(max(0,(h*60+m-12*60)*60000)+61000);assert all(int(t.split(':')[0])*60+int(t.split(':')[1])>h*60+m for t in page.locator('[data-inventory] .journey-line>div:first-child strong').all_inner_texts())
   page.locator('[data-action=book]:enabled').first.click();page.locator('#choose-seats').click();choose_seat();confirm()
   page.locator('[data-nav=tickets]').click();page.wait_for_selector('.ticket-group');page.locator('#calendar-toggle').click();page.wait_for_selector('.ticket-calendar');page.locator('#calendar-toggle').click();page.locator('.ticket-open').first.click();assert page.locator('.ticket-qr').is_visible();page.screenshot(path=str(out/'02-ticket-qr.png'));page.locator('#close-dialog').click()
   page.locator('[data-nav=my]').click();page.locator('#simulation').check();page.locator('[data-nav=tickets]').click();page.locator('.ticket-open').first.click();page.locator('#ticket-operation').click();page.locator('[data-ops-tab=map]').click();page.wait_for_selector('.operation-map');assert '읽지 못' not in page.locator('#ops-status').inner_text();page.clock.fast_forward(61000);assert page.locator('#ops-map').is_visible();assert page.locator('dialog[open]').count()==1;page.screenshot(path=str(out/'03-operations-map.png'));page.locator('#close-dialog').click()
   page.locator('[data-action=cancel]').first.click();page.locator('#confirm-cancel').click();page.wait_for_selector('dialog[open]',state='detached');page.locator('[data-ticket-filter=history]').click();page.locator('#history-status').select_option('cancelled');assert page.locator('.ticket-group').count()==1
   page.locator('[data-nav=home]').click();page.locator('#open-date').click();page.get_by_role('button',name='내일',exact=True).click();page.locator('#date-form [type=submit]').click();page.locator('.home-options summary').click();page.locator('#roundtrip').click();page.locator('#search-form [type=submit]').click();page.wait_for_selector('[data-action=book]:enabled');page.locator('[data-action=book]:enabled').first.click();page.locator('#choose-seats').click();choose_seat();page.wait_for_selector('#restart-journey');page.wait_for_selector('[data-action=book]:enabled');page.locator('[data-action=book]:enabled').first.click();page.locator('#choose-seats').click();choose_seat();confirm()
   page.locator('[data-nav=tickets]').click();page.wait_for_selector('.ticket-group');assert page.locator('.ticket-group').count()==1,page.locator('#ticket-list').inner_text();assert '2구간' in page.locator('.ticket-kind').inner_text(),page.locator('#ticket-list').inner_text()
   page.screenshot(path=str(out/'04-roundtrip.png'),full_page=True)
   page.locator('[data-action=cancel]').first.click();page.locator('#confirm-cancel').click();page.wait_for_selector('dialog[open]',state='detached');assert page.evaluate("JSON.parse(localStorage.getItem('raillink.v1')).tickets.every(t=>t.status==='cancelled')")
   page.locator('[data-nav=home]').click();page.locator('#search-form [type=submit]').click();page.locator('[data-query-open=route]').click();page.locator('[name=route][value=transfer]').check();page.locator('#query-options-form [type=submit]').click();page.wait_for_selector('#transfer-results .transfer-card');page.locator('#transfer-results').scroll_into_view_if_needed();page.wait_for_selector('[data-action=book-transfer]:enabled');page.locator('[data-action=book-transfer]:enabled').first.click();page.locator('#choose-seats').click();choose_seat();choose_seat();confirm()
   page.locator('[data-nav=tickets]').click();page.wait_for_selector('.ticket-group');assert '2구간' in page.locator('.ticket-kind').inner_text()
   for leg in range(2):
    page.locator('.ticket-open').first.click();page.locator('[data-ticket-segment="1"]').click() if leg==1 else None;page.locator('#qr-formation').click();page.wait_for_selector('dialog[open]');page.locator('#close-dialog').click()
   page.locator('[data-nav=my]').click();page.locator('#theme').select_option('dark');assert page.locator('html').get_attribute('data-theme')=='dark'
   for width in [320,390,768,1280]:
    page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
   page.locator('[data-nav=home]').click();page.screenshot(path=str(out/'05-desktop-dark.png'),full_page=True)
   page.locator('[data-nav=travel]').click();page.locator('a[href="#passes"]').click();page.locator('[name=name]').fill('주간 일정');page.locator('[name=from]').fill('서울');page.locator('[name=to]').fill('부산');page.locator('[name=start]').fill('2026-10-30');page.locator('#pass-trains').click();page.locator('[name=weekday][value="1"]').check();page.locator('#pass-form [type=submit]').click();page.wait_for_selector('#commit-pass');assert '예약 가능' in page.locator('#pass-preview').inner_text()
   page.locator('#commit-pass').click();page.wait_for_url('**/#complete');assert page.evaluate("JSON.parse(localStorage.getItem('raillink.v1')).passes.length") == 1
   # Wait until the active worker caches the current source manifest and scripts before offline navigation.
   page.evaluate("""async()=>{const r=await navigator.serviceWorker.ready;const channel=new MessageChannel();const done=new Promise(resolve=>channel.port1.onmessage=resolve);r.active.postMessage({type:'cache-sources',urls:[...document.querySelectorAll('script[src],link[rel=stylesheet]')].map(e=>e.src||e.href).concat(location.origin+'/NIMBYRAILTABLE/index.html')},[channel.port2]);await done;}""")
   context.set_offline(True);page.reload();page.wait_for_selector('[data-nav=tickets]');page.locator('[data-nav=tickets]').click();page.wait_for_selector('.ticket-group');page.locator('.ticket-open').first.click();assert page.locator('.ticket-qr').is_visible();page.locator('#close-dialog').click();page.locator('[data-nav=search]').click();route();page.locator('#search-form [type=submit]').click();page.get_by_role('heading',name='오프라인에서는 새 열차를 조회할 수 없습니다',exact=True).wait_for()
   assert not errors,errors
   print('PASS: past departures hidden, single/roundtrip/transfer atomic booking, auto seats, discounts, grouped cancellation, both leg details, QR, operations map retained on tick, dark/responsive, repeat booking, offline tickets and blocked search.')
   browser.close()
 finally:server.terminate();server.wait()
