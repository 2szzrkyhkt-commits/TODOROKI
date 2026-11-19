import {course} from './tax-course-content.mjs';
export const lessonIds=course.lessons.map(l=>l.id);
export function grade(lessonId,choice){
 const lesson=course.lessons.find(l=>l.id===lessonId);
 if(!lesson||!lesson.quiz.choices.some(c=>c.id===choice))return {valid:false,correct:false,message:'回答を1つ選んでください。'};
 return {valid:true,correct:choice===lesson.quiz.answer,message:lesson.quiz.explanation};
}
export function decodeProgress(raw){
 if(raw===null)return {readable:true,ids:[]};
 try{
  const x=JSON.parse(raw);
  if(x.schema!==1||!Array.isArray(x.correctOnce)||x.correctOnce.length>1000||x.correctOnce.some(id=>typeof id!=='string'||!/^[a-z][a-z0-9-]{1,60}$/.test(id)))return {readable:false,ids:[]};
  return {readable:true,ids:[...new Set(x.correctOnce)]};
 }catch{return {readable:false,ids:[]};}
}
export const encodeProgress=ids=>JSON.stringify({schema:1,correctOnce:[...new Set(ids)]});
