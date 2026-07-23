// ===================================================
// CineXClub Bot v2
// PART 1/30
// Setup + Environment + Server + Bot
// ===================================================

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const express = require("express");

// ===================================================
// ENVIRONMENT
// ===================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME;

const DATABASE_URL = process.env.DATABASE_URL;

const STORAGE_CHANNEL = process.env.STORAGE_CHANNEL;
const FORCE_CHANNEL = process.env.FORCE_CHANNEL;

const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;

// ===================================================
// EXPRESS SERVER
// ===================================================

const app = express();

app.get("/", (req, res) => {
    res.send("🎬 CineXClub Bot Running...");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log("================================");
    console.log("🌐 Server Running");
    console.log("Port :", PORT);
    console.log("================================");

});

// ===================================================
// TELEGRAM BOT
// ===================================================

const bot = new TelegramBot(BOT_TOKEN, {

    polling: {

        autoStart: true,

        interval: 300,

        params: {

            timeout: 10

        }

    }

});

// ===================================================
// POSTGRESQL
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

const searchState = new Map();

const requestState = new Map();

const settingsState = new Map();

const broadcastState = new Map();

const replaceState = new Map();

// ===================================================
// ADMIN CHECK
// ===================================================

function isAdmin(userId){

    return Number(userId) === ADMIN_CHAT_ID;

}

// ===================================================
// USERNAME
// ===================================================

function getUsername(user){

    if(user.username){

        return "@" + user.username;

    }

    return user.first_name || "User";

}

// ===================================================
// AUTO DELETE
// ===================================================

async function autoDelete(chatId,messageId,time=1800000){

    setTimeout(async()=>{

        try{

            await bot.deleteMessage(chatId,messageId);

        }catch(err){}

    },time);

}

// ===================================================
// STARTUP LOG
// ===================================================

bot.getMe()

.then(me=>{

    console.log("================================");
    console.log("🤖 Bot Started");
    console.log("Name :",me.first_name);
    console.log("Username : @"+me.username);
    console.log("Admin :",ADMIN_USERNAME);
    console.log("================================");

})

.catch(err=>{

    console.log(err.message);

});

console.log("✅ PART 1 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 2/30
// PostgreSQL Database + Tables + Helpers
// ===================================================

// ===================================================
// DATABASE INITIALIZATION
// ===================================================

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

year TEXT,

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
CREATE TABLE IF NOT EXISTS settings(

id SERIAL PRIMARY KEY,

setting_key TEXT UNIQUE NOT NULL,

setting_value TEXT

);

INSERT INTO settings(setting_key,setting_value)
VALUES
('auto_delete','30'),
('welcome_image',''),
('welcome_message','')
ON CONFLICT(setting_key)
DO NOTHING;

CREATE TABLE IF NOT EXISTS requests(

id SERIAL PRIMARY KEY,

user_id BIGINT,

username TEXT,

type TEXT,

request TEXT,

status TEXT DEFAULT 'Pending',

content_id TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

CREATE TABLE IF NOT EXISTS downloads(

id SERIAL PRIMARY KEY,

user_id BIGINT,

content_id TEXT,

downloaded_at TIMESTAMP DEFAULT NOW()

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

watched_at TIMESTAMP DEFAULT NOW()

);

CREATE TABLE IF NOT EXISTS settings(

setting_key TEXT PRIMARY KEY,

setting_value TEXT

);

`);

        console.log("✅ Database Ready");

    } catch (err) {

        console.log("Database Error:", err.message);

    }

}

initDatabase();

// ===================================================
// SAVE USER
// ===================================================

async function saveUser(user) {

    try {

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

    } catch (err) {

        console.log(err.message);

    }

}

// ===================================================
// SETTINGS HELPERS
// ===================================================

async function getSetting(key) {

    const result = await pool.query(

        `
SELECT setting_value
FROM settings
WHERE setting_key=$1
`,

        [key]

    );

    if (result.rows.length === 0)
        return null;

    return result.rows[0].setting_value;

}

async function setSetting(key, value) {

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
`,

        [key, value]

    );

}

// ===================================================
// DATABASE STATUS
// ===================================================

async function databaseStatus() {

    try {

        await pool.query("SELECT NOW()");

        return true;

    } catch {

        return false;

    }

}

// ===================================================
// STARTUP DEFAULT SETTINGS
// ===================================================

(async () => {

    if (!await getSetting("welcome_message")) {

        await setSetting(

            "welcome_message",

            "👋 Welcome to CineXClub"

        );

    }

    if (!await getSetting("auto_delete")) {

        await setSetting(

            "auto_delete",

            "30"

        );

    }

})();

console.log("✅ PART 2 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 3/30
// Welcome Screen + Start Command
// ===================================================

// ======================
// HOME BUTTONS
// ======================

function homeButtons(){

    return{

        inline_keyboard:[

            [
                {
                    text:"🎬 Movies",
                    callback_data:"movies"
                },
                {
                    text:"📺 Series",
                    callback_data:"series"
                }
            ],

            [
                {
                    text:"🍥 Anime",
                    callback_data:"anime"
                }
            ],

            [
                {
                    text:"🔍 Search",
                    callback_data:"search"
                }
            ],

            [
                {
                    text:"🎬 Request Movie / Series / Anime",
                    callback_data:"request"
                }
            ]

        ]

    };

}

// ======================
// START COMMAND
// ======================

bot.onText(/\/start(?:\s+(.+))?/,async(msg,match)=>{

    const chatId=msg.chat.id;

    await saveUser(msg.from);

    // ===================
    // ADMIN PANEL
    // ===================

    if(isAdmin(msg.from.id)){

        return bot.sendMessage(

            chatId,

`👑 CineXClub Admin Panel

Choose an option.`,

            {

                reply_markup:{

                    inline_keyboard:[

                        [
                            {
                                text:"📤 Upload File",
                                callback_data:"upload"
                            }
                        ],

                        [
                            {
                                text:"📊 Statistics",
                                callback_data:"stats"
                            },
                            {
                                text:"📨 Requests",
                                callback_data:"requests"
                            }
                        ],

                        [
                            {
                                text:"📢 Broadcast",
                                callback_data:"broadcast"
                            }
                        ],

                        [
                            {
                                text:"⚙ Settings",
                                callback_data:"settings"
                            }
                        ]

                    ]

                }

            }

        );

    }

    // ===================
    // DEEP LINK
    // ===================

    if(match[1]){

        return handleDeepLink(

            chatId,

            msg.from,

            match[1]

        );

    }

    // ===================
    // WELCOME MESSAGE
    // ===================

    const welcomeMessage=

        await getSetting("welcome_message")

        ||

        "👋 Welcome to CineXClub";

    const welcomeImage=

        await getSetting("welcome_image");

    // IMAGE ENABLED

    if(welcomeImage){

        const sent=

        await bot.sendPhoto(

            chatId,

            welcomeImage,

            {

                caption:welcomeMessage,

                reply_markup:{

                    inline_keyboard:[

                        [

                            {

                                text:"➡ Continue",

                                callback_data:"continue_home"

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

        return;

    }

    // WITHOUT IMAGE

    const sent=

    await bot.sendMessage(

        chatId,

        welcomeMessage,

        {

            reply_markup:{

                inline_keyboard:[

                    [

                        {

                            text:"➡ Continue",

                            callback_data:"continue_home"

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

});

// ======================
// CONTINUE BUTTON
// ======================

bot.on("callback_query",async(query)=>{

    if(query.data!=="continue_home")
        return;

    const sent=

    await bot.sendMessage(

        query.message.chat.id,

`🎬 CineXClub

Choose Category`,

        {

            reply_markup:homeButtons()

        }

    );

    autoDelete(

        query.message.chat.id,

        sent.message_id

    );

});

console.log("✅ PART 3 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 4/30
// Force Join + Deep Link
// ===================================================

// ======================
// FORCE JOIN CHECK
// ======================

async function checkForceJoin(userId){

    try{

        const member = await bot.getChatMember(
            FORCE_CHANNEL,
            userId
        );

        return [

            "creator",

            "administrator",

            "member"

        ].includes(member.status);

    }catch(err){

        return false;

    }

}

// ======================
// HANDLE DEEP LINK
// ======================

async function handleDeepLink(chatId,user,contentId){

    const joined = await checkForceJoin(user.id);

    if(!joined){

        return bot.sendMessage(

            chatId,

            "⚠️ Join our updates channel to continue.",

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

                                callback_data:`recheck_${contentId}`

                            }

                        ]

                    ]

                }

            }

        );

    }

    return sendContent(

        chatId,

        contentId

    );

}

// ======================
// RECHECK JOIN
// ======================

bot.on("callback_query",async(query)=>{

    if(!query.data.startsWith("recheck_"))
        return;

    const contentId = query.data.replace(

        "recheck_",

        ""

    );

    const joined = await checkForceJoin(

        query.from.id

    );

    if(!joined){

        return bot.answerCallbackQuery(

            query.id,

            {

                text:"❌ Join channel first.",

                show_alert:true

            }

        );

    }

    try{

        await bot.deleteMessage(

            query.message.chat.id,

            query.message.message_id

        );

    }catch(err){}

    return sendContent(

        query.message.chat.id,

        contentId

    );

});

console.log("✅ PART 4 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 5/30
// User Home Menu
// ===================================================

// ======================
// HOME MENU
// ======================

async function showHome(chatId){

    const sent = await bot.sendMessage(

        chatId,

`🏠 <b>CineXClub</b>

Choose your category below.`,

        {

            parse_mode:"HTML",

            reply_markup:{

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

                            text:"🔍 Search",

                            callback_data:"menu_search"

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

                            text:"📺 Request Series",

                            callback_data:"request_series"

                        }

                    ],

                    [

                        {

                            text:"🍥 Request Anime",

                            callback_data:"request_anime"

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

// ======================
// CALLBACK MENU
// ======================

bot.on("callback_query",async(query)=>{

    const chatId=query.message.chat.id;

    switch(query.data){

        case "menu_movies":

            return showMovieCollections(chatId);

        case "menu_series":

            return showSeriesCollections(chatId);

        case "menu_anime":

            return showAnimeCollections(chatId);

        case "menu_search":

            searchState.set(chatId,true);

            return bot.sendMessage(

                chatId,

                "🔍 Send Movie / Series / Anime Name"

            );

        case "request_movie":

            requestState.set(chatId,"Movie");

            return bot.sendMessage(

                chatId,

                "🎬 Send Movie Name"

            );

        case "request_series":

            requestState.set(chatId,"Series");

            return bot.sendMessage(

                chatId,

                "📺 Send Series Name"

            );

        case "request_anime":

            requestState.set(chatId,"Anime");

            return bot.sendMessage(

                chatId,

                "🍥 Send Anime Name"

            );

    }

});

console.log("✅ PART 5 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 6/30
// Movie Collections
// ===================================================

// ======================
// SHOW MOVIE COLLECTIONS
// ======================

async function showMovieCollections(chatId){

    try{

        const result = await pool.query(

        `
        SELECT DISTINCT collection

        FROM contents

        WHERE type='Movie'

        ORDER BY collection ASC
        `

        );

        if(result.rows.length===0){

            const sent=await bot.sendMessage(

                chatId,

                "❌ No Movie Collections Found."

            );

            autoDelete(chatId,sent.message_id);

            return;

        }

        const buttons=[];

        result.rows.forEach(row=>{

            buttons.push([

                {

                    text:"🎬 "+row.collection,

                    callback_data:"movie_collection_"+row.collection

                }

            ]);

        });

        buttons.push([

            {

                text:"🏠 Home",

                callback_data:"home"

            }

        ]);

        const sent=await bot.sendMessage(

            chatId,

            "🎬 Select Movie Collection",

            {

                reply_markup:{

                    inline_keyboard:buttons

                }

            }

        );

        autoDelete(chatId,sent.message_id);

    }catch(err){

        console.log(err.message);

    }

}

// ======================
// MOVIES INSIDE COLLECTION
// ======================

bot.on("callback_query",async(query)=>{

    if(!query.data.startsWith("movie_collection_"))
        return;

    const chatId=query.message.chat.id;

    const collection=query.data.replace(

        "movie_collection_",

        ""

    );

    const result=await pool.query(

    `
    SELECT

    content_id,
    title,
    year

    FROM contents

    WHERE

    type='Movie'

    AND

    collection=$1

    ORDER BY year ASC
    `,

    [collection]

    );

    const buttons=[];

    result.rows.forEach(movie=>{

        buttons.push([

            {

                text:`🎬 ${movie.title} (${movie.year})`,

                callback_data:`movie_${movie.content_id}`

            }

        ]);

    });

    buttons.push([

        {

            text:"🔙 Back",

            callback_data:"menu_movies"

        }

    ]);

    const sent=await bot.sendMessage(

        chatId,

        `🎬 ${collection}`,

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

});

// ======================
// HOME BUTTON
// ======================

bot.on("callback_query",async(query)=>{

    if(query.data!=="home")
        return;

    showHome(

        query.message.chat.id

    );

});

console.log("✅ PART 6 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 7/30
// Series Collections + Seasons
// ===================================================

// ======================
// SHOW SERIES COLLECTIONS
// ======================

async function showSeriesCollections(chatId){

    try{

        const result = await pool.query(

        `
        SELECT DISTINCT collection

        FROM contents

        WHERE type='Series'

        ORDER BY collection ASC
        `

        );

        if(result.rows.length===0){

            const sent = await bot.sendMessage(

                chatId,

                "❌ No Series Available."

            );

            autoDelete(chatId,sent.message_id);

            return;

        }

        const buttons=[];

        result.rows.forEach(row=>{

            buttons.push([

                {

                    text:"📺 "+row.collection,

                    callback_data:"series_collection_"+row.collection

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

            "📺 Select Series",

            {

                reply_markup:{

                    inline_keyboard:buttons

                }

            }

        );

        autoDelete(chatId,sent.message_id);

    }catch(err){

        console.log(err.message);

    }

}

// ======================
// SHOW SEASONS
// ======================

bot.on("callback_query",async(query)=>{

    if(!query.data.startsWith("series_collection_"))
        return;

    const chatId=query.message.chat.id;

    const collection=query.data.replace(

        "series_collection_",

        ""

    );

    const result=await pool.query(

    `
    SELECT DISTINCT season

    FROM contents

    WHERE

    type='Series'

    AND

    collection=$1

    ORDER BY season ASC
    `,

    [collection]

    );

    const buttons=[];

    result.rows.forEach(row=>{

        buttons.push([

            {

                text:`📀 Season ${row.season}`,

                callback_data:`season_${collection}_${row.season}`

            }

        ]);

    });

    buttons.push([

        {

            text:"🔙 Back",

            callback_data:"menu_series"

        }

    ]);

    const sent=await bot.sendMessage(

        chatId,

        `📺 ${collection}

Select Season`,

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

    autoDelete(chatId,sent.message_id);

});

console.log("✅ PART 7 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 8/30
// Anime Collections + Seasons + Episodes
// ===================================================

// ======================
// SHOW ANIME COLLECTIONS
// ======================

async function showAnimeCollections(chatId){

    try{

        const result = await pool.query(

        `
        SELECT DISTINCT collection

        FROM contents

        WHERE type='Anime'

        ORDER BY collection ASC
        `

        );

        if(result.rows.length===0){

            const sent = await bot.sendMessage(

                chatId,

                "❌ No Anime Available."

            );

            autoDelete(chatId,sent.message_id);

            return;

        }

        const buttons=[];

        result.rows.forEach(row=>{

            buttons.push([

                {

                    text:"🍥 "+row.collection,

                    callback_data:"anime_collection_"+row.collection

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

            "🍥 Select Anime",

            {

                reply_markup:{

                    inline_keyboard:buttons

                }

            }

        );

        autoDelete(chatId,sent.message_id);

    }catch(err){

        console.log(err.message);

    }

}

// ======================
// SHOW SEASONS
// ======================

bot.on("callback_query",async(query)=>{

    if(!query.data.startsWith("anime_collection_"))
        return;

    const chatId=query.message.chat.id;

    const collection=query.data.replace(

        "anime_collection_",

        ""

    );

    const result=await pool.query(

    `
    SELECT DISTINCT season

    FROM contents

    WHERE

    type='Anime'

    AND

    collection=$1

    ORDER BY season ASC
    `,

    [collection]

    );

    const buttons=[];

    result.rows.forEach(row=>{

        buttons.push([

            {

                text:`📀 Season ${row.season}`,

                callback_data:`anime_season_${collection}_${row.season}`

            }

        ]);

    });

    buttons.push([

        {

            text:"🔙 Back",

            callback_data:"menu_anime"

        }

    ]);

    const sent=await bot.sendMessage(

        chatId,

        `🍥 ${collection}

Select Season`,

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

    autoDelete(chatId,sent.message_id);

});

// ======================
// SHOW EPISODES
// ======================

bot.on("callback_query",async(query)=>{

    if(!query.data.startsWith("anime_season_"))
        return;

    const chatId=query.message.chat.id;

    const parts=query.data.split("_");

    const collection=parts[2];

    const season=parts[3];

    const result=await pool.query(

    `
    SELECT

    content_id,
    episode

    FROM contents

    WHERE

    type='Anime'

    AND

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

    const buttons=[];

    result.rows.forEach(row=>{

        buttons.push([

            {

                text:`🎬 Episode ${row.episode}`,

                callback_data:`anime_episode_${row.content_id}`

            }

        ]);

    });

    buttons.push([

        {

            text:"🔙 Back",

            callback_data:"anime_collection_"+collection

        }

    ]);

    const sent=await bot.sendMessage(

        chatId,

        `🍥 ${collection}

Season ${season}

Select Episode`,

        {

            reply_markup:{

                inline_keyboard:buttons

            }

        }

    );

    autoDelete(chatId,sent.message_id);

});

console.log("✅ PART 8 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 9/30
// Search System
// ===================================================

// ======================
// SEARCH MESSAGE
// ======================

bot.on("message", async (msg) => {

    const chatId = msg.chat.id;

    if (!msg.text)
        return;

    // ===================
    // SEARCH MODE
    // ===================

    if (!searchState.has(chatId))
        return;

    searchState.delete(chatId);

    const keyword = msg.text.trim();

    const result = await pool.query(

        `
        SELECT
            content_id,
            title,
            year,
            type
        FROM contents
        WHERE
        LOWER(title)
        LIKE LOWER($1)
        ORDER BY year ASC
        LIMIT 20
        `,

        [`%${keyword}%`]

    );

    // ===================
    // NOT FOUND
    // ===================

    if (result.rows.length === 0) {

        const sent = await bot.sendMessage(

            chatId,

            `❌ ${keyword} Not Found In Our Database.`,

            {

                reply_markup: {

                    inline_keyboard: [

                        [

                            {

                                text: "🎬 Request Movie",

                                callback_data: "request_movie"

                            }

                        ],

                        [

                            {

                                text: "📺 Request Series",

                                callback_data: "request_series"

                            }

                        ],

                        [

                            {

                                text: "🍥 Request Anime",

                                callback_data: "request_anime"

                            }

                        ]

                    ]

                }

            }

        );

        autoDelete(chatId, sent.message_id);

        return;

    }

    // ===================
    // SEARCH RESULT
    // ===================

    const buttons = [];

    result.rows.forEach(item => {

        buttons.push([

            {

                text: `${item.title} (${item.year})`,

                callback_data: `content_${item.content_id}`

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

        "🔍 Search Results",

        {

            reply_markup: {

                inline_keyboard: buttons

            }

        }

    );

    autoDelete(chatId, sent.message_id);

});

// ======================
// CONTENT SELECT
// ======================

bot.on("callback_query", async (query) => {

    if (!query.data.startsWith("content_"))
        return;

    const chatId = query.message.chat.id;

    const contentId = query.data.replace(

        "content_",

        ""

    );

    const buttons = [

        [

            {

                text: "480p",

                callback_data: `quality_480_${contentId}`

            },

            {

                text: "720p",

                callback_data: `quality_720_${contentId}`

            },

            {

                text: "1080p",

                callback_data: `quality_1080_${contentId}`

            }

        ],

        [

            {

                text: "🔙 Back",

                callback_data: "menu_search"

            }

        ]

    ];

    const sent = await bot.sendMessage(

        chatId,

        "🎥 Select Quality",

        {

            reply_markup: {

                inline_keyboard: buttons

            }

        }

    );

    autoDelete(chatId, sent.message_id);

});

console.log("✅ PART 9 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 10/30
// Episode + Quality Selection
// ===================================================

// ======================
// SERIES EPISODES
// ======================

bot.on("callback_query", async (query) => {

    if (!query.data.startsWith("season_"))
        return;

    const chatId = query.message.chat.id;

    const parts = query.data.split("_");

    const collection = parts[1];

    const season = parts[2];

    const result = await pool.query(

        `
        SELECT

        content_id,
        title,
        episode

        FROM contents

        WHERE

        type='Series'

        AND

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

    const buttons = [];

    result.rows.forEach(item => {

        buttons.push([

            {

                text: `🎬 Episode ${item.episode}`,

                callback_data: `content_${item.content_id}`

            }

        ]);

    });

    buttons.push([

        {

            text: "🔙 Back",

            callback_data: "menu_series"

        }

    ]);

    const sent = await bot.sendMessage(

        chatId,

        `📺 ${collection}

Season ${season}

Select Episode`,

        {

            reply_markup: {

                inline_keyboard: buttons

            }

        }

    );

    autoDelete(chatId, sent.message_id);

});

// ======================
// QUALITY BUTTONS
// ======================

bot.on("callback_query", async (query) => {

    if (!query.data.startsWith("quality_"))
        return;

    const chatId = query.message.chat.id;

    const parts = query.data.split("_");

    const quality = parts[1];

    const contentId = parts[2];

    const sent = await bot.sendMessage(

        chatId,

        `⏳ Fetching ${quality}...`

    );

    autoDelete(

        chatId,

        sent.message_id,

        5000

    );

    // File Sender
    // Part 11 lo complete chestam

    await sendContent(

        chatId,

        contentId

    );

});

console.log("✅ PART 10 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 11/30
// File Sender + Auto Delete
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
// SEND CONTENT
// ======================

async function sendContent(chatId,contentId,userId=null){

    try{

        const result=await pool.query(

        `
        SELECT *

        FROM contents

        WHERE

        content_id=$1
        `,

        [

            contentId

        ]

        );

        if(result.rows.length===0){

            const sent=

            await bot.sendMessage(

                chatId,

                "❌ Content Not Found."

            );

            autoDelete(

                chatId,

                sent.message_id

            );

            return;

        }

        const movie=result.rows[0];

        // ===================
        // SEND FILE
        // ===================

        const file=

        await bot.sendDocument(

            chatId,

            movie.file_id

        );

        // ===================
        // DETAILS MESSAGE
        // ===================

        let text="";

        if(movie.type==="Movie"){

            text=

`✅ Here Is Your Movie

🎬 ${movie.title}

📅 ${movie.year}

🗑 This message and file will be deleted in 30 minutes.`;

        }

        if(movie.type==="Series"){

            text=

`✅ Here Is Your Series

📺 ${movie.collection}

🎞 Season ${movie.season} • Episode ${movie.episode}

🗑 This message and file will be deleted in 30 minutes.`;

        }

        if(movie.type==="Anime"){

            text=

`✅ Here Is Your Anime

🍥 ${movie.collection}

🎞 Season ${movie.season} • Episode ${movie.episode}

🗑 This message and file will be deleted in 30 minutes.`;

        }

        const info=

        await bot.sendMessage(

            chatId,

            text

        );

        // ===================
        // SAVE DOWNLOAD
        // ===================

        if(userId){

            await saveDownload(

                userId,

                contentId

            );

        }

        // ===================
        // AUTO DELETE
        // ===================

        autoDelete(

            chatId,

            file.message_id

        );

        autoDelete(

            chatId,

            info.message_id

        );

    }catch(err){

        console.log(err.message);

    }

}

console.log("✅ PART 11 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 12/30
// Request System
// ===================================================

// ======================
// REQUEST MESSAGE
// ======================

bot.on("message", async (msg) => {

    const chatId = msg.chat.id;

    if (!msg.text)
        return;

    if (!requestState.has(chatId))
        return;

    const type = requestState.get(chatId);

    requestState.delete(chatId);

    const request = msg.text.trim();

    try {

        await pool.query(

            `
            INSERT INTO requests(

            user_id,
            username,
            type,
            request

            )

            VALUES($1,$2,$3,$4)
            `,

            [

                msg.from.id,

                msg.from.username || "",

                type,

                request

            ]

        );

        // ======================
        // USER SUCCESS
        // ======================

        const sent = await bot.sendMessage(

            chatId,

`✅ Your request has been submitted.

📂 Type : ${type}

📝 ${request}

Please wait until Admin uploads it.`

        );

        autoDelete(chatId, sent.message_id);

        // ======================
        // ADMIN NOTIFICATION
        // ======================

        await bot.sendMessage(

            ADMIN_CHAT_ID,

`📥 New Request

👤 User : ${getUsername(msg.from)}

🆔 ${msg.from.id}

📂 Type : ${type}

📝 ${request}`,

            {

                reply_markup: {

                    inline_keyboard: [

                        [

                            {

                                text: "📤 Upload",

                                callback_data: `upload_request_${msg.from.id}`

                            }

                        ],

                        [

                            {

                                text: "❌ Reject",

                                callback_data: `reject_request_${msg.from.id}`

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
// REQUEST CALLBACKS
// ======================

bot.on("callback_query", async (query) => {

    // Upload Button

    if (query.data.startsWith("upload_request_")) {

        const userId = query.data.replace(

            "upload_request_",

            ""

        );

        uploadState.set(

            query.from.id,

            {

                notifyUser: userId

            }

        );

        return bot.sendMessage(

            query.message.chat.id,

`📤 Upload Wizard Started

Select Type

🎬 Movie
📺 Series
🍥 Anime`

        );

    }

    // Reject Button

    if (query.data.startsWith("reject_request_")) {

        const userId = query.data.replace(

            "reject_request_",

            ""

        );

        try {

            await bot.sendMessage(

                userId,

`❌ Sorry.

Your requested content is currently unavailable.`

            );

        } catch {}

        return bot.editMessageText(

            "❌ Request Rejected",

            {

                chat_id: query.message.chat.id,

                message_id: query.message.message_id

            }

        );

    }

});

console.log("✅ PART 12 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 13/30
// Request Completed Notification
// ===================================================


// ======================
// UPDATE REQUEST STATUS
// ======================

async function completeRequest(userId, contentId){

    try{

        await pool.query(

        `
        UPDATE requests

        SET

        status='Completed',

        content_id=$2

        WHERE

        user_id=$1

        AND

        status='Pending'
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
// NOTIFY USER
// ======================

async function notifyRequestedUser(

    userId,

    contentId,

    title,

    type

){

    try{


        const link =

        `https://t.me/${BOT_USERNAME}?start=${contentId}`;


        let text="";


        if(type==="Movie"){

            text=

`🎉 Your requested Movie has been added!

🎬 ${title}

Click below to watch.`;


        }


        if(type==="Series"){

            text=

`🎉 Your requested Series has been added!

📺 ${title}

Click below to watch.`;

        }


        if(type==="Anime"){

            text=

`🎉 Your requested Anime has been added!

🍥 ${title}

Click below to watch.`;

        }



        await bot.sendMessage(

            userId,

            text,

            {

                reply_markup:{

                    inline_keyboard:[

                        [

                            {

                                text:"▶️ Watch Now",

                                url:link

                            }

                        ]

                    ]

                }

            }

        );


    }catch(err){

        console.log(

            "Notify Error:",

            err.message

        );

    }

}


// ======================
// ADMIN NOTIFY BUTTON
// ======================

bot.on("callback_query",async(query)=>{


    if(

        !query.data.startsWith(

            "notify_user_"

        )

    )

    return;



    const parts=query.data.split("_");


    const userId=parts[2];

    const contentId=parts[3];



    const result=await pool.query(

    `

    SELECT

    title,

    type

    FROM contents

    WHERE content_id=$1

    `,

    [

        contentId

    ]

    );



    if(result.rows.length===0)

    return;



    const content=result.rows[0];



    await notifyRequestedUser(

        userId,

        contentId,

        content.title,

        content.type

    );



    await completeRequest(

        userId,

        contentId

    );



    await bot.answerCallbackQuery(

        query.id,

        {

            text:"✅ User Notified"

        }

    );


    await bot.editMessageText(

`✅ Request Completed

👤 User Notified

🎬 ${content.title}`,

    {

        chat_id:query.message.chat.id,

        message_id:query.message.message_id

    }

    );


});


console.log("✅ PART 13 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 14/30
// Admin Dashboard
// ===================================================


// ======================
// ADMIN PANEL
// ======================

async function showAdminPanel(chatId){

    const sent = await bot.sendMessage(

        chatId,

`👑 <b>CineXClub Admin Panel</b>

Choose an option below.`,

        {

            parse_mode:"HTML",

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

                        },

                        {

                            text:"📨 Requests",

                            callback_data:"admin_requests"

                        }

                    ],

                    [

                        {

                            text:"👥 Users",

                            callback_data:"admin_users"

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

                            text:"🏠 User Panel",

                            callback_data:"continue_home"

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


// ======================
// ADMIN CALLBACKS
// ======================

bot.on("callback_query",async(query)=>{


    const chatId=query.message.chat.id;


    if(!isAdmin(query.from.id))
        return;



    if(query.data==="admin_upload"){


        uploadState.set(

            chatId,

            {

                step:"type"

            }

        );


        return bot.sendMessage(

            chatId,

`📤 Upload Wizard Started

Select Content Type`,

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



    if(query.data==="admin_stats"){


        const contents=

        await pool.query(

            "SELECT COUNT(*) FROM contents"

        );


        const users=

        await pool.query(

            "SELECT COUNT(*) FROM users"

        );


        const downloads=

        await pool.query(

            "SELECT COUNT(*) FROM downloads"

        );


        return bot.sendMessage(

            chatId,

`📊 Statistics

🎬 Total Files : ${contents.rows[0].count}

👥 Users : ${users.rows[0].count}

⬇️ Downloads : ${downloads.rows[0].count}`

        );


    }



    if(query.data==="admin_users"){


        const result=

        await pool.query(

            "SELECT COUNT(*) FROM users"

        );


        return bot.sendMessage(

            chatId,

`👥 Total Users

${result.rows[0].count}`

        );


    }



    if(query.data==="admin_requests"){


        const result=

        await pool.query(

        `

        SELECT *

        FROM requests

        WHERE status='Pending'

        ORDER BY id DESC

        LIMIT 10

        `

        );


        if(result.rows.length===0)

        return bot.sendMessage(

            chatId,

            "✅ No Pending Requests"

        );



        let text="📨 Pending Requests\n\n";


        result.rows.forEach((r,i)=>{

            text +=

`${i+1}. ${r.request}
Type: ${r.type}

`;

        });


        return bot.sendMessage(

            chatId,

            text

        );


    }


    if(query.data==="admin_settings"){


        return bot.sendMessage(

            chatId,

`⚙ Settings Panel

Coming Next...`

        );


    }


});

console.log("✅ PART 14 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 15/30
// Admin Upload Wizard
// ===================================================


// ======================
// UPLOAD TYPE SELECT
// ======================

bot.on("callback_query", async(query)=>{

    const chatId = query.message.chat.id;


    if(!isAdmin(query.from.id))
        return;


    if(

        ![
            "upload_movie",
            "upload_series",
            "upload_anime"

        ].includes(query.data)

    )
    return;



    let type="";


    if(query.data==="upload_movie")
        type="Movie";


    if(query.data==="upload_series")
        type="Series";


    if(query.data==="upload_anime")
        type="Anime";



    uploadState.set(chatId,{

        step:"caption",

        type:type

    });



    await bot.sendMessage(

        chatId,

`✅ Type Selected : ${type}

📝 Now send caption details.

Example:

Title: Deadpool

Collection: Deadpool

Year: 2024

Language: English`

    );


});


// ======================
// CAPTION RECEIVE
// ======================

bot.on("message",async(msg)=>{


    const chatId=msg.chat.id;


    if(!isAdmin(msg.from.id))
        return;


    if(!uploadState.has(chatId))
        return;



    const data=uploadState.get(chatId);



    if(data.step==="caption"){


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

                                callback_data:"quality_select_480"

                            },

                            {

                                text:"720p",

                                callback_data:"quality_select_720"

                            }

                        ],

                        [

                            {

                                text:"1080p",

                                callback_data:"quality_select_1080"

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

bot.on("callback_query",async(query)=>{


    const chatId=query.message.chat.id;


    if(!isAdmin(query.from.id))
        return;



    if(

        !query.data.startsWith(

            "quality_select_"

        )

    )
    return;



    const quality=query.data.replace(

        "quality_select_",

        ""

    );



    const data=uploadState.get(chatId);



    data.quality=quality;

    data.step="file";



    uploadState.set(

        chatId,

        data

    );



    await bot.sendMessage(

        chatId,

`✅ Quality : ${quality}

📤 Now send your video file.`

    );


});


// ======================
// FILE RECEIVE PLACEHOLDER
// ======================
// File handling Part 17 lo complete chestam


console.log("✅ PART 15 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 16/30
// Caption Parser
// ===================================================


// ======================
// PARSE CAPTION
// ======================

function parseCaption(caption,type){

    const data={

        title:"",
        collection:"",
        year:"",
        language:"",
        season:null,
        episode:null

    };


    if(!caption)
        return data;



    const lines = caption.split("\n");


    lines.forEach(line=>{


        const parts=line.split(":");


        if(parts.length < 2)
            return;



        const key = parts[0]

        .trim()

        .toLowerCase();


        const value = parts.slice(1)

        .join(":")

        .trim();



        switch(key){


            case "title":

                data.title=value;

            break;



            case "collection":

                data.collection=value;

            break;



            case "year":

                data.year=value;

            break;



            case "language":

                data.language=value;

            break;



            case "season":

                data.season=parseInt(value);

            break;



            case "episode":

                data.episode=parseInt(value);

            break;


        }


    });



    // ======================
    // AUTO COLLECTION
    // ======================

    if(!data.collection){

        data.collection=data.title;

    }



    return data;

}



// ======================
// CREATE CONTENT ID
// ======================

function createContentId(title){

    return title

    .toLowerCase()

    .replace(/[^a-z0-9]+/g,"_")

    .replace(/^_+|_+$/g,"")

    +

    "_" +

    Date.now();

}



// ======================
// TEST LOG
// ======================

console.log("✅ Caption Parser Ready");

console.log("✅ PART 16 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 17/30
// File Receive + Storage Channel
// ===================================================


// ======================
// VIDEO / DOCUMENT RECEIVE
// ======================

bot.on("message", async (msg)=>{


    const chatId = msg.chat.id;


    if(!isAdmin(msg.from.id))
        return;


    if(!uploadState.has(chatId))
        return;


    const data = uploadState.get(chatId);


    if(data.step !== "file")
        return;



    let fileId = null;



    // ======================
    // VIDEO FILE
    // ======================

    if(msg.video){

        fileId = msg.video.file_id;

    }


    // ======================
    // DOCUMENT (MKV)
    // ======================

    if(msg.document){

        fileId = msg.document.file_id;

    }



    if(!fileId){

        return bot.sendMessage(

            chatId,

            "❌ Please send video or document file."

        );

    }



    try{


        // ======================
        // SEND TO STORAGE CHANNEL
        // ======================

        const storageMsg = await bot.sendDocument(

            STORAGE_CHANNEL,

            fileId,

            {

                caption: msg.caption || data.caption || ""

            }

        );



        const savedFileId =

        storageMsg.document

        ?

        storageMsg.document.file_id

        :

        storageMsg.video.file_id;



        data.file_id = savedFileId;



        data.storage_message_id =

        storageMsg.message_id;



        data.step="save";



        uploadState.set(

            chatId,

            data

        );



        await bot.sendMessage(

            chatId,

`✅ File Uploaded To Storage

📁 Type : ${data.type}

🎥 Quality : ${data.quality}

💾 Saving Database...`

        );


        // Next Part Save Database

        await saveUploadedContent(

            chatId,

            data

        );


    }catch(err){


        console.log(

            "Storage Error:",

            err.message

        );


        bot.sendMessage(

            chatId,

            "❌ Upload Failed."

        );


    }


});



console.log("✅ PART 17 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 18/30
// Database Save + Link Generator
// ===================================================


// ======================
// SAVE UPLOADED CONTENT
// ======================

async function saveUploadedContent(chatId,data){

    try{


        const details = parseCaption(

            data.caption,

            data.type

        );



        const contentId = createContentId(

            details.title

        );



        // ======================
        // DUPLICATE CHECK
        // ======================

        const exists = await pool.query(

        `

        SELECT id

        FROM contents

        WHERE

        title=$1

        AND

        type=$2

        `,

        [

            details.title,

            data.type

        ]

        );



        if(exists.rows.length > 0){


            uploadState.delete(chatId);


            return bot.sendMessage(

                chatId,

`⚠️ Already Exists

${details.title}`

            );

        }




        // ======================
        // INSERT DATABASE
        // ======================

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

        language,

        quality,

        file_id

        )

        VALUES(

        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10

        )

        `,

        [

            contentId,

            details.title,

            data.type,

            details.collection,

            details.season,

            details.episode,

            details.year,

            details.language,

            data.quality,

            data.file_id

        ]

        );



        uploadState.delete(chatId);



        const link =

        `https://t.me/${BOT_USERNAME}?start=${contentId}`;



        await bot.sendMessage(

            chatId,

`✅ File Saved Successfully

🎬 Title : ${details.title}

📂 Type : ${data.type}

🎥 Quality : ${data.quality}


🔗 Link:

${link}`,

            {

                reply_markup:{

                    inline_keyboard:[

                        [

                            {

                                text:"📤 Upload Another File",

                                callback_data:"admin_upload"

                            }

                        ]

                    ]

                }

            }

        );



    }catch(err){


        console.log(

            "Save Error:",

            err.message

        );


        bot.sendMessage(

            chatId,

            "❌ Database Save Failed."

        );


    }

}



console.log("✅ PART 18 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 19/30
// Statistics + Broadcast
// ===================================================


// ======================
// ADMIN STATISTICS
// ======================

async function showStatistics(chatId){

    try{


        const users = await pool.query(

            "SELECT COUNT(*) FROM users"

        );


        const contents = await pool.query(

            "SELECT COUNT(*) FROM contents"

        );


        const movies = await pool.query(

        `
        SELECT COUNT(*)

        FROM contents

        WHERE type='Movie'

        `

        );


        const series = await pool.query(

        `
        SELECT COUNT(*)

        FROM contents

        WHERE type='Series'

        `

        );


        const anime = await pool.query(

        `
        SELECT COUNT(*)

        FROM contents

        WHERE type='Anime'

        `

        );


        const downloads = await pool.query(

            "SELECT COUNT(*) FROM downloads"

        );



        await bot.sendMessage(

            chatId,

`📊 CineXClub Statistics


👥 Users:
${users.rows[0].count}


🎬 Total Content:
${contents.rows[0].count}


🎬 Movies:
${movies.rows[0].count}


📺 Series:
${series.rows[0].count}


🍥 Anime:
${anime.rows[0].count}


⬇️ Downloads:
${downloads.rows[0].count}`

        );


    }catch(err){

        console.log(err.message);

    }

}



// ======================
// STAT CALLBACK
// ======================

bot.on("callback_query",async(query)=>{


    if(query.data!=="admin_stats")
        return;


    if(!isAdmin(query.from.id))
        return;


    showStatistics(

        query.message.chat.id

    );


});



// ======================
// BROADCAST START
// ======================

bot.on("callback_query",async(query)=>{


    if(query.data!=="broadcast")
        return;


    if(!isAdmin(query.from.id))
        return;



    broadcastMode.set(

        query.message.chat.id,

        true

    );



    bot.sendMessage(

        query.message.chat.id,

`📢 Send message to broadcast.`

    );


});



// ======================
// BROADCAST MESSAGE
// ======================

bot.on("message",async(msg)=>{


    const adminId=msg.chat.id;


    if(!isAdmin(msg.from.id))
        return;


    if(!broadcastMode.has(adminId))
        return;



    broadcastMode.delete(adminId);



    const users = await pool.query(

        "SELECT user_id FROM users"

    );



    let sentCount=0;



    for(const user of users.rows){


        try{


            await bot.sendMessage(

                user.user_id,

                msg.text || "📢 Update"

            );


            sentCount++;


        }catch(err){}


    }



    bot.sendMessage(

        adminId,

`✅ Broadcast Completed

👥 Sent: ${sentCount}`

    );


});


console.log("✅ PART 19 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 20/30
// Settings Panel + Welcome Image
// ===================================================


// ======================
// SETTINGS PANEL
// ======================

async function showSettings(chatId){

    const sent = await bot.sendMessage(

        chatId,

`⚙️ Bot Settings

Choose option:`,

        {

            reply_markup:{

                inline_keyboard:[

                    [

                        {

                            text:"🖼 Welcome Image",

                            callback_data:"welcome_image_settings"

                        }

                    ],

                    [

                        {

                            text:"💬 Welcome Message",

                            callback_data:"welcome_message_settings"

                        }

                    ],

                    [

                        {

                            text:"🗑 Auto Delete",

                            callback_data:"auto_delete_settings"

                        }

                    ],

                    [

                        {

                            text:"🔙 Back",

                            callback_data:"admin_panel"

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



// ======================
// SETTINGS CALLBACK
// ======================

bot.on("callback_query",async(query)=>{


    const chatId=query.message.chat.id;


    if(!isAdmin(query.from.id))
        return;



    if(query.data==="admin_settings"){


        return showSettings(chatId);


    }



    if(query.data==="welcome_image_settings"){


        return bot.sendMessage(

            chatId,

`🖼 Welcome Image Settings`,

            {

                reply_markup:{

                    inline_keyboard:[

                        [

                            {

                                text:"📤 Change Image",

                                callback_data:"change_welcome_image"

                            }

                        ],

                        [

                            {

                                text:"❌ Remove Image",

                                callback_data:"remove_welcome_image"

                            }

                        ]

                    ]

                }

            }

        );


    }



    if(query.data==="change_welcome_image"){


        settingsState.set(

            chatId,

            "welcome_image"

        );


        return bot.sendMessage(

            chatId,

"📤 Send new welcome image."

        );


    }



    if(query.data==="remove_welcome_image"){


        await setSetting(

            "welcome_image",

            ""

        );


        return bot.sendMessage(

            chatId,

"✅ Welcome image removed."

        );


    }



});



// ======================
// RECEIVE WELCOME IMAGE
// ======================

bot.on("message",async(msg)=>{


    const chatId=msg.chat.id;


    if(!isAdmin(msg.from.id))
        return;


    if(

        settingsState.get(chatId)

        !==

        "welcome_image"

    )

    return;



    if(!msg.photo)
        return;



    const photo =

    msg.photo[

        msg.photo.length-1

    ].file_id;



    await setSetting(

        "welcome_image",

        photo

    );


    settingsState.delete(chatId);



    bot.sendMessage(

        chatId,

"✅ Welcome Image Updated Successfully."

    );


});



console.log("✅ PART 20 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 21/30
// Welcome Message Settings
// ===================================================


// ======================
// SETTING TABLE
// ======================
// Part 20 lo setSetting() function use chestunnam


// ======================
// WELCOME MESSAGE MENU
// ======================

bot.on("callback_query", async(query)=>{

    const chatId=query.message.chat.id;


    if(!isAdmin(query.from.id))
        return;


    if(query.data==="welcome_message_settings"){


        return bot.sendMessage(

            chatId,

`💬 Welcome Message Settings`,

            {

                reply_markup:{

                    inline_keyboard:[

                        [

                            {

                                text:"✏️ Change Message",

                                callback_data:"change_welcome_message"

                            }

                        ],

                        [

                            {

                                text:"❌ Remove Message",

                                callback_data:"remove_welcome_message"

                            }

                        ]

                    ]

                }

            }

        );


    }



    if(query.data==="change_welcome_message"){


        settingsState.set(

            chatId,

            "welcome_message"

        );


        return bot.sendMessage(

            chatId,

`✏️ Send new welcome message.

HTML supported.`

        );


    }



    if(query.data==="remove_welcome_message"){


        await setSetting(

            "welcome_message",

            ""

        );


        return bot.sendMessage(

            chatId,

`✅ Welcome message removed.

Default message will be used.`

        );


    }


});



// ======================
// RECEIVE NEW MESSAGE
// ======================

bot.on("message",async(msg)=>{


    const chatId=msg.chat.id;


    if(!isAdmin(msg.from.id))
        return;


    if(

        settingsState.get(chatId)

        !==

        "welcome_message"

    )

    return;



    if(!msg.text)
        return;



    await setSetting(

        "welcome_message",

        msg.text

    );



    settingsState.delete(chatId);



    bot.sendMessage(

        chatId,

`✅ Welcome message updated successfully.`

    );


});



// ======================
// GET WELCOME MESSAGE
// ======================

async function getWelcomeMessage(){


    try{


        const result = await pool.query(

        `

        SELECT value

        FROM settings

        WHERE key='welcome_message'

        `

        );


        if(result.rows.length)

            return result.rows[0].value;



    }catch(err){}



    return `

🎬 Welcome To CineXClub

Unlimited Movies | Series | Anime

Choose your category below.

`;

}



console.log("✅ PART 21 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 22/30
// Start Command + Welcome System
// ===================================================


// ======================
// START COMMAND
// ======================

bot.onText(/^\/start(?:\s+(.+))?$/, async(msg,match)=>{


    const chatId = msg.chat.id;

    const user = msg.from;


    // Save User

    await saveUser(user);



    const contentId = match[1];



    // ======================
    // DEEP LINK FILE
    // ======================

    if(contentId){


        const found = await pool.query(

        `

        SELECT content_id

        FROM contents

        WHERE content_id=$1

        `,

        [

            contentId

        ]

        );



        if(found.rows.length){


            return sendContent(

                chatId,

                contentId,

                user.id

            );


        }


        return bot.sendMessage(

            chatId,

"❌ Video not found in our database."

        );


    }



    // ======================
    // WELCOME
    // ======================


    const welcomeText = await getWelcomeMessage();


    const username = getUsername(user);



    const finalText =

`${welcomeText}


👤 User: ${username}

🍿 Enjoy CineXClub`;



    const imageResult = await pool.query(

    `

    SELECT value

    FROM settings

    WHERE key='welcome_image'

    `

    );



    const image =

    imageResult.rows.length

    ?

    imageResult.rows[0].value

    :

    null;



    const keyboard = {


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

                    text:"🔍 Search",

                    callback_data:"menu_search"

                }

            ],


            [

                {

                    text:"🎬 Request",

                    callback_data:"request_movie"

                }

            ]

        ]


    };




    let sent;



    if(image){


        sent = await bot.sendPhoto(

            chatId,

            image,

            {

                caption:finalText,

                parse_mode:"HTML",

                reply_markup:keyboard

            }

        );


    }else{


        sent = await bot.sendMessage(

            chatId,

            finalText,

            {

                parse_mode:"HTML",

                reply_markup:keyboard

            }

        );


    }



    autoDelete(

        chatId,

        sent.message_id

    );


});



console.log("✅ PART 22 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 23/30
// Force Join System
// ===================================================


// ======================
// CHECK CHANNEL JOIN
// ======================

async function checkForceJoin(userId){

    try{

        const member = await bot.getChatMember(

            FORCE_CHANNEL,

            userId

        );


        if(

            member.status==="member" ||

            member.status==="administrator" ||

            member.status==="creator"

        ){

            return true;

        }


        return false;


    }catch(err){


        return false;


    }

}



// ======================
// FORCE JOIN MESSAGE
// ======================

async function sendForceJoin(chatId){


    const sent = await bot.sendMessage(

        chatId,

`🔒 Access Locked

Please join our channel to continue.

After joining click Verify.`,

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

                            text:"✅ Verify",

                            callback_data:"verify_join"

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



// ======================
// VERIFY BUTTON
// ======================

bot.on("callback_query",async(query)=>{


    if(query.data!=="verify_join")
        return;



    const userId=query.from.id;

    const chatId=query.message.chat.id;



    const joined = await checkForceJoin(

        userId

    );



    if(joined){


        await bot.answerCallbackQuery(

            query.id,

            {

                text:"✅ Verified"

            }

        );


        return bot.sendMessage(

            chatId,

`✅ Verification Successful

Now you can access CineXClub.`

        );


    }



    await bot.answerCallbackQuery(

        query.id,

        {

            text:"❌ Please join channel first",

            show_alert:true

        }

    );


});



// ======================
// PROTECT FILE ACCESS
// ======================

async function checkAccess(userId,chatId){


    if(!FORCE_CHANNEL)

        return true;



    const joined = await checkForceJoin(

        userId

    );



    if(!joined){


        await sendForceJoin(

            chatId

        );


        return false;

    }



    return true;


}



console.log("✅ PART 23 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 24/30
// Advanced Search System
// ===================================================


// ======================
// START SEARCH
// ======================

async function startSearch(chatId){

    searchState.set(

        chatId,

        true

    );


    const sent = await bot.sendMessage(

        chatId,

`🔍 Search Your Movie / Series / Anime Name`

    );


    autoDelete(

        chatId,

        sent.message_id

    );

}



// ======================
// SEARCH CALLBACK
// ======================

bot.on("callback_query",async(query)=>{


    if(query.data!=="menu_search")
        return;



    startSearch(

        query.message.chat.id

    );


});



// ======================
// SEARCH HANDLER
// ======================

bot.on("message",async(msg)=>{


    const chatId=msg.chat.id;


    if(!searchState.has(chatId))
        return;


    if(!msg.text)
        return;



    searchState.delete(chatId);



    const keyword=msg.text.trim();



    const result=await pool.query(

    `

    SELECT

    content_id,

    title,

    year,

    type


    FROM contents


    WHERE

    title ILIKE $1


    ORDER BY year DESC


    LIMIT 20

    `,

    [

        `%${keyword}%`

    ]

    );



    // ======================
    // NOT FOUND
    // ======================

    if(result.rows.length===0){


        const sent=await bot.sendMessage(

            chatId,

`❌ ${keyword}

Not Found In Our Database.`,

            {

                reply_markup:{

                    inline_keyboard:[

                        [

                            {

                                text:"🎬 Request Movie",

                                callback_data:"request_movie"

                            }

                        ],

                        [

                            {

                                text:"📺 Request Series",

                                callback_data:"request_series"

                            }

                        ],

                        [

                            {

                                text:"🍥 Request Anime",

                                callback_data:"request_anime"

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


        return;

    }




    // ======================
    // SEARCH RESULTS
    // ======================


    const buttons=[];



    result.rows.forEach(item=>{


        buttons.push([


            {

                text:`${item.title} ${item.year ? "(" + item.year + ")" : ""}`,

                callback_data:`view_${item.content_id}`

            }


        ]);


    });



    buttons.push([

        {

            text:"🏠 Home",

            callback_data:"home"

        }

    ]);



    const sent=await bot.sendMessage(

        chatId,

"🔍 Search Results",

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


});



// ======================
// CONTENT VIEW
// ======================

bot.on("callback_query",async(query)=>{


    if(!query.data.startsWith("view_"))
        return;



    const contentId=query.data.replace(

        "view_",

        ""

    );



    const result=await pool.query(

    `

    SELECT *

    FROM contents

    WHERE content_id=$1

    `,

    [

        contentId

    ]

    );



    if(!result.rows.length)
        return;



    const item=result.rows[0];



    bot.sendMessage(

        query.message.chat.id,

`🎬 ${item.title}

📂 Type: ${item.type}

📅 Year: ${item.year || "N/A"}

🎥 Select Quality`,

        {

            reply_markup:{

                inline_keyboard:[

                    [

                        {

                            text:"480p",

                            callback_data:`quality_480_${contentId}`

                        },

                        {

                            text:"720p",

                            callback_data:`quality_720_${contentId}`

                        }

                    ],

                    [

                        {

                            text:"1080p",

                            callback_data:`quality_1080_${contentId}`

                        }

                    ]

                ]

            }

        }

    );


});



console.log("✅ PART 24 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 25/30
// Auto Delete Settings
// ===================================================


// ======================
// AUTO DELETE TIME GET
// ======================

async function getAutoDeleteTime(){

    try{

        const result = await pool.query(

        `
        SELECT setting_value

        FROM settings

        WHERE setting_key='auto_delete'

        `

        );


        if(result.rows.length){

            return Number(

                result.rows[0].setting_value

            );

        }


    }catch(err){

        console.log(err.message);

    }


    return 30;

}



// ======================
// UPDATED AUTO DELETE
// ======================

async function autoDelete(chatId,messageId,time=null){


    if(!time){

        time = await getAutoDeleteTime();

    }



    setTimeout(async()=>{


        try{


            await bot.deleteMessage(

                chatId,

                messageId

            );


        }catch(err){}



    },

    time * 60 * 1000

    );

}



// ======================
// AUTO DELETE SETTINGS MENU
// ======================

bot.on("callback_query",async(query)=>{


    if(query.data!=="auto_delete_settings")
        return;



    if(!isAdmin(query.from.id))
        return;



    bot.sendMessage(

        query.message.chat.id,

`🗑 Auto Delete Time

Select Time`,

        {

            reply_markup:{

                inline_keyboard:[


                    [

                        {

                            text:"10 Minutes",

                            callback_data:"delete_time_10"

                        }

                    ],


                    [

                        {

                            text:"30 Minutes",

                            callback_data:"delete_time_30"

                        }

                    ],


                    [

                        {

                            text:"60 Minutes",

                            callback_data:"delete_time_60"

                        }

                    ]

                ]

            }

        }

    );


});



// ======================
// SAVE DELETE TIME
// ======================

bot.on("callback_query",async(query)=>{


    if(

        !query.data.startsWith(

            "delete_time_"

        )

    )

    return;



    if(!isAdmin(query.from.id))
        return;



    const time=query.data.replace(

        "delete_time_",

        ""

    );



    await setSetting(

        "auto_delete",

        time

    );



    bot.sendMessage(

        query.message.chat.id,

`✅ Auto Delete Updated

🗑 Delete After: ${time} Minutes`

    );


});



console.log("✅ PART 25 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 26/30
// User Management + Ban System
// ===================================================


// ======================
// ADD BAN COLUMN
// ======================

async function addBanColumn(){

    try{

        await pool.query(`

        ALTER TABLE users

        ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT FALSE

        `);


        console.log("✅ Ban Column Ready");


    }catch(err){

        console.log(err.message);

    }

}

addBanColumn();


// ======================
// CHECK USER BANNED
// ======================

async function isUserBanned(userId){

    try{

        const result = await pool.query(

        `
        SELECT banned

        FROM users

        WHERE user_id=$1

        `,

        [

            userId

        ]

        );


        if(result.rows.length){

            return result.rows[0].banned;

        }


    }catch(err){}


    return false;

}



// ======================
// BAN USER
// ======================

async function banUser(userId){

    await pool.query(

    `
    UPDATE users

    SET banned=true

    WHERE user_id=$1

    `,

    [

        userId

    ]

    );

}



// ======================
// UNBAN USER
// ======================

async function unbanUser(userId){

    await pool.query(

    `
    UPDATE users

    SET banned=false

    WHERE user_id=$1

    `,

    [

        userId

    ]

    );

}



// ======================
// ADMIN BAN COMMAND
// ======================

bot.onText(

/\/ban (.+)/,

async(msg,match)=>{


    if(!isAdmin(msg.from.id))
        return;


    const userId = match[1];


    await banUser(userId);


    bot.sendMessage(

        msg.chat.id,

`🚫 User Banned

ID: ${userId}`

    );


});



// ======================
// ADMIN UNBAN COMMAND
// ======================

bot.onText(

/\/unban (.+)/,

async(msg,match)=>{


    if(!isAdmin(msg.from.id))
        return;


    const userId = match[1];


    await unbanUser(userId);



    bot.sendMessage(

        msg.chat.id,

`✅ User Unbanned

ID: ${userId}`

    );


});



// ======================
// BLOCK CHECK MIDDLEWARE
// ======================

async function checkUserAccess(msg){


    const banned = await isUserBanned(

        msg.from.id

    );


    if(banned){


        await bot.sendMessage(

            msg.chat.id,

"🚫 You are blocked from using this bot."

        );


        return false;

    }


    return true;

}



console.log("✅ PART 26 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 27/30
// Error Handling + System Logs
// ===================================================


// ======================
// BOT ERROR HANDLER
// ======================

bot.on("polling_error", (error)=>{

    console.log(

        "🔴 Telegram Polling Error:",

        error.message

    );

});


// ======================
// GENERAL BOT ERROR
// ======================

bot.on("error",(error)=>{


    console.log(

        "🔴 Bot Error:",

        error.message

    );


});



// ======================
// DATABASE ERROR HANDLER
// ======================

pool.on("error",(error)=>{


    console.log(

        "🔴 PostgreSQL Error:",

        error.message

    );


});



// ======================
// PROCESS ERROR
// ======================

process.on(

"uncaughtException",

(error)=>{


    console.log(

        "❌ Uncaught Exception:",

        error.message

    );


});



process.on(

"unhandledRejection",

(error)=>{


    console.log(

        "❌ Unhandled Rejection:",

        error

    );


});



// ======================
// BOT STATUS
// ======================

async function botStatus(){


    try{


        const info = await bot.getMe();



        console.log(`

================================

🤖 Bot Online

Name : ${info.first_name}

Username : @${info.username}

Time : ${new Date().toISOString()}

================================

`);



    }catch(err){


        console.log(

            "Status Error:",

            err.message

        );


    }


}


botStatus();



// ======================
// DATABASE STATUS CHECK
// ======================

setInterval(async()=>{


    try{


        await pool.query(

            "SELECT NOW()"

        );


        console.log(

            "🟢 Database OK"

        );



    }catch(err){


        console.log(

            "🔴 Database Offline",

            err.message

        );


    }


},300000);



// ======================
// RENDER KEEP LOG
// ======================

setInterval(()=>{


    console.log(

        "🟢 CineXClub Bot Running",

        new Date().toISOString()

    );


},600000);



console.log("✅ PART 27 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 28/30
// Storage Channel + Thumbnail System
// ===================================================


// ======================
// GET FILE DETAILS
// ======================

function getFileDetails(msg){

    let fileId = null;

    let thumbnail = null;


    // VIDEO

    if(msg.video){

        fileId = msg.video.file_id;

        if(msg.video.thumb){

            thumbnail = msg.video.thumb.file_id;

        }

    }



    // DOCUMENT (MKV)

    if(msg.document){

        fileId = msg.document.file_id;


        if(msg.document.thumb){

            thumbnail = msg.document.thumb.file_id;

        }

    }


    return {

        fileId,

        thumbnail

    };

}



// ======================
// CREATE STORAGE CAPTION
// ======================

function createStorageCaption(data){


    let caption =

`🎬 ${data.title || "Unknown"}

📂 Type: ${data.type}

`;



    if(data.type==="Movie"){


        caption +=

`🎥 Quality: ${data.quality}

📅 Year: ${data.year || "N/A"}`;


    }



    if(

        data.type==="Series" ||

        data.type==="Anime"

    ){


        caption +=

`📺 Collection: ${data.collection}

🎞 Season: ${data.season}

🎬 Episode: ${data.episode}

🎥 Quality: ${data.quality}`;


    }



    return caption;

}



// ======================
// STORAGE UPLOAD
// ======================

async function uploadToStorage(msg,data){


    try{


        const file = getFileDetails(msg);



        if(!file.fileId){


            throw new Error(

                "File not found"

            );

        }



        const storage = await bot.sendDocument(

            STORAGE_CHANNEL,

            file.fileId,

            {

                caption:createStorageCaption(data)

            }

        );



        let savedFileId;



        if(storage.document){


            savedFileId=

            storage.document.file_id;


        }

        else if(storage.video){


            savedFileId=

            storage.video.file_id;


        }



        return {


            file_id:savedFileId,


            thumbnail:file.thumbnail,


            message_id:storage.message_id


        };



    }catch(err){


        console.log(

            "Storage Upload Error:",

            err.message

        );


        return null;

    }


}



// ======================
// THUMBNAIL SUPPORT NOTE
// ======================

// Telegram file_id thumbnail ni direct sendDocument lo
// user file ki attach cheyadam possible kadu.
// Video/document upload time lo Telegram automatic ga
// thumbnail create chestundi.



console.log("✅ PART 28 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 29/30
// Final Admin Features
// ===================================================


// ======================
// UPLOAD HISTORY
// ======================

async function showUploadHistory(chatId){

    try{

        const result = await pool.query(

        `
        SELECT

        title,

        type,

        quality,

        created_at

        FROM contents

        ORDER BY id DESC

        LIMIT 10

        `

        );


        if(result.rows.length===0){

            return bot.sendMessage(

                chatId,

                "📂 No Upload History"

            );

        }


        let text =

`📤 Latest Uploads\n\n`;


        result.rows.forEach((item,index)=>{


            text +=

`${index+1}. ${item.title}

📂 ${item.type}

🎥 ${item.quality || "N/A"}

\n`;


        });



        bot.sendMessage(

            chatId,

            text

        );


    }catch(err){

        console.log(err.message);

    }

}



// ======================
// WELCOME PREVIEW
// ======================

async function previewWelcome(chatId){


    const image = await pool.query(

    `

    SELECT value

    FROM settings

    WHERE key='welcome_image'

    `

    );



    const message = await getWelcomeMessage();



    if(

        image.rows.length &&

        image.rows[0].value

    ){


        return bot.sendPhoto(

            chatId,

            image.rows[0].value,

            {

                caption:message,

                parse_mode:"HTML"

            }

        );


    }



    bot.sendMessage(

        chatId,

        message,

        {

            parse_mode:"HTML"

        }

    );


}



// ======================
// ADMIN EXTRA BUTTONS
// ======================

bot.on("callback_query",async(query)=>{


    if(!isAdmin(query.from.id))
        return;



    const chatId=query.message.chat.id;



    if(query.data==="upload_history"){


        return showUploadHistory(

            chatId

        );


    }



    if(query.data==="welcome_preview"){


        return previewWelcome(

            chatId

        );


    }



});



// ======================
// ADMIN MENU ADDITIONS
// ======================

function adminExtraButtons(){


    return [

        [

            {

                text:"📂 Upload History",

                callback_data:"upload_history"

            }

        ],

        [

            {

                text:"🖼 Preview Welcome",

                callback_data:"welcome_preview"

            }

        ]

    ];


}



console.log("✅ PART 29 LOADED");
// ===================================================
// CineXClub Bot v2
// PART 30/30
// Final Startup + Production
// ===================================================


// ======================
// STARTUP CHECK
// ======================

async function startupCheck(){

    try{


        console.log(`

================================

🎬 CineXClub Bot Starting...

================================

`);

        // Database Check

        await pool.query(

            "SELECT NOW()"

        );


        console.log(

            "🟢 PostgreSQL Connected"

        );



        // Telegram Check

        const botInfo = await bot.getMe();



        console.log(`

🤖 Bot Ready

Name:
${botInfo.first_name}

Username:
@${botInfo.username}

`);



        console.log(`

================================

✅ CineXClub Bot Online

================================

`);



    }catch(err){


        console.log(

            "❌ Startup Error:",

            err.message

        );


    }


}



startupCheck();



// ======================
// GRACEFUL SHUTDOWN
// ======================

process.on(

"SIGINT",

async()=>{


    console.log(

        "🛑 Bot Stopping..."

    );


    await pool.end();


    process.exit(0);


});



process.on(

"SIGTERM",

async()=>{


    console.log(

        "🛑 Render Shutdown Signal"

    );


    await pool.end();


    process.exit(0);


});



// ======================
// KEEP ALIVE LOG
// ======================

setInterval(()=>{


    console.log(

        "🟢 CineXClub Running..."

    );


},300000);



console.log("✅ PART 30 LOADED");


// ===================================================
// END OF CineXClub Bot v2
// ===================================================
