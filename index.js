// ===================================================
// CineXClub Bot
// PART 1/?
// Setup + Environment + Express + Telegram + PostgreSQL
// ===================================================

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const { Pool } = require("pg");

// ======================
// ENV VARIABLES
// ======================

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME;

const DATABASE_URL = process.env.DATABASE_URL;

const STORAGE_CHANNEL = process.env.STORAGE_CHANNEL;
const FORCE_CHANNEL = process.env.FORCE_CHANNEL;

const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;

// ======================
// EXPRESS SERVER
// ======================

const app = express();

app.get("/", (req, res) => {
    res.send("🎬 CineXClub Bot Running...");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🌐 Server Running On Port ${PORT}`);
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

console.log("🤖 Starting CineXClub Bot...");

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
// GLOBAL STATES
// ======================

const uploadState = new Map();
const searchState = new Map();
const requestState = new Map();
const notifyState = new Map();
const broadcastState = new Map();
const adminState = new Map();

// ======================
// RANDOM QUOTES
// ======================

const quotes = [

    "🍿 Unlimited Entertainment",

    "🎬 Watch Movies Anytime",

    "📺 Movies • Series • Anime",

    "❤️ Welcome To CineXClub",

    "🔥 Enjoy Premium Experience"

];

function randomQuote() {

    return quotes[
        Math.floor(Math.random() * quotes.length)
    ];

}

// ======================
// ADMIN CHECK
// ======================

function isAdmin(userId) {

    return Number(userId) === ADMIN_CHAT_ID;

}

// ======================
// AUTO DELETE
// ======================

async function autoDelete(chatId, messageId, minutes = 30) {

    setTimeout(async () => {

        try {

            await bot.deleteMessage(chatId, messageId);

        } catch (err) {}

    }, minutes * 60 * 1000);

}

// ======================
// BOT INFO
// ======================

bot.getMe()

.then(info => {

    console.log("================================");
    console.log("🤖 Bot Name :", info.first_name);
    console.log("👤 Username : @" + info.username);
    console.log("================================");

})

.catch(err => {

    console.log(err.message);

});

// ======================
// PRIVATE CHANNEL LOG
// ======================

bot.on("channel_post", (msg) => {

    console.log("================================");
    console.log("✅ CHANNEL POST RECEIVED");
    console.log("Chat ID :", msg.chat.id);
    console.log("Message ID :", msg.message_id);

    if (msg.document) {

        console.log("📁 File :", msg.document.file_name);

    }

    if (msg.video) {

        console.log("🎥 Video Received");

    }

    console.log("================================");

});

// ======================

console.log("✅ PART 1 LOADED");
// ===================================================
// CineXClub Bot
// PART 2/? 
// PostgreSQL Database + Tables + Helpers
// ===================================================

// ======================
// INITIALIZE DATABASE
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

year INTEGER,

language TEXT,

quality TEXT,

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

request_name TEXT,

status TEXT DEFAULT 'Pending',

created_at TIMESTAMP DEFAULT NOW()

);

CREATE TABLE IF NOT EXISTS downloads(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

downloaded_at TIMESTAMP DEFAULT NOW()

);

`);

        console.log("✅ Database Ready");

    }

    catch(err){

        console.log(err.message);

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

    }

    catch(err){

        console.log(err.message);

    }

}

// ======================
// SAVE DOWNLOAD
// ======================

async function saveDownload(userId,contentId){

    try{

        await pool.query(

`

INSERT INTO downloads(

user_id,
content_id

)

VALUES($1,$2)

`,

[
userId,
contentId
]

);

    }

    catch(err){

        console.log(err.message);

    }

}

// ======================
// TOTAL USERS
// ======================

async function totalUsers(){

    const result=await pool.query(

`

SELECT COUNT(*) AS total

FROM users

`

);

    return Number(result.rows[0].total);

}

// ======================
// TOTAL DOWNLOADS
// ======================

async function totalDownloads(){

    const result=await pool.query(

`

SELECT COUNT(*) AS total

FROM downloads

`

);

    return Number(result.rows[0].total);

}

// ======================
// TOTAL CONTENT
// ======================

async function totalContent(type){

    const result=await pool.query(

`

SELECT COUNT(*) AS total

FROM contents

WHERE type=$1

`,

[type]

);

    return Number(result.rows[0].total);

}

// ======================
// DATABASE STATUS
// ======================

async function databaseStatus(){

    try{

        await pool.query("SELECT NOW()");

        return "🟢 Online";

    }

    catch{

        return "🔴 Offline";

    }

}

// ======================
// DATABASE PING
// ======================

setInterval(async()=>{

    try{

        await pool.query("SELECT NOW()");

        console.log("🟢 PostgreSQL Connected");

    }

    catch{

        console.log("🔴 PostgreSQL Offline");

    }

},300000);

console.log("✅ PART 2 LOADED");
// ===================================================
// CineXClub Bot
// PART 3A1
// Start Command
// ===================================================

// ======================
// START COMMAND
// ======================

bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {

    const chatId = msg.chat.id;

    const user = msg.from;

    await saveUser(user);

    // Admin Login

    if (isAdmin(user.id)) {

        return showAdminPanel(chatId);

    }

    // Deep Link

    if (match[1]) {

        return handleDeepLink(

            chatId,

            user,

            match[1]

        );

    }

    // Normal User

    return showWelcome(chatId, user);

});

console.log("✅ START HANDLER LOADED");
// ===================================================
// CineXClub Bot
// PART 3A2
// Welcome Screen
// ===================================================

// ======================
// WELCOME IMAGE
// ======================

const WELCOME_IMAGE = process.env.WELCOME_IMAGE;

// ======================
// USER HOME BUTTONS
// ======================

function homeButtons() {

    return {

        inline_keyboard: [

            [

                {

                    text: "🎬 Movies",

                    callback_data: "movies"

                },

                {

                    text: "📺 Series",

                    callback_data: "series"

                }

            ],

            [

                {

                    text: "🍥 Anime",

                    callback_data: "anime"

                }

            ],

            [

                {

                    text: "🔍 Search",

                    callback_data: "search"

                }

            ],

            [

                {

                    text: "ℹ️ About",

                    callback_data: "about"

                },

                {

                    text: "❌ Close",

                    callback_data: "close"

                }

            ]

        ]

    };

}

// ======================
// SHOW WELCOME
// ======================

async function showWelcome(chatId, user) {

    const sent = await bot.sendPhoto(

        chatId,

        WELCOME_IMAGE,

        {

            caption:

`👋 Welcome ${user.first_name}

${randomQuote()}

━━━━━━━━━━━━━━

🎬 Movies

📺 Series

🍥 Anime

━━━━━━━━━━━━━━

Choose an option below.`,

            reply_markup: homeButtons()

        }

    );

    autoDelete(

        chatId,

        sent.message_id

    );

}

console.log("✅ PART 3A2 LOADED");
// ===================================================
// CineXClub Bot
// PART 3A3
// Admin Panel
// ===================================================

// ======================
// SHOW ADMIN PANEL
// ======================

async function showAdminPanel(chatId) {

    const movies = await totalContent("Movie");

    const series = await totalContent("Series");

    const anime = await totalContent("Anime");

    const users = await totalUsers();

    const downloads = await totalDownloads();

    const db = await databaseStatus();

    const sent = await bot.sendMessage(

        chatId,

`👑 CineXClub Admin Panel

━━━━━━━━━━━━━━

🎬 Movies : ${movies}

📺 Series : ${series}

🍥 Anime : ${anime}

👥 Users : ${users}

📥 Downloads : ${downloads}

💾 Database : ${db}

━━━━━━━━━━━━━━

Choose an option.`,

        {

            reply_markup: {

                inline_keyboard: [

                    [

                        {

                            text: "📤 Upload File",

                            callback_data: "admin_upload"

                        }

                    ],

                    [

                        {

                            text: "📥 Requests",

                            callback_data: "admin_requests"

                        },

                        {

                            text: "📊 Statistics",

                            callback_data: "admin_stats"

                        }

                    ],

                    [

                        {

                            text: "📢 Broadcast",

                            callback_data: "admin_broadcast"

                        },

                        {

                            text: "⚙️ Settings",

                            callback_data: "admin_settings"

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

}

console.log("✅ PART 3A3 LOADED");
// ===================================================
// CineXClub Bot
// PART 3B1
// Callback Query Handler
// ===================================================

bot.on("callback_query", async (query) => {

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    try {

        await bot.answerCallbackQuery(query.id);

    } catch {}

    // ======================
    // HOME
    // ======================

    if (data === "home") {

        try {

            await bot.deleteMessage(chatId, messageId);

        } catch {}

        return showWelcome(chatId, query.from);

    }

    // ======================
    // ABOUT
    // ======================

    if (data === "about") {

        return bot.editMessageCaption(

`🎬 <b>CineXClub</b>

🍿 Unlimited Movies

📺 Unlimited Series

🍥 Unlimited Anime

⚡ Fast Download
🔗 Direct Telegram Files

❤️ Thank you for using CineXClub.`,

            {

                chat_id: chatId,

                message_id: messageId,

                parse_mode: "HTML",

                reply_markup: {

                    inline_keyboard: [

                        [

                            {

                                text: "🏠 Home",

                                callback_data: "home"

                            }

                        ],

                        [

                            {

                                text: "❌ Close",

                                callback_data: "close"

                            }

                        ]

                    ]

                }

            }

        );

    }

    // ======================
    // CLOSE
    // ======================

    if (data === "close") {

        try {

            await bot.deleteMessage(chatId, messageId);

        } catch {}

        return;

    }

    // ======================
    // MOVIES
    // ======================

    if (data === "movies") {

        return showCollections(chatId, "Movie");

    }

    // ======================
    // SERIES
    // ======================

    if (data === "series") {

        return showCollections(chatId, "Series");

    }

    // ======================
    // ANIME
    // ======================

    if (data === "anime") {

        return showCollections(chatId, "Anime");

    }

    // ======================
    // SEARCH
    // ======================

    if (data === "search") {

        searchState.set(chatId, true);

        const sent = await bot.sendMessage(

            chatId,

            "🔎 Send Movie / Series / Anime Name."

        );

        autoDelete(chatId, sent.message_id);

        return;

    }

});

console.log("✅ PART 3B1 LOADED");
// ===================================================
// CineXClub Bot
// PART 3B2
// Force Join + Deep Link
// ===================================================

// ======================
// CHECK FORCE JOIN
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

    } catch {

        return false;

    }

}

// ======================
// FORCE JOIN MESSAGE
// ======================

async function sendForceJoin(chatId) {

    const sent = await bot.sendMessage(

        chatId,

`📢 Please Join Our Updates Channel First.

After joining click Continue.`,

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

                            callback_data: "continue_join"

                        }

                    ]

                ]

            }

        }

    );

    autoDelete(chatId, sent.message_id);

}

// ======================
// DEEP LINK
// ======================

async function handleDeepLink(chatId, user, contentId) {

    const joined = await checkForceJoin(user.id);

    if (!joined) {

        requestState.set(user.id, contentId);

        return sendForceJoin(chatId);

    }

    return sendContent(chatId, contentId);

}

// ======================
// CONTINUE BUTTON
// ======================

bot.on("callback_query", async (query) => {

    if (query.data !== "continue_join")
        return;

    const joined = await checkForceJoin(query.from.id);

    if (!joined) {

        return bot.answerCallbackQuery(

            query.id,

            {

                text: "❌ Join channel first.",

                show_alert: true

            }

        );

    }

    bot.answerCallbackQuery(query.id);

    const contentId = requestState.get(query.from.id);

    requestState.delete(query.from.id);

    try {

        await bot.deleteMessage(

            query.message.chat.id,

            query.message.message_id

        );

    } catch {}

    return sendContent(

        query.message.chat.id,

        contentId

    );

});

console.log("✅ PART 3B2 LOADED");
// ===================================================
// CineXClub Bot
// PART 3C1
// Search System
// ===================================================

// ======================
// SEARCH MESSAGE
// ======================

bot.on("message", async (msg) => {

    const chatId = msg.chat.id;

    if (!msg.text)
        return;

    if (!searchState.has(chatId))
        return;

    searchState.delete(chatId);

    const keyword = msg.text.trim();

    const result = await pool.query(

        `
SELECT *

FROM contents

WHERE LOWER(title)

LIKE LOWER($1)

ORDER BY year DESC
        `,

        [`%${keyword}%`]

    );

    // ======================
    // NOT FOUND
    // ======================

    if (result.rows.length === 0) {

        const sent = await bot.sendMessage(

            chatId,

            "❌ Movie / Series / Anime Not Found In Our Database.",

            {

                reply_markup: {

                    inline_keyboard: [

                        [

                            {

                                text: "🎬 Request Movie / Series / Anime",

                                callback_data: "request"

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

        autoDelete(chatId, sent.message_id);

        return;

    }

    // ======================
    // SEARCH RESULTS
    // ======================

    const buttons = [];

    result.rows.forEach(item => {

        let title = "";

        if (item.type === "Movie") {

            title =
            `🎬 ${item.title} (${item.year})`;

        }

        else {

            title =
            `📺 ${item.collection} (${item.year})`;

        }

        buttons.push([

            {

                text: title,

                callback_data:
                `quality_${item.content_id}`

            }

        ]);

    });

    buttons.push([

        {

            text: "🏠 Home",

            callback_data: "home"

        }

    ]);

    const sent = await bot.sendMessage(

        chatId,

        `🔎 Search Results For

<b>${keyword}</b>`,

        {

            parse_mode: "HTML",

            reply_markup: {

                inline_keyboard: buttons

            }

        }

    );

    autoDelete(chatId, sent.message_id);

});

console.log("✅ PART 3C1 LOADED");
// ===================================================
// CineXClub Bot
// PART 3C2
// Request System
// ===================================================

// ======================
// REQUEST CALLBACK
// ======================

bot.on("callback_query", async (query) => {

    if (query.data !== "request")
        return;

    requestState.set(query.from.id, true);

    await bot.answerCallbackQuery(query.id);

    const sent = await bot.sendMessage(

        query.message.chat.id,

        "📝 Send Movie / Series / Anime Name."

    );

    autoDelete(

        query.message.chat.id,

        sent.message_id

    );

});

// ======================
// REQUEST MESSAGE
// ======================

bot.on("message", async (msg) => {

    if (!msg.text)
        return;

    if (!requestState.has(msg.from.id))
        return;

    requestState.delete(msg.from.id);

    await pool.query(

`
INSERT INTO requests(

user_id,

username,

request_name,

status

)

VALUES($1,$2,$3,$4)
`,

[
msg.from.id,
msg.from.username || "",
msg.text,
"Pending"
]

);

    // ======================
    // SEND TO ADMIN
    // ======================

    await bot.sendMessage(

        ADMIN_CHAT_ID,

`📥 New Request

👤 User : ${msg.from.first_name}

🆔 ${msg.from.id}

🎬 Request :

${msg.text}

Status : Pending`,

        {

            reply_markup:{

                inline_keyboard:[

                    [

                        {

                            text:"📤 Upload",

                            callback_data:`upload_${msg.from.id}`

                        }

                    ],

                    [

                        {

                            text:"❌ Reject",

                            callback_data:`reject_${msg.from.id}`

                        }

                    ]

                ]

            }

        }

    );

    // ======================
    // USER MESSAGE
    // ======================

    const sent = await bot.sendMessage(

        msg.chat.id,

`✅ Request Submitted Successfully.

Please wait until admin uploads it.`

    );

    autoDelete(

        msg.chat.id,

        sent.message_id

    );

});

console.log("✅ PART 3C2 LOADED");
// ===================================================
// CineXClub Bot
// PART 4A1
// Admin Upload Panel
// ===================================================

// ======================
// ADMIN UPLOAD CALLBACK
// ======================

bot.on("callback_query", async (query) => {

    if (query.data !== "admin_upload")
        return;

    if (!isAdmin(query.from.id))
        return;

    uploadState.set(query.from.id, {});

    await bot.answerCallbackQuery(query.id);

    await bot.editMessageText(

`📤 Upload New Content

Step 1/4

Select Content Type.`,

        {

            chat_id: query.message.chat.id,

            message_id: query.message.message_id,

            reply_markup: {

                inline_keyboard: [

                    [

                        {

                            text: "🎬 Movie",

                            callback_data: "upload_type_Movie"

                        }

                    ],

                    [

                        {

                            text: "📺 Series",

                            callback_data: "upload_type_Series"

                        }

                    ],

                    [

                        {

                            text: "🍥 Anime",

                            callback_data: "upload_type_Anime"

                        }

                    ],

                    [

                        {

                            text: "❌ Cancel",

                            callback_data: "admin_cancel"

                        }

                    ]

                ]

            }

        }

    );

});

// ======================
// TYPE SELECT
// ======================

bot.on("callback_query", async (query) => {

    if (!query.data.startsWith("upload_type_"))
        return;

    const state = uploadState.get(query.from.id);

    if (!state)
        return;

    state.type = query.data.replace(
        "upload_type_",
        ""
    );

    uploadState.set(query.from.id, state);

    await bot.answerCallbackQuery(query.id);

    await bot.editMessageText(

`✅ Type : ${state.type}

Step 2/4

📝 Send Caption.

Example

Movie

Deadpool & Wolverine
2024

Series

Stranger Things
Season 1
Episode 1

Anime

Naruto
Season 1
Episode 1`,

        {

            chat_id: query.message.chat.id,

            message_id: query.message.message_id,

            reply_markup: {

                inline_keyboard: [

                    [

                        {

                            text: "❌ Cancel",

                            callback_data: "admin_cancel"

                        }

                    ]

                ]

            }

        }

    );

});

// ======================
// CANCEL
// ======================

bot.on("callback_query", async (query) => {

    if (query.data !== "admin_cancel")
        return;

    uploadState.delete(query.from.id);

    await bot.answerCallbackQuery(query.id);

    try {

        await bot.deleteMessage(

            query.message.chat.id,

            query.message.message_id

        );

    } catch {}

    return showAdminPanel(

        query.message.chat.id

    );

});

console.log("✅ PART 4A1 LOADED");
// ===================================================
// CineXClub Bot
// PART 4A2
// Receive Caption + Quality Selection
// ===================================================

// ======================
// RECEIVE CAPTION
// ======================

bot.on("message", async (msg) => {

    if (!isAdmin(msg.from.id))
        return;

    if (!msg.text)
        return;

    const state = uploadState.get(msg.from.id);

    if (!state)
        return;

    if (state.captionReceived)
        return;

    const lines = msg.text
        .split("\n")
        .map(x => x.trim())
        .filter(Boolean);

    state.caption = msg.text;
    state.captionReceived = true;

    // ======================
    // MOVIE
    // ======================

    if (state.type === "Movie") {

        state.title = lines[0] || "";
        state.year = lines[1] || "";

    }

    // ======================
    // SERIES / ANIME
    // ======================

    else {

        state.collection = lines[0] || "";

        state.season = Number(
            (lines[1] || "")
            .replace(/[^0-9]/g, "")
        );

        state.episode = Number(
            (lines[2] || "")
            .replace(/[^0-9]/g, "")
        );

        state.title =
            `${state.collection} S${state.season}E${state.episode}`;

    }

    uploadState.set(msg.from.id, state);

    const sent = await bot.sendMessage(

        msg.chat.id,

`✅ Caption Saved

Step 3/4

🎥 Select Quality`,

        {

            reply_markup: {

                inline_keyboard: [

                    [

                        {

                            text: "480p",

                            callback_data: "quality_480p"

                        },

                        {

                            text: "720p",

                            callback_data: "quality_720p"

                        },

                        {

                            text: "1080p",

                            callback_data: "quality_1080p"

                        }

                    ],

                    [

                        {

                            text: "❌ Cancel",

                            callback_data: "admin_cancel"

                        }

                    ]

                ]

            }

        }

    );

    autoDelete(
        msg.chat.id,
        sent.message_id
    );

});

// ======================
// QUALITY
// ======================

bot.on("callback_query", async (query) => {

    if (!query.data.startsWith("quality_"))
        return;

    if (!isAdmin(query.from.id))
        return;

    const state = uploadState.get(query.from.id);

    if (!state)
        return;

    state.quality = query.data.replace(
        "quality_",
        ""
    );

    uploadState.set(query.from.id, state);

    await bot.answerCallbackQuery(query.id);

    await bot.editMessageText(

`✅ Type : ${state.type}

✅ Quality : ${state.quality}

Step 4/4

📁 Now Send The Video/File.`,

        {

            chat_id: query.message.chat.id,

            message_id: query.message.message_id

        }

    );

});

console.log("✅ PART 4A2 LOADED");
// ===================================================
// CineXClub Bot
// PART 4A3.1
// Receive File
// ===================================================

bot.on("message", async (msg) => {

    if (!isAdmin(msg.from.id))
        return;

    const state = uploadState.get(msg.from.id);

    if (!state)
        return;

    if (!state.quality)
        return;

    // Only Video or Document

    if (!msg.video && !msg.document)
        return;

    // Save Telegram File ID

    if (msg.video) {

        state.file_id = msg.video.file_id;

        state.file_name = "video";

    }

    if (msg.document) {

        state.file_id = msg.document.file_id;

        state.file_name = msg.document.file_name || "movie.mkv";

    }

    uploadState.set(msg.from.id, state);

    const sent = await bot.sendMessage(

        msg.chat.id,

`⏳ Uploading To Private Channel...

Please Wait...`

    );

    autoDelete(

        msg.chat.id,

        sent.message_id

    );

    // Next Step

    return uploadToStorage(

        msg.chat.id,

        msg.from.id

    );

});

console.log("✅ PART 4A3.1 LOADED");
// ===================================================
// CineXClub Bot
// PART 4A3.2A
// Upload To Storage Channel
// ===================================================

async function uploadToStorage(chatId, adminId) {

    try {

        const state = uploadState.get(adminId);

        if (!state)
            return;

        // Copy Admin File To Storage Channel

        const copied = await bot.copyMessage(

            STORAGE_CHANNEL,

            chatId,

            state.message_id

        );

        state.storage_message_id = copied.message_id;

        uploadState.set(adminId, state);

        console.log(
            "✅ Uploaded To Storage Channel"
        );

        return saveContent(adminId);

    }

    catch (err) {

        console.log(err);

        await bot.sendMessage(

            chatId,

            "❌ Storage Upload Failed."

        );

    }

}

console.log("✅ PART 4A3.2A LOADED");
// ===================================================
// CineXClub Bot
// PART 4A3.2B
// Save Database + Generate Link
// ===================================================

// ======================
// SAVE CONTENT
// ======================

async function saveContent(adminId) {

    try {

        const state = uploadState.get(adminId);

        if (!state)
            return;

        // Unique Content ID

        const contentId =
            Date.now().toString(36) +
            Math.random().toString(36).substring(2, 8);

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
`,

[
contentId,
state.title,
state.type,
state.collection || null,
state.season || null,
state.episode || null,
state.year || null,
state.quality,
state.file_id
]

        );

        // Deep Link

        const link =
`https://t.me/${BOT_USERNAME}?start=${contentId}`;

        uploadState.set(

            adminId,

            {

                ...state,

                contentId,

                link

            }

        );

        return uploadSuccess(adminId);

    }

    catch(err){

        console.log(err);

    }

}

console.log("✅ PART 4A3.2B LOADED");
// ===================================================
// CineXClub Bot
// PART 4A3.2C
// Upload Success
// ===================================================

// ======================
// UPLOAD SUCCESS
// ======================

async function uploadSuccess(adminId) {

    try {

        const state = uploadState.get(adminId);

        if (!state)
            return;

        let notifyButton = [];

        // Notify requested user (if any)

        if (state.requestUserId) {

            notifyButton.push([

                {

                    text: "📨 Notify User",

                    callback_data: `notify_${state.requestUserId}_${state.contentId}`

                }

            ]);

        }

        await bot.sendMessage(

            ADMIN_CHAT_ID,

`✅ File Saved Successfully

━━━━━━━━━━━━━━

🎬 ${state.title}

🎥 ${state.quality}

🆔 ${state.contentId}

━━━━━━━━━━━━━━

🔗 Link

https://t.me/${BOT_USERNAME}?start=${state.contentId}`,

            {

                disable_web_page_preview: true,

                reply_markup: {

                    inline_keyboard: [

                        [

                            {

                                text: "🔗 Open Link",

                                url: `https://t.me/${BOT_USERNAME}?start=${state.contentId}`

                            }

                        ],

                        ...notifyButton,

                        [

                            {

                                text: "📤 Upload Another File",

                                callback_data: "admin_upload"

                            }

                        ],

                        [

                            {

                                text: "🏠 Admin Panel",

                                callback_data: "admin_home"

                            }

                        ]

                    ]

                }

            }

        );

        uploadState.delete(adminId);

    }

    catch (err) {

        console.log(err);

    }

}

// ======================
// NOTIFY USER
// ======================

bot.on("callback_query", async (query) => {

    if (!query.data.startsWith("notify_"))
        return;

    const data = query.data.split("_");

    const userId = Number(data[1]);

    const contentId = data[2];

    try {

        await bot.sendMessage(

            userId,

`🎉 Your Requested Movie / Series / Anime Has Been Added.

👇 Click Below To Download.`,

            {

                reply_markup: {

                    inline_keyboard: [

                        [

                            {

                                text: "🎬 Open",

                                url: `https://t.me/${BOT_USERNAME}?start=${contentId}`

                            }

                        ]

                    ]

                }

            }

        );

        await bot.answerCallbackQuery(

            query.id,

            {

                text: "✅ User Notified"

            }

        );

    }

    catch {

        await bot.answerCallbackQuery(

            query.id,

            {

                text: "❌ User Blocked Bot",

                show_alert: true

            }

        );

    }

});

console.log("✅ PART 4A3.2C LOADED");
// ===================================================
// CineXClub Bot
// PART 4B1
// Upload Wizard
// ===================================================

// Upload Steps
// 1. Select Type
// 2. Enter Caption
// 3. Select Quality
// 4. Upload File

const uploadWizard = new Map();

// ======================
// START UPLOAD
// ======================

bot.on("callback_query", async (query) => {

    if (query.data !== "admin_upload")
        return;

    uploadWizard.set(query.from.id, {

        step: 1

    });

    await bot.editMessageText(

`📤 Upload Wizard

━━━━━━━━━━━━━━

Step 1 / 4

Select Content Type.`,

        {

            chat_id: query.message.chat.id,

            message_id: query.message.message_id,

            reply_markup: {

                inline_keyboard: [

                    [

                        {

                            text: "🎬 Movie",

                            callback_data: "wizard_movie"

                        }

                    ],

                    [

                        {

                            text: "📺 Series",

                            callback_data: "wizard_series"

                        }

                    ],

                    [

                        {

                            text: "🍥 Anime",

                            callback_data: "wizard_anime"

                        }

                    ],

                    [

                        {

                            text: "❌ Cancel",

                            callback_data: "admin_cancel"

                        }

                    ]

                ]

            }

        }

    );

});

// ======================
// TYPE SELECT
// ======================

bot.on("callback_query", async (query) => {

    if (!query.data.startsWith("wizard_"))
        return;

    const state = uploadWizard.get(query.from.id);

    if (!state)
        return;

    state.type = query.data.replace("wizard_", "");

    state.step = 2;

    uploadWizard.set(query.from.id, state);

    await bot.editMessageText(

`✅ Type Selected : ${state.type}

━━━━━━━━━━━━━━

Step 2 / 4

Now Send Caption.`,

        {

            chat_id: query.message.chat.id,

            message_id: query.message.message_id

        }

    );

});

console.log("✅ PART 4B1 LOADED");
// ===================================================
// CineXClub Bot
// PART 4B2
// Upload Wizard Step 2 -> Step 4
// ===================================================

// ======================
// RECEIVE CAPTION
// ======================

bot.on("message", async (msg) => {

    if (!isAdmin(msg.from.id))
        return;

    const state = uploadWizard.get(msg.from.id);

    if (!state)
        return;

    if (state.step !== 2)
        return;

    if (!msg.text)
        return;

    state.caption = msg.text;

    const lines = msg.text
        .split("\n")
        .map(x => x.trim())
        .filter(Boolean);

    if (state.type === "movie") {

        state.title = lines[0] || "";
        state.year = lines[1] || "";

    } else {

        state.collection = lines[0] || "";

        state.season = Number(
            (lines[1] || "").replace(/\D/g, "")
        );

        state.episode = Number(
            (lines[2] || "").replace(/\D/g, "")
        );

        state.title =
            `${state.collection} S${state.season}E${state.episode}`;

    }

    state.step = 3;

    uploadWizard.set(msg.from.id, state);

    const sent = await bot.sendMessage(

        msg.chat.id,

`✅ Caption Saved

━━━━━━━━━━━━━━

Step 3 / 4

Select Quality`,

        {

            reply_markup: {

                inline_keyboard: [

                    [

                        {

                            text: "480p",

                            callback_data: "wizard_quality_480p"

                        },

                        {

                            text: "720p",

                            callback_data: "wizard_quality_720p"

                        },

                        {

                            text: "1080p",

                            callback_data: "wizard_quality_1080p"

                        }

                    ]

                ]

            }

        }

    );

    autoDelete(msg.chat.id, sent.message_id);

});

// ======================
// QUALITY
// ======================

bot.on("callback_query", async (query) => {

    if (!query.data.startsWith("wizard_quality_"))
        return;

    const state = uploadWizard.get(query.from.id);

    if (!state)
        return;

    state.quality = query.data.replace(
        "wizard_quality_",
        ""
    );

    state.step = 4;

    uploadWizard.set(query.from.id, state);

    await bot.editMessageText(

`✅ Type : ${state.type}

✅ Quality : ${state.quality}

━━━━━━━━━━━━━━

Step 4 / 4

📁 Send Video / MKV File.`,

        {

            chat_id: query.message.chat.id,

            message_id: query.message.message_id

        }

    );

});

console.log("✅ PART 4B2 LOADED");
// ===================================================
// CineXClub Bot
// PART 4B3A
// Receive Video / Document
// ===================================================

bot.on("message", async (msg) => {

    if (!isAdmin(msg.from.id))
        return;

    const state = uploadWizard.get(msg.from.id);

    if (!state)
        return;

    if (state.step !== 4)
        return;

    if (!msg.video && !msg.document)
        return;

    // Save Original Message

    state.chatId = msg.chat.id;

    state.messageId = msg.message_id;

    // Video

    if (msg.video) {

        state.fileType = "video";

        state.fileId = msg.video.file_id;

        state.fileName = msg.video.file_name || "video.mp4";

    }

    // Document

    if (msg.document) {

        state.fileType = "document";

        state.fileId = msg.document.file_id;

        state.fileName = msg.document.file_name || "movie.mkv";

    }

    uploadWizard.set(msg.from.id, state);

    const sent = await bot.sendMessage(

        msg.chat.id,

        "⏳ Uploading To Private Channel..."

    );

    autoDelete(msg.chat.id, sent.message_id);

    return uploadWizardStorage(msg.from.id);

});


// ======================
// Upload To Storage
// ======================

async function uploadWizardStorage(adminId){

    const state = uploadWizard.get(adminId);

    if(!state)
        return;

    try{

        const copied = await bot.copyMessage(

            STORAGE_CHANNEL,

            state.chatId,

            state.messageId

        );

        state.storageMessageId = copied.message_id;

        uploadWizard.set(adminId,state);

        return uploadWizardSave(adminId);

    }

    catch(err){

        console.log(err);

        await bot.sendMessage(

            state.chatId,

            "❌ Upload Failed."

        );

    }

}

console.log("✅ PART 4B3A LOADED");
// ===================================================
// CineXClub Bot
// PART 4B3B
// Save Database + Generate Link
// ===================================================

// ======================
// SAVE CONTENT
// ======================

async function uploadWizardSave(adminId){

    try{

        const state = uploadWizard.get(adminId);

        if(!state)
            return;

        // Generate Unique Content ID

        const contentId =

            "CX" +

            Date.now().toString(36) +

            Math.random()

            .toString(36)

            .substring(2,6)

            .toUpperCase();

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
`,

[
contentId,

state.title,

state.type,

state.collection || null,

state.season || null,

state.episode || null,

state.year || null,

state.quality,

state.fileId

]

);

        state.contentId = contentId;

        state.link =

`https://t.me/${BOT_USERNAME}?start=${contentId}`;

        uploadWizard.set(adminId,state);

        return uploadWizardSuccess(adminId);

    }

    catch(err){

        console.log(err);

    }

}

// ======================
// SUCCESS
// ======================

async function uploadWizardSuccess(adminId){

    const state = uploadWizard.get(adminId);

    if(!state)
        return;

    const sent = await bot.sendMessage(

        ADMIN_CHAT_ID,

`✅ File Saved Successfully

━━━━━━━━━━━━━━

🎬 ${state.title}

🎥 ${state.quality}

🆔 ${state.contentId}

━━━━━━━━━━━━━━

🔗 ${state.link}`,

        {

            disable_web_page_preview:true,

            reply_markup:{

                inline_keyboard:[

                    [

                        {

                            text:"🔗 Open Link",

                            url:state.link

                        }

                    ],

                    [

                        {

                            text:"📤 Upload Another File",

                            callback_data:"admin_upload"

                        }

                    ],

                    [

                        {

                            text:"🏠 Admin Panel",

                            callback_data:"admin_home"

                        }

                    ]

                ]

            }

        }

    );

    autoDelete(

        ADMIN_CHAT_ID,

        sent.message_id

    );

    return uploadWizardNotify(adminId);

}

console.log("✅ PART 4B3B LOADED");
// ===================================================
// CineXClub Bot
// PART 4B3C
// Notification + Reset
// ===================================================


// ======================
// NOTIFY REQUESTED USER
// ======================

async function uploadWizardNotify(adminId){

    const state = uploadWizard.get(adminId);

    if(!state)
        return;


    // If request user exists

    if(state.requestUserId){

        try{

            await bot.sendMessage(

                state.requestUserId,

`🎉 Your Requested ${state.type} Added

🎬 ${state.title}

👇 Click Below To Open`,

                {

                    reply_markup:{

                        inline_keyboard:[

                            [

                                {

                                    text:"▶️ Open File",

                                    url:state.link

                                }

                            ]

                        ]

                    }

                }

            );

        }

        catch(err){

            console.log(
                "User Notification Failed"
            );

        }

    }


    // Clear Upload Data

    uploadWizard.delete(adminId);


}


// ======================
// ADMIN HOME BUTTON
// ======================

bot.on("callback_query", async(query)=>{


    if(query.data !== "admin_home")
        return;


    if(!isAdmin(query.from.id))
        return;


    await bot.answerCallbackQuery(
        query.id
    );


    try{

        await bot.deleteMessage(

            query.message.chat.id,

            query.message.message_id

        );

    }

    catch{}


    return showAdminPanel(

        query.message.chat.id

    );


});


// ======================
// UPLOAD ANOTHER FILE
// ======================

bot.on("callback_query", async(query)=>{


    if(query.data !== "admin_upload")
        return;


    if(!isAdmin(query.from.id))
        return;


    uploadWizard.set(

        query.from.id,

        {

            step:1

        }

    );


    await bot.answerCallbackQuery(
        query.id
    );


    return bot.sendMessage(

        query.message.chat.id,

`📤 Upload New File

Select Type`,

        {

            reply_markup:{

                inline_keyboard:[

                    [

                        {

                            text:"🎬 Movie",

                            callback_data:"wizard_movie"

                        }

                    ],

                    [

                        {

                            text:"📺 Series",

                            callback_data:"wizard_series"

                        }

                    ],

                    [

                        {

                            text:"🍥 Anime",

                            callback_data:"wizard_anime"

                        }

                    ]

                ]

            }

        }

    );


});


console.log("✅ PART 4B3C LOADED");
// ===================================================
// CineXClub Bot
// PART 5A
// Start Content Handler
// ===================================================


// ======================
// HANDLE DEEP LINK
// ======================

async function handleDeepLink(chatId, user, contentId){

    try{

        // Force Join Check

        const joined = await checkForceJoin(
            user.id
        );


        if(!joined){

            requestState.set(
                user.id,
                contentId
            );

            return sendForceJoin(chatId);

        }


        return showContentDetails(

            chatId,

            contentId

        );


    }

    catch(err){

        console.log(err);


        const msg = await bot.sendMessage(

            chatId,

            "❌ Something Went Wrong."

        );


        autoDelete(

            chatId,

            msg.message_id

        );

    }

}



// ======================
// SHOW CONTENT DETAILS
// ======================

async function showContentDetails(chatId, contentId){


    const result = await pool.query(

`
SELECT *

FROM contents

WHERE content_id=$1
`,

        [

            contentId

        ]

    );


    if(result.rows.length === 0){


        const msg = await bot.sendMessage(

            chatId,

            "❌ File Not Found."

        );


        return autoDelete(

            chatId,

            msg.message_id

        );


    }


    const content = result.rows[0];


    let text = "";


    if(content.type === "movie"){


        text =

`🎬 <b>${content.title}</b>

📅 Year : ${content.year}

🎥 Quality : Select Below`;


    }

    else{


        text =

`📺 <b>${content.collection}</b>

🎞 Season : ${content.season}

🎬 Episode : ${content.episode}

🎥 Quality : Select Below`;

    }



    const sent = await bot.sendMessage(

        chatId,

        text,

        {

            parse_mode:"HTML",

            reply_markup:{

                inline_keyboard:[

                    [

                        {

                            text:"480p",

                            callback_data:
                            `send_${content.content_id}`

                        },

                        {

                            text:"720p",

                            callback_data:
                            `send_${content.content_id}`

                        }

                    ],

                    [

                        {

                            text:"1080p",

                            callback_data:
                            `send_${content.content_id}`

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


}


console.log("✅ PART 5A LOADED");
// ===================================================
// CineXClub Bot
// PART 5B
// Send Content File
// ===================================================


// ======================
// SEND CONTENT
// ======================

async function sendContent(chatId, contentId){


    try{


        const result = await pool.query(

`
SELECT *

FROM contents

WHERE content_id=$1
`,

        [
            contentId
        ]

        );


        if(result.rows.length === 0){


            const msg = await bot.sendMessage(

                chatId,

                "❌ File Not Found."

            );


            return autoDelete(

                chatId,

                msg.message_id

            );


        }



        const content = result.rows[0];



        // ======================
        // DOWNLOAD COUNT
        // ======================


        await saveDownload(

            chatId,

            contentId

        );



        let caption = "";



        if(content.type === "movie"){


            caption =

`🎬 Here Is Your Movie

<b>${content.title}</b>

📅 Year : ${content.year}

🎥 Quality : ${content.quality}`;


        }

        else if(content.type === "series"){


            caption =

`📺 Here Is Your Series

<b>${content.collection}</b>

🎞 Season : ${content.season}

🎬 Episode : ${content.episode}

🎥 Quality : ${content.quality}`;


        }

        else{


            caption =

`🍥 Here Is Your Anime

<b>${content.collection}</b>

🎞 Season : ${content.season}

🎬 Episode : ${content.episode}

🎥 Quality : ${content.quality}`;


        }




        // ======================
        // SEND VIDEO
        // ======================


        const file = await bot.sendDocument(

            chatId,

            content.file_id,

            {

                caption: caption,

                parse_mode:"HTML"

            }

        );



        autoDelete(

            chatId,

            file.message_id

        );



        // Delete Details Message

        const done = await bot.sendMessage(

            chatId,

            "✅ Enjoy Your Content 🍿"

        );


        autoDelete(

            chatId,

            done.message_id

        );



    }


    catch(err){


        console.log(err);


        const msg = await bot.sendMessage(

            chatId,

            "❌ Unable To Send File."

        );


        autoDelete(

            chatId,

            msg.message_id

        );


    }


}



// ======================
// QUALITY CALLBACK
// ======================

bot.on("callback_query", async(query)=>{


    if(!query.data.startsWith("send_"))

        return;



    const contentId = query.data.replace(

        "send_",

        ""

    );



    await bot.answerCallbackQuery(

        query.id,

        {

            text:"📥 Sending File..."

        }

    );



    return sendContent(

        query.message.chat.id,

        contentId

    );


});



console.log("✅ PART 5B LOADED");
// ===================================================
// CineXClub Bot
// PART 5C
// Thumbnail + Caption System
// ===================================================


// ======================
// DEFAULT THUMBNAIL
// ======================

const DEFAULT_THUMBNAIL = process.env.DEFAULT_THUMBNAIL;


// ======================
// SEND CONTENT WITH THUMBNAIL
// ======================

async function sendContentWithThumbnail(chatId, contentId){

    try{

        const result = await pool.query(

`
SELECT *

FROM contents

WHERE content_id=$1
`,

        [
            contentId
        ]

        );


        if(result.rows.length === 0)
            return;



        const content = result.rows[0];


        let caption = "";



        if(content.type === "Movie"){


caption =
`🎬 <b>${content.title}</b>

📅 Year : ${content.year}

🎥 Quality : ${content.quality}

🍿 Enjoy Your Movie`;



        }

        else if(content.type === "Series"){


caption =
`📺 <b>${content.collection}</b>

🎞 Season : ${content.season}

🎬 Episode : ${content.episode}

🎥 Quality : ${content.quality}

🍿 Enjoy Your Series`;



        }

        else{


caption =
`🍥 <b>${content.collection}</b>

🎞 Season : ${content.season}

🎬 Episode : ${content.episode}

🎥 Quality : ${content.quality}

🍿 Enjoy Your Anime`;



        }



        const options = {

            caption: caption,

            parse_mode:"HTML"

        };



        // Thumbnail Only For Video

        if(DEFAULT_THUMBNAIL){

            options.thumb = DEFAULT_THUMBNAIL;

        }



        const sent = await bot.sendDocument(

            chatId,

            content.file_id,

            options

        );



        autoDelete(

            chatId,

            sent.message_id,

            30

        );



    }

    catch(err){

        console.log(
            "Send Error:",
            err.message
        );

    }

}



// ======================
// AUTO DELETE ARRAY
// ======================

const deleteTimers = new Map();



async function scheduleDelete(chatId,messageId,time=30){


    const key =
    `${chatId}_${messageId}`;



    if(deleteTimers.has(key))
        return;



    const timer = setTimeout(async()=>{


        try{


            await bot.deleteMessage(

                chatId,

                messageId

            );


        }

        catch{}



        deleteTimers.delete(key);



    },

    time * 60 * 1000);



    deleteTimers.set(

        key,

        timer

    );



}



// Replace Old Auto Delete

autoDelete = scheduleDelete;



console.log("✅ PART 5C LOADED");
// ===================================================
// CineXClub Bot
// PART 6A
// Collections System
// ===================================================


// ======================
// GET COLLECTIONS
// ======================

async function getCollections(type){

    const result = await pool.query(

`
SELECT DISTINCT collection

FROM contents

WHERE type=$1

AND collection IS NOT NULL

ORDER BY collection ASC
`,

    [
        type
    ]

    );

    return result.rows;

}


// ======================
// SHOW COLLECTIONS
// ======================

async function showCollections(chatId,type){


    const data = await getCollections(type);


    if(data.length === 0){


        const msg = await bot.sendMessage(

            chatId,

            `❌ No ${type} Available.`

        );


        return autoDelete(

            chatId,

            msg.message_id

        );

    }



    const buttons = [];



    data.forEach(item=>{


        buttons.push([

            {

                text:`📂 ${item.collection}`,

                callback_data:
                `open_collection_${type}_${item.collection}`

            }

        ]);

    });



    buttons.push([

        {

            text:"🏠 Home",

            callback_data:"home"

        }

    ]);



    const sent = await bot.sendMessage(

        chatId,

`📂 Select ${type}

Choose Collection`,

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );



    autoDelete(

        chatId,

        sent.message_id

    );


}



// ======================
// OPEN COLLECTION
// ======================

bot.on("callback_query",async(query)=>{


    if(!query.data.startsWith(
        "open_collection_"
    ))

        return;



    const parts =
    query.data.split("_");



    const type = parts[2];


    const collection =
    parts.slice(3).join("_");



    const result = await pool.query(

`
SELECT *

FROM contents

WHERE type=$1

AND collection=$2

ORDER BY season,episode,year
`,

    [

        type,

        collection

    ]

    );



    const buttons=[];



    result.rows.forEach(item=>{


        buttons.push([


            {

                text:
                `${item.title}`,

                callback_data:
                `quality_${item.content_id}`

            }


        ]);


    });



    buttons.push([

        {

            text:"🔙 Back",

            callback_data:
            `back_${type}`

        },

        {

            text:"🏠 Home",

            callback_data:"home"

        }

    ]);



    await bot.editMessageText(

`📂 ${collection}

Select Episode / Movie`,

    {

        chat_id:
        query.message.chat.id,

        message_id:
        query.message.message_id,

        reply_markup:{

            inline_keyboard:buttons

        }

    }

    );


});



console.log("✅ PART 6A LOADED");
// ===================================================
// CineXClub Bot
// PART 6B
// Season & Episode System
// ===================================================


// ======================
// GET SEASONS
// ======================

async function getSeasons(collection,type){

    const result = await pool.query(

`
SELECT DISTINCT season

FROM contents

WHERE collection=$1

AND type=$2

ORDER BY season ASC
`,

[
collection,
type
]

    );

    return result.rows;

}


// ======================
// SHOW SEASONS
// ======================

async function showSeasons(chatId,type,collection){


    const seasons = await getSeasons(
        collection,
        type
    );


    const buttons=[];


    seasons.forEach(item=>{


        buttons.push([

            {

                text:`📀 Season ${item.season}`,

                callback_data:
                `season_${type}_${collection}_${item.season}`

            }

        ]);

    });



    buttons.push([

        {

            text:"🔙 Back",

            callback_data:
            `back_${type}`

        },

        {

            text:"🏠 Home",

            callback_data:"home"

        }

    ]);



    return bot.sendMessage(

        chatId,

`📺 ${collection}

Select Season`,

{

reply_markup:{

inline_keyboard:buttons

}

}

    );

}



// ======================
// SEASON BUTTON
// ======================

bot.on("callback_query",async(query)=>{


if(!query.data.startsWith("season_"))

return;



const parts=query.data.split("_");

const type=parts[1];

const collection=parts[2];

const season=parts[3];



const result=await pool.query(

`
SELECT *

FROM contents

WHERE type=$1

AND collection=$2

AND season=$3

ORDER BY episode ASC
`,

[
type,
collection,
season
]

);



const buttons=[];



result.rows.forEach(ep=>{


buttons.push([

{

text:
`🎬 Episode ${ep.episode}`,

callback_data:
`quality_${ep.content_id}`

}

]);


});



buttons.push([

{

text:"🔙 Back",

callback_data:
`open_collection_${type}_${collection}`

},

{

text:"🏠 Home",

callback_data:"home"

}

]);



await bot.editMessageText(

`📺 ${collection}

📀 Season ${season}

Select Episode`,

{

chat_id:
query.message.chat.id,

message_id:
query.message.message_id,

reply_markup:{

inline_keyboard:buttons

}

}

);


});



console.log("✅ PART 6B LOADED");
// ===================================================
// CineXClub Bot
// PART 6C
// Search Improvement
// ===================================================


// ======================
// SEARCH DATABASE
// ======================

async function searchContent(keyword){


    const result = await pool.query(

`
SELECT *

FROM contents

WHERE LOWER(title) LIKE LOWER($1)

OR LOWER(collection) LIKE LOWER($1)

ORDER BY year DESC

LIMIT 20
`,

[
`%${keyword}%`
]

    );


    return result.rows;

}



// ======================
// SEARCH HANDLER
// ======================

bot.on("message", async(msg)=>{


    if(!msg.text)
        return;


    const chatId = msg.chat.id;



    if(!searchState.has(chatId))
        return;



    searchState.delete(chatId);



    const keyword = msg.text;



    const results =
    await searchContent(keyword);



    if(results.length === 0){


        const sent =
        await bot.sendMessage(

            chatId,

`❌ "${keyword}" Not Found In Our Database.

You Can Request This Movie / Series / Anime.`,

            {

                reply_markup:{

                    inline_keyboard:[

                    [

                        {

                            text:"📝 Request",

                            callback_data:"request"

                        }

                    ],

                    [

                        {

                            text:"🏠 Home",

                            callback_data:"home"

                        }

                    ]

                    ]

                }

            }

        );


        return autoDelete(
            chatId,
            sent.message_id
        );


    }




    const buttons=[];



    results.forEach(item=>{


        let name="";


        if(item.type==="Movie"){


            name =
            `🎬 ${item.title} (${item.year})`;


        }

        else{


            name =
            `📺 ${item.collection} S${item.season}E${item.episode}`;

        }



        buttons.push([

            {

                text:name,

                callback_data:
                `quality_${item.content_id}`

            }

        ]);


    });



    buttons.push([

        {

            text:"🏠 Home",

            callback_data:"home"

        }

    ]);



    const sent =
    await bot.sendMessage(

        chatId,

`🔎 Search Results For

<b>${keyword}</b>`,

        {

            parse_mode:"HTML",

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );



    autoDelete(
        chatId,
        sent.message_id
    );


});



// ======================
// YEAR FILTER BUTTON
// ======================

async function searchByYear(title){


const result = await pool.query(

`
SELECT *

FROM contents

WHERE title ILIKE $1

ORDER BY year ASC
`,

[
`%${title}%`
]

);


return result.rows;


}



console.log("✅ PART 6C LOADED");
// ===================================================
// CineXClub Bot
// PART 7A
// Admin Request Panel
// ===================================================


// ======================
// SHOW REQUESTS
// ======================

async function showRequests(chatId){


    const result = await pool.query(

`
SELECT *

FROM requests

WHERE status='Pending'

ORDER BY created_at DESC

LIMIT 20
`

    );


    if(result.rows.length === 0){


        return bot.sendMessage(

            chatId,

            "📭 No Pending Requests."

        );


    }



    const buttons=[];



    result.rows.forEach(req=>{


        buttons.push([

            {

                text:`🎬 ${req.request_name}`,

                callback_data:
                `request_view_${req.id}`

            }

        ]);


    });



    buttons.push([

        {

            text:"🏠 Admin Panel",

            callback_data:"admin_home"

        }

    ]);



    return bot.sendMessage(

        chatId,

`📥 Pending Requests

Select Request`,

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );


}



// ======================
// ADMIN REQUEST BUTTON
// ======================

bot.on("callback_query",async(query)=>{


    if(query.data !== "admin_requests")

        return;


    if(!isAdmin(query.from.id))

        return;



    await bot.answerCallbackQuery(query.id);



    return showRequests(

        query.message.chat.id

    );


});



// ======================
// VIEW REQUEST
// ======================

bot.on("callback_query",async(query)=>{


    if(!query.data.startsWith(
        "request_view_"
    ))

        return;



    const id =
    query.data.replace(
        "request_view_",
        ""
    );



    const result = await pool.query(

`
SELECT *

FROM requests

WHERE id=$1
`,

[
id
]

    );



    if(result.rows.length===0)

        return;



    const req=result.rows[0];



    await bot.editMessageText(

`📥 Request Details

👤 User ID:
${req.user_id}

🎬 Request:
${req.request_name}

📌 Status:
${req.status}`,

    {

        chat_id:
        query.message.chat.id,

        message_id:
        query.message.message_id,

        reply_markup:{

            inline_keyboard:[

                [

                    {

                        text:"✅ Accept",

                        callback_data:
                        `accept_request_${req.id}`

                    }

                ],

                [

                    {

                        text:"❌ Reject",

                        callback_data:
                        `reject_request_${req.id}`

                    }

                ],

                [

                    {

                        text:"🔙 Back",

                        callback_data:
                        "admin_requests"

                    }

                ]

            ]

        }

    }

    );


});


console.log("✅ PART 7A LOADED");
// ===================================================
// CineXClub Bot
// PART 7B
// Request Action System
// ===================================================


// ======================
// ACCEPT REQUEST
// ======================

bot.on("callback_query", async(query)=>{


    if(!query.data.startsWith(
        "accept_request_"
    ))

        return;



    if(!isAdmin(query.from.id))
        return;



    const requestId =
    query.data.replace(
        "accept_request_",
        ""
    );



    const result = await pool.query(

`
SELECT *

FROM requests

WHERE id=$1
`,

[
requestId
]

    );



    if(result.rows.length===0)
        return;



    const request=result.rows[0];



    // Update Status

    await pool.query(

`
UPDATE requests

SET status='Accepted'

WHERE id=$1
`,

[
requestId
]

    );



    await bot.answerCallbackQuery(

        query.id,

        {

            text:"✅ Request Accepted"

        }

    );



    // Save user waiting for upload

    requestUploadMode.set(

        query.from.id,

        {

            userId: request.user_id,

            requestId: request.id,

            requestName: request.request_name

        }

    );



    await bot.sendMessage(

        query.message.chat.id,

`✅ Request Accepted

Now Upload:

🎬 ${request.request_name}

After uploading, user will get notification.`

    );


});



// ======================
// REJECT REQUEST
// ======================

bot.on("callback_query", async(query)=>{


    if(!query.data.startsWith(
        "reject_request_"
    ))

        return;



    if(!isAdmin(query.from.id))
        return;



    const requestId =
    query.data.replace(
        "reject_request_",
        ""
    );



    const result = await pool.query(

`
SELECT *

FROM requests

WHERE id=$1
`,

[
requestId
]

    );



    if(result.rows.length===0)
        return;



    const request=result.rows[0];



    await pool.query(

`
UPDATE requests

SET status='Rejected'

WHERE id=$1
`,

[
requestId
]

    );



    // Notify User

    try{


        await bot.sendMessage(

            request.user_id,

`❌ Your Request Was Rejected.

🎬 ${request.request_name}`

        );


    }

    catch{}



    await bot.answerCallbackQuery(

        query.id,

        {

            text:"❌ Request Rejected"

        }

    );



    await bot.editMessageText(

`❌ Request Rejected

${request.request_name}`,

{

chat_id:
query.message.chat.id,

message_id:
query.message.message_id

}

    );


});



console.log("✅ PART 7B LOADED");
// ===================================================
// CineXClub Bot
// PART 8A
// Admin Statistics
// ===================================================


// ======================
// TOTAL CONTENT
// ======================

async function totalContent(type){

    const result = await pool.query(

`
SELECT COUNT(*)

FROM contents

WHERE type=$1
`,

[
type
]

    );

    return Number(
        result.rows[0].count
    );

}


// ======================
// TOTAL USERS
// ======================

async function totalUsers(){

    const result = await pool.query(

`
SELECT COUNT(*)

FROM users
`

    );

    return Number(
        result.rows[0].count
    );

}


// ======================
// TOTAL DOWNLOADS
// ======================

async function totalDownloads(){

    const result = await pool.query(

`
SELECT COUNT(*)

FROM downloads
`

    );

    return Number(
        result.rows[0].count
    );

}



// ======================
// DATABASE STATUS
// ======================

async function databaseStatus(){

    try{

        await pool.query(
            "SELECT NOW()"
        );

        return "🟢 Online";

    }

    catch{

        return "🔴 Offline";

    }

}



// ======================
// ADMIN STATS BUTTON
// ======================

bot.on("callback_query",async(query)=>{


    if(query.data !== "admin_stats")

        return;



    if(!isAdmin(query.from.id))

        return;



    const movies =
    await totalContent("Movie");


    const series =
    await totalContent("Series");


    const anime =
    await totalContent("Anime");


    const users =
    await totalUsers();


    const downloads =
    await totalDownloads();


    const db =
    await databaseStatus();



    await bot.editMessageText(

`📊 CineXClub Statistics

━━━━━━━━━━━━━━

🎬 Movies : ${movies}

📺 Series : ${series}

🍥 Anime : ${anime}

👥 Users : ${users}

📥 Downloads : ${downloads}

💾 Database : ${db}

━━━━━━━━━━━━━━`,

{

chat_id:
query.message.chat.id,

message_id:
query.message.message_id,

reply_markup:{

inline_keyboard:[

[

{

text:"🔙 Back",

callback_data:"admin_home"

}

]

]

}

}

    );


});



console.log("✅ PART 8A LOADED");
// ===================================================
// CineXClub Bot
// PART 8B
// Broadcast + Settings
// ===================================================


// ======================
// BROADCAST START
// ======================

bot.on("callback_query", async(query)=>{


    if(query.data !== "admin_broadcast")

        return;


    if(!isAdmin(query.from.id))

        return;



    broadcastMode.set(

        query.from.id,

        true

    );



    await bot.sendMessage(

        query.message.chat.id,

`📢 Broadcast Mode

Send the message you want to send to all users.`

    );


});



// ======================
// RECEIVE BROADCAST
// ======================

bot.on("message", async(msg)=>{


    if(!isAdmin(msg.from.id))

        return;



    if(!broadcastMode.has(msg.from.id))

        return;



    broadcastMode.delete(
        msg.from.id
    );



    const users = await pool.query(

`
SELECT user_id

FROM users
`

    );



    let sentCount = 0;



    for(const user of users.rows){


        try{


            await bot.copyMessage(

                user.user_id,

                msg.chat.id,

                msg.message_id

            );


            sentCount++;


        }

        catch{

            continue;

        }


    }



    await bot.sendMessage(

        msg.chat.id,

`✅ Broadcast Completed

📨 Sent : ${sentCount} Users`

    );


});




// ======================
// SETTINGS MENU
// ======================

bot.on("callback_query",async(query)=>{


    if(query.data !== "admin_settings")

        return;



    if(!isAdmin(query.from.id))

        return;



    await bot.editMessageText(

`⚙️ Admin Settings

Choose Option`,

{

chat_id:
query.message.chat.id,

message_id:
query.message.message_id,


reply_markup:{

inline_keyboard:[

[

{

text:"🖼 Welcome Image",

callback_data:"change_welcome"

}

],

[

{

text:"📢 Force Join",

callback_data:"force_settings"

}

],

[

{

text:"🔙 Back",

callback_data:"admin_home"

}

]

]

}

}

    );


});



console.log("✅ PART 8B LOADED");
// ===================================================
// CineXClub Bot
// PART 9A
// Content Details Page
// ===================================================


// ======================
// SHOW DETAILS
// ======================

async function showMovieDetails(chatId, contentId){

    const result = await pool.query(

`
SELECT *

FROM contents

WHERE content_id=$1
`,

[
contentId
]

    );


    if(result.rows.length === 0){

        return bot.sendMessage(
            chatId,
            "❌ Content Not Found."
        );

    }


    const content = result.rows[0];


    let details = "";



    if(content.type === "Movie"){


details =
`🎬 <b>${content.title}</b>

📅 Year : ${content.year}

🎥 Quality : ${content.quality}

━━━━━━━━━━━━━━

Select Quality`;



    }


    else if(content.type === "Series"){


details =
`📺 <b>${content.collection}</b>

🎞 Season : ${content.season}

🎬 Episode : ${content.episode}

📅 Year : ${content.year}

━━━━━━━━━━━━━━

Select Quality`;



    }


    else{


details =
`🍥 <b>${content.collection}</b>

🎞 Season : ${content.season}

🎬 Episode : ${content.episode}

📅 Year : ${content.year}

━━━━━━━━━━━━━━

Select Quality`;



    }



    const buttons = [

        [

            {
                text:"480p",
                callback_data:`send_${content.content_id}`
            },

            {
                text:"720p",
                callback_data:`send_${content.content_id}`
            }

        ],

        [

            {
                text:"1080p",
                callback_data:`send_${content.content_id}`
            }

        ],

        [

            {
                text:"🔙 Back",
                callback_data:"home"
            }

        ]

    ];



    const sent = await bot.sendMessage(

        chatId,

        details,

        {

            parse_mode:"HTML",

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );


    autoDelete(
        chatId,
        sent.message_id
    );

}



// ======================
// DOWNLOAD SAVE
// ======================

async function saveDownload(userId,contentId){

    try{

        await pool.query(

`
INSERT INTO downloads(

user_id,
content_id

)

VALUES($1,$2)

`,

[
userId,
contentId
]

        );

    }

    catch(err){

        console.log(
            err.message
        );

    }

}



console.log("✅ PART 9A LOADED");
// ===================================================
// CineXClub Bot
// PART 9B
// Thumbnail + Caption Formatter
// ===================================================


// ======================
// DEFAULT THUMBNAIL
// ======================

const BOT_THUMBNAIL =
process.env.BOT_THUMBNAIL;


// ======================
// FORMAT CAPTION
// ======================

function formatCaption(content){


    let caption = "";



    if(content.type === "Movie"){


        caption =

`🎬 <b>${content.title}</b>

📅 Year : ${content.year}

🎥 Quality : ${content.quality}

🍿 Enjoy Your Movie

⚡ Powered By CineXClub`;



    }


    else if(content.type === "Series"){


        caption =

`📺 <b>${content.collection}</b>

🎞 Season : ${content.season}

🎬 Episode : ${content.episode}

🎥 Quality : ${content.quality}

🍿 Enjoy Your Series

⚡ Powered By CineXClub`;



    }


    else{


        caption =

`🍥 <b>${content.collection}</b>

🎞 Season : ${content.season}

🎬 Episode : ${content.episode}

🎥 Quality : ${content.quality}

🍿 Enjoy Your Anime

⚡ Powered By CineXClub`;



    }



    return caption;

}



// ======================
// VIDEO SEND OPTIONS
// ======================

function getVideoOptions(content){


    const options = {


        caption:
        formatCaption(content),


        parse_mode:"HTML"


    };



    // Add Thumbnail

    if(BOT_THUMBNAIL){


        options.thumb =
        BOT_THUMBNAIL;


    }



    return options;


}



// ======================
// THUMBNAIL TEST
// ======================

bot.onText(
/^\/thumbnail$/,
async(msg)=>{


if(!isAdmin(msg.from.id))
return;


await bot.sendMessage(

msg.chat.id,

`🖼 Thumbnail Status

${BOT_THUMBNAIL ? 
"✅ Thumbnail Added":
"❌ No Thumbnail Set"}`

);


});



console.log("✅ PART 9B LOADED");
// ===================================================
// CineXClub Bot
// PART 10A
// Duplicate Protection System
// ===================================================


// ======================
// CHECK DUPLICATE FILE
// ======================

async function checkDuplicate(fileId){


    const result = await pool.query(

`
SELECT *

FROM contents

WHERE file_id=$1
`,

[
fileId
]

    );


    return result.rows.length > 0;


}



// ======================
// SAFE SAVE CONTENT
// ======================

async function safeSaveContent(data){


    try{


        const exists =
        await checkDuplicate(
            data.fileId
        );



        if(exists){


            return {

                success:false,

                message:
                "❌ File Already Exists"

            };


        }



        const contentId =

        "CX" +

        Date.now().toString(36)

        .toUpperCase();



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

year,

file_id

)

VALUES(

$1,$2,$3,$4,$5,$6,$7,$8,$9

)

`,

[

contentId,

data.title,

data.type,

data.collection || null,

data.season || null,

data.episode || null,

data.quality,

data.year || null,

data.fileId

]

        );



        return {

            success:true,

            contentId

        };


    }

    catch(err){


        console.log(
            "Save Error:",
            err.message
        );


        return {

            success:false,

            message:
            "Database Error"

        };


    }


}



// ======================
// ADMIN DUPLICATE ALERT
// ======================

async function duplicateAlert(chatId){


const msg = await bot.sendMessage(

chatId,

`⚠️ This File Already Exists

No Duplicate Saved.`

);


autoDelete(

chatId,

msg.message_id

);


}



console.log("✅ PART 10A LOADED");
// ===================================================
// CineXClub Bot
// PART 10B
// Database Optimization
// ===================================================


// ======================
// CREATE INDEXES
// ======================

async function createIndexes(){

    try{


        await pool.query(`

CREATE INDEX IF NOT EXISTS

idx_contents_title

ON contents

(LOWER(title));


CREATE INDEX IF NOT EXISTS

idx_contents_collection

ON contents

(LOWER(collection));


CREATE INDEX IF NOT EXISTS

idx_contents_type

ON contents

(type);


CREATE INDEX IF NOT EXISTS

idx_contents_year

ON contents

(year);


CREATE INDEX IF NOT EXISTS

idx_users_id

ON users

(user_id);


        `);



        console.log(
            "✅ Database Indexes Created"
        );


    }

    catch(err){

        console.log(
            "Index Error:",
            err.message
        );

    }

}


createIndexes();



// ======================
// FAST SEARCH
// ======================

async function fastSearch(keyword){


    const result = await pool.query(

`
SELECT *

FROM contents

WHERE

LOWER(title)

LIKE LOWER($1)

OR

LOWER(collection)

LIKE LOWER($1)

ORDER BY id DESC

LIMIT 30

`,

[

`%${keyword}%`

]

    );


    return result.rows;

}



// ======================
// DATABASE CLEAN CHECK
// ======================

async function databaseHealth(){


    try{


        const result = await pool.query(

`
SELECT COUNT(*)

FROM contents

`

        );


        console.log(

"📚 Total Contents :",

result.rows[0].count

        );


    }

    catch(err){


        console.log(
            err.message
        );


    }


}


setInterval(

databaseHealth,

600000

);



console.log("✅ PART 10B LOADED");
// ===================================================
// CineXClub Bot
// PART 11A
// Error Handler + Safe Telegram Actions
// ===================================================


// ======================
// SAFE SEND MESSAGE
// ======================

async function safeSend(chatId,text,options={}){


    try{


        return await bot.sendMessage(

            chatId,

            text,

            options

        );


    }

    catch(err){


        console.log(

            "Send Error:",

            err.message

        );


    }

}



// ======================
// TELEGRAM ERROR HANDLER
// ======================

bot.on("polling_error",(error)=>{


    console.log(

        "Polling Error:",

        error.message

    );


});



// ======================
// GLOBAL ERROR HANDLER
// ======================

process.on(

"uncaughtException",

(error)=>{


    console.log(

        "CRASH ERROR:",

        error.message

    );


});



process.on(

"unhandledRejection",

(error)=>{


    console.log(

        "PROMISE ERROR:",

        error

    );


});




// ======================
// BOT RESTART LOG
// ======================

async function botStatus(){


    console.log(`

━━━━━━━━━━━━━━

🤖 CineXClub Bot

🟢 Online

⏰ ${new Date()}

━━━━━━━━━━━━━━

`);

}


botStatus();



// ======================
// REMOVE OLD POLLING
// ======================

// Prevent 409 Conflict

async function stopOldPolling(){


try{


await bot.stopPolling();


}

catch{}



}



console.log("✅ PART 11A LOADED");
// ===================================================
// CineXClub Bot
// PART 11B
// Security + User Management
// ===================================================


// ======================
// ADMIN CHECK
// ======================

function isAdmin(userId){


    return String(userId) === String(ADMIN_CHAT_ID);


}



// ======================
// SAVE USER SAFE
// ======================

async function safeSaveUser(user){


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

            "User Save Error:",

            err.message

        );


    }


}



// ======================
// AUTO USER SAVE
// ======================

bot.on("message",async(msg)=>{


    if(msg.from){


        await safeSaveUser(

            msg.from

        );


    }


});




// ======================
// BLOCK USER SYSTEM
// ======================

async function blockUser(userId){


    await pool.query(

`
UPDATE users

SET blocked=true

WHERE user_id=$1

`,

[
userId
]

    );


}



// ======================
// CHECK BLOCKED USER
// ======================

async function isBlocked(userId){


    try{


        const result =
        await pool.query(

`
SELECT blocked

FROM users

WHERE user_id=$1

`,

[
userId
]

        );



        if(result.rows.length===0)

            return false;



        return result.rows[0].blocked;


    }

    catch{

        return false;

    }


}



// ======================
// BLOCK CHECK MIDDLEWARE
// ======================

async function checkBlocked(userId){


    return await isBlocked(

        userId

    );


}



console.log("✅ PART 11B LOADED");
// ===================================================
// CineXClub Bot
// PART 12A
// Auto Delete Manager
// ===================================================


// ======================
// DELETE TIMER STORAGE
// ======================

const deleteQueue = new Map();


// ======================
// AUTO DELETE FUNCTION
// ======================

function autoDelete(chatId,messageId,time=30){


    const key =

    `${chatId}_${messageId}`;



    // Prevent duplicate timer

    if(deleteQueue.has(key))

        return;



    const timer = setTimeout(async()=>{


        try{


            await bot.deleteMessage(

                chatId,

                messageId

            );


            console.log(

            "🗑 Deleted:",

            key

            );


        }

        catch(err){


            console.log(

            "Delete Error:",

            err.message

            );


        }



        deleteQueue.delete(key);



    },

    time * 60 * 1000);



    deleteQueue.set(

        key,

        timer

    );


}



// ======================
// SAFE MESSAGE WITH DELETE
// ======================

async function sendTempMessage(

chatId,

text,

options={},

time=30

){


    try{


        const sent =
        await bot.sendMessage(

            chatId,

            text,

            options

        );



        autoDelete(

            chatId,

            sent.message_id,

            time

        );



        return sent;



    }

    catch(err){


        console.log(

            "Temp Message Error:",

            err.message

        );


    }


}



// ======================
// DELETE USER COMMAND
// ======================

bot.onText(

/\/clear/,

async(msg)=>{


if(!isAdmin(msg.from.id))

return;



const sent = await bot.sendMessage(

msg.chat.id,

"🧹 Temporary messages cleared."

);



autoDelete(

msg.chat.id,

sent.message_id

);


});



// ======================
// CLEAN TIMER CHECK
// ======================

setInterval(()=>{


console.log(

"🧹 Active Delete Timers:",

deleteQueue.size

);


},300000);



console.log("✅ PART 12A LOADED");
// ===================================================
// CineXClub Bot
// PART 12B
// Render Keep Alive
// ===================================================


// ======================
// HEALTH ROUTE
// ======================

app.get("/health", (req,res)=>{

    res.status(200).send({

        status:"online",

        bot:"CineXClub",

        time:new Date()

    });

});


// ======================
// KEEP ALIVE PING
// ======================

function keepAlive(){


    setInterval(()=>{


        console.log(

            "🟢 Bot Alive",

            new Date()

        );


    },


    5 * 60 * 1000);


}


keepAlive();


// ======================
// BOT START LOG
// ======================

console.log(`

━━━━━━━━━━━━━━━━━━

🎬 CineXClub Bot

🟢 Running On Render

🌐 Health Endpoint:
/health

━━━━━━━━━━━━━━━━━━

`);


// ======================
// MEMORY CHECK
// ======================

setInterval(()=>{


    const memory =
    process.memoryUsage();


    console.log(

`💾 Memory Usage:

RAM:
${Math.round(memory.rss / 1024 / 1024)} MB`

    );


},600000);



console.log("✅ PART 12B LOADED");
// ===================================================
// CineXClub Bot
// PART 13A
// Security + Environment Check
// ===================================================


// ======================
// ENV CHECK
// ======================

function checkEnvironment(){


    const required = [

        "BOT_TOKEN",

        "DATABASE_URL",

        "BOT_USERNAME",

        "STORAGE_CHANNEL",

        "FORCE_CHANNEL",

        "ADMIN_CHAT_ID"

    ];



    let missing = [];



    required.forEach(key=>{


        if(!process.env[key]){

            missing.push(key);

        }


    });



    if(missing.length > 0){


        console.log(

`❌ Missing Environment Variables:

${missing.join("\n")}`

        );


        process.exit(1);


    }



    console.log(

        "✅ Environment Variables OK"

    );


}


checkEnvironment();




// ======================
// TOKEN PROTECTION
// ======================

if(BOT_TOKEN){


    console.log(

        "🔐 Bot Token Loaded"

    );


}




// ======================
// ADMIN SECURITY
// ======================

function adminOnly(userId){


    if(

        String(userId)

        !==

        String(ADMIN_CHAT_ID)

    ){


        return false;


    }


    return true;


}



// ======================
// USER INPUT CLEAN
// ======================

function cleanText(text){


    if(!text)

        return "";



    return text

    .replace(/[<>]/g,"")

    .trim();

}



// ======================
// LOG FILTER
// ======================

function safeLog(text){


    console.log(

        String(text)

        .replace(

        BOT_TOKEN,

        "HIDDEN_TOKEN"

        )

    );


}



console.log("✅ PART 13A LOADED");
bot.startPolling();
console.log("CineXClub Bot Started");
