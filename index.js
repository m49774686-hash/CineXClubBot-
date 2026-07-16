// ================================
// CINEXCLUB BOT
// FINAL INDEX.JS PART 1
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
"CineXClubBot_Adminbot";



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
// POSTGRES
// ================================

const pool = new Pool({

connectionString:
process.env.DATABASE_URL,

ssl:{
rejectUnauthorized:false
}

});



// ================================
// RENDER KEEP ALIVE
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
// AUTO DELETE ALL BOT MESSAGES
// ================================

function autoDelete(chatId,messageId){

setTimeout(()=>{

bot.deleteMessage(
chatId,
messageId
)
.catch(()=>{});


},600000);

}




async function sendAuto(
chatId,
text,
options={}
){

let msg =
await bot.sendMessage(
chatId,
text,
options
);


autoDelete(
chatId,
msg.message_id
);


return msg;

}





// ================================
// DATABASE SETUP
// ================================

async function initDatabase(){

try{


await pool.query(`

CREATE TABLE IF NOT EXISTS movies(

id SERIAL PRIMARY KEY,

movie_id TEXT UNIQUE,

title TEXT,

year TEXT,

language TEXT,

quality TEXT,

file_id TEXT,

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

year TEXT,

language TEXT,

quality TEXT,

file_id TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

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


return false;

}

}





// ================================
// QUOTES
// ================================

const quotes = [

"🎬 Movies are memories forever",

"🍿 Sit back and enjoy the show",

"✨ Every story deserves to be watched",

"🎞 Welcome to entertainment world"

];



function randomQuote(){

return quotes[
Math.floor(
Math.random()*quotes.length
)
];

}





// ================================
// WELCOME
// ================================

function welcome(user){

return `

🎬 <b>Welcome To CineXClub</b>

━━━━━━━━━━━━━━

👤 User:
@${user.username || user.first_name}


${randomQuote()}

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

};

}


console.log(
"✅ Final Part 1 Loaded"
);
// ================================
// FINAL INDEX.JS PART 2
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

title=$2,
year=$3,
language=$4,
quality=$5,
file_id=$6

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
year,
language,
quality,
file_id
)

VALUES($1,$2,$3,$4,$5,$6,$7,$8)

`

,

[

data.series_id,
data.season,
data.episode,
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
Number(msg.chat.id)
!== Number(STORAGE_CHANNEL)
)
return;




// FILE CHECK

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



if(!caption)
return;



let lines =
caption
.split("\n")
.map(x=>x.trim())
.filter(Boolean);





// FIRST LINE = ID/TITLE

let movieId =
lines[0]
.replace(/\s+/g,"")
.toLowerCase();





// TITLE

let title =
lines.find(x =>
x.toLowerCase().startsWith("title:")
);


title = title
?
title.replace(/title:/i,"").trim()
:
lines[0];





// YEAR

let yearLine =
lines.find(x =>
x.toLowerCase().startsWith("year:")
);


let year =
yearLine
?
yearLine.replace(/year:/i,"").trim()
:
"";





// AUDIO / LANGUAGE

let audioLine =
lines.find(x =>
x.toLowerCase().startsWith("audio:")
);


let language =
audioLine
?
audioLine.replace(/audio:/i,"").trim()
:
"Unknown";





// QUALITY

let qualityLine =
lines.find(x =>
x.toLowerCase().startsWith("quality:")
);


let quality =
qualityLine
?
qualityLine.replace(/quality:/i,"").trim()
:
"720p";





// SERIES CHECK

let isSeries =

/s\d+/i.test(title)

||

/ep\d+/i.test(title)

||

/episode/i.test(title);







if(isSeries){


let season =
(title.match(/s\d+/i)||["S01"])[0]
.toUpperCase();



let episode =
(title.match(/ep\d+/i)||["EP01"])[0]
.toUpperCase();




await saveSeries({

series_id:movieId,

season:season,

episode:episode,

title:title,

year:year,

language:language,

quality:"720p",

file_id:fileId

});





await sendAuto(

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





await sendAuto(

msg.chat.id,

`

✅ Movie Saved


🎬 ${title}


📅 Year:
${year || "N/A"}


🌐 Language:
${language}


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
"✅ Final Part 2 Loaded"
);
// ================================
// FINAL INDEX.JS PART 3
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

`,

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

`,

[
id.toLowerCase()
]

);


return result.rows[0] || null;


}catch(err){

return null;

}

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
callback_data:
`quality_${id}_480p`
},

{
text:"🎞 720p",
callback_data:
`quality_${id}_720p`
},

{
text:"🎞 1080p",
callback_data:
`quality_${id}_1080p`
}

]

]

};

}





// ================================
// NOT FOUND BUTTONS
// ================================

function notFoundButtons(id){

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


let welcomeMsg =
await sendAuto(

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


await sendAuto(

chatId,

`

⚠️ Please Join Our Channel First

`

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


await sendAuto(

chatId,

`

❌ <b>Video Not Found</b>


This video is not available.

`

,

{

parse_mode:"HTML",

reply_markup:
notFoundButtons(id)

}

);


return;

}






await sendAuto(

chatId,

`

🎬 <b>${movie.title}</b>

━━━━━━━━━━━━━━

📅 Year:
${movie.year || "N/A"}


🌐 Language:
${movie.language || "N/A"}


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



await sendAuto(

msg.chat.id,

"❌ Something went wrong"

);


}


});





console.log(
"✅ Final Part 3 Loaded"
);
// ================================
// FINAL INDEX.JS PART 4
// CALLBACK + FINAL
// ================================



// ================================
// PREMIUM CAPTION
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
${movie.language || "N/A"}


━━━━━━━━━━━━━━

⚡ Powered By CineXClub

❓ Any Questions?
Contact Admin

`;

}




// ================================
// FILE BUTTONS
// ================================

function fileButtons(){

return {

inline_keyboard:[

[
{
text:"📢 CineXClub",
url:"https://t.me/CineXClub"
}
],

[
{
text:"👤 Contact Admin",
url:"https://t.me/CineXClubBot_Adminbot"
}
]

]

};

}




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
premiumCaption(
movie,
selectedQuality
),

parse_mode:"HTML",

reply_markup:
fileButtons()

}

);



// DELETE FILE AFTER 10 MIN

autoDelete(

chatId,

sent.message_id

);



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





let loading =
await sendAuto(

chatId,

"⏳ Fetching your file..."

);





setTimeout(async()=>{


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
// ERRORS
// ================================


bot.on(
"polling_error",
(error)=>{


console.log(
"Polling Error:",
error.message
);


});






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
"🎬 CineXClub Final Bot Loaded Successfully"
);
