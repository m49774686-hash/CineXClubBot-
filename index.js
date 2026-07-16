// ================================
// CINEXCLUB BOT
// FINAL UPDATED INDEX.JS - PART 1
// ================================

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");


// ================================
// CONFIG
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
"CineXClubBot_Adminbot";



// ================================
// BOT START
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
// DATABASE SETUP
// ================================

async function initDatabase(){

try{


await pool.query(`

CREATE TABLE IF NOT EXISTS movies(

id SERIAL PRIMARY KEY,

movie_id TEXT NOT NULL,

title TEXT,

year TEXT,

language TEXT DEFAULT 'Unknown',

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

CREATE INDEX IF NOT EXISTS movie_index

ON movies(movie_id);

`);




await pool.query(`

CREATE INDEX IF NOT EXISTS series_index

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
// WELCOME
// ================================

function welcome(user){


return `

🎬 <b>Welcome To CineXClub</b>

━━━━━━━━━━━━━━

👤 User:
${user.first_name}


📛 Username:
@${user.username || "None"}


🆔 ID:
<code>${user.id}</code>


━━━━━━━━━━━━━━

🍿 Movies
📺 Series
🎞 Premium Quality


Enjoy Watching 🎉

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
url:"https://t.me/CineXClubBot_Adminbot"
}
],

[
{
text:"📢 Join Channel",
url:"https://t.me/CineXClub"
}
]

]

};

}



console.log(
"✅ Updated Part 1 Loaded"
);
// ================================
// FINAL UPDATED INDEX.JS - PART 2
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
// CREATE BOT LINK
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


console.log(
"📩 CHANNEL:",
msg.chat.id
);



if(
Number(msg.chat.id)
!== Number(STORAGE_CHANNEL)
){

return;

}





// FILE SUPPORT

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
"❌ No File Found"
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





// TITLE FIRST LINE

let title =
caption
.split("\n")[0]
.trim();





// MOVIE ID

let movieId =
title
.replace(/\s+/g,"")
.toLowerCase();





// YEAR FROM CAPTION

let year =
caption.match(
/\b(19|20)\d{2}\b/
);


year =
year ?
year[0]
:
"";





// LANGUAGE

let language =
caption
.split("\n")
.find(x =>
x.includes("+")
)
||
"Unknown";





// QUALITY

let quality =
caption.match(
/(480p|720p|1080p)/i
);


quality =
quality ?
quality[1]
:
"720p";






// SERIES CHECK

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

series_id:movieId,


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


📺 ${title}


🆔 ID:
${movieId}


🔗 Link:

${createBotLink(movieId)}

`

);



}

else{



await saveMovie({

movie_id:movieId,


title:title,


year:year,


language:language,


quality:"720p",


file_id:fileId

});






await bot.sendMessage(

msg.chat.id,

`

✅ Movie Saved


🎬 Title:
${title}


📅 Year:
${year || "N/A"}


🎞 Quality:
720p


🆔 ID:
${movieId}


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
"✅ Updated Part 2 Loaded"
);
// ================================
// FINAL UPDATED INDEX.JS - PART 3
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
// GET FILE
// ================================

async function getFile(id){

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
"Get File Error:",
err.message
);


return null;

}

}





// ================================
// CAPTION WITH SELECTED QUALITY
// ================================

function premiumCaption(movie,selectedQuality){


return `

🎬 <b>${movie.title}</b>

━━━━━━━━━━━━━━

📅 Year:
${movie.year || "N/A"}


🎞 Quality:
${selectedQuality}


🌐 Language:
${movie.language || "Unknown"}


━━━━━━━━━━━━━━

⚡ Powered By CineXClub

`;

}





// ================================
// YEAR BUTTON
// ================================

function yearButton(id,year){


return {

inline_keyboard:[

[
{
text:`📅 ${year}`,
callback_data:`year_${id}`
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
callback_data:`quality_${id}_480p`
},

{
text:"🎞 720p",
callback_data:`quality_${id}_720p`
},

{
text:"🎞 1080p",
callback_data:`quality_${id}_1080p`
}

]

]

};

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
await isJoined(user.id);



if(!joined){


await bot.sendMessage(

chatId,

"⚠️ Please Join Our Channel First"

);


return;

}





let id =
match[1]
.replace(/^movieid:/i,"")
.trim()
.toLowerCase();






let movie =
await getMovie(id);



if(!movie){


await bot.sendMessage(

chatId,

`

❌ <b>Video Not Found</b>

Select option 👇

`

,

{

parse_mode:"HTML",

reply_markup:{

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
"https://t.me/CineXClubBot_Adminbot"
}
],

[
{
text:"📢 Join Channel",
url:
"https://t.me/CineXClub"
}
]

]

}

}

);


return;

}







// SHOW UPLOADED YEAR ONLY

await bot.sendMessage(

chatId,

`

🎬 <b>${movie.title}</b>


📅 Year:

${movie.year || "N/A"}


Select Quality 👇

`

,

{

parse_mode:"HTML",

reply_markup:
qualityButtons(id)

}

);






}catch(err){


console.log(
"Start Error:",
err.message
);


await bot.sendMessage(

msg.chat.id,

"❌ Something went wrong"

);


}


});





console.log(
"✅ Updated Part 3 Loaded"
);
// ================================
// FINAL UPDATED INDEX.JS - PART 4
// CALLBACK + FINAL SYSTEM
// ================================



// ================================
// SEND FILE
// ================================

async function sendFile(chatId,movie,selectedQuality){


try{


let sent =
await bot.sendDocument(

chatId,

movie.file_id,

{

caption:
premiumCaption(movie,selectedQuality),

parse_mode:"HTML"

}

);




// AUTO DELETE 10 MINUTES

setTimeout(async()=>{


try{


await bot.deleteMessage(

chatId,

sent.message_id

);


console.log(
"✅ File Deleted After 10 Minutes"
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
// CALLBACK QUERY
// ================================

bot.on(
"callback_query",
async(query)=>{


try{


let data =
query.data;


let chatId =
query.message.chat.id;



// QUALITY SELECT


if(
data.startsWith("quality_")
){


let parts =
data.split("_");


let movieId =
parts[1];


let selectedQuality =
parts[2];





let movie =
await getFile(movieId);



if(!movie){


await bot.answerCallbackQuery(

query.id,

{

text:"❌ File Not Found",

show_alert:true

}

);


return;

}





// FETCHING

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

movie,

selectedQuality

);


},1500);





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
// RENDER KEEP ALIVE
// ================================

setInterval(()=>{


console.log(
"🟢 CineXClub Bot Alive",
new Date()
);


},300000);





console.log(
"🎬 CineXClub Final Updated Loaded Successfully"
);
