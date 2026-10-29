import {matchesStation} from './journey.js';

export function openStationPicker({model,current,which,recent,showDialog,dialog,esc,onChoose,notify,fail}){
 const magnifier='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></svg>';
 showDialog(which==='from'?'출발역 선택':'도착역 선택',`<div class="station-search-field">${magnifier}<input id="station-query" role="combobox" aria-label="역 이름 또는 초성 입력" aria-autocomplete="list" aria-expanded="true" aria-controls="station-options" placeholder="역 이름 또는 초성 입력" autocomplete="off" enterkeyhint="search"><button id="clear-station-query" type="button" aria-label="검색어 지우기" hidden>×</button></div><div id="station-shortcuts" class="station-categories" aria-label="역 목록 분류"></div><button id="favorite-station" type="button" ${current?'':'hidden'}>${esc(current)} 즐겨찾기 전환</button><div id="station-options" class="station-options" role="listbox" aria-label="역 검색 결과"></div><p id="station-count" class="station-count" role="status"></p>`);
 dialog.classList.add('station-dialog');
 const $=s=>dialog.querySelector(s),input=$('#station-query');
 const viewport=window.visualViewport;
 const size=()=>{dialog.style.setProperty('--station-viewport-height',(viewport?.height||innerHeight)+'px');dialog.style.setProperty('--station-viewport-top',(viewport?.offsetTop||0)+'px');};
 size();viewport?.addEventListener('resize',size);viewport?.addEventListener('scroll',size);window.addEventListener('resize',size);
 dialog.addEventListener('close',()=>{viewport?.removeEventListener('resize',size);viewport?.removeEventListener('scroll',size);window.removeEventListener('resize',size);dialog.classList.remove('station-dialog');dialog.style.removeProperty('--station-viewport-height');dialog.style.removeProperty('--station-viewport-top');},{once:true});
 let composing=false,selected=-1,list=[],category='major';
 const major=['서울','용산','수서','청량리','영등포','행신','광명','수원','천안아산','대전','동대구','부산','광주송정','목포','여수엑스포','강릉'];
 const categories=[['major','주요역'],['all','전체'],['recent','최근'],['favorites','즐겨찾기'],...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'].map(c=>Array.isArray(c)?c:[c,c]);
 const choose=st=>{input.blur();dialog.close();onChoose(st);};
 const highlight=()=>{
  const options=[...$('#station-options').children];options.forEach((el,i)=>el.setAttribute('aria-selected',String(i===selected)));
  if(selected>=0){input.setAttribute('aria-activedescendant',options[selected].id);options[selected].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');
 };
 const draw=()=>{
  const term=input.value.trim(),favorites=model.read().favoriteStations||[];
  if(term)list=model.stationRecords.filter(s=>matchesStation(s.name,term)||(s.sourceId&&String(s.sourceId).includes(term))).map(s=>s.name);
  else if(category==='major')list=major.filter(s=>model.stations.includes(s));
  else if(category==='recent')list=[...new Set(recent.flatMap(r=>[r.from,r.to]))].filter(s=>model.stations.includes(s));
  else if(category==='favorites')list=favorites.filter(s=>model.stations.includes(s));
  else list=model.stations.filter(s=>category==='all'||matchesStation(s[0],category));
  selected=-1;input.removeAttribute('aria-activedescendant');
  $('#clear-station-query').hidden=!term;$('#station-shortcuts').hidden=!!term;$('#favorite-station').hidden=!!term||!current;
  $('#station-options').innerHTML=list.map((st,i)=>`<button type="button" role="option" tabindex="-1" aria-selected="false" id="station-option-${i}" data-st="${esc(st)}">${esc(st)}${favorites.includes(st)?'<span aria-label="즐겨찾는 역">★</span>':''}</button>`).join('');
  $('#station-options').scrollTop=0;
  $('#station-count').textContent=list.length?`${list.length}개 역`:'검색 결과가 없습니다.';
  $('#station-options').querySelectorAll('button').forEach(b=>b.onclick=()=>choose(b.dataset.st));
 };
 $('#station-shortcuts').innerHTML=categories.map(([id,label])=>`<button type="button" data-category="${id}" aria-pressed="${id===category}">${label}</button>`).join('');
 $('#station-shortcuts').querySelectorAll('button').forEach(b=>b.onclick=()=>{category=b.dataset.category;$('#station-shortcuts').querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));draw();});
 input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>{composing=false;draw();});input.oninput=()=>{if(!composing)draw();};
 input.onkeydown=e=>{
  if(composing||e.isComposing)return;
  if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(list.length){selected=selected<0?(e.key==='ArrowDown'?0:list.length-1):(selected+(e.key==='ArrowDown'?1:-1)+list.length)%list.length;highlight();}}
  if(e.key==='Enter'){e.preventDefault();if(selected>=0)choose(list[selected]);else if(list.length===1)choose(list[0]);}
 };
 $('#clear-station-query').onpointerdown=e=>e.preventDefault();
 $('#clear-station-query').onclick=()=>{input.value='';draw();input.focus({preventScroll:true});};
 $('#favorite-station').onclick=async()=>{try{const s=model.read(),favorites=s.favoriteStations||[];s.favoriteStations=favorites.includes(current)?favorites.filter(n=>n!==current):[...favorites,current];await model.save(s);draw();notify(s.favoriteStations.includes(current)?'즐겨찾기에 추가했습니다.':'즐겨찾기에서 삭제했습니다.');}catch(error){fail(error);}};
 draw();if(matchMedia('(pointer:fine)').matches)input.focus({preventScroll:true});
}
