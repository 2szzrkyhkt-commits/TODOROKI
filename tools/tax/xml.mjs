// Bounded official payload markers; no full UTF-16 copy or XML schema claim.
export function isLawXml(bytes){
 if(!(bytes instanceof Uint8Array))return false;
 const whitespace=n=>n===32||n===9||n===10||n===13;
 let opened=-1,closed=-1;
 for(let p=bytes.indexOf(76);p>=0;p=bytes.indexOf(76,p+1)){
  if(bytes[p-1]===60&&bytes[p+1]===97&&bytes[p+2]===119&&(bytes[p+3]===62||whitespace(bytes[p+3]))){opened=p-1;break;}
 }
 if(opened<0)return false;
 for(let p=bytes.lastIndexOf(76);p>=0;p=bytes.lastIndexOf(76,p-1)){
  if(p<opened)break;
  if(bytes[p-2]===60&&bytes[p-1]===47&&bytes[p+1]===97&&bytes[p+2]===119){
   let end=p+3;while(whitespace(bytes[end]))end++;
   if(bytes[end]===62){closed=end+1;break;}
  }
  if(p===0)break;
 }
 if(closed<0)return false;
 // The official API's Error envelope is outside the Law subtree.
 for(const segment of [bytes.subarray(0,opened),bytes.subarray(closed)]){
  for(let p=segment.indexOf(69);p>=0;p=segment.indexOf(69,p+1)){
   if(segment[p-1]===60&&segment[p+1]===114&&segment[p+2]===114&&segment[p+3]===111&&segment[p+4]===114&&(segment[p+5]===62||whitespace(segment[p+5])))return false;
  }
 }
 return true;
}
