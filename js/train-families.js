export const trainFamilies=[['all','전체'],['ktx','KTX'],['chun','ITX-청춘'],['itx','ITX-새마을/마음'],['mugunghwa','무궁화호']];
export function trainFamily(grade){
 if(grade.startsWith('KTX')||grade==='SRT')return 'ktx';
 if(grade==='ITX-청춘')return 'chun';
 if(['ITX-새마을','ITX-마음'].includes(grade))return 'itx';
 return 'mugunghwa';
}
export const matchesFamily=(grade,family)=>!family||family==='all'||trainFamily(grade)===family;
