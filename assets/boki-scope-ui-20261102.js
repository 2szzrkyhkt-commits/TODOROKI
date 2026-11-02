/* Scope review is intentionally separate from mastery / complete syllabus coverage. */
(()=>{
const host=document.querySelector('#scope-review');
if(!host)return;
const year=document.querySelector('#scope-year'),subject=document.querySelector('#scope-subject'),query=document.querySelector('#scope-search'),pending=document.querySelector('#scope-pending');
const normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g,c=>String.fromCharCode(c.charCodeAt(0)-96));
const rows=document.querySelector('#scope-rows'),counter=document.querySelector('#scope-count');
function render(){
 const found=bokiScope.filter(x=>x.years.includes(Number(year.value))&&(!subject.value||x.subject===subject.value)&&normalize(x.title+x.detail+x.subject).includes(normalize(query.value))).map(x=>({...x,l:lessons.filter(l=>l.topic===x.topic),q:qs.filter(q=>q.topic===x.topic)})).filter(x=>!pending.checked||!x.l.length||!x.q.length);
 rows.replaceChildren();counter.textContent=found.length+'学習単位を表示（公式の小項目数とは異なります）';
 found.forEach(x=>{const box=document.createElement('details');box.className='scope-row';const summary=document.createElement('summary');summary.textContent=x.subject+'｜'+x.title+' — '+(x.l.length||x.q.length?'関連教材あり・細目精査中':'関連カテゴリの教材未掲載');box.append(summary);
 const detail=document.createElement('p');detail.textContent='確認する細目：'+x.detail;box.append(detail);
 const status=document.createElement('p');status.className='small';status.textContent='関連カテゴリ全体：解説'+x.l.length+'件／問題'+x.q.length+'問。この単位の全細目に対応する件数ではありません。詳細解説・仕訳・応用計算・総合演習の充足確認は未完了です。';box.append(status);
 if(x.l.length){const btn=document.createElement('button');btn.type='button';btn.textContent='関連する解説を開く';btn.addEventListener('click',()=>{document.querySelector('[data-view="learn"]').click();lessonTopic.value=x.topic;document.querySelector('#search').value='';lessonPage=0;renderCards();document.querySelector('#count').scrollIntoView({block:'start',behavior:'smooth'});});box.append(btn);}
 if(x.q.length){const btn=document.createElement('button');btn.type='button';btn.textContent='関連する問題を開く';btn.addEventListener('click',()=>{document.querySelector('[data-view="quiz"]').click();quizTopic.value=x.topic;quizSearch.value='';quizStatus.value='all';quizPage=0;renderQuiz();document.querySelector('#quiz-count').scrollIntoView({block:'start',behavior:'smooth'});});box.append(btn);}
 rows.append(box);});
}
[year,subject,pending].forEach(el=>el.addEventListener('change',render));query.addEventListener('input',render);render();
})();
