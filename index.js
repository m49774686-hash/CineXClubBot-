// ============================================
// CineXClub Bot
// FINAL MERGED INDEX.JS
// PART 1/10
// ============================================

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");


// ============================================
// ENV
// ============================================

const BOT_TOKEN = process.env.BOT_TOKEN;

const DATABASE_URL = process.env.DATABASE_URL;

const FORCE_CHANNEL = process.env.FORCE_CHANNEL;

const STORAGE_CHANNEL = process.env.STORAGE_CHANNEL;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;



// ============================================
// BOT START
// ============================================

const bot = new TelegramBot(
    BOT_TOKEN,
    {
        polling:{
            interval:300,
            autoStart:true
        }
    }
);


console.log("🎬 CineXClub Bot Starting...");




// ============================================
// POSTGRES CONNECTION
// ============================================

const pool = new Pool({

    connectionString:DATABASE_URL,

    ssl:{
        rejectUnauthorized:false
    }

});





// ============================================
// DATABASE CREATE
// ============================================

async function initDatabase(){

try{


await pool.query(`

CREATE TABLE IF NOT EXISTS contents(

id SERIAL PRIMARY KEY,

content_id TEXT UNIQUE NOT NULL,

title TEXT NOT NULL,

type TEXT NOT NULL,

collection TEXT,

season INTEGER,

episode INTEGER,

quality TEXT,

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);



CREATE TABLE IF NOT EXISTS users(

id SERIAL PRIMARY KEY,

username TEXT,

created_at TIMESTAMP DEFAULT NOW()

);



CREATE TABLE IF NOT EXISTS requests(

id SERIAL PRIMARY KEY,

username TEXT,

request TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

`);

console.log("✅ PostgreSQL Connected");


}catch(err){

console.log(
"Database Error:",
err
);

}


}


initDatabase();





// ============================================
// RENDER KEEP ALIVE
// ============================================

http.createServer(

(req,res)=>{

res.write("CineXClub Running");

res.end();

}

).listen(

process.env.PORT || 3000

);





// ============================================
// WELCOME QUOTES
// ============================================

const quotes=[

"🎬 Movies are memories waiting to happen.",

"🍿 Grab popcorn and enjoy your movie.",

"🔥 Your entertainment journey starts here.",

"🎥 Every story deserves to be watched."

];



function randomQuote(){

return quotes[
Math.floor(
Math.random()*quotes.length
)
];

}





// ============================================
// USER SAVE
// ============================================

async function saveUser(username){

try{

await pool.query(

`
INSERT INTO users(username)

VALUES($1)

`,

[
username || "User"
]

);


}catch(e){}



}





// ============================================
// USERNAME ONLY
// ============================================

function username(user){

return user.username
?
"@"+user.username
:
"User";

}



// ============================================
// END FINAL PART 1
// ============================================
// ============================================
// PART 2/10
// Start System + Force Join + File Sending
// ============================================



// ============================================
// FORCE JOIN CHECK
// ============================================

async function checkJoin(userId){

try{


const member =
await bot.getChatMember(
FORCE_CHANNEL,
userId
);



if(
member.status==="left" ||
member.status==="kicked"
){

return false;

}


return true;


}catch(err){

return false;

}


}




// ============================================
// JOIN BUTTON
// ============================================

function joinButton(){

return {

inline_keyboard:[

[

{

text:"📢 Join Channel",

url:
`https://t.me/${FORCE_CHANNEL.replace("@","")}`

}

],

[

{

text:"✅ Continue",

callback_data:"check_join"

}

]

]

};


}





// ============================================
// GOOGLE + REQUEST + ADMIN BUTTON
// ============================================

function helpButtons(title){

return {

inline_keyboard:[

[

{

text:"🔎 Google Search",

url:
`https://www.google.com/search?q=${encodeURIComponent(title)}`

}

],

[

{

text:"📝 Request Movie",

callback_data:
`request_${title}`

}

],

[

{

text:"👨‍💻 Contact Admin",

url:
`https://t.me/${ADMIN_USERNAME.replace("@","")}`

}

]

]

};


}





// ============================================
// GET CONTENT
// ============================================

async function getContent(id){

try{


const result =
await pool.query(

`

SELECT *
FROM contents
WHERE content_id=$1

`

,

[id]

);



return result.rows[0] || null;



}catch(err){

return null;

}


}





// ============================================
// AUTO DELETE
// ============================================

function deleteLater(chatId,messageId){


setTimeout(()=>{


bot.deleteMessage(

chatId,

messageId

)
.catch(()=>{});



},600000);


}





// ============================================
// SEND FILE
// ============================================

async function sendFile(chatId,data){


try{


let sent =
await bot.sendDocument(

chatId,

data.file_id,

{

caption:

`

🎬 ${data.title}

📂 Type:
${data.type}


${data.collection ?
"🎞 Collection: "+data.collection
:""}


${data.season ?
"📺 Season: "+data.season
:""}


${data.episode ?
"🎬 Episode: "+data.episode
:""}


🎥 Quality:
${data.quality || "Unknown"}

`

}

);



deleteLater(
chatId,
sent.message_id
);



}catch(err){

console.log(
"Send Error:",
err
);


}


}





// ============================================
// START COMMAND
// ============================================

bot.onText(

/\/start(?:\s+(.+))?/,

async(msg,match)=>{


const chatId =
msg.chat.id;



let user =
username(msg.from);



await saveUser(user);




// NORMAL START

if(!match[1]){


let welcome =
await bot.sendMessage(

chatId,

`

🎬 Welcome ${user}


${randomQuote()}


Choose what you want to watch:

`

,

{

reply_markup:{

inline_keyboard:[

[

{

text:"🎬 Movies",

callback_data:"type_Movie"

},

{

text:"📺 Series",

callback_data:"type_Series"

}

],

[

{

text:"🔥 Anime",

callback_data:"type_Anime"

}

]

]

}

}

);



return;

}





// DEEP LINK

let contentId =
match[1];



let joined =
await checkJoin(
msg.from.id
);



if(!joined){


return bot.sendMessage(

chatId,

"⚠️ Please join our channel first",

{

reply_markup:
joinButton()

}

);


}



let data =
await getContent(
contentId
);



if(!data){


return bot.sendMessage(

chatId,

`

❌ Video not found in our database

`

,

{

reply_markup:
helpButtons(contentId)

}

);


}




sendFile(
chatId,
data
);



});




// ============================================
// END PART 2
// ============================================
// ============================================
// PART 3/10
// Storage Channel Upload System
// Caption Parser + Database Save
// ============================================


// ============================================
// PARSE UPLOAD CAPTION
// ============================================

function parseCaption(caption){


let data={

type:"Movie",

title:"Unknown",

collection:null,

season:null,

episode:null,

quality:null,

content_id:null

};



let lines =
caption
.split("\n")
.map(x=>x.trim())
.filter(Boolean);



for(let line of lines){


let parts =
line.split(":");


let key =
parts[0]
.toLowerCase()
.trim();



let value =
parts
.slice(1)
.join(":")
.trim();



switch(key){


case "type":

data.type=value;

break;



case "title":

data.title=value;

break;



case "collection":

case "series":

data.collection=value;

break;



case "season":

data.season=
parseInt(value);

break;



case "episode":

case "ep":

data.episode=
parseInt(value);

break;



case "quality":

data.quality=value;

break;



case "id":

data.content_id=value;

break;



}


}




// AUTO ID GENERATION


if(!data.content_id){


if(
data.type==="Series" ||
data.type==="Anime"
){


data.content_id =

data.collection
.replace(/\s+/g,"")
+
"S"+String(data.season)
.padStart(2,"0")

+
"E"+String(data.episode)
.padStart(2,"0")

+
"_"+
data.quality
.replace(/\s+/g,"");



}else{


data.content_id =

data.title
.replace(/\s+/g,"")
+
"_"+
data.quality
.replace(/\s+/g,"");


}



}



return data;


}







// ============================================
// SAVE CONTENT
// ============================================

async function saveContent(data,fileId){


try{


await pool.query(

`

INSERT INTO contents

(

content_id,

title,

type,

collection,

season,

episode,

quality,

file_id

)

VALUES

($1,$2,$3,$4,$5,$6,$7,$8)



ON CONFLICT(content_id)

DO UPDATE SET

file_id=$8,

quality=$7

`

,

[


data.content_id,

data.title,

data.type,

data.collection,

data.season,

data.episode,

data.quality,

fileId


]

);



return true;



}catch(err){


console.log(
"Save Error:",
err
);


return false;


}


}






// ============================================
// STORAGE CHANNEL LISTENER
// ============================================

bot.on(

"channel_post",

async(msg)=>{


try{


if(

String(msg.chat.id)
!==String(STORAGE_CHANNEL)

){

return;

}




let fileId=null;




if(msg.video){

fileId=
msg.video.file_id;

}



if(msg.document){

fileId=
msg.document.file_id;

}



if(!fileId){

return;

}




if(!msg.caption){

return;

}




let data =
parseCaption(
msg.caption
);



let saved =
await saveContent(
data,
fileId
);



if(saved){


let botInfo =
await bot.getMe();



let link =

`https://t.me/${botInfo.username}?start=${data.content_id}`;



bot.sendMessage(

msg.chat.id,

`

✅ Saved Successfully


🎬 Title:
${data.title}


📂 Type:
${data.type}


🆔 ID:
${data.content_id}


🎥 Quality:
${data.quality || "Unknown"}


🔗 Link:

${link}

`

);



}



}catch(err){


console.log(
"Storage Error:",
err
);



}


});




// ============================================
// END PART 3
// ============================================
// ============================================
// PART 4/10
// Collections + Movies + Series Navigation
// ============================================



// ============================================
// GET COLLECTIONS
// ============================================

async function getCollections(type){


try{


const result =
await pool.query(

`

SELECT DISTINCT collection

FROM contents

WHERE type=$1

AND collection IS NOT NULL

ORDER BY collection

`

,

[type]

);



return result.rows;



}catch(err){

return [];

}


}






// ============================================
// GET COLLECTION MOVIES
// ============================================

async function getCollectionMovies(collection){


try{


const result =
await pool.query(

`

SELECT *

FROM contents

WHERE collection=$1

ORDER BY id ASC

`

,

[collection]

);



return result.rows;



}catch(err){

return [];

}


}







// ============================================
// GET SEASONS
// ============================================

async function getSeasons(series){


try{


const result =
await pool.query(

`

SELECT DISTINCT season

FROM contents

WHERE collection=$1

AND season IS NOT NULL

ORDER BY season

`

,

[series]

);



return result.rows;



}catch(err){

return [];

}


}







// ============================================
// GET EPISODES
// ============================================

async function getEpisodes(series,season){


try{


const result =
await pool.query(

`

SELECT *

FROM contents

WHERE collection=$1

AND season=$2

ORDER BY episode

`

,

[
series,
season
]

);



return result.rows;



}catch(err){

return [];

}


}







// ============================================
// SHOW TYPE MENU
// ============================================

async function showType(chatId,type){



let collections =
await getCollections(type);



let buttons=[];



collections.forEach(item=>{


buttons.push([

{

text:
"🎞 "+item.collection,

callback_data:
"collection_"+item.collection

}

]);



});





bot.sendMessage(

chatId,

`

${type}

Select Collection

`

,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



}






// ============================================
// SHOW MOVIES
// ============================================

async function showMovies(chatId,collection){


let movies =
await getCollectionMovies(collection);



let buttons=[];



movies.forEach(movie=>{


buttons.push([

{

text:
`🎬 ${movie.title} ${movie.quality || ""}`,

callback_data:
"play_"+movie.content_id

}

]);



});





bot.sendMessage(

chatId,

`

🎞 ${collection}


Select Movie:

`

,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



}







// ============================================
// SHOW SEASONS
// ============================================

async function showSeasons(chatId,series){



let seasons =
await getSeasons(series);



let buttons=[];



seasons.forEach(s=>{


buttons.push([

{

text:
`📺 Season ${s.season}`,

callback_data:
`season_${series}_${s.season}`

}

]);



});





bot.sendMessage(

chatId,

`

📺 ${series}


Choose Season:

`

,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



}







// ============================================
// SHOW EPISODES
// ============================================

async function showEpisodes(chatId,series,season){



let episodes =
await getEpisodes(
series,
season
);



let buttons=[];



episodes.forEach(ep=>{


buttons.push([

{

text:
`🎬 Episode ${ep.episode} ${ep.quality}`,

callback_data:
"play_"+ep.content_id

}

]);



});




buttons.push([

{

text:"📥 Send All Episodes",

callback_data:
`all_${series}_${season}`

}

]);





bot.sendMessage(

chatId,

`

📺 ${series}

Season ${season}


Choose Episode:

`

,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



}







// ============================================
// END PART 4
// ============================================
// ============================================
// PART 5/10
// Quality Selection + Send All Episodes
// ============================================



// ============================================
// GET SAME CONTENT QUALITIES
// ============================================

async function getQualities(contentId){


try{


const base =
contentId
.split("_")[0];



const result =
await pool.query(

`

SELECT *

FROM contents

WHERE content_id LIKE $1

ORDER BY quality

`

,

[
base+"%"
]

);



return result.rows;



}catch(err){

return [];

}


}






// ============================================
// QUALITY MENU
// ============================================

async function qualityMenu(chatId,contentId){



let files =
await getQualities(contentId);



if(files.length<=1){

return sendFile(
chatId,
files[0]
);

}





let buttons=[];



files.forEach(file=>{


buttons.push([

{

text:
"🎥 "+file.quality,

callback_data:
"send_"+file.content_id

}

]);


});





bot.sendMessage(

chatId,

`

🎬 Choose Quality

`

,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



}







// ============================================
// SEND ALL EPISODES
// ============================================

async function sendAllEpisodes(chatId,series,season){



let episodes =
await getEpisodes(
series,
season
);



if(!episodes.length){

return bot.sendMessage(

chatId,

"❌ Episodes not found"

);

}




let msg =
await bot.sendMessage(

chatId,

`

📥 Sending all episodes...

📺 ${series}

Season ${season}

Please wait...

`

);



for(
let ep of episodes
){


await sendFile(
chatId,
ep
);



await new Promise(

resolve=>

setTimeout(
resolve,
1000
)

);



}




deleteLater(
chatId,
msg.message_id
);



}






// ============================================
// MAIN CALLBACK HANDLER
// ============================================

bot.on(

"callback_query",

async(query)=>{


const chatId =
query.message.chat.id;



const data =
query.data;





// CHECK JOIN

if(data==="check_join"){


let joined =
await checkJoin(
query.from.id
);



if(joined){


bot.sendMessage(

chatId,

"✅ Joined successfully. Now open your link."

);


}else{


bot.answerCallbackQuery(

query.id,

{

text:"❌ Join channel first"

}

);


}


return;

}







// TYPE MENU


if(
data.startsWith("type_")
){


let type =
data.replace(
"type_",
""
);



showType(
chatId,
type
);


return;

}







// COLLECTION


if(
data.startsWith("collection_")
){


let collection =
data.replace(
"collection_",
""
);



showMovies(
chatId,
collection
);



return;

}







// PLAY CONTENT


if(
data.startsWith("play_")
){


let id =
data.replace(
"play_",
""
);



let files =
await getQualities(id);



if(files.length>1){

qualityMenu(
chatId,
id
);


}else{


let content =
await getContent(id);



if(content){

sendFile(
chatId,
content
);

}


}



return;

}






// SEND QUALITY FILE


if(
data.startsWith("send_")
){


let id =
data.replace(
"send_",
""
);



let content =
await getContent(id);



if(content){

sendFile(
chatId,
content
);

}



return;

}







// SEASON


if(
data.startsWith("season_")
){


let parts =
data.split("_");



let series =
parts[1];

let season =
parts[2];



showEpisodes(
chatId,
series,
season
);



return;

}







// ALL EPISODES


if(
data.startsWith("all_")
){


let parts =
data.split("_");



sendAllEpisodes(

chatId,

parts[1],

parts[2]

);



return;

}






});




// ============================================
// END PART 5
// ============================================
// ============================================
// PART 6/10
// Search + Request + Admin Notification
// ============================================



// ============================================
// SEARCH DATABASE
// ============================================

async function searchMovies(keyword){


try{


const result =
await pool.query(

`

SELECT *

FROM contents

WHERE

LOWER(title) LIKE LOWER($1)

OR

LOWER(collection) LIKE LOWER($1)

LIMIT 20

`

,

[
"%"+keyword+"%"
]

);



return result.rows;



}catch(err){

return [];

}


}






// ============================================
// SEARCH COMMAND
// ============================================

bot.onText(

/\/search (.+)/,

async(msg,match)=>{


let keyword =
match[1];



let results =
await searchMovies(keyword);



if(!results.length){


return bot.sendMessage(

msg.chat.id,

`

❌ No results found

Try Google Search

`

,

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

text:"📝 Request Movie",

callback_data:

"request_"+keyword

}

]

]

}

}

);



}




let buttons=[];



results.forEach(movie=>{


buttons.push([

{

text:
"🎬 "+movie.title,

callback_data:
"play_"+movie.content_id

}

]);


});





bot.sendMessage(

msg.chat.id,

`

🔎 Search Results:

${keyword}

`

,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



}

);








// ============================================
// REQUEST SAVE
// ============================================

async function saveRequest(username,request){


try{


await pool.query(

`

INSERT INTO requests

(username,request)

VALUES($1,$2)

`

,

[
username,
request
]

);



return true;



}catch(err){

return false;

}


}







// ============================================
// ADMIN ALERT
// ============================================

async function sendAdmin(text){


try{


await bot.sendMessage(

ADMIN_USERNAME,

text

);



}catch(err){

console.log(
"Admin message error"
);


}


}







// ============================================
// REQUEST BUTTON HANDLER
// ============================================

bot.on(

"callback_query",

async(query)=>{


if(
!query.data.startsWith("request_")
){

return;

}



let movie =
query.data.replace(
"request_",
""
);



let user =
username(query.from);





await saveRequest(
user,
movie
);





await sendAdmin(

`

📝 New Movie Request


👤 User:

${user}


🎬 Request:

${movie}

`

);






bot.sendMessage(

query.message.chat.id,

`

✅ Request Sent

Admin will check your request.

`

);



});






// ============================================
// CONTACT ADMIN BUTTON
// ============================================

function contactButton(){


return {

inline_keyboard:[

[

{

text:"👨‍💻 Contact Admin",

url:
`https://t.me/${ADMIN_USERNAME.replace("@","")}`

}

]

]

};


}





// ============================================
// END PART 6
// ============================================
// ============================================
// PART 7/10
// User System + Auto Delete + Database Optimization
// ============================================



// ============================================
// SAVE USER UPDATE
// ============================================

async function updateUser(user){


try{


let name =
username(user);



await pool.query(

`

INSERT INTO users(username)

VALUES($1)

ON CONFLICT DO NOTHING

`

,

[
name
]

);



}catch(err){

console.log(
"User Save Error"
);

}


}







// ============================================
// USER TRACKING
// ============================================

bot.on(

"message",

async(msg)=>{


if(
msg.from &&
!msg.from.is_bot
){


await updateUser(
msg.from
);


}


});







// ============================================
// AUTO DELETE QUEUE
// ============================================


const deleteQueue=[];



function addDeleteQueue(
chatId,
messageId
){


deleteQueue.push({

chatId,
messageId,
time:
Date.now()+600000

});


}







setInterval(()=>{


let now =
Date.now();



for(
let i=deleteQueue.length-1;
i>=0;
i--
){


if(
deleteQueue[i].time <= now
){


bot.deleteMessage(

deleteQueue[i].chatId,

deleteQueue[i].messageId

)
.catch(()=>{});



deleteQueue.splice(
i,
1
);



}



}



},30000);







// ============================================
// DATABASE INDEXES
// ============================================

async function createIndexes(){


try{


await pool.query(`

CREATE INDEX IF NOT EXISTS content_id_index

ON contents(content_id);



CREATE INDEX IF NOT EXISTS collection_index

ON contents(collection);



CREATE INDEX IF NOT EXISTS type_index

ON contents(type);



CREATE INDEX IF NOT EXISTS username_index

ON users(username);

`);




console.log(
"✅ Indexes Created"
);



}catch(err){

console.log(
"Index Error"
);


}



}



createIndexes();






// ============================================
// ERROR HANDLING
// ============================================


bot.on(

"polling_error",

(err)=>{


console.log(

"Polling Error:",

err.message

);


});






process.on(

"unhandledRejection",

(err)=>{


console.log(

"Unhandled Error:",

err

);


});






process.on(

"uncaughtException",

(err)=>{


console.log(

"Crash Error:",

err.message

);


});







// ============================================
// HEALTH CHECK
// ============================================


setInterval(()=>{


console.log(
"🤖 CineXClub Bot Active"
);



},600000);






// ============================================
// END PART 7
// ============================================
// ============================================
// PART 8/10
// User Interface + Commands
// ============================================



// ============================================
// MAIN MENU
// ============================================

function mainMenu(){


return {

inline_keyboard:[


[

{

text:"🎬 Movies",

callback_data:"type_Movie"

},

{

text:"📺 Series",

callback_data:"type_Series"

}

],


[

{

text:"🔥 Anime",

callback_data:"type_Anime"

}

],


[

{

text:"🔎 Search",

callback_data:"search_help"

},

{

text:"📝 Request",

callback_data:"request_help"

}

]

]

};


}






// ============================================
// MENU COMMAND
// ============================================


bot.onText(

/\/menu/,

(msg)=>{


bot.sendMessage(

msg.chat.id,

`

🎬 CineXClub Menu


Choose Category:

`

,

{

reply_markup:
mainMenu()

}

);



}

);






// ============================================
// HELP COMMAND
// ============================================


bot.onText(

/\/help/,

(msg)=>{


bot.sendMessage(

msg.chat.id,

`

🎬 CineXClub Bot Help


Commands:


/start

Open Bot


/menu

Movies Menu


/search movie name

Search Content



Need Movie?

Use Request Button



`

);





}

);






// ============================================
// UPLOAD HELP
// ============================================


bot.onText(

/\/uploadhelp/,

(msg)=>{


bot.sendMessage(

msg.chat.id,

`

📤 Storage Upload Format


🎬 MOVIE


Type: Movie

Title: Deadpool 2

Collection: Deadpool

Quality: 720p



📺 SERIES


Type: Series

Title: Stranger Things S01E01

Collection: Stranger Things

Season: 1

Episode: 1

Quality: 720p



🔥 ANIME


Type: Anime

Title: Naruto Episode 1

Collection: Naruto

Season: 1

Episode: 1

Quality: 1080p



Upload video/document with caption.

`

);


}

);






// ============================================
// UI CALLBACKS
// ============================================

bot.on(

"callback_query",

async(query)=>{


const chatId =
query.message.chat.id;



if(
query.data==="search_help"
){


bot.sendMessage(

chatId,

`

🔎 Search


Use:

/search movie name

`

);


}





if(
query.data==="request_help"
){


bot.sendMessage(

chatId,

`

📝 Request Movie


Use Request Button from search result.

`

);


}



});







// ============================================
// START MESSAGE BUTTON FIX
// ============================================


bot.onText(

/\/about/,

(msg)=>{


bot.sendMessage(

msg.chat.id,

`

🎬 CineXClub Bot


Features:

✅ Movies

✅ Series

✅ Anime

✅ Seasons

✅ Episodes

✅ Quality Selection

✅ Auto Delete


Enjoy Watching 🍿

`

);


}

);






// ============================================
// END PART 8
// ============================================
// ============================================
// PART 9/10
// Production Checks + Final Utilities
// ============================================



// ============================================
// ENVIRONMENT CHECK
// ============================================

function checkEnvironment(){


let missing=[];



if(!BOT_TOKEN)

missing.push("BOT_TOKEN");



if(!DATABASE_URL)

missing.push("DATABASE_URL");



if(!FORCE_CHANNEL)

missing.push("FORCE_CHANNEL");



if(!STORAGE_CHANNEL)

missing.push("STORAGE_CHANNEL");



if(!ADMIN_USERNAME)

missing.push("ADMIN_USERNAME");





if(missing.length){


console.log(

"⚠️ Missing ENV:",

missing.join(",")

);


}else{


console.log(
"✅ Environment Ready"
);


}



}



checkEnvironment();







// ============================================
// STORAGE VALIDATION
// ============================================

async function checkDatabase(){


try{


await pool.query(

"SELECT 1"

);


console.log(
"✅ Database Connection OK"
);



}catch(err){


console.log(

"❌ Database Connection Failed",

err.message

);



}


}



checkDatabase();







// ============================================
// BOT LINK GENERATOR
// ============================================

async function botLink(id){


try{


let info =
await bot.getMe();



return (

`https://t.me/${info.username}?start=${id}`

);



}catch(err){


return null;


}


}







// ============================================
// TEST COMMAND
// ============================================


bot.onText(

/\/ping/,

(msg)=>{


bot.sendMessage(

msg.chat.id,

"🏓 Bot is Online"

);


}

);







// ============================================
// ADMIN ONLY CHECK
// ============================================

function isAdmin(user){


return (

("@"+user.username)

===

ADMIN_USERNAME

);


}







// ============================================
// ADMIN STATUS COMMAND
// ============================================


bot.onText(

/\/status/,

async(msg)=>{


if(
!isAdmin(msg.from)
){

return;

}



let result =
await pool.query(

`

SELECT COUNT(*)

FROM contents

`

);



bot.sendMessage(

msg.chat.id,

`

🤖 Bot Status


🎬 Total Files:

${result.rows[0].count}


💾 Database:

Online


`

);



}

);







// ============================================
// BOT START LOG
// ============================================


bot.getMe()

.then(info=>{


console.log(`

================================

🎬 CineXClub Bot Online


Username:

@${info.username}


================================

`);


})

.catch(err=>{


console.log(
"Bot Start Error"
);


});






// ============================================
// END PART 9
// ============================================
// ============================================
// PART 10/10
// Final Cleanup + Shutdown Protection
// ============================================



// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function shutdown(){


console.log(
"🛑 Shutting down CineXClub Bot..."
);



try{


await pool.end();



}catch(err){}



process.exit(0);


}





process.on(
"SIGINT",
shutdown
);


process.on(
"SIGTERM",
shutdown
);






// ============================================
// FINAL START MESSAGE
// ============================================

console.log(`

====================================

🎬 CineXClub Movie Bot Started


Features:

✅ Movies

✅ Movie Collections

✅ Deadpool Style Collections

✅ Series

✅ Unlimited Seasons

✅ Unlimited Episodes

✅ Anime

✅ Send All Episodes

✅ 480p / 720p / 1080p

✅ Force Join

✅ Google Search

✅ Request Movie

✅ Contact Admin

✅ Auto Delete 10 Minutes

✅ Username Display

✅ Storage Channel Upload

✅ PostgreSQL Database

✅ Render Compatible


====================================

`);






// ============================================
// END OF CineXClub BOT
// ============================================
