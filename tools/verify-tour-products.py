import subprocess,tempfile,os,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
source=Path(os.environ.get('RAIL_SOURCE',str(root.parent/'NIMBYRAILTABLE')))
out=root/'artifacts'/'tour-products';out.mkdir(parents=True,exist_ok=True)

with tempfile.TemporaryDirectory(prefix='raillink-tours-') as directory:
 os.symlink(root/'dist',directory+'/Railrink');os.symlink(source,directory+'/NIMBYRAILTABLE')
 server=subprocess.Popen(['python','-m','http.server','4191','--bind','127.0.0.1','--directory',directory],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   context=browser.new_context(viewport={'width':390,'height':844},timezone_id='Asia/Seoul',locale='ko-KR')
   page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
   page.clock.install(time=datetime.datetime(2026,10,31,15,tzinfo=datetime.timezone.utc))
   page.goto('http://127.0.0.1:4191/Railrink/#travel');page.wait_for_selector('[data-action=tour-product]')
   assert page.locator('[data-action=tour-grade]').count()==2
   assert page.locator('[data-action=tour-product]').count()==6
   assert '전체 8' in page.locator('.tour-filter').inner_text()
   products=[('tour-gyeongju','천년의 시간, 경주 여행'),('tour-gangneung','바다와 커피, 강릉 하루'),('tour-jeonju','맛과 멋의 도시, 전주'),('tour-pyongyang','평양, 도시의 시간을 걷다'),('tour-sunrise','동해의 첫 햇살'),('tour-rail-loop','철길 따라 전국 일주')]
   for product_id,name in products:
    page.goto('http://127.0.0.1:4191/Railrink/#travel');page.wait_for_selector('[data-action=tour-product]')
    page.locator(f'[data-action=tour-product][data-value="{product_id}"]').click();page.wait_for_url('**/#tour-product');page.wait_for_selector('.tour-detail-page')
    assert name in page.locator('main').inner_text(),product_id
    assert page.locator('[data-action=tour-plan]').count()==1,product_id
   page.goto('http://127.0.0.1:4191/Railrink/#travel');page.wait_for_selector('[data-action=tour-product]')
   page.locator('[data-action=tour-filter][data-value=themes]').click();assert page.locator('[data-action=tour-grade]').count()==0 and page.locator('[data-action=tour-product]').count()==6
   page.screenshot(path=str(out/'01-list.png'),full_page=True)
   page.locator('[data-action=tour-product][data-value="tour-gyeongju"]').click();page.wait_for_url('**/#tour-product');page.get_by_role('heading',name='천년의 시간, 경주 여행',exact=True).wait_for()
   assert '서울 ↔ 경주 권역' in page.locator('.tour-info-card').inner_text()
   assert page.locator('[data-action=tour-plan]:enabled').count()==1
   page.screenshot(path=str(out/'02-detail.png'),full_page=True)
   page.locator('[data-action=tour-plan]').click();page.wait_for_url('**/#tour-itinerary');page.wait_for_selector('#tour-plan-form')
   assert page.locator('.tour-schedule article').count()==6
   page.locator('[name=date]').fill('2026-11-07');assert page.locator('[name=from]').input_value()=='서울';assert page.locator('[name=to]').input_value()=='경주'
   page.screenshot(path=str(out/'03-itinerary.png'),full_page=True)
   page.locator('#tour-plan-form [type=submit]').click();page.wait_for_url('**/#results');page.wait_for_selector('.result-search-card')
   assert '07:00~09:00' in page.locator('.tour-result-product').inner_text();assert '직통·환승' in page.locator('.result-option-bar').inner_text()
   assert page.locator('.train-card,.transfer-card,.empty').count()>0
   page.screenshot(path=str(out/'04-results.png'),full_page=True)
   page.locator('[data-query-open=conditions]').first.click();assert page.locator('[name=after]').input_value()=='07:00';assert page.locator('[name=before]').input_value()=='09:00';page.locator('#close-dialog').click()
   page.goto('http://127.0.0.1:4191/Railrink/#travel');page.wait_for_selector('[data-action=tour-product]')
   page.locator('[data-action=tour-product][data-value="tour-rail-loop"]').click();page.get_by_role('heading',name='철길 따라 전국 일주',exact=True).wait_for();page.locator('[data-action=tour-plan]:enabled').click();page.wait_for_selector('#tour-plan-form')
   assert page.locator('.tour-schedule article').count()==5;assert '서울 → 강릉' in page.locator('.tour-segment-summary').inner_text();assert '부산 → 서울' in page.locator('.tour-segment-summary').inner_text()
   for width in [320,390,768,1280]:
    page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
   assert not errors,errors
   print('PASS: 8-product catalog, filters, six regional products, detail, itinerary, actual search handoff, time window, transfer inclusion, rail-loop segments and responsive widths.')
   browser.close()
 finally:
  server.terminate();server.wait()
