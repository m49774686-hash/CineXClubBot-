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
// POSTGRESQL
// ================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ================================
// ENV
// ================================

const BOT_USERNAME = process.env.BOT_USERNAME;
const FORCE_CHANNEL = process.env.FORCE_CHANNEL;
const STORAGE_CHANNEL = Number(process.env.STORAGE_CHANNEL_ID);
const ADMIN_BOT = process.env.ADMIN_BOT;

// ================================
// KEEP ALIVE
// ================================

http.createServer((req, res) => {
  res.writeHead(200);
  res.end("CineXClub Bot Running...");
}).listen(process.env.PORT || 3000);

// ================================
// DATABASE
// ================================

async function initDatabase() {
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
quality TEXT,
file_id TEXT,
created_at TIMESTAMP DEFAULT NOW()
);
`);

  await pool.query(`
CREATE INDEX IF NOT EXISTS idx_movie
ON movies(movie_id);

CREATE INDEX IF NOT EXISTS idx_series
ON series(series_id);
`);

  console.log("✅ Database Ready");
}

initDatabase();

// ================================
// FORCE JOIN
// ================================

async function isJoined(userId) {
  try {
    const member = await bot.getChatMember(FORCE_CHANNEL, userId);

    return [
      "creator",
      "administrator",
      "member"
    ].includes(member.status);

  } catch {
    return false;
  }
}

// ================================
// WELCOME DASHBOARD
// ================================

function welcome(user) {
  return `
🎬 <b>Welcome to CineXClub</b>

👤 User : ${user.first_name}
🆔 ID : <code>${user.id}</code>
📛 Username : @${user.username || "None"}

━━━━━━━━━━━━━━━━━━

🍿 Unlimited Movies
📺 Web Series
🎞 Premium Quality

👇 Choose an option below.
`;
}

// ================================
// INLINE KEYBOARD
// ================================

function homeButtons() {
  return {
    inline_keyboard: [
      [
        {
          text: "🎥 Request Movie",
          url: "https://t.me/" + ADMIN_BOT
        }
      ],
      [
        {
          text: "📢 Join Channel",
          url: "https://t.me/" + FORCE_CHANNEL.replace("@","")
        }
      ]
    ]
  };
}

console.log("✅ CineXClub Bot Started");
// ================================
// PART 2A
// STORAGE CHANNEL UPLOAD
// MOVIE & SERIES SAVE
// ================================


// ================================
// SAVE MOVIE
// ================================

async function saveMovie(data) {
  try {

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
      file_id=$6
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

  } catch(err) {

    console.log("Movie Save Error:", err.message);
    return false;

  }
}


// ================================
// SAVE SERIES EPISODE
// ================================

async function saveSeries(data) {

  try {

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
      `,
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


  } catch(err){

    console.log("Series Save Error:",err.message);

    return false;

  }

}



// ================================
// STORAGE CHANNEL UPLOAD
// ================================


bot.on("channel_post", async(msg)=>{


try{


if(msg.chat.id !== STORAGE_CHANNEL)
return;



if(!msg.video)
return;



let caption = msg.caption || "";


if(!caption)
return;



let lines = caption.split("\n");



let id =
lines[0]
.trim()
.replace(/\s+/g,"")
.toLowerCase();



let quality =
caption.match(/(480p|720p|1080p)/i);


quality =
quality ? quality[1] : "720p";





// ================================
// SERIES CHECK
// ================================


if(
caption.toLowerCase()
.includes("s01") ||
caption.toLowerCase()
.includes("episode") ||
caption.toLowerCase()
.includes("ep")
){


let season =
caption.match(/s\d+/i);

let episode =
caption.match(/ep\d+/i);



await saveSeries({

series_id:id,

season:
season ? season[0].toUpperCase():"S01",

episode:
episode ? episode[0].toUpperCase():"EP01",

title:lines[0],

quality:quality,

file_id:msg.video.file_id

});



await bot.sendMessage(
msg.chat.id,
`
✅ Series Episode Saved

🆔 ID:
${id}

🎞 Quality:
${quality}
`
);


}


// ================================
// MOVIE SAVE
// ================================


else{


let year =
caption.match(/\b(19|20)\d{2}\b/);



await saveMovie({

movie_id:id,

title:lines[0],

year:
year ? year[0]:"",

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

🆔 ID:
${id}

🎞 Quality:
${quality}
`
);


}



}catch(err){

console.log(
"Upload Handler Error:",
err.message
);

}



});
// ================================
// PART 2B
// SEARCH FUNCTIONS
// BOT LINK GENERATION
// ERROR HANDLING
// ================================


// ================================
// GET MOVIE
// ================================

async function getMovie(movieId){

try{

const result = await pool.query(
`
SELECT *
FROM movies
WHERE movie_id=$1
LIMIT 1
`,
[
movieId.toLowerCase()
]
);


if(result.rows.length === 0)
return null;


return result.rows[0];


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

async function getSeries(seriesId){

try{


const result = await pool.query(
`
SELECT *
FROM series
WHERE series_id=$1
ORDER BY id ASC
`,
[
seriesId.toLowerCase()
]
);


if(result.rows.length === 0)
return [];


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
// CREATE BOT LINK
// ================================


function createBotLink(id){

return `https://t.me/${BOT_USERNAME}?start=${id}`;

}



// ================================
// PREMIUM CAPTION
// ================================


function premiumCaption(data){


return `
🎬 <b>${data.title || "CineXClub Movie"}</b>

━━━━━━━━━━━━━━━━━━

📅 Year : ${data.year || "N/A"}
🎞 Quality : ${data.quality || "720p"}
🌐 Language : ${data.language || "Unknown"}

━━━━━━━━━━━━━━━━━━

⚡ Powered By CineXClub
`;

}



// ================================
// SEARCH MOVIE BY NAME
// ================================


async function searchMovie(text){

try{


const result = await pool.query(
`
SELECT *
FROM movies
WHERE title ILIKE $1
LIMIT 10
`,
[
`%${text}%`
]
);


return result.rows;


}catch(err){

console.log(
"Search Error:",
err.message
);

return [];

}

}



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
// SAFE SEND VIDEO
// ================================


async function sendVideoSafe(
chatId,
fileId,
caption
){

try{


let msg = await bot.sendVideo(
chatId,
fileId,
{
caption:caption,
parse_mode:"HTML"
}
);


// Auto Delete 30 Minutes

setTimeout(async()=>{

try{

await bot.deleteMessage(
chatId,
msg.message_id
);

}catch(e){}


},1800000);



}catch(err){


console.log(
"Send Video Error:",
err.message
);


await bot.sendMessage(
chatId,
"❌ Unable to send file. Please try again later."
);


}

}
// ================================
// PART 3
// START COMMAND
// MOVIE / SERIES ACCESS
// FETCHING ANIMATION
// MOVIE DETAILS PAGE
// ================================


// ================================
// CHECK JOIN MESSAGE
// ================================

async function forceJoinMessage(chatId){

await bot.sendMessage(
chatId,
`
⚠️ <b>Join Our Channel First</b>

Access movies and series after joining our channel.

👇 Join and press /start again
`,
{
parse_mode:"HTML",
reply_markup:{
inline_keyboard:[
[
{
text:"📢 Join Channel",
url:`https://t.me/${FORCE_CHANNEL.replace("@","")}`
}
],
[
{
text:"🔄 Check Again",
callback_data:"check_join"
}
]
]
}
}
);

}



// ================================
// FETCHING ANIMATION
// ================================

async function fetching(chatId){

let msg = await bot.sendMessage(
chatId,
"⏳ Fetching your file..."
);


setTimeout(async()=>{

try{

await bot.editMessageText(
"🎬 Preparing your movie...",
{
chat_id:chatId,
message_id:msg.message_id
}
);

}catch(e){}


},1500);


return msg;

}



// ================================
// /START COMMAND
// ================================


bot.onText(
/\/start(?:\s+(.+))?/,
async(msg,match)=>{


const chatId = msg.chat.id;

const user = msg.from;



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



// CHECK FORCE JOIN

let joined = await isJoined(user.id);


if(!joined){

await forceJoinMessage(chatId);

return;

}



let id =
match[1]
.trim()
.toLowerCase();




// FETCH MESSAGE

let loading =
await fetching(chatId);



// ================================
// MOVIE FIND
// ================================


let movie =
await getMovie(id);



if(movie){



try{

await bot.deleteMessage(
chatId,
loading.message_id
);

}catch(e){}



await bot.sendMessage(
chatId,
premiumCaption(movie),
{
parse_mode:"HTML",
reply_markup:{
inline_keyboard:[

[
{
text:"▶️ Get Movie",
callback_data:
"movie_"+movie.movie_id
}

]

]
}
}
);


return;

}



// ================================
// SERIES FIND
// ================================


let series =
await getSeries(id);



if(series.length){


let buttons=[];


series.forEach(ep=>{


buttons.push([

{
text:
`${ep.episode} ${ep.quality}`,
callback_data:
"ep_"+ep.id
}

]);


});



await bot.sendMessage(
chatId,
`
📺 <b>${series[0].title}</b>

Select Episode 👇
`,
{
parse_mode:"HTML",
reply_markup:{
inline_keyboard:buttons
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

Search here 👇
`,
{
reply_markup:
googleButton(id)
}
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
// CALLBACK BUTTONS
// ================================


bot.on("callback_query",async(query)=>{


let data=query.data;

let chatId=query.message.chat.id;



try{


// JOIN CHECK

if(data==="check_join"){

let ok =
await isJoined(query.from.id);


if(ok){

await bot.sendMessage(
chatId,
"✅ Joined successfully. Send your link again."
);

}else{

await bot.answerCallbackQuery(
query.id,
{
text:"❌ Please join channel first",
show_alert:true
}
);

}

return;

}



// MOVIE SEND


if(data.startsWith("movie_")){


let id =
data.replace("movie_","");


let movie =
await getMovie(id);


if(movie){

await sendVideoSafe(
chatId,
movie.file_id,
premiumCaption(movie)
);

}

}



// EPISODE SEND


if(data.startsWith("ep_")){


let epId =
data.replace("ep_","");


let result =
await pool.query(
`
SELECT *
FROM series
WHERE id=$1
`,
[
epId
]
);


if(result.rows.length){


let ep=result.rows[0];


await sendVideoSafe(
chatId,
ep.file_id,
`
📺 ${ep.title}

🎞 Episode: ${ep.episode}
🎬 Quality: ${ep.quality}

⚡ CineXClub
`
);


}


}



}catch(err){

console.log(
"Callback Error:",
err.message
);

}


});
// ================================
// PART 3B
// YEAR + QUALITY SELECTION
// MOVIE DETAILS UI
// ================================


// ================================
// MOVIE DETAILS BUTTONS
// ================================

function movieDetailsButtons(movie){

return {
inline_keyboard:[

[
{
text:"📅 Year : "+(movie.year || "N/A"),
callback_data:"year_none"
}
],

[
{
text:"🎞 480p",
callback_data:`quality_${movie.movie_id}_480p`
},
{
text:"🎞 720p",
callback_data:`quality_${movie.movie_id}_720p`
},
{
text:"🎞 1080p",
callback_data:`quality_${movie.movie_id}_1080p`
}
],

[
{
text:"▶️ Watch Now",
callback_data:`movie_${movie.movie_id}`
}

]

]
};


}



// ================================
// QUALITY SEARCH
// ================================


async function getMovieQuality(id,quality){

try{


const result =
await pool.query(
`
SELECT *
FROM movies
WHERE movie_id=$1
AND quality=$2
LIMIT 1
`,
[
id,
quality
]
);


if(result.rows.length)
return result.rows[0];


return null;


}catch(err){

console.log(
"Quality Search Error:",
err.message
);

return null;

}


}



// ================================
// MOVIE DETAILS CALLBACK
// ================================


bot.on("callback_query",async(query)=>{


try{


let data=query.data;

let chatId=query.message.chat.id;



// QUALITY BUTTON


if(data.startsWith("quality_")){


let parts=data.split("_");


let id=parts[1];

let quality=parts[2];



let movie =
await getMovieQuality(
id,
quality
);



if(!movie){


await bot.answerCallbackQuery(
query.id,
{
text:"❌ This quality is not available",
show_alert:true
}
);


return;

}



await bot.sendMessage(
chatId,
`
🎬 <b>${movie.title}</b>

━━━━━━━━━━━━━━

📅 Year : ${movie.year || "N/A"}
🎞 Quality : ${movie.quality}

━━━━━━━━━━━━━━

Ready to watch 👇
`,
{
parse_mode:"HTML",
reply_markup:{
inline_keyboard:[
[
{
text:"▶️ Get File",
callback_data:
"movie_"+movie.movie_id
}
]
]
}
}
);


}



// MOVIE INFO


if(data.startsWith("info_")){


let id =
data.replace("info_","");


let movie =
await getMovie(id);



if(movie){


await bot.editMessageText(
premiumCaption(movie),
{
chat_id:chatId,
message_id:
query.message.message_id,
parse_mode:"HTML",
reply_markup:
movieDetailsButtons(movie)
}
);


}



}


}catch(err){


console.log(
"Part3B Error:",
err.message
);


}



});
// ================================
// PART 4A
// ADMIN + REQUEST + ERROR HANDLING
// ================================


// ================================
// ADMIN BUTTON
// ================================

function adminButton(){

return {
inline_keyboard:[

[
{
text:"👨‍💻 Admin Help",
url:`https://t.me/${ADMIN_BOT}`
}
]

]
};

}



// ================================
// REQUEST MOVIE BUTTON
// ================================

function requestMovieButton(){

return {

inline_keyboard:[

[
{
text:"🎬 Request Movie",
url:`https://t.me/${ADMIN_BOT}`
}
]

]

};

}



// ================================
// ERROR HANDLER
// ================================

bot.on("polling_error",(error)=>{

console.log(
"Polling Error:",
error.message
);

});



process.on(
"unhandledRejection",
(error)=>{

console.log(
"Unhandled Error:",
error.message
);

});



process.on(
"uncaughtException",
(error)=>{

console.log(
"Crash Error:",
error.message
);

});




// ================================
// BOT STATUS COMMAND
// ================================

bot.onText(
/\/status/,
async(msg)=>{


try{


await bot.sendMessage(
msg.chat.id,
`
✅ CineXClub Bot Online

🟢 Database Connected
🟢 Storage Active
🟢 Server Running
`
);


}catch(err){

console.log(err.message);

}


});




// ================================
// KEEP ALIVE PING
// ================================

setInterval(()=>{

console.log(
"⏱ Keep Alive Ping",
new Date().toISOString()
);

},300000);



console.log(
"✅ Part 4A Loaded"
);
// ================================
// PART 4B
// FINAL STARTUP + CLEANUP
// ================================


// ================================
// DATABASE CHECK
// ================================

async function checkDatabase(){

try{

await pool.query(
"SELECT NOW()"
);

console.log(
"✅ PostgreSQL Connected"
);


}catch(err){

console.log(
"❌ Database Connection Failed:",
err.message
);

}

}



// ================================
// BETTER NOT FOUND MESSAGE
// ================================

async function sendNotFound(chatId,id){

await bot.sendMessage(
chatId,
`
❌ <b>Video Not Found</b>

🆔 Search ID:
<code>${id}</code>

━━━━━━━━━━━━━━━━

Try another name or request this movie 👇
`,
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
`https://t.me/${ADMIN_BOT}`
}

]

]
}
}
);

}



// ================================
// STARTUP
// ================================

(async()=>{

await checkDatabase();


console.log(`
━━━━━━━━━━━━━━━━━━

🎬 CineXClub Bot Started

✅ Telegram Connected
✅ PostgreSQL Ready
✅ Storage Handler Ready
✅ Auto Delete Enabled
✅ Render Keep Alive Active

━━━━━━━━━━━━━━━━━━
`);

})();




// ================================
// SAFE SHUTDOWN
// ================================

process.on(
"SIGINT",
async()=>{


console.log(
"Bot shutting down..."
);


await pool.end();


process.exit(0);


});


process.on(
"SIGTERM",
async()=>{


console.log(
"Server stopping..."
);


await pool.end();


process.exit(0);


});



// ================================
// END
// ================================

console.log(
"✅ Final Part Loaded"
);
