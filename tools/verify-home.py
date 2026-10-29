import subprocess,tempfile,os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=Path(os.environ.get('RAIL_SOURCE',str(root.parent/'NIMBYRAILTABLE')))
out=root/'artifacts'/'home-renewal';out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='raillink-home-') as directory:
 os.symlink(root/'dist',directory+'/Railrink')
 os.symlink(source,directory+'/NIMBYRAILTABLE')
 server=subprocess.Popen(['python','-m','http.server','4183','--bind','127.0.0.1','--directory',directory],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   page=b.new_page(viewport={'width':390,'height':844},timezone_id='Asia/Seoul',locale='ko-KR')
   errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
   page.goto('http://127.0.0.1:4183/Railrink/');page.wait_for_selector('#open-date')
   assert page.locator('.navigation a').count()==5
   page.screenshot(path=str(out/'01-home-empty.png'),full_page=True)
   page.locator('#tab-booking').focus();page.keyboard.press('ArrowRight');assert page.locator('#tab-pass').get_attribute('aria-selected')=='true'
   page.locator('#tab-tour').click();assert page.locator('.home-tab-body [data-action=tour]').count()>0
   page.locator('#tab-booking').click()
   page.locator('[data-station=from]').click();field=page.locator('#station-query');field.fill('ㅅㅇ');assert page.locator('[data-st="서울"]').count()==1
   field.fill('서울');page.keyboard.press('ArrowDown');page.keyboard.press('Enter');assert not page.locator('dialog').is_visible()
   page.locator('[data-station=to]').click();field=page.locator('#station-query');field.evaluate("el=>el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}))");field.fill('부산');assert field.evaluate('el=>document.activeElement===el')
   field.evaluate("el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}))");page.locator('[data-st="부산"]').click()
   page.locator('#open-date').click();page.get_by_role('button',name='내일',exact=True).click();page.locator('[name=after]').fill('10:00');page.locator('#date-form [type=submit]').click()
   assert '10:00' in page.locator('#open-date').inner_text()
   page.screenshot(path=str(out/'02-home-search.png'),full_page=True)
   page.locator('#search-form [type=submit]').click();page.wait_for_selector('.train-card');assert page.locator('.journey-line strong').first.inner_text()>='10:00'
   page.locator('[data-action=book]:enabled').first.click();page.wait_for_selector('.seat');page.locator('.seat:enabled').first.click();page.locator('#next-passengers').click();page.locator('[name=name0]').fill('홈 검증');page.locator('#passenger-form [type=submit]').click();page.locator('#confirm-form [type=checkbox]').check();page.locator('#confirm-form [type=submit]').click();page.wait_for_url('**/#complete')
   page.locator('[data-nav=home]').click();page.wait_for_selector('.home-journey');assert page.locator('#home-journeys .home-journey').count()==1
   page.screenshot(path=str(out/'03-home-booked.png'),full_page=True)
   page.locator('.home-journey').first.click();page.wait_for_selector('dialog[open]');page.locator('#close-dialog').click()
   page.locator('#home-notifications').click();assert '서울' in page.locator('.dialog-body').inner_text();page.locator('#close-dialog').click()
   for width in [320,390,600,1280]:
    page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
   page.set_viewport_size({'width':390,'height':844})
   # Simulate time in the browser only; actual booked record and shared timetable remain unchanged.
   departure=page.evaluate("JSON.parse(localStorage.getItem('raillink.v1')).tickets[0].departure")
   page.clock.install(time=__import__('datetime').datetime.fromisoformat(departure.replace('Z','+00:00')))
   page.reload();page.wait_for_selector('.home-live');assert '탑승 중' in page.locator('.home-live').inner_text()
   page.locator('[data-station=from]').click();page.locator('#station-query').fill('청량');page.clock.fast_forward(61000);assert page.locator('#station-query').input_value()=='청량';assert page.locator('#station-query').evaluate('el=>document.activeElement===el');page.locator('#close-dialog').click();page.clock.fast_forward(61000);assert page.locator('.home-live').count()==1
   page.locator('[data-nav=tickets]').click();page.wait_for_selector('#ticket-list .ticket-card');assert '탑승 중' in page.locator('#ticket-list').inner_text()
   assert not errors,errors
   assert any('/NIMBYRAILTABLE/data/nimbi_rail_data.js' in r for r in requests)
   assert not any('/Railrink/data/' in r for r in requests)
   print('PASS: home tabs, keyboard/IME station search, time filter, focus-preserving minute refresh, full booking, stored schedule, notices, in-progress ticket, 320/390/600/1280 widths, canonical data, zero browser errors.')
   b.close()
 finally:server.terminate();server.wait()
