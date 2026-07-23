// ===================================================
// CineXClub Bot
// FINAL PRODUCTION INDEX.JS
// PART 1
// Setup + Environment + Database + Bot Start
// ===================================================


require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const express = require("express");


// ===================================================
// ENV
// ===================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

const ADMIN_ID = Number(process.env.ADMIN_ID);

const FORCE_CHANNEL = process.env.FORCE_CHANNEL || "";

const ADMIN_BOT_USERNAME =
process.env.ADMIN_BOT_USERNAME || "";


// ===================================================
// CHECK ENV
// ===================================================

if(!BOT_TOKEN){
    console.log("BOT_TOKEN missing");
    process.exit(1);
}


if(!DATABASE_URL){
    console.log("DATABASE_URL missing");
    process.exit(1);
}


// ===================================================
// EXPRESS SERVER
// RENDER KEEP ALIVE
// ===================================================

const app = express();


app.get("/",(req,res)=>{

    res.send(
        "CineXClub Bot Running"
    );

});


const PORT =
process.env.PORT || 3000;


app.listen(PORT,()=>{

    console.log(
        "Server running on",
        PORT
    );

});


// ===================================================
// POSTGRES
// ===================================================

const pool = new Pool({

    connectionString:DATABASE_URL,

    ssl:{
        rejectUnauthorized:false
    }

});


pool.on(
"error",
(err)=>{

console.log(
"PostgreSQL Error:",
err.message
);

});



// ===================================================
// BOT
// ===================================================

const bot =
new TelegramBot(

    BOT_TOKEN,

    {
        polling:{
            interval:300,
            autoStart:true
        }
    }

);



bot.on(
"polling_error",

(error)=>{

console.log(
"Polling Error:",
error.message
);

});



console.log(
"CineXClub Bot Started"
);



// ===================================================
// STATES
// ===================================================


const userSearchState =
new Map();


const adminUploadState =
new Map();


const adminSettingsState =
new Map();



// ===================================================
// CREATE TABLES
// ===================================================


async function initDatabase(){


await pool.query(`

CREATE TABLE IF NOT EXISTS contents (

id SERIAL PRIMARY KEY,

content_id TEXT UNIQUE NOT NULL,

title TEXT NOT NULL,

type TEXT NOT NULL,

collection TEXT,

year INTEGER,

season INTEGER,

episode INTEGER,

quality TEXT,

audio TEXT,

size TEXT,

language TEXT,

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);

`);




await pool.query(`

CREATE TABLE IF NOT EXISTS users (

id SERIAL PRIMARY KEY,

user_id BIGINT UNIQUE NOT NULL,

username TEXT,

joined_at TIMESTAMP DEFAULT NOW()

);

`);




await pool.query(`

CREATE TABLE IF NOT EXISTS requests (

id SERIAL PRIMARY KEY,

user_id BIGINT,

username TEXT,

request TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

`);
await pool.query(`
DROP TABLE IF EXISTS settings;

CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT
);
`);



await pool.query(`

CREATE TABLE IF NOT EXISTS settings (

id SERIAL PRIMARY KEY,

setting_key TEXT UNIQUE NOT NULL,

setting_value TEXT

);

`);
await pool.query(`

ALTER TABLE settings

ADD COLUMN IF NOT EXISTS setting_value TEXT;

`);



console.log(
"Database Ready"
);


}



initDatabase()
.catch(error=>{

console.log(
"Database Init Error:",
error.message
);

});




// ===================================================
// BASIC DB TEST
// ===================================================


async function dbQuery(query,params=[]){

    const result =
    await pool.query(
        query,
        params
    );

    return result;

}



// ===================================================
// PART 2 CONTINUES...
// ===================================================
// ===================================================
// PART 2
// USER SYSTEM + FORCE JOIN + WELCOME SYSTEM
// ===================================================



// ===================================================
// SAVE USER
// ===================================================

async function saveUser(msg){


try{


const userId =
msg.from.id;


const username =
msg.from.username ||
msg.from.first_name ||
"User";



await dbQuery(

`
INSERT INTO users
(
 user_id,
 username
)

VALUES
($1,$2)

ON CONFLICT(user_id)

DO UPDATE SET

username=$2

`,

[
userId,
username
]

);



}catch(error){


console.log(
"Save User Error:",
error.message
);


}



}




// ===================================================
// USERNAME FORMAT
// ===================================================

function formatName(user){


let name =
user.username ||
user.first_name ||
"User";


name =
name.replace("@","");


return (
name.charAt(0).toUpperCase()
+
name.slice(1)
);


}





// ===================================================
// FORCE JOIN CHECK
// ===================================================

async function isJoined(userId){


try{


if(!FORCE_CHANNEL)
return true;



const member =
await bot.getChatMember(

FORCE_CHANNEL,

userId

);



return [

"creator",

"administrator",

"member"

].includes(
member.status
);



}catch(error){


return false;


}



}





// ===================================================
// FORCE JOIN BUTTON
// ===================================================

function joinButton(){


return {

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

text:"✅ Joined",

callback_data:"check_join"

}

]


]

};


}




// ===================================================
// SETTINGS GET
// ===================================================

async function getSetting(key){


try{


const result =
await dbQuery(

`
SELECT setting_value

FROM settings

WHERE setting_key=$1

`,

[key]

);



if(result.rows.length){

return result.rows[0].setting_value;

}



return null;



}catch(error){


console.log(
"Get Setting Error:",
error.message
);


return null;


}



}




// ===================================================
// SETTINGS SAVE
// ===================================================

async function saveSetting(key,value){


await dbQuery(

`

INSERT INTO settings

(
setting_key,
setting_value
)

VALUES
($1,$2)


ON CONFLICT(setting_key)

DO UPDATE SET

setting_value=$2

`,

[
key,
value
]

);



}





// ===================================================
// GET WELCOME IMAGES
// ===================================================

async function getWelcomeImages(){


const data =
await getSetting(
"welcome_images"
);



if(!data)
return [];



try{


return JSON.parse(data);



}catch(error){


return [];


}



}




// ===================================================
// DEFAULT WELCOME CAPTION
// ===================================================

async function getWelcomeCaption(username){


let caption =
await getSetting(
"welcome_caption"
);



if(!caption){


caption =

`
👋 Welcome {name}

🎬 CineXClub Bot

Search your favourite Movies, Series & Anime.

Control By:
@CineXclub
`;

}



return caption.replace(
"{name}",
username
);



}




// ===================================================
// SEND WELCOME
// ===================================================

async function sendWelcome(msg){


const chatId =
msg.chat.id;


const username =
formatName(msg.from);



const caption =
await getWelcomeCaption(
username
);



const images =
await getWelcomeImages();



const keyboard = {

inline_keyboard:[


[

{

text:"⚙ Admin Bot",

url:
`https://t.me/${ADMIN_BOT_USERNAME.replace("@","")}`

}

],


[

{

text:"❌ Close",

callback_data:"close_welcome"

}

]


]

};





if(images.length){


const image =

images[
Math.floor(
Math.random()*images.length
)
];



await bot.sendPhoto(

chatId,

image,

{

caption:caption,

reply_markup:keyboard

}

);



}else{


await bot.sendMessage(

chatId,

caption,

{

reply_markup:keyboard

}

);


}



}




// ===================================================
// PART 3 CONTINUES...
// ===================================================
// ===================================================
// PART 3
// START SYSTEM + SEARCH + YEAR FLOW
// ===================================================



// ===================================================
// ADMIN PANEL
// ===================================================

async function openAdminPanel(chatId){


await bot.sendMessage(

chatId,

`
⚙ CineXClub Admin Panel
`,

{

reply_markup:{

inline_keyboard:[


[
{
text:"📤 Upload",
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
text:"📢 Broadcast",
callback_data:"admin_broadcast"
}
],


[
{
text:"📥 Requests",
callback_data:"admin_requests"
}
],


[
{
text:"🖼 Welcome Settings",
callback_data:"welcome_settings"
}
],


[
{
text:"⚙ Bot Settings",
callback_data:"bot_settings"
}
]


]

}

}

);


}






// ===================================================
// START COMMAND
// ===================================================


bot.onText(

/\/start(?:\s(.+))?/,

async(msg,match)=>{


try{


const userId =
msg.from.id;



await saveUser(msg);



// ADMIN DIRECT PANEL

if(userId === ADMIN_ID){


await openAdminPanel(
msg.chat.id
);


return;

}




// FORCE JOIN

const joined =
await isJoined(userId);



if(!joined){


await bot.sendMessage(

msg.chat.id,

"⚠️ Please join our channel first.",

{

reply_markup:
joinButton()

}

);


return;

}




// DEEP LINK

const contentId =
match[1];



if(contentId){


const result =
await dbQuery(

`

SELECT *

FROM contents

WHERE content_id=$1

`,

[
contentId
]

);



if(result.rows.length){


await showContentDetails(

msg.chat.id,

result.rows[0],

null

);



}else{


await bot.sendMessage(

msg.chat.id,

"❌ File not found.",

{

reply_markup:{

inline_keyboard:[

[

{

text:"🔎 Google Search",

url:
`https://www.google.com/search?q=${encodeURIComponent(contentId)}`

}

]

]

}

}

);


}



return;

}




// NORMAL USER WELCOME


await sendWelcome(msg);



}catch(error){


console.log(
"Start Error:",
error.message
);


}



});







// ===================================================
// SEARCH MESSAGE
// ===================================================


bot.on(

"message",

async(msg)=>{


try{


if(!msg.text)
return;



if(msg.text.startsWith("/"))
return;



if(msg.from.id===ADMIN_ID)
return;



const text =
msg.text.trim();



const result =
await dbQuery(

`

SELECT DISTINCT title

FROM contents

WHERE LOWER(title)

LIKE LOWER($1)

LIMIT 20

`,

[

`%${text}%`

]

);



if(!result.rows.length){


await bot.sendMessage(

msg.chat.id,

`
❌ No file found.

Please type exact spelling.
`

);


return;

}





const buttons =
result.rows.map(item=>[

{

text:item.title,

callback_data:
`title_${item.title}`

}

]);





await bot.sendMessage(

msg.chat.id,

"🔎 Select your Movie, Series, or Anime",

{

reply_markup:{

inline_keyboard:
buttons

}

}

);



}catch(error){


console.log(
"Search Error:",
error.message
);


}


});








// ===================================================
// SHOW YEAR SELECTION
// ===================================================


async function showContentDetails(

chatId,

content,

messageId

){



const result =
await dbQuery(

`

SELECT DISTINCT year

FROM contents

WHERE title=$1

ORDER BY year

`,

[
content.title
]

);



const buttons =

result.rows.map(row=>[

{

text:String(row.year),

callback_data:
`year_${content.title}_${row.year}`

}

]);





const text =

`
🎬 ${content.title}

Select Year:
`;





if(messageId){


await bot.editMessageText(

text,

{

chat_id:chatId,

message_id:messageId,

reply_markup:{

inline_keyboard:
buttons

}

}

);



}else{


await bot.sendMessage(

chatId,

text,

{

reply_markup:{

inline_keyboard:
buttons

}

}

);



}



}





// ===================================================
// PART 4 CONTINUES...
// ===================================================
// ===================================================
// PART 4
// CALLBACK SYSTEM + YEAR + QUALITY + FILE DELIVERY
// ===================================================



// ===================================================
// AUTO DELETE TIME
// ===================================================

async function getDeleteTime(){


const value =
await getSetting(
"auto_delete_time"
);



if(!value)
return 1800;


return Number(value);


}






// ===================================================
// SEND FILE
// ===================================================

async function sendFile(chatId,content){


try{


const message =
await bot.sendVideo(

chatId,

content.file_id,

{

caption:

`
🎬 ${content.title}

📅 Year: ${content.year || "N/A"}

🎞 Quality: ${content.quality || "N/A"}

🔊 Audio: ${content.audio || "N/A"}

🌐 Language: ${content.language || "N/A"}

🍿 Enjoy CineXClub

Control By:
@CineXclub
`

}

);





const deleteTime =
await getDeleteTime();





setTimeout(()=>{


bot.deleteMessage(

chatId,

message.message_id

)

.catch(()=>{});



},

deleteTime * 1000

);





}catch(error){


console.log(
"Send File Error:",
error.message
);



}



}






// ===================================================
// CALLBACK HANDLER
// ===================================================


bot.on(

"callback_query",

async(query)=>{


try{


const data =
query.data;


const chatId =
query.message.chat.id;


const messageId =
query.message.message_id;



// =============================
// CLOSE WELCOME
// =============================


if(data==="close_welcome"){


await bot.deleteMessage(

chatId,

messageId

)
.catch(()=>{});



await bot.sendMessage(

chatId,

`

🔎 Search your Movie, Series, or Anime name

Example:
Iron Man 1
Stranger Things S01E01
Naruto Episode 1

⚠️ Please type the exact spelling.
Incorrect spelling will not return any file.

`

);



return;

}






// =============================
// CHECK JOIN
// =============================


if(data==="check_join"){


const joined =
await isJoined(
query.from.id
);



if(joined){


await bot.answerCallbackQuery(

query.id,

{
text:"✅ Joined Successfully"
}

);


await sendWelcome(
query.message
);



}else{


await bot.answerCallbackQuery(

query.id,

{
text:"❌ Please join channel first"
}

);


}



return;

}






// =============================
// TITLE SELECT
// =============================


if(data.startsWith("title_")){


const title =
data.replace(
"title_",
""
);



const result =
await dbQuery(

`

SELECT *

FROM contents

WHERE title=$1

LIMIT 1

`,

[
title
]

);



if(result.rows.length){


await showContentDetails(

chatId,

result.rows[0],

messageId

);


}



return;

}







// =============================
// YEAR SELECT
// =============================


if(data.startsWith("year_")){


const parts =
data.split("_");


const title =
parts[1];


const year =
parts[2];



await bot.editMessageText(

`

🎬 ${title}

📅 Year: ${year}

Select Quality:

`,

{

chat_id:chatId,

message_id:messageId,

reply_markup:{

inline_keyboard:[


[

{

text:"480p",

callback_data:
`quality_${title}_${year}`

}

],


[

{

text:"720p",

callback_data:
`quality_${title}_${year}`

}

],


[

{

text:"1080p",

callback_data:
`quality_${title}_${year}`

}

]


]

}

}

);



return;

}







// =============================
// QUALITY SELECT
// =============================


if(data.startsWith("quality_")){


const parts =
data.split("_");


const title =
parts[1];


const year =
parts[2];




await bot.editMessageText(

`

⏳ Fetching your file...

Please wait.

`,

{

chat_id:chatId,

message_id:messageId

}

);





const result =
await dbQuery(

`

SELECT *

FROM contents

WHERE title=$1

AND year=$2

LIMIT 1

`,

[

title,

Number(year)

]

);





if(result.rows.length){


await bot.deleteMessage(

chatId,

messageId

)
.catch(()=>{});



await sendFile(

chatId,

result.rows[0]

);



}else{


await bot.editMessageText(

"❌ File not found.",

{

chat_id:chatId,

message_id:messageId

}

);


}



return;

}





}catch(error){


console.log(
"Callback Error:",
error.message
);



}


});




// ===================================================
// PART 5 CONTINUES...
// ===================================================
// ===================================================
// PART 5
// ADMIN UPLOAD + SETTINGS + FILE SAVE
// ===================================================



// ===================================================
// CAPTION PARSER
// ===================================================

function parseCaption(text){


const data={};


if(!text)
return data;



text.split("\n").forEach(line=>{


const index =
line.indexOf(":");



if(index === -1)
return;



const key =
line
.substring(0,index)
.trim()
.toLowerCase();



const value =
line
.substring(index+1)
.trim();



data[key]=value;



});



return data;


}





// ===================================================
// ADMIN CALLBACK MENU
// ===================================================


bot.on(

"callback_query",

async(query)=>{


try{


const data =
query.data;


const chatId =
query.message.chat.id;


const userId =
query.from.id;



if(userId !== ADMIN_ID)
return;




// UPLOAD START

if(data==="admin_upload"){



adminUploadState.set(

userId,

{
step:"type"
}

);



await bot.sendMessage(

chatId,

"Select Upload Type",

{

reply_markup:{

inline_keyboard:[

[
{
text:"🎬 Movie",
callback_data:"upload_type_Movie"
}
],

[
{
text:"📺 Series",
callback_data:"upload_type_Series"
}
],

[
{
text:"🔥 Anime",
callback_data:"upload_type_Anime"
}
]

]

}

}

);



return;

}





// TYPE SELECT

if(data.startsWith("upload_type_")){


const type =
data.replace(
"upload_type_",
""
);



adminUploadState.set(

userId,

{
type:type,
step:"quality"
}

);



await bot.sendMessage(

chatId,

"Select Quality",

{

reply_markup:{

inline_keyboard:[

[
{
text:"480p",
callback_data:"upload_quality_480p"
}
],

[
{
text:"720p",
callback_data:"upload_quality_720p"
}
],

[
{
text:"1080p",
callback_data:"upload_quality_1080p"
}
]

]

}

}

);



return;

}






// QUALITY SELECT

if(data.startsWith("upload_quality_")){


const quality =
data.replace(
"upload_quality_",
""
);



let state =
adminUploadState.get(
userId
);



if(!state)
return;



state.quality =
quality;


state.step =
"caption";



adminUploadState.set(
userId,
state
);



await bot.sendMessage(

chatId,

`
Send Caption:

Example:

ID: ironman1
Title: Iron Man 1
Year: 2008
Collection:
Season:
Episode:
Audio:
Language:
Size:
`

);



return;

}






// STATISTICS

if(data==="admin_stats"){


const result =
await dbQuery(

`
SELECT COUNT(*) 
FROM contents
`

);



await bot.sendMessage(

chatId,

`

📊 Total Files:

${result.rows[0].count}

`

);



return;

}






// WELCOME SETTINGS

if(data==="welcome_settings"){


await bot.sendMessage(

chatId,

`

🖼 Welcome Settings


Choose:

`

,

{

reply_markup:{

inline_keyboard:[


[
{
text:"🖼 Change Images",
callback_data:"change_images"
}
],

[
{
text:"✏️ Change Caption",
callback_data:"change_caption"
}
],

[
{
text:"👁 Preview",
callback_data:"preview_welcome"
}
]


]

}

}

);



return;

}






}catch(error){


console.log(
"Admin Callback Error:",
error.message
);



}


});







// ===================================================
// ADMIN MESSAGE RECEIVER
// ===================================================


bot.on(

"message",

async(msg)=>{


try{


const userId =
msg.from.id;



if(userId !== ADMIN_ID)
return;



const state =
adminUploadState.get(
userId
);



// SAVE CAPTION

if(
state &&
state.step==="caption" &&
msg.text
){


state.caption =
msg.text;


state.step =
"file";


adminUploadState.set(
userId,
state
);



await bot.sendMessage(

msg.chat.id,

"📤 Now send the video file."

);



return;

}






// RECEIVE FILE

if(
state &&
state.step==="file"
){


let fileId = null;



if(msg.video){

fileId =
msg.video.file_id;

}



if(msg.document){

fileId =
msg.document.file_id;

}



if(!fileId)
return;




const details =
parseCaption(
state.caption
);



const contentId =
details.id;



if(!contentId){

await bot.sendMessage(
msg.chat.id,
"❌ ID missing."
);

return;

}





const exists =
await dbQuery(

`
SELECT id
FROM contents
WHERE content_id=$1
`,

[
contentId
]

);



if(exists.rows.length){


await bot.sendMessage(

msg.chat.id,

"❌ Duplicate ID."

);


adminUploadState.delete(
userId
);


return;

}







await dbQuery(

`

INSERT INTO contents

(

content_id,
title,
type,
collection,
year,
season,
episode,
quality,
audio,
size,
language,
file_id

)

VALUES

($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)

`

,

[

contentId,

details.title || "Unknown",

state.type,

details.collection || null,

details.year ? Number(details.year):null,

details.season ? Number(details.season):null,

details.episode ? Number(details.episode):null,

state.quality,

details.audio || null,

details.size || null,

details.language || null,

fileId

]

);




await bot.sendMessage(

msg.chat.id,

"✅ Upload Successful"

);



adminUploadState.delete(
userId
);



}



}catch(error){


console.log(
"Admin Message Error:",
error.message
);



}


});




// ===================================================
// PART 6 CONTINUES...
// ===================================================
// ===================================================
// PART 6
// WELCOME SETTINGS + BOT SETTINGS + BROADCAST + FINAL
// ===================================================



// ===================================================
// ADMIN SETTINGS STATES
// ===================================================


const welcomeImageState = new Map();

const broadcastState = new Map();




// ===================================================
// WELCOME SETTINGS CALLBACK
// ===================================================


bot.on(
"callback_query",
async(query)=>{


try{


const data =
query.data;

const userId =
query.from.id;

const chatId =
query.message.chat.id;



if(userId !== ADMIN_ID)
return;



// CHANGE IMAGES

if(data==="change_images"){


welcomeImageState.set(
userId,
[]
);


await bot.sendMessage(

chatId,

`
🖼 Send 3 welcome images.

Send photos one by one.
After 3 images send /done
`

);


return;

}




// CHANGE CAPTION

if(data==="change_caption"){


adminSettingsState.set(

userId,

{
step:"caption"
}

);



await bot.sendMessage(

chatId,

"✏️ Send new welcome caption."

);



return;

}





// PREVIEW

if(data==="preview_welcome"){


await sendWelcome(
query.message
);



return;

}





// BOT SETTINGS

if(data==="bot_settings"){



await bot.sendMessage(

chatId,

"⚙ Bot Settings",

{

reply_markup:{

inline_keyboard:[


[
{
text:"⏱ 5 Minutes",
callback_data:"delete_300"
}
],


[
{
text:"⏱ 10 Minutes",
callback_data:"delete_600"
}
],


[
{
text:"⏱ 30 Minutes",
callback_data:"delete_1800"
}
],


[
{
text:"❌ Disable",
callback_data:"delete_0"
}
]


]

}

}

);



return;

}





// AUTO DELETE SET

if(data.startsWith("delete_")){


const time =
data.replace(
"delete_",
""
);



await saveSetting(

"auto_delete_time",

time

);



await bot.sendMessage(

chatId,

"✅ Auto Delete Updated"

);



return;

}





// BROADCAST

if(data==="admin_broadcast"){


broadcastState.set(
userId,
true
);


await bot.sendMessage(

chatId,

"📢 Send broadcast message."

);


return;

}



}catch(error){


console.log(
"Settings Callback Error:",
error.message
);


}



});







// ===================================================
// ADMIN SETTINGS MESSAGE HANDLER
// ===================================================


bot.on(
"message",

async(msg)=>{


try{


const userId =
msg.from.id;



if(userId !== ADMIN_ID)
return;



// WELCOME IMAGES

if(
welcomeImageState.has(userId)
){


if(msg.text==="/done"){


const images =
welcomeImageState.get(userId);



await saveSetting(

"welcome_images",

JSON.stringify(images)

);



welcomeImageState.delete(
userId
);



await bot.sendMessage(

msg.chat.id,

"✅ Welcome Images Updated"

);



return;

}




if(msg.photo){


const photo =
msg.photo[
msg.photo.length-1
]
.file_id;



let images =
welcomeImageState.get(userId);



images.push(photo);



welcomeImageState.set(
userId,
images
);



await bot.sendMessage(

msg.chat.id,

`Image Saved (${images.length}/3)`

);



}



return;

}





// WELCOME CAPTION

const setting =
adminSettingsState.get(
userId
);



if(
setting &&
setting.step==="caption"
){



await saveSetting(

"welcome_caption",

msg.text

);



adminSettingsState.delete(
userId
);



await bot.sendMessage(

msg.chat.id,

"✅ Welcome Caption Updated"

);



return;

}






// BROADCAST

if(
broadcastState.has(userId)
){



const users =
await dbQuery(

`
SELECT user_id
FROM users
`

);



for(
const user of users.rows
){


await bot.sendMessage(

user.user_id,

msg.text

)
.catch(()=>{});


}



broadcastState.delete(
userId
);



await bot.sendMessage(

msg.chat.id,

"✅ Broadcast Completed"

);



}



}catch(error){


console.log(
"Settings Message Error:",
error.message
);



}


});






// ===================================================
// REQUESTS VIEW
// ===================================================


bot.on(
"text",
async(msg)=>{


if(msg.text!=="/requests")
return;


if(msg.from.id!==ADMIN_ID)
return;



const result =
await dbQuery(

`
SELECT *
FROM requests
ORDER BY id DESC
LIMIT 20
`

);



let text =
"📥 Requests\n\n";



result.rows.forEach(r=>{


text +=
`${r.username}: ${r.request}\n`;



});



await bot.sendMessage(

msg.chat.id,

text

);



});







// ===================================================
// ERROR HANDLING
// ===================================================


process.on(

"uncaughtException",

(error)=>{


console.log(
"System Error:",
error.message
);


});



process.on(

"unhandledRejection",

(error)=>{


console.log(
"Promise Error:",
error
);


});




// ===================================================
// FINAL READY
// ===================================================


console.log(

"🚀 CineXClub Production Bot Ready"

);
