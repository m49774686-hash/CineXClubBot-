// ===================================================
// CineXClub Bot
// PART 1/20
// Setup + PostgreSQL + Bot Start
// ===================================================

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");

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
// BOT START
// ======================

const bot = new TelegramBot(BOT_TOKEN, {
    polling: {
        autoStart: true,
        interval: 300
    }
});

console.log("🎬 CineXClub Bot Starting...");

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
// DATABASE
// ======================

async function initDatabase() {
    try {

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

        console.log("✅ PostgreSQL Connected");

    } catch (err) {

        console.log("Database Error:", err.message);

    }
}

initDatabase();

// ======================
// KEEP ALIVE
// ======================

http.createServer((req, res) => {
    res.writeHead(200);
    res.end("CineXClub Bot Running");
}).listen(process.env.PORT || 3000);

// ======================
// RANDOM QUOTES
// ======================

const quotes = [
    "🎬 Entertainment Starts Here",
    "🍿 Grab Your Popcorn",
    "🔥 Unlimited Movies",
    "📺 Watch Anytime",
    "❤️ Welcome To CineXClub"
];

function randomQuote() {
    return quotes[Math.floor(Math.random() * quotes.length)];
}

// ======================
// USERNAME
// ======================

function getUsername(user) {
    if (user.username) return "@" + user.username;
    return user.first_name || "User";
}

// ======================
// SAVE USER
// ======================

async function saveUser(user) {

    try {

        await pool.query(
            `
INSERT INTO users(username)
VALUES($1)
ON CONFLICT(username)
DO NOTHING
`,
            [getUsername(user)]
        );

    } catch (err) {}

}

console.log("✅ PART 1 Loaded");
// ===================================================
// CineXClub Bot
// PART 2/20
// STORAGE CHANNEL SYSTEM
// ===================================================

// ======================
// PARSE CAPTION
// ======================

function parseCaption(caption) {

    const data = {
        type: "Movie",
        title: "",
        collection: null,
        season: null,
        episode: null,
        quality: "720p",
        language: "Unknown",
        year: "",
        size: "",
        content_id: null
    };

    const lines = caption.split("\n");

    for (const line of lines) {

        const parts = line.split(":");

        if (parts.length < 2) continue;

        const key = parts[0].trim().toLowerCase();
        const value = parts.slice(1).join(":").trim();

        switch (key) {

            case "type":
                data.type = value;
                break;

            case "title":
                data.title = value;
                break;

            case "collection":
                data.collection = value;
                break;

            case "season":
                data.season = parseInt(value);
                break;

            case "episode":
                data.episode = parseInt(value);
                break;

            case "quality":
                data.quality = value;
                break;

            case "language":
            case "audio":
                data.language = value;
                break;

            case "year":
                data.year = value;
                break;

            case "size":
                data.size = value;
                break;

            case "id":
                data.content_id = value.toLowerCase();
                break;
        }
    }

    if (!data.content_id) {

        data.content_id = data.title
            .replace(/\s+/g, "")
            .toLowerCase();

        if (data.type !== "Movie") {

            data.content_id += `_S${data.season}E${data.episode}`;

        }
    }

    return data;
}

// ======================
// SAVE CONTENT
// ======================

async function saveContent(data, fileId) {

    try {

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

    } catch (err) {

        console.log("Save Error:", err.message);
        return false;

    }
}

// ======================
// STORAGE CHANNEL
// ======================

bot.on("channel_post", async (msg) => {

    try {

        if (String(msg.chat.id) !== String(STORAGE_CHANNEL))
            return;

        let fileId = null;

        if (msg.document)
            fileId = msg.document.file_id;

        if (msg.video)
            fileId = msg.video.file_id;

        if (!fileId || !msg.caption)
            return;

        const data = parseCaption(msg.caption);

        console.log("📥 Upload:", data.title);

        const saved = await saveContent(data, fileId);

        if (!saved)
            return;

        const link =
            `https://t.me/${BOT_USERNAME}?start=${data.content_id}`;

        await bot.sendMessage(
            msg.chat.id,
            `✅ Saved Successfully

🎬 ${data.title}

📂 ${data.type}

🆔 ${data.content_id}

🎥 ${data.quality}

🔗 ${link}`
        );

        console.log("✅ Saved:", data.content_id);

    } catch (err) {

        console.log("Storage Error:", err.message);

    }

});

console.log("✅ PART 2 Loaded");
// ===================================================
// CineXClub Bot
// PART 3/20
// START + FORCE JOIN + HOME MENU
// ===================================================

// ======================
// FORCE JOIN CHECK
// ======================

async function checkForceJoin(userId) {

    try {

        if (!FORCE_CHANNEL)
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

    } catch (err) {

        return false;

    }

}

// ======================
// HOME BUTTONS
// ======================

function homeButtons() {

    return {

        inline_keyboard: [

            [
                {
                    text: "🎬 Movies",
                    callback_data: "menu_movies"
                },
                {
                    text: "📺 Series",
                    callback_data: "menu_series"
                }
            ],

            [
                {
                    text: "🍥 Anime",
                    callback_data: "menu_anime"
                }
            ],

            [
                {
                    text: "🔎 Search",
                    callback_data: "search"
                }
            ],

            [
                {
                    text: "🎬 Request Movie",
                    callback_data: "request_movie"
                }
            ],

            [
                {
                    text: "👨‍💻 Contact Admin",
                    url: `https://t.me/${ADMIN_USERNAME.replace("@","")}`
                }
            ]

        ]

    };

}

// ======================
// START COMMAND
// ======================

bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {

    const chatId = msg.chat.id;

    await saveUser(msg.from);

    // Deep Link

    if (match[1]) {

        return handleDeepLink(
            chatId,
            msg.from,
            match[1]
        );

    }

    // Force Join

    const joined = await checkForceJoin(msg.from.id);

    if (!joined) {

        return bot.sendMessage(

            chatId,

            "⚠️ Please join our channel first.",

            {

                reply_markup: {

                    inline_keyboard: [

                        [
                            {
                                text: "📢 Join Channel",
                                url: `https://t.me/${FORCE_CHANNEL.replace("@","")}`
                            }
                        ],

                        [
                            {
                                text: "✅ Continue",
                                callback_data: "recheck_join"
                            }
                        ]

                    ]

                }

            }

        );

    }

    // Welcome

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

            parse_mode: "HTML",

            reply_markup: homeButtons()

        }

    );

});

// ======================
// JOIN CALLBACK
// ======================

bot.on("callback_query", async (query) => {

    if (query.data !== "recheck_join")
        return;

    const joined = await checkForceJoin(query.from.id);

    if (!joined) {

        return bot.answerCallbackQuery(query.id, {

            text: "❌ Join the channel first.",

            show_alert: true

        });

    }

    await bot.editMessageText(

        "✅ Verification Successful!\n\nPress /start",

        {

            chat_id: query.message.chat.id,

            message_id: query.message.message_id

        }

    );

});

console.log("✅ PART 3 Loaded");
// ===================================================
// CineXClub Bot
// PART 4/20
// HOME MENU + SEARCH SYSTEM
// ===================================================

// ======================
// SEARCH MODE
// ======================

const searchMode = new Map();

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

    await bot.sendMessage(

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
// MENU CALLBACKS
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

            searchMode.set(chatId,true);

            return bot.sendMessage(

                chatId,

                "🔎 Send Movie / Series / Anime name."

            );

        case "home":

            searchMode.delete(chatId);

            return bot.sendMessage(

                chatId,

                "🏠 Welcome Back",

                {

                    reply_markup:homeButtons()

                }

            );

    }

});

// ======================
// SEARCH MESSAGE
// ======================

bot.on("message",async(msg)=>{

    if(!searchMode.has(msg.chat.id))
        return;

    if(!msg.text)
        return;

    searchMode.delete(msg.chat.id);

    const keyword=msg.text.trim();

    try{

        const result=await pool.query(

            `

            SELECT *

            FROM contents

            WHERE

            LOWER(title) LIKE LOWER($1)

            OR

            LOWER(collection) LIKE LOWER($1)

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

                    text:`🎬 ${item.title}`,

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

        await bot.sendMessage(

            msg.chat.id,

            "🔎 Search Results",

            {

                reply_markup:{

                    inline_keyboard:buttons

                }

            }

        );

    }catch(err){

        console.log(err.message);

    }

});

console.log("✅ PART 4 Loaded");
// ===================================================
// CineXClub Bot
// PART 5/20
// COLLECTION → SEASON → EPISODE → QUALITY
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

    const base = contentId.split("_")[0];

    const result = await pool.query(

        `
        SELECT *
        FROM contents
        WHERE content_id LIKE $1
        ORDER BY quality
        `,

        [`${base}%`]

    );

    if(result.rows.length===1){

        return sendFile(chatId,result.rows[0]);

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

        const episodes=await getEpisodes(collection,season);

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

    // QUALITY

    if(data.startsWith("quality_")){

        const id=data.replace("quality_","");

        return showQuality(chatId,id);

    }

});

console.log("✅ PART 5 Loaded");
// ===================================================
// CineXClub Bot
// PART 6/20
// FILE SEND + AUTO DELETE + SEND ALL EPISODES
// ===================================================

// ======================
// AUTO DELETE (10 MIN)
// ======================

function autoDelete(chatId, messageId) {

    setTimeout(async () => {

        try {

            await bot.deleteMessage(chatId, messageId);

        } catch (err) {}

    }, 600000);

}

// ======================
// SEND FILE
// ======================

async function sendFile(chatId, file) {

    try {

        const sent = await bot.sendDocument(

            chatId,

            file.file_id,

            {

                caption: `🎬 <b>${file.title}</b>

━━━━━━━━━━━━━━

📂 Type : ${file.type}

${file.collection ? `🎞 Collection : ${file.collection}` : ""}

${file.season ? `📺 Season : ${file.season}` : ""}

${file.episode ? `🎬 Episode : ${file.episode}` : ""}

🎥 Quality : ${file.quality || "Unknown"}

🌐 Language : ${file.language || "Unknown"}

📅 Year : ${file.year || "-"}

💾 Size : ${file.size || "-"}

━━━━━━━━━━━━━━

⭐ Powered By CineXClub`,

                parse_mode: "HTML",

                reply_markup: {

                    inline_keyboard: [

                        [
                            {
                                text: "📢 Join Channel",
                                url: "https://t.me/CineXClub"
                            }
                        ],

                        [
                            {
                                text: "👨‍💻 Contact Admin",
                                url: `https://t.me/${ADMIN_USERNAME.replace("@", "")}`
                            }
                        ]

                    ]

                }

            }

        );

        autoDelete(chatId, sent.message_id);

    } catch (err) {

        console.log("Send Error:", err.message);

    }

}

// ======================
// SEND ALL EPISODES
// ======================

async function sendAllEpisodes(chatId, collection, season) {

    const episodes = await getEpisodes(collection, season);

    if (!episodes.length) {

        return bot.sendMessage(

            chatId,

            "❌ Episodes not found."

        );

    }

    const status = await bot.sendMessage(

        chatId,

        `📥 Sending ${episodes.length} Episodes...\n\nPlease wait...`

    );

    for (const ep of episodes) {

        await sendFile(chatId, ep);

        await new Promise(resolve => setTimeout(resolve, 1200));

    }

    autoDelete(chatId, status.message_id);

}

// ======================
// SEND CALLBACKS
// ======================

bot.on("callback_query", async (query) => {

    const chatId = query.message.chat.id;
    const data = query.data;

    // SEND SINGLE FILE

    if (data.startsWith("send_")) {

        const id = data.replace("send_", "");

        const result = await pool.query(

            `
            SELECT *
            FROM contents
            WHERE content_id=$1
            LIMIT 1
            `,

            [id]

        );

        if (!result.rows.length) {

            return bot.answerCallbackQuery(query.id, {

                text: "❌ File Not Found",

                show_alert: true

            });

        }

        await bot.answerCallbackQuery(query.id);

        return sendFile(chatId, result.rows[0]);

    }

    // SEND ALL EPISODES

    if (data.startsWith("all_")) {

        const parts = data.split("_");

        const collection = parts[1];
        const season = parts[2];

        await bot.answerCallbackQuery(query.id);

        return sendAllEpisodes(

            chatId,

            collection,

            season

        );

    }

});

console.log("✅ PART 6 Loaded");
// ===================================================
// CineXClub Bot
// PART 7/20
// ADVANCED SEARCH + REQUEST SYSTEM
// ===================================================

// ======================
// SEARCH MODE
// ======================

const searchMode = new Map();

// ======================
// SEARCH BUTTON
// ======================

bot.on("callback_query", async (query) => {

    const chatId = query.message.chat.id;

    if (query.data !== "search")
        return;

    searchMode.set(chatId, true);

    await bot.answerCallbackQuery(query.id);

    return bot.sendMessage(

        chatId,

        "🔎 Send the Movie / Series / Anime name."

    );

});

// ======================
// SEARCH MESSAGE
// ======================

bot.on("message", async (msg) => {

    const chatId = msg.chat.id;

    if (!searchMode.has(chatId))
        return;

    if (!msg.text)
        return;

    searchMode.delete(chatId);

    const keyword = msg.text.trim();

    try {

        const result = await pool.query(

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

        // NOT FOUND

        if (!result.rows.length) {

            return bot.sendMessage(

                chatId,

                `❌ <b>${keyword}</b> not found in our database.`,

                {

                    parse_mode: "HTML",

                    reply_markup: {

                        inline_keyboard: [

                            [
                                {
                                    text: "🔎 Google Search",
                                    url: `https://www.google.com/search?q=${encodeURIComponent(keyword)}`
                                }
                            ],

                            [
                                {
                                    text: "🎬 Request Movie",
                                    callback_data: `request_${keyword}`
                                }
                            ],

                            [
                                {
                                    text: "👨‍💻 Contact Admin",
                                    url: `https://t.me/${ADMIN_USERNAME.replace("@","")}`
                                }
                            ],

                            [
                                {
                                    text: "🏠 Home",
                                    callback_data: "home"
                                }
                            ]

                        ]

                    }

                }

            );

        }

        // RESULTS

        const buttons = [];

        result.rows.forEach(item => {

            buttons.push([

                {

                    text: `🎬 ${item.title} (${item.quality})`,

                    callback_data: `quality_${item.content_id}`

                }

            ]);

        });

        buttons.push([

            {

                text: "🏠 Home",

                callback_data: "home"

            }

        ]);

        await bot.sendMessage(

            chatId,

            `🔎 <b>Search Results</b>\n\n${keyword}`,

            {

                parse_mode: "HTML",

                reply_markup: {

                    inline_keyboard: buttons

                }

            }

        );

    } catch (err) {

        console.log("Search Error:", err.message);

    }

});

// ======================
// SAVE REQUEST
// ======================

async function saveRequest(username, request) {

    try {

        await pool.query(

            `
            INSERT INTO requests(username,request)
            VALUES($1,$2)
            `,

            [username, request]

        );

    } catch (err) {

        console.log("Request Error:", err.message);

    }

}

console.log("✅ PART 7 Loaded");
// ===================================================
// CineXClub Bot
// PART 8/20
// REQUEST SYSTEM + ADMIN NOTIFICATION
// ===================================================

// ======================
// REQUEST CALLBACK
// ======================

bot.on("callback_query", async (query) => {

    const data = query.data;
    const chatId = query.message.chat.id;

    if (!data.startsWith("request_"))
        return;

    const request = data.replace("request_", "");

    const username = query.from.username
        ? "@" + query.from.username
        : query.from.first_name;

    await saveRequest(username, request);

    // USER SUCCESS

    await bot.sendMessage(

        chatId,

`✅ <b>Your request has been submitted.</b>

🎬 Requested :
${request}

⏳ Our admin will upload it if available.`,

        {

            parse_mode: "HTML"

        }

    );

    // ADMIN NOTIFICATION

    if (ADMIN_CHAT_ID) {

        try {

            await bot.sendMessage(

                ADMIN_CHAT_ID,

`📥 <b>New Content Request</b>

👤 User :
${username}

🎬 Request :
${request}

🕒 ${new Date().toLocaleString()}`,

                {

                    parse_mode: "HTML"

                }

            );

        } catch (err) {

            console.log("Admin Notify Error:", err.message);

        }

    }

    await bot.answerCallbackQuery(

        query.id,

        {

            text: "Request Sent ✅"

        }

    );

});

// ======================
// /REQUEST COMMAND
// ======================

bot.onText(/\/request (.+)/, async (msg, match) => {

    const request = match[1].trim();

    const username = msg.from.username
        ? "@" + msg.from.username
        : msg.from.first_name;

    await saveRequest(username, request);

    await bot.sendMessage(

        msg.chat.id,

`✅ Request Saved

🎬 ${request}

⏳ Please wait for admin approval.`

    );

    if (ADMIN_CHAT_ID) {

        try {

            await bot.sendMessage(

                ADMIN_CHAT_ID,

`📥 <b>New Request</b>

👤 ${username}

🎬 ${request}`,

                {

                    parse_mode: "HTML"

                }

            );

        } catch (err) {

            console.log(err.message);

        }

    }

});

console.log("✅ PART 8 Loaded");
// ===================================================
// CineXClub Bot
// PART 9/20
// ADMIN PANEL + STATISTICS
// ===================================================

// ======================
// ADMIN CHECK
// ======================

function isAdmin(userId){

    return String(userId)===String(ADMIN_CHAT_ID);

}

// ======================
// /ADMIN
// ======================

bot.onText(/\/admin/,async(msg)=>{

    if(!isAdmin(msg.from.id)){

        return bot.sendMessage(
            msg.chat.id,
            "❌ Access Denied."
        );

    }

    try{

        const users=await pool.query(
            "SELECT COUNT(*) FROM users"
        );

        const movies=await pool.query(
            "SELECT COUNT(*) FROM contents WHERE type='Movie'"
        );

        const series=await pool.query(
            "SELECT COUNT(*) FROM contents WHERE type='Series'"
        );

        const anime=await pool.query(
            "SELECT COUNT(*) FROM contents WHERE type='Anime'"
        );

        const requests=await pool.query(
            "SELECT COUNT(*) FROM requests"
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

━━━━━━━━━━━━━━

Choose an option:`,

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
                                text:"📋 View Requests",
                                callback_data:"admin_requests"
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

    }catch(err){

        console.log("Admin Error:",err.message);

    }

});

// ======================
// BROADCAST MODE
// ======================

const broadcastMode=new Map();

bot.on("callback_query",async(query)=>{

    if(query.data!=="admin_broadcast")
        return;

    if(!isAdmin(query.from.id))
        return;

    broadcastMode.set(query.from.id,true);

    await bot.answerCallbackQuery(query.id);

    await bot.sendMessage(

        query.message.chat.id,

        "📢 Send the broadcast message."

    );

});

console.log("✅ PART 9 Loaded");
// ===================================================
// CineXClub Bot
// PART 10/20
// BROADCAST + VIEW REQUESTS
// ===================================================

// ======================
// BROADCAST MESSAGE
// ======================

bot.on("message", async (msg) => {

    if (!broadcastMode.has(msg.from.id))
        return;

    if (!isAdmin(msg.from.id))
        return;

    broadcastMode.delete(msg.from.id);

    try {

        const users = await pool.query(

            `SELECT username FROM users`

        );

        let sent = 0;
        let failed = 0;

        for (const user of users.rows) {

            try {

                if (!user.username || !user.username.startsWith("@"))
                    continue;

                await bot.sendMessage(
                    user.username,
                    msg.text
                );

                sent++;

                await new Promise(resolve =>
                    setTimeout(resolve, 80)
                );

            } catch {

                failed++;

            }

        }

        await bot.sendMessage(

            msg.chat.id,

`✅ Broadcast Completed

📤 Sent : ${sent}

❌ Failed : ${failed}`

        );

    } catch (err) {

        console.log("Broadcast Error:", err.message);

    }

});

// ======================
// VIEW REQUESTS
// ======================

bot.on("callback_query", async (query) => {

    if (query.data !== "admin_requests")
        return;

    if (!isAdmin(query.from.id))
        return;

    try {

        const result = await pool.query(

            `
            SELECT *
            FROM requests
            ORDER BY created_at DESC
            LIMIT 20
            `

        );

        if (!result.rows.length) {

            return bot.sendMessage(

                query.message.chat.id,

                "📭 No requests found."

            );

        }

        let text = "📩 Latest Requests\n\n";

        result.rows.forEach((row, index) => {

            text += `${index + 1}. ${row.request}\n`;
            text += `👤 ${row.username}\n\n`;

        });

        await bot.sendMessage(

            query.message.chat.id,

            text

        );

    } catch (err) {

        console.log("Request List Error:", err.message);

    }

});

// ======================
// REFRESH ADMIN PANEL
// ======================

bot.on("callback_query", async (query) => {

    if (query.data !== "admin_refresh")
        return;

    if (!isAdmin(query.from.id))
        return;

    await bot.answerCallbackQuery(query.id, {

        text: "✅ Refreshed"

    });

    bot.emit("text", {
        ...query.message,
        from: query.from,
        text: "/admin"
    });

});

console.log("✅ PART 10 Loaded");
// ===================================================
// CineXClub Bot
// PART 11/20
// CLEAN ADMIN PANEL + REFRESH SYSTEM
// ===================================================

// ======================
// SHOW ADMIN PANEL
// ======================

async function showAdminPanel(chatId){

    try{

        const users = await pool.query(
            "SELECT COUNT(*) FROM users"
        );

        const movies = await pool.query(
            "SELECT COUNT(*) FROM contents WHERE type='Movie'"
        );

        const series = await pool.query(
            "SELECT COUNT(*) FROM contents WHERE type='Series'"
        );

        const anime = await pool.query(
            "SELECT COUNT(*) FROM contents WHERE type='Anime'"
        );

        const requests = await pool.query(
            "SELECT COUNT(*) FROM requests"
        );

        await bot.sendMessage(

            chatId,

`👑 <b>CineXClub Admin Panel</b>

━━━━━━━━━━━━━━

👥 Users : ${users.rows[0].count}

🎬 Movies : ${movies.rows[0].count}

📺 Series : ${series.rows[0].count}

🍥 Anime : ${anime.rows[0].count}

📩 Requests : ${requests.rows[0].count}

━━━━━━━━━━━━━━

Choose an option 👇`,

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
                                text:"📋 Latest Requests",
                                callback_data:"admin_requests"
                            }
                        ],

                        [
                            {
                                text:"🔄 Refresh",
                                callback_data:"admin_refresh"
                            }
                        ]

                    ]

                }

            }

        );

    }catch(err){

        console.log("Admin Panel Error:",err.message);

    }

}

// ======================
// /ADMIN COMMAND
// ======================

bot.onText(/\/admin/,async(msg)=>{

    if(!isAdmin(msg.from.id))
        return;

    await showAdminPanel(msg.chat.id);

});

// ======================
// REFRESH CALLBACK
// ======================

bot.on("callback_query",async(query)=>{

    if(query.data!=="admin_refresh")
        return;

    if(!isAdmin(query.from.id))
        return;

    await bot.answerCallbackQuery(query.id);

    await showAdminPanel(query.message.chat.id);

});

console.log("✅ PART 11 Loaded");
// ===================================================
// CineXClub Bot
// PART 12/20
// ADMIN STATS COMMANDS
// ===================================================

// ======================
// /USERS
// ======================

bot.onText(/\/users/, async (msg) => {

    if (!isAdmin(msg.from.id)) return;

    const result = await pool.query(
        "SELECT COUNT(*) FROM users"
    );

    bot.sendMessage(
        msg.chat.id,
        `👥 Total Users : ${result.rows[0].count}`
    );

});

// ======================
// /MOVIES
// ======================

bot.onText(/\/movies/, async (msg) => {

    if (!isAdmin(msg.from.id)) return;

    const result = await pool.query(
        "SELECT COUNT(*) FROM contents WHERE type='Movie'"
    );

    bot.sendMessage(
        msg.chat.id,
        `🎬 Total Movies : ${result.rows[0].count}`
    );

});

// ======================
// /SERIES
// ======================

bot.onText(/\/series/, async (msg) => {

    if (!isAdmin(msg.from.id)) return;

    const result = await pool.query(
        "SELECT COUNT(*) FROM contents WHERE type='Series'"
    );

    bot.sendMessage(
        msg.chat.id,
        `📺 Total Series : ${result.rows[0].count}`
    );

});

// ======================
// /ANIME
// ======================

bot.onText(/\/anime/, async (msg) => {

    if (!isAdmin(msg.from.id)) return;

    const result = await pool.query(
        "SELECT COUNT(*) FROM contents WHERE type='Anime'"
    );

    bot.sendMessage(
        msg.chat.id,
        `🍥 Total Anime : ${result.rows[0].count}`
    );

});

// ======================
// /REQUESTS
// ======================

bot.onText(/\/requests/, async (msg) => {

    if (!isAdmin(msg.from.id)) return;

    const result = await pool.query(
        "SELECT COUNT(*) FROM requests"
    );

    bot.sendMessage(
        msg.chat.id,
        `📩 Total Requests : ${result.rows[0].count}`
    );

});

// ======================
// /SEARCHDB
// ======================

bot.onText(/\/searchdb (.+)/, async (msg, match) => {

    if (!isAdmin(msg.from.id)) return;

    const keyword = match[1];

    const result = await pool.query(

        `
        SELECT *
        FROM contents
        WHERE LOWER(title)
        LIKE LOWER($1)
        LIMIT 20
        `,

        [`%${keyword}%`]

    );

    if (!result.rows.length) {

        return bot.sendMessage(
            msg.chat.id,
            "❌ No results found."
        );

    }

    let text = "📂 Database Results\n\n";

    result.rows.forEach(item => {

        text += `🎬 ${item.title}\n`;
        text += `🆔 ${item.content_id}\n`;
        text += `📂 ${item.type}\n\n`;

    });

    bot.sendMessage(msg.chat.id, text);

});

console.log("✅ PART 12 Loaded");
// ===================================================
// CineXClub Bot
// PART 13/20
// DELETE + UPDATE + DATABASE CLEANUP
// ===================================================

// ======================
// /DELETE
// ======================

bot.onText(/\/delete (.+)/, async (msg, match) => {

    if (!isAdmin(msg.from.id)) return;

    const id = match[1].trim().toLowerCase();

    try {

        const result = await pool.query(

            `
            DELETE FROM contents
            WHERE content_id=$1
            RETURNING title
            `,

            [id]

        );

        if (!result.rows.length) {

            return bot.sendMessage(
                msg.chat.id,
                "❌ Content not found."
            );

        }

        bot.sendMessage(

            msg.chat.id,

            `✅ Deleted Successfully

🎬 ${result.rows[0].title}`

        );

    } catch (err) {

        console.log(err.message);

    }

});

// ======================
// /UPDATEQUALITY
// ======================

bot.onText(/\/updatequality (.+) (.+)/, async (msg, match) => {

    if (!isAdmin(msg.from.id)) return;

    const id = match[1].trim().toLowerCase();
    const quality = match[2].trim();

    try {

        await pool.query(

            `
            UPDATE contents
            SET quality=$1
            WHERE content_id=$2
            `,

            [quality, id]

        );

        bot.sendMessage(

            msg.chat.id,

            `✅ Quality Updated

🆔 ${id}

🎥 ${quality}`

        );

    } catch (err) {

        console.log(err.message);

    }

});

// ======================
// /UPDATELANGUAGE
// ======================

bot.onText(/\/updatelanguage (.+) (.+)/, async (msg, match) => {

    if (!isAdmin(msg.from.id)) return;

    const id = match[1].trim().toLowerCase();
    const language = match[2];

    try {

        await pool.query(

            `
            UPDATE contents
            SET language=$1
            WHERE content_id=$2
            `,

            [language, id]

        );

        bot.sendMessage(
            msg.chat.id,
            `✅ Language Updated`
        );

    } catch (err) {

        console.log(err.message);

    }

});

// ======================
// /UPDATEYEAR
// ======================

bot.onText(/\/updateyear (.+) (.+)/, async (msg, match) => {

    if (!isAdmin(msg.from.id)) return;

    const id = match[1].trim().toLowerCase();
    const year = match[2];

    try {

        await pool.query(

            `
            UPDATE contents
            SET year=$1
            WHERE content_id=$2
            `,

            [year, id]

        );

        bot.sendMessage(
            msg.chat.id,
            "✅ Year Updated"
        );

    } catch (err) {

        console.log(err.message);

    }

});

// ======================
// /CLEANREQUESTS
// ======================

bot.onText(/\/cleanrequests/, async (msg) => {

    if (!isAdmin(msg.from.id)) return;

    try {

        await pool.query(

            `DELETE FROM requests`

        );

        bot.sendMessage(

            msg.chat.id,

            "🗑 All requests deleted."

        );

    } catch (err) {

        console.log(err.message);

    }

});

console.log("✅ PART 13 Loaded");
// ===================================================
// CineXClub Bot
// PART 14/20
// BACKUP + EXPORT + IMPORT COMMANDS
// ===================================================

// ======================
// /BACKUP
// ======================

bot.onText(/\/backup/, async (msg) => {

    if (!isAdmin(msg.from.id)) return;

    try {

        const result = await pool.query(
            "SELECT * FROM contents ORDER BY id"
        );

        const backup = JSON.stringify(
            result.rows,
            null,
            2
        );

        const fs = require("fs");

        const fileName = `backup_${Date.now()}.json`;

        fs.writeFileSync(fileName, backup);

        await bot.sendDocument(
            msg.chat.id,
            fileName,
            {
                caption: "✅ Database Backup"
            }
        );

        fs.unlinkSync(fileName);

    } catch (err) {

        console.log(err.message);

        bot.sendMessage(
            msg.chat.id,
            "❌ Backup Failed."
        );

    }

});

// ======================
// /EXPORTUSERS
// ======================

bot.onText(/\/exportusers/, async (msg) => {

    if (!isAdmin(msg.from.id)) return;

    try {

        const result = await pool.query(
            "SELECT username FROM users ORDER BY username"
        );

        let text = "";

        result.rows.forEach(user => {

            text += user.username + "\n";

        });

        const fs = require("fs");

        const fileName = "users.txt";

        fs.writeFileSync(fileName, text);

        await bot.sendDocument(
            msg.chat.id,
            fileName,
            {
                caption: "👥 Users Export"
            }
        );

        fs.unlinkSync(fileName);

    } catch (err) {

        console.log(err.message);

    }

});

// ======================
// /EXPORTREQUESTS
// ======================

bot.onText(/\/exportrequests/, async (msg) => {

    if (!isAdmin(msg.from.id)) return;

    try {

        const result = await pool.query(
            "SELECT * FROM requests ORDER BY created_at DESC"
        );

        let text = "";

        result.rows.forEach(req => {

            text +=
`User : ${req.username}
Request : ${req.request}
-------------------------

`;

        });

        const fs = require("fs");

        const fileName = "requests.txt";

        fs.writeFileSync(fileName, text);

        await bot.sendDocument(
            msg.chat.id,
            fileName,
            {
                caption: "📩 Requests Export"
            }
        );

        fs.unlinkSync(fileName);

    } catch (err) {

        console.log(err.message);

    }

});

// ======================
// /DBINFO
// ======================

bot.onText(/\/dbinfo/, async (msg) => {

    if (!isAdmin(msg.from.id)) return;

    try {

        const contents = await pool.query(
            "SELECT COUNT(*) FROM contents"
        );

        const users = await pool.query(
            "SELECT COUNT(*) FROM users"
        );

        const requests = await pool.query(
            "SELECT COUNT(*) FROM requests"
        );

        bot.sendMessage(

            msg.chat.id,

`📊 Database Information

━━━━━━━━━━━━━━

🎬 Contents : ${contents.rows[0].count}

👥 Users : ${users.rows[0].count}

📩 Requests : ${requests.rows[0].count}

━━━━━━━━━━━━━━`

        );

    } catch (err) {

        console.log(err.message);

    }

});

console.log("✅ PART 14 Loaded");
// ===================================================
// CineXClub Bot
// PART 15/20
// RECENT UPLOADS + RANDOM CONTENT + TRENDING
// ===================================================

// ======================
// /RECENT
// ======================

bot.onText(/\/recent/, async (msg) => {

    try {

        const result = await pool.query(

            `
            SELECT *
            FROM contents
            ORDER BY created_at DESC
            LIMIT 15
            `

        );

        if (!result.rows.length) {

            return bot.sendMessage(
                msg.chat.id,
                "❌ No uploads found."
            );

        }

        const buttons = [];

        result.rows.forEach(item => {

            buttons.push([

                {

                    text: `🎬 ${item.title} (${item.quality})`,

                    callback_data: `quality_${item.content_id}`

                }

            ]);

        });

        bot.sendMessage(

            msg.chat.id,

            "🆕 Recent Uploads",

            {

                reply_markup: {

                    inline_keyboard: buttons

                }

            }

        );

    } catch (err) {

        console.log(err.message);

    }

});

// ======================
// /RANDOM
// ======================

bot.onText(/\/random/, async (msg) => {

    try {

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
                "❌ Database is empty."
            );

        }

        const movie = result.rows[0];

        bot.sendMessage(

            msg.chat.id,

            `🎲 Random Pick

🎬 ${movie.title}

🎥 ${movie.quality}

📂 ${movie.type}`,

            {

                reply_markup: {

                    inline_keyboard: [

                        [

                            {

                                text: "▶️ Watch",

                                callback_data: `quality_${movie.content_id}`

                            }

                        ]

                    ]

                }

            }

        );

    } catch (err) {

        console.log(err.message);

    }

});

// ======================
// /TRENDING
// ======================

bot.onText(/\/trending/, async (msg) => {

    try {

        const result = await pool.query(

            `
            SELECT *
            FROM contents
            ORDER BY created_at DESC
            LIMIT 10
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

    } catch (err) {

        console.log(err.message);

    }

});

// ======================
// /LATESTMOVIES
// ======================

bot.onText(/\/latestmovies/, async (msg) => {

    const result = await pool.query(

        `
        SELECT *
        FROM contents
        WHERE type='Movie'
        ORDER BY created_at DESC
        LIMIT 20
        `

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

        "🎬 Latest Movies",

        {

            reply_markup: {

                inline_keyboard: buttons

            }

        }

    );

});

console.log("✅ PART 15 Loaded");
// ===================================================
// CineXClub Bot
// PART 16/20
// PAGINATION + NEXT/PREVIOUS NAVIGATION
// ===================================================

const PAGE_SIZE = 10;

// ======================
// SHOW PAGED LIST
// ======================

async function showPagedCollection(chatId, collection, page = 0) {

    const result = await pool.query(

        `
        SELECT *
        FROM contents
        WHERE collection=$1
        ORDER BY season,episode,title
        LIMIT $2
        OFFSET $3
        `,

        [collection, PAGE_SIZE, page * PAGE_SIZE]

    );

    if (!result.rows.length) {

        return bot.sendMessage(
            chatId,
            "❌ No content found."
        );

    }

    const buttons = [];

    result.rows.forEach(item => {

        buttons.push([

            {

                text: `🎬 ${item.title}`,

                callback_data: `quality_${item.content_id}`

            }

        ]);

    });

    const nav = [];

    if (page > 0) {

        nav.push({

            text: "⬅ Previous",

            callback_data: `page_${collection}_${page-1}`

        });

    }

    if (result.rows.length === PAGE_SIZE) {

        nav.push({

            text: "Next ➡",

            callback_data: `page_${collection}_${page+1}`

        });

    }

    if (nav.length)
        buttons.push(nav);

    buttons.push([

        {

            text: "🏠 Home",

            callback_data: "home"

        }

    ]);

    await bot.sendMessage(

        chatId,

        `📂 ${collection}\n\nPage ${page+1}`,

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

}

// ======================
// PAGE CALLBACK
// ======================

bot.on("callback_query", async(query)=>{

    if(!query.data.startsWith("page_"))
        return;

    const parts=query.data.split("_");

    const collection=parts[1];

    const page=parseInt(parts[2]);

    await bot.answerCallbackQuery(query.id);

    await showPagedCollection(

        query.message.chat.id,

        collection,

        page

    );

});

// ======================
// /PAGE COMMAND
// ======================

bot.onText(/\/page (.+)/, async(msg,match)=>{

    await showPagedCollection(

        msg.chat.id,

        match[1],

        0

    );

});

console.log("✅ PART 16 Loaded");
// ===================================================
// CineXClub Bot
// PART 17/20
// FAVORITES SYSTEM
// ===================================================

// ======================
// FAVORITES TABLE
// ======================

async function initFavorites(){

    try{

        await pool.query(`

        CREATE TABLE IF NOT EXISTS favorites(

            id SERIAL PRIMARY KEY,

            user_id BIGINT,

            content_id TEXT,

            created_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(user_id,content_id)

        );

        `);

        console.log("✅ Favorites Table Ready");

    }catch(err){

        console.log(err.message);

    }

}

initFavorites();

// ======================
// ADD FAVORITE
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

        [userId,contentId]

        );

        return true;

    }catch(err){

        console.log(err.message);

        return false;

    }

}

// ======================
// REMOVE FAVORITE
// ======================

async function removeFavorite(userId,contentId){

    await pool.query(

    `
    DELETE FROM favorites

    WHERE user_id=$1

    AND content_id=$2
    `,

    [userId,contentId]

    );

}

// ======================
// GET FAVORITES
// ======================

async function getFavorites(userId){

    const result=await pool.query(

    `
    SELECT c.*

    FROM favorites f

    JOIN contents c

    ON c.content_id=f.content_id

    WHERE f.user_id=$1

    ORDER BY f.created_at DESC
    `,

    [userId]

    );

    return result.rows;

}

// ======================
// FAVORITE CALLBACKS
// ======================

bot.on("callback_query",async(query)=>{

    const data=query.data;

    const chatId=query.message.chat.id;

    const userId=query.from.id;

    // ADD

    if(data.startsWith("fav_")){

        const id=data.replace("fav_","");

        await addFavorite(userId,id);

        return bot.answerCallbackQuery(

            query.id,

            {

                text:"❤️ Added to Favorites"

            }

        );

    }

    // REMOVE

    if(data.startsWith("unfav_")){

        const id=data.replace("unfav_","");

        await removeFavorite(userId,id);

        return bot.answerCallbackQuery(

            query.id,

            {

                text:"💔 Removed"

            }

        );

    }

});

// ======================
// /FAVORITES
// ======================

bot.onText(/\/favorites/,async(msg)=>{

    const list=

    await getFavorites(msg.from.id);

    if(!list.length){

        return bot.sendMessage(

            msg.chat.id,

            "❤️ Favorites list is empty."

        );

    }

    const buttons=[];

    list.forEach(item=>{

        buttons.push([

            {

                text:`🎬 ${item.title}`,

                callback_data:`quality_${item.content_id}`

            },

            {

                text:"❌",

                callback_data:`unfav_${item.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "❤️ My Favorites",

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
// PART 18/20
// WATCH HISTORY + CONTINUE WATCHING
// ===================================================

// ======================
// HISTORY TABLE
// ======================

async function initHistory(){

    try{

        await pool.query(`

        CREATE TABLE IF NOT EXISTS history(

            id SERIAL PRIMARY KEY,

            user_id BIGINT,

            content_id TEXT,

            watched_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(user_id,content_id)

        );

        `);

        console.log("✅ History Table Ready");

    }catch(err){

        console.log(err.message);

    }

}

initHistory();

// ======================
// SAVE HISTORY
// ======================

async function saveHistory(userId,contentId){

    try{

        await pool.query(

        `
        INSERT INTO history(user_id,content_id)

        VALUES($1,$2)

        ON CONFLICT(user_id,content_id)

        DO UPDATE SET

        watched_at=NOW()
        `,

        [userId,contentId]

        );

    }catch(err){

        console.log(err.message);

    }

}

// ======================
// GET HISTORY
// ======================

async function getHistory(userId){

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

    [userId]

    );

    return result.rows;

}

// ======================
// SAVE WHEN FILE IS SENT
// ======================

// sendFile() function లో
// bot.sendDocument() విజయవంతంగా పూర్తయిన వెంటనే
// ఈ line add చేయండి:
//
// await saveHistory(userId,file.content_id);
//
// sendFile function parameter ఇలా మార్చండి:
//
// async function sendFile(chatId,file,userId)

// ======================
// /HISTORY
// ======================

bot.onText(/\/history/,async(msg)=>{

    const list=

    await getHistory(msg.from.id);

    if(!list.length){

        return bot.sendMessage(

            msg.chat.id,

            "📺 Watch history is empty."

        );

    }

    const buttons=[];

    list.forEach(item=>{

        buttons.push([

            {

                text:`🎬 ${item.title}`,

                callback_data:`quality_${item.content_id}`

            }

        ]);

    });

    bot.sendMessage(

        msg.chat.id,

        "🕒 Continue Watching",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

// ======================
// /CLEARHISTORY
// ======================

bot.onText(/\/clearhistory/,async(msg)=>{

    await pool.query(

    `
    DELETE FROM history

    WHERE user_id=$1
    `,

    [msg.from.id]

    );

    bot.sendMessage(

        msg.chat.id,

        "🗑 Watch history cleared."

    );

});

console.log("✅ PART 18 Loaded");
// ===================================================
// CineXClub Bot
// PART 19/20
// STATISTICS + POPULAR CONTENT
// ===================================================

// ======================
// DOWNLOADS TABLE
// ======================

async function initDownloads(){

    try{

        await pool.query(`

        CREATE TABLE IF NOT EXISTS downloads(

            id SERIAL PRIMARY KEY,

            user_id BIGINT,

            content_id TEXT,

            downloaded_at TIMESTAMP DEFAULT NOW()

        );

        `);

        console.log("✅ Downloads Table Ready");

    }catch(err){

        console.log(err.message);

    }

}

initDownloads();

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

    }catch(err){

        console.log(err.message);

    }

}

// ===================================================
// IMPORTANT
// sendFile() function లో
// bot.sendDocument() success అయిన వెంటనే
//
// await saveDownload(userId,file.content_id);
//
// add చేయాలి.
// ===================================================

// ======================
// /STATS
// ======================

bot.onText(/\/stats/,async(msg)=>{

    if(!isAdmin(msg.from.id))
        return;

    const users=await pool.query(
        "SELECT COUNT(*) FROM users"
    );

    const contents=await pool.query(
        "SELECT COUNT(*) FROM contents"
    );

    const downloads=await pool.query(
        "SELECT COUNT(*) FROM downloads"
    );

    const requests=await pool.query(
        "SELECT COUNT(*) FROM requests"
    );

    bot.sendMessage(

        msg.chat.id,

`📊 CineXClub Statistics

━━━━━━━━━━━━━━

👥 Users : ${users.rows[0].count}

🎬 Contents : ${contents.rows[0].count}

⬇ Downloads : ${downloads.rows[0].count}

📩 Requests : ${requests.rows[0].count}

━━━━━━━━━━━━━━`

    );

});

// ======================
// /TOPDOWNLOADS
// ======================

bot.onText(/\/topdownloads/,async(msg)=>{

    const result=await pool.query(

    `
    SELECT
    c.title,
    COUNT(d.id) total

    FROM downloads d

    JOIN contents c

    ON c.content_id=d.content_id

    GROUP BY c.title

    ORDER BY total DESC

    LIMIT 10
    `

    );

    if(!result.rows.length){

        return bot.sendMessage(
            msg.chat.id,
            "No download statistics available."
        );

    }

    let text="🏆 Top Downloads\n\n";

    result.rows.forEach((item,index)=>{

        text+=`${index+1}. ${item.title}
⬇ ${item.total} Downloads

`;

    });

    bot.sendMessage(msg.chat.id,text);

});

// ======================
// /POPULAR
// ======================

bot.onText(/\/popular/,async(msg)=>{

    const result=await pool.query(

    `
    SELECT
    c.*

    FROM downloads d

    JOIN contents c

    ON c.content_id=d.content_id

    GROUP BY
    c.id

    ORDER BY COUNT(d.id) DESC

    LIMIT 15
    `

    );

    if(!result.rows.length){

        return bot.sendMessage(
            msg.chat.id,
            "❌ No popular content yet."
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

        "🔥 Popular Content",

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

});

console.log("✅ PART 19 Loaded");
// ===================================================
// CineXClub Bot
// PART 20/20
// FINAL STARTUP + ERROR HANDLER + SHUTDOWN
// ===================================================

// ======================
// BOT INFO
// ======================

bot.getMe()
.then(me=>{

    console.log("================================");

    console.log("🤖 Bot Started Successfully");

    console.log("Name :",me.first_name);

    console.log("Username : @"+me.username);

    console.log("================================");

})
.catch(err=>{

    console.log("Bot Start Error:",err.message);

});

// ======================
// DATABASE CHECK
// ======================

setInterval(async()=>{

    try{

        await pool.query("SELECT NOW()");

        console.log("✅ PostgreSQL Connected");

    }catch(err){

        console.log("❌ Database Lost:",err.message);

    }

},300000);

// ======================
// GLOBAL ERROR HANDLER
// ======================

process.on("uncaughtException",(err)=>{

    console.log("UNCAUGHT EXCEPTION");

    console.log(err);

});

process.on("unhandledRejection",(err)=>{

    console.log("UNHANDLED PROMISE");

    console.log(err);

});

// ======================
// GRACEFUL SHUTDOWN
// ======================

async function shutdown(){

    console.log("Stopping Bot...");

    try{

        await pool.end();

        console.log("Database Closed");

    }catch(err){

        console.log(err.message);

    }

    process.exit(0);

}

process.on("SIGINT",shutdown);

process.on("SIGTERM",shutdown);

// ======================
// BOT POLLING ERROR
// ======================

bot.on("polling_error",(err)=>{

    console.log("Polling Error:");

    console.log(err.message);

});

// ======================
// TELEGRAM ERROR
// ======================

bot.on("webhook_error",(err)=>{

    console.log("Webhook Error:");

    console.log(err.message);

});

// ======================
// KEEP ALIVE LOG
// ======================

setInterval(()=>{

    console.log(

        "🟢 CineXClub Bot Running :",

        new Date().toLocaleString()

    );

},600000);

// ======================
// READY
// ======================

console.log("================================");
console.log("🎬 CineXClub Bot");
console.log("✅ All 20 Parts Loaded");
console.log("🚀 Production Ready");
console.log("================================");
