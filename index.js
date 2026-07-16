// ================================
// CINEXCLUB BOT
// FINAL INDEX.JS - PART 1
// ================================

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");


// ================================
// ENV CHECK
// ================================

if(!process.env.BOT_TOKEN){
console.log("❌ BOT_TOKEN Missing");
process.exit(1);
}


// ================================
// BOT START
// ================================

const bot = new TelegramBot(
process.env.BOT_TOKEN,
{
polling:{
interval:300,
autoStart:true
}
});


// ================================
// CONFIG
// ================================

const BOT_USERNAME =
process.env.BOT_USERNAME || "CineXClubBot";


const FORCE_CHANNEL =
process.env.FORCE_CHANNEL || "";


const STORAGE_CHANNEL =
Number(process.env.STORAGE_CHANNEL_ID || 0);


const ADMIN_BOT =
process.env.ADMIN_BOT || "CineXClubAdmin";



// ================================
// POSTGRESQL
// ================================

const pool = new Pool({

connectionString:
process.env.DATABASE_URL,

ssl:{
rejectUnauthorized:false
}

});



// ================================
// KEEP ALIVE
// ================================

http.createServer(
(req,res)=>{

res.writeHead(200);

res.end(
"CineXClub Bot Running"
);

}

).listen(
process.env.PORT || 3000
);



// ================================
// DATABASE SETUP
// ================================

async function initDatabase(){

try{


await pool.query(`

CREATE TABLE IF NOT EXISTS movies(

id SERIAL PRIMARY KEY,

movie_id TEXT UNIQUE NOT NULL,

title TEXT,

year TEXT,

language TEXT,

quality TEXT,

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);

`);



await pool.query(`

CREATE TABLE IF NOT EXISTS series(

id SERIAL PRIMARY KEY,

series_id TEXT NOT NULL,

season TEXT,

episode TEXT,

title TEXT,

quality TEXT,

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);

`);


// Faster Search

await pool.query(`

CREATE INDEX IF NOT EXISTS movie_search_index

ON movies(movie_id);

`);



await pool.query(`

CREATE INDEX IF NOT EXISTS series_search_index

ON series(series_id);

`);



console.log(
"✅ Database Ready"
);



}catch(err){


console.log(
"Database Error:",
err.message
);


}

}


initDatabase();



// ================================
// FORCE JOIN CHECK
// ================================

async function isJoined(userId){


try{


if(!FORCE_CHANNEL)
return true;



let member =
await bot.getChatMember(
FORCE_CHANNEL,
userId
);



return [
"creator",
"administrator",
"member"
].includes(member.status);



}catch(err){


console.log(
"Force Join Error:",
err.message
);


return false;


}

}



// ================================
// WELCOME DASHBOARD
// ================================

function welcome(user){


return `

🎬 <b>Welcome To CineXClub</b>


👤 User:
${user.first_name}


🆔 ID:
<code>${user.id}</code>


📛 Username:
@${user.username || "None"}


━━━━━━━━━━━━━━

🍿 Movies
📺 Web Series
🎞 Premium Quality


Select your option 👇

`;

}



// ================================
// HOME BUTTONS
// ================================

function homeButtons(){


return {

inline_keyboard:[

[
{
text:"🎬 Request Movie",
url:
`https://t.me/${ADMIN_BOT}`
}
],

[
{
text:"📢 Join Channel",
url:
FORCE_CHANNEL ?
`https://t.me/${FORCE_CHANNEL.replace("@","")}`:
"https://t.me/"
}
]

]

};

}



console.log(
"✅ Part 1 Loaded"
);
// ================================
// FINAL INDEX.JS - PART 2
// UPLOAD SYSTEM
// ================================


// ================================
// SAVE MOVIE
// ================================

async function saveMovie(data){

try{


await pool.query(

`

INSERT INTO movies

(
movie_id,
title,
year,
language,
quality,
file_id
)

VALUES($1,$2,$3,$4,$5,$6)

ON CONFLICT(movie_id)

DO UPDATE SET

file_id=$6,
quality=$5

`,

[
data.movie_id,
data.title,
data.year,
data.language,
data.quality,
data.file_id
]

);


return true;


}catch(err){


console.log(
"Save Movie Error:",
err.message
);


return false;


}

}




// ================================
// SAVE SERIES EPISODE
// ================================

async function saveSeries(data){

try{


await pool.query(

`

INSERT INTO series

(
series_id,
season,
episode,
title,
quality,
file_id
)

VALUES($1,$2,$3,$4,$5,$6)

`

,

[
data.series_id,
data.season,
data.episode,
data.title,
data.quality,
data.file_id
]

);


return true;



}catch(err){


console.log(
"Save Series Error:",
err.message
);


return false;


}

}





// ================================
// BOT LINK
// ================================

function createBotLink(id){

return `https://t.me/${BOT_USERNAME}?start=${id}`;

}




// ================================
// STORAGE CHANNEL UPLOAD
// ================================


bot.on(
"channel_post",
async(msg)=>{


try{


if(
msg.chat.id !== STORAGE_CHANNEL
)
return;



if(!msg.video)
return;



let caption =
msg.caption || "";



if(!caption)
return;



let lines =
caption.split("\n");



let title =
lines[0].trim();



let movieId =
title
.replace(/\s+/g,"")
.toLowerCase();



// QUALITY

let quality =
caption.match(
/(480p|720p|1080p)/i
);


quality =
quality ?
quality[1]:
"720p";



// YEAR

let year =
caption.match(
/\b(19|20)\d{2}\b/
);



year =
year ?
year[0]:
"";





// ================================
// SERIES DETECT
// ================================


let isSeries =

/s\d+/i.test(caption)

||

/ep\d+/i.test(caption)

||

/episode/i.test(caption);





if(isSeries){



let season =
caption.match(
/s\d+/i
);



let episode =
caption.match(
/ep\d+/i
);



await saveSeries({

series_id:
movieId,


season:
season ?
season[0].toUpperCase():
"S01",


episode:
episode ?
episode[0].toUpperCase():
"EP01",


title:title,


quality:quality,


file_id:
msg.video.file_id

});



await bot.sendMessage(

msg.chat.id,

`

✅ Series Episode Saved


🆔 ID:
${movieId}


🎞 Quality:
${quality}


🔗 Link:
${createBotLink(movieId)}

`

);



}

else{



await saveMovie({

movie_id:
movieId,


title:title,


year:year,


language:
"Unknown",


quality:quality,


file_id:
msg.video.file_id


});



await bot.sendMessage(

msg.chat.id,

`

✅ Movie Saved


🎬 Title:
${title}


🆔 ID:
${movieId}


🎞 Quality:
${quality}


🔗 Link:
${createBotLink(movieId)}

`

);



}



}catch(err){


console.log(
"Upload Error:",
err.message
);


}



});
// ================================
// FINAL INDEX.JS - PART 3
// START SYSTEM
// ================================


// ================================
// GET MOVIE
// ================================

async function getMovie(id){

try{


let result =
await pool.query(

`
SELECT *
FROM movies
WHERE movie_id=$1
LIMIT 1
`

,
[
id.toLowerCase()
]

);


return result.rows[0] || null;



}catch(err){

console.log(
"Get Movie Error:",
err.message
);

return null;

}

}



// ================================
// GET SERIES
// ================================

async function getSeries(id){

try{


let result =
await pool.query(

`
SELECT *
FROM series
WHERE series_id=$1
ORDER BY id ASC
`

,
[
id.toLowerCase()
]

);


return result.rows;



}catch(err){

console.log(
"Get Series Error:",
err.message
);

return [];

}

}




// ================================
// PREMIUM CAPTION
// ================================

function premiumCaption(movie){


return `

🎬 <b>${movie.title}</b>


━━━━━━━━━━━━━━

📅 Year :
${movie.year || "N/A"}


🎞 Quality :
${movie.quality || "720p"}


🌐 Language :
${movie.language || "Unknown"}


━━━━━━━━━━━━━━

⚡ Powered By CineXClub

`;

}




// ================================
// FETCHING
// ================================

async function fetching(chatId){


let msg =
await bot.sendMessage(

chatId,

"⏳ Fetching your file..."

);


setTimeout(()=>{

bot.editMessageText(

"🎬 Preparing your movie...",

{

chat_id:chatId,

message_id:
msg.message_id

}

).catch(()=>{});


},1500);



return msg;

}




// ================================
// SEND VIDEO
// AUTO DELETE 10 MIN
// ================================

async function sendVideoSafe(
chatId,
fileId,
caption
){


try{


let msg =
await bot.sendVideo(

chatId,

fileId,

{

caption:caption,

parse_mode:"HTML"

}

);



// DELETE AFTER 10 MINUTES

setTimeout(async()=>{


try{


await bot.deleteMessage(

chatId,

msg.message_id

);


console.log(
"✅ Deleted after 10 minutes"
);


}catch(e){}


},600000);



}catch(err){


console.log(
"Send Video Error:",
err.message
);


}



}





// ================================
// /START
// ================================


bot.onText(

/\/start(?:\s+(.+))?/,

async(msg,match)=>{


let chatId =
msg.chat.id;


let user =
msg.from;



try{


// NORMAL START


if(!match[1]){


await bot.sendMessage(

chatId,

welcome(user),

{

parse_mode:"HTML",

reply_markup:
homeButtons()

}

);


return;

}



// FORCE JOIN


let joined =
await isJoined(user.id);



if(!joined){


await bot.sendMessage(

chatId,

`
⚠️ Join our channel first

Then press /start again
`

,

{

reply_markup:{

inline_keyboard:[

[

{

text:"📢 Join Channel",

url:
`https://t.me/${FORCE_CHANNEL.replace("@","")}`

}

]

]

}

}

);


return;

}




let id =
match[1]
.trim()
.toLowerCase();



// FETCHING MESSAGE


let loading =
await fetching(chatId);




// MOVIE


let movie =
await getMovie(id);



if(movie){



await bot.deleteMessage(

chatId,

loading.message_id

).catch(()=>{});



await sendVideoSafe(

chatId,

movie.file_id,

premiumCaption(movie)

);



return;

}





// SERIES


let episodes =
await getSeries(id);



if(episodes.length){



let buttons=[];



episodes.forEach(ep=>{


buttons.push([

{

text:
`${ep.episode} - ${ep.quality}`,

callback_data:
"episode_"+ep.id

}

]);



});



await bot.sendMessage(

chatId,

`

📺 <b>${episodes[0].title}</b>


Select Episode 👇

`

,

{

parse_mode:"HTML",

reply_markup:{

inline_keyboard:
buttons

}

}

);



return;

}





// NOT FOUND


await bot.sendMessage(

chatId,

`

❌ Video not in our database

`

);



}catch(err){



console.log(

"Start Error:",

err.message

);



await bot.sendMessage(

chatId,

"❌ Something went wrong. Try again later."

);



}


});
// ================================
// FINAL INDEX.JS - PART 4
// CALLBACK + BUTTONS
// ================================


// ================================
// GOOGLE SEARCH BUTTON
// ================================

function googleButton(query){

return {

inline_keyboard:[

[
{
text:"🔎 Google Search",
url:
`https://www.google.com/search?q=${encodeURIComponent(query)}`
}

]

]

};

}



// ================================
// REQUEST BUTTON
// ================================

function requestButton(){

return {

inline_keyboard:[

[
{
text:"🎬 Request Movie",
url:
`https://t.me/${ADMIN_BOT}`
}

]

]

};

}




// ================================
// EPISODE CALLBACK
// ================================

bot.on(
"callback_query",
async(query)=>{


try{


let data =
query.data;


let chatId =
query.message.chat.id;



// EPISODE


if(
data.startsWith("episode_")
){


let id =
data.replace(
"episode_",
""
);



let result =
await pool.query(

`
SELECT *
FROM series
WHERE id=$1
LIMIT 1
`

,

[
id
]

);



if(result.rows.length){


let ep =
result.rows[0];



await sendVideoSafe(

chatId,

ep.file_id,

`

📺 <b>${ep.title}</b>


🎞 Episode:
${ep.episode}


🎬 Quality:
${ep.quality}


━━━━━━━━━━━━━━

⚡ CineXClub

`

);



}



await bot.answerCallbackQuery(
query.id
);



return;

}




// CHECK BUTTON


if(
data==="check_join"
){


let ok =
await isJoined(
query.from.id
);



await bot.answerCallbackQuery(

query.id,

{

text:
ok ?
"✅ Joined":
"❌ Join Channel First",

show_alert:true

}

);


return;

}



}catch(err){


console.log(

"Callback Error:",

err.message

);


}


});





// ================================
// POLLING ERROR
// ================================

bot.on(
"polling_error",
(error)=>{


console.log(

"Polling Error:",

error.message

);


});





// ================================
// UNHANDLED ERRORS
// ================================

process.on(
"unhandledRejection",
(err)=>{


console.log(

"Unhandled Error:",

err.message

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





// ================================
// KEEP ALIVE LOG
// ================================

setInterval(()=>{


console.log(

"🟢 CineXClub Bot Alive",

new Date()

);


},300000);





console.log(
"✅ Final Part Loaded"
);
