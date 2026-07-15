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
    polling:{
      interval:300,
      autoStart:true
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
"https://t.me/CineXClub_AdminBot";

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
// DATABASE CONNECT
// ================================

pool.connect()

.then(client=>{

console.log("✅ PostgreSQL Connected");

client.release();

createTable();

})

.catch(err=>{

console.log("❌ PostgreSQL Error");
console.log(err);

});




// ================================
// CREATE TABLE + AUTO FIX
// ================================

async function createTable(){

try{


await pool.query(`

CREATE TABLE IF NOT EXISTS videos(

id SERIAL PRIMARY KEY,

type TEXT,

movie_id TEXT UNIQUE,

series_id TEXT,

episode TEXT,

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);

`);


// OLD DATABASE FIX

await pool.query(`

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS type TEXT;

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS series_id TEXT;

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS episode TEXT;

`);


console.log("✅ Database Ready");


}

catch(err){

console.log("❌ Database Fix Error");

console.log(err);

}

}



// ================================
// WELCOME
// ================================

const WELCOME_TEXT = `

🎬 Welcome to CineXClub Bot


⚡ Fast • Secure • Free


📥 Send your movie or series link to receive your file instantly.


🔊 Multi Audio Supported


⏳ Files are automatically deleted after 30 minutes.

`;




// ================================
// SAVE MOVIE
// ================================

async function saveMovie(movieId,fileId){

try{


await pool.query(

`

INSERT INTO videos

(type,movie_id,file_id)

VALUES

('movie',$1,$2)

ON CONFLICT(movie_id)

DO UPDATE SET file_id=EXCLUDED.file_id

`,

[
movieId.toLowerCase(),
fileId
]

);


console.log(
"✅ Movie Saved:",
movieId
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

async function saveEpisode(seriesId,episode,fileId){

try{


await pool.query(

`

INSERT INTO videos

(type,series_id,episode,file_id)

VALUES

('series',$1,$2,$3)

`,

[

seriesId.toLowerCase(),

episode.toUpperCase(),

fileId

]

);


console.log(
"✅ Episode Saved:",
seriesId,
episode
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
// STORAGE CHANNEL HANDLER
// ================================

bot.on(
"channel_post",
async(msg)=>{


if(
msg.chat.id.toString() !== STORAGE_CHANNEL
)
return;



if(
!msg.video &&
!msg.document
)
return;



if(!msg.caption){

console.log("❌ Caption Missing");

return;

}


// ================================
// MULTI AUDIO MKV
// IMPORTANT:
// Upload MKV as DOCUMENT
// ================================


let fileId;


if(msg.document){

fileId = msg.document.file_id;

}

else{

fileId = msg.video.file_id;

}



console.log("📥 File Received");

console.log("File ID:",fileId);



const text =
msg.caption.trim();




// ================================
// SERIES UPLOAD FORMAT
//
// SeriesID: strangerthings_s01
// Episode: E01
//
// ================================


if(
/SeriesID:/i.test(text)
&&
/Episode:/i.test(text)
){


const seriesId =

text
.match(/SeriesID:\s*(.+)/i)[1]
.trim();


const episode =

text
.match(/Episode:\s*(.+)/i)[1]
.trim();



await saveEpisode(

seriesId,

episode,

fileId

);



const link =

`https://t.me/${BOT_USERNAME}?start=${seriesId.toLowerCase()}`;



await bot.sendMessage(

msg.chat.id,


`✅ Episode Saved Successfully


🎬 Series:
${seriesId}


📺 Episode:
${episode}


🔗 Series Link:

${link}`

);



return;


}




// ================================
// MOVIE UPLOAD FORMAT
//
// MovieID: ironman1
//
// ================================


let movieId;


const match =

text.match(/MovieID:\s*(.+)/i);



if(match){

movieId =
match[1];

}

else{

movieId =
text;

}



movieId =

movieId
.trim()
.replace(/\s+/g,"")
.toLowerCase();



await saveMovie(

movieId,

fileId

);



const link =

`https://t.me/${BOT_USERNAME}?start=${movieId}`;



await bot.sendMessage(

msg.chat.id,


`✅ File Saved Successfully


🎬 Movie ID:

${movieId}


🔗 Link:

${link}`

);



});
// ================================
// FORCE JOIN CHECK
// ================================

async function checkJoin(userId){

try{


const member =

await bot.getChatMember(
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
"Join Error:",
err.message
);

return false;

}

}




// ================================
// GET MOVIE
// ================================

async function getMovie(movieId){

const result =

await pool.query(

`

SELECT *

FROM videos

WHERE type='movie'

AND LOWER(movie_id)=$1

`,

[
movieId.toLowerCase()
]

);


return result.rows[0] || null;

}




// ================================
// GET SERIES
// ================================

async function getSeries(seriesId){

const result =

await pool.query(

`

SELECT *

FROM videos

WHERE type='series'

AND LOWER(series_id)=$1

ORDER BY id ASC

`,

[
seriesId.toLowerCase()
]

);


return result.rows;

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




// WELCOME

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





console.log(
"🎬 Requested:",
id
);





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




await sendRequest(

chatId,

id

);


});






// ================================
// CALLBACK HANDLER
// ================================

bot.on(

"callback_query",

async(query)=>{


const data =
query.data;



// VERIFY BUTTON

if(
data.startsWith("verify_")
){


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


if(

data.startsWith("episode_")

){


const episodeId =

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

[
episodeId
]

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
// REQUEST HANDLER
// ================================

async function sendRequest(chatId,id){



// MOVIE CHECK

const movie =

await getMovie(id);



if(movie){

return sendFile(

chatId,

movie.file_id,

id

);

}





// SERIES CHECK

const episodes =

await getSeries(id);



if(episodes.length){


const buttons =

episodes.map(ep=>[

{

text:`📺 ${ep.episode}`,

callback_data:`episode_${ep.id}`

}

]);



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


"❌ Movie not found in our database.",


{

reply_markup:{

inline_keyboard:[


[

{

text:"🔎 Search on Google",

url:

`https://www.google.com/search?q=${encodeURIComponent(id+" movie")}`

}

],



[

{

text:"👨‍💻 Admin Bot",

url:ADMIN_LINK

}

]


]

}

}

);


}





// ================================
// SEND FILE
// ================================

async function sendFile(chatId,fileId,name){

try{


console.log("📤 Sending File");

console.log(fileId);



const sent =

await bot.sendDocument(

chatId,

{

document:fileId

},


{

caption:

`╭━━━━━━━━━━━━━━╮
🎬 CineXClub
╰━━━━━━━━━━━━━━╯


✅ ${name}


📁 Original MKV File

🔊 Multi Audio Supported


⏳ Auto Delete: 30 Minutes


🤖 @${BOT_USERNAME}`

}

);



console.log(
"✅ File Sent Successfully"
);





// AUTO DELETE

setTimeout(

async()=>{


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



},

AUTO_DELETE_TIME

);



}



catch(err){


console.log(
"❌ Send File Error"
);

console.log(err);



await bot.sendMessage(

chatId,

"❌ Unable to send file.\nPlease contact Admin."

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
// RENDER KEEP ALIVE
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

)

.listen(

PORT,

()=>{

console.log(
`🌐 Server Running On Port ${PORT}`
);

}

);





// ================================
// BOT STARTED
// ================================

console.clear();


console.log(`

╔══════════════════════════════╗
║        🎬 CineXClub Bot      ║
║          Started ✅          ║
╚══════════════════════════════╝

`);


console.log(
"🤖 Bot Username:",
BOT_USERNAME
);


console.log(
"📢 Force Channel:",
FORCE_CHANNEL
);


console.log(
"💾 Storage Channel:",
STORAGE_CHANNEL
);


console.log(
"⏱️ Auto Delete:",
AUTO_DELETE_TIME / 60000,
"Minutes"
);


console.log(
"🗄️ Database:",
process.env.DATABASE_URL
?
"Configured ✅"
:
"Missing ❌"
);


console.log(
"🚀 Bot Ready..."
);
