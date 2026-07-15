require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");


// ================================
// BOT
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
"https://t.me/CineXClubBot_Adminbot";

const AUTO_DELETE_TIME =
30 * 60 * 1000;



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



async function createTable(){

try{


await pool.query(`

CREATE TABLE IF NOT EXISTS videos(

id SERIAL PRIMARY KEY,

type TEXT DEFAULT 'movie',

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

file_id TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

`);


console.log("✅ Database Ready");


}
catch(err){

console.log(
"❌ Database Error",
err.message
);

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
"❌ PostgreSQL Connection Error",
err.message
);

});





// ================================
// SERVER
// ================================

const PORT =
process.env.PORT || 10000;


http.createServer((req,res)=>{

res.writeHead(200,{
"Content-Type":"text/plain"
});

res.end(
"✅ CineXClub Bot Running"
);


}).listen(PORT,()=>{

console.log(
"🌐 Server Running:",
PORT
);

});




// ================================
// SAVE MOVIE
// ================================

async function saveMovie(data){

try{


await pool.query(`

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

file_id=EXCLUDED.file_id,
title=EXCLUDED.title,
year=EXCLUDED.year,
quality=EXCLUDED.quality,
audio=EXCLUDED.audio,
size=EXCLUDED.size,
language=EXCLUDED.language

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
]);


console.log(
"✅ Movie Saved:",
data.movie_id
);


return true;


}
catch(err){

console.log(
"❌ Movie Save Error",
err.message
);

return false;

}

}



// ================================
// SAVE EPISODE
// ================================

async function saveEpisode(data){

try{


await pool.query(`

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
$1,$2,$3,$4,$5,$6,$7,$8
)

`,
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
]);


console.log(
"✅ Episode Saved:",
data.series_id,
data.episode
);


return true;


}
catch(err){

console.log(
"❌ Episode Error",
err.message
);

return false;

}

}
// ================================
// METADATA
// ================================

function getMeta(text){

let data={
year:"",
quality:"HD",
audio:"Multi Audio",
size:"",
language:"Multi Audio"
};


let year=text.match(/\b(19|20)\d{2}\b/);

if(year)
data.year=year[0];


if(/2160p/i.test(text))
data.quality="2160p";
else if(/1080p/i.test(text))
data.quality="1080p";
else if(/720p/i.test(text))
data.quality="720p";
else if(/480p/i.test(text))
data.quality="480p";


if(/Telugu/i.test(text))
data.audio="Telugu";
else if(/Hindi/i.test(text))
data.audio="Hindi";
else if(/Tamil/i.test(text))
data.audio="Tamil";
else if(/Malayalam/i.test(text))
data.audio="Malayalam";


let size=text.match(/\d+(\.\d+)?\s?(GB|MB)/i);

if(size)
data.size=size[0];

data.language=data.audio;

return data;

}



// ================================
// STORAGE CHANNEL
// ================================

bot.on("channel_post", async(msg)=>{

try{


console.log("🔥 CHANNEL POST RECEIVED");
console.log("CHANNEL ID:",msg.chat.id);



if(msg.chat.id.toString() !== STORAGE_CHANNEL)
return;



if(!msg.video && !msg.document)
return;



if(!msg.caption){

console.log("❌ Caption Missing");
return;

}



const file_id =
msg.video ?
msg.video.file_id :
msg.document.file_id;



const caption =
msg.caption.trim();


const meta =
getMeta(caption);



// MOVIE


let movie_id;


if(/MovieID:/i.test(caption)){

movie_id =
caption.match(/MovieID:\s*(.+)/i)[1];

}
else{

movie_id=caption;

}



movie_id =
movie_id
.replace(/\s+/g,"")
.toLowerCase();



const saved =
await saveMovie({

movie_id,

title:movie_id,

year:meta.year,

quality:meta.quality,

audio:meta.audio,

size:meta.size,

language:meta.language,

file_id

});



if(saved){


const link =
`https://t.me/${BOT_USERNAME}?start=${movie_id}`;



await bot.sendMessage(

msg.chat.id,

`✅ Movie Saved Successfully

🎬 ID:
${movie_id}

🔗 Link:
${link}`

);

}



}

catch(err){

console.log(
"❌ Channel Error:",
err.message
);

}


});





// ================================
// FORCE JOIN
// ================================

async function checkJoin(userId){

try{


const member =
await bot.getChatMember(
FORCE_CHANNEL,
userId
);


return (
member.status==="member" ||
member.status==="administrator" ||
member.status==="creator"
);


}
catch(err){

return false;

}

}





// ================================
// GET MOVIE
// ================================

async function getMovie(id){

const result =
await pool.query(`

SELECT *

FROM videos

WHERE type='movie'

AND LOWER(movie_id)=$1

LIMIT 1

`,
[
id.toLowerCase()
]
);


return result.rows[0] || null;

}




// ================================
// START
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



if(!id){

return bot.sendMessage(

chatId,

`🎬 Welcome To CineXClub

━━━━━━━━━━

🍿 Movies & Series

⚡ Fast Download

🔊 Multi Audio

━━━━━━━━━━

👇 Join Channel First`,

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



sendRequest(chatId,id);


});





async function sendRequest(chatId,id){


const movie =
await getMovie(id);



if(!movie){

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
`https://google.com/search?q=${id}+movie`
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



await bot.sendDocument(

chatId,

movie.file_id,

{

caption:

`🎬 ${movie.title}

━━━━━━━━

📅 ${movie.year || "N/A"}

🎥 ${movie.quality}

🔊 ${movie.audio}

━━━━━━━━

⏳ Auto Delete: 30 Minutes`

}

);


}





// ================================
// ERROR HANDLER
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

console.log(err);

});


console.log(`

╔════════════════════╗
║ 🎬 CineXClub Bot  ║
║     Started ✅    ║
╚════════════════════╝

`);
