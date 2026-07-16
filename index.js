// ================================
// CINEXCLUB BOT
// FINAL REPLACE INDEX.JS - PART 1
// ================================

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");


// ================================
// ENV
// ================================

const BOT_TOKEN = process.env.BOT_TOKEN;

if(!BOT_TOKEN){

console.log("❌ BOT_TOKEN Missing");
process.exit(1);

}


const BOT_USERNAME =
process.env.BOT_USERNAME || "CineXClubBot";


const FORCE_CHANNEL =
process.env.FORCE_CHANNEL || "";


const STORAGE_CHANNEL =
Number(process.env.STORAGE_CHANNEL_ID || 0);


const ADMIN_BOT =
process.env.ADMIN_BOT || "CineXClubAdmin";



// ================================
// BOT
// ================================

const bot = new TelegramBot(
BOT_TOKEN,
{
polling:{
interval:300,
autoStart:true
}
}
);



// ================================
// DATABASE
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
"CineXClub Running"
);

}

).listen(
process.env.PORT || 3000
);




// ================================
// DATABASE TABLES
// ================================

async function setupDatabase(){

try{


await pool.query(`

CREATE TABLE IF NOT EXISTS movies(

id SERIAL PRIMARY KEY,

movie_id TEXT NOT NULL,

title TEXT,

year TEXT,

language TEXT,

quality TEXT DEFAULT '720p',

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);

`);




await pool.query(`

CREATE TABLE IF NOT EXISTS series(

id SERIAL PRIMARY KEY,

series_id TEXT,

season TEXT,

episode TEXT,

title TEXT,

quality TEXT DEFAULT '720p',

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);

`);




await pool.query(`

CREATE INDEX IF NOT EXISTS movies_id_index

ON movies(movie_id);

`);




await pool.query(`

CREATE INDEX IF NOT EXISTS series_id_index

ON series(series_id);

`);



console.log(
"✅ Database Ready"
);



}catch(err){

console.log(
"Database Setup Error:",
err.message
);

}


}


setupDatabase();




// ================================
// FORCE JOIN
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

"member",
"administrator",
"creator"

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
// WELCOME UI
// ================================

function welcome(user){


return `

🎬 <b>Welcome To CineXClub</b>

━━━━━━━━━━━━━━

👤 User:
${user.first_name}


🆔 ID:
<code>${user.id}</code>


📛 Username:
@${user.username || "None"}


━━━━━━━━━━━━━━

🍿 Movies
📺 Series
🎞 Premium Quality


Choose an option 👇

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
`https://t.me/${FORCE_CHANNEL.replace("@","")}`
:
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
// FINAL REPLACE INDEX.JS - PART 2
// STORAGE UPLOAD SYSTEM
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

`

,

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
// SAVE SERIES
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
// STORAGE CHANNEL
// FILE UPLOAD
// ================================


bot.on(
"channel_post",
async(msg)=>{


try{


console.log(
"📩 CHANNEL POST:",
msg.chat.id
);



if(
Number(msg.chat.id)
!== Number(STORAGE_CHANNEL)
){

return;

}




// DOCUMENT / VIDEO SUPPORT

let fileId = null;


if(msg.document){

fileId =
msg.document.file_id;


}

else if(msg.video){

fileId =
msg.video.file_id;


}

else{


console.log(
"❌ No File"
);

return;


}




let caption =
msg.caption || "";



if(!caption){

console.log(
"❌ Caption Missing"
);

return;

}




let title =
caption
.split("\n")[0]
.trim();




let movieId =
title
.replace(/\s+/g,"")
.toLowerCase();




// DEFAULT QUALITY

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
/(19|20)\d{2}/
);


year =
year ?
year[0]:
"";





// SERIES CHECK


let seriesCheck =

/s\d+/i.test(caption)

||

/ep\d+/i.test(caption)

||

/episode/i.test(caption);






if(seriesCheck){



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
season[0].toUpperCase()
:
"S01",


episode:
episode ?
episode[0].toUpperCase()
:
"EP01",


title:title,


quality:"720p",


file_id:fileId

});



await bot.sendMessage(

msg.chat.id,

`

✅ Series Saved


🆔 ID:
${movieId}


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


quality:"720p",


file_id:fileId


});





await bot.sendMessage(

msg.chat.id,

`

✅ Movie Saved


🎬 Title:
${title}


🆔 ID:
${movieId}


📅 Year:
${year || "N/A"}


🎞 Quality:
720p


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




console.log(
"✅ Part 2 Loaded"
);
// ================================
// FINAL REPLACE INDEX.JS - PART 3
// USER SYSTEM
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
// GET 720p FILE
// ================================

async function get720File(id){

try{


let result =
await pool.query(

`
SELECT *
FROM movies
WHERE movie_id=$1
AND quality='720p'
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
"720 File Error:",
err.message
);


return null;


}

}




// ================================
// MOVIE CAPTION
// ================================

function movieCaption(movie){


return `

🎬 <b>${movie.title}</b>

━━━━━━━━━━━━━━

📅 Year:
${movie.year || "N/A"}


🎞 Quality:
720p


🌐 Language:
${movie.language || "Unknown"}


━━━━━━━━━━━━━━

⚡ Powered By CineXClub

`;

}





// ================================
// YEAR BUTTONS
// ================================

function yearButtons(id){


return {

inline_keyboard:[

[
{
text:"📅 2025",
callback_data:`year_${id}_2025`
},
{
text:"📅 2024",
callback_data:`year_${id}_2024`
}

],

[
{
text:"📅 2023",
callback_data:`year_${id}_2023`
},
{
text:"📅 2022",
callback_data:`year_${id}_2022`
}

]

]

};

}




// ================================
// QUALITY BUTTONS
// ================================

function qualityButtons(id){


return {

inline_keyboard:[

[

{
text:"🎞 480p",
callback_data:`quality_${id}`
},

{
text:"🎞 720p",
callback_data:`quality_${id}`
},

{
text:"🎞 1080p",
callback_data:`quality_${id}`
}

]

]

};

}




// ================================
// SEND FILE
// AUTO DELETE 10 MIN
// ================================

async function sendFile(
chatId,
movie
){


try{


let msg =
await bot.sendDocument(

chatId,

movie.file_id,

{

caption:
movieCaption(movie),

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
"Send File Error:",
err.message
);


}


}





// ================================
// START COMMAND
// ================================

bot.onText(

/\/start(?:\s+(.+))?/,

async(msg,match)=>{


try{


let chatId =
msg.chat.id;


let user =
msg.from;



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
await isJoined(
user.id
);



if(!joined){


await bot.sendMessage(

chatId,

"⚠️ Please join our channel first"

);


return;

}




let id =
match[1]
.trim()
.toLowerCase();




// MOVIE CHECK


let movie =
await getMovie(id);



if(!movie){


await bot.sendMessage(

chatId,

"❌ Video not in our database"

);


return;

}





await bot.sendMessage(

chatId,

`

🎬 <b>${movie.title}</b>


Select Year 👇

`

,

{

parse_mode:"HTML",

reply_markup:
yearButtons(id)

}

);




}catch(err){


console.log(
"START ERROR:",
err.message
);


await bot.sendMessage(

msg.chat.id,

"❌ Something went wrong"

);


}


});





console.log(
"✅ Part 3 Loaded"
);
// ================================
// FINAL REPLACE INDEX.JS - PART 4
// CALLBACK + FINAL SYSTEM
// ================================


// ================================
// GOOGLE BUTTON
// ================================

function googleSearchButton(id){

return {

inline_keyboard:[

[
{
text:"🔎 Google Search",
url:
`https://www.google.com/search?q=${encodeURIComponent(id)}`
}

],

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
// CALLBACK HANDLER
// ================================

bot.on(
"callback_query",
async(query)=>{


try{


let data =
query.data;


let chatId =
query.message.chat.id;




// YEAR SELECT


if(
data.startsWith("year_")
){


let parts =
data.split("_");


let id =
parts[1];


let year =
parts[2];



await bot.editMessageText(

`

📅 Year Selected:
${year}


🎞 Select Quality 👇

`

,

{

chat_id:chatId,

message_id:
query.message.message_id,

reply_markup:
qualityButtons(id)

}

);



await bot.answerCallbackQuery(
query.id
);


return;

}





// QUALITY SELECT


if(
data.startsWith("quality_")
){


let id =
data.replace(
"quality_",
""
);



// ALWAYS GET 720p

let movie =
await get720File(id);



if(!movie){


await bot.answerCallbackQuery(

query.id,

{

text:
"❌ 720p file not found",

show_alert:true

}

);


return;

}




let loading =
await bot.sendMessage(

chatId,

"⏳ Fetching your file..."

);




setTimeout(async()=>{


await bot.deleteMessage(

chatId,

loading.message_id

).catch(()=>{});



await sendFile(

chatId,

movie

);


},1500);




await bot.answerCallbackQuery(
query.id
);


return;

}





// EPISODE BUTTON

if(
data.startsWith("episode_")
){


let epId =
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

`

,

[
epId
]

);



if(result.rows.length){


let ep =
result.rows[0];


await sendFile(

chatId,

ep

);


}



await bot.answerCallbackQuery(
query.id
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
// GLOBAL ERROR
// ================================

process.on(
"unhandledRejection",
(err)=>{


console.log(
"Unhandled:",
err.message
);


});



process.on(
"uncaughtException",
(err)=>{


console.log(
"Crash:",
err.message
);


});





// ================================
// RENDER KEEP ALIVE
// ================================

setInterval(()=>{


console.log(
"🟢 CineXClub Alive",
new Date()
);


},300000);





console.log(
"🎬 CineXClub Final Loaded Successfully"
);
