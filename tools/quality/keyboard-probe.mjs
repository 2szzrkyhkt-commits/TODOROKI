// Keyboard-only smoke check. No links to external sites or persistent settings are activated.
// This is deliberately partial: other pages, focus contrast and assistive technology remain unverified.
export async function inspectHomeKeyboard(page) {
 const steps=[];
 const check=(condition,message)=>{if(!condition)throw new Error(message);};
 await page.keyboard.press('Tab');
 check(await page.evaluate(()=>document.activeElement?.getAttribute('href')==='#main-content'),'First Tab did not reach the skip link');
 steps.push('Tab reaches skip link');
 await page.keyboard.press('Enter');
 await page.keyboard.press('Tab');
 check(await page.evaluate(()=>!!document.activeElement?.closest('#main-content')),'Skip link did not move sequential keyboard focus into main content');
 steps.push('Enter then Tab enters main content');
 let reached=false;
 for(let i=0;i<80;i++){
  reached=await page.evaluate(()=>!!document.activeElement?.matches('.news-ticker-toggle'));
  if(reached)break;
  await page.keyboard.press('Tab');
 }
 check(reached,'Ticker control was not reachable within 80 Tab presses');
 const button=page.locator('.news-ticker-toggle');
 check(await button.getAttribute('aria-label')==='テロップを一時停止','Unexpected initial ticker control state');
 await page.keyboard.press('Space');
 check(await button.getAttribute('aria-label')==='テロップを再生','Space did not pause the ticker');
 steps.push('Space pauses ticker');
 await page.keyboard.press('Enter');
 check(await button.getAttribute('aria-label')==='テロップを一時停止','Enter did not resume the ticker');
 steps.push('Enter resumes ticker');
 return {steps,scope:'Japanese homepage skip-link and ticker keyboard controls only; not a full-site keyboard audit'};
}
