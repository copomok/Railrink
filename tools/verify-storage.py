"""Exercise durable transfer booking with the origin's localStorage quota full."""
import subprocess,tempfile,os,datetime,json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];source=Path(os.environ.get('RAIL_SOURCE',str(root.parent/'NIMBYRAILTABLE')))
with tempfile.TemporaryDirectory(prefix='raillink-storage-') as directory:
 os.symlink(root/'dist',directory+'/Railrink');os.symlink(source,directory+'/NIMBYRAILTABLE')
 server=subprocess.Popen(['python','-m','http.server','4187','--bind','127.0.0.1','--directory',directory],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   context=browser.new_context(viewport={'width':390,'height':844},timezone_id='Asia/Seoul',is_mobile=True,has_touch=True)
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.clock.install(time=datetime.datetime(2026,10,29,3,tzinfo=datetime.timezone.utc))
   page.goto('http://127.0.0.1:4187/Railrink/');page.wait_for_selector('#open-date')
   # A pre-existing v1 state must survive migration, alongside unrelated origin data.
   page.evaluate("localStorage.setItem('raillink.v1',JSON.stringify({version:1,tickets:[],watches:[],routes:[{from:'천안',to:'서울'}],favoriteStations:['부산']}))")
   page.reload();page.wait_for_selector('#open-date')
   full=page.evaluate("""()=>{let value='';for(let step=2**23;step>=1;step=Math.floor(step/2)){try{localStorage.setItem('quota-fixture',value+'x'.repeat(step));value+='x'.repeat(step);}catch{}}try{localStorage.setItem('quota-check','x'.repeat(5000));return false;}catch(e){return e.name==='QuotaExceededError';}}""")
   assert full
   for field,station in [('from','서울'),('to','부산')]:
    page.locator('[data-station='+field+']').click();page.locator('#station-query').fill(station);page.locator('[data-st="'+station+'"]').click()
   page.locator('#open-date').click();page.get_by_role('button',name='내일',exact=True).click();page.locator('[name=after]').fill('10:00');page.locator('#date-form [type=submit]').click();page.locator('#search-form [type=submit]').click()
   page.locator('[data-query-open=route]').click();page.locator('[name=route][value=transfer]').check();page.locator('#query-options-form [type=submit]').click()
   page.wait_for_selector('[data-action=book-transfer]:enabled');page.locator('[data-action=book-transfer]:enabled').first.click();page.locator('#quick-book').click()
   page.locator('#passenger-form [type=submit]').click();page.locator('#confirm-form [type=checkbox]').check();page.locator('#confirm-form [type=submit]').click();page.wait_for_url('**/#complete')
   def stored():
    return page.evaluate("""async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('raillink-bookings',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('raillink.v1');r.onsuccess=()=>{db.close();resolve(JSON.parse(r.result));};});}""")
   state=stored();assert len(state['tickets'])==2;assert len({t['groupId'] for t in state['tickets']})==1;assert state['routes']==[{'from':'천안','to':'서울'}];assert state['favoriteStations']==['부산']
   page.locator('[data-nav=tickets]').click();page.reload();page.wait_for_selector('.ticket-group');assert page.locator('.ticket-group').count()==1;page.locator('.ticket-group summary').click();assert page.locator('.ticket-card').count()==2
   # Reopening and refunding the full journey must use the durable store too.
   page.locator('[data-action=cancel]').click();page.locator('#confirm-cancel').click();page.wait_for_selector('.ticket-group',state='detached');assert all(t['status']=='cancelled' for t in stored()['tickets'])
   page.reload();page.locator('[data-ticket-filter=history]').click();page.wait_for_selector('.ticket-group');assert '환불 완료' in page.locator('.ticket-group').inner_text();assert page.evaluate("localStorage.getItem('quota-fixture').length>1000000")
   page.locator('[data-nav=my]').click()
   with page.expect_download() as download_info:page.locator('[data-action=export]').click()
   exported=json.loads(Path(download_info.value.path()).read_text());assert len(exported['tickets'])==2
   page.locator('[data-action=reset]').click();page.locator('#confirm-reset').click();page.wait_for_selector('dialog[open]',state='detached');page.reload();page.locator('[data-nav=tickets]').click();page.wait_for_selector('#ticket-list .empty');assert stored() is None
   assert not errors,errors
   print('PASS: full localStorage quota, legacy data preserved, atomic two-leg transfer in IndexedDB, reload, refund and reload; unrelated origin data retained.')
   browser.close()
 finally:server.terminate();server.wait()
