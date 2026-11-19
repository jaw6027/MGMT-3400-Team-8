import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.js';

test('renters and owners can complete an authorized booking flow with conflict protection',async()=>{
 const {app,db}=createApp(':memory:');const server=app.listen(0); await new Promise(r=>server.once('listening',r));const base=`http://localhost:${server.address().port}`;
 async function client(){let cookie='';return async(url,body,method=body?'POST':'GET')=>{const res=await fetch(base+url,{method,headers:{'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return {status:res.status,data:await res.json()};};}
 try{
 const owner=await client(),renter=await client(),other=await client(),anon=await client();
 assert.equal((await anon('/api/listings',{})).status,401);
 for(const [c,email] of [[owner,'o@test.com'],[renter,'r@test.com'],[other,'x@test.com']]) assert.equal((await c('/api/auth/register',{name:'Test user',email,password:'a-secure-password'})).status,201);
 const listing=await owner('/api/listings',{title:'Test drill',category:'Tools & DIY',area:'Campus',price:12.5,description:'Two batteries included.'});assert.equal(listing.status,201);const id=listing.data.id;
 const start=new Date(Date.now()+86400000).toISOString().slice(0,10),end=new Date(Date.now()+172800000).toISOString().slice(0,10);
 const payload={listingId:id,start,end,message:'Pickup after class?'};
 assert.equal((await owner('/api/bookings',payload)).status,400);
 assert.equal((await renter('/api/bookings',{...payload,start:'2027-02-30'})).status,400);
 const booking=await renter('/api/bookings',payload);assert.equal(booking.status,201);assert.equal(booking.data.total,2500);
 assert.equal((await renter('/api/bookings',payload)).status,409);
 const competing=await other('/api/bookings',payload);assert.equal(competing.status,201);
 assert.equal((await other(`/api/bookings/${booking.data.id}`,{status:'approved'},'PATCH')).status,403);
 assert.equal((await renter(`/api/bookings/${booking.data.id}`,{status:'approved'},'PATCH')).status,400);
 assert.equal((await owner(`/api/bookings/${booking.data.id}`,{status:'approved'},'PATCH')).status,200);
 assert.equal((await other('/api/dashboard')).data.bookings[0].status,'declined');
 assert.equal((await other('/api/dashboard')).data.bookings[0].owner_email,undefined);
 assert.equal((await renter('/api/dashboard')).data.bookings[0].owner_email,'o@test.com');
 assert.equal((await anon(`/api/listings?start=${start}&end=${end}&q=Test%20drill`)).data.length,0);
 assert.equal((await other('/api/bookings',payload)).status,409);
 assert.equal((await renter(`/api/bookings/${booking.data.id}`,{status:'cancelled'},'PATCH')).status,200);
 assert.equal((await anon(`/api/listings?start=${start}&end=${end}&q=Test%20drill`)).data.length,1);
 assert.equal((await other('/api/dashboard')).data.bookings.some(b=>b.id===booking.data.id),false);
 assert.equal((await anon('/api/listings?max=-1')).status,400);
 assert.equal((await renter('/api/logout',{})).status,200);assert.equal((await renter('/api/dashboard')).status,401);
 }finally{await new Promise(r=>server.close(r));db.close();}
});
