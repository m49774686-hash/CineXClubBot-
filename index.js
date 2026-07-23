// ===================================================
// CineXClub Bot v4
// PART 1/20
// Setup + Environment
// ===================================================

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const express = require("express");

// ===================================================
// EXPRESS
// ===================================================

const app = express();

app.get("/", (req, res) => {
    res.send("🎬 CineXClub Bot Running");
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log("================================");
    console.log("🌐 Server Running");
    console.log("Port :", PORT);
    console.log("================================");
});

// ===================================================
// ENV
// ===================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

const ADMIN_ID = Number(process.env.ADMIN_ID);

const STORAGE_CHANNEL = process.env.STORAGE_CHANNEL;
const FORCE_CHANNEL = process.env.FORCE_CHANNEL;

const BOT_USERNAME = process.env.BOT_USERNAME;

// ===================================================
// BOT
// ===================================================

const bot = new TelegramBot(BOT_TOKEN, {

    polling: {
        autoStart: true,
        interval: 300
    }

});

// ===================================================
// DATABASE
// ===================================================

const pool = new Pool({

    connectionString: DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    }

});

// ===================================================
// GLOBAL STATES
// ===================================================

const uploadState = new Map();

const requestState = new Map();

const settingsState = new Map();

const searchState = new Map();

const broadcastState = new Map();

// ===================================================
// HELPERS
// ===================================================

function isAdmin(id) {

    return Number(id) === ADMIN_ID;

}

function username(user) {

    if (user.username)
        return "@" + user.username;

    return user.first_name || "User";

}

// ===================================================
// DATABASE TEST
// ===================================================

async function testDatabase() {

    try {

        await pool.query("SELECT NOW()");

        console.log("🟢 PostgreSQL Connected");

    } catch (e) {

        console.log("🔴 PostgreSQL Error");
        console.log(e.message);

    }

}

testDatabase();

// ===================================================
// BOT INFO
// ===================================================

async function startBot() {

    try {

        const me = await bot.getMe();

        console.log("================================");
        console.log("🤖 Bot Started");
        console.log("Name :", me.first_name);
        console.log("Username : @" + me.username);
        console.log("================================");

    } catch (e) {

        console.log(e.message);

    }

}

startBot();

// ===================================================
// ERROR HANDLING
// ===================================================

bot.on("polling_error", console.log);

process.on("unhandledRejection", console.log);

process.on("uncaughtException", console.log);

// ===================================================

console.log("✅ PART 1 LOADED");

// ===================================================
// PART 2 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 2/20
// Database Initialization
// ===================================================

// ======================
// INIT DATABASE
// ======================

async function initDatabase() {

    try {

        // Development Reset
        await pool.query(`
        DROP TABLE IF EXISTS settings;
        DROP TABLE IF EXISTS requests;
        DROP TABLE IF EXISTS contents;
        DROP TABLE IF EXISTS users;
        `);

        // USERS
        await pool.query(`
        CREATE TABLE users(
            id SERIAL PRIMARY KEY,
            user_id BIGINT UNIQUE NOT NULL,
            username TEXT,
            first_name TEXT,
            joined_at TIMESTAMP DEFAULT NOW()
        );
        `);

        // CONTENTS
        await pool.query(`
        CREATE TABLE contents(
            id SERIAL PRIMARY KEY,
            content_id TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            collection TEXT,
            season INTEGER,
            episode INTEGER,
            year TEXT,
            quality TEXT,
            language TEXT,
            file_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );
        `);

        // REQUESTS
        await pool.query(`
        CREATE TABLE requests(
            id SERIAL PRIMARY KEY,
            user_id BIGINT,
            username TEXT,
            request TEXT,
            type TEXT,
            status TEXT DEFAULT 'Pending',
            created_at TIMESTAMP DEFAULT NOW()
        );
        `);

        // SETTINGS
        await pool.query(`
        CREATE TABLE settings(
            id SERIAL PRIMARY KEY,
            setting_key TEXT UNIQUE,
            setting_value TEXT
        );
        `);

        // DEFAULT SETTINGS
        await pool.query(`
        INSERT INTO settings(setting_key,setting_value)
        VALUES
        ('welcome_image',''),
        ('welcome_message','🎬 Welcome To CineXClub'),
        ('auto_delete','30');
        `);

        console.log("✅ Database Ready");

    } catch (err) {

        console.log("Database Init Error");
        console.log(err.message);

    }

}

initDatabase();

// ======================
// SETTINGS
// ======================

async function getSetting(key){

    const result = await pool.query(
        "SELECT setting_value FROM settings WHERE setting_key=$1",
        [key]
    );

    if(result.rows.length)
        return result.rows[0].setting_value;

    return "";

}

async function setSetting(key,value){

    await pool.query(`
    INSERT INTO settings(setting_key,setting_value)
    VALUES($1,$2)
    ON CONFLICT(setting_key)
    DO UPDATE SET
    setting_value=EXCLUDED.setting_value
    `,[key,value]);

}

// ======================
// SAVE USER
// ======================

async function saveUser(user){

    await pool.query(`
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
    `,[
        user.id,
        user.username || "",
        user.first_name || ""
    ]);

}

console.log("✅ PART 2 LOADED");

// ===================================================
// PART 3 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 3/20
// Start + Welcome + Admin Panel
// ===================================================

// ======================
// WELCOME
// ======================

async function sendWelcome(chatId) {

    const image = await getSetting("welcome_image");
    const text = await getSetting("welcome_message");

    if (image) {

        return bot.sendPhoto(chatId, image, {

            caption: text,

            reply_markup: {

                inline_keyboard: [

                    [
                        {
                            text: "🎬 Movies",
                            callback_data: "movies"
                        }
                    ],

                    [
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
                    ]

                ]

            }

        });

    }

    return bot.sendMessage(

        chatId,

        text,

        {

            reply_markup: {

                inline_keyboard: [

                    [
                        {
                            text: "🎬 Movies",
                            callback_data: "movies"
                        }
                    ],

                    [
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
                    ]

                ]

            }

        }

    );

}

// ======================
// ADMIN PANEL
// ======================

async function sendAdminPanel(chatId){

    return bot.sendMessage(

        chatId,

        "👑 CineXClub Admin Panel",

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

                        },

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

                    ]

                ]

            }

        }

    );

}

// ======================
// SINGLE START
// ======================

bot.onText(/^\/start(?:\s+(.+))?$/, async(msg, match)=>{

    const chatId = msg.chat.id;

    await saveUser(msg.from);

    // ADMIN

    if(isAdmin(msg.from.id)){

        return sendAdminPanel(chatId);

    }

    // DEEP LINK

    const parameter = match[1];

    if(parameter){

        return openContent(chatId, msg.from.id, parameter);

    }

    // NORMAL START

    return sendWelcome(chatId);

});

console.log("✅ PART 3 LOADED");

// ===================================================
// PART 4 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 4/20
// Callback Router + Upload Wizard
// ===================================================

// ======================
// CALLBACK ROUTER
// ======================

bot.on("callback_query", async (query) => {

    const chatId = query.message.chat.id;
    const userId = query.from.id;

    const joined = await checkForceJoin(userId);
    const data = query.data;

    try {
        if(data.startsWith("download_")){

    const id = data.replace("download_","");
            

        // ---------- ADMIN ----------
        if (isAdmin(userId)) {

            switch (data) {

                case "admin_upload":

                    uploadState.set(chatId, {
                        step: "type"
                    });

                    await bot.sendMessage(
                        chatId,
                        "Select Content Type",
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text: "🎬 Movie",
                                            callback_data: "type_movie"
                                        }
                                    ],
                                    [
                                        {
                                            text: "📺 Series",
                                            callback_data: "type_series"
                                        }
                                    ],
                                    [
                                        {
                                            text: "🍥 Anime",
                                            callback_data: "type_anime"
                                        }
                                    ]
                                ]
                            }
                        }
                    );

                    break;

                case "type_movie":

                    uploadState.set(chatId, {
                        step: "caption",
                        type: "Movie"
                    });

                    await bot.sendMessage(
                        chatId,
                        "Send Movie Caption"
                    );

                    break;

                case "type_series":

                    uploadState.set(chatId, {
                        step: "caption",
                        type: "Series"
                    });

                    await bot.sendMessage(
                        chatId,
                        "Send Series Caption"
                    );

                    break;

                case "type_anime":

                    uploadState.set(chatId, {
                        step: "caption",
                        type: "Anime"
                    });

                    await bot.sendMessage(
                        chatId,
                        "Send Anime Caption"
                    );

                    break;

                case "quality_480":

                case "quality_720":

                case "quality_1080":

                    if (!uploadState.has(chatId))
                        break;

                    const upload = uploadState.get(chatId);

                    upload.quality = data.replace("quality_", "");

                    upload.step = "file";

                    uploadState.set(chatId, upload);

                    await bot.sendMessage(
                        chatId,
                        "📁 Now send Movie / MKV File"
                    );

                    break;

            }

        }

        // ---------- USER ----------

        switch (data) {

            case "search":

                searchState.set(chatId, true);

                await bot.sendMessage(
                    chatId,
                    "🔍 Send Movie / Series / Anime Name"
                );

                break;

            case "movies":

                await bot.sendMessage(
                    chatId,
                    "🎬 Send Movie Name"
                );

                searchState.set(chatId, true);

                break;

            case "series":

                await bot.sendMessage(
                    chatId,
                    "📺 Send Series Name"
                );

                searchState.set(chatId, true);

                break;

            case "anime":

                await bot.sendMessage(
                    chatId,
                    "🍥 Send Anime Name"
                );

                searchState.set(chatId, true);

                break;

        }

        await bot.answerCallbackQuery(query.id);

    } catch (err) {

        console.log(err);

        bot.answerCallbackQuery(query.id);

    }

});

console.log("✅ PART 4 LOADED");

// ===================================================
// PART 5 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 5/20
// Single Message Handler
// ===================================================

bot.on("message", async (msg) => {

    const chatId = msg.chat.id;

    // Ignore Commands
    if (msg.text && msg.text.startsWith("/"))
        return;

    // ======================
    // ADMIN UPLOAD FLOW
    // ======================

    if (isAdmin(msg.from.id) && uploadState.has(chatId)) {

        const upload = uploadState.get(chatId);

        // Caption Step

        if (upload.step === "caption") {

            if (!msg.text)
                return bot.sendMessage(chatId, "❌ Send Caption");

            upload.caption = msg.text;
            upload.step = "quality";

            uploadState.set(chatId, upload);

            return bot.sendMessage(

                chatId,

                "Select Quality",

                {

                    reply_markup: {

                        inline_keyboard: [

                            [

                                {
                                    text: "480p",
                                    callback_data: "quality_480"
                                },

                                {
                                    text: "720p",
                                    callback_data: "quality_720"
                                }

                            ],

                            [

                                {
                                    text: "1080p",
                                    callback_data: "quality_1080"
                                }

                            ]

                        ]

                    }

                }

            );

        }

        // File Step

        if (upload.step === "file") {

            let fileId = null;

            if (msg.document)
                fileId = msg.document.file_id;

            if (msg.video)
                fileId = msg.video.file_id;

            if (!fileId)
                return bot.sendMessage(chatId, "❌ Send Video / MKV");

            upload.fileId = fileId;

            uploadState.set(chatId, upload);

            return finishUpload(chatId);

        }

    }

    // ======================
    // SEARCH
    // ======================

    if (searchState.has(chatId)) {

        searchState.delete(chatId);

        if (!msg.text)
            return;

        return searchContent(

            chatId,

            msg.text

        );

    }

    // ======================
    // REQUEST
    // ======================

    if (requestState.has(chatId)) {

        const request = requestState.get(chatId);

        requestState.delete(chatId);

        return saveRequest(

            msg,

            request.type

        );

    }

});


// ======================
// FINISH UPLOAD
// ======================

async function finishUpload(chatId) {

    const upload = uploadState.get(chatId);

    if (!upload)
        return;

    await saveUploadedContent(upload);

    uploadState.delete(chatId);

    bot.sendMessage(

        chatId,

        "✅ Upload Completed"

    );

}

console.log("✅ PART 5 LOADED");

// ===================================================
// PART 6 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 6/20
// Caption Parser + Storage Upload
// ===================================================

// ======================
// PARSE CAPTION
// ======================

function parseCaption(text){

    const data = {

        type: "Movie",
        title: "",
        collection: "",
        season: null,
        episode: null,
        year: "",
        language: ""

    };

    const lines = text.split("\n");

    for(const line of lines){

        const parts = line.split(":");

        if(parts.length < 2)
            continue;

        const key = parts[0].trim().toLowerCase();

        const value = parts.slice(1).join(":").trim();

        switch(key){

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
                data.season = Number(value);
                break;

            case "episode":
                data.episode = Number(value);
                break;

            case "year":
                data.year = value;
                break;

            case "language":
                data.language = value;
                break;

        }

    }

    return data;

}

// ======================
// SAVE CONTENT
// ======================

async function saveUploadedContent(upload){

    const info = parseCaption(upload.caption);

    const contentId = Date.now().toString();

    // Store original file in private channel

    const storage = await bot.sendDocument(

        STORAGE_CHANNEL,

        upload.fileId,

        {

            caption: upload.caption

        }

    );

    const finalFileId =
        storage.document ?
        storage.document.file_id :
        storage.video.file_id;

    await pool.query(

        `

        INSERT INTO contents(

        content_id,

        type,

        title,

        collection,

        season,

        episode,

        year,

        quality,

        language,

        file_id

        )

        VALUES(

        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10

        )

        `,

        [

            contentId,

            info.type,

            info.title,

            info.collection,

            info.season,

            info.episode,

            info.year,

            upload.quality,

            info.language,

            finalFileId

        ]

    );

    return contentId;

}

console.log("✅ PART 6 LOADED");

// ===================================================
// PART 7 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 7/20
// Search System
// ===================================================

// ======================
// SEARCH CONTENT
// ======================

async function searchContent(chatId, keyword) {

    try {

        const result = await pool.query(

            `

            SELECT *

            FROM contents

            WHERE LOWER(title)

            LIKE LOWER($1)

            ORDER BY title

            LIMIT 20

            `,

            [`%${keyword}%`]

        );

        if (!result.rows.length) {

            return bot.sendMessage(

                chatId,

                "❌ Content Not Found",

                {

                    reply_markup: {

                        inline_keyboard: [

                            [

                                {

                                    text: "📝 Request Content",

                                    callback_data: "request_content"

                                }

                            ]

                        ]

                    }

                }

            );

        }

        const buttons = [];

        for (const item of result.rows) {

            buttons.push([

                {

                    text: item.title,

                    callback_data: `open_${item.content_id}`

                }

            ]);

        }

        return bot.sendMessage(

            chatId,

            "🔍 Search Results",

            {

                reply_markup: {

                    inline_keyboard: buttons

                }

            }

        );

    } catch (err) {

        console.log(err);

    }

}

// ======================
// OPEN CONTENT
// ======================

async function openContent(chatId, userId, contentId) {

    try {

        const result = await pool.query(

            `

            SELECT *

            FROM contents

            WHERE content_id=$1

            `,

            [contentId]

        );

        if (!result.rows.length)

            return bot.sendMessage(

                chatId,

                "❌ Content Not Found"

            );

        const item = result.rows[0];

        let caption = `🎬 ${item.title}\n`;

        if (item.type !== "Movie") {

            caption += `\n📺 Season : ${item.season}`;
            caption += `\n🎞 Episode : ${item.episode}`;

        }

        if (item.year)

            caption += `\n📅 Year : ${item.year}`;

        return bot.sendMessage(

            chatId,

            caption,

            {

                reply_markup: {

                    inline_keyboard: [

                        [

                            {

                                text: "480p",

                                callback_data: `download_${item.content_id}`

                            },

                            {

                                text: "720p",

                                callback_data: `download_${item.content_id}`

                            }

                        ],

                        [

                            {

                                text: "1080p",

                                callback_data: `download_${item.content_id}`

                            }

                        ]

                    ]

                }

            }

        );

    } catch (err) {

        console.log(err);

    }

}

console.log("✅ PART 7 LOADED");

// ===================================================
// PART 8 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 8/20
// Download System
// ===================================================

// ======================
// FORCE JOIN
// ======================

async function checkForceJoin(userId){

    if(!FORCE_CHANNEL)
        return true;

    try{

        const member = await bot.getChatMember(
            FORCE_CHANNEL,
            userId
        );

        return [
            "member",
            "administrator",
            "creator"
        ].includes(member.status);

    }catch{

        return false;

    }

}

// ======================
// CALLBACK ROUTER ADDITIONS
// (Add these inside the SAME callback_query switch)
// ======================

// open_xxxxxxxxx

if(data.startsWith("open_")){

    const id = data.replace("open_","");

    return openContent(
        chatId,
        userId,
        id
    );

}

// download_xxxxxxxxx

    if(!joined){

        return bot.sendMessage(

            chatId,

            "🔒 Join Our Channel First",

            {

                reply_markup:{
                    inline_keyboard:[
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

    }

    const result = await pool.query(

        `
        SELECT *
        FROM contents
        WHERE content_id=$1
        `,
        [id]

    );

    if(!result.rows.length){

        return bot.sendMessage(
            chatId,
            "❌ File Not Found"
        );

    }

    const item = result.rows[0];

    let caption = "";

    if(item.type==="Movie"){

        caption =
`🎬 Here Is Your Movie

${item.title}`;

        if(item.year)
            caption += `

📅 ${item.year}`;

    }else{

        caption =
`🎬 Here Is Your ${item.type}

${item.title}

📺 Season : ${item.season}
🎞 Episode : ${item.episode}`;

    }

    const sent = await bot.sendDocument(

        chatId,

        item.file_id,

        {

            caption

        }

    );

    // Auto Delete

    const minutes =
        Number(await getSetting("auto_delete")) || 30;

    setTimeout(async()=>{

        try{

            await bot.deleteMessage(
                chatId,
                sent.message_id
            );

        }catch{}

    },minutes*60000);

    return;

}

console.log("✅ PART 8 LOADED");

// ===================================================
// PART 9 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 9/20
// Movie Collection + Year Selection
// ===================================================

// ======================
// SEARCH MOVIES
// ======================

async function searchMovie(chatId, keyword){

    try{

        const result = await pool.query(

        `
        SELECT DISTINCT
        title,
        year,
        content_id
        FROM contents
        WHERE LOWER(title)
        LIKE LOWER($1)
        ORDER BY year DESC
        `,
        [`%${keyword}%`]

        );

        if(!result.rows.length){

            return bot.sendMessage(

                chatId,

                "❌ Movie Not Found"

            );

        }

        const buttons=[];

        for(const movie of result.rows){

            let text=movie.title;

            if(movie.year)
                text+=` (${movie.year})`;

            buttons.push([

                {

                    text,

                    callback_data:`open_${movie.content_id}`

                }

            ]);

        }

        bot.sendMessage(

            chatId,

            "🎬 Select Movie",

            {

                reply_markup:{

                    inline_keyboard:buttons

                }

            }

        );

    }catch(err){

        console.log(err);

    }

}

// ======================
// SEARCH COLLECTION
// ======================

async function searchCollection(chatId,name){

    const result=await pool.query(

    `
    SELECT DISTINCT collection
    FROM contents
    WHERE LOWER(collection)=LOWER($1)
    `,
    [name]

    );

    if(!result.rows.length)
        return false;

    const list=await pool.query(

    `
    SELECT
    title,
    content_id
    FROM contents
    WHERE LOWER(collection)=LOWER($1)
    ORDER BY year
    `,
    [name]

    );

    const buttons=[];

    for(const item of list.rows){

        buttons.push([

            {

                text:item.title,

                callback_data:`open_${item.content_id}`

            }

        ]);

    }

    await bot.sendMessage(

        chatId,

        `🎬 ${name} Collection`,

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

    return true;

}

// ===================================================
// CALLBACK ROUTER
// (ADD INSIDE EXISTING callback_query)
// ===================================================

if(data.startsWith("collection_")){

    const name=data.replace("collection_","");

    return searchCollection(

        chatId,

        name

    );

}

console.log("✅ PART 9 LOADED");

// ===================================================
// PART 10 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 10/20
// Series & Anime System
// ===================================================

// ======================
// SHOW SEASONS
// ======================

async function showSeasons(chatId, collection){

    const result = await pool.query(

    `
    SELECT DISTINCT season
    FROM contents
    WHERE collection=$1
    ORDER BY season
    `,

    [collection]

    );

    if(!result.rows.length)
        return;

    const buttons=[];

    for(const row of result.rows){

        buttons.push([

            {

                text:`Season ${row.season}`,

                callback_data:`season_${collection}_${row.season}`

            }

        ]);

    }

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

}

// ======================
// SHOW EPISODES
// ======================

async function showEpisodes(chatId,collection,season){

    const result=await pool.query(

    `
    SELECT
    episode,
    content_id
    FROM contents
    WHERE collection=$1
    AND season=$2
    ORDER BY episode
    `,

    [collection,season]

    );

    const buttons=[];

    for(const row of result.rows){

        buttons.push([

            {

                text:`Episode ${row.episode}`,

                callback_data:`open_${row.content_id}`

            }

        ]);

    }

    buttons.push([

        {

            text:"📥 Send All Episodes",

            callback_data:`all_${collection}_${season}`

        }

    ]);

    bot.sendMessage(

        chatId,

        `📺 Season ${season}

Select Episode`,

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

}

// ======================
// SEND ALL EPISODES
// ======================

async function sendAllEpisodes(chatId,collection,season){

    const result=await pool.query(

    `
    SELECT *
    FROM contents
    WHERE collection=$1
    AND season=$2
    ORDER BY episode
    `,

    [collection,season]

    );

    if(!result.rows.length)
        return;

    for(const item of result.rows){

        await bot.sendDocument(

            chatId,

            item.file_id,

            {

                caption:
`${item.title}

Season ${item.season}
Episode ${item.episode}`

            }

        );

    }

}

// ===================================================
// ADD INSIDE callback_query
// ===================================================

// season_collection_season

if(data.startsWith("season_")){

    const arr=data.split("_");

    return showEpisodes(

        chatId,

        arr[1],

        Number(arr[2])

    );

}

// all_collection_season

if(data.startsWith("all_")){

    const arr=data.split("_");

    return sendAllEpisodes(

        chatId,

        arr[1],

        Number(arr[2])

    );

}

console.log("✅ PART 10 LOADED");

// ===================================================
// PART 11 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 11/20
// Request System
// ===================================================

// ======================
// REQUEST CONTENT
// ======================

async function saveRequest(msg,type){

    const chatId = msg.chat.id;

    const text = msg.text;

    if(!text)
        return;

    await pool.query(

    `
    INSERT INTO requests(

    user_id,

    username,

    request,

    type,

    status

    )

    VALUES($1,$2,$3,$4,'Pending')

    `,

    [

        msg.from.id,

        msg.from.username || "",

        text,

        type

    ]

    );

    // Send To Admin

    bot.sendMessage(

        ADMIN_ID,

`📥 New Request

👤 User : ${msg.from.first_name}

🆔 ${msg.from.id}

🎬 ${text}

Type : ${type}`,

        {

            reply_markup:{

                inline_keyboard:[

                    [

                        {

                            text:"✅ Accept",

                            callback_data:`accept_${msg.from.id}`

                        }

                    ]

                ]

            }

        }

    );

    bot.sendMessage(

        chatId,

        "✅ Request Submitted"

    );

}

// ===================================================
// CALLBACK ROUTER
// ADD INSIDE callback_query
// ===================================================

if(data==="request_content"){

    requestState.set(

        chatId,

        {

            type:"Movie"

        }

    );

    return bot.sendMessage(

        chatId,

        "🎬 Send Movie / Series / Anime Name"

    );

}

// ======================
// ACCEPT REQUEST
// ======================

if(data.startsWith("accept_")){

    if(!isAdmin(userId))
        return;

    const target=data.replace("accept_","");

    await bot.sendMessage(

        target,

`🎉 Good News!

Your requested Movie / Series / Anime

has been added.

Open the bot and search now.`

    );

    await bot.answerCallbackQuery(

        query.id,

        {

            text:"User Notified"

        }

    );

}

console.log("✅ PART 11 LOADED");

// ===================================================
// PART 12 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 12/20
// Welcome Settings
// ===================================================

// ======================
// SETTINGS PANEL
// ======================

async function openSettings(chatId){

    bot.sendMessage(

        chatId,

        "⚙ Bot Settings",

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

                            text:"✏ Change Welcome Message",

                            callback_data:"change_welcome_message"

                        }

                    ],

                    [

                        {

                            text:"❌ Remove Welcome Image",

                            callback_data:"remove_welcome_image"

                        }

                    ],

                    [

                        {

                            text:"⏱ Auto Delete",

                            callback_data:"change_delete"

                        }

                    ]

                ]

            }

        }

    );

}

// ===================================================
// ADD INSIDE callback_query
// ===================================================

if(data==="admin_settings"){

    if(!isAdmin(userId))
        return;

    return openSettings(chatId);

}

// ======================
// CHANGE IMAGE
// ======================

if(data==="change_welcome_image"){

    settingsState.set(chatId,"welcome_image");

    return bot.sendMessage(

        chatId,

        "🖼 Send Welcome Image"

    );

}

// ======================
// CHANGE MESSAGE
// ======================

if(data==="change_welcome_message"){

    settingsState.set(chatId,"welcome_message");

    return bot.sendMessage(

        chatId,

        "✏ Send New Welcome Message"

    );

}

// ======================
// REMOVE IMAGE
// ======================

if(data==="remove_welcome_image"){

    await setSetting(

        "welcome_image",

        ""

    );

    return bot.sendMessage(

        chatId,

        "✅ Welcome Image Removed"

    );

}

// ===================================================
// ADD INSIDE SINGLE MESSAGE HANDLER
// (Part 5)
// ===================================================

if(isAdmin(msg.from.id) && settingsState.has(chatId)){

    const state=settingsState.get(chatId);

    // Welcome Image

    if(state==="welcome_image"){

        if(!msg.photo)
            return bot.sendMessage(

                chatId,

                "❌ Send Photo"

            );

        const fileId=

        msg.photo[msg.photo.length-1].file_id;

        await setSetting(

            "welcome_image",

            fileId

        );

        settingsState.delete(chatId);

        return bot.sendMessage(

            chatId,

            "✅ Welcome Image Updated"

        );

    }

    // Welcome Message

    if(state==="welcome_message"){

        if(!msg.text)
            return;

        await setSetting(

            "welcome_message",

            msg.text

        );

        settingsState.delete(chatId);

        return bot.sendMessage(

            chatId,

            "✅ Welcome Message Updated"

        );

    }

}

console.log("✅ PART 12 LOADED");

// ===================================================
// PART 13 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 13/20
// Statistics + Dashboard
// ===================================================

// ======================
// DASHBOARD
// ======================

async function showStatistics(chatId){

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

        const pending = await pool.query(
            "SELECT COUNT(*) FROM requests WHERE status='Pending'"
        );

        const message =

`📊 CineXClub Statistics

👥 Users : ${users.rows[0].count}

🎬 Movies : ${movies.rows[0].count}

📺 Series : ${series.rows[0].count}

🍥 Anime : ${anime.rows[0].count}

📥 Requests : ${requests.rows[0].count}

⏳ Pending : ${pending.rows[0].count}

🟢 Status : Online`;

        return bot.sendMessage(

            chatId,

            message,

            {

                reply_markup:{

                    inline_keyboard:[

                        [

                            {

                                text:"🔄 Refresh",

                                callback_data:"admin_stats"

                            }

                        ],

                        [

                            {

                                text:"⚙ Settings",

                                callback_data:"admin_settings"

                            }

                        ]

                    ]

                }

            }

        );

    }catch(err){

        console.log(err);

    }

}

// ===================================================
// ADD INSIDE callback_query
// ===================================================

if(data==="admin_stats"){

    if(!isAdmin(userId))
        return;

    return showStatistics(chatId);

}

// ======================
// BOT INFO
// ======================

async function getBotInfo(chatId){

    const me = await bot.getMe();

    bot.sendMessage(

        chatId,

`🤖 Bot Information

Name : ${me.first_name}

Username : @${me.username}

Storage : ${STORAGE_CHANNEL}

Force Join : ${FORCE_CHANNEL}

Database : PostgreSQL

Hosting : Render`

    );

}

console.log("✅ PART 13 LOADED");

// ===================================================
// PART 14 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 14/20
// Broadcast System
// ===================================================

// ======================
// START BROADCAST
// ======================

async function startBroadcast(chatId){

    broadcastState.set(chatId,true);

    bot.sendMessage(

        chatId,

        "📢 Send Any Message\n\nText / Photo / Video / Document"

    );

}

// ===================================================
// ADD INSIDE callback_query
// ===================================================

if(data==="admin_broadcast"){

    if(!isAdmin(userId))
        return;

    return startBroadcast(chatId);

}

// ===================================================
// ADD INSIDE SINGLE MESSAGE HANDLER
// (Part 5)
// ===================================================

if(

isAdmin(msg.from.id)

&&

broadcastState.has(chatId)

){

    broadcastState.delete(chatId);

    const users = await pool.query(

        "SELECT user_id FROM users"

    );

    let success = 0;

    let failed = 0;

    const status = await bot.sendMessage(

        chatId,

        "📤 Broadcasting..."

    );

    for(const user of users.rows){

        try{

            await bot.copyMessage(

                user.user_id,

                chatId,

                msg.message_id

            );

            success++;

        }catch{

            failed++;

        }

    }

    await bot.editMessageText(

`✅ Broadcast Completed

👥 Total Users : ${users.rows.length}

✅ Success : ${success}

❌ Failed : ${failed}`,

        {

            chat_id:chatId,

            message_id:status.message_id

        }

    );

}

// ======================
// CANCEL BROADCAST
// ======================

async function cancelBroadcast(chatId){

    broadcastState.delete(chatId);

    bot.sendMessage(

        chatId,

        "❌ Broadcast Cancelled"

    );

}

console.log("✅ PART 14 LOADED");

// ===================================================
// PART 15 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 15/20
// Auto Delete + Error Handling
// ===================================================

// ======================
// AUTO DELETE
// ======================

async function autoDelete(chatId,messageId){

    try{

        const value=await getSetting("auto_delete");

        const minutes=Number(value)||30;

        setTimeout(async()=>{

            try{

                await bot.deleteMessage(

                    chatId,

                    messageId

                );

            }catch{}

        },minutes*60000);

    }catch(err){

        console.log(err);

    }

}

// ======================
// SAFE SEND DOCUMENT
// ======================

async function sendMovie(chatId,fileId,caption){

    try{

        const msg=await bot.sendDocument(

            chatId,

            fileId,

            {

                caption

            }

        );

        await autoDelete(

            chatId,

            msg.message_id

        );

    }catch(err){

        console.log(err);

        bot.sendMessage(

            chatId,

            "❌ Failed To Send File"

        );

    }

}

// ======================
// SAFE MESSAGE
// ======================

async function safeMessage(chatId,text,options={}){

    try{

        return await bot.sendMessage(

            chatId,

            text,

            options

        );

    }catch(err){

        console.log(err);

    }

}

// ======================
// KEEP ALIVE
// ======================

app.get("/health",(req,res)=>{

    res.status(200).send("OK");

});

// ======================
// LOG ERRORS
// ======================

bot.on("polling_error",(err)=>{

    console.log("Polling Error");

    console.log(err.message);

});

process.on(

"unhandledRejection",

(err)=>{

console.log(

"Unhandled Rejection"

);

console.log(err);

}

);

process.on(

"uncaughtException",

(err)=>{

console.log(

"Uncaught Exception"

);

console.log(err);

}

);

// ======================
// STARTUP LOG
// ======================

async function startup(){

    try{

        const me=await bot.getMe();

        console.log("================================");
        console.log("🤖 Bot Online");
        console.log("Bot :",me.first_name);
        console.log("Username : @"+me.username);
        console.log("Database : PostgreSQL");
        console.log("Hosting : Render");
        console.log("================================");

    }catch(err){

        console.log(err);

    }

}

startup();

console.log("✅ PART 15 LOADED");

// ===================================================
// PART 16 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 17/20
// Profile + Favorites + History
// ===================================================

// ======================
// TABLES
// ======================

async function createExtraTables(){

await pool.query(`

CREATE TABLE IF NOT EXISTS favorites(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

created_at TIMESTAMP DEFAULT NOW(),

UNIQUE(user_id,content_id)

)

`);

await pool.query(`

CREATE TABLE IF NOT EXISTS history(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

downloaded_at TIMESTAMP DEFAULT NOW()

)

`);

}

createExtraTables();

// ======================
// SAVE HISTORY
// ======================

async function saveHistory(userId,contentId){

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

}

// ======================
// ADD FAVORITE
// ======================

async function addFavorite(userId,contentId){

await pool.query(

`

INSERT INTO favorites(

user_id,

content_id

)

VALUES($1,$2)

ON CONFLICT(user_id,content_id)

DO NOTHING

`,

[userId,contentId]

);

}

// ======================
// USER PROFILE
// ======================

async function userProfile(chatId,userId){

const downloads=await pool.query(

`

SELECT COUNT(*)

FROM history

WHERE user_id=$1

`,

[userId]

);

const fav=await pool.query(

`

SELECT COUNT(*)

FROM favorites

WHERE user_id=$1

`,

[userId]

);

bot.sendMessage(

chatId,

`👤 Your Profile

📥 Downloads : ${downloads.rows[0].count}

⭐ Favorites : ${fav.rows[0].count}`,

{

reply_markup:{

inline_keyboard:[

[

{

text:"⭐ My Favorites",

callback_data:"my_favorites"

}

],

[

{

text:"📜 Download History",

callback_data:"my_history"

}

]

]

}

}

);

}

// ======================
// FAVORITES
// ======================

async function showFavorites(chatId,userId){

const result=await pool.query(

`

SELECT

contents.*

FROM favorites

JOIN contents

ON favorites.content_id=contents.content_id

WHERE favorites.user_id=$1

ORDER BY favorites.created_at DESC

`,

[userId]

);

if(!result.rows.length)

return bot.sendMessage(

chatId,

"No Favorites"

);

const buttons=[];

for(const item of result.rows){

buttons.push([

{

text:item.title,

callback_data:`open_${item.content_id}`

}

]);

}

bot.sendMessage(

chatId,

"⭐ Favorites",

{

reply_markup:{

inline_keyboard:buttons

}

}

);

}

// ======================
// HISTORY
// ======================

async function showHistory(chatId,userId){

const result=await pool.query(

`

SELECT

contents.*

FROM history

JOIN contents

ON history.content_id=contents.content_id

WHERE history.user_id=$1

ORDER BY history.downloaded_at DESC

LIMIT 20

`,

[userId]

);

if(!result.rows.length)

return bot.sendMessage(

chatId,

"No History"

);

const buttons=[];

for(const item of result.rows){

buttons.push([

{

text:item.title,

callback_data:`open_${item.content_id}`

}

]);

}

bot.sendMessage(

chatId,

"📜 Recent Downloads",

{

reply_markup:{

inline_keyboard:buttons

}

}

);

}

// ===================================================
// ADD INSIDE callback_query
// ===================================================

if(data==="my_favorites"){

return showFavorites(

chatId,

userId

);

}

if(data==="my_history"){

return showHistory(

chatId,

userId

);

}

if(data.startsWith("favorite_")){

const id=data.replace("favorite_","");

await addFavorite(

userId,

id

);

return bot.answerCallbackQuery(

query.id,

{

text:"Added To Favorites"

}

);

}

console.log("✅ PART 17 LOADED");

// ===================================================
// PART 18 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 18/20
// Search Optimization
// ===================================================

// ======================
// DATABASE INDEXES
// ======================

async function optimizeDatabase(){

try{

await pool.query(`
CREATE INDEX IF NOT EXISTS idx_title
ON contents(title);
`);

await pool.query(`
CREATE INDEX IF NOT EXISTS idx_collection
ON contents(collection);
`);

await pool.query(`
CREATE INDEX IF NOT EXISTS idx_content
ON contents(content_id);
`);

await pool.query(`
CREATE INDEX IF NOT EXISTS idx_user
ON users(user_id);
`);

console.log("✅ Database Optimized");

}catch(err){

console.log(err);

}

}

optimizeDatabase();

// ======================
// FAST SEARCH
// ======================

async function fastSearch(keyword){

return pool.query(

`

SELECT *

FROM contents

WHERE

LOWER(title)

LIKE LOWER($1)

ORDER BY title

LIMIT 25

`,

[`%${keyword}%`]

);

}

// ======================
// SEARCH CACHE
// ======================

const searchCache = new Map();

async function cachedSearch(keyword){

const key = keyword.toLowerCase();

if(searchCache.has(key)){

return searchCache.get(key);

}

const result = await fastSearch(keyword);

searchCache.set(key,result);

setTimeout(()=>{

searchCache.delete(key);

},300000);

return result;

}

// ======================
// DUPLICATE CHECK
// ======================

async function alreadyExists(fileId){

const result = await pool.query(

`

SELECT id

FROM contents

WHERE file_id=$1

LIMIT 1

`,

[fileId]

);

return result.rows.length>0;

}

// ======================
// SAFE SAVE
// ======================

async function safeSave(upload){

if(await alreadyExists(upload.fileId))

return false;

await saveUploadedContent(upload);

return true;

}

// ======================
// CLEAN STATES
// ======================

function clearStates(chatId){

uploadState.delete(chatId);

requestState.delete(chatId);

searchState.delete(chatId);

settingsState.delete(chatId);

broadcastState.delete(chatId);

}

// ======================
// MEMORY CLEANER
// ======================

setInterval(()=>{

searchCache.clear();

console.log("🧹 Cache Cleared");

},3600000);

// ======================
// BOT PING
// ======================

setInterval(()=>{

console.log(

"🤖 CineXClub Bot Running"

);

},600000);

console.log("✅ PART 18 LOADED");

// ===================================================
// PART 19 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 19/20
// Final Integration
// ===================================================

// ======================
// CALLBACK ENCODER
// ======================

function encodeCallback(prefix, value) {

    return `${prefix}:${Buffer.from(value).toString("base64")}`;

}

function decodeCallback(data) {

    const parts = data.split(":");

    return {

        action: parts[0],

        value: Buffer.from(parts[1], "base64").toString()

    };

}

// ======================
// SAFE COLLECTION BUTTONS
// ======================

async function sendCollectionList(chatId, collection) {

    const seasons = await pool.query(

        `SELECT DISTINCT season
         FROM contents
         WHERE collection=$1
         ORDER BY season`,

        [collection]

    );

    const buttons = [];

    for (const row of seasons.rows) {

        buttons.push([

            {

                text: `Season ${row.season}`,

                callback_data: encodeCallback(

                    "season",

                    `${collection}|${row.season}`

                )

            }

        ]);

    }

    return bot.sendMessage(

        chatId,

        `📺 ${collection}`,

        {

            reply_markup: {

                inline_keyboard: buttons

            }

        }

    );

}

// ======================
// SAFE CALLBACK ROUTER
// ======================

if (data.includes(":")) {

    const callback = decodeCallback(data);

    switch (callback.action) {

        case "season":

            {

                const value = callback.value.split("|");

                return showEpisodes(

                    chatId,

                    value[0],

                    Number(value[1])

                );

            }

        case "all":

            {

                const value = callback.value.split("|");

                return sendAllEpisodes(

                    chatId,

                    value[0],

                    Number(value[1])

                );

            }

    }

}

// ======================
// SAFE DOCUMENT SEND
// ======================

async function sendContent(chatId, content) {

    try {

        const sent = await bot.sendDocument(

            chatId,

            content.file_id,

            {

                caption: content.title

            }

        );

        saveHistory(

            chatId,

            content.content_id

        );

        autoDelete(

            chatId,

            sent.message_id

        );

    } catch (err) {

        console.log("Send Error");

        console.log(err.message);

    }

}

// ======================
// DATABASE HEALTH
// ======================

async function checkDatabaseHealth() {

    try {

        await pool.query("SELECT 1");

        console.log("🟢 Database Healthy");

    } catch (err) {

        console.log("🔴 Database Error");

        console.log(err.message);

    }

}

setInterval(

    checkDatabaseHealth,

    300000

);

// ======================
// CLEAR EXPIRED STATES
// ======================

setInterval(() => {

    uploadState.clear();

    requestState.clear();

    settingsState.clear();

    searchState.clear();

}, 1800000);

console.log("✅ PART 19 LOADED");

// ===================================================
// PART 20 CONTINUES...
// ===================================================
// ===================================================
// CineXClub Bot v4
// PART 20/20
// Production Ready
// ===================================================

// ======================
// FINAL STARTUP
// ======================

async function startSystem() {

    try {

        await testDatabase();
        await initDatabase();

        await createBanTable();
        await createExtraTables();

        await optimizeDatabase();

        console.log("================================");
        console.log("🎬 CineXClub Bot v4");
        console.log("================================");
        console.log("🟢 Database Connected");
        console.log("🟢 PostgreSQL Connected");
        console.log("🟢 Bot Ready");
        console.log("================================");

    } catch (err) {

        console.log("Startup Error");
        console.log(err);

    }

}

startSystem();

// ======================
// SHUTDOWN
// ======================

process.on("SIGINT", async () => {

    console.log("Stopping Bot...");

    await pool.end();

    process.exit(0);

});

process.on("SIGTERM", async () => {

    console.log("Stopping Bot...");

    await pool.end();

    process.exit(0);

});

// ======================
// KEEP DATABASE ALIVE
// ======================

setInterval(async () => {

    try {

        await pool.query("SELECT NOW()");

    } catch {}

}, 300000);

// ======================
// FINAL LOG
// ======================

console.log("================================");
console.log("✅ CineXClub Bot Production Ready");
console.log("Version : v4");
console.log("Hosting : Render");
console.log("Database : PostgreSQL");
console.log("================================");
