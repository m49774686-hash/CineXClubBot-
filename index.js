require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");


// ================================
// BOT START
// ================================

const bot = new TelegramBot(
  process.env.BOT_TOKEN,
  {
    polling: {
      interval: 300,
      autoStart: true
    }
  }
);


// ================================
// SETTINGS
// ================================

const FORCE_CHANNEL = "@CineXClub";

const STORAGE_CHANNEL = "-1004426096451";

const BOT_USERNAME = "CineXClubBot";

const ADMIN_LINK =
"https://t.me/CineXClubBot_Adminbot";

const AUTO_DELETE_TIME =
30 * 60 * 1000;


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
// DATABASE SETUP
// ================================

async function createTable(){

try{

await pool.query(`

CREATE TABLE IF NOT EXISTS videos (

id SERIAL PRIMARY KEY,

type TEXT NOT NULL DEFAULT 'movie',

movie_id TEXT UNIQUE,

series_id TEXT,

season TEXT,

episode TEXT,

title TEXT,

year TEXT,

quality TEXT,

audio TEXT,

size TEXT,

language TEXT,

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

`);

console.log(
"✅ Database Ready"
);


}

catch(err){

console.log(
"❌ Database Setup Error"
);

console.log(err);

}

}


pool.connect()

.then(client=>{

console.log(
"✅ PostgreSQL Connected"
);

client.release();

createTable();

})

.catch(err=>{

console.log(
"❌ PostgreSQL Connection Failed"
);

console.log(err);

});


// ================================
// WELCOME MESSAGE
// ================================

const WELCOME_TEXT = `

🎬 Welcome To CineXClub

━━━━━━━━━━━━━━

🍿 Movies & Series

⚡ Fast Download
🔊 Multi Audio Support
📂 High Quality Files
⏳ Auto Delete System

━━━━━━━━━━━━━━

👇 Join Channel First

`;


// ================================
// KEEP ALIVE SERVER
// ================================

const PORT =
process.env.PORT || 10000;


http.createServer(

(req,res)=>{

res.writeHead(

200,

{
"Content-Type":"text/plain"
}

);

res.end(
"✅ CineXClub Bot Running"
);

}

).listen(

PORT,

()=>{

console.log(
"🌐 Server Running:",
PORT
);

}

);


// ================================
// START LOG
// ================================

console.clear();


console.log(`

╔══════════════════════╗
║   🎬 CineXClub Bot   ║
║      Started ✅      ║
╚══════════════════════╝

`);


console.log(
"🤖 Bot:",
BOT_USERNAME
);

console.log(
"🚀 Bot Ready..."
);
// ================================
// SAVE MOVIE
// ================================

async function saveMovie(data){

try{

await pool.query(

`
INSERT INTO videos
(
type,
movie_id,
title,
year,
quality,
audio,
size,
language,
file_id
)

VALUES
(
'movie',
$1,$2,$3,$4,$5,$6,$7,$8
)

ON CONFLICT(movie_id)
DO UPDATE SET

file_id=$8

`,

[
data.movie_id,
data.title,
data.year,
data.quality,
data.audio,
data.size,
data.language,
data.file_id
]

);


console.log(
"✅ Movie Saved:",
data.movie_id
);


}

catch(err){

console.log(
"❌ Movie Save Error"
);

console.log(err);

}

}



// ================================
// SAVE SERIES EPISODE
// ================================

async function saveEpisode(data){

try{

await pool.query(

`

INSERT INTO videos

(
type,
series_id,
season,
episode,
title,
quality,
audio,
size,
language,
file_id
)

VALUES

(
'series',
$1,$2,$3,$4,$5,$6,$7,$8,$9
)

`

,

[

data.series_id,

data.season,

data.episode,

data.title,

data.quality,

data.audio,

data.size,

data.language,

data.file_id

]

);


console.log(

"✅ Episode Saved:",
data.series_id,
data.episode

);


}

catch(err){

console.log(
"❌ Episode Save Error"
);

console.log(err);

}

}



// ================================
// METADATA PARSER
// ================================

function getMeta(text){


let data={

title:"",
year:"",
quality:"",
audio:"",
size:"",
language:""

};


// YEAR

let year =
text.match(/\b(19|20)\d{2}\b/);

if(year)
data.year=year[0];


// QUALITY

if(/1080p/i.test(text))
data.quality="1080p";

else if(/720p/i.test(text))
data.quality="720p";

else if(/480p/i.test(text))
data.quality="480p";


// AUDIO

if(/Hindi/i.test(text))
data.audio="Hindi";

else if(/Telugu/i.test(text))
data.audio="Telugu";

else if(/Tamil/i.test(text))
data.audio="Tamil";

else
data.audio="Multi Audio";


// SIZE

let size =
text.match(/\d+(\.\d+)?\s?(GB|MB)/i);

if(size)
data.size=size[0];


// LANGUAGE

data.language=data.audio;


return data;

}



// ================================
// STORAGE CHANNEL UPLOAD
// ================================

bot.on(

"channel_post",

async(msg)=>{


if(

msg.chat.id.toString()
!== STORAGE_CHANNEL

)
return;


if(
!msg.video &&
!msg.document
)
return;


if(!msg.caption){

console.log(
"❌ Caption Missing"
);

return;

}



const file_id =

msg.video
?
msg.video.file_id
:
msg.document.file_id;



const caption =
msg.caption.trim();



let meta =
getMeta(caption);



// ================================
// SERIES UPLOAD
// ================================


if(

/SeriesID:/i.test(caption)

&&

/Episode:/i.test(caption)

){


let series_id =

caption.match(

/SeriesID:\s*(.+)/i

)[1].trim();



let episode =

caption.match(

/Episode:\s*(.+)/i

)[1].trim();



let season="S01";

if(/Season:/i.test(caption)){

season=

caption.match(

/Season:\s*(.+)/i

)[1].trim();

}



await saveEpisode({

series_id:
series_id.toLowerCase(),

season,

episode,

title:
meta.title,

quality:
meta.quality,

audio:
meta.audio,

size:
meta.size,

language:
meta.language,

file_id

});




  const seriesLink =
`https://t.me/${BOT_USERNAME}?start=${series_id.toLowerCase()}`;


await bot.sendMessage(

msg.chat.id,

`✅ Episode Saved Successfully

📺 Series:
${series_id}

🎬 Episode:
${episode}

🔗 Series Link:

${seriesLink}

`

);


return;

}



// ================================
// MOVIE UPLOAD
// ================================


let movie_id;


if(/MovieID:/i.test(caption)){


movie_id=

caption.match(

/MovieID:\s*(.+)/i

)[1];


}

else{

movie_id=caption;

}



movie_id=

movie_id
.replace(/\s+/g,"")
.toLowerCase();



await saveMovie({

movie_id,

title:
meta.title,

year:
meta.year,

quality:
meta.quality,

audio:
meta.audio,

size:
meta.size,

language:
meta.language,

file_id

});



await bot.sendMessage(

msg.chat.id,

`✅ Movie Saved Successfully

🎬 ID:
${movie_id}

🔗 Link:

https://t.me/${BOT_USERNAME}?start=${movie_id}

`

);


});
// ================================
// FORCE JOIN CHECK
// ================================

async function checkJoin(userId){

try{

const member = await bot.getChatMember(
FORCE_CHANNEL,
userId
);


return (

member.status === "member" ||

member.status === "administrator" ||

member.status === "creator"

);


}

catch(err){

console.log(
"Join Check Error:",
err.message
);

return false;

}

}



// ================================
// GET MOVIE
// ================================

async function getMovie(id){

try{

const result = await pool.query(

`

SELECT *

FROM videos

WHERE type='movie'

AND LOWER(movie_id)=$1

`,

[
id.toLowerCase()
]

);


return result.rows[0] || null;


}

catch(err){

console.log(err);

return null;

}

}



// ================================
// GET SERIES
// ================================

async function getSeries(id){

try{

const result = await pool.query(

`

SELECT *

FROM videos

WHERE type='series'

AND LOWER(series_id)=$1

ORDER BY id ASC

`,

[
id.toLowerCase()
]

);


return result.rows;


}

catch(err){

console.log(err);

return [];

}

}




// ================================
// START COMMAND
// ================================


bot.onText(

/\/start(?:\s+(.+))?/,

async(msg,match)=>{


const chatId =
msg.chat.id;


const id =

(match[1] || "")
.trim()
.toLowerCase();



// FIRST OPEN

if(!id){


return bot.sendMessage(

chatId,

WELCOME_TEXT,

{

reply_markup:{

inline_keyboard:[


[

{

text:"📢 Join Channel",

url:"https://t.me/CineXClub"

}

]


]

}

}

);


}



// FORCE JOIN


const joined =
await checkJoin(chatId);



if(!joined){


return bot.sendMessage(

chatId,


"⚠️ Please join our channel first.",


{

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

text:"✅ I've Joined",

callback_data:`verify_${id}`

}

]


]

}

}

);


}



sendRequest(
chatId,
id
);



});





// ================================
// REQUEST HANDLER
// ================================


async function sendRequest(chatId,id){


// MOVIE CHECK

const movie =
await getMovie(id);



if(movie){


return showMovieInfo(
chatId,
movie
);


}



// SERIES CHECK


const episodes =
await getSeries(id);



if(episodes.length){


let buttons = episodes.map(ep=>{


return [

{

text:`📺 ${ep.episode}`,

callback_data:`episode_${ep.id}`

}

];


});



return bot.sendMessage(

chatId,


`🎬 Series Available

👇 Select Episode`,


{

reply_markup:{

inline_keyboard:buttons

}

}

);


}



// NOT FOUND


return bot.sendMessage(

chatId,


"❌ Video not found in our database.",


{

reply_markup:{

inline_keyboard:[


[

{

text:"🔎 Search Google",

url:
`https://www.google.com/search?q=${encodeURIComponent(id+" movie")}`

}

],


[

{

text:"🎁 Request Movie",

url:ADMIN_LINK

}

]


]

}

}

);


}




// ================================
// MOVIE PREMIUM INFO
// ================================


async function showMovieInfo(chatId,movie){


await bot.sendMessage(

chatId,


`🎬 ${movie.title || movie.movie_id}


━━━━━━━━━━━━━━

📅 Year:
${movie.year || "N/A"}

🎥 Quality:
${movie.quality || "HD"}

🔊 Audio:
${movie.audio || "Multi Audio"}

📁 Size:
${movie.size || "Unknown"}

━━━━━━━━━━━━━━

⏳ Preparing your file...

`);


setTimeout(()=>{


sendFile(

chatId,

movie.file_id,

movie.title || movie.movie_id

);


},2000);



}



// ================================
// CALLBACK HANDLER
// ================================


bot.on(

"callback_query",

async(query)=>{


const data =
query.data;



// VERIFY JOIN


if(data.startsWith("verify_")){


const id =
data.replace(
"verify_",
""
);



const joined =
await checkJoin(
query.message.chat.id
);



if(!joined){


return bot.answerCallbackQuery(

query.id,

{

text:"❌ Join Channel First",

show_alert:true

}

);

}



await bot.answerCallbackQuery(
query.id
);



return sendRequest(

query.message.chat.id,

id

);


}




// EPISODE BUTTON


if(data.startsWith("episode_")){


const id =

data.replace(
"episode_",
""
);



const result =
await pool.query(

`

SELECT *

FROM videos

WHERE id=$1

`,

[id]

);



if(!result.rows[0]){


return bot.answerCallbackQuery(

query.id,

{

text:"❌ File not found",

show_alert:true

}

);


}



await bot.answerCallbackQuery(
query.id
);



return sendFile(

query.message.chat.id,

result.rows[0].file_id,

result.rows[0].episode

);


}


});
// ================================
// SEND FILE
// ================================

async function sendFile(chatId,fileId,name){

try{


console.log(
"📤 Sending File:",
fileId
);



const sent = await bot.sendDocument(

chatId,

fileId,

{

caption:

`╭━━━🎬 CineXClub ━━━╮

🔥 Your File Is Ready

🎞️ Title:
${name}

📂 Format:
MKV

🔊 Audio:
Multi Audio

⚡ Speed:
High Speed Download

⏳ Auto Delete:
30 Minutes

╰━━━━━━━━━━━━━━╯

🍿 Enjoy Your Movie

🤖 @${BOT_USERNAME}`


}

);



console.log(
"✅ File Sent"
);



// ================================
// AUTO DELETE
// ================================


setTimeout(async()=>{


try{


await bot.deleteMessage(

chatId,

sent.message_id

);


console.log(
"🗑️ File Deleted"
);



}

catch(err){


console.log(

"Delete Error:",

err.message

);


}



},AUTO_DELETE_TIME);



}


catch(err){


console.log(
"❌ File Send Error"
);


console.log(
err.response?.body ||
err.message
);



await bot.sendMessage(

chatId,


`❌ Unable to send file.

Please contact Admin.`

);



}



}





// ================================
// ERROR HANDLING
// ================================


bot.on(

"polling_error",

(err)=>{


console.log(

"❌ Polling Error:",

err.message

);


});





process.on(

"uncaughtException",

(err)=>{


console.log(

"❌ Uncaught Exception"

);


console.log(err);


});





process.on(

"unhandledRejection",

(err)=>{


console.log(

"❌ Unhandled Rejection"

);


console.log(err);


});





// ================================
// BOT START MESSAGE
// ================================


console.log(`


╔════════════════════════════╗
║     🎬 CineXClub Bot       ║
║        Started ✅          ║
╚════════════════════════════╝


`);

console.log(

"🤖 Bot:",

BOT_USERNAME

);


console.log(

"🚀 CineXClub Ready..."

);
