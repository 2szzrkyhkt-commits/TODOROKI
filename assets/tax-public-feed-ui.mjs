import {publicMetadata} from './tax-public-metadata.mjs';
export async function enhance(root,refresh,fetcher=fetch){
 const note=root.querySelector('#tax-source-live-status');
 try{
  const response=await fetcher('/api/tax-public-links',{credentials:'omit',mode:'same-origin',signal:AbortSignal.timeout(4000)});
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('unavailable');
  const reader=response.body.getReader();let bytes=0,text='';const decoder=new TextDecoder();
  try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>32768)throw Error('too_large');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
  const rows=publicMetadata(JSON.parse(text));
  const known=new Set([...root.querySelectorAll('[data-tax-source-kind] a')].map(a=>a.href));let added=0;
  for(const row of rows){if(known.has(row.official_url))continue;
   const kind=row.official_url.includes('/taxanswer/')?'answer':'circular';
   const group=[...root.querySelectorAll('[data-tax-source-group]')].find(g=>g.querySelector(`[data-tax-source-kind="${kind}"]`));if(!group)continue;
   const li=document.createElement('li'),a=document.createElement('a'),time=document.createElement('time');li.dataset.taxSourceKind=kind;a.href=row.official_url;a.textContent=row.title;time.dateTime=row.checked_at;time.textContent=row.checked_at;
   li.append(a,document.createElement('br'),document.createTextNode('保存・読戻し確認：'),time);group.querySelector('ul').append(li);known.add(row.official_url);added++;
  }
  refresh();note.textContent=`確認済みメタデータ${rows.length}件を取得し、固定一覧と重複しない${added}件を追加しました。全件収録を意味しません。`;
 }catch{note.textContent='追加の公式リンクは取得できませんでした。確認済みの固定6件を引き続き利用できます。';}
}
