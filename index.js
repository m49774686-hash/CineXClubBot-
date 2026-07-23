// =====================================================
// CineXClub Bot
// FINAL CLEAN INDEX.JS
// PART 1/13
// Setup + Environment + Bot + Database
// =====================================================


require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const { Pool } = require("pg");


// ===============================
// ENV CONFIG
// ===============================

const BOT_TOKEN = process.env.BOT_TOKEN;

const ADMIN_ID = process.env.ADMIN_ID;

const FORCE_CHANNEL = process.env.FORCE_CHANNEL;

const STORAGE_CHANNEL = process.env.STORAGE_CHANNEL;


if(!BOT_TOKEN){

    console.log("BOT_TOKEN missing");
    process.exit(1);

}



// ===============================
// BOT INITIALIZE
// ===============================


const bot = new TelegramBot(

    BOT_TOKEN,

    {
        polling:{
            interval:300,
            autoStart:true
        }
    }

);



console.log("🎬 CineXClub Bot Starting...");




// ===============================
// DATABASE
// ===============================


const pool = new Pool({

    connectionString:
    process.env.DATABASE_URL,

    ssl:{
        rejectUnauthorized:false
    }

});




pool.connect()

.then(client=>{

    console.log("✅ PostgreSQL Connected");

    client.release();

})

.catch(err=>{

    console.log(
        "Database Error:",
        err.message
    );

});






// ===============================
// HEALTH SERVER (RENDER)
// ===============================


const app = express();


app.get("/",(req,res)=>{

    res.send(
        "CineXClub Bot Running"
    );

});



app.get("/health",(req,res)=>{

    res.json({

        status:"online",

        bot:"CineXClub",

        time:new Date()

    });

});



const PORT =
process.env.PORT || 3000;



app.listen(PORT,()=>{

    console.log(
        "Health Server Running:",
        PORT
    );

});







// ===============================
// GLOBAL STATES
// ===============================


const userStates = new Map();

const adminStates = new Map();

const searchState = new Map();

const uploadState = new Map();

const deleteTimers = new Map();

const welcomeImageState = new Map();






// ===============================
// EXPORT GLOBAL OBJECT
// ===============================


global.CineX = {

    bot,

    pool,

    ADMIN_ID,

    FORCE_CHANNEL,

    STORAGE_CHANNEL,


    userStates,

    adminStates,

    searchState,

    uploadState,

    deleteTimers,

    welcomeImageState


};






// ===============================
// BASIC ERROR HANDLING
// ===============================


bot.on(
"polling_error",
(err)=>{

    console.log(
        "Polling Error:",
        err.message
    );

});




process.on(
"unhandledRejection",
(err)=>{

    console.log(
        "Unhandled Error:",
        err
    );

});



process.on(
"uncaughtException",
(err)=>{

    console.log(
        "Exception:",
        err.message
    );

});




// ===============================
// END PART 1/13
// ===============================
// =====================================================
// CineXClub Bot
// FINAL CLEAN INDEX.JS
// PART 2/13
// PostgreSQL Tables + Database Functions
// =====================================================


const {

    pool

} = global.CineX;





// ===============================
// DATABASE INITIALIZATION
// ===============================


async function initDatabase(){

try{


await pool.query(`

CREATE TABLE IF NOT EXISTS contents (

id SERIAL PRIMARY KEY,

content_id TEXT UNIQUE NOT NULL,

title TEXT NOT NULL,

type TEXT NOT NULL,

collection TEXT,

season INTEGER,

episode INTEGER,

year TEXT,

quality TEXT,

audio TEXT,

language TEXT,

size TEXT,

thumbnail TEXT,

file_id TEXT NOT NULL,

downloads INTEGER DEFAULT 0,

created_at TIMESTAMP DEFAULT NOW()

);

`);





await pool.query(`

CREATE TABLE IF NOT EXISTS users (

id SERIAL PRIMARY KEY,

user_id BIGINT UNIQUE NOT NULL,

username TEXT,

first_name TEXT,

downloads INTEGER DEFAULT 0,

joined_at TIMESTAMP DEFAULT NOW()

);

`);






await pool.query(`

CREATE TABLE IF NOT EXISTS requests (

id SERIAL PRIMARY KEY,

user_id BIGINT NOT NULL,

username TEXT,

request TEXT NOT NULL,

status TEXT DEFAULT 'pending',

created_at TIMESTAMP DEFAULT NOW()

);

`);







await pool.query(`

CREATE TABLE IF NOT EXISTS settings (

id SERIAL PRIMARY KEY,

key TEXT UNIQUE NOT NULL,

value TEXT

);

`);





console.log(
"✅ Database Tables Ready"
);



}

catch(err){

console.log(
"Database Setup Error:",
err.message
);

}


}



initDatabase();









// ===============================
// USER FUNCTIONS
// ===============================


async function saveUser(user){


try{


await pool.query(`

INSERT INTO users

(
user_id,
username,
first_name
)

VALUES($1,$2,$3)

ON CONFLICT(user_id)

DO UPDATE SET

username=$2,

first_name=$3

`,
[

user.id,

user.username || "",

user.first_name || ""

]

);



}

catch(err){


console.log(
"Save User Error:",
err.message
);


}


}









async function getUserCount(){


const result =

await pool.query(`

SELECT COUNT(*)

FROM users

`);



return result.rows[0].count;


}









// ===============================
// CONTENT FUNCTIONS
// ===============================


async function saveContent(data){


try{


const result =

await pool.query(`

INSERT INTO contents

(

content_id,

title,

type,

collection,

season,

episode,

year,

quality,

audio,

language,

size,

thumbnail,

file_id

)

VALUES

($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)


ON CONFLICT(content_id)

DO NOTHING


RETURNING *

`,

[

data.content_id,

data.title,

data.type,

data.collection || null,

data.season || null,

data.episode || null,

data.year || null,

data.quality || null,

data.audio || null,

data.language || null,

data.size || null,

data.thumbnail || null,

data.file_id

]

);



return result.rows[0];


}

catch(err){


console.log(
"Save Content Error:",
err.message
);


return null;


}


}








async function getContent(id){


try{


const result =

await pool.query(`

SELECT *

FROM contents

WHERE content_id=$1

`,
[
id
]

);



return result.rows[0];


}

catch(err){


return null;


}


}









// ===============================
// SETTINGS FUNCTIONS
// ===============================


async function setSetting(key,value){



await pool.query(`

INSERT INTO settings

(key,value)

VALUES($1,$2)

ON CONFLICT(key)

DO UPDATE SET

value=$2

`,
[
key,
value
]

);


}








async function getSetting(key){


const result =

await pool.query(`

SELECT value

FROM settings

WHERE key=$1

`,
[
key
]

);



if(result.rows.length)

return result.rows[0].value;



return null;


}








async function removeSetting(key){


await pool.query(`

DELETE FROM settings

WHERE key=$1

`,
[
key
]

);


}









// ===============================
// DOWNLOAD COUNT
// ===============================


async function increaseDownload(

contentId,

userId

){


await pool.query(`

UPDATE contents

SET downloads=downloads+1

WHERE content_id=$1

`,
[
contentId
]

);



await pool.query(`

UPDATE users

SET downloads=downloads+1

WHERE user_id=$1

`,
[
userId
]

);


}









// ===============================
// REQUEST FUNCTIONS
// ===============================


async function saveRequest(

userId,

username,

request

){


await pool.query(`

INSERT INTO requests

(user_id,username,request)

VALUES($1,$2,$3)

`,
[
userId,
username,
request
]

);


}




async function updateRequestStatus(

id,

status

){


await pool.query(`

UPDATE requests

SET status=$1

WHERE id=$2

`,
[
status,
id
]

);


}






// ===============================
// GLOBAL EXPORT
// ===============================


Object.assign(

global.CineX,

{

saveUser,

getUserCount,

saveContent,

getContent,

setSetting,

getSetting,

removeSetting,

increaseDownload,

saveRequest,

updateRequestStatus


}

);



// ===============================
// END PART 2/13
// ===============================
// =====================================================
// CineXClub Bot
// FINAL CLEAN INDEX.JS
// PART 3/13
// User System + Force Join + /start Deep Link
// =====================================================


const {

    bot,
    FORCE_CHANNEL

} = global.CineX;



const {

    saveUser,
    getContent,
    getSetting

} = global.CineX;








// ===============================
// FORCE JOIN CHECK
// ===============================


async function checkForceJoin(userId){


try{


if(!FORCE_CHANNEL)

return true;





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

"Force Join Error:",

err.message

);



return false;


}



}









// ===============================
// FORCE JOIN MESSAGE
// ===============================


function sendForceJoin(chatId){



bot.sendMessage(

chatId,

`

🔒 Access Locked


Please join our official channel first.


After joining press ✅ Verify.

`,

{

reply_markup:{

inline_keyboard:[

[

{

text:"📢 Join Channel",

url:

`https://t.me/${FORCE_CHANNEL.replace("@","")}`

}

],

[

{

text:"✅ Verify",

callback_data:"verify_join"

}

]

]

}

}

);



}









// ===============================
// SAVE USERS AUTOMATICALLY
// ===============================


bot.on(

"message",

async(msg)=>{


if(msg.from){


await saveUser(

msg.from

);


}


});









// ===============================
// START COMMAND
// ===============================


bot.onText(

/\/start(?:\s(.+))?/,

async(msg,match)=>{



const chatId =

msg.chat.id;



const user =

msg.from;






await saveUser(user);






const joined =

await checkForceJoin(

user.id

);






if(!joined){


return sendForceJoin(

chatId

);


}








const contentId =

match[1];







// DEEP LINK



if(contentId){



const content =

await getContent(

contentId

);






if(content){



return global.CineX.sendContentDetails(

chatId,

content

);



}






return bot.sendMessage(

chatId,

`

❌ Content not found


Try another search.

`

);



}








// WELCOME SYSTEM


const image =

await getSetting(

"welcome_image"

);







const text =

`

🎬 *Welcome To CineXClub*


👋 Hello ${user.first_name || "User"}


🔥 Movies | Series | Anime


Search and download your favourite content.

`;







const keyboard = {


inline_keyboard:[


[

{

text:"🔎 Search",

callback_data:"search"

}

],


[

{

text:"📩 Request Movie",

callback_data:"request_movie"

}

],


[

{

text:"ℹ️ Help",

callback_data:"help"

}

]


]

};








if(image){



return bot.sendPhoto(

chatId,

image,

{

caption:text,

parse_mode:"Markdown",

reply_markup:keyboard

}

);



}







bot.sendMessage(

chatId,

text,

{

parse_mode:"Markdown",

reply_markup:keyboard

}

);



});









// ===============================
// VERIFY JOIN BUTTON
// ===============================


bot.on(

"callback_query",

async(query)=>{



if(

query.data !== "verify_join"

)

return;







const joined =

await checkForceJoin(

query.from.id

);







if(joined){



await bot.answerCallbackQuery(

query.id,

{

text:"Verified ✅"

}

);



bot.sendMessage(

query.message.chat.id,

"🎉 Welcome to CineXClub"

);



}

else{


await bot.answerCallbackQuery(

query.id,

{

text:"Join channel first ❌"

}

);


}



});









// ===============================
// EXPORT
// ===============================


global.CineX.checkForceJoin =

checkForceJoin;



global.CineX.sendForceJoin =

sendForceJoin;



// ===============================
// END PART 3/13
// ===============================
// =====================================================
// CineXClub Bot
// FINAL CLEAN INDEX.JS
// PART 4/13
// Content Details + File Sending System
// Movie / Series / Anime
// =====================================================


const {

    bot,
    deleteTimers

} = global.CineX;



const {

    getContent,
    increaseDownload

} = global.CineX;









// ===============================
// CONTENT DETAILS PAGE
// ===============================


async function sendContentDetails(

chatId,

content

){



let details =

`

🎬 *${content.title}*


📌 Type:

${content.type}

`;






if(content.type === "Movie"){


details +=

`

📅 Year:

${content.year || "N/A"}


🎞 Quality:

${content.quality || "N/A"}


🔊 Audio:

${content.audio || "N/A"}


📦 Size:

${content.size || "N/A"}

`;



}







if(

content.type === "Series" ||

content.type === "Anime"

){


details +=

`

📚 Collection:

${content.collection || "N/A"}


📺 Season:

${content.season || "N/A"}


🎬 Episode:

${content.episode || "N/A"}


🎞 Quality:

${content.quality || "N/A"}

`;



}







const keyboard = {


inline_keyboard:[


[

{

text:"▶️ Watch / Download",

callback_data:

`send_file_${content.content_id}`

}

]

]

};







if(content.thumbnail){



return bot.sendPhoto(

chatId,

content.thumbnail,

{

caption:details,

parse_mode:"Markdown",

reply_markup:keyboard

}

);



}







bot.sendMessage(

chatId,

details,

{

parse_mode:"Markdown",

reply_markup:keyboard

}

);



}









// ===============================
// SEND VIDEO FILE
// ===============================


async function sendFile(

chatId,

userId,

content

){



try{



const sent =

await bot.sendVideo(

chatId,

content.file_id,

{

caption:

`

🎬 ${content.title}


📌 Type:

${content.type}


🎞 Quality:

${content.quality || "N/A"}


🔊 Audio:

${content.audio || "N/A"}


📦 Size:

${content.size || "N/A"}


⚡ CineXClub

`

}

);






await increaseDownload(

content.content_id,

userId

);








// AUTO DELETE DEFAULT 10 MINUTES


const timer =

setTimeout(

async()=>{


try{


await bot.deleteMessage(

chatId,

sent.message_id

);



deleteTimers.delete(

sent.message_id

);



}

catch(err){


console.log(

"Delete Error:",

err.message

);


}


},

10 * 60 * 1000

);







deleteTimers.set(

sent.message_id,

timer

);





}

catch(err){


console.log(

"File Send Error:",

err.message

);



bot.sendMessage(

chatId,

"❌ File sending failed"

);



}



}









// ===============================
// DOWNLOAD BUTTON
// ===============================


bot.on(

"callback_query",

async(query)=>{



if(

!query.data.startsWith(

"send_file_"

)

)

return;







const id =

query.data.replace(

"send_file_",

""

);







const content =

await getContent(

id

);






if(!content){


return bot.answerCallbackQuery(

query.id,

{

text:"File not found ❌"

}

);



}








await bot.answerCallbackQuery(

query.id

);






sendFile(

query.message.chat.id,

query.from.id,

content

);



});









// ===============================
// EXPORT
// ===============================


global.CineX.sendContentDetails =

sendContentDetails;



global.CineX.sendFile =

sendFile;



// ===============================
// END PART 4/13
// ===============================
// =====================================================
// CineXClub Bot
// FINAL CLEAN INDEX.JS
// PART 5/13
// Search System + PostgreSQL Search
// =====================================================


const {

    bot,
    searchState

} = global.CineX;



const {

    pool,
    sendContentDetails

} = global.CineX;








// ===============================
// SEARCH BUTTON
// ===============================


bot.on(

"callback_query",

async(query)=>{


if(

query.data !== "search"

)

return;






searchState.set(

query.from.id,

true

);






bot.sendMessage(

query.message.chat.id,

`

🔎 Send Movie / Series / Anime Name


Example:

Iron Man

Stranger Things

Naruto

`

);



});









// ===============================
// SEARCH MESSAGE
// ===============================


bot.on(

"message",

async(msg)=>{



if(!msg.text)

return;






const userId =

msg.from.id;






if(

!searchState.has(userId)

)

return;







searchState.delete(

userId

);







const keyword =

msg.text.trim();







try{



const result =

await pool.query(`

SELECT *

FROM contents

WHERE

title ILIKE $1

OR collection ILIKE $1

OR type ILIKE $1

ORDER BY id DESC

LIMIT 10

`,

[

`%${keyword}%`

]

);







if(

result.rows.length === 0

){



return bot.sendMessage(

msg.chat.id,

`

❌ No results found


Use /request to request content.

`

);



}








const buttons = {


inline_keyboard:[]

};







result.rows.forEach(item=>{


buttons.inline_keyboard.push(

[

{

text:

`🎬 ${item.title}`,

callback_data:

`detail_${item.content_id}`

}

]

);



});







bot.sendMessage(

msg.chat.id,

`

🔎 Search Results:


${keyword}

`

,

{

reply_markup:buttons

}

);



}

catch(err){


console.log(

"Search Error:",

err.message

);



bot.sendMessage(

msg.chat.id,

"❌ Search failed"

);



}



});









// ===============================
// OPEN DETAILS FROM SEARCH
// ===============================


bot.on(

"callback_query",

async(query)=>{



if(

!query.data.startsWith(

"detail_"

)

)

return;







const id =

query.data.replace(

"detail_",

""

);







const content =

await global.CineX.getContent(

id

);







if(!content)

return;







sendContentDetails(

query.message.chat.id,

content

);



});









// ===============================
// DIRECT SEARCH FUNCTION
// ===============================


async function searchContent(text){



const result =

await pool.query(`

SELECT *

FROM contents

WHERE

title ILIKE $1

OR collection ILIKE $1

LIMIT 10

`,

[

`%${text}%`

]

);






return result.rows;



}









global.CineX.searchContent =

searchContent;



// ===============================
// END PART 5/13
// ===============================
// =====================================================
// CineXClub Bot
// FINAL CLEAN INDEX.JS
// PART 6/13
// Upload System
// Movie / Series / Anime
// Caption Parser + Duplicate Protection
// =====================================================


const {

    bot,
    STORAGE_CHANNEL,
    ADMIN_ID,
    uploadState

} = global.CineX;



const {

    saveContent,
    getContent

} = global.CineX;









// ===============================
// ADMIN CHECK
// ===============================


function isAdmin(id){

return id.toString()
===
ADMIN_ID.toString();

}








// ===============================
// CAPTION PARSER
// ===============================


function parseCaption(caption){



const data = {};




caption
.split("\n")
.forEach(line=>{


const parts =

line.split(":");



if(parts.length < 2)

return;




const key =

parts.shift()

.trim()

.toLowerCase();





const value =

parts.join(":")
.trim();





data[key] = value;



});







return {


content_id:

data.id ||

data.content_id ||

data.movieid,



title:

data.title || "Unknown",



type:

data.type || "Movie",



collection:

data.collection || null,



season:

data.season ?

Number(data.season)

:null,



episode:

data.episode ?

Number(data.episode)

:null,



year:

data.year || null,



quality:

data.quality || null,



audio:

data.audio || null,



language:

data.language || null,



size:

data.size || null



};



}









// ===============================
// STORAGE CHANNEL UPLOAD
// ===============================


bot.on(

"channel_post",

async(post)=>{



try{



if(

post.chat.id.toString()

!==

STORAGE_CHANNEL.toString()

)

return;







if(!post.video)

return;







const data =

parseCaption(

post.caption || ""

);







if(!data.content_id)

return;








const exists =

await getContent(

data.content_id

);






if(exists){


console.log(

"Duplicate ID:",

data.content_id

);



return;

}







await saveContent({

...data,


file_id:

post.video.file_id,


thumbnail:

post.video.thumb ?

post.video.thumb.file_id

:

null



});






console.log(

"Uploaded:",

data.title

);



}

catch(err){



console.log(

"Upload Error:",

err.message

);



}



});









// ===============================
// ADMIN UPLOAD MODE
// ===============================


bot.onText(

/\/upload/,

async(msg)=>{



if(

!isAdmin(msg.from.id)

)

return;








uploadState.set(

msg.chat.id,

true

);







bot.sendMessage(

msg.chat.id,

`

📤 Send Video With Caption


Example:


ID: iron001

Type: Movie

Title: Iron Man

Year: 2008

Quality: 1080p

Audio: English

Size: 2GB


`

);



});









// ===============================
// ADMIN VIDEO SAVE
// ===============================


bot.on(

"message",

async(msg)=>{



if(

!uploadState.has(

msg.chat.id

)

)

return;








if(

!msg.video

)

return;







if(

!isAdmin(msg.from.id)

)

return;







const data =

parseCaption(

msg.caption || ""

);







if(!data.content_id){


return bot.sendMessage(

msg.chat.id,

"❌ ID Missing"

);


}








const exists =

await getContent(

data.content_id

);







if(exists){



return bot.sendMessage(

msg.chat.id,

"⚠️ Duplicate Content ID"

);



}







await saveContent({

...data,


file_id:

msg.video.file_id,


thumbnail:

msg.video.thumb ?

msg.video.thumb.file_id

:

null



});








uploadState.delete(

msg.chat.id

);







bot.sendMessage(

msg.chat.id,

`

✅ Upload Completed


🎬 ${data.title}

`

);



});









// ===============================
// EXPORT
// ===============================


global.CineX.parseCaption =

parseCaption;



global.CineX.isAdmin =

isAdmin;



// ===============================
// END PART 6/13
// ===============================
// =====================================================
// CineXClub Bot
// FINAL CLEAN INDEX.JS
// PART 7/13
// Season / Episode System
// Collection Navigation
// Send All Episodes
// =====================================================


const {

    bot

} = global.CineX;



const {

    pool

} = global.CineX;









// ===============================
// GET EPISODES
// ===============================


async function getEpisodes(

collection,

season

){


try{


const result =

await pool.query(`

SELECT *

FROM contents

WHERE collection=$1

AND season=$2

ORDER BY episode ASC

`,

[

collection,

season

]

);





return result.rows;



}

catch(err){


console.log(

"Episode Fetch Error:",

err.message

);



return [];



}



}









// ===============================
// OPEN COLLECTION
// ===============================


async function openCollection(

chatId,

collection

){



const result =

await pool.query(`

SELECT DISTINCT season

FROM contents

WHERE collection=$1

ORDER BY season ASC

`,

[

collection

]

);







if(!result.rows.length)

return;







const buttons = {


inline_keyboard:[]

};







result.rows.forEach(row=>{


buttons.inline_keyboard.push(

[

{

text:

`📺 Season ${row.season}`,

callback_data:

`season_${collection}_${row.season}`

}

]

);


});







bot.sendMessage(

chatId,

`

📚 ${collection}


Select Season:

`

,

{

reply_markup:buttons

}

);



}









// ===============================
// SEASON BUTTON
// ===============================


bot.on(

"callback_query",

async(query)=>{



if(

!query.data.startsWith(

"season_"

)

)

return;







const parts =

query.data.split("_");







const collection =

parts[1];



const season =

parts[2];







const episodes =

await getEpisodes(

collection,

season

);







if(!episodes.length){



return bot.sendMessage(

query.message.chat.id,

"❌ Episodes not found"

);



}







const buttons = {


inline_keyboard:[]

};






buttons.inline_keyboard.push(

[

{

text:"📥 Send All Episodes",

callback_data:

`all_episode_${collection}_${season}`

}

]

);







episodes.forEach(ep=>{


buttons.inline_keyboard.push(

[

{

text:

`▶️ Episode ${ep.episode}`,

callback_data:

`send_file_${ep.content_id}`

}

]

);


});








bot.sendMessage(

query.message.chat.id,

`

📺 ${collection}


Season ${season}


Choose Episode:

`

,

{

reply_markup:buttons

}

);



});









// ===============================
// SEND ALL EPISODES
// ===============================


bot.on(

"callback_query",

async(query)=>{



if(

!query.data.startsWith(

"all_episode_"

)

)

return;







const parts =

query.data.split("_");







const collection =

parts[2];



const season =

parts[3];








const episodes =

await getEpisodes(

collection,

season

);







bot.sendMessage(

query.message.chat.id,

`

📥 Sending all episodes...

`

);







for(

const ep of episodes

){



await bot.sendVideo(

query.message.chat.id,

ep.file_id,

{

caption:

`

🎬 ${ep.title}


📺 Episode:

${ep.episode}


🎞 Quality:

${ep.quality || "N/A"}


⚡ CineXClub

`

}

);



await new Promise(

resolve=>

setTimeout(resolve,1000)

);



}



});









// ===============================
// COLLECTION LIST
// ===============================


async function getCollectionList(){



const result =

await pool.query(`

SELECT DISTINCT collection

FROM contents

WHERE collection IS NOT NULL

ORDER BY collection

`);






return result.rows.map(

row=>row.collection

);



}








// ===============================
// EXPORT
// ===============================


global.CineX.getEpisodes =

getEpisodes;



global.CineX.openCollection =

openCollection;



global.CineX.getCollectionList =

getCollectionList;



// ===============================
// END PART 7/13
// ===============================
// =====================================================
// CineXClub Bot
// FINAL CLEAN INDEX.JS
// PART 8/13
// Admin Panel
// Upload + Statistics + Broadcast + Settings Base
// =====================================================


const {

    bot,
    ADMIN_ID,
    adminStates

} = global.CineX;



const {

    pool,
    getUserCount

} = global.CineX;









// ===============================
// ADMIN CHECK
// ===============================


function checkAdmin(id){


return id.toString()
===
ADMIN_ID.toString();


}









// ===============================
// ADMIN PANEL MENU
// ===============================


function sendAdminPanel(chatId){



const keyboard = {


inline_keyboard:[


[

{

text:"📤 Upload",

callback_data:"admin_upload"

}

],



[

{

text:"📩 Requests",

callback_data:"admin_requests"

}

],



[

{

text:"📊 Statistics",

callback_data:"admin_stats"

}

],



[

{

text:"📢 Broadcast",

callback_data:"admin_broadcast"

}

],



[

{

text:"⚙️ Settings",

callback_data:"admin_settings"

}

]

]

};






bot.sendMessage(

chatId,

`

👑 CineXClub Admin Panel


Select Option:

`

,

{

reply_markup:keyboard

}

);



}









// ===============================
// ADMIN COMMAND
// ===============================


bot.onText(

/\/admin/,

(msg)=>{



if(

!checkAdmin(msg.from.id)

)

return;






sendAdminPanel(

msg.chat.id

);



});









// ===============================
// ADMIN CALLBACKS
// ===============================


bot.on(

"callback_query",

async(query)=>{



if(

!checkAdmin(query.from.id)

)

return;







const chatId =

query.message.chat.id;







if(query.data === "admin_upload"){



adminStates.set(

chatId,

"upload"

);







return bot.sendMessage(

chatId,

`

📤 Upload Mode Enabled


Send video with caption.

`

);



}







if(query.data === "admin_requests"){



return bot.sendMessage(

chatId,

`

📩 Request Panel


Use request management.

`

);



}








if(query.data === "admin_stats"){



return showStats(

chatId

);



}








if(query.data === "admin_broadcast"){



adminStates.set(

chatId,

"broadcast"

);







return bot.sendMessage(

chatId,

`

📢 Send message to broadcast

`

);



}








if(query.data === "admin_settings"){



return bot.sendMessage(

chatId,

`

⚙️ Settings


Welcome Image

Force Join

Auto Delete

`

);



}



});









// ===============================
// STATISTICS
// ===============================


async function showStats(chatId){



try{



const users =

await getUserCount();







const content =

await pool.query(`

SELECT COUNT(*)

FROM contents

`);








const downloads =

await pool.query(`

SELECT SUM(downloads)

FROM contents

`);







bot.sendMessage(

chatId,

`

📊 CineXClub Statistics


👥 Users:

${users}


🎬 Contents:

${content.rows[0].count}


⬇️ Downloads:

${downloads.rows[0].sum || 0}


`

);



}

catch(err){


console.log(

"Stats Error:",

err.message

);



}



}









// ===============================
// BROADCAST SYSTEM
// ===============================


bot.on(

"message",

async(msg)=>{



if(

!adminStates.has(msg.chat.id)

)

return;







if(

adminStates.get(msg.chat.id)

!==

"broadcast"

)

return;







if(

!checkAdmin(msg.from.id)

)

return;







const users =

await pool.query(`

SELECT user_id

FROM users

`);








let sent = 0;







for(

const user of users.rows

){



try{



await bot.forwardMessage(

user.user_id,

msg.chat.id,

msg.message_id

);



sent++;



}

catch(e){}



}







adminStates.delete(

msg.chat.id

);







bot.sendMessage(

msg.chat.id,

`

✅ Broadcast Completed


Sent:

${sent}

`

);



});









// ===============================
// EXPORT
// ===============================


global.CineX.checkAdmin =

checkAdmin;



global.CineX.sendAdminPanel =

sendAdminPanel;



global.CineX.showStats =

showStats;



// ===============================
// END PART 8/13
// ===============================
// =====================================================
// CineXClub Bot
// FINAL CLEAN INDEX.JS
// PART 9/13
// Request System
// Admin Accept / Reject
// User Notification
// =====================================================


const {

    bot,
    ADMIN_ID

} = global.CineX;



const {

    pool,

    saveRequest,

    updateRequestStatus

} = global.CineX;









// ===============================
// REQUEST COMMAND
// ===============================


bot.onText(

/\/request (.+)/,

async(msg,match)=>{



const requestName =

match[1];







await saveRequest(

msg.from.id,

msg.from.username || "",

requestName

);







bot.sendMessage(

msg.chat.id,

`

✅ Request Submitted


🎬 ${requestName}


Admin will review.

`

);







bot.sendMessage(

ADMIN_ID,

`

📩 New Movie Request


👤 User:

${msg.from.username || msg.from.id}


🎬 Request:

${requestName}

`

);



});









// ===============================
// SHOW REQUESTS TO ADMIN
// ===============================


async function showRequests(chatId){



const result =

await pool.query(`

SELECT *

FROM requests

WHERE status='pending'

ORDER BY id DESC

`);







if(!result.rows.length){



return bot.sendMessage(

chatId,

"✅ No Pending Requests"

);



}







result.rows.forEach(req=>{



bot.sendMessage(

chatId,

`

📩 Request ID:

${req.id}


👤 User:

${req.username || req.user_id}


🎬 Movie:

${req.request}

`

,

{

reply_markup:{

inline_keyboard:[

[

{

text:"✅ Accept",

callback_data:

`accept_${req.id}`

},

{

text:"❌ Reject",

callback_data:

`reject_${req.id}`

}

]

]

}

}

);



});



}









// ===============================
// REQUEST CALLBACK
// ===============================


bot.on(

"callback_query",

async(query)=>{



if(

!query.data.startsWith("accept_")

&&

!query.data.startsWith("reject_")

)

return;







if(

query.from.id.toString()

!==

ADMIN_ID.toString()

)

return;







const parts =

query.data.split("_");



const action =

parts[0];



const requestId =

parts[1];







const result =

await pool.query(`

SELECT *

FROM requests

WHERE id=$1

`,
[
requestId
]

);







if(!result.rows.length)

return;







const request =

result.rows[0];








if(action === "accept"){



await updateRequestStatus(

requestId,

"accepted"

);







await bot.sendMessage(

request.user_id,

`

✅ Request Accepted


🎬 ${request.request}


Your content will be added soon.

`

);



}








if(action === "reject"){



await updateRequestStatus(

requestId,

"rejected"

);







await bot.sendMessage(

request.user_id,

`

❌ Request Rejected


🎬 ${request.request}

`

);



}







bot.answerCallbackQuery(

query.id

);



});









// ===============================
// ADMIN REQUEST COMMAND
// ===============================


bot.onText(

/\/requests/,

async(msg)=>{



if(

msg.from.id.toString()

!==

ADMIN_ID.toString()

)

return;







showRequests(

msg.chat.id

);



});









// ===============================
// EXPORT
// ===============================


global.CineX.showRequests =

showRequests;



// ===============================
// END PART 9/13
// ===============================
// =====================================================
// CineXClub Bot
// FINAL CLEAN INDEX.JS
// PART 10/13
// Advanced Statistics
// Settings System
// Broadcast Upgrade
// =====================================================


const {

    bot,
    ADMIN_ID

} = global.CineX;



const {

    pool,

    setSetting,

    getSetting

} = global.CineX;









// ===============================
// ADMIN CHECK
// ===============================


function adminOnly(id){


return id.toString()
===
ADMIN_ID.toString();


}









// ===============================
// ADVANCED STATISTICS
// ===============================


async function advancedStats(chatId){


try{


const users =

await pool.query(`

SELECT COUNT(*)

FROM users

`);






const movies =

await pool.query(`

SELECT COUNT(*)

FROM contents

WHERE type='Movie'

`);






const series =

await pool.query(`

SELECT COUNT(*)

FROM contents

WHERE type='Series'

`);






const anime =

await pool.query(`

SELECT COUNT(*)

FROM contents

WHERE type='Anime'

`);






const downloads =

await pool.query(`

SELECT SUM(downloads)

FROM contents

`);







bot.sendMessage(

chatId,

`

📊 CineXClub Statistics


👥 Users:

${users.rows[0].count}


🎬 Movies:

${movies.rows[0].count}


📺 Series:

${series.rows[0].count}


🎌 Anime:

${anime.rows[0].count}


⬇️ Downloads:

${downloads.rows[0].sum || 0}

`

);



}

catch(err){


console.log(

"Statistics Error:",

err.message

);



}



}









// ===============================
// SETTINGS MENU
// ===============================


async function settingsMenu(chatId){



const welcome =

await getSetting(

"welcome_image"

);






const autoDelete =

await getSetting(

"auto_delete"

);






const forceJoin =

await getSetting(

"force_join"

);







bot.sendMessage(

chatId,

`

⚙️ CineXClub Settings


🖼 Welcome Image:

${welcome ? "Enabled":"Disabled"}


🧹 Auto Delete:

${autoDelete || "10 Minutes"}


🔒 Force Join:

${forceJoin || "Not Set"}


`

);



}









// ===============================
// SETTINGS COMMAND
// ===============================


bot.onText(

/\/settings/,

async(msg)=>{



if(

!adminOnly(msg.from.id)

)

return;







settingsMenu(

msg.chat.id

);



});









// ===============================
// AUTO DELETE SETTING
// ===============================


bot.onText(

/\/setdelete (.+)/,

async(msg,match)=>{



if(

!adminOnly(msg.from.id)

)

return;







await setSetting(

"auto_delete",

match[1]

);







bot.sendMessage(

msg.chat.id,

`

✅ Auto Delete Updated


${match[1]} Minutes

`

);



});









// ===============================
// FORCE JOIN SETTING
// ===============================


bot.onText(

/\/setforce (.+)/,

async(msg,match)=>{



if(

!adminOnly(msg.from.id)

)

return;







await setSetting(

"force_join",

match[1]

);







bot.sendMessage(

msg.chat.id,

`

✅ Force Join Updated


${match[1]}

`

);



});









// ===============================
// STAT COMMAND
// ===============================


bot.onText(

/\/stats/,

async(msg)=>{



if(

!adminOnly(msg.from.id)

)

return;







advancedStats(

msg.chat.id

);



});









// ===============================
// EXPORT
// ===============================


global.CineX.adminOnly =

adminOnly;



global.CineX.advancedStats =

advancedStats;



global.CineX.settingsMenu =

settingsMenu;



// ===============================
// END PART 10/13
// ===============================
// =====================================================
// CineXClub Bot
// FINAL CLEAN INDEX.JS
// PART 11/13
// Welcome Image Management
// Database Based
// settings key: welcome_image
// =====================================================


const {

    bot,
    ADMIN_ID,
    welcomeImageState

} = global.CineX;



const {

    setSetting,
    getSetting,
    removeSetting

} = global.CineX;









// ===============================
// ADMIN CHECK
// ===============================


function imageAdmin(id){


return id.toString()
===
ADMIN_ID.toString();


}









// ===============================
// CHANGE WELCOME IMAGE
// ===============================


bot.onText(

/\/setwelcome/,

async(msg)=>{



if(

!imageAdmin(msg.from.id)

)

return;







welcomeImageState.set(

msg.chat.id,

true

);







bot.sendMessage(

msg.chat.id,

`

🖼 Send welcome image now.


This image will be saved in database.

`

);



});









// ===============================
// RECEIVE IMAGE
// ===============================


bot.on(

"photo",

async(msg)=>{



if(

!imageAdmin(msg.from.id)

)

return;







if(

!welcomeImageState.has(

msg.chat.id

)

)

return;








const photos =

msg.photo;






const image =

photos[photos.length - 1];







await setSetting(

"welcome_image",

image.file_id

);







welcomeImageState.delete(

msg.chat.id

);








bot.sendMessage(

msg.chat.id,

`

✅ Welcome Image Updated


Database key:

welcome_image

`

);



});









// ===============================
// REMOVE WELCOME IMAGE
// ===============================


bot.onText(

/\/removewelcome/,

async(msg)=>{



if(

!imageAdmin(msg.from.id)

)

return;







await removeSetting(

"welcome_image"

);







bot.sendMessage(

msg.chat.id,

`

❌ Welcome Image Removed


Bot will use normal text welcome.

`

);



});









// ===============================
// CHECK IMAGE STATUS
// ===============================


bot.onText(

/\/welcomeinfo/,

async(msg)=>{



if(

!imageAdmin(msg.from.id)

)

return;








const image =

await getSetting(

"welcome_image"

);








bot.sendMessage(

msg.chat.id,

image

?

`

🖼 Welcome Image:

✅ Active

`

:

`

🖼 Welcome Image:

❌ Not Set

`

);



});









// ===============================
// SETTINGS BUTTON HANDLER
// ===============================


bot.on(

"callback_query",

async(query)=>{



if(

query.data !== "welcome_image"

)

return;







if(

!imageAdmin(query.from.id)

)

return;







bot.sendMessage(

query.message.chat.id,

`

🖼 Welcome Image Management


/setwelcome

➡️ Change Image


/removewelcome

➡️ Remove Image


/welcomeinfo

➡️ Status

`

);



});









// ===============================
// EXPORT
// ===============================


global.CineX.imageAdmin =

imageAdmin;



// ===============================
// END PART 11/13
// ===============================
// =====================================================
// CineXClub Bot
// FINAL CLEAN INDEX.JS
// PART 12/13
// Auto Delete System
// Download Counter
// Thumbnail Support
// Cleanup
// =====================================================


const {

    bot,
    deleteTimers

} = global.CineX;



const {

    increaseDownload,
    getSetting

} = global.CineX;









// ===============================
// GET DELETE TIME
// ===============================


async function getDeleteTime(){


try{


const time =

await getSetting(

"auto_delete"

);






return time ?

Number(time)

:

10;



}

catch(err){



return 10;



}



}









// ===============================
// SEND PROTECTED VIDEO
// ===============================


async function sendProtectedVideo(

chatId,

userId,

content

){



try{



let message;







const caption =

`

🎬 ${content.title}


📌 Type:

${content.type}


🎞 Quality:

${content.quality || "N/A"}


🔊 Audio:

${content.audio || "N/A"}


📦 Size:

${content.size || "N/A"}


⚡ CineXClub

`;








if(content.thumbnail){



message =

await bot.sendVideo(

chatId,

content.file_id,

{

caption,

thumb:

content.thumbnail

}

);



}

else{



message =

await bot.sendVideo(

chatId,

content.file_id,

{

caption

}

);



}








// DOWNLOAD COUNT


await increaseDownload(

content.content_id,

userId

);








// AUTO DELETE


const minutes =

await getDeleteTime();








const timer =

setTimeout(

async()=>{



try{



await bot.deleteMessage(

chatId,

message.message_id

);





deleteTimers.delete(

message.message_id

);



}

catch(err){



console.log(

"Delete Error:",

err.message

);



}



},

minutes * 60 * 1000

);








deleteTimers.set(

message.message_id,

timer

);






}

catch(err){



console.log(

"Send Video Error:",

err.message

);



bot.sendMessage(

chatId,

"❌ Video sending failed"

);



}



}









// ===============================
// CLEAR TIMER
// ===============================


function clearTimer(messageId){



const timer =

deleteTimers.get(

messageId

);







if(timer){



clearTimeout(timer);



deleteTimers.delete(

messageId

);



}



}









// ===============================
// CLEAR ALL TIMERS
// ===============================


bot.onText(

/\/cleartimers/,

async(msg)=>{



if(

msg.from.id.toString()

!==

global.CineX.ADMIN_ID.toString()

)

return;







deleteTimers.forEach(

timer=>{


clearTimeout(timer);


}

);







deleteTimers.clear();








bot.sendMessage(

msg.chat.id,

`

✅ All delete timers cleared

`

);



});









// ===============================
// EXPORT
// ===============================


global.CineX.sendProtectedVideo =

sendProtectedVideo;



global.CineX.clearTimer =

clearTimer;



// ===============================
// END PART 12/13
// ===============================
// =====================================================
// CineXClub Bot
// FINAL CLEAN INDEX.JS
// PART 13/13
// Final Handlers + Health + Bot Finish
// =====================================================


const {

    bot

} = global.CineX;



const {

    pool

} = global.CineX;









// ===============================
// HELP COMMAND
// ===============================


bot.onText(

/\/help/,

(msg)=>{


bot.sendMessage(

msg.chat.id,

`

🎬 CineXClub Help


🔎 Search:

Use Search button


📩 Request:

/request Movie Name


📥 Download:

Open content and click Watch


Commands:


/start

/help


`

);



});









// ===============================
// ADMIN PANEL COMMAND
// ===============================


bot.onText(

/\/panel/,

(msg)=>{



if(

msg.from.id.toString()

!==

global.CineX.ADMIN_ID.toString()

)

return;







global.CineX.sendAdminPanel(

msg.chat.id

);



});









// ===============================
// HEALTH CHECK LOOP
// ===============================


setInterval(

async()=>{


try{


await pool.query(

"SELECT NOW()"

);



console.log(

"✅ Database Health OK"

);



}

catch(err){


console.log(

"❌ Database Health Failed",

err.message

);



}



},

5 * 60 * 1000

);









// ===============================
// BOT START MESSAGE
// ===============================


console.log(`


================================


🎬 CineXClub Bot Online


ACTIVE FEATURES:


✅ PostgreSQL Database

✅ Admin Panel

✅ Movie Upload

✅ Series Upload

✅ Anime Upload

✅ Request System

✅ Accept / Reject Notification

✅ Statistics

✅ Broadcast

✅ Settings

✅ Welcome Image Database

✅ Force Join

✅ Deep Link

✅ Movie Details

✅ Series Details

✅ Anime Details

✅ Season / Episode

✅ Search System

✅ Duplicate Protection

✅ Auto Delete

✅ User Database

✅ Download Counter

✅ Thumbnail Support

✅ Render Health Check

✅ Error Handling


================================


`);









// ===============================
// END FINAL INDEX.JS
// ===============================
