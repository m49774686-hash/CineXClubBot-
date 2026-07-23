// ===================================================
// CineXClub Bot v3
// PART 1/15
// Setup + Environment + Core
// ===================================================


require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const express = require("express");


// ======================
// ENV
// ======================

const BOT_TOKEN = process.env.BOT_TOKEN;

const DATABASE_URL = process.env.DATABASE_URL;

const BOT_USERNAME = process.env.BOT_USERNAME;

const STORAGE_CHANNEL = process.env.STORAGE_CHANNEL;

const FORCE_CHANNEL = process.env.FORCE_CHANNEL;

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;


// ======================
// EXPRESS SERVER
// ======================

const app = express();


app.get("/",(req,res)=>{

    res.send("🎬 CineXClub Bot Running");

});


const PORT = process.env.PORT || 3000;


app.listen(PORT,()=>{

    console.log(`
================================

🌐 Server Running

Port : ${PORT}

================================
`);

});



// ======================
// TELEGRAM BOT
// ======================

const bot = new TelegramBot(

    BOT_TOKEN,

    {

        polling:{

            interval:300,

            timeout:10,

            autoStart:true

        }

    }

);



console.log("🤖 Telegram Bot Starting...");



// ======================
// POSTGRESQL
// ======================


const pool = new Pool({

    connectionString:DATABASE_URL,

    ssl:{

        rejectUnauthorized:false

    }

});



// ======================
// GLOBAL STATES
// ======================


const uploadState = new Map();

const searchState = new Map();

const settingsState = new Map();

const requestState = new Map();

const broadcastState = new Map();



// ======================
// ADMIN CHECK
// ======================


function isAdmin(userId){

    return String(userId) === String(ADMIN_CHAT_ID);

}



// ======================
// USERNAME
// ======================


function getUsername(user){

    if(user.username)

        return "@"+user.username;


    return user.first_name || "User";

}



// ======================
// DATABASE CONNECTION TEST
// ======================


async function databaseCheck(){

    try{


        await pool.query(
            "SELECT NOW()"
        );


        console.log(
            "🟢 PostgreSQL Connected"
        );


    }catch(err){


        console.log(
            "🔴 Database Error:",
            err.message
        );


    }

}



databaseCheck();



// ======================
// BOT INFO
// ======================


bot.getMe()

.then(info=>{


console.log(`
================================

🤖 Bot Started

Name : ${info.first_name}

Username : @${info.username}

================================
`);


})

.catch(err=>{

console.log(
"Bot Error:",
err.message
);

});



// ======================
// ERROR HANDLING
// ======================


bot.on("polling_error",(err)=>{


console.log(

"Polling Error:",

err.message

);


});


process.on(
"unhandledRejection",
(err)=>{


console.log(
"Unhandled:",
err.message
);


});



console.log("✅ PART 1 LOADED");


// ===================================================
// PART 2 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v3
// PART 2/15
// Database + Settings System
// ===================================================


// ======================
// DATABASE INIT
// ======================


async function initDatabase(){

try{


await pool.query(`


CREATE TABLE IF NOT EXISTS contents(

id SERIAL PRIMARY KEY,

content_id TEXT UNIQUE NOT NULL,

title TEXT NOT NULL,

type TEXT NOT NULL,

collection TEXT,

season INTEGER,

episode INTEGER,

year TEXT,

quality TEXT,

language TEXT,

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);



CREATE TABLE IF NOT EXISTS users(

id SERIAL PRIMARY KEY,

user_id BIGINT UNIQUE NOT NULL,

username TEXT,

first_name TEXT,

banned BOOLEAN DEFAULT FALSE,

joined_at TIMESTAMP DEFAULT NOW()

);



CREATE TABLE IF NOT EXISTS requests(

id SERIAL PRIMARY KEY,

user_id BIGINT,

username TEXT,

request TEXT,

type TEXT,

status TEXT DEFAULT 'pending',

created_at TIMESTAMP DEFAULT NOW()

);



CREATE TABLE IF NOT EXISTS favorites(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

created_at TIMESTAMP DEFAULT NOW(),

UNIQUE(user_id,content_id)

);



CREATE TABLE IF NOT EXISTS history(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

watched_at TIMESTAMP DEFAULT NOW(),

UNIQUE(user_id,content_id)

);



CREATE TABLE IF NOT EXISTS downloads(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

downloaded_at TIMESTAMP DEFAULT NOW()

);



CREATE TABLE IF NOT EXISTS premium_users(

id SERIAL PRIMARY KEY,

user_id BIGINT UNIQUE,

username TEXT,

expiry TIMESTAMP

);



CREATE TABLE IF NOT EXISTS settings(

id SERIAL PRIMARY KEY,

setting_key TEXT UNIQUE NOT NULL,

setting_value TEXT

);



INSERT INTO settings(

setting_key,

setting_value

)

VALUES

('welcome_image',''),

('welcome_message','🎬 Welcome To CineXClub'),

('auto_delete','30')

ON CONFLICT(setting_key)

DO NOTHING;



`);



console.log("✅ Database Tables Ready");



}catch(err){


console.log(

"Database Init Error:",

err.message

);


}



}



initDatabase();




// ======================
// SAVE USER
// ======================


async function saveUser(user){


try{


await pool.query(

`

INSERT INTO users(

user_id,

username,

first_name

)

VALUES($1,$2,$3)


ON CONFLICT(user_id)

DO UPDATE SET


username=EXCLUDED.username,

first_name=EXCLUDED.first_name

`

,[

user.id,

user.username || "",

user.first_name || ""

]

);



}catch(err){


console.log(
"Save User Error:",
err.message
);


}


}





// ======================
// GET SETTING
// ======================


async function getSetting(key){


try{


const result = await pool.query(

`

SELECT setting_value

FROM settings

WHERE setting_key=$1

`

,[key]


);



if(result.rows.length)

return result.rows[0].setting_value;



}catch(err){


console.log(
"Get Setting Error:",
err.message
);


}



return "";

}




// ======================
// SET SETTING
// ======================


async function setSetting(key,value){


try{


await pool.query(

`

INSERT INTO settings(

setting_key,

setting_value

)

VALUES($1,$2)


ON CONFLICT(setting_key)

DO UPDATE SET

setting_value=EXCLUDED.setting_value

`

,[

key,

value

]

);



}catch(err){


console.log(

"Set Setting Error:",

err.message

);


}


}




console.log("✅ PART 2 LOADED");


// ===================================================
// PART 3 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v3
// PART 3/15
// Admin Panel System
// ===================================================



// ======================
// ADMIN PANEL
// ======================


function showAdminPanel(chatId){


bot.sendMessage(

chatId,

`👑 CineXClub Admin Panel

Choose Action:`,

{

reply_markup:{

inline_keyboard:[


[

{

text:"📤 Upload File",

callback_data:"admin_upload"

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

text:"⚙ Settings",

callback_data:"admin_settings"

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

text:"🖼 Welcome Preview",

callback_data:"welcome_preview"

}

]


]

}

}

);


}





// ======================
// ADMIN START
// ======================


bot.onText(/^\/admin$/,

async(msg)=>{


if(!isAdmin(msg.from.id))

return;



showAdminPanel(

msg.chat.id

);



});





// ======================
// NORMAL /START ADMIN CHECK
// ======================


bot.onText(/^\/start$/,

async(msg)=>{


await saveUser(msg.from);



if(isAdmin(msg.from.id)){


return showAdminPanel(

msg.chat.id

);


}



});





// ======================
// ADMIN BUTTON HANDLER
// ======================


bot.on(

"callback_query",

async(query)=>{


const chatId=query.message.chat.id;



if(!isAdmin(query.from.id))

return;



const data=query.data;



// UPLOAD

if(data==="admin_upload"){


uploadState.set(

chatId,

{

step:"type"

}

);



return bot.sendMessage(

chatId,

`📤 Upload System Started

Select Type:`,

{

reply_markup:{

inline_keyboard:[


[

{

text:"🎬 Movie",

callback_data:"upload_movie"

}

],


[

{

text:"📺 Series",

callback_data:"upload_series"

}

],


[

{

text:"🍥 Anime",

callback_data:"upload_anime"

}

]


]

}

}

);


}



// STATISTICS

if(data==="admin_stats"){


const result=await pool.query(

"SELECT COUNT(*) FROM contents"

);


return bot.sendMessage(

chatId,

`📊 Total Files:

${result.rows[0].count}`

);


}



// SETTINGS

if(data==="admin_settings"){


return bot.sendMessage(

chatId,

"⚙ Settings Panel Coming..."

);


}



// BROADCAST

if(data==="admin_broadcast"){


broadcastState.set(

chatId,

true

);


return bot.sendMessage(

chatId,

"📢 Send broadcast message"

);


}



});





console.log("✅ PART 3 LOADED");


// ===================================================
// PART 4 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v3
// PART 4/15
// Upload Wizard System
// ===================================================



// ======================
// TYPE SELECT
// ======================


bot.on(
"callback_query",
async(query)=>{


const chatId=query.message.chat.id;


if(!isAdmin(query.from.id))
return;



if(

query.data==="upload_movie" ||

query.data==="upload_series" ||

query.data==="upload_anime"

){


let type="";


if(query.data==="upload_movie")
type="Movie";


if(query.data==="upload_series")
type="Series";


if(query.data==="upload_anime")
type="Anime";



uploadState.set(

chatId,

{

step:"caption",

type:type

}

);



return bot.sendMessage(

chatId,

`🎬 Type Selected:

${type}


Now send caption details.`

);



}



});





// ======================
// ADMIN UPLOAD MESSAGE
// ======================


bot.on(

"message",

async(msg)=>{


const chatId=msg.chat.id;



if(!isAdmin(msg.from.id))
return;



if(!uploadState.has(chatId))
return;



const data=uploadState.get(chatId);





// ======================
// CAPTION STEP
// ======================


if(data.step==="caption"){



if(!msg.text)
return;



data.caption=msg.text;


data.step="quality";


uploadState.set(

chatId,

data

);



return bot.sendMessage(

chatId,

`🎥 Select Quality`,

{

reply_markup:{

inline_keyboard:[


[

{

text:"480p",

callback_data:"quality_480"

},

{

text:"720p",

callback_data:"quality_720"

}

],


[

{

text:"1080p",

callback_data:"quality_1080"

}

]


]

}

}

);



}





});




// ======================
// QUALITY SELECT
// ======================


bot.on(

"callback_query",

async(query)=>{


const chatId=query.message.chat.id;



if(!isAdmin(query.from.id))
return;



if(

query.data.startsWith("quality_")

){


const quality=query.data.replace(

"quality_",

""

);



const data=uploadState.get(chatId);



if(!data)
return;



data.quality=quality;

data.step="file";



uploadState.set(

chatId,

data

);



return bot.sendMessage(

chatId,

`✅ Quality:

${quality}p


📁 Now send video/file.`

);



}



});




// ======================
// FILE WAITING MESSAGE
// ======================


console.log(`

📤 Upload Flow:

Type
 ↓
Caption
 ↓
Quality
 ↓
File

`);




console.log("✅ PART 4 LOADED");


// ===================================================
// PART 5 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v3
// PART 5/15
// File Upload + Storage Save
// ===================================================



// ======================
// FILE RECEIVER
// ======================


bot.on(
"message",
async(msg)=>{


const chatId = msg.chat.id;



if(!isAdmin(msg.from.id))
return;



if(!uploadState.has(chatId))
return;



const data = uploadState.get(chatId);



if(data.step !== "file")
return;




let fileId = null;



// VIDEO

if(msg.video){


fileId = msg.video.file_id;


}



// DOCUMENT (MKV)

else if(msg.document){


fileId = msg.document.file_id;


}



else{


return bot.sendMessage(

chatId,

"❌ Please send video or MKV file."

);


}




// ======================
// SEND TO STORAGE CHANNEL
// ======================


try{


const storageMsg = await bot.sendDocument(

STORAGE_CHANNEL,

fileId,

{

caption:

`🎬 ${data.caption}


📂 Type: ${data.type}

🎥 Quality: ${data.quality}p

🆔 Upload By: Admin`

}

);





let savedFileId = fileId;



if(storageMsg.document)

savedFileId =
storageMsg.document.file_id;



if(storageMsg.video)

savedFileId =
storageMsg.video.file_id;






// ======================
// CREATE CONTENT ID
// ======================


const contentId =

Date.now().toString();






// ======================
// SAVE DATABASE
// ======================


await pool.query(

`

INSERT INTO contents(

content_id,

title,

type,

quality,

file_id

)

VALUES($1,$2,$3,$4,$5)

`,

[

contentId,

data.caption,

data.type,

data.quality,

savedFileId

]

);






// CLEAR STATE

uploadState.delete(chatId);






await bot.sendMessage(

chatId,

`✅ File Saved Successfully


🆔 ID:

${contentId}


📤 Upload another file`

);





}catch(err){



console.log(

"Upload Error:",

err.message

);



bot.sendMessage(

chatId,

"❌ Upload Failed"

);



}



});





console.log("✅ PART 5 LOADED");


// ===================================================
// PART 6 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v3
// PART 6/15
// Caption Parser System
// ===================================================



// ======================
// PARSE CAPTION
// ======================


function parseCaption(text){


const data={

title:"",

type:"Movie",

collection:"",

season:null,

episode:null,

year:"",

quality:""

};



const lines=text.split("\n");



for(let line of lines){


const parts=line.split(":");


if(parts.length<2)
continue;



const key=parts[0]
.trim()
.toLowerCase();



const value=parts
.slice(1)
.join(":")
.trim();



if(key==="type")

data.type=value;



if(key==="title")

data.title=value;



if(key==="collection")

data.collection=value;



if(key==="season")

data.season=parseInt(value);



if(key==="episode")

data.episode=parseInt(value);



if(key==="year")

data.year=value;



if(key==="quality")

data.quality=value;



}



return data;


}





// ======================
// UPDATE UPLOAD SAVE
// ======================


// Existing upload database save override


async function saveContent(

contentId,

fileId,

caption

){



const data=parseCaption(caption);



await pool.query(

`

INSERT INTO contents(

content_id,

title,

type,

collection,

season,

episode,

year,

quality,

file_id

)

VALUES(

$1,$2,$3,$4,$5,$6,$7,$8,$9

)


ON CONFLICT(content_id)

DO UPDATE SET

title=EXCLUDED.title,

type=EXCLUDED.type,

collection=EXCLUDED.collection,

season=EXCLUDED.season,

episode=EXCLUDED.episode,

year=EXCLUDED.year,

quality=EXCLUDED.quality,

file_id=EXCLUDED.file_id

`

,[


contentId,

data.title || "Unknown",

data.type || "Movie",

data.collection,

data.season,

data.episode,

data.year,

data.quality,

fileId


]

);



return data;


}





// ======================
// EXAMPLE FORMAT
// ======================


/*

Movie:

Type: Movie
Title: Deadpool
Year: 2016
Quality: 1080p


Series:

Type: Series
Title: Stranger Things S01E01
Collection: Stranger Things
Season: 1
Episode: 1
Quality: 720p


Anime:

Type: Anime
Title: Naruto Episode 1
Collection: Naruto
Season: 1
Episode: 1
Quality: 1080p


*/





console.log("✅ PART 6 LOADED");


// ===================================================
// PART 7 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v3
// PART 8/15
// File Sending System
// ===================================================



// ======================
// FORCE JOIN CHECK
// ======================


async function checkJoin(userId){


if(!FORCE_CHANNEL)

return true;



try{


const member = await bot.getChatMember(

FORCE_CHANNEL,

userId

);



if(

member.status==="member" ||

member.status==="administrator" ||

member.status==="creator"

)

return true;



return false;



}catch(err){


return false;


}


}





// ======================
// SEND FORCE JOIN
// ======================


async function sendJoinMessage(chatId){


return bot.sendMessage(

chatId,

`🔒 Join our channel to access files`,

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






// ======================
// VERIFY JOIN
// ======================


bot.on(

"callback_query",

async(query)=>{


if(query.data!=="verify_join")

return;



const joined = await checkJoin(

query.from.id

);



if(joined){


return bot.sendMessage(

query.message.chat.id,

"✅ Verified Successfully"

);


}



bot.answerCallbackQuery(

query.id,

{

text:"❌ Join channel first",

show_alert:true

}

);



});





// ======================
// FILE BUTTON
// ======================


bot.on(

"callback_query",

async(query)=>{


if(

!query.data.startsWith("file_")

)

return;



const chatId=query.message.chat.id;

const userId=query.from.id;



// Force Join

const joined = await checkJoin(userId);



if(!joined){


return sendJoinMessage(chatId);


}



const contentId=query.data.replace(

"file_",

""

);




const result = await pool.query(

`

SELECT *

FROM contents

WHERE content_id=$1

`

,[contentId]

);




if(!result.rows.length)

return bot.sendMessage(

chatId,

"❌ File not found"

);




const item=result.rows[0];





let caption = "";



if(item.type==="Movie"){


caption=

`🎬 Here Is Your Movie


${item.title}


🎥 Quality: ${item.quality || "N/A"}`;


}



else{


caption=

`🎬 Here Is Your ${item.type}


${item.title}


📺 Season: ${item.season || "N/A"}

🎞 Episode: ${item.episode || "N/A"}

🎥 Quality: ${item.quality || "N/A"}`;

}





// SEND FILE


const sent = await bot.sendDocument(

chatId,

item.file_id,

{

caption:caption

}

);





// SAVE DOWNLOAD


await pool.query(

`

INSERT INTO downloads(

user_id,

content_id

)

VALUES($1,$2)

`

,[

userId,

contentId

]

);






// Auto Delete after Part 13

console.log(

"File sent:",

contentId

);



});





console.log("✅ PART 8 LOADED");


// ===================================================
// PART 9 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v3
// PART 9/15
// Series + Anime System
// ===================================================



// ======================
// COLLECTION BUTTON
// ======================


bot.on(
"callback_query",
async(query)=>{


if(

!query.data.startsWith("collection_")

)

return;



const chatId=query.message.chat.id;



const collection=query.data.replace(

"collection_",

""

);



const result = await pool.query(

`

SELECT DISTINCT season

FROM contents

WHERE collection=$1

ORDER BY season ASC

`

,[collection]

);



if(!result.rows.length)

return;



let buttons=[];



result.rows.forEach(row=>{


buttons.push([

{

text:`Season ${row.season}`,

callback_data:

`season_${collection}_${row.season}`

}

]);


});



buttons.push([

{

text:"📚 All Episodes",

callback_data:`all_${collection}`

}

]);




bot.sendMessage(

chatId,

`📺 ${collection}

Select Season`,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



});





// ======================
// SEASON EPISODES
// ======================


bot.on(
"callback_query",
async(query)=>{


if(

!query.data.startsWith("season_")

)

return;



const chatId=query.message.chat.id;



const data=query.data.split("_");



const collection=data[1];

const season=data[2];




const result = await pool.query(

`

SELECT

content_id,

title,

episode

FROM contents

WHERE collection=$1

AND season=$2

ORDER BY episode ASC

`

,[

collection,

season

]

);




let buttons=[];



result.rows.forEach(item=>{


buttons.push([


{

text:`Episode ${item.episode}`,

callback_data:`content_${item.content_id}`

}


]);


});





bot.sendMessage(

chatId,

`🎞 ${collection}

Season ${season}

Select Episode`,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



});





// ======================
// ALL EPISODES
// ======================


bot.on(

"callback_query",

async(query)=>{


if(

!query.data.startsWith("all_")

)

return;



const chatId=query.message.chat.id;



const collection=query.data.replace(

"all_",

""

);




const result = await pool.query(

`

SELECT

content_id,

title,

episode

FROM contents

WHERE collection=$1

ORDER BY season,episode

`

,[collection]

);



let text=

`📚 ${collection}

All Episodes:

\n`;



result.rows.forEach(item=>{


text +=

`${item.episode}. ${item.title}\n`;


});



bot.sendMessage(

chatId,

text

);



});





// ======================
// CATEGORY LIST
// ======================


async function showCategories(chatId){


bot.sendMessage(

chatId,

`🎬 Select Category`,

{

reply_markup:{

inline_keyboard:[


[

{

text:"🎬 Movies",

callback_data:"category_movie"

}

],


[

{

text:"📺 Series",

callback_data:"category_series"

}

],


[

{

text:"🍥 Anime",

callback_data:"category_anime"

}

]


]

}

}

);



}





console.log("✅ PART 9 LOADED");


// ===================================================
// PART 10 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v3
// PART 10/15
// Request System
// ===================================================



// ======================
// REQUEST BUTTON HANDLER
// ======================


bot.on(
"callback_query",
async(query)=>{


const chatId=query.message.chat.id;



if(

query.data==="request_movie" ||

query.data==="request_series" ||

query.data==="request_anime"

){


let type="Movie";


if(query.data==="request_series")
type="Series";


if(query.data==="request_anime")
type="Anime";



requestState.set(

chatId,

{

type:type

}

);



return bot.sendMessage(

chatId,

`📝 Send ${type} Name`

);


}



});





// ======================
// REQUEST MESSAGE
// ======================


bot.on(
"message",
async(msg)=>{


const chatId=msg.chat.id;



if(!requestState.has(chatId))
return;



if(!msg.text)
return;



const data=requestState.get(chatId);



requestState.delete(chatId);




await pool.query(

`

INSERT INTO requests(

user_id,

username,

request,

type

)

VALUES($1,$2,$3,$4)

`

,[

msg.from.id,

msg.from.username || "",

msg.text,

data.type

]

);





// USER MESSAGE


bot.sendMessage(

chatId,

`✅ Request Sent


🎬 ${data.type}

${msg.text}

Admin will check soon.`

);





// ADMIN NOTIFICATION


if(ADMIN_CHAT_ID){


bot.sendMessage(

ADMIN_CHAT_ID,

`

📩 New Request


👤 User:

${msg.from.first_name}


🎬 Type:

${data.type}


📝 Request:

${msg.text}

`,

{

reply_markup:{

inline_keyboard:[


[

{

text:"✅ Accept",

callback_data:

`accept_request_${msg.from.id}_${data.type}_${encodeURIComponent(msg.text)}`

}

]

]

}

}

);


}



});





// ======================
// ACCEPT REQUEST
// ======================


bot.on(

"callback_query",

async(query)=>{


if(

!query.data.startsWith("accept_request_")

)

return;



if(!isAdmin(query.from.id))
return;



const data=query.data.split("_");



const userId=data[2];

const type=data[3];

const movie=decodeURIComponent(

data.slice(4).join("_")

);





await pool.query(

`

UPDATE requests

SET status='completed'

WHERE user_id=$1

AND request=$2

`

,[

userId,

movie

]

);





// ADMIN MESSAGE


bot.sendMessage(

query.message.chat.id,

`✅ Request Accepted


${movie}

Now add file in upload panel.`

);





// USER NOTIFICATION


bot.sendMessage(

userId,

`🎉 Your ${type} Added


${movie}


Thank you for requesting.`

);





});





console.log("✅ PART 10 LOADED");


// ===================================================
// PART 11 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v3
// PART 11/15
// Welcome System
// ===================================================



// ======================
// GET WELCOME MESSAGE
// ======================


async function getWelcomeMessage(){


let msg = await getSetting(

"welcome_message"

);



if(!msg)

msg =

`🎬 Welcome To CineXClub Bot`;


return msg;


}





// ======================
// SEND WELCOME
// ======================


async function sendWelcome(chatId){



const image = await getSetting(

"welcome_image"

);


const message = await getWelcomeMessage();




if(image){


return bot.sendPhoto(

chatId,

image,

{

caption:message,

parse_mode:"HTML"

}

);


}




return bot.sendMessage(

chatId,

message,

{

parse_mode:"HTML",

reply_markup:{

inline_keyboard:[


[

{

text:"🎬 Movies",

callback_data:"category_movie"

}

],


[

{

text:"📺 Series",

callback_data:"category_series"

}

],


[

{

text:"🍥 Anime",

callback_data:"category_anime"

}

],


[

{

text:"🔍 Search",

callback_data:"search_movie"

}

]


]

}

}

);


}






// ======================
// USER START
// ======================


bot.onText(

/^\/start/,

async(msg)=>{


await saveUser(msg.from);



if(isAdmin(msg.from.id))

return;



await sendWelcome(

msg.chat.id

);



});







// ======================
// WELCOME SETTINGS MENU
// ======================


bot.on(

"callback_query",

async(query)=>{


const chatId=query.message.chat.id;



if(!isAdmin(query.from.id))

return;



if(query.data==="admin_settings"){



return bot.sendMessage(

chatId,

`⚙ Welcome Settings`,

{

reply_markup:{

inline_keyboard:[


[

{

text:"🖼 Change Welcome Image",

callback_data:"change_welcome_image"

}

],


[

{

text:"✏️ Change Welcome Text",

callback_data:"change_welcome_text"

}

],


[

{

text:"❌ Remove Welcome Image",

callback_data:"remove_welcome_image"

}

]


]

}

}

);



}



});





// ======================
// CHANGE IMAGE
// ======================


bot.on(

"callback_query",

async(query)=>{


if(query.data!=="change_welcome_image")

return;



if(!isAdmin(query.from.id))
return;



settingsState.set(

query.message.chat.id,

"welcome_image"

);



bot.sendMessage(

query.message.chat.id,

"🖼 Send new welcome image"

);



});





// ======================
// CHANGE TEXT
// ======================


bot.on(

"callback_query",

async(query)=>{


if(query.data!=="change_welcome_text")

return;



if(!isAdmin(query.from.id))
return;



settingsState.set(

query.message.chat.id,

"welcome_message"

);



bot.sendMessage(

query.message.chat.id,

"✏️ Send new welcome message"

);



});





// ======================
// REMOVE IMAGE
// ======================


bot.on(

"callback_query",

async(query)=>{


if(query.data!=="remove_welcome_image")

return;



if(!isAdmin(query.from.id))
return;



await setSetting(

"welcome_image",

""

);



bot.sendMessage(

query.message.chat.id,

"✅ Welcome image removed"

);



});





// ======================
// SAVE SETTINGS INPUT
// ======================


bot.on(

"message",

async(msg)=>{


const chatId=msg.chat.id;



if(!settingsState.has(chatId))
return;



if(!isAdmin(msg.from.id))
return;



const type=settingsState.get(chatId);



if(type==="welcome_image" && msg.photo){



const photo = msg.photo[

msg.photo.length-1

].file_id;



await setSetting(

"welcome_image",

photo

);



}



if(type==="welcome_message" && msg.text){



await setSetting(

"welcome_message",

msg.text

);



}



settingsState.delete(chatId);



bot.sendMessage(

chatId,

"✅ Welcome Settings Updated"

);



});





console.log("✅ PART 11 LOADED");


// ===================================================
// PART 12 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v3
// PART 12/15
// Force Join + Deep Link
// ===================================================



// ======================
// FORCE JOIN CHECK
// ======================


async function checkForceJoin(userId){


if(!FORCE_CHANNEL)

return true;



try{


const member = await bot.getChatMember(

FORCE_CHANNEL,

userId

);



return (

member.status==="member" ||

member.status==="administrator" ||

member.status==="creator"

);



}catch(err){


return false;


}



}





// ======================
// FORCE JOIN MESSAGE
// ======================


function forceJoinMessage(chatId,contentId){



bot.sendMessage(

chatId,

`🔒 Please Join Our Channel First

After joining click Verify`,

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

callback_data:

`verify_${contentId}`

}

]


]

}

}

);



}





// ======================
// DEEP LINK START
// ======================


bot.onText(

/^\/start(?:\s+(.+))?/,

async(msg,match)=>{


await saveUser(msg.from);



const chatId=msg.chat.id;



const param = match[1];



// Normal Start

if(!param){


if(isAdmin(msg.from.id))

return showAdminPanel(chatId);



return sendWelcome(chatId);


}





// Movie ID Link


const joined = await checkForceJoin(

msg.from.id

);



if(!joined){


return forceJoinMessage(

chatId,

param

);


}





const result = await pool.query(

`

SELECT *

FROM contents

WHERE content_id=$1

`

,[

param

]

);



if(!result.rows.length){


return bot.sendMessage(

chatId,

"❌ File Not Found In Our Database"

);


}





const item=result.rows[0];





bot.sendMessage(

chatId,

`

🎬 ${item.title}


📂 Type:

${item.type}


${item.year ? "📅 Year: "+item.year : ""}


🎥 Select Quality

`

,

{

reply_markup:{

inline_keyboard:[


[

{

text:"480p",

callback_data:`file_${item.content_id}`

},


{

text:"720p",

callback_data:`file_${item.content_id}`

}

],


[

{

text:"1080p",

callback_data:`file_${item.content_id}`

}

]


]

}

}

);



});





// ======================
// VERIFY LINK
// ======================


bot.on(

"callback_query",

async(query)=>{


if(

!query.data.startsWith("verify_")

)

return;



const contentId=query.data.replace(

"verify_",

""

);



const joined=await checkForceJoin(

query.from.id

);



if(!joined){


return bot.answerCallbackQuery(

query.id,

{

text:"❌ Join channel first",

show_alert:true

}

);


}



const result=await pool.query(

`

SELECT title

FROM contents

WHERE content_id=$1

`

,[contentId]

);



if(!result.rows.length)

return;



bot.sendMessage(

query.message.chat.id,

`✅ Verified

🎬 ${result.rows[0].title}

Select Quality`

);



});





console.log("✅ PART 12 LOADED");


// ===================================================
// PART 13 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v3
// PART 13/15
// Auto Delete System
// ===================================================



// ======================
// DELETE MESSAGE FUNCTION
// ======================


async function autoDeleteMessage(

chatId,

messageId

){


try{


const time = await getSetting(

"auto_delete"

);



const minutes = Number(time) || 30;



setTimeout(async()=>{


try{


await bot.deleteMessage(

chatId,

messageId

);



}catch(err){


console.log(

"Delete Error:",

err.message

);


}



},

minutes * 60 * 1000);



}catch(err){


console.log(

"Auto Delete Error:",

err.message

);


}



}




// ======================
// SEND + AUTO DELETE
// ======================


async function sendTempMessage(

chatId,

text,

options={}

){


const msg = await bot.sendMessage(

chatId,

text,

options

);



autoDeleteMessage(

chatId,

msg.message_id

);



return msg;


}





// ======================
// FILE AUTO DELETE
// ======================


async function sendFileWithDelete(

chatId,

fileId,

options={}

){



const msg = await bot.sendDocument(

chatId,

fileId,

options

);



autoDeleteMessage(

chatId,

msg.message_id

);



return msg;


}




// ======================
// ADMIN CHANGE DELETE TIME
// ======================


bot.on(

"callback_query",

async(query)=>{


if(query.data!=="change_delete_time")

return;



if(!isAdmin(query.from.id))

return;



settingsState.set(

query.message.chat.id,

"auto_delete"

);



bot.sendMessage(

query.message.chat.id,

`⏱ Send delete time in minutes

Example:

10`

);



});






// ======================
// SAVE DELETE TIME
// ======================


bot.on(

"message",

async(msg)=>{


const chatId=msg.chat.id;



if(!settingsState.has(chatId))

return;



if(

settingsState.get(chatId)!=="auto_delete"

)

return;



if(!isAdmin(msg.from.id))

return;



if(!msg.text)
return;



await setSetting(

"auto_delete",

msg.text

);



settingsState.delete(chatId);



bot.sendMessage(

chatId,

`✅ Auto Delete Updated

Time:

${msg.text} minutes`

);



});





console.log("✅ PART 13 LOADED");


// ===================================================
// PART 14 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v3
// PART 14/15
// Error Handling + Production Safety
// ===================================================



// ======================
// DATABASE SAFE QUERY
// ======================


async function safeQuery(query,params=[]){


try{


return await pool.query(

query,

params

);



}catch(err){


console.log(

"Database Query Error:",

err.message

);



return null;


}



}




// ======================
// BOT ERROR LOG
// ======================


bot.on(

"polling_error",

(error)=>{


console.log(`

🔴 Telegram Error

${error.message}

`);

});





bot.on(

"webhook_error",

(error)=>{


console.log(

"Webhook Error:",

error.message

);


});





// ======================
// PROCESS ERRORS
// ======================


process.on(

"uncaughtException",

(error)=>{


console.log(`

❌ Uncaught Exception

${error.message}

`);


});




process.on(

"unhandledRejection",

(error)=>{


console.log(`

❌ Unhandled Rejection

${error.message || error}

`);


});





// ======================
// DATABASE CONNECTION CHECK
// ======================


setInterval(async()=>{


try{


await pool.query(

"SELECT NOW()"

);



console.log(

"🟢 Database Alive"

);



}catch(err){



console.log(

"🔴 Database Down",

err.message

);



}



},300000);






// ======================
// BOT HEALTH LOG
// ======================


setInterval(()=>{


console.log(`

🟢 CineXClub Bot Running

${new Date().toISOString()}

`);



},600000);






// ======================
// GRACEFUL SHUTDOWN
// ======================


process.on(

"SIGTERM",

async()=>{


console.log(

"🛑 Render Shutdown"

);



await pool.end();



process.exit(0);



});



process.on(

"SIGINT",

async()=>{


console.log(

"🛑 Bot Stopped"

);



await pool.end();



process.exit(0);



});





console.log("✅ PART 14 LOADED");


// ===================================================
// PART 15 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v3
// PART 15/15
// Final Startup
// ===================================================



// ======================
// FINAL START CHECK
// ======================


async function finalStart(){


try{


const db = await pool.query(

"SELECT NOW()"

);



console.log(`

================================

🎬 CineXClub Bot v3

================================

🟢 Database Connected

`);




const info = await bot.getMe();



console.log(`

🤖 Bot Online

Name:

${info.first_name}


Username:

@${info.username}


================================

✅ ALL SYSTEMS READY

================================

`);





}catch(err){



console.log(

"Startup Failed:",

err.message

);



}



}





finalStart();





// ======================
// FINAL LOG
// ======================


console.log(`

================================

✅ PART 15 LOADED

🎬 CineXClub Bot v3 COMPLETED

================================

`);


// ===================================================
// END OF CINE X CLUB BOT v3
// ===================================================
