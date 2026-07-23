// =====================================================
// CineXClub Bot
// FINAL INDEX.JS
// PART 1/13
// Setup + Environment + Database + Bot Start
// =====================================================


require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const { Pool } = require("pg");


// =============================
// ENV CONFIG
// =============================

const BOT_TOKEN = process.env.BOT_TOKEN;

const ADMIN_ID = process.env.ADMIN_ID;

const FORCE_CHANNEL = process.env.FORCE_CHANNEL;

const STORAGE_CHANNEL = process.env.STORAGE_CHANNEL;


if (!BOT_TOKEN) {
    console.log("BOT_TOKEN missing");
    process.exit(1);
}



// =============================
// BOT INIT
// =============================

const bot = new TelegramBot(
    BOT_TOKEN,
    {
        polling: {
            interval: 300,
            autoStart: true
        }
    }
);



console.log("CineXClub Bot Started");



// =============================
// DATABASE
// =============================

const pool = new Pool({

    connectionString:
        process.env.DATABASE_URL,

    ssl: {
        rejectUnauthorized:false
    }

});



pool.connect()
.then(client=>{

    console.log(
        "PostgreSQL Connected"
    );

    client.release();

})
.catch(err=>{

    console.log(
        "Database Error:",
        err.message
    );

});



// =============================
// EXPRESS HEALTH CHECK
// =============================


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
        "Health server running on",
        PORT
    );

});



// =============================
// GLOBAL VARIABLES
// =============================


const userStates = new Map();

const adminStates = new Map();

const deleteTimers = new Map();



// =============================
// ERROR HANDLING
// =============================


bot.on("polling_error",(err)=>{

    console.log(
        "Polling Error:",
        err.message
    );

});



process.on(
"unhandledRejection",
(error)=>{

    console.log(
        "Unhandled:",
        error
    );

});



process.on(
"uncaughtException",
(error)=>{

    console.log(
        "Exception:",
        error
    );

});



// =============================
// TEST COMMAND
// =============================


bot.onText(
/\/ping/,
async(msg)=>{

    bot.sendMessage(
        msg.chat.id,
        "🏓 Pong"
    );

});



// =============================
// EXPORT VARIABLES
// (Used in next parts)
// =============================


module.exports = {

    bot,

    pool,

    ADMIN_ID,

    FORCE_CHANNEL,

    STORAGE_CHANNEL,

    userStates,

    adminStates,

    deleteTimers

};
// =====================================================
// CineXClub Bot
// FINAL INDEX.JS
// PART 2/13
// PostgreSQL Tables + Database Helper Functions
// =====================================================


// =============================
// DATABASE INITIALIZATION
// =============================

async function initDatabase(){

try{


// =============================
// CONTENTS TABLE
// =============================

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



// =============================
// USERS TABLE
// =============================

await pool.query(`

CREATE TABLE IF NOT EXISTS users (

id SERIAL PRIMARY KEY,

user_id BIGINT UNIQUE NOT NULL,

username TEXT,

first_name TEXT,

joined_at TIMESTAMP DEFAULT NOW(),

downloads INTEGER DEFAULT 0

);

`);




// =============================
// REQUESTS TABLE
// =============================

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




// =============================
// SETTINGS TABLE
// =============================

await pool.query(`

CREATE TABLE IF NOT EXISTS settings (

id SERIAL PRIMARY KEY,

key TEXT UNIQUE NOT NULL,

value TEXT

);

`);





console.log(
"Database Tables Ready"
);



}

catch(err){

console.log(
"Database Init Error:",
err.message
);

}


}




// Start Database Setup

initDatabase();





// =====================================================
// USER FUNCTIONS
// =====================================================



async function saveUser(user){


try{


await pool.query(`

INSERT INTO users
(
user_id,
username,
first_name
)

VALUES
($1,$2,$3)

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
await pool.query(

"SELECT COUNT(*) FROM users"

);


return Number(
result.rows[0].count
);


}





// =====================================================
// CONTENT FUNCTIONS
// =====================================================



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





async function getContent(content_id){


try{


const result =
await pool.query(

`
SELECT *

FROM contents

WHERE content_id=$1

`,
[
content_id
]

);


return result.rows[0];


}

catch(err){

console.log(
"Get Content Error:",
err.message
);

return null;

}


}





async function increaseDownload(content_id){


try{


await pool.query(`

UPDATE contents

SET downloads =
downloads + 1

WHERE content_id=$1

`,
[
content_id
]

);



await pool.query(`

UPDATE users

SET downloads =
downloads + 1

WHERE user_id=$1

`,
[
content_id
]

);


}

catch(err){


console.log(
"Download Count Error:",
err.message
);


}


}





// =====================================================
// SETTINGS FUNCTIONS
// =====================================================



async function setSetting(key,value){


await pool.query(`

INSERT INTO settings
(key,value)

VALUES
($1,$2)


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





// =====================================================
// REQUEST FUNCTIONS
// =====================================================



async function saveRequest(
user_id,
username,
request
){


await pool.query(`

INSERT INTO requests

(
user_id,
username,
request
)

VALUES
($1,$2,$3)

`,
[
user_id,
username,
request
]

);


}





async function getPendingRequests(){


const result =
await pool.query(`

SELECT *

FROM requests

WHERE status='pending'

ORDER BY id DESC

`);


return result.rows;


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





// =====================================================
// EXPORT FOR NEXT PARTS
// =====================================================


module.exports.saveUser = saveUser;

module.exports.getUserCount = getUserCount;

module.exports.saveContent = saveContent;

module.exports.getContent = getContent;

module.exports.increaseDownload = increaseDownload;

module.exports.setSetting = setSetting;

module.exports.getSetting = getSetting;

module.exports.removeSetting = removeSetting;

module.exports.saveRequest = saveRequest;

module.exports.getPendingRequests = getPendingRequests;

module.exports.updateRequestStatus = updateRequestStatus;
 // =====================================================
// CineXClub Bot
// FINAL INDEX.JS
// PART 3/13
// User System + Force Join + Start Base Handler
// =====================================================


// =============================
// IMPORT PART 1 & 2 DATA
// =============================

const {
    bot,
    pool,
    ADMIN_ID,
    FORCE_CHANNEL,
    userStates,
    adminStates
} = module.exports;




const {
    saveUser,
    getContent,
    getSetting
} = module.exports;





// =============================
// FORCE JOIN CHECK
// =============================


async function checkForceJoin(userId){


try{


if(!FORCE_CHANNEL)

return true;



const member =
await bot.getChatMember(
    FORCE_CHANNEL,
    userId
);



if(
member.status === "member" ||
member.status === "administrator" ||
member.status === "creator"
){

return true;

}



return false;



}

catch(err){


console.log(
"Force Join Error:",
err.message
);


return false;


}


}





// =============================
// FORCE JOIN MESSAGE
// =============================


async function sendForceJoin(chatId){



const buttons = {


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





bot.sendMessage(

chatId,

`

🔒 **Join Required**

To use CineXClub Bot,

Please join our official channel first.

After joining click ✅ Joined.

`,

{

parse_mode:"Markdown",

reply_markup:buttons

}

);


}





// =============================
// SAVE USER MIDDLEWARE
// =============================


bot.on(
"message",
async(msg)=>{


if(!msg.from)

return;



try{


await saveUser(msg.from);



}

catch(err){

console.log(
"User Save Error",
err.message
);


}



});







// =============================
// START COMMAND
// =============================


bot.onText(
/\/start(?:\s(.+))?/,

async(msg,match)=>{


const chatId =
msg.chat.id;


const user =
msg.from;



// Save User

await saveUser(user);





// Force Join

const joined =
await checkForceJoin(
user.id
);



if(!joined){


return sendForceJoin(chatId);


}







// Deep Link ID

const contentId =
match[1];





if(contentId){


const content =
await getContent(contentId);



if(content){


return sendContentDetails(
chatId,
content
);


}


else{


return bot.sendMessage(

chatId,

`

❌ Video not found in our database.


`

);


}



}







// Welcome Image From Database


const welcomeImage =
await getSetting(
"welcome_image"
);






const welcomeText =

`

🎬 Welcome to CineXClub Bot


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

text:"🎬 Request Movie",

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







if(welcomeImage){



return bot.sendPhoto(

chatId,

welcomeImage,

{

caption:welcomeText,

parse_mode:"Markdown",

reply_markup:keyboard

}

);


}







bot.sendMessage(

chatId,

welcomeText,

{

parse_mode:"Markdown",

reply_markup:keyboard

}

);




});







// =============================
// CHECK JOIN BUTTON
// =============================



bot.on(
"callback_query",

async(query)=>{


if(query.data !== "check_join")

return;



const joined =
await checkForceJoin(
query.from.id
);



if(joined){


bot.answerCallbackQuery(
query.id,
{
text:"✅ Verified"
}
);



bot.sendMessage(

query.message.chat.id,

"🎉 Welcome to CineXClub!"

);



}

else{


bot.answerCallbackQuery(

query.id,

{

text:
"❌ Please join channel first"

}

);


}



});






// =============================
// SEND CONTENT DETAILS PLACEHOLDER
// (Completed in PART 4)
// =============================


async function sendContentDetails(
chatId,
content
){


bot.sendMessage(

chatId,

`

🎬 ${content.title}


Type: ${content.type}

Quality: ${content.quality || "Unknown"}

Year: ${content.year || "N/A"}


Preparing file...

`

);


}






// EXPORT

module.exports.checkForceJoin =
checkForceJoin;


module.exports.sendContentDetails =
sendContentDetails;
// =====================================================
// CineXClub Bot
// FINAL INDEX.JS
// PART 4/13
// Movie / Series / Anime Details
// Deep Link + File Sending System
// =====================================================


// =============================
// IMPORT DATA
// =============================


const {

    bot,
    deleteTimers

} = module.exports;



const {

    getContent,
    increaseDownload

} = module.exports;






// =============================
// CONTENT DETAILS PAGE
// =============================


async function sendContentDetails(
chatId,
content
){


let details = `

🎬 *${content.title}*


📌 Type: ${content.type}

`;



// Movie

if(content.type === "Movie"){


details += `

📅 Year: ${content.year || "N/A"}

🎞 Quality: ${content.quality || "N/A"}

🔊 Audio: ${content.audio || "N/A"}

📦 Size: ${content.size || "N/A"}

`;

}



// Series / Anime


if(
content.type === "Series" ||
content.type === "Anime"
){


details += `

📚 Collection:
${content.collection || "N/A"}


Season:
${content.season || "N/A"}


Episode:
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

],


[

{

text:"🔎 Search More",

callback_data:"search"

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









// =============================
// SEND FILE FUNCTION
// =============================


async function sendFile(

chatId,

content

){



try{



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


⚡ Enjoy CineXClub

`

}

);





// Increase Download Count

await increaseDownload(

content.content_id

);





// AUTO DELETE TIMER
// Default 10 Minutes


const timer = setTimeout(

async()=>{


try{


await bot.deleteMessage(

chatId,

content.message_id

);



}

catch(err){


console.log(
"Auto Delete Error:",
err.message
);


}



},

10 * 60 * 1000

);




deleteTimers.set(

chatId,

timer

);




}

catch(err){


console.log(

"Send File Error:",

err.message

);



bot.sendMessage(

chatId,

"❌ Unable to send file"

);


}



}








// =============================
// FILE BUTTON HANDLER
// =============================


bot.on(

"callback_query",

async(query)=>{



if(
!query.data.startsWith(
"send_file_"
)
)

return;




const contentId =
query.data.replace(
"send_file_",
""
);




const content =
await getContent(
contentId
);





if(!content){


return bot.answerCallbackQuery(

query.id,

{

text:
"❌ File not found"

}

);


}





await bot.answerCallbackQuery(

query.id

);




sendFile(

query.message.chat.id,

content

);



});









// =============================
// DIRECT DEEP LINK HANDLER
// =============================


async function openDeepLink(

chatId,

contentId

){



const content =
await getContent(
contentId
);



if(!content){


return bot.sendMessage(

chatId,

`

❌ Video not available.

🔎 Search on Google

`

);


}




sendContentDetails(

chatId,

content

);



}







// EXPORT


module.exports.sendContentDetails =
sendContentDetails;


module.exports.sendFile =
sendFile;


module.exports.openDeepLink =
openDeepLink;
 // =====================================================
// CineXClub Bot
// FINAL INDEX.JS
// PART 5/13
// Search System + Database Search
// =====================================================


// =============================
// IMPORT DATA
// =============================


const {

    bot,
    userStates

} = module.exports;



const {

    pool

} = module.exports;



const {

    sendContentDetails

} = module.exports;






// =============================
// SEARCH STATE
// =============================


const searchState = new Map();







// =============================
// SEARCH BUTTON
// =============================


bot.on(

"callback_query",

async(query)=>{


if(query.data !== "search")

return;




searchState.set(

query.from.id,

true

);



bot.sendMessage(

query.message.chat.id,

`

🔎 Send Movie / Series / Anime name

Example:

Iron Man

Stranger Things

Naruto

`

);


});









// =============================
// SEARCH MESSAGE HANDLER
// =============================


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



const searchText =
msg.text.trim();



searchState.delete(userId);





try{



const result =

await pool.query(`

SELECT *

FROM contents

WHERE

LOWER(title)

LIKE LOWER($1)

OR

LOWER(collection)

LIKE LOWER($1)

ORDER BY id DESC

LIMIT 10

`,

[

`%${searchText}%`

]

);







if(result.rows.length === 0){



return bot.sendMessage(

msg.chat.id,

`

❌ No results found


You can request this movie using:

/request ${searchText}

`

);


}








const buttons = {

inline_keyboard:[]

};






result.rows.forEach(content=>{


buttons.inline_keyboard.push(

[

{

text:

`🎬 ${content.title}`,

callback_data:

`detail_${content.content_id}`

}

]

);



});






bot.sendMessage(

msg.chat.id,

`

🔎 Search Results For:

*${searchText}*

`

,

{

parse_mode:"Markdown",

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

"❌ Search error"

);


}



});









// =============================
// SEARCH RESULT BUTTON
// =============================



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




if(!result.rows.length)

return;



sendContentDetails(

query.message.chat.id,

result.rows[0]

);



});









// =============================
// ADMIN / USER DIRECT SEARCH
// =============================


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






module.exports.searchState =
searchState;


module.exports.searchContent =
searchContent;
// =====================================================
// CineXClub Bot
// FINAL INDEX.JS
// PART 6/13
// Upload System
// Movie / Series / Anime Upload
// Caption Parser + Duplicate Protection
// =====================================================


// =============================
// IMPORT DATA
// =============================


const {

    bot,
    STORAGE_CHANNEL,
    ADMIN_ID

} = module.exports;



const {

    saveContent,
    getContent

} = module.exports;





// =============================
// ADMIN UPLOAD STATE
// =============================


const uploadState = new Map();







// =============================
// CAPTION PARSER
// =============================


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
data.movieid ||
data.contentid,


title:
data.title ||
"Unknown",


type:
data.type ||
"Movie",


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









// =============================
// STORAGE CHANNEL UPLOAD LISTENER
// =============================


bot.on(

"channel_post",

async(post)=>{


try{


if(
post.chat.id.toString()
!== STORAGE_CHANNEL.toString()

)

return;





if(!post.video)

return;



const caption =
post.caption || "";



const data =
parseCaption(caption);





if(!data.content_id){


console.log(
"Content ID Missing"
);


return;


}






// Duplicate Protection


const exists =
await getContent(
data.content_id
);



if(exists){


console.log(

"Duplicate Content:",

data.content_id

);


return;


}






const saved =

await saveContent({

...data,

file_id:
post.video.file_id,


thumbnail:
post.video.thumb ?
post.video.thumb.file_id :
null



});





if(saved){


console.log(

"Saved:",

saved.title

);


}



}

catch(err){



console.log(

"Upload Error:",

err.message

);


}



});









// =============================
// ADMIN MANUAL UPLOAD
// =============================


bot.onText(

/\/upload/,

async(msg)=>{



if(
msg.from.id.toString()
!== ADMIN_ID.toString()

)

return;





uploadState.set(

msg.chat.id,

"waiting_file"

);



bot.sendMessage(

msg.chat.id,

`

📤 Send Movie / Series / Anime video

Caption format:

ID: movie001

Type: Movie

Title: Iron Man

Year: 2008

Quality: 1080p

Audio: English

Size: 2GB


For Series:

Type: Series

Collection: Stranger Things

Season: 1

Episode: 1


`

);



});









// =============================
// ADMIN VIDEO SAVE
// =============================


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
msg.from.id.toString()
!== ADMIN_ID.toString()

)

return;







const caption =
msg.caption || "";



const data =
parseCaption(caption);






if(!data.content_id){


return bot.sendMessage(

msg.chat.id,

"❌ ID missing in caption"

);


}







const exists =

await getContent(

data.content_id

);





if(exists){


return bot.sendMessage(

msg.chat.id,

"⚠️ Duplicate content ID"

);


}







await saveContent({

...data,


file_id:
msg.video.file_id,


thumbnail:
msg.video.thumb ?
msg.video.thumb.file_id :
null


});






uploadState.delete(
msg.chat.id
);





bot.sendMessage(

msg.chat.id,

`

✅ Uploaded Successfully


${data.title}

`

);


});









// EXPORT


module.exports.uploadState =
uploadState;


module.exports.parseCaption =
parseCaption;
// =====================================================
// CineXClub Bot
// FINAL INDEX.JS
// PART 7/13
// Season / Episode System
// Collection Navigation
// Send All Episodes Button
// =====================================================



// =============================
// IMPORT DATA
// =============================


const {

    bot

} = module.exports;



const {

    pool

} = module.exports;



const {

    sendFile

} = module.exports;








// =============================
// GET COLLECTION EPISODES
// =============================


async function getEpisodes(collection,season){



try{


const result =

await pool.query(`

SELECT *

FROM contents

WHERE

collection=$1

AND

season=$2

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

"Episode Fetch Error",

err.message

);


return [];


}



}









// =============================
// SEASON BUTTON HANDLER
// =============================



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







// ALL EPISODES BUTTON


buttons.inline_keyboard.unshift(

[

{

text:

"📥 Send All Episodes",

callback_data:

`all_episode_${collection}_${season}`

}

]

);







bot.sendMessage(

query.message.chat.id,

`

📺 ${collection}

Season ${season}


Select Episode:

`

,

{

reply_markup:buttons

}

);



});









// =============================
// COLLECTION OPEN
// =============================


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

`Season ${row.season}`,

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


Choose Season:

`

,

{

reply_markup:buttons

}

);



}








// =============================
// SEND ALL EPISODES
// =============================



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
const episode of episodes
){



await bot.sendVideo(

query.message.chat.id,

episode.file_id,

{

caption:

`

🎬 ${episode.title}


Episode:
${episode.episode}


Quality:
${episode.quality || "N/A"}


`

}

);



await new Promise(
resolve=>setTimeout(resolve,1000)
);



}



});








// =============================
// ANIME / SERIES SEARCH COLLECTION
// =============================


async function getCollectionList(){



const result =

await pool.query(`

SELECT DISTINCT collection

FROM contents

WHERE collection IS NOT NULL

ORDER BY collection ASC

`);




return result.rows.map(
x=>x.collection
);


}








module.exports.getEpisodes =
getEpisodes;


module.exports.openCollection =
openCollection;


module.exports.getCollectionList =
getCollectionList;
// =====================================================
// CineXClub Bot
// FINAL INDEX.JS
// PART 8/13
// ADMIN PANEL CORE
// Upload + Requests + Statistics + Broadcast + Settings
// =====================================================



// =============================
// IMPORT DATA
// =============================


const {

    bot,
    ADMIN_ID,
    adminStates

} = module.exports;



const {

    getUserCount,
    getPendingRequests

} = module.exports;





// =============================
// ADMIN CHECK
// =============================


function isAdmin(id){

return id.toString()
===
ADMIN_ID.toString();

}








// =============================
// ADMIN COMMAND
// =============================


bot.onText(

/\/admin/,

async(msg)=>{


if(
!isAdmin(msg.from.id)
)

return;




sendAdminPanel(
msg.chat.id
);



});









// =============================
// ADMIN PANEL UI
// =============================


function sendAdminPanel(chatId){



const keyboard = {


inline_keyboard:[


[

{

text:"📤 Upload Content",

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









// =============================
// ADMIN BUTTON HANDLER
// =============================



bot.on(

"callback_query",

async(query)=>{



if(
!isAdmin(query.from.id)
)

return;



const chatId =
query.message.chat.id;




switch(query.data){



case "admin_upload":



adminStates.set(
chatId,
"upload"
);



bot.sendMessage(

chatId,

`

📤 Upload Mode Enabled


Send video with caption.

`

);



break;







case "admin_requests":


showRequests(chatId);


break;







case "admin_stats":


showStats(chatId);


break;







case "admin_broadcast":



adminStates.set(
chatId,
"broadcast"
);



bot.sendMessage(

chatId,

`

📢 Send broadcast message

`

);


break;







case "admin_settings":



showSettings(chatId);


break;



}



});









// =============================
// REQUEST LIST
// =============================



async function showRequests(chatId){



const requests =

await getPendingRequests();




if(!requests.length){


return bot.sendMessage(

chatId,

"✅ No Pending Requests"

);


}





let text =

"📩 Pending Requests:\n\n";




requests.forEach(r=>{


text +=

`

ID: ${r.id}

User:
${r.username || r.user_id}

Request:
${r.request}


`;

});





bot.sendMessage(

chatId,

text

);



}









// =============================
// STATISTICS
// =============================



async function showStats(chatId){



const users =

await getUserCount();





bot.sendMessage(

chatId,

`

📊 CineXClub Statistics


👥 Users:
${users}


`

);



}









// =============================
// BROADCAST SYSTEM
// =============================



bot.on(

"message",

async(msg)=>{



if(
!adminStates.has(msg.chat.id)
)

return;



if(
adminStates.get(msg.chat.id)
!=="broadcast"

)

return;



if(
!isAdmin(msg.from.id)
)

return;





const result =

await pool.query(

"SELECT user_id FROM users"

);






let count = 0;




for(
const user of result.rows
){



try{


await bot.forwardMessage(

user.user_id,

msg.chat.id,

msg.message_id

);



count++;


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
${count}

`

);



});









// =============================
// SETTINGS MENU
// =============================



function showSettings(chatId){



bot.sendMessage(

chatId,

`

⚙️ Settings


Coming options:

🖼 Welcome Image

🔒 Force Join

🧹 Auto Delete


`

);



}









// EXPORT


module.exports.isAdmin =
isAdmin;


module.exports.sendAdminPanel =
sendAdminPanel;
// =====================================================
// CineXClub Bot
// FINAL INDEX.JS
// PART 9/13
// Request Accept / Reject System
// User Notification
// Advanced Admin Controls
// =====================================================



// =============================
// IMPORT DATA
// =============================


const {

    bot,
    ADMIN_ID

} = module.exports;



const {

    updateRequestStatus,
    getPendingRequests,
    saveRequest

} = module.exports;






// =============================
// ADMIN CHECK
// =============================


function checkAdmin(id){

return id.toString()
===
ADMIN_ID.toString();

}









// =============================
// USER REQUEST COMMAND
// =============================



bot.onText(

/\/request (.+)/,

async(msg,match)=>{



const request =

match[1];





await saveRequest(

msg.from.id,

msg.from.username || "",

request

);






bot.sendMessage(

msg.chat.id,

`

✅ Request Submitted


🎬 ${request}


Admin will review your request.

`

);






// Notify Admin


bot.sendMessage(

ADMIN_ID,

`

📩 New Movie Request


User:
${msg.from.username || msg.from.id}


Request:
${request}

`

);




});









// =============================
// ADMIN REQUEST PANEL
// =============================



async function openRequestPanel(chatId){



const requests =

await getPendingRequests();






if(!requests.length){


return bot.sendMessage(

chatId,

"✅ No Pending Requests"

);


}





for(
const req of requests
){



const buttons = {


inline_keyboard:[


[

{

text:"✅ Accept",

callback_data:

`accept_req_${req.id}`

},


{

text:"❌ Reject",

callback_data:

`reject_req_${req.id}`

}

]


]

};






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

reply_markup:buttons

}

);



}



}








// =============================
// REQUEST BUTTON HANDLER
// =============================


bot.on(

"callback_query",

async(query)=>{



const data =
query.data;



if(

!data.startsWith(
"accept_req_"
)

&&

!data.startsWith(
"reject_req_"
)

)

return;







if(
!checkAdmin(query.from.id)
)

return;







const parts =
data.split("_");



const action =
parts[0];



const id =
parts[2];







// ACCEPT



if(
action==="accept"
){



await updateRequestStatus(

id,

"accepted"

);





const result =

await pool.query(`

SELECT *

FROM requests

WHERE id=$1

`,
[
id
]

);






if(result.rows.length){



const userId =

result.rows[0].user_id;






await bot.sendMessage(

userId,

`

✅ Your request accepted!


🎬 ${result.rows[0].request}


Our team will upload soon.

`

);



}







bot.answerCallbackQuery(

query.id,

{

text:"Accepted"

}

);



}








// REJECT



if(
action==="reject"
){



await updateRequestStatus(

id,

"rejected"

);






const result =

await pool.query(`

SELECT *

FROM requests

WHERE id=$1

`,
[
id
]

);





if(result.rows.length){



await bot.sendMessage(

result.rows[0].user_id,

`

❌ Your request rejected.


🎬 ${result.rows[0].request}

`

);



}





bot.answerCallbackQuery(

query.id,

{

text:"Rejected"

}

);



}




});









// =============================
// ADMIN UPLOAD CATEGORY
// =============================



bot.onText(

/\/uploadmovie/,

async(msg)=>{



if(
!checkAdmin(msg.from.id)
)

return;




bot.sendMessage(

msg.chat.id,

`

📤 Movie Upload Mode


Send video caption:

ID:
Type: Movie
Title:
Year:
Quality:

`

);



});






bot.onText(

/\/uploadseries/,

async(msg)=>{



if(
!checkAdmin(msg.from.id)
)

return;




bot.sendMessage(

msg.chat.id,

`

📺 Series Upload Mode


Caption:

ID:
Type: Series
Collection:
Season:
Episode:

`

);



});







bot.onText(

/\/uploadanime/,

async(msg)=>{



if(
!checkAdmin(msg.from.id)
)

return;




bot.sendMessage(

msg.chat.id,

`

🎌 Anime Upload Mode


Caption:

ID:
Type: Anime
Collection:
Season:
Episode:

`

);



});








module.exports.openRequestPanel =
openRequestPanel;
// =====================================================
// CineXClub Bot
// FINAL INDEX.JS
// PART 10/13
// Advanced Statistics + Broadcast Upgrade
// Settings Controls
// =====================================================



// =============================
// IMPORT DATA
// =============================


const {

    bot,
    ADMIN_ID

} = module.exports;



const {

    pool,
    setSetting,
    getSetting,
    removeSetting

} = module.exports;







// =============================
// ADMIN CHECK
// =============================


function adminOnly(id){

return id.toString()
===
ADMIN_ID.toString();

}








// =====================================================
// ADVANCED STATISTICS
// =====================================================


async function advancedStats(chatId){


try{


const users =

await pool.query(

"SELECT COUNT(*) FROM users"

);



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
"Stats Error",
err.message
);


}



}








// =====================================================
// ADMIN STAT BUTTON
// =====================================================


bot.on(

"callback_query",

async(query)=>{


if(
query.data !== "admin_stats"
)

return;



if(
!adminOnly(query.from.id)
)

return;



advancedStats(
query.message.chat.id
);



});









// =====================================================
// BROADCAST WITH TEXT / MEDIA
// =====================================================


async function startBroadcast(chatId){



bot.sendMessage(

chatId,

`

📢 Broadcast Mode


Send any message:

Text

Photo

Video

Document


`

);


}








// =============================
// BROADCAST HANDLER
// =============================


bot.on(

"message",

async(msg)=>{


if(
msg.from.id.toString()
!== ADMIN_ID.toString()

)

return;



if(
msg.text === "/broadcast"
)

{

return startBroadcast(
msg.chat.id
);

}



});









// =====================================================
// SETTINGS SYSTEM
// =====================================================



async function settingsMenu(chatId){



const welcomeImage =

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






const keyboard = {


inline_keyboard:[


[

{

text:
"🖼 Welcome Image",

callback_data:
"welcome_image"

}

],



[

{

text:
"🧹 Auto Delete",

callback_data:
"auto_delete"

}

],




[

{

text:
"🔒 Force Join",

callback_data:
"force_join_setting"

}

]



]

};






bot.sendMessage(

chatId,

`

⚙️ Bot Settings


🖼 Welcome Image:
${welcomeImage ? "ON":"OFF"}


🧹 Auto Delete:
${autoDelete || "10 Minutes"}


🔒 Force Join:
${forceJoin || "Default"}


`

,

{

reply_markup:keyboard

}

);



}









// =====================================================
// SETTINGS BUTTON HANDLER
// =====================================================


bot.on(

"callback_query",

async(query)=>{



if(
!adminOnly(query.from.id)
)

return;





const chatId =
query.message.chat.id;






switch(query.data){



case "auto_delete":



await setSetting(

"auto_delete",

"10"

);



bot.sendMessage(

chatId,

"✅ Auto Delete set to 10 minutes"

);



break;








case "force_join_setting":



await setSetting(

"force_join",

FORCE_CHANNEL || ""

);



bot.sendMessage(

chatId,

"✅ Force Join Saved"

);



break;







case "welcome_image":



bot.sendMessage(

chatId,

`

🖼 Welcome Image Management


Use:

/setwelcome

/removewelcome


`

);



break;



}



});









// =====================================================
// WELCOME IMAGE COMMAND PLACEHOLDER
// (Full system in PART 11)
// =====================================================




bot.onText(

/\/removewelcome/,

async(msg)=>{


if(
!adminOnly(msg.from.id)
)

return;



await removeSetting(

"welcome_image"

);



bot.sendMessage(

msg.chat.id,

"✅ Welcome Image Removed"

);



});







module.exports.advancedStats =
advancedStats;


module.exports.settingsMenu =
settingsMenu;
// =====================================================
// CineXClub Bot
// FINAL INDEX.JS
// PART 11/13
// Welcome Image Management
// Database Based
// settings table key: welcome_image
// =====================================================



// =============================
// IMPORT DATA
// =============================


const {

    bot,
    ADMIN_ID

} = module.exports;



const {

    setSetting,
    getSetting,
    removeSetting

} = module.exports;







// =============================
// ADMIN CHECK
// =============================


function welcomeAdmin(id){

return id.toString()
===
ADMIN_ID.toString();

}







// =============================
// SET WELCOME IMAGE COMMAND
// =============================


bot.onText(

/\/setwelcome/,

async(msg)=>{


if(
!welcomeAdmin(msg.from.id)
)

return;




bot.sendMessage(

msg.chat.id,

`

🖼 Welcome Image Setup


Please send an image now.


The image will be saved permanently in database.

`

);





// Waiting state

global.welcomeImageState =

msg.chat.id;



});









// =============================
// IMAGE RECEIVER
// =============================


bot.on(

"photo",

async(msg)=>{



if(
!welcomeAdmin(msg.from.id)
)

return;





if(
global.welcomeImageState
!== msg.chat.id
)

return;






const photos =
msg.photo;



const image =

photos[photos.length-1];






await setSetting(

"welcome_image",

image.file_id

);






global.welcomeImageState = null;






bot.sendMessage(

msg.chat.id,

`

✅ Welcome Image Updated


Saved in:

settings table

Key:
welcome_image


`

);



});









// =============================
// REMOVE WELCOME IMAGE
// =============================


bot.onText(

/\/removewelcome/,

async(msg)=>{



if(
!welcomeAdmin(msg.from.id)
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









// =============================
// CHECK CURRENT IMAGE
// =============================


bot.onText(

/\/welcomeinfo/,

async(msg)=>{



if(
!welcomeAdmin(msg.from.id)
)

return;




const image =

await getSetting(

"welcome_image"

);





bot.sendMessage(

msg.chat.id,

image ?

`

🖼 Welcome Image Status:

✅ Active


`

:

`

🖼 Welcome Image Status:

❌ Not Set


`

);



});









// =============================
// ADMIN SETTINGS BUTTON
// =============================


bot.on(

"callback_query",

async(query)=>{



if(
query.data !== "welcome_image"
)

return;



if(
!welcomeAdmin(query.from.id)
)

return;






bot.sendMessage(

query.message.chat.id,

`

🖼 Welcome Image Management


Commands:


/setwelcome

➡️ Add / Change Image


/removewelcome

➡️ Remove Image


/welcomeinfo

➡️ Check Status


`

);



});









module.exports.welcomeAdmin =
welcomeAdmin;
// =====================================================
// CineXClub Bot
// FINAL INDEX.JS
// PART 12/13
// Download Counter + Auto Delete Upgrade
// Thumbnail + File Cleanup System
// =====================================================



// =============================
// IMPORT DATA
// =============================


const {

    bot,
    deleteTimers

} = module.exports;



const {

    pool

} = module.exports;






// =============================
// AUTO DELETE TIME
// DATABASE BASED
// =============================


async function getDeleteTime(){


try{


const result =

await pool.query(`

SELECT value

FROM settings

WHERE key='auto_delete'

`);




if(result.rows.length){


return Number(
result.rows[0].value
);


}




return 10;



}

catch(err){


return 10;


}



}









// =============================
// SAVE DOWNLOAD LOG
// =============================


async function addDownload(

contentId,
userId

){



try{



await pool.query(`

UPDATE contents

SET downloads =
downloads + 1

WHERE content_id=$1

`,
[
contentId
]
);





await pool.query(`

UPDATE users

SET downloads =
downloads + 1

WHERE user_id=$1

`,
[
userId
]

);



}

catch(err){


console.log(

"Download Update Error",

err.message

);


}



}









// =============================
// SEND FILE WITH TIMER
// =============================



async function sendProtectedFile(

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







// DOWNLOAD COUNT


await addDownload(

content.content_id,

userId

);







// AUTO DELETE


const minutes =

await getDeleteTime();






const timer = setTimeout(

async()=>{


try{


await bot.deleteMessage(

chatId,

sent.message_id

);



console.log(

"Deleted:",

content.title

);



}

catch(err){


console.log(

"Delete Error",

err.message

);


}



},

minutes * 60 * 1000

);








deleteTimers.set(

sent.message_id,

timer

);





}

catch(err){



console.log(

"Send File Error",

err.message

);



bot.sendMessage(

chatId,

"❌ File sending failed"

);



}



}









// =============================
// THUMBNAIL SUPPORT
// =============================


async function getThumbnail(

contentId

){



const result =

await pool.query(`

SELECT thumbnail

FROM contents

WHERE content_id=$1

`,
[
contentId
]

);




if(result.rows.length)

return result.rows[0].thumbnail;



return null;



}









// =============================
// FILE DELETE MANUAL
// =============================


async function deleteFileMessage(

chatId,

messageId

){



try{


await bot.deleteMessage(

chatId,

messageId

);



}

catch(err){


console.log(

"Manual Delete Error",

err.message

);


}



}









// =============================
// CLEAN OLD TIMERS
// =============================


function clearDeleteTimer(

messageId

){



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









// =============================
// ADMIN CLEAN COMMAND
// =============================


bot.onText(

/\/cleartimers/,

async(msg)=>{



if(
msg.from.id.toString()
!==
process.env.ADMIN_ID.toString()

)

return;



deleteTimers.clear();



bot.sendMessage(

msg.chat.id,

"✅ Auto delete timers cleared"

);



});









// EXPORT


module.exports.sendProtectedFile =
sendProtectedFile;


module.exports.addDownload =
addDownload;


module.exports.getThumbnail =
getThumbnail;


module.exports.deleteFileMessage =
deleteFileMessage;


module.exports.clearDeleteTimer =
clearDeleteTimer;
// =====================================================
// CineXClub Bot
// FINAL INDEX.JS
// PART 13/13
// Final Error Handling + Missing Handlers + Bot Finish
// =====================================================


// =============================
// IMPORT DATA
// =============================


const {

    bot,
    ADMIN_ID

} = module.exports;



const {

    sendAdminPanel

} = module.exports;






// =====================================================
// HELP COMMAND
// =====================================================


bot.onText(

/\/help/,

async(msg)=>{


bot.sendMessage(

msg.chat.id,

`

🎬 CineXClub Bot Help


🔎 Search:
Use search button


📩 Request Movie:
/request Movie Name


🎥 Download:
Open movie link and click download


⚙️ Commands:

/start

/help


`

);



});









// =====================================================
// ADMIN BUTTON COMMAND
// =====================================================


bot.onText(

/\/panel/,

async(msg)=>{


if(
msg.from.id.toString()
!== ADMIN_ID.toString()
)

return;



sendAdminPanel(

msg.chat.id

);



});









// =====================================================
// CALLBACK ERROR HANDLER
// =====================================================


bot.on(

"callback_query",

async(query)=>{


try{


await bot.answerCallbackQuery(

query.id

);


}

catch(err){


console.log(

"Callback Error",

err.message

);


}



});









// =====================================================
// GLOBAL MESSAGE ERROR PROTECTION
// =====================================================


bot.on(

"error",

(err)=>{


console.log(

"Bot Error:",

err.message

);


});









// =====================================================
// DATABASE CONNECTION CHECK
// =====================================================


setInterval(

async()=>{


try{


await pool.query(
"SELECT NOW()"
);



console.log(

"Database OK"

);



}

catch(err){


console.log(

"Database reconnect check failed"

);



}



},

5 * 60 * 1000

);









// =====================================================
// BOT STATUS
// =====================================================


console.log(`

================================

🎬 CineXClub Bot Online

Features:

✅ PostgreSQL Database

✅ Admin Panel

✅ Movie Upload

✅ Series Upload

✅ Anime Upload

✅ Requests System

✅ Accept/Reject Notification

✅ Statistics

✅ Broadcast

✅ Settings

✅ Welcome Image Database System

✅ Force Join

✅ Deep Link

✅ Search

✅ Season/Episode

✅ Duplicate Protection

✅ Auto Delete

✅ User Database

✅ Download Counter

✅ Thumbnail Support

✅ Render Health Check

================================

`);





// =====================================================
// END OF FINAL INDEX.JS
// =====================================================
