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

 console.log("❌ Database Error");
 console.log(err);

});




// ================================
// CREATE TABLE
// ================================

async function createTable(){

try{


await pool.query(`

CREATE TABLE IF NOT EXISTS videos(

id SERIAL PRIMARY KEY,

type TEXT NOT NULL,

movie_id TEXT,

series_id TEXT,

episode TEXT,

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);

`);


console.log("✅ Table Ready");


}

catch(err){

console.log("❌ Table Error");
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


⏳ Files are automatically deleted after 30 minutes.

`;
// ================================
// SAVE MOVIE
// ================================

async function saveMovie(movieId, fileId){

try{

await pool.query(

`
INSERT INTO videos
(type,movie_id,file_id)

VALUES
('movie',$1,$2)

ON CONFLICT DO NOTHING
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

console.log("❌ Movie Save Error");
console.log(err);

}

}



// ================================
// SAVE SERIES EPISODE
// ================================

async function saveEpisode(seriesId, episode, fileId){

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

console.log("❌ Episode Save Error");
console.log(err);

}

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




// MKV MULTI AUDIO
// Upload as FILE

const fileId =

msg.document
?
msg.document.file_id
:
msg.video.file_id;



const text =
msg.caption.trim();





// ================================
// SERIES UPLOAD FORMAT
//
// SeriesID: strangerthings_s01
// Episode: E01
// ================================


if(

/SeriesID:/i.test(text)
&&
/Episode:/i.test(text)

){


const seriesId =

text
.match(/SeriesID:\s*(.+)/i)[1]
.trim()
.toLowerCase();



const episode =

text
.match(/Episode:\s*(.+)/i)[1]
.trim()
.toUpperCase();



await saveEpisode(
seriesId,
episode,
fileId
);



const link =

`https://t.me/${BOT_USERNAME}?start=${seriesId}`;



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
SELECT * FROM videos
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
// GET SERIES EPISODES
// ================================

async function getSeries(seriesId){

const result =
await pool.query(

`
SELECT * FROM videos
WHERE type='series'
AND LOWER(series_id)=$1
ORDER BY episode ASC
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


const chatId = msg.chat.id;


const id =
(match[1] || "")
.trim()
.toLowerCase();



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



await sendRequest(
chatId,
id
);


});




// ================================
// SINGLE CALLBACK HANDLER
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
text:"❌ Please join channel first",
show_alert:true
}

);

}



await bot.answerCallbackQuery(
query.id,
{
text:"✅ Verified"
}
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
SELECT * FROM videos
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
console.log("File ID:",fileId);



const sent =

await bot.sendDocument(

chatId,

fileId,

{

caption:

`╭━━━━━━━━━━━━━━╮
🎬 CineXClub
╰━━━━━━━━━━━━━━╯


✅ ${name}


📁 Original MKV File

🔊 Multi Audio Supported


⏳ Auto Delete:
30 Minutes


🤖 @${BOT_USERNAME}`

}

);



console.log(
"✅ File Sent"
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


bot.on(
"webhook_error",
(err)=>{

console.log(
"❌ Webhook Error:",
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
(reason)=>{

console.log(
"❌ Unhandled Rejection"
);

console.log(reason);

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
// BOT START LOGS
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
