// One visible row per task. Disposing a search prevents stale DOM writes.
export function observeInventory(elements,compute,onError){
 let disposed=false,scheduled=false;const queue=[],seen=new WeakSet();let handle;
 const schedule=()=>{if(disposed||scheduled||!queue.length)return;scheduled=true;handle=setTimeout(()=>{scheduled=false;const el=queue.shift();if(!disposed&&el?.isConnected){try{compute(el);}catch(error){onError(el,error);}}schedule();},16);};
 const enqueue=el=>{if(seen.has(el))return;seen.add(el);queue.push(el);schedule();};
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){enqueue(e.target);observer.unobserve(e.target);}},{rootMargin:'120px'}):null;
 for(const el of elements)observer?observer.observe(el):enqueue(el);
 return ()=>{disposed=true;clearTimeout(handle);queue.length=0;observer?.disconnect();};
}
export function inventoryLabel(state,count=1){
 return inventoryPresentation(state,count).label;
}
export function inventoryPresentation(state,count=1,{standing=false,standingAvailable=false}={}){
 if(!state?.eligible)return {label:'판매 전',tone:'soldout',soldOut:true};
 if(state.available<count){
  if(standingAvailable)return {label:'입석',tone:'standing',soldOut:false};
  return {label:'매진',tone:'soldout',soldOut:true};
 }
 if(standing)return {label:'입석',tone:'standing',soldOut:false};
 const rate=state.booked/Math.max(1,state.capacity);
 return rate<.55?{label:'여유',tone:'relaxed',soldOut:false}:rate<.8?{label:'보통',tone:'normal',soldOut:false}:{label:'혼잡',tone:'crowded',soldOut:false};
}
