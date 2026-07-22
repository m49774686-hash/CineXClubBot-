// ===================================================
// CineXClub Bot
// PART 1/30
// Setup + Environment + Bot Start
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

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// ======================
// EXPRESS SERVER
// ======================

const app = express();

app.get("/", (req, res) => {
    res.send("🎬 CineXClub Bot Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🌐 Server Started : ${PORT}`);
});

// ======================
// TELEGRAM BOT
// ======================

const bot = new TelegramBot(BOT_TOKEN, {
    polling: {
        autoStart: true,
        interval: 300,
        params: {
            timeout: 10
        }
    }
});

console.log("🤖 Telegram Bot Starting...");

// ======================
// POSTGRESQL
// ======================

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ======================
// GLOBAL MAPS
// ======================

const searchMode = new Map();
const requestMode = new Map();
const broadcastMode = new Map();
const favoriteMode = new Map();
const historyMode = new Map();

// ======================
// RANDOM QUOTES
// ======================

const quotes = [

    "🍿 Entertainment Starts Here",

    "🎬 Unlimited Movies",

    "📺 Unlimited Series",

    "🍥 Unlimited Anime",

    "❤️ Welcome To CineXClub",

    "🔥 Enjoy Your Favourite Movies"

];

function randomQuote(){

    return quotes[
        Math.floor(Math.random()*quotes.length)
    ];

}

// ======================
// USERNAME
// ======================

function getUsername(user){

    if(user.username){

        return "@"+user.username;

    }

    return user.first_name || "User";

}

// ======================
// LOGS
// ======================

bot.getMe()

.then(botInfo=>{

    console.log("================================");
    console.log("🤖 Bot :",botInfo.first_name);
    console.log("👤 Username : @"+botInfo.username);
    console.log("================================");

})

.catch(err=>{

    console.log(err.message);

});

// ======================
// EXPORTS
// ======================

module.exports = {

    bot,

    pool

};

console.log("✅ PART 1 Loaded");
// ===================================================
// CineXClub Bot
// PART 2/30
// PostgreSQL Database + Tables + Helpers
// ===================================================

// ======================
// DATABASE SETUP
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

quality TEXT,

language TEXT,

year TEXT,

size TEXT,

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);

CREATE TABLE IF NOT EXISTS users(

id SERIAL PRIMARY KEY,

user_id BIGINT UNIQUE,

username TEXT,

first_name TEXT,

joined_at TIMESTAMP DEFAULT NOW()

);

CREATE TABLE IF NOT EXISTS requests(

id SERIAL PRIMARY KEY,

user_id BIGINT,

username TEXT,

request TEXT,

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

`);

        console.log("✅ Database Ready");

    }catch(err){

        console.log("Database Error:",err.message);

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
        `,

        [

        user.id,

        user.username || "",

        user.first_name || ""

        ]

        );

    }catch(err){

        console.log(err.message);

    }

}

// ======================
// GET USER
// ======================

async function getUser(userId){

    const result=await pool.query(

    `
    SELECT *

    FROM users

    WHERE user_id=$1
    `,

    [userId]

    );

    return result.rows[0] || null;

}

// ======================
// DATABASE CHECK
// ======================

async function checkDatabase(){

    try{

        await pool.query("SELECT NOW()");

        console.log("🟢 PostgreSQL Connected");

    }catch(err){

        console.log("🔴 PostgreSQL Offline");

    }

}

setInterval(checkDatabase,300000);

console.log("✅ PART 2 Loaded");
// ===================================================
// CineXClub Bot
// PART 3/30
// Storage Channel + Caption Parser + Save Content
// ===================================================

// ======================
// PARSE CAPTION
// ======================

function parseCaption(caption){

    const data={

        type:"Movie",

        title:"",

        collection:null,

        season:null,

        episode:null,

        quality:"720p",

        language:"Unknown",

        year:"",

        size:"",

        content_id:null

    };

    const lines=caption.split("\n");

    for(const line of lines){

        const parts=line.split(":");

        if(parts.length<2) continue;

        const key=parts[0].trim().toLowerCase();

        const value=parts.slice(1).join(":").trim();

        switch(key){

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

            case "language":
            case "audio":
                data.language=value;
                break;

            case "year":
                data.year=value;
                break;

            case "size":
                data.size=value;
                break;

            case "id":
                data.content_id=value.toLowerCase();
                break;

        }

    }

    if(!data.content_id){

        data.content_id=data.title
        .replace(/\s+/g,"")
        .toLowerCase();

        if(data.type!=="Movie"){

            data.content_id+=
            `_S${data.season}E${data.episode}`;

        }

    }

    return data;

}

// ======================
// SAVE CONTENT
// ======================

async function saveContent(data,fileId){

    try{

        await pool.query(

        `

        INSERT INTO contents(

        content_id,

        title,

        type,

        collection,

        season,

        episode,

        quality,

        language,

        year,

        size,

        file_id

        )

        VALUES(

        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11

        )

        ON CONFLICT(content_id)

        DO UPDATE SET

        quality=EXCLUDED.quality,

        language=EXCLUDED.language,

        year=EXCLUDED.year,

        size=EXCLUDED.size,

        file_id=EXCLUDED.file_id

        `,

        [

        data.content_id,

        data.title,

        data.type,

        data.collection,

        data.season,

        data.episode,

        data.quality,

        data.language,

        data.year,

        data.size,

        fileId

        ]

        );

        return true;

    }catch(err){

        console.log("Save Error:",err.message);

        return false;

    }
bot.on("channel_post", (msg) => {
    console.log("✅ CHANNEL POST RECEIVED");
    console.log("Channel ID:", msg.chat.id);
    console.log(msg);
});
}

// ======================
// STORAGE CHANNEL
// ======================

bot.on("channel_post",async(msg)=>{

    try{

        if(String(msg.chat.id)!==String(STORAGE_CHANNEL))
        return;

        let fileId=null;

        if(msg.document)
        fileId=msg.document.file_id;

        if(msg.video)
        fileId=msg.video.file_id;

        if(!fileId || !msg.caption)
        return;

        const data=parseCaption(msg.caption);

        console.log("📥 Upload:",data.title);

        const saved=await saveContent(data,fileId);

        if(!saved)
        return;

        const link=
`https://t.me/${BOT_USERNAME}?start=${data.content_id}`;

        await bot.sendMessage(

            msg.chat.id,

`✅ Saved Successfully

🎬 ${data.title}

📂 Type : ${data.type}

🆔 ID : ${data.content_id}

🎥 Quality : ${data.quality}

🌐 Language : ${data.language}

📅 Year : ${data.year}

🔗 Bot Link

${link}`

        );

        console.log("✅ Saved:",data.content_id);

    }catch(err){

        console.log("Storage Error:",err.message);

    }

});

console.log("✅ PART 3 Loaded");
// ===================================================
// CineXClub Bot
// PART 4/30
// Force Join + Welcome + /start + Deep Link
// ===================================================

// ======================
// FORCE JOIN CHECK
// ======================

async function checkForceJoin(userId){

    try{

        if(!FORCE_CHANNEL)
            return true;

        const member = await bot.getChatMember(
            FORCE_CHANNEL,
            userId
        );

        return [
            "creator",
            "administrator",
            "member"
        ].includes(member.status);

    }catch{

        return false;

    }

}

// ======================
// HOME BUTTONS
// ======================

function homeButtons(){

    return {

        inline_keyboard:[

            [
                {
                    text:"🎬 Movies",
                    callback_data:"menu_movies"
                },
                {
                    text:"📺 Series",
                    callback_data:"menu_series"
                }
            ],

            [
                {
                    text:"🍥 Anime",
                    callback_data:"menu_anime"
                }
            ],

            [
                {
                    text:"🔎 Search",
                    callback_data:"search"
                }
            ],

            [
                {
                    text:"🎥 Request Movie",
                    callback_data:"request_movie"
                }
            ],

            [
                {
                    text:"👨‍💻 Contact Admin",
                    url:`https://t.me/${ADMIN_USERNAME.replace("@","")}`
                }
            ]

        ]

    };

}

// ======================
// DEEP LINK
// ======================

async function handleDeepLink(chatId,user,contentId){

    const result = await pool.query(

        `SELECT * FROM contents
        WHERE content_id=$1
        LIMIT 1`,

        [contentId]

    );

    if(result.rows.length===0){

        return bot.sendMessage(

            chatId,

            "❌ Content not found.",

            {
                reply_markup:{
                    inline_keyboard:[
                        [
                            {
                                text:"👨‍💻 Contact Admin",
                                url:`https://t.me/${ADMIN_USERNAME.replace("@","")}`
                            }
                        ]
                    ]
                }
            }

        );

    }

    return showQuality(
        chatId,
        contentId
    );

}

// ======================
// START COMMAND
// ======================

bot.onText(/\/start(?:\s+(.+))?/,async(msg,match)=>{

    const chatId=msg.chat.id;

    await saveUser(msg.from);

    if(match[1]){

        return handleDeepLink(

            chatId,

            msg.from,

            match[1]

        );

    }

    const joined = await checkForceJoin(msg.from.id);

    if(!joined){

        return bot.sendMessage(

            chatId,

            "⚠️ Join our updates channel first.",

            {

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
                                text:"✅ Continue",
                                callback_data:"recheck_join"
                            }
                        ]

                    ]

                }

            }

        );

    }

    await bot.sendMessage(

        chatId,

`🎬 <b>Welcome ${getUsername(msg.from)}</b>

${randomQuote()}

━━━━━━━━━━━━━━

🍿 Movies
📺 Series
🍥 Anime

━━━━━━━━━━━━━━

Choose an option below.`,

        {

            parse_mode:"HTML",

            reply_markup:homeButtons()

        }

    );

});

// ======================
// RECHECK JOIN
// ======================

bot.on("callback_query",async(query)=>{

    if(query.data!=="recheck_join")
        return;

    const joined = await checkForceJoin(query.from.id);

    if(!joined){

        return bot.answerCallbackQuery(

            query.id,

            {

                text:"Join the channel first.",

                show_alert:true

            }

        );

    }

    await bot.editMessageText(

        "✅ Verification Successful.\n\nPress /start",

        {

            chat_id:query.message.chat.id,

            message_id:query.message.message_id

        }

    );

});

console.log("✅ PART 4 Loaded");
// ===================================================
// CineXClub Bot
// PART 5/30
// Search System + Movie Collections
// ===================================================

// ======================
// SEARCH MODE
// ======================

const searchUsers = new Map();

// ======================
// GET COLLECTIONS
// ======================

async function getCollections(type){

    try{

        const result = await pool.query(

            `
            SELECT DISTINCT collection
            FROM contents
            WHERE type=$1
            ORDER BY collection
            `,

            [type]

        );

        return result.rows;

    }catch(err){

        console.log(err.message);

        return [];

    }

}

// ======================
// SHOW COLLECTIONS
// ======================

async function showCollections(chatId,type){

    const collections = await getCollections(type);

    if(collections.length===0){

        return bot.sendMessage(
            chatId,
            `❌ No ${type} available.`
        );

    }

    const buttons=[];

    collections.forEach(item=>{

        buttons.push([

            {

                text:`📂 ${item.collection}`,

                callback_data:`collection_${type}_${item.collection}`

            }

        ]);

    });

    buttons.push([

        {

            text:"🏠 Home",

            callback_data:"home"

        }

    ]);

    return bot.sendMessage(

        chatId,

        `📂 ${type} Collections`,

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

}

// ======================
// CALLBACK MENU
// ======================

bot.on("callback_query",async(query)=>{

    const chatId=query.message.chat.id;

    switch(query.data){

        case "menu_movies":

            return showCollections(chatId,"Movie");

        case "menu_series":

            return showCollections(chatId,"Series");

        case "menu_anime":

            return showCollections(chatId,"Anime");

        case "search":

            searchUsers.set(chatId,true);

            return bot.sendMessage(

                chatId,

                "🔎 Send Movie / Series / Anime name."

            );

        case "home":

            searchUsers.delete(chatId);

            return bot.sendMessage(

                chatId,

                "🏠 Home",

                {

                    reply_markup:homeButtons()

                }

            );

    }

});

// ======================
// SEARCH
// ======================

bot.on("message",async(msg)=>{

    if(!searchUsers.has(msg.chat.id))
        return;

    if(!msg.text)
        return;

    searchUsers.delete(msg.chat.id);

    const keyword=msg.text.trim();

    try{

        const result=await pool.query(

            `

            SELECT *

            FROM contents

            WHERE

            LOWER(title) LIKE LOWER($1)

            OR LOWER(collection) LIKE LOWER($1)

            ORDER BY title

            LIMIT 20

            `,

            [`%${keyword}%`]

        );

        if(result.rows.length===0){

            return bot.sendMessage(

                msg.chat.id,

                `❌ "${keyword}" not found.`,

                {

                    reply_markup:{

                        inline_keyboard:[

                            [

                                {

                                    text:"🔎 Google Search",

                                    url:`https://www.google.com/search?q=${encodeURIComponent(keyword)}`

                                }

                            ],

                            [

                                {

                                    text:"🎬 Request Movie",

                                    callback_data:`request_${keyword}`

                                }

                            ],

                            [

                                {

                                    text:"👨‍💻 Contact Admin",

                                    url:`https://t.me/${ADMIN_USERNAME.replace("@","")}`

                                }

                            ]

                        ]

                    }

                }

            );

        }

        const buttons=[];

        result.rows.forEach(item=>{

            buttons.push([

                {

                    text:`🎬 ${item.title} (${item.quality})`,

                    callback_data:`quality_${item.content_id}`

                }

            ]);

        });

        buttons.push([

            {

                text:"🏠 Home",

                callback_data:"home"

            }

        ]);

        return bot.sendMessage(

            msg.chat.id,

            `🔎 Search Results\n\nFound ${result.rows.length} result(s).`,

            {

                reply_markup:{

                    inline_keyboard:buttons

                }

            }

        );

    }catch(err){

        console.log("Search Error:",err.message);

    }

});

console.log("✅ PART 5 Loaded");
// ===================================================
// CineXClub Bot
// PART 6/30
// Collection → Season → Episode → Quality
// ===================================================

// ======================
// GET COLLECTION ITEMS
// ======================

async function getCollectionItems(collection){

    const result = await pool.query(

        `
        SELECT *
        FROM contents
        WHERE collection=$1
        ORDER BY season,episode,title
        `,

        [collection]

    );

    return result.rows;

}

// ======================
// GET SEASONS
// ======================

async function getSeasons(collection){

    const result = await pool.query(

        `
        SELECT DISTINCT season
        FROM contents
        WHERE collection=$1
        AND season IS NOT NULL
        ORDER BY season
        `,

        [collection]

    );

    return result.rows;

}

// ======================
// GET EPISODES
// ======================

async function getEpisodes(collection,season){

    const result = await pool.query(

        `
        SELECT *
        FROM contents
        WHERE collection=$1
        AND season=$2
        ORDER BY episode
        `,

        [collection,season]

    );

    return result.rows;

}

// ======================
// SHOW QUALITY
// ======================

async function showQuality(chatId,contentId){

    const base=contentId.split("_")[0];

    const result=await pool.query(

        `
        SELECT *
        FROM contents
        WHERE content_id LIKE $1
        ORDER BY quality
        `,

        [`${base}%`]

    );

    if(result.rows.length===0){

        return bot.sendMessage(
            chatId,
            "❌ File not found."
        );

    }

    if(result.rows.length===1){

        return sendFile(
            chatId,
            result.rows[0]
        );

    }

    const buttons=[];

    result.rows.forEach(file=>{

        buttons.push([

            {

                text:`🎥 ${file.quality}`,

                callback_data:`send_${file.content_id}`

            }

        ]);

    });

    buttons.push([

        {

            text:"🏠 Home",

            callback_data:"home"

        }

    ]);

    return bot.sendMessage(

        chatId,

        "🎥 Select Quality",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

}

// ======================
// CALLBACKS
// ======================

bot.on("callback_query",async(query)=>{

    const chatId=query.message.chat.id;
    const data=query.data;

    // COLLECTION

    if(data.startsWith("collection_")){

        const parts=data.split("_");

        const type=parts[1];
        const collection=parts.slice(2).join("_");

        if(type==="Movie"){

            const movies=await getCollectionItems(collection);

            const buttons=[];

            movies.forEach(movie=>{

                buttons.push([

                    {

                        text:`🎬 ${movie.title} (${movie.quality})`,

                        callback_data:`quality_${movie.content_id}`

                    }

                ]);

            });

            buttons.push([

                {

                    text:"🏠 Home",

                    callback_data:"home"

                }

            ]);

            return bot.sendMessage(

                chatId,

                `🎬 ${collection}`,

                {

                    reply_markup:{

                        inline_keyboard:buttons

                    }

                }

            );

        }

        // SERIES / ANIME

        const seasons=await getSeasons(collection);

        const buttons=[];

        seasons.forEach(s=>{

            buttons.push([

                {

                    text:`📺 Season ${s.season}`,

                    callback_data:`season_${collection}_${s.season}`

                }

            ]);

        });

        buttons.push([

            {

                text:"🏠 Home",

                callback_data:"home"

            }

        ]);

        return bot.sendMessage(

            chatId,

            `📂 ${collection}`,

            {

                reply_markup:{

                    inline_keyboard:buttons

                }

            }

        );

    }

    // SEASON

    if(data.startsWith("season_")){

        const parts=data.split("_");

        const collection=parts[1];
        const season=parts[2];

        const episodes=await getEpisodes(
            collection,
            season
        );

        const buttons=[];

        episodes.forEach(ep=>{

            buttons.push([

                {

                    text:`🎬 Episode ${ep.episode}`,

                    callback_data:`quality_${ep.content_id}`

                }

            ]);

        });

        buttons.push([

            {

                text:"📥 Send All Episodes",

                callback_data:`all_${collection}_${season}`

            }

        ]);

        buttons.push([

            {

                text:"🏠 Home",

                callback_data:"home"

            }

        ]);

        return bot.sendMessage(

            chatId,

            `📺 ${collection}\nSeason ${season}`,

            {

                reply_markup:{

                    inline_keyboard:buttons

                }

            }

        );

    }

});

console.log("✅ PART 6 Loaded");
// ===================================================
// CineXClub Bot
// PART 7/30
// File Send + Auto Delete + History + Downloads
// ===================================================

// ======================
// AUTO DELETE (10 MIN)
// ======================

function autoDelete(chatId,messageId){

    setTimeout(async()=>{

        try{

            await bot.deleteMessage(chatId,messageId);

        }catch(err){}

    },600000);

}

// ======================
// SAVE DOWNLOAD
// ======================

async function saveDownload(userId,contentId){

    try{

        await pool.query(

        `
        INSERT INTO downloads(user_id,content_id)

        VALUES($1,$2)
        `,

        [

        userId,

        contentId

        ]

        );

    }catch(err){

        console.log(err.message);

    }

}

// ======================
// SAVE HISTORY
// ======================

async function saveHistory(userId,contentId){

    try{

        await pool.query(

        `
        INSERT INTO history(

        user_id,

        content_id

        )

        VALUES($1,$2)

        ON CONFLICT(user_id,content_id)

        DO UPDATE SET

        watched_at=NOW()
        `,

        [

        userId,

        contentId

        ]

        );

    }catch(err){

        console.log(err.message);

    }

}

// ======================
// SEND FILE
// ======================

async function sendFile(chatId,file,userId=null){

    try{

        if(userId){

            await saveHistory(
                userId,
                file.content_id
            );

            await saveDownload(
                userId,
                file.content_id
            );

        }

        const sent = await bot.sendDocument(

            chatId,

            file.file_id,

            {

                caption:

`🎬 <b>${file.title}</b>

━━━━━━━━━━━━━━

📂 Type : ${file.type}

${file.collection ? `🎞 Collection : ${file.collection}` : ""}

${file.season ? `📺 Season : ${file.season}` : ""}

${file.episode ? `🎬 Episode : ${file.episode}` : ""}

🎥 Quality : ${file.quality}

🌐 Language : ${file.language}

📅 Year : ${file.year}

💾 Size : ${file.size}

━━━━━━━━━━━━━━

⭐ Powered By CineXClub`,

                parse_mode:"HTML",

                reply_markup:{

                    inline_keyboard:[

                        [

                            {

                                text:"❤️ Favorite",

                                callback_data:`favorite_${file.content_id}`

                            }

                        ],

                        [

                            {

                                text:"📢 Join Channel",

                                url:`https://t.me/${FORCE_CHANNEL.replace("@","")}`

                            }

                        ],

                        [

                            {

                                text:"👨‍💻 Contact Admin",

                                url:`https://t.me/${ADMIN_USERNAME.replace("@","")}`

                            }

                        ]

                    ]

                }

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

// ======================
// SEND CALLBACK
// ======================

bot.on("callback_query",async(query)=>{

    const data=query.data;

    if(!data.startsWith("send_"))
        return;

    const id=data.replace("send_","");

    const result=await pool.query(

        `
        SELECT *

        FROM contents

        WHERE content_id=$1

        LIMIT 1
        `,

        [id]

    );

    if(result.rows.length===0){

        return bot.answerCallbackQuery(

            query.id,

            {

                text:"❌ File Not Found",

                show_alert:true

            }

        );

    }

    await bot.answerCallbackQuery(query.id);

    return sendFile(

        query.message.chat.id,

        result.rows[0],

        query.from.id

    );

});

// ======================
// SEND ALL EPISODES
// ======================

bot.on("callback_query",async(query)=>{

    const data=query.data;

    if(!data.startsWith("all_"))
        return;

    const parts=data.split("_");

    const collection=parts[1];

    const season=parts[2];

    const episodes=await getEpisodes(

        collection,

        season

    );

    await bot.sendMessage(

        query.message.chat.id,

        `📥 Sending ${episodes.length} Episodes...`

    );

    for(const ep of episodes){

        await sendFile(

            query.message.chat.id,

            ep,

            query.from.id

        );

        await new Promise(r=>setTimeout(r,1200));

    }

});

console.log("✅ PART 7 Loaded");
// ===================================================
// CineXClub Bot
// PART 8/30
// Favorites + Profile + Watch History
// ===================================================

// ======================
// DATABASE TABLES
// ======================

async function initExtraTables(){

    try{

        await pool.query(`

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

        `);

        console.log("✅ Extra Tables Ready");

    }catch(err){

        console.log(err.message);

    }

}

initExtraTables();

// ======================
// SAVE FAVORITE
// ======================

async function addFavorite(userId,contentId){

    try{

        await pool.query(

        `
        INSERT INTO favorites(user_id,content_id)

        VALUES($1,$2)

        ON CONFLICT(user_id,content_id)

        DO NOTHING
        `,

        [

        userId,

        contentId

        ]

        );

    }catch(err){

        console.log(err.message);

    }

}

// ======================
// FAVORITE CALLBACK
// ======================

bot.on("callback_query",async(query)=>{

    if(!query.data.startsWith("favorite_"))
        return;

    const contentId=query.data.replace("favorite_","");

    await addFavorite(

        query.from.id,

        contentId

    );

    bot.answerCallbackQuery(query.id,{

        text:"❤️ Added To Favorites"

    });

});

// ======================
// PROFILE
// ======================

bot.onText(/\/profile/,async(msg)=>{

    const userId=msg.from.id;

    const fav=await pool.query(

        `SELECT COUNT(*) FROM favorites WHERE user_id=$1`,

        [userId]

    );

    const history=await pool.query(

        `SELECT COUNT(*) FROM history WHERE user_id=$1`,

        [userId]

    );

    const downloads=await pool.query(

        `SELECT COUNT(*) FROM downloads WHERE user_id=$1`,

        [userId]

    );

    bot.sendMessage(

        msg.chat.id,

`👤 <b>Your Profile</b>

━━━━━━━━━━━━━━

❤️ Favorites : ${fav.rows[0].count}

📜 History : ${history.rows[0].count}

📥 Downloads : ${downloads.rows[0].count}

━━━━━━━━━━━━━━`,

        {

            parse_mode:"HTML",

            reply_markup:{

                inline_keyboard:[

                    [

                        {

                            text:"❤️ Favorites",

                            callback_data:"my_favorites"

                        }

                    ],

                    [

                        {

                            text:"📜 Watch History",

                            callback_data:"my_history"

                        }

                    ],

                    [

                        {

                            text:"📥 Downloads",

                            callback_data:"my_downloads"

                        }

                    ]

                ]

            }

        }

    );

});

// ======================
// FAVORITES LIST
// ======================

bot.on("callback_query",async(query)=>{

    if(query.data!=="my_favorites")
        return;

    const result=await pool.query(

        `

        SELECT c.*

        FROM favorites f

        JOIN contents c

        ON c.content_id=f.content_id

        WHERE f.user_id=$1

        `,

        [query.from.id]

    );

    if(result.rows.length===0){

        return bot.sendMessage(

            query.message.chat.id,

            "❤️ Favorites Empty"

        );

    }

    const buttons=[];

    result.rows.forEach(item=>{

        buttons.push([

            {

                text:`🎬 ${item.title}`,

                callback_data:`quality_${item.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        query.message.chat.id,

        "❤️ Your Favorites",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

// ======================
// WATCH HISTORY
// ======================

bot.on("callback_query",async(query)=>{

    if(query.data!=="my_history")
        return;

    const result=await pool.query(

        `

        SELECT c.*

        FROM history h

        JOIN contents c

        ON c.content_id=h.content_id

        WHERE h.user_id=$1

        ORDER BY h.watched_at DESC

        LIMIT 20

        `,

        [query.from.id]

    );

    if(result.rows.length===0){

        return bot.sendMessage(

            query.message.chat.id,

            "📜 No Watch History"

        );

    }

    const buttons=[];

    result.rows.forEach(item=>{

        buttons.push([

            {

                text:`▶️ ${item.title}`,

                callback_data:`quality_${item.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        query.message.chat.id,

        "📜 Continue Watching",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

console.log("✅ PART 8 Loaded");
// ===================================================
// CineXClub Bot
// PART 9/30
// Movie Request + Admin Notification + Request System
// ===================================================

// ======================
// SAVE REQUEST
// ======================

async function saveRequest(username, request){

    try{

        await pool.query(

        `
        INSERT INTO requests(username,request)

        VALUES($1,$2)
        `,

        [

            username,

            request

        ]

        );

    }catch(err){

        console.log("Request Error:",err.message);

    }

}

// ======================
// REQUEST CALLBACK
// ======================

bot.on("callback_query",async(query)=>{

    if(!query.data.startsWith("request_"))
        return;

    const request=query.data.replace("request_","");

    const username=query.from.username
        ? "@"+query.from.username
        : query.from.first_name;

    await saveRequest(
        username,
        request
    );

    await bot.answerCallbackQuery(query.id,{

        text:"✅ Request Sent"

    });

    await bot.sendMessage(

        query.message.chat.id,

`✅ Your request has been submitted.

🎬 ${request}

Please wait for the admin to upload it.`

    );

    // Notify Admin

    if(ADMIN_CHAT_ID){

        try{

            await bot.sendMessage(

                ADMIN_CHAT_ID,

`📥 New Movie Request

👤 User : ${username}

🎬 Request : ${request}

🕒 ${new Date().toLocaleString()}`

            );

        }catch(err){

            console.log(err.message);

        }

    }

});

// ======================
// /REQUEST COMMAND
// ======================

bot.onText(/\/request (.+)/,async(msg,match)=>{

    const request=match[1];

    const username=msg.from.username
        ? "@"+msg.from.username
        : msg.from.first_name;

    await saveRequest(
        username,
        request
    );

    await bot.sendMessage(

        msg.chat.id,

`✅ Request Saved

🎬 ${request}`

    );

    if(ADMIN_CHAT_ID){

        try{

            await bot.sendMessage(

                ADMIN_CHAT_ID,

`📥 New Request

👤 ${username}

🎬 ${request}`

            );

        }catch(err){}

    }

});

// ======================
// MY REQUESTS
// ======================

bot.onText(/\/myrequests/,async(msg)=>{

    const username=msg.from.username
        ? "@"+msg.from.username
        : msg.from.first_name;

    const result=await pool.query(

        `
        SELECT *

        FROM requests

        WHERE username=$1

        ORDER BY created_at DESC

        LIMIT 20
        `,

        [username]

    );

    if(result.rows.length===0){

        return bot.sendMessage(

            msg.chat.id,

            "📭 No Requests Found."

        );

    }

    let text="📋 Your Requests\n\n";

    result.rows.forEach((item,index)=>{

        text+=`${index+1}. ${item.request}\n`;

    });

    bot.sendMessage(

        msg.chat.id,

        text

    );

});

console.log("✅ PART 9 Loaded");
// ===================================================
// CineXClub Bot
// PART 10/30
// Admin Panel + Dashboard + Broadcast
// ===================================================

// ======================
// ADMIN CHECK
// ======================

function isAdmin(userId){

    return String(userId)===String(ADMIN_CHAT_ID);

}

// ======================
// BROADCAST MODE
// ======================



// ======================
// ADMIN PANEL
// ======================

bot.onText(/\/admin/,async(msg)=>{

    if(!isAdmin(msg.from.id))
        return;

    const users=await pool.query(
        `SELECT COUNT(*) FROM users`
    );

    const movies=await pool.query(
        `SELECT COUNT(*) FROM contents WHERE type='Movie'`
    );

    const series=await pool.query(
        `SELECT COUNT(*) FROM contents WHERE type='Series'`
    );

    const anime=await pool.query(
        `SELECT COUNT(*) FROM contents WHERE type='Anime'`
    );

    const requests=await pool.query(
        `SELECT COUNT(*) FROM requests`
    );

    const favorites=await pool.query(
        `SELECT COUNT(*) FROM favorites`
    );

    const downloads=await pool.query(
        `SELECT COUNT(*) FROM downloads`
    );

    await bot.sendMessage(

        msg.chat.id,

`👑 <b>CineXClub Admin Panel</b>

━━━━━━━━━━━━━━

👥 Users : ${users.rows[0].count}

🎬 Movies : ${movies.rows[0].count}

📺 Series : ${series.rows[0].count}

🍥 Anime : ${anime.rows[0].count}

📩 Requests : ${requests.rows[0].count}

❤️ Favorites : ${favorites.rows[0].count}

📥 Downloads : ${downloads.rows[0].count}

━━━━━━━━━━━━━━`,

        {

            parse_mode:"HTML",

            reply_markup:{

                inline_keyboard:[

                    [

                        {

                            text:"📢 Broadcast",

                            callback_data:"admin_broadcast"

                        }

                    ],

                    [

                        {

                            text:"📊 Refresh",

                            callback_data:"admin_refresh"

                        }

                    ]

                ]

            }

        }

    );

});

// ======================
// ADMIN CALLBACK
// ======================

bot.on("callback_query",async(query)=>{

    if(!isAdmin(query.from.id))
        return;

    if(query.data==="admin_broadcast"){

        broadcastMode.set(
            query.from.id,
            true
        );

        return bot.sendMessage(

            query.message.chat.id,

            "📢 Send the broadcast message."

        );

    }

    if(query.data==="admin_refresh"){

        return bot.sendMessage(

            query.message.chat.id,

            "♻️ Refresh completed.\nUse /admin again."

        );

    }

});

// ======================
// BROADCAST MESSAGE
// ======================

bot.on("message",async(msg)=>{

    if(!broadcastMode.has(msg.from.id))
        return;

    broadcastMode.delete(msg.from.id);

    const users=await pool.query(
        `SELECT username FROM users`
    );

    let success=0;
    let failed=0;

    for(const user of users.rows){

        try{

            const username=user.username;

            if(
                username &&
                username.startsWith("@")
            ){

                await bot.sendMessage(

                    username,

                    msg.text

                );

                success++;

            }

        }catch(err){

            failed++;

        }

        await new Promise(r=>setTimeout(r,60));

    }

    bot.sendMessage(

        msg.chat.id,

`✅ Broadcast Completed

👥 Success : ${success}

❌ Failed : ${failed}`

    );

});

console.log("✅ PART 10 Loaded");
// ===================================================
// CineXClub Bot
// PART 11/30
// Trending + Latest + Random + Continue Watching
// ===================================================

// ======================
// LATEST UPLOADS
// ======================

bot.onText(/\/latest/, async (msg) => {

    const result = await pool.query(

        `
        SELECT *
        FROM contents
        ORDER BY created_at DESC
        LIMIT 20
        `

    );

    if(result.rows.length===0){

        return bot.sendMessage(
            msg.chat.id,
            "❌ No uploads available."
        );

    }

    const buttons=[];

    result.rows.forEach(item=>{

        buttons.push([

            {
                text:`🆕 ${item.title}`,
                callback_data:`quality_${item.content_id}`
            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "🆕 Latest Uploads",

        {

            reply_markup:{
                inline_keyboard:buttons
            }

        }

    );

});

// ======================
// RANDOM MOVIE
// ======================

bot.onText(/\/random/, async(msg)=>{

    const result = await pool.query(

        `
        SELECT *
        FROM contents
        ORDER BY RANDOM()
        LIMIT 1
        `

    );

    if(result.rows.length===0){

        return bot.sendMessage(
            msg.chat.id,
            "❌ No content found."
        );

    }

    showQuality(
        msg.chat.id,
        result.rows[0].content_id
    );

});

// ======================
// TRENDING
// ======================

bot.onText(/\/trending/, async(msg)=>{

    const result = await pool.query(

        `
        SELECT c.*,COUNT(d.id) total

        FROM contents c

        LEFT JOIN downloads d

        ON c.content_id=d.content_id

        GROUP BY c.id

        ORDER BY total DESC

        LIMIT 20
        `

    );

    if(result.rows.length===0){

        return bot.sendMessage(
            msg.chat.id,
            "❌ No trending content."
        );

    }

    const buttons=[];

    result.rows.forEach(item=>{

        buttons.push([

            {

                text:`🔥 ${item.title}`,

                callback_data:`quality_${item.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "🔥 Trending",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

// ======================
// CONTINUE WATCHING
// ======================

bot.onText(/\/continue/, async(msg)=>{

    const result = await pool.query(

        `
        SELECT c.*

        FROM history h

        JOIN contents c

        ON h.content_id=c.content_id

        WHERE h.user_id=$1

        ORDER BY h.watched_at DESC

        LIMIT 20
        `,

        [msg.from.id]

    );

    if(result.rows.length===0){

        return bot.sendMessage(

            msg.chat.id,

            "📺 No watch history."

        );

    }

    const buttons=[];

    result.rows.forEach(item=>{

        buttons.push([

            {

                text:`▶️ ${item.title}`,

                callback_data:`quality_${item.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "▶️ Continue Watching",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

// ======================
// POPULAR COLLECTIONS
// ======================

bot.onText(/\/collections/, async(msg)=>{

    const result=await pool.query(

        `
        SELECT collection,
        COUNT(*) total

        FROM contents

        WHERE collection IS NOT NULL

        GROUP BY collection

        ORDER BY total DESC
        `

    );

    if(result.rows.length===0){

        return bot.sendMessage(

            msg.chat.id,

            "❌ No collections found."

        );

    }

    const buttons=[];

    result.rows.forEach(item=>{

        buttons.push([

            {

                text:`📂 ${item.collection}`,

                callback_data:`collection_Movie_${item.collection}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "📂 Popular Collections",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

console.log("✅ PART 11 Loaded");
// ===================================================
// CineXClub Bot
// PART 12/30
// Statistics + Top Downloads + User Rankings + Bot Info
// ===================================================

// ======================
// /STATS
// ======================

bot.onText(/\/stats/, async (msg) => {

    if (!isAdmin(msg.from.id))
        return;

    const users = await pool.query(
        `SELECT COUNT(*) FROM users`
    );

    const contents = await pool.query(
        `SELECT COUNT(*) FROM contents`
    );

    const downloads = await pool.query(
        `SELECT COUNT(*) FROM downloads`
    );

    const favorites = await pool.query(
        `SELECT COUNT(*) FROM favorites`
    );

    const history = await pool.query(
        `SELECT COUNT(*) FROM history`
    );

    const requests = await pool.query(
        `SELECT COUNT(*) FROM requests`
    );

    bot.sendMessage(

        msg.chat.id,

`📊 <b>Bot Statistics</b>

━━━━━━━━━━━━━━

👥 Users : ${users.rows[0].count}

🎬 Total Contents : ${contents.rows[0].count}

📥 Downloads : ${downloads.rows[0].count}

❤️ Favorites : ${favorites.rows[0].count}

📺 Watch History : ${history.rows[0].count}

📩 Requests : ${requests.rows[0].count}

━━━━━━━━━━━━━━`,

        {

            parse_mode: "HTML"

        }

    );

});

// ======================
// TOP DOWNLOADED MOVIES
// ======================

bot.onText(/\/top/, async (msg) => {

    const result = await pool.query(

`
SELECT

c.title,
c.content_id,
COUNT(d.id) total

FROM contents c

LEFT JOIN downloads d

ON c.content_id=d.content_id

GROUP BY c.id

ORDER BY total DESC

LIMIT 15
`

    );

    if(result.rows.length===0){

        return bot.sendMessage(

            msg.chat.id,

            "❌ No download data."

        );

    }

    const buttons=[];

    result.rows.forEach(item=>{

        buttons.push([

            {

                text:`🔥 ${item.title} (${item.total})`,

                callback_data:`quality_${item.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "🔥 Top Downloaded",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

// ======================
// TOP USERS
// ======================

bot.onText(/\/topusers/, async(msg)=>{

    if(!isAdmin(msg.from.id))
        return;

    const result=await pool.query(

`
SELECT

username,

COUNT(*) total

FROM downloads d

JOIN users u

ON '@'||REPLACE(u.username,'@','')='@'||REPLACE(u.username,'@','')

GROUP BY username

ORDER BY total DESC

LIMIT 20
`

    );

    if(result.rows.length===0){

        return bot.sendMessage(

            msg.chat.id,

            "No user data."

        );

    }

    let text="🏆 Top Active Users\n\n";

    result.rows.forEach((user,index)=>{

        text+=`${index+1}. ${user.username} - ${user.total}\n`;

    });

    bot.sendMessage(

        msg.chat.id,

        text

    );

});

// ======================
// BOT INFO
// ======================

bot.onText(/\/about/, async(msg)=>{

    bot.sendMessage(

        msg.chat.id,

`🎬 <b>CineXClub Bot</b>

Version : 3.0

Features:

✅ Movies
✅ Series
✅ Anime
✅ Collections
✅ Search
✅ Force Join
✅ Favorites
✅ Watch History
✅ Downloads
✅ Requests
✅ Auto Delete
✅ Deep Link
✅ Admin Panel
✅ Trending
✅ Random Movie
✅ Continue Watching
✅ Top Downloads

⭐ Powered By CineXClub`,

        {

            parse_mode:"HTML"

        }

    );

});

console.log("✅ PART 12 Loaded");
// ===================================================
// CineXClub Bot
// PART 13/30
// Premium Users + IMDb + Trailer + Poster
// ===================================================

// ======================
// PREMIUM CHECK
// ======================

async function isPremium(userId){

    try{

        const result = await pool.query(

        `
        SELECT *

        FROM premium_users

        WHERE user_id=$1

        AND expiry > NOW()

        LIMIT 1
        `,

        [userId]

        );

        return result.rows.length>0;

    }catch(err){

        console.log(err.message);

        return false;

    }

}

// ======================
// ADD PREMIUM
// ======================

bot.onText(/\/addpremium (\d+) (\d+)/,async(msg,match)=>{

    if(!isAdmin(msg.from.id))
        return;

    const userId=match[1];
    const days=parseInt(match[2]);

    await pool.query(

    `
    INSERT INTO premium_users(

    user_id,

    expiry

    )

    VALUES(

    $1,

    NOW()+($2||' days')::INTERVAL

    )

    ON CONFLICT(user_id)

    DO UPDATE SET

    expiry=NOW()+($2||' days')::INTERVAL
    `,

    [

    userId,

    days

    ]

    );

    bot.sendMessage(

        msg.chat.id,

        `✅ Premium Added\n\n👤 ${userId}\n📅 ${days} Days`

    );

});

// ======================
// PREMIUM STATUS
// ======================

bot.onText(/\/premium/,async(msg)=>{

    const premium=await isPremium(msg.from.id);

    if(!premium){

        return bot.sendMessage(

            msg.chat.id,

            "❌ You are not a Premium User."

        );

    }

    bot.sendMessage(

        msg.chat.id,

        "👑 Premium Membership Active"

    );

});

// ======================
// IMDB SEARCH
// ======================

bot.onText(/\/imdb (.+)/,async(msg,match)=>{

    const keyword=match[1];

    bot.sendMessage(

        msg.chat.id,

`🎬 IMDb Search

Movie : ${keyword}

(OMDb / TMDb API will be connected in Part 26.)`

    );

});

// ======================
// TRAILER
// ======================

bot.onText(/\/trailer (.+)/,async(msg,match)=>{

    const movie=encodeURIComponent(match[1]);

    bot.sendMessage(

        msg.chat.id,

        `🎥 Trailer\n\nhttps://www.youtube.com/results?search_query=${movie}+official+trailer`

    );

});

// ======================
// POSTER
// ======================

bot.onText(/\/poster (.+)/,async(msg,match)=>{

    const movie=encodeURIComponent(match[1]);

    bot.sendMessage(

        msg.chat.id,

        `🖼 Poster Search\n\nhttps://www.google.com/search?tbm=isch&q=${movie}+movie+poster`

    );

});

console.log("✅ PART 13 Loaded");
// ===================================================
// CineXClub Bot
// PART 14/30
// Settings + User Preferences + Auto Delete
// ===================================================

// ======================
// SETTINGS TABLE
// ======================

async function initSettingsTable(){

    try{

        await pool.query(`

        CREATE TABLE IF NOT EXISTS settings(

        user_id BIGINT PRIMARY KEY,

        language TEXT DEFAULT 'English',

        auto_delete INTEGER DEFAULT 10,

        notifications BOOLEAN DEFAULT TRUE,

        theme TEXT DEFAULT 'Default'

        );

        `);

        console.log("✅ Settings Table Ready");

    }catch(err){

        console.log(err.message);

    }

}

initSettingsTable();

// ======================
// GET SETTINGS
// ======================

async function getSettings(userId){

    const result=await pool.query(

    `

    SELECT *

    FROM settings

    WHERE user_id=$1

    `,

    [userId]

    );

    if(result.rows.length){

        return result.rows[0];

    }

    await pool.query(

    `

    INSERT INTO settings(user_id)

    VALUES($1)

    `,

    [userId]

    );

    return{

        language:"English",

        auto_delete:10,

        notifications:true,

        theme:"Default"

    };

}

// ======================
// SETTINGS COMMAND
// ======================

bot.onText(/\/settings/,async(msg)=>{

    const settings=

    await getSettings(msg.from.id);

    bot.sendMessage(

        msg.chat.id,

`⚙️ Settings

🌐 Language : ${settings.language}

🗑 Auto Delete : ${settings.auto_delete} Min

🔔 Notifications : ${settings.notifications}

🎨 Theme : ${settings.theme}

Choose an option.`,

        {

            reply_markup:{

                inline_keyboard:[

                    [

                        {

                            text:"🌐 Language",

                            callback_data:"set_language"

                        }

                    ],

                    [

                        {

                            text:"🗑 Auto Delete",

                            callback_data:"set_delete"

                        }

                    ],

                    [

                        {

                            text:"🔔 Notifications",

                            callback_data:"set_notification"

                        }

                    ],

                    [

                        {

                            text:"🎨 Theme",

                            callback_data:"set_theme"

                        }

                    ]

                ]

            }

        }

    );

});

// ======================
// CALLBACKS
// ======================

bot.on("callback_query",async(query)=>{

    const userId=query.from.id;

    switch(query.data){

        case "set_language":

        return bot.sendMessage(

        query.message.chat.id,

        "🌐 Feature available in Part 15."

        );

        case "set_delete":

        return bot.sendMessage(

        query.message.chat.id,

        "🗑 Auto Delete settings available in Part 15."

        );

        case "set_notification":

        return bot.sendMessage(

        query.message.chat.id,

        "🔔 Notification settings available in Part 15."

        );

        case "set_theme":

        return bot.sendMessage(

        query.message.chat.id,

        "🎨 Theme settings available in Part 15."

        );

    }

});

console.log("✅ PART 14 Loaded");
// ===================================================
// CineXClub Bot
// PART 15/30
// Settings Update + Language + Theme + Notifications
// ===================================================

// ======================
// UPDATE LANGUAGE
// ======================

async function updateLanguage(userId, language){

    await pool.query(

        `
        UPDATE settings
        SET language=$1
        WHERE user_id=$2
        `,

        [language, userId]

    );

}

// ======================
// UPDATE AUTO DELETE
// ======================

async function updateAutoDelete(userId, minutes){

    await pool.query(

        `
        UPDATE settings
        SET auto_delete=$1
        WHERE user_id=$2
        `,

        [minutes, userId]

    );

}

// ======================
// UPDATE NOTIFICATIONS
// ======================

async function updateNotifications(userId, status){

    await pool.query(

        `
        UPDATE settings
        SET notifications=$1
        WHERE user_id=$2
        `,

        [status, userId]

    );

}

// ======================
// UPDATE THEME
// ======================

async function updateTheme(userId, theme){

    await pool.query(

        `
        UPDATE settings
        SET theme=$1
        WHERE user_id=$2
        `,

        [theme, userId]

    );

}

// ======================
// SETTINGS CALLBACKS
// ======================

bot.on("callback_query", async(query)=>{

    const chatId = query.message.chat.id;
    const userId = query.from.id;

    switch(query.data){

        // ---------- Language ----------

        case "set_language":

        return bot.editMessageText(

            "🌐 Select Language",

            {

                chat_id:chatId,

                message_id:query.message.message_id,

                reply_markup:{

                    inline_keyboard:[

                        [
                            {
                                text:"🇬🇧 English",
                                callback_data:"lang_English"
                            }
                        ],

                        [
                            {
                                text:"🇮🇳 Telugu",
                                callback_data:"lang_Telugu"
                            }
                        ]

                    ]

                }

            }

        );

    }

    // ---------- Language Selected ----------

    if(query.data.startsWith("lang_")){

        const lang=query.data.replace("lang_","");

        await updateLanguage(userId,lang);

        await bot.answerCallbackQuery(query.id,{

            text:"Language Updated ✅"

        });

        return bot.sendMessage(

            chatId,

            `🌐 Language changed to ${lang}`

        );

    }

    // ---------- Auto Delete ----------

    if(query.data==="set_delete"){

        return bot.editMessageText(

            "🗑 Select Auto Delete Time",

            {

                chat_id:chatId,

                message_id:query.message.message_id,

                reply_markup:{

                    inline_keyboard:[

                        [

                            {
                                text:"5 Min",
                                callback_data:"delete_5"
                            },

                            {
                                text:"10 Min",
                                callback_data:"delete_10"
                            }

                        ],

                        [

                            {
                                text:"30 Min",
                                callback_data:"delete_30"
                            },

                            {
                                text:"60 Min",
                                callback_data:"delete_60"
                            }

                        ]

                    ]

                }

            }

        );

    }

    if(query.data.startsWith("delete_")){

        const value=parseInt(
            query.data.replace("delete_","")
        );

        await updateAutoDelete(userId,value);

        await bot.answerCallbackQuery(query.id,{

            text:"Updated Successfully"

        });

        return bot.sendMessage(

            chatId,

            `🗑 Auto Delete set to ${value} Minutes`

        );

    }

    // ---------- Notifications ----------

    if(query.data==="set_notification"){

        return bot.editMessageText(

            "🔔 Notifications",

            {

                chat_id:chatId,

                message_id:query.message.message_id,

                reply_markup:{

                    inline_keyboard:[

                        [

                            {

                                text:"✅ Enable",

                                callback_data:"notify_true"

                            }

                        ],

                        [

                            {

                                text:"❌ Disable",

                                callback_data:"notify_false"

                            }

                        ]

                    ]

                }

            }

        );

    }

    if(query.data.startsWith("notify_")){

        const value=
        query.data==="notify_true";

        await updateNotifications(
            userId,
            value
        );

        await bot.answerCallbackQuery(query.id);

        return bot.sendMessage(

            chatId,

            `🔔 Notifications ${
                value ? "Enabled" : "Disabled"
            }`

        );

    }

    // ---------- Theme ----------

    if(query.data==="set_theme"){

        return bot.editMessageText(

            "🎨 Select Theme",

            {

                chat_id:chatId,

                message_id:query.message.message_id,

                reply_markup:{

                    inline_keyboard:[

                        [

                            {

                                text:"🌙 Dark",

                                callback_data:"theme_Dark"

                            },

                            {

                                text:"☀️ Light",

                                callback_data:"theme_Light"

                            }

                        ],

                        [

                            {

                                text:"⭐ Default",

                                callback_data:"theme_Default"

                            }

                        ]

                    ]

                }

            }

        );

    }

    if(query.data.startsWith("theme_")){

        const theme=query.data.replace("theme_","");

        await updateTheme(
            userId,
            theme
        );

        await bot.answerCallbackQuery(query.id);

        return bot.sendMessage(

            chatId,

            `🎨 Theme changed to ${theme}`

        );

    }

});

console.log("✅ PART 15 Loaded");
// ===================================================
// CineXClub Bot
// PART 16/30
// Favorites + Downloads + Watch History
// ===================================================

// ======================
// DATABASE TABLES
// ======================

async function initHistoryTables(){

    try{

        await pool.query(`

CREATE TABLE IF NOT EXISTS favorites(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

created_at TIMESTAMP DEFAULT NOW(),

UNIQUE(user_id,content_id)

);

CREATE TABLE IF NOT EXISTS downloads(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

CREATE TABLE IF NOT EXISTS history(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

watched_at TIMESTAMP DEFAULT NOW()

);

`);

        console.log("✅ History Tables Ready");

    }catch(err){

        console.log(err.message);

    }

}

initHistoryTables();

// ======================
// SAVE DOWNLOAD
// ======================

async function saveDownload(userId,contentId){

    try{

        await pool.query(

        `
        INSERT INTO downloads(user_id,content_id)

        VALUES($1,$2)
        `,

        [userId,contentId]

        );

    }catch{}

}

// ======================
// SAVE WATCH HISTORY
// ======================

async function saveHistory(userId,contentId){

    try{

        await pool.query(

        `
        INSERT INTO history(user_id,content_id)

        VALUES($1,$2)
        `,

        [userId,contentId]

        );

    }catch{}

}

// ======================
// ADD / REMOVE FAVORITE
// ======================

bot.on("callback_query",async(query)=>{

    const data=query.data;

    if(!data.startsWith("fav_"))
        return;

    const contentId=data.replace("fav_","");

    const userId=query.from.id;

    const exists=await pool.query(

    `
    SELECT *

    FROM favorites

    WHERE user_id=$1

    AND content_id=$2
    `,

    [userId,contentId]

    );

    if(exists.rows.length){

        await pool.query(

        `
        DELETE FROM favorites

        WHERE user_id=$1

        AND content_id=$2
        `,

        [userId,contentId]

        );

        return bot.answerCallbackQuery(query.id,{

            text:"💔 Removed from Favorites"

        });

    }

    await pool.query(

    `
    INSERT INTO favorites(user_id,content_id)

    VALUES($1,$2)
    `,

    [userId,contentId]

    );

    bot.answerCallbackQuery(query.id,{

        text:"❤️ Added to Favorites"

    });

});

// ======================
// FAVORITES
// ======================

bot.onText(/\/favorites/,async(msg)=>{

    const result=await pool.query(

`
SELECT c.*

FROM favorites f

JOIN contents c

ON f.content_id=c.content_id

WHERE f.user_id=$1

ORDER BY f.created_at DESC
`,

[msg.from.id]

    );

    if(!result.rows.length){

        return bot.sendMessage(

            msg.chat.id,

            "❤️ Favorites list is empty."

        );

    }

    const buttons=[];

    result.rows.forEach(item=>{

        buttons.push([

            {

                text:`❤️ ${item.title}`,

                callback_data:`quality_${item.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "❤️ Your Favorites",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

// ======================
// DOWNLOAD HISTORY
// ======================

bot.onText(/\/downloads/,async(msg)=>{

    const result=await pool.query(

`
SELECT c.*

FROM downloads d

JOIN contents c

ON d.content_id=c.content_id

WHERE d.user_id=$1

ORDER BY d.created_at DESC

LIMIT 30
`,

[msg.from.id]

    );

    if(!result.rows.length){

        return bot.sendMessage(

            msg.chat.id,

            "📥 No download history."

        );

    }

    const buttons=[];

    result.rows.forEach(item=>{

        buttons.push([

            {

                text:`📥 ${item.title}`,

                callback_data:`quality_${item.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "📥 Download History",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

// ======================
// WATCH HISTORY
// ======================

bot.onText(/\/history/,async(msg)=>{

    const result=await pool.query(

`
SELECT c.*

FROM history h

JOIN contents c

ON h.content_id=c.content_id

WHERE h.user_id=$1

ORDER BY h.watched_at DESC

LIMIT 30
`,

[msg.from.id]

    );

    if(!result.rows.length){

        return bot.sendMessage(

            msg.chat.id,

            "👀 Watch History is empty."

        );

    }

    const buttons=[];

    result.rows.forEach(item=>{

        buttons.push([

            {

                text:`▶️ ${item.title}`,

                callback_data:`quality_${item.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "👀 Watch History",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

console.log("✅ PART 16 Loaded");
// ===================================================
// CineXClub Bot
// PART 17/30
// Ratings + Reviews + Like / Dislike System
// ===================================================

// ======================
// DATABASE TABLES
// ======================

async function initRatingTables(){

    try{

        await pool.query(`

CREATE TABLE IF NOT EXISTS ratings(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

rating INTEGER,

created_at TIMESTAMP DEFAULT NOW(),

UNIQUE(user_id,content_id)

);

CREATE TABLE IF NOT EXISTS reviews(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

review TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

CREATE TABLE IF NOT EXISTS likes(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

liked BOOLEAN,

created_at TIMESTAMP DEFAULT NOW(),

UNIQUE(user_id,content_id)

);

`);

        console.log("✅ Rating Tables Ready");

    }catch(err){

        console.log(err.message);

    }

}

initRatingTables();

// ======================
// SAVE RATING
// ======================

async function saveRating(userId,contentId,rating){

    await pool.query(

`
INSERT INTO ratings(user_id,content_id,rating)

VALUES($1,$2,$3)

ON CONFLICT(user_id,content_id)

DO UPDATE SET

rating=EXCLUDED.rating
`,

[userId,contentId,rating]

    );

}

// ======================
// RATING CALLBACK
// ======================

bot.on("callback_query",async(query)=>{

    if(!query.data.startsWith("rate_"))
        return;

    const parts=query.data.split("_");

    const rating=parseInt(parts[1]);

    const contentId=parts.slice(2).join("_");

    await saveRating(

        query.from.id,

        contentId,

        rating

    );

    bot.answerCallbackQuery(query.id,{

        text:`⭐ Rated ${rating}/5`

    });

});

// ======================
// LIKE / DISLIKE
// ======================

bot.on("callback_query",async(query)=>{

    if(

        !query.data.startsWith("like_")

        &&

        !query.data.startsWith("dislike_")

    ) return;

    const liked=query.data.startsWith("like_");

    const contentId=query.data

    .replace("like_","")

    .replace("dislike_","");

    await pool.query(

`
INSERT INTO likes(

user_id,

content_id,

liked

)

VALUES($1,$2,$3)

ON CONFLICT(user_id,content_id)

DO UPDATE SET

liked=EXCLUDED.liked
`,

[

query.from.id,

contentId,

liked

]

    );

    bot.answerCallbackQuery(

        query.id,

        {

            text:liked?

            "👍 Liked"

            :

            "👎 Disliked"

        }

    );

});

// ======================
// REVIEW COMMAND
// ======================

bot.onText(/\/review (.+?) \| (.+)/,async(msg,match)=>{

    const contentId=match[1];

    const review=match[2];

    await pool.query(

`
INSERT INTO reviews(

user_id,

content_id,

review

)

VALUES($1,$2,$3)
`,

[

msg.from.id,

contentId,

review

]

    );

    bot.sendMessage(

        msg.chat.id,

        "💬 Review Saved Successfully."

    );

});

// ======================
// SHOW REVIEWS
// ======================

bot.onText(/\/reviews (.+)/,async(msg,match)=>{

    const contentId=match[1];

    const result=await pool.query(

`
SELECT review

FROM reviews

WHERE content_id=$1

ORDER BY created_at DESC

LIMIT 10
`,

[contentId]

    );

    if(!result.rows.length){

        return bot.sendMessage(

            msg.chat.id,

            "💬 No Reviews Yet."

        );

    }

    let text="💬 Latest Reviews\n\n";

    result.rows.forEach((r,i)=>{

        text+=`${i+1}. ${r.review}\n\n`;

    });

    bot.sendMessage(

        msg.chat.id,

        text

    );

});

// ======================
// TOP RATED
// ======================

bot.onText(/\/toprated/,async(msg)=>{

    const result=await pool.query(

`
SELECT

c.title,

c.content_id,

ROUND(AVG(r.rating),1) avg_rating

FROM ratings r

JOIN contents c

ON r.content_id=c.content_id

GROUP BY c.id

ORDER BY avg_rating DESC

LIMIT 20
`

    );

    if(!result.rows.length){

        return bot.sendMessage(

            msg.chat.id,

            "⭐ No Ratings Yet."

        );

    }

    const buttons=[];

    result.rows.forEach(movie=>{

        buttons.push([

            {

                text:`⭐ ${movie.title} (${movie.avg_rating})`,

                callback_data:`quality_${movie.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "⭐ Top Rated Movies",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

console.log("✅ PART 17 Loaded");
// ===================================================
// CineXClub Bot
// PART 18/30
// Referral + Reward Points + Redeem + Leaderboard
// ===================================================

// ======================
// DATABASE TABLES
// ======================

async function initRewardTables(){

    try{

        await pool.query(`

CREATE TABLE IF NOT EXISTS rewards(

id SERIAL PRIMARY KEY,

user_id BIGINT UNIQUE,

points INTEGER DEFAULT 0,

referrals INTEGER DEFAULT 0,

created_at TIMESTAMP DEFAULT NOW()

);

CREATE TABLE IF NOT EXISTS referrals(

id SERIAL PRIMARY KEY,

referrer BIGINT,

referred BIGINT UNIQUE,

created_at TIMESTAMP DEFAULT NOW()

);

`);

        console.log("✅ Reward Tables Ready");

    }catch(err){

        console.log(err.message);

    }

}

initRewardTables();

// ======================
// CREATE ACCOUNT
// ======================

async function createRewardAccount(userId){

    await pool.query(

`
INSERT INTO rewards(user_id)

VALUES($1)

ON CONFLICT(user_id)

DO NOTHING
`,

[userId]

    );

}

// ======================
// ADD POINTS
// ======================

async function addPoints(userId,points){

    await createRewardAccount(userId);

    await pool.query(

`
UPDATE rewards

SET points=points+$1

WHERE user_id=$2
`,

[points,userId]

    );

}

// ======================
// REFERRAL BONUS
// ======================

async function processReferral(referrer,referred){

    if(referrer==referred)
        return;

    const exists=await pool.query(

`
SELECT *

FROM referrals

WHERE referred=$1
`,

[referred]

    );

    if(exists.rows.length)
        return;

    await pool.query(

`
INSERT INTO referrals(

referrer,

referred

)

VALUES($1,$2)
`,

[referrer,referred]

    );

    await createRewardAccount(referrer);

    await addPoints(referrer,50);

    await pool.query(

`
UPDATE rewards

SET referrals=referrals+1

WHERE user_id=$1
`,

[referrer]

    );

}

// ======================
// REFERRAL LINK
// ======================

bot.onText(/\/invite/,async(msg)=>{

    await createRewardAccount(msg.from.id);

    const link=

`https://t.me/${BOT_USERNAME}?start=ref_${msg.from.id}`;

    bot.sendMessage(

        msg.chat.id,

`🎁 Invite Friends

Share your link:

${link}

💰 Reward:
50 Points per referral.`

    );

});

// ======================
// MY POINTS
// ======================

bot.onText(/\/points/,async(msg)=>{

    await createRewardAccount(msg.from.id);

    const result=await pool.query(

`
SELECT *

FROM rewards

WHERE user_id=$1
`,

[msg.from.id]

    );

    const user=result.rows[0];

    bot.sendMessage(

        msg.chat.id,

`🏆 Reward Wallet

💰 Points : ${user.points}

👥 Referrals : ${user.referrals}

🎁 Use /redeem to redeem.`

    );

});

// ======================
// REDEEM
// ======================

bot.onText(/\/redeem/,async(msg)=>{

    const result=await pool.query(

`
SELECT points

FROM rewards

WHERE user_id=$1
`,

[msg.from.id]

    );

    if(!result.rows.length){

        return bot.sendMessage(

            msg.chat.id,

            "❌ No reward account."

        );

    }

    const points=result.rows[0].points;

    if(points<500){

        return bot.sendMessage(

            msg.chat.id,

            `❌ Need 500 points.

Current : ${points}`

        );

    }

    await pool.query(

`
UPDATE rewards

SET points=points-500

WHERE user_id=$1
`,

[msg.from.id]

    );

    bot.sendMessage(

        msg.chat.id,

"🎉 Redeem request submitted."

    );

});

// ======================
// LEADERBOARD
// ======================

bot.onText(/\/leaderboard/,async(msg)=>{

    const result=await pool.query(

`
SELECT *

FROM rewards

ORDER BY points DESC

LIMIT 20
`

    );

    let text="🏆 Leaderboard\n\n";

    result.rows.forEach((user,index)=>{

        text+=`${index+1}. ${user.user_id} — ${user.points} Points\n`;

    });

    bot.sendMessage(

        msg.chat.id,

        text

    );

});

console.log("✅ PART 18 Loaded");
// ===================================================
// CineXClub Bot
// PART 19/30
// AI Search + Genre + Language + Year + Recommendation
// ===================================================

// ======================
// SEARCH FILTER TABLE
// ======================

async function initFilterColumns(){

    try{

        await pool.query(`

ALTER TABLE contents
ADD COLUMN IF NOT EXISTS genre TEXT;

ALTER TABLE contents
ADD COLUMN IF NOT EXISTS imdb REAL;

`);

        console.log("✅ Filter Columns Ready");

    }catch(err){

        console.log(err.message);

    }

}

initFilterColumns();

// ======================
// AI SEARCH
// ======================

bot.onText(/\/ai (.+)/,async(msg,match)=>{

    const keyword=match[1].trim();

    const result=await pool.query(

`
SELECT *

FROM contents

WHERE

LOWER(title) LIKE LOWER($1)

OR LOWER(collection) LIKE LOWER($1)

OR LOWER(type) LIKE LOWER($1)

OR LOWER(language) LIKE LOWER($1)

OR LOWER(genre) LIKE LOWER($1)

LIMIT 20
`,

[`%${keyword}%`]

    );

    if(!result.rows.length){

        return bot.sendMessage(

            msg.chat.id,

            "❌ No matching content found."

        );

    }

    const buttons=[];

    result.rows.forEach(movie=>{

        buttons.push([

            {

                text:`🎬 ${movie.title}`,

                callback_data:`quality_${movie.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "🤖 AI Search Results",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

// ======================
// GENRE FILTER
// ======================

bot.onText(/\/genre (.+)/,async(msg,match)=>{

    const genre=match[1];

    const result=await pool.query(

`
SELECT *

FROM contents

WHERE LOWER(genre)=LOWER($1)

ORDER BY title

LIMIT 30
`,

[genre]

    );

    if(!result.rows.length){

        return bot.sendMessage(

            msg.chat.id,

            "❌ No content found."

        );

    }

    const buttons=[];

    result.rows.forEach(movie=>{

        buttons.push([

            {

                text:`🎭 ${movie.title}`,

                callback_data:`quality_${movie.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        `🎭 ${genre} Movies`,

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

// ======================
// LANGUAGE FILTER
// ======================

bot.onText(/\/language (.+)/,async(msg,match)=>{

    const language=match[1];

    const result=await pool.query(

`
SELECT *

FROM contents

WHERE LOWER(language)=LOWER($1)

LIMIT 30
`,

[language]

    );

    const buttons=[];

    result.rows.forEach(movie=>{

        buttons.push([

            {

                text:`🌎 ${movie.title}`,

                callback_data:`quality_${movie.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        `🌎 ${language} Content`,

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

// ======================
// YEAR FILTER
// ======================

bot.onText(/\/year (.+)/,async(msg,match)=>{

    const year=match[1];

    const result=await pool.query(

`
SELECT *

FROM contents

WHERE year=$1

LIMIT 30
`,

[year]

    );

    const buttons=[];

    result.rows.forEach(movie=>{

        buttons.push([

            {

                text:`📅 ${movie.title}`,

                callback_data:`quality_${movie.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        `📅 Released in ${year}`,

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

// ======================
// IMDB FILTER
// ======================

bot.onText(/\/imdbrating (.+)/,async(msg,match)=>{

    const rating=parseFloat(match[1]);

    const result=await pool.query(

`
SELECT *

FROM contents

WHERE imdb >= $1

ORDER BY imdb DESC

LIMIT 30
`,

[rating]

    );

    const buttons=[];

    result.rows.forEach(movie=>{

        buttons.push([

            {

                text:`⭐ ${movie.title} (${movie.imdb})`,

                callback_data:`quality_${movie.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        `⭐ IMDb ${rating}+`,

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

// ======================
// RANDOM RECOMMENDATION
// ======================

bot.onText(/\/recommend/,async(msg)=>{

    const result=await pool.query(

`
SELECT *

FROM contents

ORDER BY RANDOM()

LIMIT 1
`

    );

    if(!result.rows.length){

        return bot.sendMessage(

            msg.chat.id,

            "❌ No content available."

        );

    }

    const movie=result.rows[0];

    bot.sendMessage(

        msg.chat.id,

`🎲 Recommended For You

🎬 ${movie.title}

🎥 ${movie.quality}

🌎 ${movie.language}

📅 ${movie.year}`,

        {

            reply_markup:{

                inline_keyboard:[

                    [

                        {

                            text:"▶️ Watch",

                            callback_data:`quality_${movie.content_id}`

                        }

                    ]

                ]

            }

        }

    );

});

console.log("✅ PART 19 Loaded");
// ===================================================
// CineXClub Bot
// PART 20/30
// Continue Watching + Recently Added + Trending + Random
// ===================================================

// ======================
// CONTINUE WATCHING
// ======================

bot.onText(/\/continue/, async (msg) => {

    const result = await pool.query(

`
SELECT c.*

FROM history h

JOIN contents c

ON h.content_id=c.content_id

WHERE h.user_id=$1

ORDER BY h.watched_at DESC

LIMIT 1
`,

[msg.from.id]

    );

    if (!result.rows.length) {

        return bot.sendMessage(

            msg.chat.id,

            "❌ Nothing to continue."

        );

    }

    const item = result.rows[0];

    bot.sendMessage(

        msg.chat.id,

`▶️ Continue Watching

🎬 ${item.title}

📺 ${item.type}

🎥 ${item.quality}`,

        {

            reply_markup: {

                inline_keyboard: [

                    [

                        {

                            text: "▶️ Watch Now",

                            callback_data: `quality_${item.content_id}`

                        }

                    ]

                ]

            }

        }

    );

});

// ======================
// RECENTLY ADDED
// ======================

bot.onText(/\/recent/, async (msg) => {

    const result = await pool.query(

`
SELECT *

FROM contents

ORDER BY created_at DESC

LIMIT 20
`

    );

    if (!result.rows.length) {

        return bot.sendMessage(

            msg.chat.id,

            "❌ No recent uploads."

        );

    }

    const buttons = [];

    result.rows.forEach(item => {

        buttons.push([

            {

                text: `🆕 ${item.title}`,

                callback_data: `quality_${item.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "🆕 Recently Added",

        {

            reply_markup: {

                inline_keyboard: buttons

            }

        }

    );

});

// ======================
// TRENDING
// ======================

bot.onText(/\/trending/, async (msg) => {

    const result = await pool.query(

`
SELECT

c.title,
c.content_id,
COUNT(d.id) downloads

FROM contents c

LEFT JOIN downloads d

ON c.content_id=d.content_id

GROUP BY c.id

ORDER BY downloads DESC

LIMIT 20
`

    );

    if (!result.rows.length) {

        return bot.sendMessage(

            msg.chat.id,

            "❌ No trending content."

        );

    }

    const buttons = [];

    result.rows.forEach(item => {

        buttons.push([

            {

                text: `🔥 ${item.title}`,

                callback_data: `quality_${item.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "🔥 Trending Now",

        {

            reply_markup: {

                inline_keyboard: buttons

            }

        }

    );

});

// ======================
// RANDOM MOVIE
// ======================

bot.onText(/\/random/, async (msg) => {

    const result = await pool.query(

`
SELECT *

FROM contents

ORDER BY RANDOM()

LIMIT 1
`

    );

    if (!result.rows.length) {

        return bot.sendMessage(

            msg.chat.id,

            "❌ No content available."

        );

    }

    const item = result.rows[0];

    bot.sendMessage(

        msg.chat.id,

`🎲 Random Pick

🎬 ${item.title}

📂 ${item.type}

🎥 ${item.quality}

🌎 ${item.language}

📅 ${item.year}`,

        {

            reply_markup: {

                inline_keyboard: [

                    [

                        {

                            text: "▶️ Watch",

                            callback_data: `quality_${item.content_id}`

                        }

                    ],

                    [

                        {

                            text: "🎲 Another",

                            callback_data: "random_again"

                        }

                    ]

                ]

            }

        }

    );

});

// ======================
// RANDOM CALLBACK
// ======================

bot.on("callback_query", async (query) => {

    if (query.data !== "random_again")
        return;

    const result = await pool.query(

`
SELECT *

FROM contents

ORDER BY RANDOM()

LIMIT 1
`

    );

    if (!result.rows.length)
        return;

    const item = result.rows[0];

    bot.sendMessage(

        query.message.chat.id,

`🎲 Another Recommendation

🎬 ${item.title}`,

        {

            reply_markup: {

                inline_keyboard: [

                    [

                        {

                            text: "▶️ Watch",

                            callback_data: `quality_${item.content_id}`

                        }

                    ]

                ]

            }

        }

    );

});

console.log("✅ PART 20 Loaded");
// ===================================================
// CineXClub Bot
// PART 21/30
// Broadcast + Scheduled Messages + Announcements
// ===================================================

// ======================
// BROADCAST
// ======================

bot.onText(/\/broadcast (.+)/s, async (msg, match) => {

    if (!isAdmin(msg.from.id))
        return;

    const text = match[1];

    const users = await pool.query(
        `SELECT username FROM users`
    );

    let success = 0;
    let failed = 0;

    await bot.sendMessage(
        msg.chat.id,
        `📢 Broadcasting to ${users.rows.length} users...`
    );

    for (const user of users.rows) {

        try {

            const chat =
                await bot.getChat(user.username);

            await bot.sendMessage(
                chat.id,
                text,
                {
                    parse_mode: "HTML"
                }
            );

            success++;

            await new Promise(r=>setTimeout(r,80));

        } catch {

            failed++;

        }

    }

    bot.sendMessage(

        msg.chat.id,

`✅ Broadcast Finished

👥 Sent : ${success}

❌ Failed : ${failed}`

    );

});

// ======================
// ANNOUNCEMENT
// ======================

bot.onText(/\/announce (.+)/s, async(msg,match)=>{

    if(!isAdmin(msg.from.id))
        return;

    const users=await pool.query(
        `SELECT username FROM users`
    );

    for(const user of users.rows){

        try{

            const chat=
            await bot.getChat(user.username);

            await bot.sendMessage(

                chat.id,

`📢 <b>Announcement</b>

━━━━━━━━━━━━━━

${match[1]}

━━━━━━━━━━━━━━

⭐ CineXClub`,

                {

                    parse_mode:"HTML"

                }

            );

        }catch{}

    }

    bot.sendMessage(
        msg.chat.id,
        "✅ Announcement Sent."
    );

});

// ======================
// SCHEDULED MESSAGE
// ======================

function scheduleBroadcast(message,hours){

    setTimeout(async()=>{

        const users=await pool.query(
            `SELECT username FROM users`
        );

        for(const user of users.rows){

            try{

                const chat=
                await bot.getChat(user.username);

                await bot.sendMessage(
                    chat.id,
                    message
                );

            }catch{}

        }

    },hours*60*60*1000);

}

// ======================
// /SCHEDULE
// Example:
// /schedule 24 Hello Everyone
// ======================

bot.onText(/\/schedule (\d+) (.+)/s,async(msg,match)=>{

    if(!isAdmin(msg.from.id))
        return;

    const hours=parseInt(match[1]);
    const message=match[2];

    scheduleBroadcast(
        message,
        hours
    );

    bot.sendMessage(

        msg.chat.id,

`⏰ Broadcast Scheduled

Time : ${hours} Hours`

    );

});

// ======================
// BOT RESTART NOTICE
// ======================

process.on("SIGINT",()=>{

    console.log("Bot Stopped");

    process.exit();

});

process.on("SIGTERM",()=>{

    console.log("Bot Restarting");

    process.exit();

});

console.log("✅ PART 21 Loaded");
// ===================================================
// CineXClub Bot
// PART 22/30
// Backup + Restore + Export + Import System
// ===================================================

const fs = require("fs");
const path = require("path");

// ======================
// EXPORT DATABASE
// ======================

bot.onText(/\/backup/, async (msg) => {

    if (!isAdmin(msg.from.id))
        return;

    try {

        const backup = {

            contents: (
                await pool.query(
                    `SELECT * FROM contents`
                )
            ).rows,

            users: (
                await pool.query(
                    `SELECT * FROM users`
                )
            ).rows,

            requests: (
                await pool.query(
                    `SELECT * FROM requests`
                )
            ).rows,

            favorites: (
                await pool.query(
                    `SELECT * FROM favorites`
                )
            ).rows,

            history: (
                await pool.query(
                    `SELECT * FROM history`
                )
            ).rows,

            downloads: (
                await pool.query(
                    `SELECT * FROM downloads`
                )
            ).rows

        };

        const fileName =
        `backup_${Date.now()}.json`;

        const filePath =
        path.join(__dirname,fileName);

        fs.writeFileSync(

            filePath,

            JSON.stringify(
                backup,
                null,
                2
            )

        );

        await bot.sendDocument(

            msg.chat.id,

            filePath,

            {},

            {

                filename:fileName,

                contentType:"application/json"

            }

        );

        fs.unlinkSync(filePath);

    } catch(err){

        console.log(err.message);

        bot.sendMessage(

            msg.chat.id,

            "❌ Backup Failed."

        );

    }

});

// ======================
// DATABASE SIZE
// ======================

bot.onText(/\/dbsize/,async(msg)=>{

    if(!isAdmin(msg.from.id))
        return;

    const tables=[

        "contents",

        "users",

        "downloads",

        "favorites",

        "history",

        "requests"

    ];

    let text="📊 Database Status\n\n";

    for(const table of tables){

        const result=

        await pool.query(

        `SELECT COUNT(*) FROM ${table}`

        );

        text+=`📂 ${table} : ${result.rows[0].count}\n`;

    }

    bot.sendMessage(

        msg.chat.id,

        text

    );

});

// ======================
// CLEAR REQUESTS
// ======================

bot.onText(/\/clearrequests/,async(msg)=>{

    if(!isAdmin(msg.from.id))
        return;

    await pool.query(

    `DELETE FROM requests`

    );

    bot.sendMessage(

        msg.chat.id,

        "✅ Requests Cleared."

    );

});

// ======================
// CLEAR HISTORY
// ======================

bot.onText(/\/clearhistory/,async(msg)=>{

    if(!isAdmin(msg.from.id))
        return;

    await pool.query(

    `DELETE FROM history`

    );

    bot.sendMessage(

        msg.chat.id,

        "✅ Watch History Cleared."

    );

});

// ======================
// CLEAR DOWNLOADS
// ======================

bot.onText(/\/cleardownloads/,async(msg)=>{

    if(!isAdmin(msg.from.id))
        return;

    await pool.query(

    `DELETE FROM downloads`

    );

    bot.sendMessage(

        msg.chat.id,

        "✅ Downloads Cleared."

    );

});

// ======================
// BOT UPTIME
// ======================

const BOT_START_TIME=Date.now();

bot.onText(/\/uptime/,async(msg)=>{

    const seconds=

    Math.floor(

        (Date.now()-BOT_START_TIME)/1000

    );

    const hours=

    Math.floor(seconds/3600);

    const minutes=

    Math.floor(

        (seconds%3600)/60

    );

    bot.sendMessage(

        msg.chat.id,

`⏳ Bot Uptime

${hours} Hours

${minutes} Minutes`

    );

});

console.log("✅ PART 22 Loaded");
// ===================================================
// CineXClub Bot
// PART 23/30
// Deep Link + Force Join + Auto Delete + Download Tracking
// ===================================================

// ======================
// SAVE DOWNLOAD
// ======================

async function saveDownload(userId, contentId){

    try{

        await pool.query(

`
INSERT INTO downloads(

user_id,

content_id

)

VALUES($1,$2)
`,

[userId,contentId]

        );

    }catch(err){

        console.log(err.message);

    }

}

// ======================
// SAVE WATCH HISTORY
// ======================

async function saveHistory(userId, contentId){

    try{

        await pool.query(

`
INSERT INTO history(

user_id,

content_id

)

VALUES($1,$2)
`,

[userId,contentId]

        );

    }catch(err){

        console.log(err.message);

    }

}

// ======================
// AUTO DELETE
// ======================

async function autoDelete(chatId,messageId){

    const settings=await getSettings(chatId);

    const minutes=settings.auto_delete || 10;

    setTimeout(async()=>{

        try{

            await bot.deleteMessage(
                chatId,
                messageId
            );

        }catch{}

    },minutes*60*1000);

}

// ======================
// SEND FILE
// ======================

async function sendContent(chatId,userId,file){

    const sent=await bot.sendDocument(

        chatId,

        file.file_id,

        {

            caption:

`🎬 ${file.title}

📂 ${file.type}

🎥 ${file.quality}

🌎 ${file.language}

📅 ${file.year}

⭐ CineXClub`,

            reply_markup:{

                inline_keyboard:[

                    [

                        {

                            text:"❤️ Favorite",

                            callback_data:`fav_${file.content_id}`

                        },

                        {

                            text:"⭐ Rate",

                            callback_data:`rating_${file.content_id}`

                        }

                    ],

                    [

                        {

                            text:"📢 Join Channel",

                            url:`https://t.me/${FORCE_CHANNEL.replace("@","")}`

                        }

                    ]

                ]

            }

        }

    );

    await saveDownload(
        userId,
        file.content_id
    );

    await saveHistory(
        userId,
        file.content_id
    );

    autoDelete(
        chatId,
        sent.message_id
    );

}

// ======================
// DEEP LINK
// ======================

async function handleDeepLink(chatId,user,data){

    if(data.startsWith("ref_")){

        const referrer=

        Number(

            data.replace("ref_","")

        );

        await processReferral(

            referrer,

            user.id

        );

        return bot.sendMessage(

            chatId,

            "🎁 Referral Applied Successfully."

        );

    }

    const joined=

    await checkForceJoin(user.id);

    if(!joined){

        return bot.sendMessage(

            chatId,

            "⚠️ Join our channel first."

        );

    }

    const result=await pool.query(

`
SELECT *

FROM contents

WHERE content_id=$1

LIMIT 1
`,

[data]

    );

    if(!result.rows.length){

        return bot.sendMessage(

            chatId,

            "❌ Content Not Found."

        );

    }

    await sendContent(

        chatId,

        user.id,

        result.rows[0]

    );

}

// ======================
// CALLBACK SEND
// ======================

bot.on("callback_query",async(query)=>{

    if(!query.data.startsWith("send_"))
        return;

    const id=query.data.replace("send_","");

    const result=await pool.query(

`
SELECT *

FROM contents

WHERE content_id=$1
`,

[id]

    );

    if(!result.rows.length){

        return bot.answerCallbackQuery(

            query.id,

            {

                text:"File Not Found"

            }

        );

    }

    await sendContent(

        query.message.chat.id,

        query.from.id,

        result.rows[0]

    );

});

console.log("✅ PART 23 Loaded");
// ===================================================
// CineXClub Bot
// PART 24/30
// User Profile + Settings + Auto Delete + Notifications
// ===================================================

// ======================
// SETTINGS TABLE
// ======================

async function initSettingsTable() {

    try {

        await pool.query(`

CREATE TABLE IF NOT EXISTS settings(

id SERIAL PRIMARY KEY,

user_id BIGINT UNIQUE,

auto_delete INTEGER DEFAULT 10,

notifications BOOLEAN DEFAULT TRUE,

created_at TIMESTAMP DEFAULT NOW()

);

`);

        console.log("✅ Settings Table Ready");

    } catch (err) {

        console.log(err.message);

    }

}

initSettingsTable();

// ======================
// GET SETTINGS
// ======================

async function getSettings(userId) {

    let result = await pool.query(

        `SELECT * FROM settings WHERE user_id=$1`,

        [userId]

    );

    if (!result.rows.length) {

        await pool.query(

            `INSERT INTO settings(user_id) VALUES($1)`,

            [userId]

        );

        result = await pool.query(

            `SELECT * FROM settings WHERE user_id=$1`,

            [userId]

        );

    }

    return result.rows[0];

}

// ======================
// PROFILE
// ======================

bot.onText(/\/profile/, async (msg) => {

    const downloads = await pool.query(

        `SELECT COUNT(*) FROM downloads WHERE user_id=$1`,

        [msg.from.id]

    );

    const history = await pool.query(

        `SELECT COUNT(*) FROM history WHERE user_id=$1`,

        [msg.from.id]

    );

    const favorites = await pool.query(

        `SELECT COUNT(*) FROM favorites WHERE user_id=$1`,

        [msg.from.id]

    );

    const settings = await getSettings(msg.from.id);

    bot.sendMessage(

        msg.chat.id,

`👤 Your Profile

━━━━━━━━━━━━━━

🆔 ID : ${msg.from.id}

👤 Name : ${getUsername(msg.from)}

❤️ Favorites : ${favorites.rows[0].count}

📥 Downloads : ${downloads.rows[0].count}

▶️ Watch History : ${history.rows[0].count}

🗑 Auto Delete : ${settings.auto_delete} Min

🔔 Notifications : ${settings.notifications ? "ON" : "OFF"}

━━━━━━━━━━━━━━`,

        {

            reply_markup: {

                inline_keyboard: [

                    [

                        {

                            text: "⚙ Settings",

                            callback_data: "settings"

                        }

                    ]

                ]

            }

        }

    );

});

// ======================
// SETTINGS MENU
// ======================

bot.on("callback_query", async (query) => {

    if (query.data !== "settings")
        return;

    const settings = await getSettings(query.from.id);

    bot.sendMessage(

        query.message.chat.id,

        "⚙ Settings",

        {

            reply_markup: {

                inline_keyboard: [

                    [

                        {

                            text: `🗑 Auto Delete : ${settings.auto_delete} Min`,

                            callback_data: "change_delete"

                        }

                    ],

                    [

                        {

                            text: settings.notifications

                                ? "🔔 Disable Notifications"

                                : "🔕 Enable Notifications",

                            callback_data: "toggle_notify"

                        }

                    ]

                ]

            }

        }

    );

});

// ======================
// TOGGLE NOTIFICATION
// ======================

bot.on("callback_query", async (query) => {

    if (query.data !== "toggle_notify")
        return;

    const settings = await getSettings(query.from.id);

    await pool.query(

        `UPDATE settings SET notifications=$1 WHERE user_id=$2`,

        [

            !settings.notifications,

            query.from.id

        ]

    );

    bot.answerCallbackQuery(query.id, {

        text: "✅ Updated"

    });

});

// ======================
// AUTO DELETE CHANGE
// ======================

bot.onText(/\/autodelete (\d+)/, async (msg, match) => {

    const minutes = parseInt(match[1]);

    if (minutes < 1 || minutes > 60) {

        return bot.sendMessage(

            msg.chat.id,

            "❌ Choose between 1-60 minutes."

        );

    }

    await pool.query(

        `UPDATE settings SET auto_delete=$1 WHERE user_id=$2`,

        [

            minutes,

            msg.from.id

        ]

    );

    bot.sendMessage(

        msg.chat.id,

        `✅ Auto Delete set to ${minutes} minutes.`

    );

});

console.log("✅ PART 24 Loaded");
// ===================================================
// CineXClub Bot
// PART 25/30
// Analytics + Top Downloads + Statistics + Leaderboard
// ===================================================

// ======================
// DAILY DOWNLOADS
// ======================

bot.onText(/\/today/, async (msg) => {

    const result = await pool.query(

`
SELECT COUNT(*) total

FROM downloads

WHERE DATE(created_at)=CURRENT_DATE
`

    );

    bot.sendMessage(

        msg.chat.id,

`📅 Today's Downloads

📥 ${result.rows[0].total}`

    );

});

// ======================
// WEEKLY DOWNLOADS
// ======================

bot.onText(/\/weekly/, async (msg) => {

    const result = await pool.query(

`
SELECT COUNT(*) total

FROM downloads

WHERE created_at >= NOW() - INTERVAL '7 days'
`

    );

    bot.sendMessage(

        msg.chat.id,

`📅 Weekly Downloads

📥 ${result.rows[0].total}`

    );

});

// ======================
// MONTHLY DOWNLOADS
// ======================

bot.onText(/\/monthly/, async (msg) => {

    const result = await pool.query(

`
SELECT COUNT(*) total

FROM downloads

WHERE created_at >= NOW() - INTERVAL '30 days'
`

    );

    bot.sendMessage(

        msg.chat.id,

`📅 Monthly Downloads

📥 ${result.rows[0].total}`

    );

});

// ======================
// TOP DOWNLOADED CONTENT
// ======================

bot.onText(/\/top/, async (msg) => {

    const result = await pool.query(

`
SELECT

c.title,
COUNT(d.id) downloads

FROM downloads d

JOIN contents c

ON c.content_id=d.content_id

GROUP BY c.title

ORDER BY downloads DESC

LIMIT 10
`

    );

    if (!result.rows.length)
        return bot.sendMessage(msg.chat.id, "No Data.");

    let text = "🏆 Top Downloads\n\n";

    result.rows.forEach((item, index) => {

        text += `${index + 1}. ${item.title}\n📥 ${item.downloads}\n\n`;

    });

    bot.sendMessage(msg.chat.id, text);

});

// ======================
// USER LEADERBOARD
// ======================

bot.onText(/\/leaderboard/, async (msg) => {

    const result = await pool.query(

`
SELECT

user_id,
COUNT(id) downloads

FROM downloads

GROUP BY user_id

ORDER BY downloads DESC

LIMIT 10
`

    );

    if (!result.rows.length)
        return bot.sendMessage(msg.chat.id, "No Data.");

    let text = "👑 Top Users\n\n";

    result.rows.forEach((user, index) => {

        text += `${index + 1}. ${user.user_id}\n📥 ${user.downloads}\n\n`;

    });

    bot.sendMessage(msg.chat.id, text);

});

// ======================
// COMPLETE STATS
// ======================

bot.onText(/\/stats/, async (msg) => {

    const users =
    await pool.query(`SELECT COUNT(*) FROM users`);

    const contents =
    await pool.query(`SELECT COUNT(*) FROM contents`);

    const downloads =
    await pool.query(`SELECT COUNT(*) FROM downloads`);

    const favorites =
    await pool.query(`SELECT COUNT(*) FROM favorites`);

    const history =
    await pool.query(`SELECT COUNT(*) FROM history`);

    bot.sendMessage(

        msg.chat.id,

`📊 CineXClub Statistics

━━━━━━━━━━━━━━

👥 Users : ${users.rows[0].count}

🎬 Contents : ${contents.rows[0].count}

📥 Downloads : ${downloads.rows[0].count}

❤️ Favorites : ${favorites.rows[0].count}

▶️ Watch History : ${history.rows[0].count}

━━━━━━━━━━━━━━`

    );

});

console.log("✅ PART 25 Loaded");
// ===================================================
// CineXClub Bot
// PART 26/30
// Admin Content Management (Delete / Edit / Search)
// ===================================================

// ======================
// DELETE CONTENT
// ======================

bot.onText(/\/delete (.+)/, async (msg, match) => {

    if (!isAdmin(msg.from.id))
        return;

    const contentId = match[1].trim().toLowerCase();

    const result = await pool.query(
        `DELETE FROM contents
         WHERE content_id=$1
         RETURNING title`,
        [contentId]
    );

    if (!result.rows.length) {

        return bot.sendMessage(
            msg.chat.id,
            "❌ Content not found."
        );

    }

    bot.sendMessage(
        msg.chat.id,
        `✅ Deleted\n\n🎬 ${result.rows[0].title}`
    );

});

// ======================
// SEARCH CONTENT
// ======================

bot.onText(/\/find (.+)/, async (msg, match) => {

    if (!isAdmin(msg.from.id))
        return;

    const keyword = `%${match[1].trim()}%`;

    const result = await pool.query(

`
SELECT
content_id,
title,
type,
quality

FROM contents

WHERE

LOWER(title) LIKE LOWER($1)

LIMIT 20
`,

        [keyword]

    );

    if (!result.rows.length)
        return bot.sendMessage(msg.chat.id, "❌ No Results.");

    let text = "🔎 Search Results\n\n";

    result.rows.forEach(item => {

        text +=
`🎬 ${item.title}
🆔 ${item.content_id}
📂 ${item.type}
🎥 ${item.quality}

`;

    });

    bot.sendMessage(msg.chat.id, text);

});

// ======================
// RENAME TITLE
// ======================

bot.onText(/\/rename (.+?)\|(.+)/, async (msg, match) => {

    if (!isAdmin(msg.from.id))
        return;

    const contentId = match[1].trim();
    const newTitle = match[2].trim();

    await pool.query(

`
UPDATE contents

SET title=$1

WHERE content_id=$2
`,

        [newTitle, contentId]

    );

    bot.sendMessage(

        msg.chat.id,

        "✅ Title Updated."

    );

});

// ======================
// CHANGE QUALITY
// ======================

bot.onText(/\/quality (.+?)\|(.+)/, async (msg, match) => {

    if (!isAdmin(msg.from.id))
        return;

    await pool.query(

`
UPDATE contents

SET quality=$1

WHERE content_id=$2
`,

        [

            match[2].trim(),

            match[1].trim()

        ]

    );

    bot.sendMessage(

        msg.chat.id,

        "✅ Quality Updated."

    );

});

// ======================
// CHANGE LANGUAGE
// ======================

bot.onText(/\/language (.+?)\|(.+)/, async (msg, match) => {

    if (!isAdmin(msg.from.id))
        return;

    await pool.query(

`
UPDATE contents

SET language=$1

WHERE content_id=$2
`,

        [

            match[2].trim(),

            match[1].trim()

        ]

    );

    bot.sendMessage(

        msg.chat.id,

        "✅ Language Updated."

    );

});

// ======================
// CONTENT COUNT
// ======================

bot.onText(/\/count/, async (msg) => {

    if (!isAdmin(msg.from.id))
        return;

    const movie =
    await pool.query(`SELECT COUNT(*) FROM contents WHERE type='Movie'`);

    const series =
    await pool.query(`SELECT COUNT(*) FROM contents WHERE type='Series'`);

    const anime =
    await pool.query(`SELECT COUNT(*) FROM contents WHERE type='Anime'`);

    bot.sendMessage(

        msg.chat.id,

`📊 Content Count

🎬 Movies : ${movie.rows[0].count}

📺 Series : ${series.rows[0].count}

🍥 Anime : ${anime.rows[0].count}`

    );

});

console.log("✅ PART 26 Loaded");
// ===================================================
// CineXClub Bot
// PART 27/30
// Advanced Search + Filters + Suggestions
// ===================================================

// ======================
// SEARCH BY YEAR
// ======================

bot.onText(/\/year (.+)/, async (msg, match) => {

    const year = match[1].trim();

    const result = await pool.query(

`
SELECT *

FROM contents

WHERE year=$1

ORDER BY title
`,

[year]

    );

    if (!result.rows.length)
        return bot.sendMessage(
            msg.chat.id,
            "❌ No content found."
        );

    const buttons = [];

    result.rows.forEach(item => {

        buttons.push([
            {
                text: `🎬 ${item.title}`,
                callback_data: `quality_${item.content_id}`
            }
        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        `📅 Movies (${year})`,

        {

            reply_markup: {

                inline_keyboard: buttons

            }

        }

    );

});

// ======================
// SEARCH BY LANGUAGE
// ======================

bot.onText(/\/language_search (.+)/, async (msg, match) => {

    const language = match[1].trim();

    const result = await pool.query(

`
SELECT *

FROM contents

WHERE LOWER(language)=LOWER($1)

ORDER BY title
`,

[language]

    );

    if (!result.rows.length)
        return bot.sendMessage(
            msg.chat.id,
            "❌ No content found."
        );

    const buttons = [];

    result.rows.forEach(item => {

        buttons.push([
            {
                text: `🎬 ${item.title}`,
                callback_data: `quality_${item.content_id}`
            }
        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        `🌎 ${language} Collection`,

        {

            reply_markup: {

                inline_keyboard: buttons

            }

        }

    );

});

// ======================
// SEARCH BY QUALITY
// ======================

bot.onText(/\/quality_search (.+)/, async (msg, match) => {

    const quality = match[1].trim();

    const result = await pool.query(

`
SELECT *

FROM contents

WHERE quality=$1

ORDER BY title
`,

[quality]

    );

    if (!result.rows.length)
        return bot.sendMessage(
            msg.chat.id,
            "❌ No content found."
        );

    const buttons = [];

    result.rows.forEach(item => {

        buttons.push([
            {
                text: item.title,
                callback_data: `send_${item.content_id}`
            }
        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        `🎥 ${quality} Collection`,

        {

            reply_markup: {

                inline_keyboard: buttons

            }

        }

    );

});

// ======================
// RANDOM SUGGESTIONS
// ======================

bot.onText(/\/suggest/, async (msg) => {

    const result = await pool.query(

`
SELECT *

FROM contents

ORDER BY RANDOM()

LIMIT 10
`

    );

    const buttons = [];

    result.rows.forEach(item => {

        buttons.push([
            {
                text: `⭐ ${item.title}`,
                callback_data: `quality_${item.content_id}`
            }
        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "🍿 Recommended For You",

        {

            reply_markup: {

                inline_keyboard: buttons

            }

        }

    );

});

// ======================
// TOTAL STORAGE SIZE
// ======================

bot.onText(/\/storage/, async (msg) => {

    const result = await pool.query(

`
SELECT COUNT(*) total

FROM contents
`

    );

    bot.sendMessage(

        msg.chat.id,

`💾 Storage Information

📂 Total Contents : ${result.rows[0].total}

⭐ Powered By CineXClub`

    );

});

console.log("✅ PART 27 Loaded");
// ===================================================
// CineXClub Bot
// PART 28/30
// Maintenance + Health Check + Error Logs + Admin Tools
// ===================================================

// ======================
// BOT PING
// ======================

bot.onText(/\/ping/, async (msg) => {

    const start = Date.now();

    const sent = await bot.sendMessage(
        msg.chat.id,
        "🏓 Pinging..."
    );

    const ms = Date.now() - start;

    bot.editMessageText(

`🏓 Pong!

⚡ ${ms} ms`,

        {

            chat_id: msg.chat.id,
            message_id: sent.message_id

        }

    );

});

// ======================
// HEALTH CHECK
// ======================

bot.onText(/\/health/, async (msg) => {

    try {

        await pool.query("SELECT NOW()");

        bot.sendMessage(

            msg.chat.id,

`✅ Bot Status

🤖 Bot : Online

🗄 Database : Connected

🌐 Server : Running`

        );

    } catch {

        bot.sendMessage(

            msg.chat.id,

            "❌ Database Connection Failed."

        );

    }

});

// ======================
// MEMORY USAGE
// ======================

bot.onText(/\/memory/, async (msg) => {

    const memory = process.memoryUsage();

    bot.sendMessage(

        msg.chat.id,

`🧠 Memory Usage

RSS : ${(memory.rss/1024/1024).toFixed(2)} MB

Heap Used : ${(memory.heapUsed/1024/1024).toFixed(2)} MB

Heap Total : ${(memory.heapTotal/1024/1024).toFixed(2)} MB`

    );

});

// ======================
// ERROR LOGGER
// ======================

process.on("uncaughtException",(err)=>{

    console.log("UNCAUGHT ERROR");

    console.log(err);

});

process.on("unhandledRejection",(err)=>{

    console.log("PROMISE ERROR");

    console.log(err);

});

// ======================
// RESTART COMMAND
// ======================

bot.onText(/\/restart/,async(msg)=>{

    if(!isAdmin(msg.from.id))
        return;

    await bot.sendMessage(

        msg.chat.id,

        "♻️ Restarting Bot..."

    );

    process.exit(0);

});

// ======================
// ADMIN HELP
// ======================

bot.onText(/\/adminhelp/,async(msg)=>{

    if(!isAdmin(msg.from.id))
        return;

    bot.sendMessage(

        msg.chat.id,

`👑 Admin Commands

/admin
/stats
/count
/find
/delete
/rename
/quality
/language
/backup
/dbsize
/broadcast
/announce
/schedule
/restart
/health
/ping
/memory`

    );

});

// ======================
// BOT READY
// ======================

bot.on("polling_error",(err)=>{

    console.log("Polling Error:",err.message);

});

console.log("✅ PART 28 Loaded");
// ===================================================
// CineXClub Bot
// PART 29/30
// Final Database Setup + Startup Checks + Commands Menu
// ===================================================


// ======================
// EXTRA TABLES
// ======================

async function initExtraTables(){

try{

await pool.query(`

CREATE TABLE IF NOT EXISTS downloads(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

created_at TIMESTAMP DEFAULT NOW()

);


CREATE TABLE IF NOT EXISTS history(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

watched_at TIMESTAMP DEFAULT NOW()

);


CREATE TABLE IF NOT EXISTS favorites(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

created_at TIMESTAMP DEFAULT NOW(),

UNIQUE(user_id,content_id)

);


CREATE TABLE IF NOT EXISTS ratings(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

rating INTEGER,

created_at TIMESTAMP DEFAULT NOW()

);


CREATE TABLE IF NOT EXISTS referrals(

id SERIAL PRIMARY KEY,

user_id BIGINT,

referrer_id BIGINT,

created_at TIMESTAMP DEFAULT NOW()

);


`);

console.log("✅ Extra Tables Ready");


}catch(err){

console.log(
"Extra Table Error:",
err.message
);

}

}


initExtraTables();


// ======================
// BOT COMMAND MENU
// ======================


bot.onText(/\/help/,async(msg)=>{


bot.sendMessage(

msg.chat.id,

`

🎬 <b>CineXClub Bot Help</b>


━━━━━━━━━━━━━━


🎥 USER COMMANDS


/start - Start Bot

/search - Search Content

/recent - Latest Uploads

/trending - Trending Movies

/random - Random Movie

/suggest - Recommendation

/profile - My Profile

/continue - Continue Watching


━━━━━━━━━━━━━━


👑 ADMIN COMMANDS


/admin

/stats

/backup

/broadcast

/find

/delete

/restart


━━━━━━━━━━━━━━


⭐ Enjoy CineXClub


`,

{

parse_mode:"HTML",

reply_markup:{

inline_keyboard:[

[

{

text:"🎬 Open Movies",

callback_data:"menu_movies"

}

],

[

{

text:"📺 Open Series",

callback_data:"menu_series"

}

],

[

{

text:"🍥 Open Anime",

callback_data:"menu_anime"

}

]

]

}

}

);


});


// ======================
// WELCOME NEW USERS
// ======================


bot.on("new_chat_members",async(msg)=>{


for(const user of msg.new_chat_members){


await saveUser(user);


bot.sendMessage(

msg.chat.id,

`

🎉 Welcome ${getUsername(user)}

Welcome To CineXClub


🍿 Movies

📺 Series

🍥 Anime


Enjoy Watching ❤️

`

);


}


});


// ======================
// BOT INFO
// ======================


bot.onText(/\/about/,async(msg)=>{


bot.sendMessage(

msg.chat.id,

`

🎬 CineXClub Bot


━━━━━━━━━━━━━━

🍿 Unlimited Movies

📺 Series

🍥 Anime

🎥 Multiple Quality

⚡ Fast Delivery

🗄 PostgreSQL Powered


━━━━━━━━━━━━━━


Made With ❤️

`

);


});


// ======================
// STARTUP CHECK
// ======================


(async()=>{


try{


await pool.query(
"SELECT NOW()"
);


console.log(
"🟢 Database Check OK"
);


}catch(err){


console.log(
"🔴 Database Failed",
err.message
);


}



})();



console.log("✅ PART 29 Loaded");
// ===================================================
// CineXClub Bot
// PART 30/30
// FINAL PART
// Bot Shutdown + Final Commands + Startup
// ===================================================


// ======================
// FINAL CALLBACK HANDLER
// ======================

bot.on("callback_query", async(query)=>{

    try{

        const data=query.data;
        const chatId=query.message.chat.id;


        // HOME

        if(data==="home"){

            return bot.sendMessage(

                chatId,

                "🏠 CineXClub Home",

                {

                    reply_markup:homeButtons()

                }

            );

        }


        // REQUEST MOVIE

        if(data==="request_movie"){

            return bot.sendMessage(

                chatId,

`🎬 Send Movie Name

Example:

/request Avengers Endgame`

            );

        }


        // FAVORITE

        if(data.startsWith("fav_")){

            const id=data.replace("fav_","");


            await pool.query(

`
INSERT INTO favorites(

user_id,

content_id

)

VALUES($1,$2)

ON CONFLICT DO NOTHING

`,

[

query.from.id,

id

]

            );


            return bot.answerCallbackQuery(

                query.id,

                {

                    text:"❤️ Added To Favorites"

                }

            );

        }


        // RATING

        if(data.startsWith("rating_")){

            const id=data.replace("rating_","");


            return bot.sendMessage(

                chatId,

`⭐ Rate This Content

🎬 ${id}


Send:

/rate ${id} 5`

            );

        }


    }catch(err){

        console.log(
            "Callback Error:",
            err.message
        );

    }

});


// ======================
// RATING COMMAND
// ======================


bot.onText(

/\/rate (.+) (\d+)/,

async(msg,match)=>{


const contentId=match[1];

const rating=parseInt(match[2]);


if(rating<1 || rating>5){

return bot.sendMessage(

msg.chat.id,

"❌ Rating must be 1-5"

);

}



await pool.query(

`
INSERT INTO ratings(

user_id,

content_id,

rating

)

VALUES($1,$2,$3)

`,

[

msg.from.id,

contentId,

rating

]

);



bot.sendMessage(

msg.chat.id,

"⭐ Rating Saved"

);



});


// ======================
// FAVORITE LIST
// ======================


bot.onText(/\/favorites/,async(msg)=>{


const result=await pool.query(

`

SELECT c.*

FROM favorites f

JOIN contents c

ON f.content_id=c.content_id

WHERE f.user_id=$1

ORDER BY f.created_at DESC

LIMIT 20

`,

[msg.from.id]

);



if(!result.rows.length){

return bot.sendMessage(

msg.chat.id,

"❤️ No Favorites"

);

}



const buttons=[];


result.rows.forEach(item=>{


buttons.push([

{

text:`❤️ ${item.title}`,

callback_data:`quality_${item.content_id}`

}

]);


});



bot.sendMessage(

msg.chat.id,

"❤️ Your Favorites",

{

reply_markup:{

inline_keyboard:buttons

}

}

);


});


// ======================
// FINAL START MESSAGE
// ======================


console.log(`

================================

🎬 CineXClub Bot Started

✅ PostgreSQL Connected

✅ Storage System Ready

✅ Force Join Enabled

✅ Movies System Ready

✅ Series System Ready

✅ Anime System Ready

✅ Search Ready

✅ Admin Panel Ready

✅ Analytics Ready

✅ Auto Delete Ready

================================

`);


// ======================
// GRACEFUL SHUTDOWN
// ======================


async function shutdown(){


console.log(
"⛔ Stopping Bot..."
);


try{


await pool.end();


}catch{}



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


// ======================
// END OF INDEX.JS
// ======================


// CineXClub Bot
// Total Parts: 30/30
// Ready For Render Deployment
