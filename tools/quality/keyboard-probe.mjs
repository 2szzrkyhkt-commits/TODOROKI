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

 const tickerLink = await page.evaluate(() =>
   document.activeElement?.matches('#news-ticker .news-ticker-group:not([aria-hidden]) a:focus-visible'));
 check(tickerLink, 'Tab did not reach a visible original ticker link');
 steps.push('Tab reaches an original ticker link');
 return {steps,scope:'Japanese homepage skip-link and ticker link focus'};
}
