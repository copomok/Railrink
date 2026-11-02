"""Verify that seated + standing segments are presented as one same-train ticket."""
import subprocess,tempfile,os,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1];source=Path(os.environ.get('RAIL_SOURCE',str(root.parent/'NIMBYRAILTABLE')));out=root/'artifacts'/'mixed-ticket';out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='raillink-mixed-') as directory:
 os.symlink(root/'dist',directory+'/Railrink');os.symlink(source,directory+'/NIMBYRAILTABLE')
 server=subprocess.Popen(['python3','-m','http.server','4192','--bind','127.0.0.1','--directory',directory],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':390,'height':844},timezone_id='Asia/Seoul',locale='ko-KR');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.clock.install(time=datetime.datetime(2026,11,1,3,tzinfo=datetime.timezone.utc));page.goto('http://127.0.0.1:4192/Railrink/');page.wait_for_selector('#open-date')
   page.evaluate("""async()=>{
    const {createModel,addDays}=await import('/Railrink/js/model.js');const storage={getItem:()=>null,setItem(){}};const model=createModel(RailData,storage);
    let train,stops;for(const candidate of model.trains){const timetable=RailData.stops(candidate);for(let i=0;i<timetable.length-2;i++){const part=timetable.slice(i,i+3);if(part[0].dep&&part[1].arr&&part[1].dep&&part[2].arr){train=candidate;stops=part;break;}}if(train)break;}if(!train)throw Error('연속 운행역이 있는 시험 열차를 찾지 못했습니다.');
    const key=model.key(train),date='2026-11-03',seg1=model.segment(train,stops[0].s,stops[1].s),seg2=model.segment(train,stops[1].s,stops[2].s),offset=Math.floor(seg2.departureMinutes/1440)-Math.floor(seg1.departureMinutes/1440),date2=addDays(date,offset),groupId='J-'+crypto.randomUUID();
    const make=(id,seg,q,seatClass,seats,index)=>{const departure=model.departure(seg,q.date),arrival=new Date(+departure+seg.duration*60000);return {id,key,trainNo:train.no,grade:train.grade,fromStn:q.from,toStn:q.to,travelDate:q.date,serviceDate:model.serviceDate(train,q),seatClass,seats,passengerCount:1,discount:'none',discounts:['none'],totalFare:1000,baseFare:1000,departure:departure.toISOString(),arrival:arrival.toISOString(),dep:seg.dep,arr:seg.arr,status:'active',createdAt:new Date().toISOString(),paymentMode:'virtual',groupId,groupType:'mixed',sameTrain:true,groupSequence:index,groupTotal:2};};
    const tickets=[make('RL-'+crypto.randomUUID(),seg1,{from:stops[0].s,to:stops[1].s,date},'general',['1호차 1A'],0),make('RL-'+crypto.randomUUID(),seg2,{from:stops[1].s,to:stops[2].s,date:date2},'standing',[],1)],state={version:1,tickets,watches:[],routes:[],notifications:true};
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('raillink-bookings',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(JSON.stringify(state),'raillink.v1');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
   }""")
   page.reload();page.wait_for_selector('#open-date');stored=page.evaluate("""async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('raillink-bookings',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const raw=await new Promise((resolve,reject)=>{const tx=db.transaction('state','readonly'),r=tx.objectStore('state').get('raillink.v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();return JSON.parse(raw).tickets;}""");assert len(stored)==1 and len(stored[0]['seatSegments'])==2 and 'groupId' not in stored[0]
   page.locator('[data-nav=tickets]').click();page.wait_for_selector('.ticket-group');assert page.locator('.ticket-group').count()==1;summary=page.locator('.ticket-group').inner_text();assert '입석+좌석 승차권' in summary and '같은 열차에서 좌석 변경' in summary
   page.locator('.ticket-open').click();page.wait_for_selector('.mobile-ticket');dialog=page.locator('dialog');assert '입석+좌석 승차권' in dialog.inner_text();assert '같은 열차를 계속 이용합니다' in dialog.inner_text();assert '열차에서 내리지 않고' in dialog.inner_text();assert page.locator('.ticket-seat-plan span').count()==2;assert page.locator('.ticket-segment-nav').count()==0;assert page.locator('.ticket-qr').count()==1;page.screenshot(path=str(out/'01-unified-ticket.png'),full_page=True)
   page.locator('#ticket-receipt').click();page.get_by_role('heading',name='영수증',exact=True).wait_for();assert '입석+좌석 승차권 1매' in page.locator('dialog').inner_text();page.locator('#close-dialog').click();page.locator('.ticket-open').click();page.locator('#ticket-boarding').click();page.wait_for_selector('.boarding-main');boarding=page.locator('#main').inner_text();assert '같은 열차 좌석 이용 안내' in boarding and '열차에서 내리지 마세요' in boarding;assert '이 여정의 다음 열차' not in boarding and '에서 환승' not in boarding;page.screenshot(path=str(out/'02-same-train-assistant.png'),full_page=True)
   assert not errors,errors;print('PASS unified mixed seat ticket, single train/QR/receipt, seat-segment plan and no-transfer boarding guidance')
   browser.close()
 finally:server.terminate();server.wait()
