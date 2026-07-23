// ===================================================
// CineXClub Bot
// Production Version
// PART 1/5
// Setup + Database + Bot Start
// ===================================================


require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const express = require("express");


// ===================================================
// ENV CONFIG
// ===================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_ID = Number(process.env.ADMIN_ID);
const FORCE_CHANNEL = process.env.FORCE_CHANNEL;

const ADMIN_BOT_USERNAME = process.env.ADMIN_BOT_USERNAME || "";


// ===================================================
// BASIC CHECK
// ===================================================

if (!BOT_TOKEN) {
    console.log("BOT_TOKEN missing");
    process.exit(1);
}

if (!DATABASE_URL) {
    console.log("DATABASE_URL missing");
    process.exit(1);
}


// ===================================================
// EXPRESS SERVER (RENDER KEEP ALIVE)
// ===================================================

const app = express();

app.get("/", (req, res) => {
    res.send("CineXClub Bot Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});


// ===================================================
// POSTGRES CONNECTION
// ===================================================

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


pool.connect()
.then(client => {
    console.log("PostgreSQL Connected");
    client.release();
})
.catch(err => {
    console.log("Database Connection Error:", err.message);
});


// ===================================================
// BOT INITIALIZE
// ===================================================

const bot = new TelegramBot(
    BOT_TOKEN,
    {
        polling: {
            interval: 300,
            autoStart: true
        }
    }
);


bot.on("polling_error", (error) => {

    console.log(
        "Polling Error:",
        error.message
    );

});


console.log("CineXClub Bot Started");


// ===================================================
// GLOBAL STATES
// ===================================================


// Admin upload states
const uploadState = new Map();


// Search states
const searchState = new Map();


// User temporary data
const userState = new Map();


// ===================================================
// DATABASE INIT
// ===================================================

async function createTables(){

    await pool.query(`
    
    CREATE TABLE IF NOT EXISTS contents (

        id SERIAL PRIMARY KEY,

        content_id TEXT UNIQUE NOT NULL,

        title TEXT NOT NULL,

        type TEXT NOT NULL,

        collection TEXT,

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
    
    CREATE TABLE IF NOT EXISTS settings (

        id SERIAL PRIMARY KEY,

        setting_key TEXT UNIQUE NOT NULL,

        setting_value TEXT

    );

    `);


    console.log("Database Tables Ready");

}



createTables()
.catch(err=>{
    console.log(
        "Table Creation Error:",
        err.message
    );
});



// ===================================================
// PART 2 CONTINUES...
// ===================================================
// ===================================================
// PART 2/5
// Database Functions + User System + Utilities
// ===================================================


// ===================================================
// SAVE USER
// ===================================================

async function saveUser(msg) {

    try {

        const userId = msg.from.id;

        const username =
            msg.from.username
            ? msg.from.username
            : msg.from.first_name;


        await pool.query(
            `
            INSERT INTO users
            (
                user_id,
                username
            )
            VALUES
            ($1,$2)

            ON CONFLICT (user_id)
            DO UPDATE SET
            username=$2
            `,
            [
                userId,
                username
            ]
        );


    } catch(error){

        console.log(
            "Save User Error:",
            error.message
        );

    }

}




// ===================================================
// GET CONTENT BY ID
// ===================================================

async function getContent(contentId){

    try{

        const result =
        await pool.query(
            `
            SELECT *
            FROM contents
            WHERE content_id=$1
            `,
            [
                contentId
            ]
        );


        return result.rows[0];


    }catch(error){

        console.log(
            "Get Content Error:",
            error.message
        );

        return null;

    }

}




// ===================================================
// GET SERIES EPISODES
// ===================================================

async function getEpisodes(collection,season){

    try{


        const result =
        await pool.query(
            `
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


    }catch(error){

        console.log(
            "Episode Fetch Error:",
            error.message
        );

        return [];

    }

}




// ===================================================
// GET ALL SERIES EPISODES
// ===================================================

async function getAllEpisodes(collection){

    try{


        const result =
        await pool.query(
            `
            SELECT *
            FROM contents

            WHERE collection=$1

            ORDER BY season ASC, episode ASC
            `,
            [
                collection
            ]
        );


        return result.rows;


    }catch(error){

        console.log(
            "All Episode Error:",
            error.message
        );


        return [];

    }

}





// ===================================================
// DUPLICATE CHECK
// ===================================================

async function contentExists(contentId){

    try{


        const result =
        await pool.query(
            `
            SELECT id
            FROM contents
            WHERE content_id=$1
            `,
            [
                contentId
            ]
        );


        return result.rows.length > 0;


    }catch(error){

        console.log(
            "Duplicate Check Error:",
            error.message
        );


        return false;

    }

}





// ===================================================
// FORCE JOIN CHECK
// ===================================================

async function checkJoin(userId){

    try{


        if(!FORCE_CHANNEL){
            return true;
        }


        const member =
        await bot.getChatMember(
            FORCE_CHANNEL,
            userId
        );


        const allowed =
        [
            "creator",
            "administrator",
            "member"
        ];



        return allowed.includes(
            member.status
        );


    }catch(error){


        return false;

    }

}





// ===================================================
// FORCE JOIN MESSAGE
// ===================================================

function forceJoinKeyboard(){

    return {

        inline_keyboard:[

            [
                {
                    text:"📢 Join Channel",
                    url:`https://t.me/${FORCE_CHANNEL.replace("@","")}`
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
// USERNAME FORMAT
// ===================================================

function formatUsername(user){


    let name =
    user.username
    ? user.username
    : user.first_name;


    if(!name){
        name="User";
    }


    name =
    name.replace("@","");


    return (
        name.charAt(0).toUpperCase()
        +
        name.slice(1)
    );

}




// ===================================================
// GOOGLE SEARCH BUTTON
// ===================================================

function googleButton(text){


    return {

        inline_keyboard:[

            [
                {
                    text:"🔎 Google Search",
                    url:
                    `https://www.google.com/search?q=${encodeURIComponent(text)}`
                }
            ]

        ]

    };

}




// ===================================================
// ADMIN BOT BUTTON
// ===================================================

function adminBotButton(){

    if(!ADMIN_BOT_USERNAME){
        return null;
    }


    return {

        inline_keyboard:[

            [
                {
                    text:"⚙ Admin Bot",
                    url:
                    `https://t.me/${ADMIN_BOT_USERNAME.replace("@","")}`
                }
            ]

        ]

    };

}



// ===================================================
// SEND FILE FUNCTION
// ===================================================

async function sendContent(chatId,content){


    try{


        await bot.sendVideo(
            chatId,
            content.file_id,
            {
                caption:
`
🎬 ${content.title}

Quality: ${content.quality || "Unknown"}
Audio: ${content.audio || "Unknown"}
Language: ${content.language || "Unknown"}

Enjoy CineXClub 🍿
`
            }
        );


    }catch(error){


        console.log(
            "Send File Error:",
            error.message
        );


        await bot.sendMessage(
            chatId,
            "❌ Unable to send file."
        );

    }


}



// ===================================================
// PART 3 CONTINUES...
// ===================================================
// ===================================================
// PART 3/5
// START SYSTEM + WELCOME + SEARCH + CONTENT FLOW
// ===================================================



// ===================================================
// WELCOME IMAGE SYSTEM
// ===================================================


async function getWelcomeImages(){

    try{

        const result =
        await pool.query(
            `
            SELECT setting_value
            FROM settings
            WHERE setting_key='welcome_images'
            `
        );


        if(result.rows.length){

            return JSON.parse(
                result.rows[0].setting_value
            );

        }


        return [];


    }catch(error){

        console.log(
            "Welcome Image Error:",
            error.message
        );

        return [];

    }

}





// ===================================================
// SEND WELCOME
// ===================================================


async function sendWelcome(msg){

    const chatId = msg.chat.id;

    const name =
    formatUsername(
        msg.from
    );


    const images =
    await getWelcomeImages();


    const caption =

`
👋 Welcome ${name}

🎬 CineXClub Bot

Search Movies, Series & Anime easily.

✍️ Type exact movie name.

⚠️ Spelling mistakes are not supported.
Incorrect spelling will not return files.

Created By:
@CineXClubBot
`;



    if(images.length){

        const randomImage =
        images[
            Math.floor(
                Math.random()*images.length
            )
        ];


        await bot.sendPhoto(
            chatId,
            randomImage,
            {
                caption:caption,
                reply_markup:{
                    inline_keyboard:[
                        [
                            {
                                text:"⚙ Admin Bot",
                                url:
                                `https://t.me/${ADMIN_BOT_USERNAME.replace("@","")}`
                            }
                        ]
                    ]
                }
            }
        );


    }else{


        await bot.sendMessage(
            chatId,
            caption,
            {
                reply_markup:{
                    inline_keyboard:[
                        [
                            {
                                text:"⚙ Admin Bot",
                                url:
                                `https://t.me/${ADMIN_BOT_USERNAME.replace("@","")}`
                            }
                        ]
                    ]
                }
            }
        );


    }

}





// ===================================================
// START COMMAND
// ===================================================


bot.onText(
/\/start(?:\s(.+))?/,

async(msg,match)=>{


try{


    await saveUser(msg);


    const joined =
    await checkJoin(
        msg.from.id
    );



    if(!joined){


        await bot.sendMessage(
            msg.chat.id,
            "⚠️ Please join our channel first.",
            {
                reply_markup:
                forceJoinKeyboard()
            }
        );


        return;

    }




    const contentId =
    match[1];



    if(!contentId){


        await sendWelcome(msg);

        return;

    }




    const content =
    await getContent(
        contentId
    );




    if(!content){


        await bot.sendMessage(
            msg.chat.id,
            "❌ File not found.",
            {
                reply_markup:
                googleButton(contentId)
            }
        );


        return;

    }





    if(content.type==="Series" || content.type==="Anime"){


        const episodes =
        await getEpisodes(
            content.collection,
            content.season
        );



        let buttons=[];



        episodes.forEach(ep=>{


            buttons.push([

                {
                    text:
                    `Episode ${ep.episode}`,

                    callback_data:
                    `episode_${ep.id}`
                }

            ]);


        });



        buttons.push([

            {
                text:"📥 Send All Episodes",

                callback_data:
                `all_${content.collection}`
            }

        ]);




        await bot.sendMessage(

            msg.chat.id,

            `
🎬 ${content.collection}

Season: ${content.season}

Select Episode
            `,

            {
                reply_markup:{
                    inline_keyboard:
                    buttons
                }
            }

        );



        return;


    }





    await sendContent(
        msg.chat.id,
        content
    );



    setTimeout(()=>{


        bot.deleteMessage(
            msg.chat.id,
            msg.message_id
        )
        .catch(()=>{});


    },600000);



}catch(error){


console.log(
"Start Error:",
error.message
);


}


});






// ===================================================
// SEARCH SYSTEM
// ===================================================


bot.on(
"message",

async(msg)=>{


try{


if(!msg.text)
return;


if(
msg.text.startsWith("/")
)
return;



const chatId =
msg.chat.id;


const search =
msg.text.trim();



const result =
await pool.query(

`
SELECT *
FROM contents

WHERE LOWER(title)
LIKE LOWER($1)

LIMIT 10
`,

[
`%${search}%`
]

);



if(!result.rows.length){

await bot.sendMessage(

chatId,

"❌ No file found.\n\nPlease check spelling."

);


return;

}




let buttons=[];



result.rows.forEach(item=>{


buttons.push([

{

text:
item.title,

callback_data:
`content_${item.content_id}`

}

]);


});



await bot.sendMessage(

chatId,

"🔎 Search Results:",

{

reply_markup:{
inline_keyboard:buttons
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
// PART 4 CONTINUES...
// ===================================================
// ===================================================
// PART 4/5
// CALLBACK SYSTEM + ADMIN PANEL + UPLOAD SYSTEM
// ===================================================



// ===================================================
// SINGLE CALLBACK HANDLER
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



// ==============================
// CHECK JOIN
// ==============================


if(data==="check_join"){


const joined =
await checkJoin(userId);


if(joined){


await bot.answerCallbackQuery(
query.id,
{
text:"✅ Joined Successfully"
}
);


await bot.sendMessage(
chatId,
"✅ You can use CineXClub now."
);


}else{


await bot.answerCallbackQuery(
query.id,
{
text:"❌ Join channel first"
}
);


}


return;

}





// ==============================
// CONTENT BUTTON
// ==============================


if(
data.startsWith("content_")
){


const contentId =
data.replace(
"content_",
""
);



const content =
await getContent(
contentId
);



if(content){


await sendContent(
chatId,
content
);


setTimeout(()=>{


bot.deleteMessage(
chatId,
query.message.message_id
)
.catch(()=>{});


},600000);


}


return;

}





// ==============================
// EPISODE BUTTON
// ==============================


if(
data.startsWith("episode_")
){


const id =
data.replace(
"episode_",
""
);



const result =
await pool.query(

`
SELECT *
FROM contents
WHERE id=$1
`,

[id]

);



if(result.rows.length){


await sendContent(
chatId,
result.rows[0]
);


}



return;

}





// ==============================
// ALL EPISODES
// ==============================


if(
data.startsWith("all_")
){


const collection =
data.replace(
"all_",
""
);



const episodes =
await getAllEpisodes(
collection
);



for(const ep of episodes){


await sendContent(
chatId,
ep
);


}


return;

}





// ==============================
// ADMIN PANEL OPEN
// ==============================


if(
data==="admin_panel"
){


if(userId!==ADMIN_ID)
return;



await bot.sendMessage(

chatId,

"⚙ Admin Panel",

{

reply_markup:{

inline_keyboard:[


[
{
text:"📤 Upload",
callback_data:"upload_start"
}
],


[
{
text:"📊 Statistics",
callback_data:"stats"
}
],


[
{
text:"📥 Requests",
callback_data:"requests"
}
],


[
{
text:"📢 Broadcast",
callback_data:"broadcast"
}
]


]

}

}

);



return;

}





// ==============================
// UPLOAD START
// ==============================


if(
data==="upload_start"
){


if(userId!==ADMIN_ID)
return;



uploadState.set(
userId,
{
step:"type"
}
);



await bot.sendMessage(

chatId,

"Select Content Type",

{

reply_markup:{

inline_keyboard:[


[
{
text:"🎬 Movie",
callback_data:"type_Movie"
}
],

[
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


return;

}





// ==============================
// SELECT TYPE
// ==============================


if(
data.startsWith("type_")
){


const type =
data.replace(
"type_",
""
);



uploadState.set(

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
callback_data:"quality_480p"
}
],

[
{
text:"720p",
callback_data:"quality_720p"
}
],

[
{
text:"1080p",
callback_data:"quality_1080p"
}
]


]

}

}

);



return;

}





// ==============================
// QUALITY SELECT
// ==============================


if(
data.startsWith("quality_")
){


const quality =
data.replace(
"quality_",
""
);



let state =
uploadState.get(
userId
);



if(!state)
return;



state.quality =
quality;


state.step =
"details";


uploadState.set(
userId,
state
);



await bot.sendMessage(

chatId,

`
Send caption details.

Format:

ID:
Title:
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





// ==============================
// STATISTICS
// ==============================


if(
data==="stats"
){


if(userId!==ADMIN_ID)
return;


const result =
await pool.query(
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




}catch(error){


console.log(
"Callback Error:",
error.message
);


}


});



// ===================================================
// ADMIN TEXT HANDLER
// ===================================================


bot.on(
"message",

async(msg)=>{


try{


const userId =
msg.from.id;



if(userId!==ADMIN_ID)
return;



const state =
uploadState.get(
userId
);



if(!state)
return;



if(
state.step==="details"
&& msg.text
){


state.caption =
msg.text;

state.step =
"file";


uploadState.set(
userId,
state
);



await bot.sendMessage(

msg.chat.id,

"📤 Now send the video/file."

);


return;

}



}catch(error){


console.log(
"Admin Message Error:",
error.message
);


}


});



// ===================================================
// PART 5 CONTINUES...
// ===================================================
// ===================================================
// PART 5/5
// FILE RECEIVER + DATABASE SAVE + FINAL SYSTEM
// ===================================================



// ===================================================
// PARSE CAPTION DETAILS
// ===================================================

function parseCaption(text){


    const data={};


    const lines =
    text.split("\n");


    lines.forEach(line=>{


        const parts =
        line.split(":");


        if(parts.length < 2)
            return;


        const key =
        parts[0]
        .trim()
        .toLowerCase();


        const value =
        parts.slice(1)
        .join(":")
        .trim();



        data[key]=value;


    });


    return data;

}





// ===================================================
// FILE UPLOAD RECEIVER
// ===================================================


bot.on(
"message",

async(msg)=>{


try{


const userId =
msg.from.id;



if(userId!==ADMIN_ID)
return;



const state =
uploadState.get(
userId
);



if(!state)
return;



if(
state.step!=="file"
)
return;



let fileId = null;



if(msg.video){


fileId =
msg.video.file_id;


}



else if(msg.document){


fileId =
msg.document.file_id;


}



if(!fileId){


await bot.sendMessage(

msg.chat.id,

"❌ Please send only video or document file."

);


return;

}





const details =
parseCaption(
state.caption
);



const contentId =
details.id
||
Date.now().toString();



const exists =
await contentExists(
contentId
);



if(exists){


await bot.sendMessage(

msg.chat.id,

"❌ Duplicate Content ID already exists."

);


uploadState.delete(userId);


return;

}





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

audio,

size,

language,

file_id

)

VALUES

($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)

`,

[

contentId,

details.title || "Unknown",

state.type,

details.collection || null,

details.season ? Number(details.season) : null,

details.episode ? Number(details.episode) : null,

state.quality,

details.audio || null,

details.size || null,

details.language || null,

fileId

]

);





await bot.sendMessage(

msg.chat.id,

`
✅ Upload Successful

ID:
${contentId}

Quality:
${state.quality}

Type:
${state.type}
`

);



uploadState.delete(
userId
);



}catch(error){


console.log(
"Upload Error:",
error.message
);



}


});






// ===================================================
// REQUEST MOVIE BUTTON
// ===================================================


bot.onText(
/\/request (.+)/,

async(msg,match)=>{


try{


await pool.query(

`

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

msg.from.id,

msg.from.username || msg.from.first_name,

match[1]

]

);



await bot.sendMessage(

msg.chat.id,

"✅ Your request has been submitted."

);



}catch(error){


console.log(
"Request Error:",
error.message
);


}


});






// ===================================================
// ADMIN COMMAND
// ===================================================


bot.onText(
/\/admin/,

async(msg)=>{


if(msg.from.id!==ADMIN_ID)
return;



await bot.sendMessage(

msg.chat.id,

"⚙ Admin Panel",

{

reply_markup:{

inline_keyboard:[


[
{
text:"📤 Upload",
callback_data:"upload_start"
}
],


[
{
text:"📊 Statistics",
callback_data:"stats"
}
],


[
{
text:"📥 Requests",
callback_data:"requests"
}
]


]

}

}

);


});







// ===================================================
// ERROR HANDLING
// ===================================================


process.on(
"uncaughtException",

(err)=>{


console.log(
"System Error:",
err.message
);


});



process.on(
"unhandledRejection",

(err)=>{


console.log(
"Promise Error:",
err
);


});





// ===================================================
// BOT READY
// ===================================================


console.log(
"CineXClub Production Bot Online 🚀"
);
