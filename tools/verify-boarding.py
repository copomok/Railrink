"""Browser integration against the real shared railway data and durable booking flow."""
import subprocess,tempfile,os,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];source=Path(os.environ.get('RAIL_SOURCE',str(root.parent/'NIMBYRAILTABLE')))
out=root/'artifacts'/'boarding';out.mkdir(parents=True,exist_ok=True)
def instant(value):return datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
with tempfile.TemporaryDirectory(prefix='raillink-boarding-') as directory:
 os.symlink(root/'dist',directory+'/Railrink');os.symlink(source,directory+'/NIMBYRAILTABLE')
 server=subprocess.Popen(['python','-m','http.server','4190','--bind','127.0.0.1','--directory',directory],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   context=browser.new_context(viewport={'width':480,'height':1040},timezone_id='Asia/Seoul',locale='ko-KR',is_mobile=True,has_touch=True)
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.clock.install(time=datetime.datetime(2026,10,29,3,tzinfo=datetime.timezone.utc))
   def load():page.goto('http://127.0.0.1:4190/Railrink/');page.wait_for_selector('#open-date')
   def search(transfer=False):
    for field,station in [('from','서울'),('to','부산')]:
     page.locator('[data-station='+field+']').click();page.locator('#station-query').fill(station);page.locator('[data-st="'+station+'"]').click()
    page.locator('#open-date').click();page.get_by_role('button',name='내일',exact=True).click();page.locator('#date-form [type=submit]').click();page.locator('#search-form [type=submit]').click()
    if transfer:
     page.locator('[data-query-open=route]').click();page.locator('[name=route][value=transfer]').check();page.locator('#query-options-form [type=submit]').click();page.wait_for_selector('[data-action=book-transfer]:enabled');page.locator('[data-action=book-transfer]:enabled').first.click()
    else:page.wait_for_selector('[data-action=book]:enabled');page.locator('[data-action=book]:enabled').first.click()
    page.locator('#quick-book').click();page.locator('#passenger-form [type=submit]').click();page.locator('#confirm-form [type=checkbox]').check();page.locator('#confirm-form [type=submit]').click();page.wait_for_url('**/#complete')
   def saved():return page.evaluate("JSON.parse(localStorage.getItem('raillink.v1')).tickets")
   def set_time(value):page.clock.set_system_time(value);page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
   load();search();booked=saved()[0];original=saved()
   page.locator('[data-nav=tickets]').click();page.locator('.ticket-open').click();page.wait_for_selector('.ticket-qr');assert page.locator('details.ticket-group').count()==0
   assert '타는 곳' in page.locator('#ticket-boarding-place').inner_text();assert page.locator('.ticket-train-heading #qr-formation').is_visible();assert page.locator('.ticket-train-heading #ticket-operation').is_visible();assert page.locator('.ticket-seat-direction').inner_text() in ['순방향','역방향']
   page.screenshot(path=str(out/'01-ticket-direct.png'),full_page=True)
   page.locator('#ticket-boarding').click();page.wait_for_url('**/#boarding');page.wait_for_selector('.boarding-assistant');assert page.locator('.boarding-main').inner_text().find(booked['trainNo'])>=0
   assert booked['id'] not in page.url;assert '시간표 기준' not in page.locator('body').inner_text();assert '가상' not in page.locator('body').inner_text();assert '순방향' not in page.locator('body').inner_text() and '역방향' not in page.locator('body').inner_text();assert page.locator('[data-nav=tickets]').get_attribute('aria-current')=='page'
   page.screenshot(path=str(out/'02-before.png'),full_page=True)
   for stage in ['ON_BOARD','AFTER_ARRIVAL']:
    page.locator('[data-boarding-stage='+stage+']').click();assert page.locator('.boarding-preview').is_visible();assert saved()==original
    page.screenshot(path=str(out/('03-preview-'+stage+'.png')),full_page=True)
   page.locator('[data-boarding-stage=BEFORE_BOARDING]').click();page.locator('[data-boarding-stage=BEFORE_BOARDING]').focus();page.keyboard.press('ArrowRight');assert page.locator('[data-boarding-stage=ON_BOARD]').get_attribute('aria-selected')=='true'
   page.locator('[data-boarding-stage=auto]').click()
   with page.expect_download() as download:page.locator('[data-boarding-action=calendar]').click()
   data=Path(download.value.path()).read_text();assert 'BEGIN:VCALENDAR' in data and booked['id'] not in data
   assistant_station_count=page.locator('.boarding-stops li').count();page.locator('[data-boarding-action=operation]').first.click();page.wait_for_selector('#ops-status');stopping_station_count=page.locator('.brd-stop.ride').count();assert assistant_station_count>=stopping_station_count;page.locator('#close-dialog').click()
   page.locator('[data-nav=home]').click();page.locator('.home-boarding-entry [data-action=boarding]').click();page.wait_for_selector('.boarding-assistant')
   # The home bell opens the exact ticket and notification handoff never exposes IDs in URLs.
   page.locator('[data-nav=home]').click();page.locator('#home-notifications').click();page.locator('[data-alert-ticket]').first.click();page.wait_for_selector('.boarding-main')
   page.evaluate("""async id=>{const db=await new Promise(resolve=>{const r=indexedDB.open('raillink-bookings',1);r.onsuccess=()=>resolve(r.result)});await new Promise(resolve=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({id,at:Date.now()},'raillink.boarding.pending');tx.oncomplete=()=>{db.close();resolve()};});}""",booked['id'])
   page.goto('http://127.0.0.1:4190/Railrink/');page.wait_for_url('**/#boarding');page.wait_for_selector('.boarding-main');assert booked['id'] not in page.url
   page.reload();page.wait_for_selector('.boarding-main');assert booked['trainNo'] in page.locator('.boarding-main h2').inner_text()
   # Minute update, focus preservation and automatic current stage.
   set_time(instant(booked['departure'])-datetime.timedelta(minutes=5));assert '5분' in page.locator('.boarding-countdown').inner_text()
   alert_count=page.evaluate("JSON.parse(localStorage.getItem('raillink.boarding.alerts')||'[]').length");assert alert_count>0;page.locator('[data-boarding-action=refresh]').focus();page.clock.fast_forward(61000);assert page.evaluate("JSON.parse(localStorage.getItem('raillink.boarding.alerts')||'[]').length")==alert_count;assert page.locator('[data-boarding-action=refresh]').evaluate('el=>document.activeElement===el')
   set_time(instant(booked['departure'])+datetime.timedelta(minutes=3));assert page.locator('[data-boarding-stage=ON_BOARD]').get_attribute('aria-selected')=='true';assert page.locator('.boarding-next').is_visible();assert 0<=float(page.locator('[role=progressbar]').get_attribute('aria-valuenow'))<=100;assert page.locator('.boarding-train-position').count()==1
   page.screenshot(path=str(out/'04-during.png'),full_page=True)
   page.locator('[data-boarding-action=ticket]').first.click();assert '다음 정차역' in page.locator('#ticket-boarding-place').inner_text();page.screenshot(path=str(out/'05-ticket-next-stop.png'));page.locator('#close-dialog').click()
   # Stress wrapping without changing any persisted ticket or service data.
   original_markup=page.locator('.boarding-main').inner_html()
   page.locator('.boarding-main h2').evaluate("el=>el.textContent='ITX-새마을 12345678901234567890'")
   page.locator('.boarding-route b').first.evaluate("el=>el.textContent='아주 긴 이름을 가진 출발역(환승역)'")
   for width in [320,390,480,768,1280]:
    page.set_viewport_size({'width':width,'height':1040});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    assert page.locator('.boarding-actions').bounding_box()['width']<=width
    if width==320:assert page.locator('.boarding-info-grid b').first.evaluate("el=>getComputedStyle(el).whiteSpace==='nowrap'")
   page.locator('.boarding-main').evaluate('(el,html)=>el.innerHTML=html',original_markup);page.set_viewport_size({'width':480,'height':1040});page.locator('[data-boarding-action=alerts]').scroll_into_view_if_needed();assert page.locator('[data-boarding-action=alerts]').bounding_box()['y']+page.locator('[data-boarding-action=alerts]').bounding_box()['height']<=page.locator('.navigation').bounding_box()['y'] if page.viewport_size['width']<1024 else True;page.set_viewport_size({'width':480,'height':1040});page.evaluate("document.documentElement.dataset.theme='dark'");assert page.locator('.boarding-tabs [aria-selected=true]').evaluate("el=>getComputedStyle(el).color==='rgb(255, 255, 255)'");page.clock.run_for(100);page.screenshot(path=str(out/'06-dark.png'),full_page=True);page.evaluate("document.documentElement.dataset.theme='light'")
   set_time(instant(booked['arrival'])+datetime.timedelta(minutes=1));assert page.locator('[data-boarding-stage=AFTER_ARRIVAL]').get_attribute('aria-selected')=='true';assert '도착 확인 중' in page.locator('.boarding-countdown').inner_text();assert saved()==original
   page.screenshot(path=str(out/'07-after.png'),full_page=True)
   page.locator('[data-boarding-action=receipt]').click();page.get_by_role('heading',name='영수증',exact=True).wait_for();page.locator('#close-dialog').click()
   # Reload offline using the existing PWA cache, retaining the local ticket and schedule.
   page.evaluate("""async()=>{const r=await navigator.serviceWorker.ready;const channel=new MessageChannel();const done=new Promise(resolve=>channel.port1.onmessage=resolve);r.active.postMessage({type:'cache-sources',urls:[...document.querySelectorAll('script[src],link[rel=stylesheet]')].map(e=>e.src||e.href).concat(location.origin+'/NIMBYRAILTABLE/index.html')},[channel.port2]);await done;}""")
   context.set_offline(True);page.reload();page.wait_for_selector('.boarding-main');page.locator('[data-boarding-action=receipt]').click();page.locator('#close-dialog').click();context.set_offline(False)
   page.evaluate("localStorage.setItem('raillink.boarding.selected','not-owned');sessionStorage.setItem('raillink.boarding.selected','not-owned')");page.reload();page.wait_for_selector('.empty');assert '승차권을 확인' in page.locator('.empty').inner_text()
   # A real two-leg booking chooses the corresponding ticket, then advances at transfer.
   context.close();context=browser.new_context(viewport={'width':390,'height':844},timezone_id='Asia/Seoul',locale='ko-KR');page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime.datetime(2026,10,29,3,tzinfo=datetime.timezone.utc))
   load();search(True);tickets=saved();assert len(tickets)==2
   page.locator('[data-nav=tickets]').click();page.locator('.ticket-open').click();page.locator('[data-ticket-segment="1"]').click();assert tickets[1]['trainNo'] in page.locator('.ticket-train-heading h3').inner_text();page.locator('#ticket-boarding').click();assert tickets[1]['trainNo'] in page.locator('.boarding-main h2').inner_text()
   page.locator('[data-boarding-leg=auto]').click();assert page.locator('.boarding-transfer').is_visible();page.screenshot(path=str(out/'08-transfer.png'),full_page=True)
   set_time(instant(tickets[0]['arrival'])+datetime.timedelta(seconds=30));assert tickets[1]['trainNo'] in page.locator('.boarding-main h2').inner_text()
   # Return to before departure, cancel through the original grouped refund and reject saved ID.
   set_time(datetime.datetime(2026,10,29,3,tzinfo=datetime.timezone.utc));page.locator('[data-nav=tickets]').click();page.locator('[data-action=cancel]').click();page.locator('#confirm-cancel').click();page.wait_for_selector('.ticket-group',state='detached');page.evaluate("location.hash='boarding'");page.wait_for_selector('.empty');assert page.locator('.boarding-main').count()==0
   assert not errors,errors
   print('PASS: direct ticket screen, exact leg identity, booked-route stops and pass stations, current-position marker, home/ticket assistant entry, reload, preview/read-only state, minute focus, KST stage boundaries, progress, receipt/QR/calendar, no-wrap responsive 320–1280, dark mode, offline cache, missing/cancelled ownership, real transfer auto-advance; zero browser errors.')
   browser.close()
 finally:server.terminate();server.wait()
