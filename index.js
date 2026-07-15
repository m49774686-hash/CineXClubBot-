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
// DATABASE CONNECT
// ================================

pool.connect()

.then(client=>{

console.log("✅ PostgreSQL Connected");

client.release();

createTable();

})

.catch(err=>{

console.log("❌ PostgreSQL Connection Error");

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

type TEXT,

movie_id TEXT,

series_id TEXT,

episode TEXT,

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);

`);



await pool.query(`

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS type TEXT;

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS movie_id TEXT;

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS series_id TEXT;

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS episode TEXT;

`);


console.log("✅ Database Ready");


}

catch(err){

console.log("❌ Database Setup Error");

console.log(err);

}

}




// ================================
// WELCOME
// ================================

const WELCOME_TEXT = `

🎬 Welcome To CineXClub

━━━━━━━━━━━━━━

🍿 Unlimited Movies & Series

⚡ Fast Download
🔊 Multi Audio Support
📂 High Quality Files
⏳ Auto Delete System

━━━━━━━━━━━━━━

👇 Join Channel First

`;



// ================================
// SAVE MOVIE
// ================================

async function saveMovie(movieId,fileId){

try{


const query = `

INSERT INTO videos
(type, movie_id, file_id)

VALUES
('movie',$1,$2)

ON CONFLICT DO NOTHING

`;



await pool.query(

query,

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


const query = `

INSERT INTO videos
(type, series_id, episode, file_id)

VALUES
('series',$1,$2,$3)

`;



await pool.query(

query,

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
!msg.document &&
!msg.video
)
return;



if(!msg.caption){

console.log(
"❌ Caption Missing"
);

return;

}



// FILE ID

const fileId = msg.document
?
msg.document.file_id
:
msg.video.file_id;



const text =
msg.caption.trim();



console.log("📥 File Received");
console.log("File ID:",fileId);




// ================================
// SERIES UPLOAD
// ================================

if(

/SeriesID:/i.test(text)
&&
/Episode:/i.test(text)

){


const seriesId =

text.match(
/SeriesID:\s*(.+)/i
)[1]
.trim();



const episode =

text.match(
/Episode:\s*(.+)/i
)[1]
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
// MOVIE UPLOAD
// ================================


let movieId;


const match =

text.match(
/MovieID:\s*(.+)/i
);



movieId = match
?
match[1]
:
text;



movieId = movieId
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

try{


const result = await pool.query(

`

SELECT *

FROM videos

WHERE type='movie'

AND LOWER(TRIM(movie_id))=$1

`,

[

movieId.trim().toLowerCase()

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

async function getSeries(seriesId){

try{


const result = await pool.query(

`

SELECT *

FROM videos

WHERE type='series'

AND LOWER(TRIM(series_id))=$1

ORDER BY id ASC

`,

[

seriesId.trim().toLowerCase()

]

);



console.log(
"🔎 Series Search:",
seriesId
);


console.log(
"📺 Episodes:",
result.rows
);



return result.rows;


}

catch(err){

console.log(
"❌ Get Series Error",
err
);


return [];

}

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


const data = query.data;



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



const buttons = episodes.map(ep=>[

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


"❌ Video not found in our database.",

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


console.log(
"📤 Sending File ID:",
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

📁 Format:
MKV | Multi Audio

⚡ Quality:
High Speed Download

⏳ Auto Delete:
30 Minutes

╰━━━━━━━━━━━━━━╯

⚡ Enjoy Your Movie 🍿

🤖 @${BOT_USERNAME}`

}

);




console.log(
"✅ File Sent Successfully"
);




// AUTO DELETE AFTER 30 MIN

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
"❌ SEND FILE ERROR"
);


console.log(
err.response?.body || err.message
);



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

).listen(

PORT,

()=>{


console.log(

`🌐 Server Running On Port ${PORT}`

);


}

);






// ================================
// START LOG
// ================================

console.clear();



console.log(`

╔══════════════════════════════╗
║        🎬 CineXClub Bot      ║
║          Started ✅          ║
╚══════════════════════════════╝

`);



console.log(

"🤖 Bot:",

BOT_USERNAME

);



console.log(

"🚀 Bot Ready..."

);
