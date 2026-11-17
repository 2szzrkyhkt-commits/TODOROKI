import {course} from './tax-course-content.mjs';
import {grade,decodeProgress,encodeProgress,lessonIds} from './tax-course-engine.mjs';
const root=document.querySelector('#tax-course'),select=root.querySelector('#tax-subject'),search=root.querySelector('#tax-search');
const count=root.querySelector('#tax-visible-count'),progress=root.querySelector('#tax-progress'),storageNote=root.querySelector('#tax-storage-note');
const key='todoroki.tax-course.progress.v1';let writable=true,state;
try{state=decodeProgress(localStorage.getItem(key));if(!state.readable)writable=false;}catch{state={ids:[]};writable=false;}
const correctOnce=new Set(state.ids);
function updateProgress(){progress.textContent='この端末の正解済み論点：'+lessonIds.filter(id=>correctOnce.has(id)).length+' / '+lessonIds.length;storageNote.textContent=writable?'正解した論点だけをこのブラウザに保存します。氏名・点数・回答はサーバーへ送りません。':'このブラウザでは履歴を保存・読込できないため、この画面だけで学習します。既存の保存値は上書きしません。';}
function save(){if(writable)try{localStorage.setItem(key,encodeProgress([...correctOnce]));}catch{writable=false;}updateProgress();}
function filter(){
 const query=search.value.normalize('NFKC').toLocaleLowerCase('ja').trim();let n=0;
 for(const article of root.querySelectorAll('[data-tax-lesson]')){
  const lesson=course.lessons.find(l=>l.id===article.dataset.taxLesson);
  const subject=course.subjects.find(s=>s.id===lesson.subject);
  const match=(select.value==='all'||select.value===lesson.subject)&&(!query||(subject.name+' '+article.textContent).normalize('NFKC').toLocaleLowerCase('ja').includes(query));
  article.hidden=!match;if(match)n++;
 }
 count.textContent=n+'論点を表示 / 全'+lessonIds.length+'論点';root.querySelector('#tax-no-results').hidden=n!==0;
}
for(const form of root.querySelectorAll('form[data-tax-quiz]')){
 const id=form.dataset.taxQuiz,feedback=form.querySelector('[data-tax-feedback]');
 for(const b of form.querySelectorAll('button'))b.disabled=false;
 form.addEventListener('submit',e=>{
  e.preventDefault();const choice=form.querySelector('input:checked')?.value,r=grade(id,choice);
  feedback.hidden=false;feedback.textContent=!r.valid?r.message:(r.correct?'正解。':'不正解。')+' '+r.message;
  feedback.dataset.result=r.valid?(r.correct?'correct':'incorrect'):'unanswered';
  if(r.valid&&r.correct){correctOnce.add(id);save();}
 });
 form.querySelector('[data-tax-retry]').addEventListener('click',()=>{
  form.reset();feedback.hidden=true;feedback.textContent='';delete feedback.dataset.result;
  correctOnce.delete(id);save();
 });
}
select.disabled=false;search.disabled=false;
select.addEventListener('change',filter);search.addEventListener('input',filter);
for(const a of root.querySelectorAll('[data-tax-subject-link]'))a.addEventListener('click',()=>{
 select.value=a.dataset.taxSubjectLink;search.value='';filter();
});
function applyHash(){
 let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
 const lesson=course.lessons.find(l=>'tax-lesson-'+l.id===id);
 if(lesson){select.value=lesson.subject;search.value='';}
}
select.value='income';applyHash();filter();updateProgress();
window.addEventListener('hashchange',()=>{applyHash();filter();});
