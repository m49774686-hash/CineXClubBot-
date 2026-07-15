require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");

// ================================
// BOT START
// ================================

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true
  }
});


// ================================
// SETTINGS
// ================================

const FORCE_CHANNEL = "@CineXClub";
const STORAGE_CHANNEL = "-1004426096451";

const BOT_USERNAME = "CineXClubBot";

const ADMIN_LINK = "https://t.me/CineXClub_AdminBot";

const AUTO_DELETE_TIME = 30 * 60 * 1000;


// ================================
// POSTGRESQL
// ================================

const pool = new Pool({

  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false
  }

});


// ================================
// DATABASE CONNECT
// ================================

pool.connect()

.then((client)=>{

  console.log("✅ PostgreSQL Connected");

  client.release();

  createTable();

})

.catch((err)=>{

  console.log("❌ PostgreSQL Error");
  console.log(err);

});


// ================================
// CREATE TABLE
// ================================

async function createTable(){

try{


await pool.query(`

CREATE TABLE IF NOT EXISTS videos (

id SERIAL PRIMARY KEY,

type TEXT NOT NULL,

series_id TEXT,

episode TEXT,

movie_id TEXT,

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);

`);


console.log("✅ Database Table Ready");


}

catch(err){

console.log("❌ Table Error");
console.log(err);

}


}


// ================================
// WELCOME MESSAGE
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

async function saveMovie(movieId, fileId) {

  try {

    movieId = movieId.trim().toLowerCase();

    await pool.query(
      `
      INSERT INTO videos
      (type,movie_id,file_id)

      VALUES
      ('movie',$1,$2)

      ON CONFLICT DO NOTHING
      `,
      [
        movieId,
        fileId
      ]
    );


    console.log("✅ Movie Saved:", movieId);


  } catch(err){

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

`

,

[
seriesId,
episode,
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
// STORAGE CHANNEL HANDLER
// ================================

bot.on("channel_post", async (msg)=>{


if(msg.chat.id.toString() !== STORAGE_CHANNEL)
return;


if(!msg.video && !msg.document)
return;


if(!msg.caption){

console.log("❌ Caption Missing");

return;

}


// MKV FILE ID
// Document preferred for multi audio

const fileId =

msg.document
?
msg.document.file_id
:
msg.video.file_id;



let text = msg.caption.trim();



// ================================
// SERIES FORMAT
// ================================
//
// SeriesID: strangerthings_s01
// Episode: E01
//

if(
text.includes("SeriesID:") &&
text.includes("Episode:")
){


let seriesId =
text
.match(/SeriesID:\s*(.+)/i)[1]
.trim()
.toLowerCase();


let episode =
text
.match(/Episode:\s*(.+)/i)[1]
.trim()
.toUpperCase();



await saveEpisode(
seriesId,
episode,
fileId
);



let link =
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
// MOVIE FORMAT
//
// MovieID: ironman1
//

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



let botLink =
`https://t.me/${BOT_USERNAME}?start=${movieId}`;



await bot.sendMessage(

msg.chat.id,

`✅ File Saved Successfully


🎬 Movie ID:

${movieId}


🔗 Link:

${botLink}`

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

console.log("Join Error:",err.message);

return false;

}

}


// ================================
// GET MOVIE
// ================================

async function getMovie(movieId){

const result =
await pool.query(

"SELECT * FROM videos WHERE type='movie' AND LOWER(movie_id)=$1",

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



// SEND REQUEST

await sendRequest(
chatId,
id
);


});




// ================================
// VERIFY BUTTON
// ================================

bot.on(
"callback_query",
async(query)=>{


if(!query.data.startsWith("verify_"))
return;



const chatId =
query.message.chat.id;


const id =
query.data.replace(
"verify_",
""
);



const joined =
await checkJoin(chatId);



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
query.id,
{
text:"✅ Verified"
}
);


await sendRequest(
chatId,
id
);



});




// ================================
// REQUEST HANDLER
// ================================

async function sendRequest(chatId,id){



// CHECK MOVIE

const movie =
await getMovie(id);



if(movie){

return sendFile(
chatId,
movie.file_id,
id
);

}




// CHECK SERIES

const episodes =
await getSeries(id);



if(episodes.length){


let buttons=[];



episodes.forEach(ep=>{


buttons.push([

{

text:`📺 ${ep.episode}`,

callback_data:`episode_${ep.id}`

}

]);


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
// EPISODE BUTTON
// ================================

bot.on(
"callback_query",
async(query)=>{


if(!query.data.startsWith("episode_"))
return;



const id =
query.data.replace(
"episode_",
""
);



const result =
await pool.query(

"SELECT * FROM videos WHERE id=$1",

[id]

);



if(!result.rows[0])
return;



await sendFile(

query.message.chat.id,

result.rows[0].file_id,

result.rows[0].episode

);


});




// ================================
// SEND FILE
// ================================

async function sendFile(chatId,fileId,name){


try{


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

⏳ Auto Delete: 30 Minutes


🤖 @${BOT_USERNAME}`

}

);



setTimeout(async()=>{


try{

await bot.deleteMessage(
chatId,
sent.message_id
);


}

catch(e){}



},
AUTO_DELETE_TIME);



}


catch(err){

console.log("Send Error:",err);


bot.sendMessage(

chatId,

"❌ Unable to send file."

);

}


}
// ================================
// BOT EVENTS
// ================================

bot.on("polling_error", (err) => {

  console.log("❌ Polling Error:");
  console.log(err.message);

});


bot.on("webhook_error", (err) => {

  console.log("❌ Webhook Error:");
  console.log(err.message);

});


// ================================
// GLOBAL ERROR HANDLING
// ================================

process.on(
"uncaughtException",
(err)=>{

console.log("❌ Uncaught Exception");
console.log(err);

});


process.on(
"unhandledRejection",
(reason)=>{

console.log("❌ Unhandled Rejection");
console.log(reason);

});


// ================================
// KEEP RENDER ALIVE
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
"🤖 Bot Username :",
BOT_USERNAME
);


console.log(
"📢 Force Channel :",
FORCE_CHANNEL
);


console.log(
"💾 Storage Channel :",
STORAGE_CHANNEL
);


console.log(
"⏱️ Auto Delete :",
AUTO_DELETE_TIME / 60000,
"Minutes"
);


console.log(
"🗄️ Database :",
process.env.DATABASE_URL
?
"Configured ✅"
:
"Missing ❌"
);


console.log(
"🚀 Bot Ready..."
);
