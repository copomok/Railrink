import subprocess,tempfile,os,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];source=Path(os.environ.get('RAIL_SOURCE',str(root.parent/'NIMBYRAILTABLE')))
out=root/'artifacts'/'booking-refinements';out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='raillink-refinements-') as directory:
 os.symlink(root/'dist',directory+'/Railrink');os.symlink(source,directory+'/NIMBYRAILTABLE')
 server=subprocess.Popen(['python','-m','http.server','4185','--bind','127.0.0.1','--directory',directory],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   context=browser.new_context(viewport={'width':390,'height':844},timezone_id='Asia/Seoul',locale='ko-KR');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.clock.install(time=datetime.datetime(2026,10,29,3,0,tzinfo=datetime.timezone.utc))
   page.goto('http://127.0.0.1:4185/Railrink/');page.wait_for_selector('#open-date')
   assert page.locator('.station-control b').all_inner_texts()==['선택','선택']
   fields=page.locator('.home-fields').bounding_box();button=page.locator('.search-submit').bounding_box();assert button['y']-fields['y']-fields['height']>=11
   page.screenshot(path=str(out/'01-home-spacing.png'),full_page=True)
   page.locator('[data-station=from]').click();page.wait_for_selector('.station-dialog');before=page.locator('dialog').bounding_box();page.locator('#station-query').fill('천안');after=page.locator('dialog').bounding_box();assert abs(before['height']-after['height'])<1;assert page.locator('[data-st]').count()>0
   page.screenshot(path=str(out/'02-station-results.png'))
   # Reduced visual viewport approximates the keyboard's available area; no physical IME is available in headless Chromium.
   page.set_viewport_size({'width':390,'height':420});page.wait_for_timeout(50);assert page.locator('#station-query').bounding_box()['y']<100
   row=page.locator('[data-st]').first.bounding_box();assert row['y']+row['height']<420
   height=page.locator('dialog').bounding_box()['height'];page.locator('#station-query').fill('없는역xxxxx');assert abs(page.locator('dialog').bounding_box()['height']-height)<1
   page.locator('#clear-station-query').click();assert page.locator('#station-query').input_value()=='';page.locator('#station-query').fill('서울');page.locator('[data-st="서울"]').click();page.set_viewport_size({'width':390,'height':844})
   page.locator('[data-station=to]').click();page.locator('#station-query').fill('부산');page.locator('[data-st="부산"]').click()
   page.locator('#open-date').click();page.get_by_role('button',name='내일',exact=True).click();page.locator('#date-form [type=submit]').click();page.locator('#search-form [type=submit]').click();page.wait_for_selector('[data-action=book]:enabled');page.locator('[data-action=book]:enabled').first.click();page.wait_for_selector('.booking-dialog');page.screenshot(path=str(out/'03-booking-options.png'))
   page.locator('#choose-seats').click();page.wait_for_selector('.car-cards');assert page.locator('.car-cards button').count()>1
   assert page.locator('#next-passengers').is_disabled();page.locator('.seat:enabled').first.click();assert '1석 선택' in page.locator('#selected-count').inner_text();assert page.locator('#next-passengers').is_enabled()
   selected_id=page.locator('.seat[aria-pressed=true]').get_attribute('data-value');page.locator('.car-cards button').last.click();page.locator('.car-cards button').first.click();assert page.locator('#selected-labels').inner_text()==selected_id
   for theme in ['light','dark']:
    page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme);page.screenshot(path=str(out/('04-seats-'+theme+'.png')))
   page.locator('.seat-auto-options summary').click();page.locator('[data-seat-class=standing]').click();primary=page.locator('#standing-next').bounding_box();secondary=page.locator('#back-general').bounding_box();assert secondary['y']-primary['y']-primary['height']>=11;page.locator('#back-general').click()
   for width in [320,390,768,1280]:
    page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
   page.set_viewport_size({'width':390,'height':844});page.locator('.seat-close').click();page.wait_for_selector('[data-action=book]:enabled');page.locator('[data-action=book]:enabled').first.click();page.screenshot(path=str(out/'05-booking-dark.png'));page.locator('#quick-book').click();page.wait_for_selector('#passenger-form');assert page.url.endswith('#passengers')
   page.locator('[name=name0]').fill('빠른 예매 검증');page.locator('#passenger-form [type=submit]').click();page.locator('#confirm-form [type=checkbox]').check();page.locator('#confirm-form [type=submit]').click();page.wait_for_url('**/#complete');assert page.evaluate("JSON.parse(localStorage.getItem('raillink.v1')).tickets[0].seats.length")==1
   # Quick assignment must skip manual seats on both legs of round-trip and transfer journeys.
   def quick_result(transfer=False):
    page.wait_for_selector('[data-action='+('book-transfer' if transfer else 'book')+']:enabled');page.locator('[data-action='+('book-transfer' if transfer else 'book')+']:enabled').first.click();page.locator('#quick-book').click()
   def save_quick():
    page.wait_for_selector('#passenger-form');page.locator('[name=name0]').fill('빠른 여정');page.locator('#passenger-form [type=submit]').click();page.locator('#confirm-form [type=checkbox]').check();page.locator('#confirm-form [type=submit]').click();page.wait_for_url('**/#complete')
   page.locator('[data-nav=home]').click();page.locator('.home-options summary').click();page.locator('#roundtrip').click();page.locator('#search-form [type=submit]').click();quick_result();page.wait_for_selector('#restart-journey');quick_result();save_quick()
   assert page.evaluate("JSON.parse(localStorage.getItem('raillink.v1')).tickets.filter(t=>t.groupType==='roundtrip').every(t=>t.seats.length===1)")
   page.locator('[data-nav=home]').click();page.locator('.home-options summary').click();page.locator('#direct-info').click();page.locator('#search-form [type=submit]').click();page.wait_for_selector('#transfer-results .transfer-card');page.locator('#transfer-results').scroll_into_view_if_needed();quick_result(True);save_quick()
   assert page.evaluate("JSON.parse(localStorage.getItem('raillink.v1')).tickets.filter(t=>t.groupType==='transfer').length===2")
   # Create a real, available source-data booking in this isolated browser only, then move the clock before boarding.
   operation=page.evaluate('''async()=>{
    const {createModel}=await import('./js/model.js');const model=createModel(RailData,localStorage);
    const train=RailData.trains.find(t=>String(t.no)==='1574'&&model.segment(t,'천안','서울'));
    if(!train)throw Error('Source 1574 fixture missing');
    const q={from:'천안',to:'서울',date:'2026-10-30',pax:1,cls:'general'};
    const assignment=model.autoAssign(train,q,'random');const t=model.book({key:model.key(train),q,seats:assignment.seats,names:['운행 검증'],discount:'none'});
    return {id:t.id,dep:t.departure};
   }''')
   page.clock.set_system_time(datetime.datetime(2026,10,29,15,18,tzinfo=datetime.timezone.utc));page.locator('[data-nav=tickets]').click();page.wait_for_selector('[data-action=operation]');op=page.locator('[data-action=operation][data-value="'+operation['id']+'"]');op.locator('xpath=ancestor::details').locator('summary').click();op.click();page.wait_for_selector('.brd-live-marker');assert '천안' in page.locator('#ops-status').inner_text();assert '이동 중' in page.locator('#ops-status').inner_text()
   assert page.locator('.brd-stop.board').get_attribute('data-station')=='천안';assert page.locator('.brd-stop.alight').get_attribute('data-station')=='서울';assert '승강장' in page.locator('.brd-stop.board').inner_text();assert page.locator('.brd-live-marker').evaluate("el=>el.closest('.brd-stop').classList.contains('before')")
   page.screenshot(path=str(out/'06-timetable-dark.png'));page.evaluate("document.documentElement.dataset.theme='light'");page.screenshot(path=str(out/'07-timetable-light.png'))
   page.locator('.brd-stop-list').evaluate('el=>el.scrollTop=el.scrollHeight/2');scroll=page.locator('.brd-stop-list').evaluate('el=>el.scrollTop');page.clock.fast_forward(61000);assert abs(page.locator('.brd-stop-list').evaluate('el=>el.scrollTop')-scroll)<1
   page.locator('[data-ops-tab=map]').click();page.wait_for_selector('.brd-map-live-train');page.locator('.operation-map').evaluate("el=>el.dataset.persistent='yes'");page.clock.fast_forward(61000);assert page.locator('.operation-map').get_attribute('data-persistent')=='yes';assert page.locator('#ops-map').is_visible();page.screenshot(path=str(out/'08-map.png'))
   page.locator('[data-ops-tab=time]').click();page.set_viewport_size({'width':320,'height':650});assert page.locator('dialog').evaluate('el=>el.scrollWidth<=el.clientWidth');page.locator('#close-dialog').click();page.wait_for_function("!document.querySelector('dialog').classList.contains('operations-dialog')")
   page.set_viewport_size({'width':390,'height':844});page.locator('[data-nav=home]').click();page.locator('#open-passengers').click();page.locator('[name=pax]').select_option('6');page.locator('#pax-form [type=submit]').click();page.locator('#search-form [type=submit]').click();page.wait_for_selector('[data-action=book]:enabled');page.locator('[data-action=book]:enabled').first.click();page.locator('#quick-book').click();assert page.locator('#quick-book').inner_text()=='분리 좌석으로 계속'
   page.locator('[data-booking-class=general]').click();assert page.locator('#quick-book').inner_text()=='바로 예매';assert page.locator('#booking-error').inner_text()=='';page.locator('#quick-book').click();assert page.locator('#quick-book').inner_text()=='분리 좌석으로 계속';page.locator('#quick-book').click();page.wait_for_selector('#passenger-form');assert page.locator('#passenger-form [name^=name]').count()==6
   assert not errors,errors
   print('PASS: home labels/gaps, fixed-height station search with reduced viewport/empty results, optional manual seats and single/roundtrip/transfer quick booking, seat selection retained across cars, both themes and four widths, original-style full-run timeline/platforms, pre-boarding train marker, persistent scroll/map on clock tick, dialog cleanup.')
   browser.close()
 finally:server.terminate();server.wait()
