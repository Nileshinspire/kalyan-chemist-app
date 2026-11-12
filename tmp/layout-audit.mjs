import { chromium } from "playwright-core";
const APP = "http://localhost:5173";
const NS = "httpsdutifulfox804convexcloud";
async function call(kind,path,args,token){const r=await fetch(`https://dutiful-fox-804.convex.cloud/api/${kind}`,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({path,args,format:"json"})});const t=await r.text();const j=JSON.parse(t);if(j.status==="error")throw new Error(j.errorMessage);return j.value!==undefined?j.value:j;}
const stamp=Date.now(), phone=`99${String(stamp).slice(-8)}`;
const out=await call("action","auth:signIn",{provider:"phone-password",params:{flow:"signUp",phone,password:"L1ayoutT0",name:"QA Layout"}},)
const token=out.tokens.token;
await call("mutation","qaLayout:promote",{userId:(()=>{const u=await call("query","users:currentUser",{},token);return u._id;})()});
const cat=await call("mutation","qaLayout:seedCategory",{name:`QA L1 ${stamp}`,slug:`qa-l1-${stamp}`});
const p=await call("mutation","qaLayout:seedProduct",{categoryId:cat,name:"QA Overflow Product",slug:`qa-overflow-${stamp}`,price:50,stockQuantity:10,expiryDate:stamp+180*24*60*60*1000});
await call("mutation","batches:receiveBatch",{productId:p,quantity:7,batchNumber:"L1-A",expiryDate:stamp+60*24*60*60*1000},token);
await call("mutation","batches:receiveBatch",{productId:p,quantity:13,batchNumber:"L2-B",expiryDate:stamp+400*24*60*60*1000,mfg:null,purchasePrice:20,supplier:"Vendor",note:"long note"},token);
const host=await call("mutation","qaLayout:promote",{userId:(()=>{const u=await call("query","users:currentUser",{},token);return u._id;})()});

// bust /admin?tracked=true? fake nav then direct?
const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:1000,height:820},initialViewport:{width:1000,height:820},isMobile:false});
await ctx.addInitScript(({tokens,ns})=>{localStorage.setItem(`__convexAuthJWT_${ns}`,tokens.token);localStorage.setItem(`__convexAuthRefreshToken_${ns}`,tokens.refreshToken);},{tokens,token,ns:NS});
const page=await ctx.newPage();
await page.goto(`${APP}/#/admin/inventory`,{waitUntil:"networkidle"});
await page.waitForTimeout(3500);
await page.getByPlaceholder("Search products...").fill("QA ");
await page.waitForTimeout(1200);
await page.locator("tr").filter({hasText:"QA Overflow Product"}).first().getByRole("button",{name:/batches/i}).click();
await page.waitForTimeout(1800);

const dialog=page.locator("[role=dialog]");

// ---- desktop checks on real modal width
const desktopW=page.evaluate(()=>window.innerWidth);
const desktopH=page.evaluate(()=>window.innerHeight);
const dialogBox=await dialog.boundingBox();
const viewportPct=dialogBox?((dialogBox.width/desktopW*100).toFixed):"?";
console.log("DESKTOP",{desktopW,desktopH,modalW:Math.round(dialogBox?.width||0),modalH:Math.round(dialogBox?.height||0),pct:viewportPct});

// exceed?
const full=await page.evaluate(()=>{const el=document.querySelector('[role=dialog]');const w=window.innerWidth,h=window.innerHeight;const r=el?.getBoundingClientRect();return {left:r?.left||0,right:r?r.right||0,top:r?.top||0,bottom:r?.bottom||0,width:r?.width||0,height:r?.height||0,rwithin:r&&r.left>=-2&&r.right<w+2&&r.top>=-2&&r.bottom<h+2};});
console.log("DESKTOP_RECTS",JSON.stringify(full));
if(!full.rwithin){console.log("FAIL desktop overflow",{left:full.left,right:full.right,bottom:full.bottom,top:full.top});}
await page.locator('[role=dialog]').evaluate((el)=>{const er=el.getBoundingClientRect();const o=el.parentElement?.getBoundingClientRect();if(!o){console.log('no parent');return;}const ox=o.getBoundingClientRect();console.log('parent rect',{left:ox.left,right:ox.right,top:ox.top,bottom:ox.bottom,width:ox.width,height:ox.height});});
await page.locator('[role=dialog]').evaluate((el)=>{const r=el.getBoundingClientRect();const child=el.querySelector('.overflow-y-auto')?el.querySelector('.overflow-y-auto'):document.querySelector("div[layout-id]");console.log("overflow-y auto scrollHeight/content",{child:Boolean(child),scrollHeight:child?.scrollHeight||?});});
page.evaluate(()=>{const d=document.querySelector('[role=dialog]');const off=d.querySelectorAll('*').length;console.log('dialog child count',off);});

// EXCEED: table width vs .overflow-y-auto width on desktop
const tab=await dialog.locator("table").first().boundingBox();
const cont=await dialog.locator('.overflow-y-auto').first().boundingBox();
if(tab&&cont)console.log("TABLE_WITHIN_CONTAINER",tab.width<=cont.width+2,"width",tab.width,cont.width);
else console.log("table/missing",tab?tab.width:null,cont?cont.width:null);

// overflow-y-auto vertical scroll present?
const hasScroll=await dialog.locator('.overflow-y-auto').evaluate((el)=>el.scrollHeight>el.clientHeight);
console.log("VERTICAL_SCROLL",hasScroll);
const bodyScroll=await page.evaluate(()=>document.body.scrollWidth>window.innerWidth);
console.log("BODY_HORIZONTAL_SCROLL",bodyScroll);
await browser.close();
await call("mutation","qaLayout:wipeFixtures",{});
