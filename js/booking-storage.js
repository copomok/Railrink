// Keep bookings in a transactional store; localStorage is a compatibility mirror.
// Railway caches and other apps on this origin share localStorage's small quota.
export async function openBookingStorage(key){
 let database=null,current=null;
 const legacy=()=>{try{return localStorage.getItem(key);}catch{return null;}};
 try{
  database=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('raillink-bookings',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('state');
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
   request.onblocked=()=>reject(new Error('예약 저장소가 다른 창에서 사용 중입니다.'));
  });
 }catch{/* Browsers without IndexedDB can still use localStorage. */}
 const transaction=(mode,operation)=>new Promise((resolve,reject)=>{
  const tx=database.transaction('state',mode),request=operation(tx.objectStore('state'));
  tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error||request.error);tx.onabort=()=>reject(tx.error||new Error('예약 저장이 중단되었습니다.'));
 });
 async function refresh(){const stored=database?await transaction('readonly',store=>store.get(key)):undefined;current=stored===undefined?legacy():stored;return current;}
 await refresh();
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('raillink-bookings'):null;
 const listeners=new Set();channel?.addEventListener('message',async()=>{await refresh();listeners.forEach(fn=>fn());});
 return {
  getItem:()=>database?current:legacy(),refresh,
  async setItem(name,value){
   if(name!==key)throw Error('알 수 없는 예약 저장 항목입니다.');
   if(database){
    await transaction('readwrite',store=>store.put(value,key));current=value;
    try{localStorage.setItem(key,value);}catch{try{localStorage.removeItem(key);}catch{}}
   }else {localStorage.setItem(key,value);current=value;}
   channel?.postMessage('changed');
  },
  async removeItem(){
   // A persisted empty value prevents an old localStorage mirror from returning.
   if(database){await transaction('readwrite',store=>store.put(null,key));try{localStorage.removeItem(key);}catch{}}
   else localStorage.removeItem(key);
   current=null;channel?.postMessage('changed');
  },
  onChange:fn=>listeners.add(fn)
 };
}
