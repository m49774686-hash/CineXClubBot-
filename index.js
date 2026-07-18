// ===================================================
// CineXClub Bot
// PART 1/20
// Setup + PostgreSQL + Bot Start
// ===================================================

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");

// ======================
// ENV
// ======================

const BOT_TOKEN = process.env.BOT_TOKEN;

const DATABASE_URL = process.env.DATABASE_URL;

const BOT_USERNAME =
process.env.BOT_USERNAME || "CineXClubBot";

const STORAGE_CHANNEL =
process.env.STORAGE_CHANNEL;

const FORCE_CHANNEL =
process.env.FORCE_CHANNEL;

const ADMIN_USERNAME =
process.env.ADMIN_USERNAME;

// ======================
// BOT
// ======================

const bot = new TelegramBot(
BOT_TOKEN,
{
polling:{
autoStart:true,
interval:300
}
}
);

// ======================
// DATABASE
// ======================

const pool = new Pool({

connectionString:DATABASE_URL,

ssl:{
rejectUnauthorized:false
}

});

// ======================
// DATABASE TABLES
// ======================

async function initDatabase(){

try{

await pool.query(`

CREATE TABLE IF NOT EXISTS contents(

id SERIAL PRIMARY KEY,

content_id TEXT UNIQUE,

title TEXT,

type TEXT,

collection TEXT,

season INTEGER,

episode INTEGER,

quality TEXT,

language TEXT,

year TEXT,

size TEXT,

file_id TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

CREATE TABLE IF NOT EXISTS users(

id SERIAL PRIMARY KEY,

username TEXT UNIQUE,

created_at TIMESTAMP DEFAULT NOW()

);

CREATE TABLE IF NOT EXISTS requests(

id SERIAL PRIMARY KEY,

username TEXT,

request TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

`);

console.log("✅ PostgreSQL Ready");

}catch(err){

console.log(err.message);

}

}

initDatabase();

// ======================
// KEEP ALIVE
// ======================

http.createServer((req,res)=>{

res.writeHead(200);

res.end("CineXClub Running");

}).listen(process.env.PORT || 3000);

// ======================
// RANDOM QUOTES
// ======================

const quotes=[

"🍿 Enjoy Your Movie",

"🎬 Entertainment Starts Here",

"✨ Movies Never End",

"❤️ Welcome To CineXClub",

"🔥 Watch Unlimited Content"

];

function randomQuote(){

return quotes[
Math.floor(
Math.random()*quotes.length
)
];

}

// ======================
// USERNAME
// ======================

function getUsername(user){

if(user.username)
return "@"+user.username;

return user.first_name;

}

// ======================
// SAVE USER
// ======================

async function saveUser(user){

try{

await pool.query(

`
INSERT INTO users(username)

VALUES($1)

ON CONFLICT(username)

DO NOTHING
`,

[
getUsername(user)
]

);

}catch(err){}

}

console.log("✅ PART 1 Loaded");
// ===================================================
// PART 2/20
// STORAGE CHANNEL SYSTEM
// ===================================================

// Parse Caption

function parseCaption(caption){

let data={

type:"Movie",

title:"",

collection:null,

season:null,

episode:null,

quality:"720p",

language:"Unknown",

year:"",

size:"",

content_id:null

};

let lines=caption.split("\n");

for(let line of lines){

let parts=line.split(":");

if(parts.length<2) continue;

let key=parts[0].trim().toLowerCase();

let value=parts.slice(1).join(":").trim();

switch(key){

case "type":
data.type=value;
break;

case "title":
data.title=value;
break;

case "collection":
data.collection=value;
break;

case "season":
data.season=parseInt(value);
break;

case "episode":
data.episode=parseInt(value);
break;

case "quality":
data.quality=value;
break;

case "audio":
case "language":
data.language=value;
break;

case "year":
data.year=value;
break;

case "size":
data.size=value;
break;

case "id":
data.content_id=value.toLowerCase();
break;

}

}

if(!data.content_id){

data.content_id=data.title
.replace(/\s+/g,"")
.toLowerCase();

if(data.type!="Movie"){

data.content_id+=
"_s"+data.season+
"e"+data.episode;

}

}

return data;

}

// Save Content

async function saveContent(data,fileId){

try{

await pool.query(

`

INSERT INTO contents(

content_id,

title,

type,

collection,

season,

episode,

quality,

language,

year,

size,

file_id

)

VALUES(

$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11

)

ON CONFLICT(content_id)

DO UPDATE SET

quality=EXCLUDED.quality,

language=EXCLUDED.language,

year=EXCLUDED.year,

size=EXCLUDED.size,

file_id=EXCLUDED.file_id

`,

[

data.content_id,

data.title,

data.type,

data.collection,

data.season,

data.episode,

data.quality,

data.language,

data.year,

data.size,

fileId

]

);

return true;

}catch(err){

console.log(err.message);

return false;

}

}

// Storage Upload

bot.on("channel_post",async(msg)=>{

try{

if(String(msg.chat.id)!==String(STORAGE_CHANNEL))
return;

let fileId=null;

if(msg.document)
fileId=msg.document.file_id;

if(msg.video)
fileId=msg.video.file_id;

if(!fileId)
return;

if(!msg.caption)
return;

let data=parseCaption(msg.caption);

console.log("Uploading:",data.title);

let saved=await saveContent(data,fileId);

if(saved){

let link=

`https://t.me/${BOT_USERNAME}?start=${data.content_id}`;

await bot.sendMessage(

msg.chat.id,

`✅ Saved Successfully

🎬 ${data.title}

🆔 ${data.content_id}

🔗 ${link}`

);

console.log("Saved:",data.content_id);

}

}catch(err){

console.log(err);

}

});

console.log("✅ PART 2 Loaded");
// ===================================================
// PART 3/20
// START + WELCOME + FORCE JOIN
// ===================================================

// Force Join Check

async function checkForceJoin(userId){

try{

if(!FORCE_CHANNEL) return true;

let member=await bot.getChatMember(
FORCE_CHANNEL,
userId
);

return[
"member",
"administrator",
"creator"
].includes(member.status);

}catch{

return false;

}

}

// Welcome Buttons

function homeButtons(){

return{

inline_keyboard:[

[
{
text:"🎬 Movies",
callback_data:"menu_movies"
},
{
text:"📺 Series",
callback_data:"menu_series"
}
],

[
{
text:"🍥 Anime",
callback_data:"menu_anime"
}
],

[
{
text:"🔎 Search",
callback_data:"search"
}
],

[
{
text:"🎥 Request Movie",
url:`https://t.me/${ADMIN_USERNAME.replace("@","")}`
}
],

[
{
text:"👨‍💻 Contact Admin",
url:`https://t.me/${ADMIN_USERNAME.replace("@","")}`
}
]

]

};

}

// Start Command

bot.onText(/\/start(?:\s+(.+))?/,async(msg,match)=>{

const chatId=msg.chat.id;

await saveUser(msg.from);

// Deep Link

if(match[1]){

return handleDeepLink(chatId,msg.from,match[1]);

}

// Force Join

const joined=await checkForceJoin(msg.from.id);

if(!joined){

return bot.sendMessage(

chatId,

"⚠️ Please join our updates channel first.",

{

reply_markup:{

inline_keyboard:[

[
{
text:"📢 Join Channel",
url:`https://t.me/${FORCE_CHANNEL.replace("@","")}`
}
],

[
{
text:"✅ Continue",
callback_data:"recheck_join"
}
]

]

}

}

);

}

// Welcome

bot.sendMessage(

chatId,

`🎬 <b>Welcome ${getUsername(msg.from)}</b>

${randomQuote()}

━━━━━━━━━━━━━━

🍿 Movies

📺 Series

🍥 Anime

━━━━━━━━━━━━━━

🔎 Use the Search button to find your content.

`,

{

parse_mode:"HTML",

reply_markup:homeButtons()

}

);

});

// Join Callback

bot.on("callback_query",async(query)=>{

if(query.data!=="recheck_join")
return;

const joined=

await checkForceJoin(query.from.id);

if(joined){

bot.editMessageText(

"✅ Verification Successful.\n\nPress /start",

{

chat_id:query.message.chat.id,

message_id:query.message.message_id

}

);

}else{

bot.answerCallbackQuery(

query.id,

{

text:"Join the channel first.",

show_alert:true

}

);

}

});

console.log("✅ PART 3 Loaded");
// ===================================================
// PART 4/20
// MENUS + SEARCH
// ===================================================

const searchUsers = new Map();

// Collections

async function getCollections(type){

try{

const result = await pool.query(

`
SELECT DISTINCT collection

FROM contents

WHERE type=$1

ORDER BY collection
`,

[type]

);

return result.rows;

}catch{

return [];

}

}

// Menu

async function showCollections(chatId,type){

const collections =
await getCollections(type);

if(!collections.length){

return bot.sendMessage(

chatId,

`❌ No ${type} available.`

);

}

const buttons=[];

collections.forEach(row=>{

buttons.push([

{

text:`📂 ${row.collection}`,

callback_data:

`collection_${type}_${row.collection}`

}

]);

});

buttons.push([

{

text:"🏠 Home",

callback_data:"home"

}

]);

bot.sendMessage(

chatId,

`📂 ${type} Collections

Select one:`,

{

reply_markup:{

inline_keyboard:buttons

}

}

);

}

// Callback

bot.on("callback_query",async(query)=>{

const chatId =
query.message.chat.id;

switch(query.data){

case "menu_movies":

return showCollections(
chatId,
"Movie"
);

case "menu_series":

return showCollections(
chatId,
"Series"
);

case "menu_anime":

return showCollections(
chatId,
"Anime"
);

case "search":

searchUsers.set(
chatId,
true
);

return bot.sendMessage(

chatId,

`🔎 Send the movie, series or anime name.`

);

case "home":

searchUsers.delete(chatId);

return bot.sendMessage(

chatId,

`🏠 Home Menu`,

{

reply_markup:

homeButtons()

}

);

}

});

// Search

bot.on("message",async(msg)=>{

if(!searchUsers.get(msg.chat.id))
return;

if(!msg.text)
return;

searchUsers.delete(msg.chat.id);

const keyword =
msg.text.trim();

const result =
await pool.query(

`
SELECT *

FROM contents

WHERE

LOWER(title)

LIKE LOWER($1)

LIMIT 15
`,

[
`%${keyword}%`
]

);

if(result.rows.length===0){

return bot.sendMessage(

msg.chat.id,

`❌ "${keyword}" not found.`,

{

reply_markup:{

inline_keyboard:[

[
{

text:"🔎 Google Search",

url:

`https://www.google.com/search?q=${encodeURIComponent(keyword)}`

}

],

[
{

text:"🎬 Request Movie",

url:

`https://t.me/${ADMIN_USERNAME.replace("@","")}`

}

],

[
{

text:"🏠 Home",

callback_data:"home"

}

]

]

}

}

);

}

const buttons=[];

result.rows.forEach(movie=>{

buttons.push([

{

text:

`🎬 ${movie.title}`,

callback_data:

`play_${movie.content_id}`

}

]);

});

buttons.push([

{

text:"🏠 Home",

callback_data:"home"

}

]);

bot.sendMessage(

msg.chat.id,

"🔎 Search Results",

{

reply_markup:{

inline_keyboard:buttons

}

}

);

});

console.log("✅ PART 4 Loaded");
// ===================================================
// PART 5/20
// COLLECTION → SEASON → EPISODE
// ===================================================

// Get Collection Items

async function getCollectionItems(collection){

const result=await pool.query(

`SELECT * FROM contents
WHERE collection=$1
ORDER BY season,episode,title`,

[collection]

);

return result.rows;

}

// Get Seasons

async function getSeasons(collection){

const result=await pool.query(

`SELECT DISTINCT season
FROM contents
WHERE collection=$1
AND season IS NOT NULL
ORDER BY season`,

[collection]

);

return result.rows;

}

// Get Episodes

async function getEpisodes(collection,season){

const result=await pool.query(

`SELECT *
FROM contents
WHERE collection=$1
AND season=$2
ORDER BY episode`,

[collection,season]

);

return result.rows;

}

// Callback

bot.on("callback_query",async(query)=>{

const chatId=query.message.chat.id;

const data=query.data;

// Collection

if(data.startsWith("collection_")){

const parts=data.split("_");

const type=parts[1];

const collection=parts.slice(2).join("_");

if(type==="Movie"){

const movies=await getCollectionItems(collection);

const buttons=[];

movies.forEach(movie=>{

buttons.push([

{

text:`🎬 ${movie.title} (${movie.quality})`,

callback_data:`quality_${movie.content_id}`

}

]);

});

buttons.push([

{

text:"🏠 Home",

callback_data:"home"

}

]);

return bot.sendMessage(

chatId,

`🎬 ${collection}`,

{

reply_markup:{

inline_keyboard:buttons

}

}

);

}

// Series / Anime

const seasons=await getSeasons(collection);

const buttons=[];

seasons.forEach(s=>{

buttons.push([

{

text:`📺 Season ${s.season}`,

callback_data:`season_${collection}_${s.season}`

}

]);

});

buttons.push([

{

text:"🏠 Home",

callback_data:"home"

}

]);

return bot.sendMessage(

chatId,

`📂 ${collection}`,

{

reply_markup:{

inline_keyboard:buttons

}

}

);

}

// Season

if(data.startsWith("season_")){

const parts=data.split("_");

const collection=parts[1];

const season=parts[2];

const episodes=

await getEpisodes(

collection,

season

);

const buttons=[];

episodes.forEach(ep=>{

buttons.push([

{

text:`🎬 Episode ${ep.episode}`,

callback_data:`quality_${ep.content_id}`

}

]);

});

buttons.push([

{

text:"📥 Send All Episodes",

callback_data:`all_${collection}_${season}`

}

]);

buttons.push([

{

text:"🏠 Home",

callback_data:"home"

}

]);

return bot.sendMessage(

chatId,

`📺 ${collection}
Season ${season}`,

{

reply_markup:{

inline_keyboard:buttons

}

}

);

}

});

// Quality Menu

async function showQuality(chatId,id){

const result=

await pool.query(

`SELECT *
FROM contents
WHERE content_id LIKE $1
ORDER BY quality`,

[id.split("_")[0]+"%"]

);

if(!result.rows.length)
return;

const buttons=[];

result.rows.forEach(file=>{

buttons.push([

{

text:file.quality,

callback_data:`send_${file.content_id}`

}

]);

});

await bot.sendMessage(

chatId,

"🎥 Select Quality",

{

reply_markup:{

inline_keyboard:buttons

}

}

);

}

console.log("✅ PART 5 Loaded");
// ===================================================
// PART 6/20
// FILE SEND + AUTO DELETE
// ===================================================

// Auto Delete (10 Minutes)

function autoDelete(chatId,messageId){

setTimeout(async()=>{

try{

await bot.deleteMessage(chatId,messageId);

}catch(e){}

},600000);

}

// Send File

async function sendFile(chatId,file){

try{

const sent=await bot.sendDocument(

chatId,

file.file_id,

{

caption:`

🎬 <b>${file.title}</b>

━━━━━━━━━━━━━━

📂 Type : ${file.type}

${file.collection ? `🎞 Collection : ${file.collection}` : ""}

${file.season ? `📺 Season : ${file.season}` : ""}

${file.episode ? `🎬 Episode : ${file.episode}` : ""}

🎥 Quality : ${file.quality}

━━━━━━━━━━━━━━

⭐ Powered By CineXClub

`,

parse_mode:"HTML",

reply_markup:{

inline_keyboard:[

[

{

text:"📢 Join Channel",

url:"https://t.me/CineXClub"

}

],

[

{

text:"👨‍💻 Contact Admin",

url:`https://t.me/${ADMIN_USERNAME.replace("@","")}`

}

]

]

}

}

);

autoDelete(chatId,sent.message_id);

}catch(err){

console.log("Send Error:",err.message);

}

}

// Quality Callback

bot.on("callback_query",async(query)=>{

const data=query.data;

const chatId=query.message.chat.id;

if(data.startsWith("quality_")){

const id=data.replace("quality_","");

return showQuality(chatId,id);

}

if(data.startsWith("send_")){

const id=data.replace("send_","");

const result=await pool.query(

`SELECT *
FROM contents
WHERE content_id=$1
LIMIT 1`,

[id]

);

if(!result.rows.length){

return bot.answerCallbackQuery(query.id,{

text:"❌ File Not Found",

show_alert:true

});

}

await bot.answerCallbackQuery(query.id);

return sendFile(chatId,result.rows[0]);

}

// Send All Episodes

if(data.startsWith("all_")){

const parts=data.split("_");

const collection=parts[1];

const season=parts[2];

const episodes=

await getEpisodes(collection,season);

await bot.sendMessage(

chatId,

`📥 Sending ${episodes.length} Episodes...`

);

for(const ep of episodes){

await sendFile(chatId,ep);

await new Promise(r=>setTimeout(r,1200));

}

}

});

console.log("✅ PART 6 Loaded");
// ===================================================
// PART 7/20
// SEARCH SYSTEM
// ===================================================

// SEARCH MODE USERS
const searchMode = new Map();

// SEARCH BUTTON CALLBACK
bot.on("callback_query", async (query) => {

const chatId = query.message.chat.id;

if(query.data==="search"){

searchMode.set(chatId,true);

await bot.answerCallbackQuery(query.id);

return bot.sendMessage(

chatId,

`🔎 Send me the Movie / Series / Anime name.`

);

}

});

// SEARCH MESSAGE
bot.on("message", async(msg)=>{

const chatId=msg.chat.id;

if(!searchMode.has(chatId)) return;

if(!msg.text) return;

searchMode.delete(chatId);

const keyword=msg.text.trim();

try{

const result=await pool.query(

`

SELECT *

FROM contents

WHERE

LOWER(title) LIKE LOWER($1)

OR LOWER(collection) LIKE LOWER($1)

ORDER BY title

LIMIT 20

`,

[`%${keyword}%`]

);

if(result.rows.length===0){

return bot.sendMessage(

chatId,

`❌ No results found for

<b>${keyword}</b>`,

{

parse_mode:"HTML",

reply_markup:{

inline_keyboard:[

[

{

text:"🔎 Google Search",

url:`https://www.google.com/search?q=${encodeURIComponent(keyword)}`

}

],

[

{

text:"🎬 Request Movie",

url:`https://t.me/${ADMIN_USERNAME.replace("@","")}`

}

],

[

{

text:"🏠 Home",

callback_data:"home"

}

]

]

}

}

);

}

const buttons=[];

result.rows.forEach(item=>{

buttons.push([

{

text:`🎬 ${item.title}`,

callback_data:`quality_${item.content_id}`

}

]);

});

buttons.push([

{

text:"🏠 Home",

callback_data:"home"

}

]);

await bot.sendMessage(

chatId,

`🔎 Search Results

<b>${keyword}</b>`,

{

parse_mode:"HTML",

reply_markup:{

inline_keyboard:buttons

}

}

);

}catch(err){

console.log("Search Error:",err.message);

}

});

console.log("✅ PART 7 Loaded");
// ===================================================
// PART 8/20
// MOVIE REQUEST SYSTEM
// ===================================================

// SAVE REQUEST

async function saveRequest(username,request){

try{

await pool.query(

`

INSERT INTO requests

(username,request)

VALUES($1,$2)

`,

[username,request]

);

}catch(err){

console.log("Request Error:",err.message);

}

}

// REQUEST CALLBACK

bot.on("callback_query",async(query)=>{

const data=query.data;

const chatId=query.message.chat.id;

if(!data.startsWith("request_")) return;

const request=data.replace("request_","");

const username=

query.from.username

?

"@"+query.from.username

:

query.from.first_name;

await saveRequest(

username,

request

);

// USER MESSAGE

await bot.sendMessage(

chatId,

`

✅ Your request has been sent.

🎬 Requested:
${request}

Our admin will upload it if available.

`

);

// ADMIN MESSAGE

try{

await bot.sendMessage(

`@${ADMIN_USERNAME.replace("@","")}`,

`

📥 New Movie Request

👤 User:
${username}

🎬 Request:
${request}

`

);

}catch(err){

console.log(

"Admin Notify Error:",

err.message

);

}

await bot.answerCallbackQuery(

query.id,

{

text:"Request Sent ✅"

}

);

});

// /request COMMAND

bot.onText(

/\/request (.+)/,

async(msg,match)=>{

const request=

match[1].trim();

const username=

msg.from.username

?

"@"+msg.from.username

:

msg.from.first_name;

await saveRequest(

username,

request

);

await bot.sendMessage(

msg.chat.id,

`

✅ Request Saved

🎬 ${request}

`

);

try{

await bot.sendMessage(

`@${ADMIN_USERNAME.replace("@","")}`,

`

📥 New Request

👤 ${username}

🎬 ${request}

`

);

}catch(err){}

});

console.log("✅ PART 8 Loaded");
// ===================================================
// PART 9/20
// ADMIN PANEL
// ===================================================

const ADMIN_CHAT_ID =
process.env.ADMIN_CHAT_ID;

// Admin Check

function isAdmin(userId){

return String(userId)===String(ADMIN_CHAT_ID);

}

// Admin Panel

bot.onText(

/\/admin/,

async(msg)=>{

if(!isAdmin(msg.from.id)){

return;

}

const users=await pool.query(

`SELECT COUNT(*) FROM users`

);

const movies=await pool.query(

`SELECT COUNT(*) FROM contents WHERE type='Movie'`

);

const series=await pool.query(

`SELECT COUNT(*) FROM contents WHERE type='Series'`

);

const anime=await pool.query(

`SELECT COUNT(*) FROM contents WHERE type='Anime'`

);

const requests=await pool.query(

`SELECT COUNT(*) FROM requests`

);

bot.sendMessage(

msg.chat.id,

`

👑 <b>CineXClub Admin Panel</b>

━━━━━━━━━━━━━━

👥 Users :
${users.rows[0].count}

🎬 Movies :
${movies.rows[0].count}

📺 Series :
${series.rows[0].count}

🍥 Anime :
${anime.rows[0].count}

📩 Requests :
${requests.rows[0].count}

━━━━━━━━━━━━━━

`,

{

parse_mode:"HTML",

reply_markup:{

inline_keyboard:[

[

{

text:"📢 Broadcast",

callback_data:"broadcast"

}

],

[

{

text:"📋 Requests",

callback_data:"admin_requests"

}

],

[

{

text:"📊 Refresh",

callback_data:"refresh_admin"

}

]

]

}

}

);

});

// Admin Callbacks

bot.on(

"callback_query",

async(query)=>{

if(

!isAdmin(query.from.id)

)

return;

const data=query.data;

// Refresh

if(data==="refresh_admin"){

return bot.sendMessage(

query.message.chat.id,

"♻️ Use /admin to refresh."

);

}

// Requests

if(data==="admin_requests"){

const result=

await pool.query(

`

SELECT *

FROM requests

ORDER BY id DESC

LIMIT 20

`

);

if(!result.rows.length){

return bot.sendMessage(

query.message.chat.id,

"📭 No Requests."

);

}

let text="📩 Latest Requests\n\n";

result.rows.forEach(r=>{

text+=

`👤 ${r.username}

🎬 ${r.request}

──────────

`;

});

return bot.sendMessage(

query.message.chat.id,

text

);

}

// Broadcast

if(data==="broadcast"){

broadcastUsers.set(

query.message.chat.id,

true

);

return bot.sendMessage(

query.message.chat.id,

"📢 Send broadcast message."

);

}

});

console.log("✅ PART 9 Loaded");
// ===================================================
// PART 10/20
// BROADCAST SYSTEM
// ===================================================

const broadcastUsers = new Map();

// WAITING FOR BROADCAST MESSAGE

bot.on("message", async(msg)=>{

if(!broadcastUsers.has(msg.chat.id))
return;

if(String(msg.from.id)!==String(ADMIN_CHAT_ID))
return;

broadcastUsers.delete(msg.chat.id);

const text=msg.text || msg.caption;

if(!text){

return bot.sendMessage(

msg.chat.id,

"❌ Send a text message."

);

}

const users=

await pool.query(

`

SELECT username

FROM users

`

);

let success=0;

let failed=0;

const status=

await bot.sendMessage(

msg.chat.id,

"📢 Broadcasting...\n\n0/"+users.rows.length

);

for(const user of users.rows){

try{

const chat=

await bot.getChat(

user.username

);

await bot.sendMessage(

chat.id,

text,

{

parse_mode:"HTML"

}

);

success++;

}catch{

failed++;

}

await bot.editMessageText(

`📢 Broadcasting...

✅ Success : ${success}

❌ Failed : ${failed}

📊 Total : ${users.rows.length}`,

{

chat_id:msg.chat.id,

message_id:status.message_id

}

);

}

await bot.editMessageText(

`✅ Broadcast Completed

━━━━━━━━━━━━━━

👥 Total Users : ${users.rows.length}

✅ Success : ${success}

❌ Failed : ${failed}

━━━━━━━━━━━━━━`,

{

chat_id:msg.chat.id,

message_id:status.message_id

}

);

});

console.log("✅ PART 10 Loaded");
// ===================================================
// PART 11/20
// CHAT ID SUPPORT + USER SYSTEM
// ===================================================

// USERS TABLE
await pool.query(`

CREATE TABLE IF NOT EXISTS users(

id SERIAL PRIMARY KEY,

chat_id BIGINT UNIQUE NOT NULL,

username TEXT,

first_name TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

`);

// SAVE USER

async function saveUser(user,chatId){

try{

await pool.query(

`

INSERT INTO users

(chat_id,username,first_name)

VALUES($1,$2,$3)

ON CONFLICT(chat_id)

DO UPDATE SET

username=EXCLUDED.username,

first_name=EXCLUDED.first_name

`

,

[

chatId,

user.username || null,

user.first_name || ""

]

);

}catch(err){

console.log(

"Save User Error:",

err.message

);

}

}

// START COMMAND లో

// OLD
// await saveUser(msg.from);

// NEW
await saveUser(

msg.from,

msg.chat.id

);

// ===================================================
// BROADCAST FIX
// ===================================================

// Part 10 లో ఈ query replace చేయి

const users=await pool.query(

`

SELECT chat_id

FROM users

`

);

// FOR LOOP కూడా replace చేయి

for(const user of users.rows){

try{

await bot.sendMessage(

user.chat_id,

text,

{

parse_mode:"HTML"

}

);

success++;

}catch{

failed++;

}

}
// ===================================================
// PART 12/20
// HOME MENU + LATEST + TRENDING
// ===================================================

// Latest Uploads

async function getLatestUploads(){

const result=await pool.query(

`

SELECT *

FROM contents

ORDER BY created_at DESC

LIMIT 10

`

);

return result.rows;

}

// Trending

async function getTrending(){

const result=await pool.query(

`

SELECT *

FROM contents

ORDER BY id DESC

LIMIT 10

`

);

return result.rows;

}

// Home Buttons

function homeButtons(){

return{

inline_keyboard:[

[

{

text:"🎬 Movies",

callback_data:"menu_movies"

},

{

text:"📺 Series",

callback_data:"menu_series"

}

],

[

{

text:"🍥 Anime",

callback_data:"menu_anime"

}

],

[

{

text:"🔎 Search",

callback_data:"search"

}

],

[

{

text:"🆕 Latest Uploads",

callback_data:"latest"

}

],

[

{

text:"🔥 Trending",

callback_data:"trending"

}

],

[

{

text:"🎬 Request Movie",

url:`https://t.me/${ADMIN_USERNAME.replace("@","")}`

}

],

[

{

text:"📢 Join Channel",

url:`https://t.me/${FORCE_CHANNEL.replace("@","")}`

}

]

]

};

}

// Latest / Trending Callback

bot.on("callback_query",async(query)=>{

const chatId=query.message.chat.id;

if(query.data==="latest"){

const list=await getLatestUploads();

if(!list.length){

return bot.sendMessage(

chatId,

"❌ No uploads available."

);

}

const buttons=[];

list.forEach(item=>{

buttons.push([

{

text:`🎬 ${item.title}`,

callback_data:`quality_${item.content_id}`

}

]);

});

buttons.push([

{

text:"🏠 Home",

callback_data:"home"

}

]);

return bot.sendMessage(

chatId,

"🆕 Latest Uploads",

{

reply_markup:{

inline_keyboard:buttons

}

}

);

}

if(query.data==="trending"){

const list=await getTrending();

if(!list.length){

return bot.sendMessage(

chatId,

"❌ No trending content."

);

}

const buttons=[];

list.forEach(item=>{

buttons.push([

{

text:`🔥 ${item.title}`,

callback_data:`quality_${item.content_id}`

}

]);

});

buttons.push([

{

text:"🏠 Home",

callback_data:"home"

}

]);

return bot.sendMessage(

chatId,

"🔥 Trending Content",

{

reply_markup:{

inline_keyboard:buttons

}

}

);

}

});

console.log("✅ PART 12 Loaded");
// ===================================================
// PART 13/20
// ADMIN CONTENT MANAGEMENT
// ===================================================

// DELETE CONTENT

bot.onText(/\/delete (.+)/, async (msg, match) => {

if(String(msg.from.id)!==String(ADMIN_CHAT_ID)) return;

const id=match[1].trim();

const result=await pool.query(

`DELETE FROM contents
WHERE content_id=$1
RETURNING title`,

[id]

);

if(result.rowCount===0){

return bot.sendMessage(

msg.chat.id,

"❌ Content not found."

);

}

bot.sendMessage(

msg.chat.id,

`✅ Deleted

🎬 ${result.rows[0].title}`

);

});

// CONTENT INFO

bot.onText(/\/info (.+)/, async(msg,match)=>{

if(String(msg.from.id)!==String(ADMIN_CHAT_ID)) return;

const id=match[1].trim();

const result=await pool.query(

`

SELECT *

FROM contents

WHERE content_id=$1

LIMIT 1

`,

[id]

);

if(!result.rows.length){

return bot.sendMessage(

msg.chat.id,

"❌ Content not found."

);

}

const c=result.rows[0];

bot.sendMessage(

msg.chat.id,

`

🎬 ${c.title}

━━━━━━━━━━━━

🆔 ${c.content_id}

📂 ${c.type}

🎞 ${c.collection||"-"}

📺 ${c.season||"-"}

🎬 ${c.episode||"-"}

🎥 ${c.quality}

━━━━━━━━━━━━

`

);

});

// UPLOAD STATS

bot.onText(/\/stats/,async(msg)=>{

if(String(msg.from.id)!==String(ADMIN_CHAT_ID)) return;

const total=

await pool.query(

`SELECT COUNT(*) FROM contents`

);

const movie=

await pool.query(

`SELECT COUNT(*) FROM contents WHERE type='Movie'`

);

const series=

await pool.query(

`SELECT COUNT(*) FROM contents WHERE type='Series'`

);

const anime=

await pool.query(

`SELECT COUNT(*) FROM contents WHERE type='Anime'`

);

bot.sendMessage(

msg.chat.id,

`

📊 Upload Statistics

━━━━━━━━━━━━

🎬 Movies :
${movie.rows[0].count}

📺 Series :
${series.rows[0].count}

🍥 Anime :
${anime.rows[0].count}

📦 Total :
${total.rows[0].count}

━━━━━━━━━━━━

`

);

});

// RECENT REQUESTS

bot.onText(/\/requests/,async(msg)=>{

if(String(msg.from.id)!==String(ADMIN_CHAT_ID)) return;

const result=

await pool.query(

`

SELECT *

FROM requests

ORDER BY created_at DESC

LIMIT 15

`

);

if(!result.rows.length){

return bot.sendMessage(

msg.chat.id,

"📭 No Requests."

);

}

let text="📩 Recent Requests\n\n";

result.rows.forEach(r=>{

text+=`👤 ${r.username}

🎬 ${r.request}

────────────

`;

});

bot.sendMessage(

msg.chat.id,

text

);

});

console.log("✅ PART 13 Loaded");
// ===================================================
// PART 14/20
// CONTENT MANAGEMENT
// ===================================================

// DELETE REQUEST

bot.onText(/\/clearrequests/, async(msg)=>{

if(String(msg.from.id)!==String(ADMIN_CHAT_ID)) return;

await pool.query("DELETE FROM requests");

bot.sendMessage(

msg.chat.id,

"✅ All requests deleted."

);

});

// RENAME CONTENT

bot.onText(/\/rename (.+?) \| (.+)/, async(msg,match)=>{

if(String(msg.from.id)!==String(ADMIN_CHAT_ID)) return;

const id=match[1].trim();

const title=match[2].trim();

const result=await pool.query(

`UPDATE contents
SET title=$1
WHERE content_id=$2
RETURNING title`,

[title,id]

);

if(result.rowCount===0){

return bot.sendMessage(

msg.chat.id,

"❌ Content not found."

);

}

bot.sendMessage(

msg.chat.id,

`✅ Renamed Successfully

🎬 ${title}`

);

});

// CHANGE QUALITY

bot.onText(/\/quality (.+?) \| (.+)/, async(msg,match)=>{

if(String(msg.from.id)!==String(ADMIN_CHAT_ID)) return;

const id=match[1].trim();

const quality=match[2].trim();

const result=await pool.query(

`UPDATE contents
SET quality=$1
WHERE content_id=$2`,

[quality,id]

);

if(result.rowCount===0){

return bot.sendMessage(

msg.chat.id,

"❌ Content not found."

);

}

bot.sendMessage(

msg.chat.id,

`✅ Quality Updated

🎥 ${quality}`

);

});

// DUPLICATE CHECK

async function duplicateContent(id){

const result=await pool.query(

`

SELECT id

FROM contents

WHERE content_id=$1

LIMIT 1

`,

[id]

);

return result.rowCount>0;

}

// UPLOAD CHECK

async function uploadExists(id){

const exists=

await duplicateContent(id);

if(exists){

console.log(

"⚠ Duplicate Upload:",

id

);

return true;

}

return false;

}

// CONTENT COUNT

async function totalContents(){

const result=await pool.query(

`

SELECT COUNT(*)

FROM contents

`

);

return Number(result.rows[0].count);

}

console.log("✅ PART 14 Loaded");
// ===================================================
// PART 15/20
// FAVORITES + WATCH HISTORY
// ===================================================

// DATABASE

await pool.query(`

CREATE TABLE IF NOT EXISTS favorites(

id SERIAL PRIMARY KEY,

chat_id BIGINT,

content_id TEXT,

created_at TIMESTAMP DEFAULT NOW(),

UNIQUE(chat_id,content_id)

);

CREATE TABLE IF NOT EXISTS history(

id SERIAL PRIMARY KEY,

chat_id BIGINT,

content_id TEXT,

watched_at TIMESTAMP DEFAULT NOW()

);

`);

// SAVE HISTORY

async function saveHistory(chatId,contentId){

try{

await pool.query(

`

INSERT INTO history

(chat_id,content_id)

VALUES($1,$2)

`,

[chatId,contentId]

);

}catch(err){}

}

// ADD FAVORITE

async function addFavorite(chatId,contentId){

await pool.query(

`

INSERT INTO favorites

(chat_id,content_id)

VALUES($1,$2)

ON CONFLICT(chat_id,content_id)

DO NOTHING

`,

[chatId,contentId]

);

}

// REMOVE FAVORITE

async function removeFavorite(chatId,contentId){

await pool.query(

`

DELETE FROM favorites

WHERE chat_id=$1

AND content_id=$2

`,

[chatId,contentId]

);

}

// FAVORITES COMMAND

bot.onText(/\/favorites/,async(msg)=>{

const result=await pool.query(

`

SELECT c.*

FROM favorites f

JOIN contents c

ON c.content_id=f.content_id

WHERE f.chat_id=$1

ORDER BY f.created_at DESC

LIMIT 30

`,

[msg.chat.id]

);

if(!result.rows.length){

return bot.sendMessage(

msg.chat.id,

"❤️ Favorites list is empty."

);

}

const buttons=[];

result.rows.forEach(item=>{

buttons.push([

{

text:`🎬 ${item.title}`,

callback_data:`quality_${item.content_id}`

}

]);

});

bot.sendMessage(

msg.chat.id,

"❤️ Your Favorites",

{

reply_markup:{

inline_keyboard:buttons

}

}

);

});

// HISTORY COMMAND

bot.onText(/\/history/,async(msg)=>{

const result=await pool.query(

`

SELECT c.*

FROM history h

JOIN contents c

ON c.content_id=h.content_id

WHERE h.chat_id=$1

ORDER BY h.watched_at DESC

LIMIT 20

`,

[msg.chat.id]

);

if(!result.rows.length){

return bot.sendMessage(

msg.chat.id,

"📜 No watch history."

);

}

const buttons=[];

result.rows.forEach(item=>{

buttons.push([

{

text:`🎬 ${item.title}`,

callback_data:`quality_${item.content_id}`

}

]);

});

bot.sendMessage(

msg.chat.id,

"📜 Watch History",

{

reply_markup:{

inline_keyboard:buttons

}

}

);

});

// FAVORITE CALLBACKS

bot.on("callback_query",async(query)=>{

const chatId=query.message.chat.id;

const data=query.data;

if(data.startsWith("fav_")){

const id=data.replace("fav_","");

await addFavorite(chatId,id);

await bot.answerCallbackQuery(query.id,{

text:"❤️ Added to Favorites"

});

}

if(data.startsWith("unfav_")){

const id=data.replace("unfav_","");

await removeFavorite(chatId,id);

await bot.answerCallbackQuery(query.id,{

text:"💔 Removed from Favorites"

});

}

});

console.log("✅ PART 15 Loaded");
// ===================================================
// PART 16/20
// DOWNLOAD COUNTER + POPULAR + RECOMMENDED
// ===================================================

// DOWNLOAD TABLE

await pool.query(`

CREATE TABLE IF NOT EXISTS downloads(

id SERIAL PRIMARY KEY,

chat_id BIGINT,

content_id TEXT,

downloaded_at TIMESTAMP DEFAULT NOW()

);

`);

// SAVE DOWNLOAD

async function saveDownload(chatId,contentId){

try{

await pool.query(

`

INSERT INTO downloads

(chat_id,content_id)

VALUES($1,$2)

`,

[chatId,contentId]

);

}catch(err){}

}

// POPULAR MOVIES

async function getPopularMovies(){

const result=await pool.query(

`

SELECT
c.*,
COUNT(d.id) total

FROM contents c

LEFT JOIN downloads d

ON c.content_id=d.content_id

GROUP BY c.id

ORDER BY total DESC

LIMIT 10

`

);

return result.rows;

}

// RECOMMENDED

async function getRecommended(chatId){

const result=await pool.query(

`

SELECT *

FROM contents

ORDER BY RANDOM()

LIMIT 10

`

);

return result.rows;

}

// POPULAR COMMAND

bot.onText(/\/popular/,async(msg)=>{

const movies=

await getPopularMovies();

if(!movies.length){

return bot.sendMessage(

msg.chat.id,

"❌ No popular content."

);

}

const buttons=[];

movies.forEach(movie=>{

buttons.push([

{

text:`🔥 ${movie.title}`,

callback_data:`quality_${movie.content_id}`

}

]);

});

bot.sendMessage(

msg.chat.id,

"🔥 Top Downloads",

{

reply_markup:{

inline_keyboard:buttons

}

}

);

});

// RECOMMENDED

bot.onText(/\/recommended/,async(msg)=>{

const movies=

await getRecommended(

msg.chat.id

);

const buttons=[];

movies.forEach(movie=>{

buttons.push([

{

text:`⭐ ${movie.title}`,

callback_data:`quality_${movie.content_id}`

}

]);

});

bot.sendMessage(

msg.chat.id,

"⭐ Recommended For You",

{

reply_markup:{

inline_keyboard:buttons

}

}

);

});

// CONTINUE WATCHING

bot.onText(/\/continue/,async(msg)=>{

const result=await pool.query(

`

SELECT c.*

FROM history h

JOIN contents c

ON h.content_id=c.content_id

WHERE h.chat_id=$1

ORDER BY h.watched_at DESC

LIMIT 1

`,

[msg.chat.id]

);

if(!result.rows.length){

return bot.sendMessage(

msg.chat.id,

"📺 Nothing to continue."

);

}

const movie=result.rows[0];

bot.sendMessage(

msg.chat.id,

"▶ Continue Watching",

{

reply_markup:{

inline_keyboard:[

[

{

text:movie.title,

callback_data:`quality_${movie.content_id}`

}

]

]

}

}

);

});

console.log("✅ PART 16 Loaded");
// ===================================================
// PART 17/20
// MAINTENANCE + BAN + ANALYTICS
// ===================================================

let maintenanceMode = false;

// DATABASE

await pool.query(`

CREATE TABLE IF NOT EXISTS banned_users(

chat_id BIGINT PRIMARY KEY,

reason TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

`);

// ===========================
// CHECK BAN
// ===========================

async function isBanned(chatId){

const result=await pool.query(

`

SELECT *

FROM banned_users

WHERE chat_id=$1

LIMIT 1

`,

[chatId]

);

return result.rowCount>0;

}

// ===========================
// BAN
// ===========================

bot.onText(/\/ban (.+)/,async(msg,match)=>{

if(String(msg.from.id)!==String(ADMIN_CHAT_ID))
return;

const id=match[1].trim();

await pool.query(

`

INSERT INTO banned_users

(chat_id)

VALUES($1)

ON CONFLICT(chat_id)

DO NOTHING

`,

[id]

);

bot.sendMessage(

msg.chat.id,

`✅ User ${id} banned.`

);

});

// ===========================
// UNBAN
// ===========================

bot.onText(/\/unban (.+)/,async(msg,match)=>{

if(String(msg.from.id)!==String(ADMIN_CHAT_ID))
return;

const id=match[1].trim();

await pool.query(

`

DELETE FROM banned_users

WHERE chat_id=$1

`,

[id]

);

bot.sendMessage(

msg.chat.id,

`✅ User ${id} unbanned.`

);

});

// ===========================
// MAINTENANCE
// ===========================

bot.onText(/\/maintenance (on|off)/,async(msg,match)=>{

if(String(msg.from.id)!==String(ADMIN_CHAT_ID))
return;

maintenanceMode=(match[1]==="on");

bot.sendMessage(

msg.chat.id,

maintenanceMode
?"🛠 Maintenance Enabled"
:"✅ Maintenance Disabled"

);

});

// ===========================
// BLOCK USERS
// ===========================

bot.on("message",async(msg)=>{

if(msg.from.id==ADMIN_CHAT_ID)
return;

if(await isBanned(msg.chat.id)){

return bot.sendMessage(

msg.chat.id,

"🚫 You are banned."

);

}

if(maintenanceMode){

return bot.sendMessage(

msg.chat.id,

"🛠 Bot is under maintenance.\nPlease try again later."

);

}

});

// ===========================
// ANALYTICS
// ===========================

bot.onText(/\/analytics/,async(msg)=>{

if(String(msg.from.id)!==String(ADMIN_CHAT_ID))
return;

const users=
await pool.query(

"SELECT COUNT(*) FROM users"

);

const downloads=
await pool.query(

"SELECT COUNT(*) FROM downloads"

);

const favorites=
await pool.query(

"SELECT COUNT(*) FROM favorites"

);

const history=
await pool.query(

"SELECT COUNT(*) FROM history"

);

bot.sendMessage(

msg.chat.id,

`

📊 Bot Analytics

━━━━━━━━━━

👥 Users :
${users.rows[0].count}

📥 Downloads :
${downloads.rows[0].count}

❤️ Favorites :
${favorites.rows[0].count}

📜 History :
${history.rows[0].count}

━━━━━━━━━━

`

);

});

console.log("✅ PART 17 Loaded");
// ===================================================
// PART 18/20
// NOTIFICATION + REFERRAL + DAILY BONUS
// ===================================================

// DATABASE

await pool.query(`

CREATE TABLE IF NOT EXISTS referrals(

id SERIAL PRIMARY KEY,

user_id BIGINT,

referred_by BIGINT,

created_at TIMESTAMP DEFAULT NOW()

);

CREATE TABLE IF NOT EXISTS daily_bonus(

chat_id BIGINT PRIMARY KEY,

last_claim DATE

);

`);

// ==========================================
// NOTIFY ALL USERS
// ==========================================

async function notifyUsers(content){

try{

const users=await pool.query(

`

SELECT chat_id

FROM users

`

);

for(const user of users.rows){

try{

await bot.sendMessage(

user.chat_id,

`🆕 New Upload Available!

🎬 ${content.title}

🎥 ${content.quality}

Tap below 👇`,

{

reply_markup:{

inline_keyboard:[

[

{

text:"🎬 Watch Now",

callback_data:`quality_${content.content_id}`

}

]

}

}

);

}catch(e){}

}

}catch(err){

console.log(err.message);

}

}

// ==========================================
// CALL AFTER SAVE CONTENT
// ==========================================

// saveContent() SUCCESS అయిన వెంటనే

// await notifyUsers(data);

// ==========================================
// REFERRAL
// ==========================================

bot.onText(

/\/referral/,

async(msg)=>{

const id=msg.from.id;

const me=await bot.getMe();

const link=

`https://t.me/${me.username}?start=ref_${id}`;

bot.sendMessage(

msg.chat.id,

`👥 Invite your friends

🔗 ${link}`

);

});

// ==========================================
// START REFERRAL
// ==========================================

bot.onText(

/\/start ref_(.+)/,

async(msg,match)=>{

const refBy=

Number(match[1]);

if(refBy===msg.from.id)
return;

try{

await pool.query(

`

INSERT INTO referrals

(user_id,referred_by)

VALUES($1,$2)

ON CONFLICT DO NOTHING

`,

[

msg.from.id,

refBy

]

);

}catch(e){}

});

// ==========================================
// LEADERBOARD
// ==========================================

bot.onText(

/\/leaderboard/,

async(msg)=>{

const result=

await pool.query(

`

SELECT

referred_by,

COUNT(*) total

FROM referrals

GROUP BY referred_by

ORDER BY total DESC

LIMIT 10

`

);

if(!result.rows.length){

return bot.sendMessage(

msg.chat.id,

"No leaderboard."

);

}

let text="🏆 Top Referrals\n\n";

let rank=1;

for(const row of result.rows){

text+=

`${rank}. ${row.referred_by}

👥 ${row.total} referrals

`;

rank++;

}

bot.sendMessage(

msg.chat.id,

text

);

});

// ==========================================
// DAILY BONUS
// ==========================================

bot.onText(

/\/bonus/,

async(msg)=>{

const today=

new Date()

.toISOString()

.slice(0,10);

const result=

await pool.query(

`

SELECT *

FROM daily_bonus

WHERE chat_id=$1

`,

[msg.chat.id]

);

if(

result.rows.length &&

result.rows[0].last_claim==today

){

return bot.sendMessage(

msg.chat.id,

"🎁 You already claimed today's bonus."

);

}

await pool.query(

`

INSERT INTO daily_bonus

(chat_id,last_claim)

VALUES($1,$2)

ON CONFLICT(chat_id)

DO UPDATE SET

last_claim=$2

`,

[

msg.chat.id,

today

]

);

bot.sendMessage(

msg.chat.id,

"🎉 Daily Bonus Claimed!"

);

});

console.log("✅ PART 18 Loaded");
// ===================================================
// PART 19/20
// CONTINUE WATCHING + TRENDING + SETTINGS
// ===================================================

// ==============================
// DATABASE
// ==============================

await pool.query(`

CREATE TABLE IF NOT EXISTS watch_history(
id SERIAL PRIMARY KEY,
chat_id BIGINT,
content_id TEXT,
watched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings(
chat_id BIGINT PRIMARY KEY,
language TEXT DEFAULT 'English'
);

`);

// ==============================
// SAVE WATCH HISTORY
// ==============================

async function saveWatch(chatId, contentId){

try{

await pool.query(
`
INSERT INTO watch_history(chat_id,content_id)
VALUES($1,$2)
`,
[chatId, contentId]
);

}catch(err){
console.log(err.message);
}

}

// ==============================
// CONTINUE WATCHING
// ==============================

bot.onText(/\/continue/, async(msg)=>{

const result = await pool.query(
`
SELECT content_id
FROM watch_history
WHERE chat_id=$1
ORDER BY watched_at DESC
LIMIT 10
`,
[msg.chat.id]
);

if(!result.rows.length){
return bot.sendMessage(msg.chat.id,"📺 No watch history.");
}

const buttons=[];

for(const row of result.rows){

buttons.push([
{
text:row.content_id,
callback_data:`quality_${row.content_id}`
}
]);

}

bot.sendMessage(
msg.chat.id,
"▶ Continue Watching",
{
reply_markup:{
inline_keyboard:buttons
}
}
);

});

// ==============================
// TRENDING
// ==============================

bot.onText(/\/trending/, async(msg)=>{

const result = await pool.query(
`
SELECT content_id,COUNT(*) total
FROM watch_history
GROUP BY content_id
ORDER BY total DESC
LIMIT 10
`
);

if(!result.rows.length){
return bot.sendMessage(msg.chat.id,"No trending content.");
}

let text="🔥 Trending This Week\n\n";

let i=1;

for(const row of result.rows){

text += `${i}. ${row.content_id} (${row.total} views)\n`;

i++;

}

bot.sendMessage(msg.chat.id,text);

});

// ==============================
// RECENTLY ADDED
// ==============================

bot.onText(/\/recent/, async(msg)=>{

const result = await pool.query(
`
SELECT title,content_id
FROM contents
ORDER BY created_at DESC
LIMIT 15
`
);

const buttons=[];

for(const row of result.rows){

buttons.push([
{
text:row.title,
callback_data:`quality_${row.content_id}`
}
]);

}

bot.sendMessage(
msg.chat.id,
"🆕 Recently Added",
{
reply_markup:{
inline_keyboard:buttons
}
}
);

});

// ==============================
// SETTINGS
// ==============================

bot.onText(/\/settings/, async(msg)=>{

bot.sendMessage(
msg.chat.id,
"⚙ Settings",
{
reply_markup:{
inline_keyboard:[
[
{text:"🇬🇧 English",callback_data:"lang_English"},
{text:"🇮🇳 Telugu",callback_data:"lang_Telugu"}
]
]
}
}
);

});

// ==============================
// LANGUAGE
// ==============================

bot.on("callback_query",async(query)=>{

if(!query.data.startsWith("lang_"))
return;

const lang=query.data.replace("lang_","");

await pool.query(
`
INSERT INTO user_settings(chat_id,language)
VALUES($1,$2)
ON CONFLICT(chat_id)
DO UPDATE SET language=$2
`,
[
query.message.chat.id,
lang
]
);

await bot.answerCallbackQuery(query.id,{
text:`Language changed to ${lang}`
});

});

console.log("✅ PART 19 Loaded");
// ===================================================
// PART 20/20
// ADMIN PANEL + BROADCAST + CLEANUP + STARTUP
// ===================================================

// ==============================
// BROADCAST
// ==============================

bot.onText(/\/broadcast (.+)/, async (msg, match) => {

    if (String(msg.from.id) !== String(ADMIN_CHAT_ID)) return;

    const text = match[1];

    const users = await pool.query(`
        SELECT chat_id
        FROM users
    `);

    let sent = 0;

    for (const user of users.rows) {

        try {

            await bot.sendMessage(user.chat_id, text);

            sent++;

        } catch (e) {}

    }

    bot.sendMessage(
        msg.chat.id,
        `✅ Broadcast Completed\n\n📤 Sent : ${sent}`
    );

});

// ==============================
// STATS
// ==============================

bot.onText(/\/stats/, async (msg) => {

    if (String(msg.from.id) !== String(ADMIN_CHAT_ID)) return;

    const users = await pool.query("SELECT COUNT(*) FROM users");
    const movies = await pool.query("SELECT COUNT(*) FROM contents");
    const requests = await pool.query("SELECT COUNT(*) FROM requests");
    const history = await pool.query("SELECT COUNT(*) FROM watch_history");

    bot.sendMessage(msg.chat.id,

`📊 CineXClub Statistics

━━━━━━━━━━━━

👤 Users : ${users.rows[0].count}

🎬 Contents : ${movies.rows[0].count}

📩 Requests : ${requests.rows[0].count}

▶ History : ${history.rows[0].count}

━━━━━━━━━━━━`

    );

});

// ==============================
// DATABASE CLEANUP
// ==============================

bot.onText(/\/cleanup/, async (msg) => {

    if (String(msg.from.id) !== String(ADMIN_CHAT_ID)) return;

    await pool.query(`
        DELETE FROM watch_history
        WHERE watched_at < NOW() - INTERVAL '90 days'
    `);

    bot.sendMessage(
        msg.chat.id,
        "✅ Old watch history cleaned."
    );

});

// ==============================
// BOT STARTED
// ==============================

bot.on("polling_error", console.log);

process.on("unhandledRejection", console.error);

process.on("uncaughtException", console.error);

setInterval(() => {

    console.log(
        `🟢 CineXClub Running ${new Date().toLocaleString()}`
    );

}, 300000);

console.log("🚀 CineXClub Final Version Loaded Successfully");
