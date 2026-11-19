import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createApp} from '../server.js';
const {app,db}=createApp(':memory:');const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base=`http://localhost:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base);await page.getByRole('button',{name:/Electric pressure washer/}).waitFor();
 await page.screenshot({path:'/workspace/artifacts/neighborrent-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Try as renter'}).click();await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
 await page.getByRole('button',{name:/Electric pressure washer/}).click();
 const start=new Date(Date.now()+86400000).toISOString().slice(0,10),end=new Date(Date.now()+172800000).toISOString().slice(0,10);
 await page.getByLabel('Pickup date',{exact:true}).last().fill(start);await page.getByLabel('Return date',{exact:true}).last().fill(end);await page.getByLabel('Message to owner').fill('Browser test: driveway project.');await page.getByRole('button',{name:'Request to rent →'}).click();
 await page.getByRole('heading',{name:'Your rental requests',exact:true}).waitFor();await page.getByText('Browser test: driveway project.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Sign in →',exact:true}).click();await page.getByRole('button',{name:'Try as owner'}).click();
 const request=page.locator('.request').filter({hasText:'Browser test: driveway project.'});await request.getByRole('button',{name:'Approve',exact:true}).click();await request.locator('.status-approved').waitFor();
 await page.getByRole('button',{name:'+ List an item',exact:true}).first().click();await page.getByLabel('Item name').fill('Browser test garden rake');await page.getByLabel('Daily price ($)').fill('5');await page.getByLabel('Neighborhood or ZIP').fill('Campus area');await page.getByLabel('Description & pickup details').fill('Browser test item.');await page.getByRole('button',{name:'Publish listing →'}).click();await page.getByRole('button',{name:/Browser test garden rake/}).waitFor();
 await page.reload();await page.getByRole('button',{name:/Browser test garden rake/}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/#browse');await page.getByRole('button',{name:/Electric pressure washer/}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'/workspace/artifacts/neighborrent-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Browser flow passed: login, request, owner approval, listing, persistence, mobile layout.');
}finally{await browser.close();await new Promise(r=>server.close(r));db.close();}
