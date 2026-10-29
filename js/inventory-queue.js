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
 if(!state.eligible)return '판매 전';if(state.available<count)return '매진';
 const rate=state.booked/Math.max(1,state.capacity);
 return rate<.55?'여유':rate<.8?'보통':'혼잡';
}
