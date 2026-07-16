// ================================
// CINEXCLUB BOT
// FINAL FIXED INDEX.JS PART 1
// ================================

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");


// ================================
// ENV
// ================================

const BOT_TOKEN = process.env.BOT_TOKEN;

if(!BOT_TOKEN){

console.log("❌ BOT_TOKEN Missing");
process.exit(1);

}



const BOT_USERNAME =
process.env.BOT_USERNAME || "CineXClubBot";


const FORCE_CHANNEL =
process.env.FORCE_CHANNEL || "";


const STORAGE_CHANNEL =
Number(process.env.STORAGE_CHANNEL_ID || 0);



const PUBLIC_CHANNEL =
"CineXClub";


const ADMIN_BOT =
"CineXClubBot_Adminbot";




// ================================
// BOT START
// ================================

const bot = new TelegramBot(

BOT_TOKEN,

{
polling:{
interval:300,
autoStart:true
}
}

);




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




// ================================
// KEEP ALIVE
// ================================

http.createServer(

(req,res)=>{

res.writeHead(200);

res.end(
"CineXClub Bot Running"
);

}

).listen(

process.env.PORT || 3000

);




// ================================
// AUTO DELETE
// ================================

function autoDelete(chatId,messageId){


setTimeout(()=>{


bot.deleteMessage(

chatId,

messageId

)

.catch(()=>{});



},600000);


}




async function sendAuto(

chatId,

text,

options={}

){


let msg =

await bot.sendMessage(

chatId,

text,

options

);



autoDelete(

chatId,

msg.message_id

);



return msg;


}





// ================================
// DATABASE SETUP
// ================================

async function initDatabase(){


try{


await pool.query(`

CREATE TABLE IF NOT EXISTS files(

id SERIAL PRIMARY KEY,

file_id TEXT NOT NULL,

file_type TEXT,

movie_id TEXT UNIQUE,

title TEXT,

type TEXT,

year TEXT,

season TEXT,

episode TEXT,

language TEXT,

quality TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

`);



console.log(
"✅ Database Ready"
);



}catch(err){


console.log(

"Database Error:",

err.message

);


}


}



initDatabase();





// ================================
// FORCE JOIN CHECK
// ================================

async function isJoined(userId){


try{


if(!FORCE_CHANNEL)

return true;



let member =

await bot.getChatMember(

FORCE_CHANNEL,

userId

);



return [

"member",

"administrator",

"creator"

].includes(

member.status

);



}catch(err){


return false;


}


}





// ================================
// QUOTES
// ================================

const quotes=[


"🎬 Movies are memories forever",

"🍿 Sit back and enjoy the show",

"✨ Every story deserves to be watched",

"🎞 Welcome to entertainment world"


];




function randomQuote(){


return quotes[

Math.floor(

Math.random()*quotes.length

)

];


}




// ================================
// WELCOME
// ================================

function welcome(user){


return `


🎬 <b>Welcome To CineXClub</b>


━━━━━━━━━━━━━━


👤 User:

@${user.username || user.first_name}



${randomQuote()}


━━━━━━━━━━━━━━


🍿 Movies

📺 Web Series

🍥 Anime


Enjoy Watching 🎉


`;

}





// ================================
// HOME BUTTONS
// ================================

function homeButtons(){


return {


inline_keyboard:[


[

{

text:"🎬 Request Movie",

url:

`https://t.me/${ADMIN_BOT}`

}

],


[

{

text:"📢 Join Channel",

url:

`https://t.me/${PUBLIC_CHANNEL}`

}

]


]


};


}



console.log(
"✅ Final Fixed Part 1 Loaded"
);
// ================================
// FINAL FIXED INDEX.JS PART 2
// UPLOAD SYSTEM
// ================================



// ================================
// SAVE FILE
// ================================

async function saveFile(data){

try{


await pool.query(

`

INSERT INTO files

(
file_id,
file_type,
movie_id,
title,
type,
year,
season,
episode,
language,
quality
)

VALUES
($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)


ON CONFLICT(movie_id)

DO UPDATE SET

file_id=$1,
title=$4,
type=$5,
year=$6,
season=$7,
episode=$8,
language=$9,
quality=$10

`

,

[

data.file_id,
data.file_type,
data.movie_id,
data.title,
data.type,
data.year,
data.season,
data.episode,
data.language,
data.quality

]

);


return true;


}catch(err){


console.log(
"Save Error:",
err.message
);


return false;


}


}







// ================================
// CREATE LINK
// ================================

function createBotLink(id){


return `https://t.me/${BOT_USERNAME}?start=${id}`;


}







// ================================
// STORAGE CHANNEL
// ================================


bot.on(

"channel_post",

async(msg)=>{


try{


if(

Number(msg.chat.id)

!==

Number(STORAGE_CHANNEL)

)

return;





let fileId=null;

let fileType="";





if(msg.video){


fileId =
msg.video.file_id;


fileType="video";


}



else if(msg.document){


fileId =
msg.document.file_id;


fileType="document";


}



else{


console.log(
"❌ No File"
);


return;


}





let caption =
msg.caption || "";



if(!caption){

console.log(
"❌ Caption Missing"
);

return;

}





let lines =

caption
.split("\n")
.map(x=>x.trim())
.filter(Boolean);






// ================================
// MOVIE ID
// ================================


let movieId =

lines[0]

.replace(/\s+/g,"")

.toLowerCase();






// ================================
// TITLE
// ================================


let titleLine =

lines.find(x=>

x.toLowerCase()
.startsWith("title:")

);



let title =

titleLine

?

titleLine
.replace(/title:/i,"")
.trim()

:

lines[0];






// ================================
// YEAR
// ================================


let yearLine =

lines.find(x=>

x.toLowerCase()
.startsWith("year:")

);



let year =

yearLine

?

yearLine
.replace(/year:/i,"")
.trim()

:

"";







// ================================
// AUDIO / LANGUAGE
// ================================


let audioLine =

lines.find(x=>

x.toLowerCase()
.startsWith("audio:")

);



let language =

audioLine

?

audioLine
.replace(/audio:/i,"")
.trim()

:

"Unknown";








// ================================
// QUALITY
// ================================


let qualityLine =

lines.find(x=>

x.toLowerCase()
.startsWith("quality:")

);



let quality =

qualityLine

?

qualityLine
.replace(/quality:/i,"")
.trim()

:

"720p";








// ================================
// TYPE DETECT
// ================================


let type="Movie";


if(

/s\d+/i.test(title)

||

/ep\d+/i.test(title)

||

/episode/i.test(title)

)

{

type="Series";

}


if(

/anime/i.test(title)

)

{

type="Anime";

}







let season =

(title.match(/s\d+/i)||[""])[0]
.toUpperCase();




let episode =

(title.match(/ep\d+/i)||[""])[0]
.toUpperCase();







await saveFile({

file_id:fileId,

file_type:fileType,

movie_id:movieId,

title:title,

type:type,

year:year,

season:season,

episode:episode,

language:language,

quality:quality

});







await sendAuto(

msg.chat.id,

`

✅ ${type} Saved


🎬 Title:
${title}


🆔 ID:
${movieId}


📅 Year:
${year || "N/A"}


🌐 Language:
${language}


🎞 Quality:
${quality}


🔗 Link:

${createBotLink(movieId)}

`

);





}catch(err){


console.log(

"Upload Error:",

err.message

);


}



});






console.log(
"✅ Final Fixed Part 2 Loaded"
);
// ================================
// FINAL FIXED INDEX.JS PART 3
// START SYSTEM
// ================================



// ================================
// GET FILE
// ================================

async function getFile(id){


try{


let result =

await pool.query(

`

SELECT *

FROM files

WHERE movie_id=$1

LIMIT 1

`

,

[
id.toLowerCase()
]

);



return result.rows[0] || null;



}catch(err){


console.log(
"Get File Error:",
err.message
);


return null;


}


}







// ================================
// QUALITY BUTTONS
// ================================

function qualityButtons(id){


return {


inline_keyboard:[


[

{

text:"🎞 480p",

callback_data:

`quality_${id}_480p`

},


{

text:"🎞 720p",

callback_data:

`quality_${id}_720p`

},


{

text:"🎞 1080p",

callback_data:

`quality_${id}_1080p`

}


]


]


};


}








// ================================
// NOT FOUND BUTTONS
// ================================

function notFoundButtons(id){


return {


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

],



[

{

text:"📢 Join Channel",

url:

`https://t.me/${PUBLIC_CHANNEL}`

}

]


]


};


}








// ================================
// START
// ================================


bot.onText(

/\/start(?:\s+(.+))?/,

async(msg,match)=>{


try{


let chatId =
msg.chat.id;


let user =
msg.from;






// NORMAL START

if(!match[1]){


await sendAuto(

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






// FORCE JOIN

let joined =

await isJoined(

user.id

);



if(!joined){


await sendAuto(

chatId,

`

⚠️ Please Join Our Channel First

After joining press /start again

`

,

{

reply_markup:{

inline_keyboard:[

[

{

text:"📢 Join Channel",

url:

`https://t.me/${PUBLIC_CHANNEL}`

}

]

]

}

}

);


return;


}







// START PARAMETER CLEAN

let id =

match[1]

.replace(

/^movieid:/i,

""

)

.trim()

.toLowerCase();








let file =

await getFile(id);








if(!file){


await sendAuto(

chatId,

`

❌ <b>Video Not Found</b>


This video is not available in our database.

`

,

{

parse_mode:"HTML",

reply_markup:

notFoundButtons(id)

}

);



return;


}








// DETAILS


await sendAuto(

chatId,

`

${file.type==="Series" ? "📺":"🎬"} <b>${file.title}</b>


━━━━━━━━━━━━━━


📅 Year:

${file.year || "N/A"}



🌐 Language:

${file.language || "N/A"}



🎞 Available Quality:

${file.quality || "720p"}



━━━━━━━━━━━━━━


Select Quality 👇

`

,

{

parse_mode:"HTML",

reply_markup:

qualityButtons(id)

}

);






}catch(err){


console.log(

"Start Error:",

err.message

);


await sendAuto(

msg.chat.id,

"❌ Something went wrong"

);


}


});






console.log(
"✅ Final Fixed Part 3 Loaded"
);
// ================================
// FINAL FIXED INDEX.JS PART 4
// CALLBACK + FILE SEND
// ================================



// ================================
// VIDEO CAPTION
// ================================

function fileCaption(file,quality){


return `

🎬 <b>${file.title}</b>

━━━━━━━━━━━━━━


📅 Year:
${file.year || "N/A"}


🎞 Quality:
${quality}


🌐 Language:
${file.language || "N/A"}


━━━━━━━━━━━━━━


⚡ Powered By 
<a href="https://t.me/CineXClub">CineXClub</a>


❓ Any Questions?
<a href="https://t.me/${ADMIN_BOT}">Contact Admin</a>

`;

}








// ================================
// FILE BUTTONS
// ================================

function fileButtons(){


return {


inline_keyboard:[


[

{

text:"📢 CineXClub",

url:"https://t.me/CineXClub"

}

],


[

{

text:"👤 Contact Admin",

url:

`https://t.me/${ADMIN_BOT}`

}

]


]


};


}







// ================================
// SEND FILE
// ================================

async function sendFile(

chatId,

file,

quality

){


try{


let sent =

await bot.sendDocument(

chatId,

file.file_id,

{

caption:

fileCaption(

file,

quality

),

parse_mode:"HTML",

reply_markup:

fileButtons()

}

);





autoDelete(

chatId,

sent.message_id

);





}catch(err){


console.log(

"Send File Error:",

err.message

);


}


}








// ================================
// CALLBACK QUERY
// ================================


bot.on(

"callback_query",

async(query)=>{


try{


let data =

query.data;


let chatId =

query.message.chat.id;







if(

data.startsWith("quality_")

){



let parts =

data.split("_");



let id =

parts[1];



let quality =

parts[2];






let file =

await getFile(id);






if(!file){


await bot.answerCallbackQuery(

query.id,

{

text:"❌ File Not Found",

show_alert:true

}

);


return;

}






let loading =

await sendAuto(

chatId,

"⏳ Fetching your file..."

);






setTimeout(async()=>{


await sendFile(

chatId,

file,

quality

);



},1500);






await bot.answerCallbackQuery(

query.id

);



return;


}







}catch(err){


console.log(

"Callback Error:",

err.message

);


}


});








// ================================
// ERROR HANDLING
// ================================


bot.on(

"polling_error",

(error)=>{


console.log(

"Polling Error:",

error.message

);


});






process.on(

"unhandledRejection",

(err)=>{


console.log(

"Unhandled Error:",

err.message

);


});






process.on(

"uncaughtException",

(err)=>{


console.log(

"Crash Error:",

err.message

);


});







// ================================
// ALIVE LOG
// ================================

setInterval(()=>{


console.log(

"🟢 CineXClub Bot Alive",

new Date()

);


},300000);







console.log(

"🎬 CineXClub Final Bot Loaded Successfully"

);
