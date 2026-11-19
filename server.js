import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const categories = ['Cleaning', 'Lawn & garden', 'Tools & DIY', 'Moving', 'Parties & events', 'Outdoor adventure'];
const hash = value => createHash('sha256').update(value).digest('hex');
function passwordHash(password) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
function matches(password, stored) { const [salt, key] = stored.split(':'); return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(key, 'hex')); }
function fail(message, status=400) { throw Object.assign(new Error(message), {status}); }
const today = () => new Date().toISOString().slice(0,10);
function dates(start, end) {
  const valid = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x;
  if (!valid(start) || !valid(end) || start < today() || end < start) fail('Choose valid rental dates starting today or later.');
  const days = (Date.parse(end)-Date.parse(start))/86400000+1;
  if (days > 30) fail('Rentals can be up to 30 days.');
  return days;
}
function text(value, label, max=200) { if(typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${label} is required (up to ${max} characters).`); return value.trim(); }
export function createApp(filename = process.env.DATABASE_PATH || 'data/marketplace.sqlite') {
  if(filename !== ':memory:') mkdirSync(path.dirname(filename), {recursive:true});
  const db = new DatabaseSync(filename); db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER);
  CREATE TABLE IF NOT EXISTS listings(id INTEGER PRIMARY KEY,owner_id INTEGER REFERENCES users(id),title TEXT,category TEXT,area TEXT,price INTEGER,description TEXT,demo INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS bookings(id INTEGER PRIMARY KEY,listing_id INTEGER REFERENCES listings(id),renter_id INTEGER REFERENCES users(id),start TEXT,end TEXT,total INTEGER,message TEXT,status TEXT DEFAULT 'pending',created TEXT DEFAULT CURRENT_TIMESTAMP);`);
  if(process.env.SEED_DEMO !== 'false' && !db.prepare('SELECT id FROM users LIMIT 1').get()) {
    const insert = db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)');
    insert.run('Alex · Demo owner','owner@example.com',passwordHash('DemoRental3400!'));
    insert.run('Jordan · Demo renter','renter@example.com',passwordHash('DemoRental3400!'));
    const add = db.prepare('INSERT INTO listings(owner_id,title,category,area,price,description,demo) VALUES(1,?,?,?,?,?,1)');
    for(const row of [
      ['Electric pressure washer','Cleaning','Campus area',3500,'Give your patio a fresh start. Includes hose, spray wand, and three nozzles. Pickup and return clean; owner will explain setup.'],
      ['Carpet & upholstery cleaner','Cleaning','Downtown',2800,'A weekend refresh for rugs, couches, and car seats. Cleaning solution is not included.'],
      ['Cordless drill kit','Tools & DIY','Campus area',1200,'Drill, two batteries, charger, and a set of common bits in a carry case. Ideal for your next small project.'],
      ['Folding tables · set of two','Parties & events','Downtown',2000,'Two six-foot folding tables for a backyard gathering or campus event. A larger vehicle is recommended for pickup.'],
      ['Heavy-duty moving dolly','Moving','Campus area',1500,'Make moving day a little easier. Hand truck with straps for boxes and furniture. Check load limits with the owner.'],
      ['Four-person camping tent','Outdoor adventure','West side',2200,'Room for a weekend away. Includes rainfly, stakes, and carry bag. Please return dry and clean.'],
      ['Electric lawn mower','Lawn & garden','West side',3000,'Battery-powered mower with charger and collection bag. Great for a small yard.'],
      ['Portable party speaker','Parties & events','Campus area',2500,'Bluetooth speaker with a microphone for small gatherings. Ask the owner about battery life and setup.']]) add.run(...row);
  }
  const app = express(); app.disable('x-powered-by'); app.use(express.json({limit:'32kb'}));
  app.use((req,res,next)=>{ res.set('X-Content-Type-Options','nosniff'); res.set('Referrer-Policy','same-origin'); if(!['GET','HEAD'].includes(req.method) && req.get('origin') && req.get('origin') !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({error:'Cross-site requests are not allowed.'}); next(); });
  app.use((req,res,next)=> { const token = req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('session='))?.slice(8); if(token) req.user=db.prepare('SELECT u.id,u.name,u.email FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?').get(hash(token),Date.now()); next(); });
  const auth = (req,res,next) => req.user ? next() : res.status(401).json({error:'Please sign in to continue.'});
  function session(res,id) {const token=randomBytes(32).toString('hex'); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),id,Date.now()+604800000); res.cookie('session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:604800000});}
  const attempts = new Map();
  app.use('/api/auth',(req,res,next)=>{ const now=Date.now(), key=req.ip, entry=attempts.get(key); if(!entry || entry.until<now) attempts.set(key,{count:1,until:now+600000}); else if(++entry.count>40) return res.status(429).json({error:'Too many attempts. Try again in 10 minutes.'}); if(attempts.size>10000) for(const [k,v] of attempts) if(v.until<now) attempts.delete(k); next(); });
  app.get('/api/me',(req,res)=>res.json({user:req.user||null,categories}));
  app.post('/api/auth/register',(req,res)=>{const name=text(req.body.name,'Name',80), email=text(req.body.email,'Email',200).toLowerCase(), password=req.body.password; if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email.'); if(typeof password!=='string'||password.length<10||password.length>128) fail('Use a password between 10 and 128 characters.'); if(db.prepare('SELECT id FROM users WHERE email=?').get(email)) fail('An account with this email already exists.'); const {lastInsertRowid:id}=db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)').run(name,email,passwordHash(password)); session(res,Number(id)); res.status(201).json({user:{id:Number(id),name,email}}); });
  app.post('/api/auth/login',(req,res)=>{const email=text(req.body.email,'Email',200).toLowerCase(), password=text(req.body.password,'Password',128), user=db.prepare('SELECT * FROM users WHERE email=?').get(email); if(!user||!matches(password,user.password)) fail('Email or password is incorrect.',401); session(res,user.id); res.json({user:{id:user.id,name:user.name,email:user.email}}); });
  app.post('/api/logout',(req,res)=>{const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('session='))?.slice(8); if(token) db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token)); res.clearCookie('session'); res.json({ok:true});});
  const listingSelect='SELECT l.*,u.name AS owner FROM listings l JOIN users u ON u.id=l.owner_id';
  app.get('/api/listings',(req,res)=>{
    const {q='',category='',area='',max='',start='',end=''}=req.query;
    if([q,category,area,max,start,end].some(x=>typeof x!=='string')) fail('Invalid search.');
    let sql=listingSelect+' WHERE (l.title LIKE ? OR l.description LIKE ?) AND l.area LIKE ?', args=[`%${q}%`,`%${q}%`,`%${area}%`];
    if(category){sql+=' AND l.category=?';args.push(category);}
    if(max){if(!Number.isFinite(Number(max))||Number(max)<0) fail('Enter a valid maximum price.');sql+=' AND l.price<=?';args.push(Math.round(Number(max)*100));}
    if(start||end){dates(start,end);sql+=" AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.listing_id=l.id AND b.status='approved' AND b.start<=? AND b.end>=?)";args.push(end,start);}
    res.json(db.prepare(sql+' ORDER BY l.id DESC').all(...args));
  });
  app.post('/api/listings',auth,(req,res)=>{const b=req.body, title=text(b.title,'Title',100),category=text(b.category,'Category',60),area=text(b.area,'Area',80),description=text(b.description,'Description',2000),price=Number(b.price); if(!categories.includes(category)) fail('Choose a category.'); if(!Number.isFinite(price)||price<1||price>10000) fail('Daily price must be between $1 and $10,000.'); const result=db.prepare('INSERT INTO listings(owner_id,title,category,area,price,description) VALUES(?,?,?,?,?,?)').run(req.user.id,title,category,area,Math.round(price*100),description); res.status(201).json(db.prepare(listingSelect+' WHERE l.id=?').get(result.lastInsertRowid));});
  app.post('/api/bookings',auth,(req,res)=>{const b=req.body, days=dates(b.start,b.end), listing=db.prepare('SELECT * FROM listings WHERE id=?').get(Number(b.listingId)); if(!listing) fail('Item not found.',404); if(listing.owner_id===req.user.id) fail('You cannot rent your own item.'); if(db.prepare("SELECT id FROM bookings WHERE listing_id=? AND status='approved' AND start<=? AND end>=?").get(listing.id,b.end,b.start)) fail('This item is already booked for these dates.',409); if(db.prepare("SELECT id FROM bookings WHERE listing_id=? AND renter_id=? AND status='pending' AND start=? AND end=?").get(listing.id,req.user.id,b.start,b.end)) fail('You already requested these dates.',409); const message=text(b.message,'Message to owner',1000); const result=db.prepare('INSERT INTO bookings(listing_id,renter_id,start,end,total,message) VALUES(?,?,?,?,?,?)').run(listing.id,req.user.id,b.start,b.end,days*listing.price,message); res.status(201).json({id:Number(result.lastInsertRowid),status:'pending',total:days*listing.price});});
  app.get('/api/dashboard',auth,(req,res)=>res.json({listings:db.prepare(listingSelect+' WHERE l.owner_id=?').all(req.user.id),bookings:db.prepare(`SELECT b.*,l.title,l.area,l.owner_id,u.name AS renter,o.name AS owner,u.email AS renter_email,o.email AS owner_email FROM bookings b JOIN listings l ON l.id=b.listing_id JOIN users u ON u.id=b.renter_id JOIN users o ON o.id=l.owner_id WHERE b.renter_id=? OR l.owner_id=? ORDER BY b.id DESC`).all(req.user.id,req.user.id).map(b=>{if(b.status!=='approved'){delete b.renter_email;delete b.owner_email;}return b;})}));
  app.patch('/api/bookings/:id',auth,(req,res)=>{db.exec('BEGIN IMMEDIATE');try{const b=db.prepare('SELECT b.*,l.owner_id FROM bookings b JOIN listings l ON l.id=b.listing_id WHERE b.id=?').get(Number(req.params.id)); if(!b) fail('Request not found.',404); const status=req.body.status,owner=b.owner_id===req.user.id,renter=b.renter_id===req.user.id; if(!owner&&!renter) fail('Access denied.',403); if(!((owner&&['approved','declined'].includes(status)&&b.status==='pending')||(renter&&status==='cancelled'&&['pending','approved'].includes(b.status)))) fail('This request cannot be changed that way.'); if(b.start<today()) fail('Past rental requests cannot be changed.'); if(status==='approved'){if(db.prepare("SELECT id FROM bookings WHERE listing_id=? AND status='approved' AND start<=? AND end>=?").get(b.listing_id,b.end,b.start)) fail('Another booking already covers these dates.',409); db.prepare("UPDATE bookings SET status='declined' WHERE listing_id=? AND id<>? AND status='pending' AND start<=? AND end>=?").run(b.listing_id,b.id,b.end,b.start);} db.prepare('UPDATE bookings SET status=? WHERE id=?').run(status,b.id);db.exec('COMMIT');res.json({ok:true});}catch(error){db.exec('ROLLBACK');throw error;}});
  app.use(express.static(fileURLToPath(new URL('./public',import.meta.url))));
  app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint not found.'}));
  app.use((error,req,res,next)=>{if(!error.status) console.error(error);res.status(error.status||500).json({error:error.status?error.message:'Something went wrong. Please try again.'});});
  return {app,db};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {app}=createApp();app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log(`NeighborRent is running on port ${process.env.PORT||3000}`));}
