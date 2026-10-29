"""Real browser session/navigation, boundary refresh, copy layout and focus checks."""
import subprocess,tempfile,os,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];source=Path(os.environ.get('RAIL_SOURCE',str(root.parent/'NIMBYRAILTABLE')))
out=root/'artifacts'/'greetings';out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='raillink-greetings-') as directory:
 os.symlink(root/'dist',directory+'/Railrink');os.symlink(source,directory+'/NIMBYRAILTABLE')
 server=subprocess.Popen(['python','-m','http.server','4189','--bind','127.0.0.1','--directory',directory],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':390,'height':844},timezone_id='America/Los_Angeles',locale='ko-KR');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.clock.install(time=datetime.datetime(2026,10,30,3,tzinfo=datetime.timezone.utc));page.goto('http://127.0.0.1:4189/Railrink/');page.wait_for_selector('[data-greeting-id]')
   def greeting():return page.locator('[data-greeting-id]').get_attribute('data-greeting-id')
   def set_time(kst):
    page.clock.set_system_time(datetime.datetime.fromisoformat(kst+'+09:00'))
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
   first=greeting();page.locator('[data-nav=tickets]').click();page.locator('[data-nav=home]').click();assert greeting()==first
   page.locator('#tab-pass').click();assert greeting()==first;page.locator('#tab-tour').click();assert greeting()==first;page.locator('#tab-booking').click();assert greeting()==first
   page.locator('[data-station=from]').click();page.locator('#station-query').fill('서울');page.locator('[data-st="서울"]').click();assert greeting()==first
   page.evaluate("window.greetingMutations=0;new MutationObserver(r=>window.greetingMutations+=r.length).observe(document.querySelector('.home-greeting'),{subtree:true,childList:true,characterData:true,attributes:true});window.greetingHeading=document.querySelector('.home-greeting h1');")
   page.clock.fast_forward(61000);assert greeting()==first;assert page.evaluate("window.greetingMutations===0&&window.greetingHeading===document.querySelector('.home-greeting h1')")
   ids=[first]
   for _ in range(5):
    page.reload();page.wait_for_selector('[data-greeting-id]');ids.append(greeting());assert ids[-1]!=ids[-2]
   assert len(set(ids))>=2
   # Wake an already-open app at the exact KST boundaries, with a picker open.
   set_time('2026-10-30T01:29:00');assert int(greeting())<=100
   page.locator('[data-station=to]').click();page.locator('#station-query').fill('부');set_time('2026-10-30T01:30:00');night=greeting();assert 101<=int(night)<=110
   assert page.locator('#station-query').input_value()=='부';assert page.locator('#station-query').evaluate('el=>document.activeElement===el');page.locator('#close-dialog').click()
   set_time('2026-10-30T04:50:59');assert greeting()==night
   set_time('2026-10-30T04:51:00');assert int(greeting())<=100
   set_time('2026-10-30T05:00:00');assert int(greeting())<=100
   # Minute timer, without a visibility event, enters the exclusive overnight pool.
   set_time('2026-10-31T01:29:00');page.clock.fast_forward(61000);assert 101<=int(greeting())<=110
   page.screenshot(path=str(out/'01-overnight.png'),full_page=True)
   # New Korean day updates even with the device set to a different timezone.
   set_time('2026-12-31T23:59:00');previous=greeting();set_time('2027-01-01T00:00:00');assert greeting()!=previous
   # Every supplied copy can wrap within existing home typography at all widths.
   for theme in ['light','dark']:
    page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
    for width in [320,390,768,1280]:
     page.set_viewport_size({'width':width,'height':900})
     overflow=page.evaluate("""async()=>{const {HOME_GREETINGS}=await import('./js/greeting-data.js');const title=document.querySelector('[data-greeting-title]'),subtitle=document.querySelector('[data-greeting-subtitle]');return HOME_GREETINGS.filter(g=>{title.textContent=g.title;subtitle.textContent=g.subtitle;return document.documentElement.scrollWidth>innerWidth;}).map(g=>g.id);}""")
     assert overflow==[],(theme,width,overflow)
    page.set_viewport_size({'width':390,'height':844});page.evaluate("document.querySelector('[data-greeting-title]').textContent='오늘 하루는 어떻게 보내고 계세요?';document.querySelector('[data-greeting-subtitle]').textContent='다음 여정을 준비해 볼까요?'");page.screenshot(path=str(out/('02-long-'+theme+'.png')),full_page=True)
   assert not errors,errors
   print('PASS: stable SPA navigation/renders/minute tick; reload redraw without repeats; KST boundaries on LA device; background wake and picker focus; all 110 copies at four widths in light/dark.')
   browser.close()
 finally:server.terminate();server.wait()
