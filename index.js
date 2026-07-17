// ============================================
// CineXClub Bot
// FINAL FIXED INDEX.JS
// PART 1/8
// ============================================


require("dotenv").config();


const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");



// ============================================
// ENV
// ============================================

const BOT_TOKEN = process.env.BOT_TOKEN;

const DATABASE_URL = process.env.DATABASE_URL;

const FORCE_CHANNEL = process.env.FORCE_CHANNEL;

const STORAGE_CHANNEL = process.env.STORAGE_CHANNEL;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;




// ============================================
// BOT START
// ============================================

const bot = new TelegramBot(

BOT_TOKEN,

{

polling:{

interval:300,

autoStart:true

}

}

);



console.log(
"🎬 CineXClub Bot Starting..."
);






// ============================================
// POSTGRES CONNECTION
// ============================================


const pool = new Pool({

connectionString:DATABASE_URL,

ssl:{

rejectUnauthorized:false

}

});








// ============================================
// DATABASE SETUP
// ============================================

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

quality TEXT,

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);



CREATE TABLE IF NOT EXISTS users(

id SERIAL PRIMARY KEY,

username TEXT UNIQUE,

created_at TIMESTAMP DEFAULT NOW()

);



CREATE TABLE IF NOT EXISTS requests(

id SERIAL PRIMARY KEY,

username TEXT,

request TEXT,

created_at TIMESTAMP DEFAULT NOW()

);


`);



console.log(
"✅ PostgreSQL Connected"
);



}catch(err){


console.log(
"Database Error:",
err.message
);


}


}



initDatabase();






// ============================================
// RENDER KEEP ALIVE
// ============================================


http.createServer(

(req,res)=>{

res.write(
"CineXClub Bot Running"
);

res.end();

}

).listen(

process.env.PORT || 3000

);







// ============================================
// QUOTES
// ============================================


const quotes=[


"🎬 Movies are memories waiting to happen.",


"🍿 Grab popcorn and enjoy your movie.",


"🔥 Entertainment starts here.",


"🎥 Every story deserves a chance."



];




function randomQuote(){


return quotes[

Math.floor(
Math.random()*quotes.length
)

];


}







// ============================================
// USERNAME SYSTEM
// ============================================


function getUsername(user){


if(user.username){

return "@"+user.username;

}


return "User";


}







// ============================================
// SAVE USER
// ============================================


async function saveUser(user){


try{


await pool.query(

`

INSERT INTO users(username)

VALUES($1)

ON CONFLICT(username)

DO NOTHING

`

,

[

getUsername(user)

]

);



}catch(err){}



}







console.log(
"✅ Part 1 Loaded"
);


// ============================================
// END PART 1/8
// ============================================
// ============================================
// PART 2/8
// STORAGE CHANNEL SYSTEM
// ============================================



// ============================================
// PARSE CAPTION
// ============================================

function parseCaption(caption){


let data={

type:"Movie",

title:"Unknown",

collection:null,

season:null,

episode:null,

quality:null,

content_id:null

};



let lines =
caption
.split("\n")
.map(x=>x.trim())
.filter(Boolean);



for(let line of lines){


let [key,...rest] =
line.split(":");



let value =
rest.join(":").trim();



switch(
key.toLowerCase().trim()
){


case "type":

data.type=value;

break;



case "title":

data.title=value;

break;



case "collection":

data.collection=value;

break;



case "season":

data.season=parseInt(value);

break;



case "episode":

data.episode=parseInt(value);

break;



case "quality":

data.quality=value;

break;



case "id":

data.content_id=value;

break;



case "audio":

break;


}


}





// AUTO ID

if(!data.content_id){


let cleanTitle =
data.title
.replace(/\s+/g,"");



if(
data.type==="Series" ||
data.type==="Anime"
){


data.content_id =

cleanTitle
+
"_S"+
data.season
+
"E"+
data.episode
+
"_"+
(data.quality || "")

.replace(/\s+/g,"");


}else{


data.content_id =

cleanTitle
+
"_"+
(data.quality || "")

.replace(/\s+/g,"");


}



}



return data;


}








// ============================================
// SAVE CONTENT
// ============================================

async function saveContent(data,fileId){


try{


await pool.query(

`

INSERT INTO contents

(

content_id,

title,

type,

collection,

season,

episode,

quality,

file_id

)

VALUES

($1,$2,$3,$4,$5,$6,$7,$8)


ON CONFLICT(content_id)

DO UPDATE SET

file_id=EXCLUDED.file_id,

quality=EXCLUDED.quality

`

,

[

data.content_id,

data.title,

data.type,

data.collection,

data.season,

data.episode,

data.quality,

fileId

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








// ============================================
// STORAGE CHANNEL LISTENER
// ============================================


// ================================
// STORAGE CHANNEL UPLOAD
// ================================
// ================================
// STORAGE CHANNEL UPLOAD & LIVE LOGS
// ================================
bot.on("channel_post", async (msg) => {
    // అప్‌లోడ్ పోస్ట్ రాగానే లాగ్స్ లో చూపిస్తుంది
    console.log(`\n📢 [NEW POST] స్టోరేజ్ ఛానల్ నుండి ఒక పోస్ట్ వచ్చింది! Message ID: ${msg.message_id}`);

    if (msg.chat.id.toString() !== STORAGE_CHANNEL) {
        console.log(`⚠️ [IGNORED] ఈ మెసేజ్ వేరే ఛానల్ (${msg.chat.id}) నుండి వచ్చింది, కాబట్టి ఇగ్నోర్ చేయబడింది.`);
        return;
    }
    if (!msg.video && !msg.document) {
        console.log("❌ [SKIPPED] వచ్చిన పోస్ట్‌లో వీడియో లేదా డాక్యుమెంట్ ఫైల్ లేదు.");
        return;
    }
    if (!msg.caption) {
        console.log("❌ [FAILED] ఫైల్‌కు క్యాప్షన్ (Caption) లేదు. డేటాబేస్‌లో సేవ్ చేయడంకుదరదు.");
        return;
    }

    const file_id = msg.video ? msg.video.file_id : msg.document.file_id;
    const caption = msg.caption.trim();
    
    console.log(`📝 [PROCESSING] క్యాప్షన్ టెక్స్ట్: "${caption}"`);
    const meta = getMeta(caption);
    console.log(`⚙️ [PARSED META] క్వాలిటీ: ${meta.quality} | ఆడియో: ${meta.audio} | సైజ్: ${meta.size} | ఇయర్: ${meta.year}`);

    // SERIES UPLOAD LOGIC
    if (/SeriesID:/i.test(caption) && /Episode:/i.test(caption)) {
        console.log("📺 [DETECTED] ఇది వెబ్ సిరీస్ ఫైల్.");
        
        const seriesMatch = caption.match(/SeriesID:\s*(.+)/i);
        const epMatch = caption.match(/Episode:\s*(.+)/i);
        
        if (!seriesMatch || !epMatch) {
            console.log("❌ [FAILED] SeriesID లేదా Episode ఫార్మాట్ క్యాప్షన్‌లో తప్పుగా ఉంది.");
            return;
        }

        const series_id = seriesMatch[1].trim().toLowerCase();
        const episode = epMatch[1].trim();
        
        let season = "S01";
        const seasonMatch = caption.match(/Season:\s*(.+)/i);
        if (seasonMatch) {
            season = seasonMatch[1].trim();
        }

        console.log(`⏳ [SAVING] సిరీస్ ID: ${series_id}, సీజన్: ${season}, ఎపిసోడ్: ${episode} డేటాబేస్‌లో సేవ్ అవుతోంది...`);
        const saved = await saveEpisode({
            series_id, season, episode, title: series_id,
            quality: meta.quality, audio: meta.audio, size: meta.size, language: meta.language, file_id
        });

        if (saved) {
            const link = `https://t.me{BOT_USERNAME}?start=${series_id}`;
            console.log(`✅ [SUCCESS] సిరీస్ ఎపిసోడ్ డేటాబేస్‌లో పక్కాగా సేవ్ అయింది! బోట్ లింక్: ${link}`);
            await bot.sendMessage(msg.chat.id, `✅ Episode Saved Successfully\n\n📺 Series: ${series_id}\n🎬 Episode: ${episode}\n🔗 Link:\n${link}`);
        } else {
            console.log("❌ [ERROR] సిరీస్ ఫైల్ డేటాబేస్‌లో సేవ్ చేయడంలో లోపం జరిగింది.");
        }
        return;
    }

    // MOVIE UPLOAD LOGIC
    console.log("🎬 [DETECTED] ఇది మూవీ ఫైల్.");
    let movie_id;
    if (/MovieID:/i.test(caption)) {
        const movieMatch = caption.match(/MovieID:\s*(.+)/i);
        movie_id = movieMatch ? movieMatch[1] : caption;
    } else {
        movie_id = caption;
    }
    movie_id = movie_id.replace(/\s+/g, "").toLowerCase();

    console.log(`⏳ [SAVING] మూవీ ID: ${movie_id} డేటాబేస్‌లో సేవ్ అవుతోంది...`);
    const saved = await saveMovie({
        movie_id, title: movie_id, year: meta.year,
        quality: meta.quality, audio: meta.audio, size: meta.size, language: meta.language, file_id
    });

    if (saved) {
        const link = `https://t.me{BOT_USERNAME}?start=${movie_id}`;
        console.log(`✅ [SUCCESS] మూవీ డేటాబేస్‌లో పక్కాగా సేవ్ అయింది! బోట్ లింక్: ${link}`);
        await bot.sendMessage(msg.chat.id, `✅ Movie Saved Successfully\n\n🎬 ID: ${movie_id}\n🔗 Bot Link:\n${link}`);
    } else {
        console.log("❌ [ERROR] మూవీ ఫైల్ డేటాబేస్‌లో సేవ్ చేయడంలో లోపం జరిగింది.");
    }
});


      

if(
String(msg.chat.id)
!==String(STORAGE_CHANNEL)
){

return;

}





let fileId=null;



if(msg.document){

fileId=
msg.document.file_id;

}



if(msg.video){

fileId=
msg.video.file_id;

}





if(!fileId || !msg.caption){

return;

}





let data =
parseCaption(
msg.caption
);





let saved =
await saveContent(
data,
fileId
);





if(saved){


let botInfo =
await bot.getMe();




let link =

`https://t.me/${botInfo.username}?start=${data.content_id}`;





await bot.sendMessage(

msg.chat.id,

`

✅ Saved Successfully


🎬 Title:
${data.title}


📂 Type:
${data.type}


🆔 ID:
${data.content_id}


🎥 Quality:
${data.quality || "Unknown"}


🔗 Link:

${link}

`

);



}




}catch(err){


console.log(

"Storage Error:",

err.message

);



}


});







console.log(
"✅ Part 2 Loaded"
);


// ============================================
// END PART 2/8
// ============================================
// ============================================
// PART 3/8
// START + FORCE JOIN + SEND FILE
// ============================================



// ============================================
// FORCE JOIN CHECK
// ============================================

async function checkJoin(userId){


try{


let member =
await bot.getChatMember(

FORCE_CHANNEL,

userId

);



if(
member.status==="left" ||
member.status==="kicked"
){

return false;

}



return true;



}catch(err){


return false;


}


}







// ============================================
// JOIN BUTTON
// ============================================

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

text:"✅ Continue",

callback_data:"check_join"

}

]


]


};


}







// ============================================
// GET CONTENT
// ============================================

async function getContent(id){


try{


let result =
await pool.query(

`

SELECT *

FROM contents

WHERE content_id=$1

`

,

[id]

);



return result.rows[0] || null;



}catch(err){


return null;


}


}








// ============================================
// AUTO DELETE 10 MIN
// ============================================

function autoDelete(chatId,messageId){


setTimeout(()=>{


bot.deleteMessage(

chatId,

messageId

)

.catch(()=>{});



},600000);



}








// ============================================
// SEND FILE
// ============================================

async function sendFile(chatId,data){


try{


let sent =

await bot.sendDocument(

chatId,

data.file_id,

{


caption:

`

🎬 ${data.title}


📂 Type:
${data.type}


${data.collection ?
"🎞 Collection: "+data.collection
:""}


${data.season ?
"📺 Season: "+data.season
:""}


${data.episode ?
"🎬 Episode: "+data.episode
:""}


🎥 Quality:
${data.quality || "Unknown"}


`

}

);



autoDelete(

chatId,

sent.message_id

);



}catch(err){


console.log(

"Send Error:",

err.message

);


}


}








// ============================================
// HELP BUTTONS
// ============================================

function helpButtons(title){


return {


inline_keyboard:[


[

{

text:"🔎 Google Search",

url:

`https://www.google.com/search?q=${encodeURIComponent(title)}`

}

],


[

{

text:"📝 Request Movie",

callback_data:

"request_"+title

}

],


[

{

text:"👨‍💻 Contact Admin",

url:

`https://t.me/${ADMIN_USERNAME.replace("@","")}`

}

]


]


};


}









// ============================================
// START COMMAND
// ============================================

bot.onText(

/\/start(?:\s+(.+))?/,

async(msg,match)=>{


await saveUser(
msg.from
);



let user =
getUsername(
msg.from
);



const chatId =
msg.chat.id;





// NORMAL START


if(!match[1]){


return bot.sendMessage(

chatId,

`

🎬 Welcome ${user}


${randomQuote()}


Choose your category:

`

,

{

reply_markup:{

inline_keyboard:[


[

{

text:"🎬 Movies",

callback_data:"type_Movie"

},

{

text:"📺 Series",

callback_data:"type_Series"

}

],


[

{

text:"🔥 Anime",

callback_data:"type_Anime"

}

]


]

}

}

);



}







// DEEP LINK


let id =
match[1];



let joined =
await checkJoin(

msg.from.id

);



if(!joined){


return bot.sendMessage(

chatId,

"⚠️ Please join our channel first",

{

reply_markup:
joinButton()

}

);


}





let content =
await getContent(id);



if(!content){


return bot.sendMessage(

chatId,

"❌ Video not found in our database",

{

reply_markup:

helpButtons(id)

}

);


}





sendFile(

chatId,

content

);



});







// ============================================
// JOIN CHECK CALLBACK
// ============================================

bot.on(

"callback_query",

async(query)=>{


if(
query.data==="check_join"
){


let joined =
await checkJoin(

query.from.id

);



if(joined){


bot.sendMessage(

query.message.chat.id,

"✅ Joined successfully"

);


}else{


bot.answerCallbackQuery(

query.id,

{

text:"❌ Join channel first"

}

);


}



}



});






console.log(
"✅ Part 3 Loaded"
);


// ============================================
// END PART 3/8
// ============================================
// ============================================
// PART 4/8
// CONTENT NAVIGATION SYSTEM
// ============================================



// ============================================
// GET COLLECTIONS
// ============================================

async function getCollections(type){


try{


let result =
await pool.query(

`

SELECT DISTINCT collection

FROM contents

WHERE type=$1

AND collection IS NOT NULL

ORDER BY collection

`

,

[type]

);



return result.rows;



}catch(err){

return [];

}


}







// ============================================
// GET COLLECTION MOVIES
// ============================================

async function getCollectionItems(collection){


try{


let result =
await pool.query(

`

SELECT *

FROM contents

WHERE collection=$1

ORDER BY id

`

,

[collection]

);



return result.rows;



}catch(err){

return [];

}


}







// ============================================
// GET SEASONS
// ============================================

async function getSeasons(collection){


try{


let result =
await pool.query(

`

SELECT DISTINCT season

FROM contents

WHERE collection=$1

AND season IS NOT NULL

ORDER BY season

`

,

[collection]

);



return result.rows;



}catch(err){

return [];

}


}







// ============================================
// GET EPISODES
// ============================================

async function getEpisodes(collection,season){


try{


let result =
await pool.query(

`

SELECT *

FROM contents

WHERE collection=$1

AND season=$2

ORDER BY episode

`

,

[

collection,

season

]

);



return result.rows;



}catch(err){

return [];

}


}








// ============================================
// TYPE MENU
// ============================================

async function showType(chatId,type){


let list =
await getCollections(type);



let buttons=[];



list.forEach(item=>{


buttons.push([

{

text:"🎞 "+item.collection,

callback_data:

"collection_"+item.collection

}

]);


});




bot.sendMessage(

chatId,

`

${type}

Select Collection

`

,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



}







// ============================================
// MOVIE COLLECTION MENU
// ============================================

async function showCollection(chatId,collection){


let items =
await getCollectionItems(collection);



let buttons=[];



items.forEach(item=>{


buttons.push([

{

text:

`🎬 ${item.title} ${item.quality || ""}`,

callback_data:

"play_"+item.content_id

}

]);


});




bot.sendMessage(

chatId,

`

🎞 ${collection}


Select Movie:

`

,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



}







// ============================================
// SERIES SEASON MENU
// ============================================

async function showSeasonMenu(chatId,collection){


let seasons =
await getSeasons(collection);



let buttons=[];



seasons.forEach(row=>{


buttons.push([

{

text:

`📺 Season ${row.season}`,

callback_data:

`season_${collection}_${row.season}`

}

]);


});




bot.sendMessage(

chatId,

`

📺 ${collection}


Select Season

`

,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



}








// ============================================
// EPISODE MENU
// ============================================

async function showEpisodeMenu(chatId,collection,season){


let episodes =
await getEpisodes(

collection,

season

);



let buttons=[];



episodes.forEach(ep=>{


buttons.push([

{

text:

`🎬 Episode ${ep.episode} ${ep.quality || ""}`,

callback_data:

"play_"+ep.content_id

}

]);


});





buttons.push([

{

text:"📥 Send All Episodes",

callback_data:

`all_${collection}_${season}`

}

]);





bot.sendMessage(

chatId,

`

📺 ${collection}


Season ${season}


Choose Episode:

`

,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



}








// ============================================
// CALLBACK NAVIGATION
// ============================================

bot.on(

"callback_query",

async(query)=>{


let chatId =
query.message.chat.id;


let data =
query.data;





// TYPE

if(
data.startsWith("type_")
){


let type =
data.replace(

"type_",

""

);



return showType(

chatId,

type

);


}







// COLLECTION

if(
data.startsWith("collection_")
){


let collection =
data.replace(

"collection_",

""

);



let seasons =
await getSeasons(collection);



if(seasons.length){


return showSeasonMenu(

chatId,

collection

);



}else{


return showCollection(

chatId,

collection

);



}



}







// SEASON

if(
data.startsWith("season_")
){


let parts =
data.split("_");



return showEpisodeMenu(

chatId,

parts[1],

parts[2]

);



}



});







console.log(
"✅ Part 4 Loaded"
);


// ============================================
// END PART 4/8
// ============================================
// ============================================
// PART 5/8
// QUALITY + EPISODE SENDER
// ============================================



// ============================================
// GET QUALITY FILES
// ============================================

async function getQualityFiles(contentId){


try{


let base =
contentId
.split("_")[0];



let result =
await pool.query(

`

SELECT *

FROM contents

WHERE content_id LIKE $1

ORDER BY quality

`

,

[

base+"%"

]

);



return result.rows;



}catch(err){


return [];

}


}








// ============================================
// QUALITY BUTTON
// ============================================

async function showQuality(chatId,contentId){


let files =
await getQualityFiles(contentId);



if(!files.length){

return;

}




if(files.length===1){


return sendFile(

chatId,

files[0]

);


}




let buttons=[];



files.forEach(file=>{


buttons.push([

{

text:"🎥 "+file.quality,

callback_data:

"send_"+file.content_id

}

]);


});





bot.sendMessage(

chatId,

`

🎬 Select Quality

`

,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



}








// ============================================
// SEND ALL EPISODES
// ============================================

async function sendAllEpisodes(chatId,collection,season){


let episodes =
await getEpisodes(

collection,

season

);



if(!episodes.length){


return bot.sendMessage(

chatId,

"❌ Episodes not found"

);


}





let status =

await bot.sendMessage(

chatId,

`

📥 Sending all episodes...


📺 ${collection}

Season ${season}


Please wait...

`

);






for(
let ep of episodes
){


await sendFile(

chatId,

ep

);



await new Promise(

resolve=>

setTimeout(

resolve,

1200

)

);



}






autoDelete(

chatId,

status.message_id

);



}








// ============================================
// QUALITY / PLAY / ALL CALLBACK
// ============================================

bot.on(

"callback_query",

async(query)=>{


let chatId =
query.message.chat.id;


let data =
query.data;





// PLAY


if(
data.startsWith("play_")
){


let id =
data.replace(

"play_",

""

);



return showQuality(

chatId,

id

);



}







// QUALITY SEND


if(
data.startsWith("send_")
){


let id =
data.replace(

"send_",

""

);



let file =
await getContent(id);



if(file){

return sendFile(

chatId,

file

);

}


}








// SEND ALL


if(
data.startsWith("all_")
){


let parts =
data.split("_");



return sendAllEpisodes(

chatId,

parts[1],

parts[2]

);



}



});






console.log(
"✅ Part 5 Loaded"
);


// ============================================
// END PART 5/8
// ============================================
// ============================================
// PART 6/8
// SEARCH + REQUEST SYSTEM
// ============================================



// ============================================
// SEARCH DATABASE
// ============================================

async function searchContent(keyword){


try{


let result =
await pool.query(

`

SELECT *

FROM contents

WHERE

LOWER(title) LIKE LOWER($1)

OR

LOWER(collection) LIKE LOWER($1)

LIMIT 20

`

,

[

"%"+keyword+"%"

]

);



return result.rows;



}catch(err){


return [];

}


}








// ============================================
// SEARCH COMMAND
// ============================================

bot.onText(

/\/search (.+)/,

async(msg,match)=>{


let keyword =
match[1];



let results =
await searchContent(keyword);



if(!results.length){



return bot.sendMessage(

msg.chat.id,

`

❌ No movie found


Try Google Search

`

,

{

reply_markup:{

inline_keyboard:[


[

{

text:"🔎 Google Search",

url:

`https://www.google.com/search?q=${encodeURIComponent(keyword)}`

}

],


[

{

text:"📝 Request Movie",

callback_data:

"request_"+keyword

}

]


]

}

}

);



}






let buttons=[];



results.forEach(item=>{


buttons.push([

{

text:

"🎬 "+item.title,

callback_data:

"play_"+item.content_id

}

]);


});






bot.sendMessage(

msg.chat.id,

`

🔎 Search Results:


${keyword}

`

,

{

reply_markup:{

inline_keyboard:buttons

}

}

);



}

);










// ============================================
// SAVE REQUEST
// ============================================

async function saveRequest(username,request){


try{


await pool.query(

`

INSERT INTO requests

(username,request)

VALUES($1,$2)

`

,

[

username,

request

]

);



return true;



}catch(err){


return false;


}


}









// ============================================
// SEND ADMIN MESSAGE
// ============================================

async function notifyAdmin(text){


try{


await bot.sendMessage(

ADMIN_USERNAME,

text

);



}catch(err){


console.log(
"Admin Notify Error"
);


}


}








// ============================================
// REQUEST HANDLER
// ============================================

bot.on(

"callback_query",

async(query)=>{


let data =
query.data;



if(
!data.startsWith("request_")
){

return;

}





let movie =
data.replace(

"request_",

""

);




let user =
getUsername(

query.from

);





await saveRequest(

user,

movie

);






await notifyAdmin(

`

📝 New Movie Request


👤 User:

${user}


🎬 Request:

${movie}

`

);






bot.sendMessage(

query.message.chat.id,

`

✅ Request sent to Admin


Thank you 🍿

`

);



});









// ============================================
// CONTACT ADMIN BUTTON
// ============================================

function contactAdminButton(){


return {


inline_keyboard:[


[

{

text:"👨‍💻 Contact Admin",

url:

`https://t.me/${ADMIN_USERNAME.replace("@","")}`

}

]


]


};


}







console.log(
"✅ Part 6 Loaded"
);


// ============================================
// END PART 6/8
// ============================================
// ============================================
// PART 7/8
// STABILITY + DATABASE OPTIMIZATION
// ============================================



// ============================================
// CREATE INDEXES (FIXED)
// ============================================

async function createIndexes(){


try{


await pool.query(`

CREATE INDEX IF NOT EXISTS content_id_index

ON contents(content_id)

`);



await pool.query(`

CREATE INDEX IF NOT EXISTS collection_index

ON contents(collection)

`);



await pool.query(`

CREATE INDEX IF NOT EXISTS type_index

ON contents(type)

`);



await pool.query(`

CREATE INDEX IF NOT EXISTS username_index

ON users(username)

`);



console.log(
"✅ Indexes Created"
);



}catch(err){


console.log(

"Index Error:",

err.message

);



}



}



createIndexes();









// ============================================
// AUTO DELETE QUEUE
// ============================================

const deleteQueue=[];



function addDelete(chatId,messageId){


deleteQueue.push({

chatId,

messageId,

time:

Date.now()+600000

});


}





setInterval(()=>{


let now =
Date.now();



for(

let i=deleteQueue.length-1;

i>=0;

i--

){


if(

deleteQueue[i].time <= now

){


bot.deleteMessage(

deleteQueue[i].chatId,

deleteQueue[i].messageId

)

.catch(()=>{});



deleteQueue.splice(

i,

1

);



}



}



},30000);









// ============================================
// OVERRIDE AUTO DELETE
// ============================================

function autoDelete(chatId,messageId){


addDelete(

chatId,

messageId

);


}










// ============================================
// ERROR HANDLING
// ============================================


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









// ============================================
// DATABASE HEALTH CHECK
// ============================================

setInterval(async()=>{


try{


await pool.query(

"SELECT 1"

);



console.log(

"💾 Database OK"

);



}catch(err){


console.log(

"Database Lost"

);



}



},300000);










console.log(
"✅ Part 7 Loaded"
);


// ============================================
// END PART 7/8
// ============================================
// ============================================
// PART 8/8
// FINAL STARTUP SYSTEM
// ============================================



// ============================================
// MENU COMMAND
// ============================================

bot.onText(

/\/menu/,

(msg)=>{


bot.sendMessage(

msg.chat.id,

`

🎬 CineXClub Menu


Choose Category:

`

,

{

reply_markup:{

inline_keyboard:[


[

{

text:"🎬 Movies",

callback_data:"type_Movie"

},

{

text:"📺 Series",

callback_data:"type_Series"

}

],


[

{

text:"🔥 Anime",

callback_data:"type_Anime"

}

]


]

}

}

);



}

);








// ============================================
// HELP COMMAND
// ============================================

bot.onText(

/\/help/,

(msg)=>{


bot.sendMessage(

msg.chat.id,

`

🎬 CineXClub Bot


Commands:


/start

Open Bot


/menu

Browse Movies


/search movie name

Search Movies



Features:

✅ Movies

✅ Collections

✅ Series

✅ Anime

✅ Seasons

✅ Episodes

✅ Quality Selection

✅ Auto Delete


`

);



}

);









// ============================================
// PING
// ============================================

bot.onText(

/\/ping/,

(msg)=>{


bot.sendMessage(

msg.chat.id,

"🏓 Bot is Online"

);


}

);








// ============================================
// BOT INFORMATION
// ============================================

bot.getMe()

.then(info=>{


console.log(`

================================

🎬 CineXClub Bot Online


Username:

@${info.username}


================================

`);


})

.catch(err=>{


console.log(

"Bot Start Error:",

err.message

);


});









// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function shutdown(){


console.log(

"🛑 Closing Bot..."

);



try{


await pool.end();



}catch(err){}



process.exit(0);


}






process.on(

"SIGINT",

shutdown

);



process.on(

"SIGTERM",

shutdown

);









// ============================================
// FINAL STATUS
// ============================================

console.log(`

====================================

🎬 CineXClub Bot Started


✅ Movies

✅ Collections

✅ Series

✅ Anime

✅ Unlimited Seasons

✅ Unlimited Episodes

✅ Quality Selection

✅ Force Join

✅ Google Search

✅ Request Movie

✅ Contact Admin

✅ Auto Delete 10 Minutes

✅ PostgreSQL

✅ Render Ready


====================================

`);




// ============================================
// END FINAL INDEX.JS
// ============================================
