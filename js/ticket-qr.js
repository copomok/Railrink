// QR Model 2, version 3-L, byte mode, fixed mask 0 (ISO/IEC 18004).
// Payload is a local opaque ticket ID only; this is not railway validation.
export function ticketMatrix(id){
 if(!/^RL-[0-9a-f-]{36}$/i.test(id))throw Error('승차권 ID 형식이 올바르지 않습니다.');
 const bytes=new TextEncoder().encode(id),bits=[];
 const put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>>i)&1);};
 put(4,4);put(bytes.length,8);bytes.forEach(b=>put(b,8));put(0,4);while(bits.length%8)bits.push(0);
 const data=[];for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((a,b)=>(a<<1)|b,0));
 for(let i=0;data.length<55;i++)data.push(i%2?0x11:0xec);
 const multiply=(x,y)=>{let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11d);z^=((y>>>i)&1)*x;}return z;};
 let generator=[1],root=1;
 for(let i=0;i<15;i++){const next=Array(generator.length+1).fill(0);generator.forEach((c,j)=>{next[j]^=c;next[j+1]^=multiply(c,root);});generator=next;root=multiply(root,2);}
 const remainder=Array(15).fill(0);for(const byte of data){const factor=byte^remainder.shift();remainder.push(0);for(let i=0;i<15;i++)remainder[i]^=multiply(generator[i+1],factor);}
 const stream=[...data,...remainder].flatMap(b=>Array.from({length:8},(_,i)=>(b>>>(7-i))&1));
 const size=29,m=Array.from({length:size},()=>Array(size).fill(false)),reserved=m.map(row=>row.slice());
 const set=(x,y,v)=>{if(x>=0&&y>=0&&x<size&&y<size){m[y][x]=!!v;reserved[y][x]=true;}};
 for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
 for(const [cx,cy] of [[3,3],[size-4,3],[3,size-4]])for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));set(cx+dx,cy+dy,d!==2&&d!==4);}
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(22+dx,22+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
 const format=0x77c4,bit=i=>(format>>>i)&1;
 for(let i=0;i<=5;i++)set(8,i,bit(i));set(8,7,bit(6));set(8,8,bit(7));set(7,8,bit(8));for(let i=9;i<15;i++)set(14-i,8,bit(i));
 for(let i=0;i<8;i++)set(size-1-i,8,bit(i));for(let i=8;i<15;i++)set(8,size-15+i,bit(i));set(8,size-8,true);
 let cursor=0;
 for(let right=size-1;right>=1;right-=2){if(right===6)right=5;for(let v=0;v<size;v++){const y=((right+1)&2)===0?size-1-v:v;for(let j=0;j<2;j++){const x=right-j;if(!reserved[y][x])m[y][x]=!!((stream[cursor++]||0)^((x+y)%2===0?1:0));}}}
 return m;
}
export function ticketQR(id){const m=ticketMatrix(id);return `<svg class="ticket-qr" viewBox="0 0 37 37" role="img" aria-label="승차권 확인용 QR" shape-rendering="crispEdges"><rect width="37" height="37" fill="white"/><path fill="black" d="${m.flatMap((row,y)=>row.flatMap((on,x)=>on?[`M${x+4},${y+4}h1v1h-1z`]:[])).join('')}"/></svg>`;}
