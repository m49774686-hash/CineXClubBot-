// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1A-1
// Setup + Imports + Database Connection
// ===================================================

require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");


// ===================================================
// ENVIRONMENT CHECK
// ===================================================

const requiredEnv = [
    "BOT_TOKEN",
    "DATABASE_URL",
    "ADMIN_ID",
    "ADMIN_BOT_LINK"
];


for (const key of requiredEnv) {

    if (!process.env[key]) {

        console.error(
            `Missing environment variable: ${key}`
        );

        process.exit(1);

    }

}


// ===================================================
// TELEGRAM BOT INITIALIZATION
// ===================================================

const bot = new TelegramBot(
    process.env.BOT_TOKEN,
    {
        polling: {
            interval: 300,
            autoStart: true
        }
    }
);


// ===================================================
// POSTGRESQL CONNECTION
// ===================================================

const pool = new Pool({

    connectionString:
        process.env.DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    },

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000

});


// ===================================================
// DATABASE QUERY HELPER
// ===================================================

async function dbQuery(
    text,
    params = []
) {

    const client = await pool.connect();

    try {

        const result =
            await client.query(
                text,
                params
            );

        return result;

    }

    catch (error) {

        console.error(
            "Database Query Error:",
            error.message
        );

        throw error;

    }

    finally {

        client.release();

    }

}


// ===================================================
// GLOBAL CONFIGURATION
// ===================================================

const CONFIG = {

    BOT_NAME:
        "CineXClub Bot",

    CHANNEL:
        "@CineXClub",

    PREMIUM_CHANNEL_ID:
        "-1004429685937",

    AUTO_DELETE_DEFAULT:
        "disable",

    ADMIN_ID:
        Number(process.env.ADMIN_ID)

};


// ===================================================
// RUNTIME STORAGE
// ===================================================

const userStates = new Map();

const uploadStates = new Map();



const deleteTimers = new Map();


// ===================================================
// STARTUP STATUS
// ===================================================

let SYSTEM_READY = false;


// ===================================================
// BASIC LOGGER
// ===================================================

function consoleLog(
    message
) {

    console.log(
        `[CineXClub] ${message}`
    );

}


// ===================================================
// PART 1A-1 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1A-2
// PostgreSQL Tables + Verification
// ===================================================


// ===================================================
// DATABASE TABLE CREATION
// ===================================================

async function createTables() {

    try {


        // CONTENTS TABLE

        await dbQuery(`
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

                access_type TEXT DEFAULT 'normal',

                file_id TEXT NOT NULL,

                created_at TIMESTAMP DEFAULT NOW()

            );
        `);



        // USERS TABLE

        await dbQuery(`
            CREATE TABLE IF NOT EXISTS users (

                id SERIAL PRIMARY KEY,

                user_id BIGINT UNIQUE NOT NULL,

                username TEXT,

                is_premium BOOLEAN DEFAULT FALSE,

                joined_at TIMESTAMP DEFAULT NOW()

            );
        `);



        // SETTINGS TABLE

        await dbQuery(`
            CREATE TABLE IF NOT EXISTS settings (

                id SERIAL PRIMARY KEY,

                setting_key TEXT UNIQUE NOT NULL,

                setting_value TEXT

            );
        `);



        // REQUESTS TABLE

        await dbQuery(`
            CREATE TABLE IF NOT EXISTS requests (

                id SERIAL PRIMARY KEY,

                user_id BIGINT NOT NULL,

                request_text TEXT NOT NULL,

                status TEXT DEFAULT 'pending',

                created_at TIMESTAMP DEFAULT NOW()

            );
        `);



        // BANNED USERS TABLE

        await dbQuery(`
            CREATE TABLE IF NOT EXISTS banned_users (

                id SERIAL PRIMARY KEY,

                user_id BIGINT UNIQUE NOT NULL,

                reason TEXT,

                created_at TIMESTAMP DEFAULT NOW()

            );
        `);



        // LOGS TABLE

        await dbQuery(`
            CREATE TABLE IF NOT EXISTS logs (

                id SERIAL PRIMARY KEY,

                action TEXT NOT NULL,

                details TEXT,

                created_at TIMESTAMP DEFAULT NOW()

            );
        `);



        consoleLog(
            "All database tables verified"
        );


        return true;


    }

    catch(error) {


        console.error(
            "Table creation failed:",
            error.message
        );


        return false;

    }

}



// ===================================================
// DATABASE CONNECTION CHECK
// ===================================================

async function checkDatabase() {


    try {


        const result =
            await dbQuery(
                "SELECT NOW()"
            );


        if(result.rows.length > 0) {


            consoleLog(
                "Database Connected"
            );


            return true;

        }


        return false;


    }

    catch(error) {


        console.error(
            "Database Connection Failed:",
            error.message
        );


        return false;

    }

}



// ===================================================
// DATABASE STARTUP VERIFY
// ===================================================

async function verifyDatabase() {


    const connected =
        await checkDatabase();


    if(!connected) {


        console.error(
            "Database unavailable. Bot stopped."
        );


        process.exit(1);

    }



    const tables =
        await createTables();



    if(!tables) {


        console.error(
            "Database tables verification failed."
        );


        process.exit(1);

    }


    consoleLog(
        "Database System Ready"
    );


}


// ===================================================
// PART 1A-2 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1A-3
// Settings + Startup System
// ===================================================


// ===================================================
// DEFAULT SETTINGS
// ===================================================

const DEFAULT_SETTINGS = {

    auto_delete:
        "disable",

    welcome_caption:
        "Welcome to CineXClub Bot",

    welcome_images:
        JSON.stringify([]),

    force_join:
        "true",

    premium_channel:
        CONFIG.PREMIUM_CHANNEL_ID

};



// ===================================================
// INSERT DEFAULT SETTINGS
// ===================================================

async function initializeSettings() {

    try {


        for (const key of Object.keys(DEFAULT_SETTINGS)) {


            await dbQuery(
                `
                INSERT INTO settings
                (
                    setting_key,
                    setting_value
                )

                VALUES
                (
                    $1,
                    $2
                )

                ON CONFLICT
                (setting_key)

                DO NOTHING;
                `,
                [
                    key,
                    DEFAULT_SETTINGS[key]
                ]
            );


        }


        consoleLog(
            "Default settings loaded"
        );


        return true;


    }

    catch(error) {


        console.error(
            "Settings initialization failed:",
            error.message
        );


        return false;

    }

}



// ===================================================
// SETTINGS CACHE
// ===================================================

const botSettings = {};



// ===================================================
// LOAD SETTINGS
// ===================================================

async function loadSettings() {


    try {


        const result =
            await dbQuery(
                `
                SELECT
                setting_key,
                setting_value

                FROM settings;
                `
            );



        result.rows.forEach(
            row => {

                botSettings[row.setting_key] =
                    row.setting_value;

            }
        );



        consoleLog(
            "Settings Loaded"
        );


        return true;


    }

    catch(error) {


        console.error(
            "Settings loading failed:",
            error.message
        );


        return false;

    }


}



// ===================================================
// GLOBAL ERROR HANDLER
// ===================================================

process.on(
    "uncaughtException",
    (error) => {


        console.error(
            "Uncaught Exception:",
            error.message
        );


    }
);



process.on(
    "unhandledRejection",
    (error) => {


        console.error(
            "Unhandled Promise Error:",
            error
        );


    }
);



// ===================================================
// BOT POLLING ERROR
// ===================================================

bot.on(
    "polling_error",
    (error) => {


        console.error(
            "Telegram Polling Error:",
            error.message
        );


    }
);



// ===================================================
// STARTUP FUNCTION
// ===================================================

async function startBot() {


    try {


        consoleLog(
            "Starting CineXClub Bot..."
        );



        await verifyDatabase();



        await initializeSettings();



        await loadSettings();



        SYSTEM_READY = true;



        consoleLog(
            "Bot Ready"
        );


    }

    catch(error) {


        console.error(
            "Startup Failed:",
            error.message
        );


        process.exit(1);

    }


}



// ===================================================
// START BOT
// ===================================================

startBot();


// ===================================================
// PART 1A-3 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-1
// Logging System
// ===================================================


// ===================================================
// DATABASE LOG FUNCTION
// ===================================================

async function addLog(
    action,
    details = ""
) {

    try {


        await dbQuery(
            `
            INSERT INTO logs
            (
                action,
                details
            )

            VALUES
            (
                $1,
                $2
            );
            `,
            [
                action,
                details
            ]
        );


    }

    catch(error) {


        console.error(
            "Log Save Failed:",
            error.message
        );


    }

}



// ===================================================
// ADMIN LOG
// ===================================================

async function adminLog(
    action,
    details = ""
) {


    console.log(
        `[ADMIN LOG] ${action} - ${details}`
    );


    await addLog(
        action,
        details
    );


}



// ===================================================
// UPLOAD SUCCESS LOG
// ===================================================

async function uploadSuccessLog(
    title,
    contentId
) {


    await adminLog(
        "Upload Success",
        `Title: ${title} | ID: ${contentId}`
    );


}



// ===================================================
// UPLOAD FAILED LOG
// ===================================================

async function uploadFailedLog(
    reason
) {


    await adminLog(
        "Upload Failed",
        reason
    );


}



// ===================================================
// ACCESS CHANGE LOG
// ===================================================

async function accessChangedLog(
    contentId,
    access
) {


    await adminLog(
        "Access Changed",
        `Content: ${contentId} | Access: ${access}`
    );


}



// ===================================================
// FILE DELETE LOG
// ===================================================

async function fileDeletedLog(
    contentId
) {


    await adminLog(
        "File Deleted",
        `Content Deleted: ${contentId}`
    );


}



// ===================================================
// WELCOME IMAGE CHANGE LOG
// ===================================================

async function welcomeImageChangedLog(
    action
) {


    await adminLog(
        "Welcome Image Changed",
        action
    );


}



// ===================================================
// WELCOME CAPTION CHANGE LOG
// ===================================================

async function welcomeCaptionChangedLog(
    caption
) {


    await adminLog(
        "Welcome Caption Changed",
        caption
    );


}



// ===================================================
// BROADCAST LOG
// ===================================================

async function broadcastLog(
    count
) {


    await adminLog(
        "Broadcast",
        `Sent to ${count} users`
    );


}



// ===================================================
// SETTINGS LOG
// ===================================================

async function settingsChangedLog(
    setting,
    value
) {


    await adminLog(
        "Settings Changed",
        `${setting}: ${value}`
    );


}



// ===================================================
// PREMIUM JOIN LOG
// ===================================================

async function premiumJoinLog(
    userId
) {


    await adminLog(
        "Premium Member Joined",
        `User: ${userId}`
    );


}



// ===================================================
// PART 1B-1 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-2
// Auto Delete System
// ===================================================


// ===================================================
// GET AUTO DELETE TIME
// ===================================================

function getAutoDeleteTime() {


    const setting =
        botSettings.auto_delete || "disable";



    switch(setting) {


        case "5":
            return 5 * 60 * 1000;


        case "10":
            return 10 * 60 * 1000;


        case "30":
            return 30 * 60 * 1000;


        case "60":
            return 60 * 60 * 1000;


        default:
            return 0;

    }


}



// ===================================================
// DELETE MESSAGE HANDLER
// ===================================================

async function scheduleDelete(
    chatId,
    messageId
) {


    try {


        const deleteTime =
            getAutoDeleteTime();



        if(deleteTime === 0)
            return;



        const timer =
            setTimeout(
                async () => {


                    try {


                        await bot.deleteMessage(
                            chatId,
                            messageId
                        );


                    }

                    catch(error) {


                        console.error(
                            "Auto Delete Error:",
                            error.message
                        );


                    }


                },
                deleteTime
            );



        deleteTimers.set(
            `${chatId}_${messageId}`,
            timer
        );



    }

    catch(error) {


        console.error(
            "Delete Scheduler Error:",
            error.message
        );


    }


}



// ===================================================
// DELETE MULTIPLE MESSAGES
// ===================================================

async function scheduleMessagesDelete(
    messages = []
) {


    for(
        const msg of messages
    ) {


        if(
            msg &&
            msg.chat &&
            msg.message_id
        ) {


            await scheduleDelete(
                msg.chat.id,
                msg.message_id
            );


        }


    }


}



// ===================================================
// CANCEL DELETE TIMER
// ===================================================

function cancelDeleteTimer(
    chatId,
    messageId
) {


    const key =
        `${chatId}_${messageId}`;



    const timer =
        deleteTimers.get(key);



    if(timer) {


        clearTimeout(timer);


        deleteTimers.delete(
            key
        );


    }


}



// ===================================================
// SEND MESSAGE WITH AUTO DELETE
// ===================================================

async function sendAutoDeleteMessage(
    chatId,
    text,
    options = {}
) {


    try {


        const message =
            await bot.sendMessage(
                chatId,
                text,
                options
            );



        await scheduleDelete(
            chatId,
            message.message_id
        );



        return message;


    }

    catch(error) {


        console.error(
            "Send Message Error:",
            error.message
        );


        throw error;


    }


}



// ===================================================
// SEND PHOTO WITH AUTO DELETE
// ===================================================

async function sendAutoDeletePhoto(
    chatId,
    photo,
    caption,
    options = {}
) {


    try {


        const message =
            await bot.sendPhoto(
                chatId,
                photo,
                {
                    caption,
                    ...options
                }
            );



        await scheduleDelete(
            chatId,
            message.message_id
        );



        return message;


    }

    catch(error) {


        console.error(
            "Send Photo Error:",
            error.message
        );


        throw error;


    }


}



// ===================================================
// UPDATE AUTO DELETE SETTING
// ===================================================

async function updateAutoDelete(
    value
) {


    try {


        await dbQuery(
            `
            UPDATE settings

            SET setting_value=$1

            WHERE setting_key='auto_delete';
            `,
            [
                value
            ]
        );



        botSettings.auto_delete =
            value;



        await settingsChangedLog(
            "auto_delete",
            value
        );



        return true;


    }

    catch(error) {


        console.error(
            "Auto Delete Setting Error:",
            error.message
        );


        return false;


    }


}



// ===================================================
// PART 1B-2 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-3
// User Management System
// ===================================================


// ===================================================
// REGISTER USER
// ===================================================

async function registerUser(
    user
) {

    try {


        if(!user || !user.id)
            return false;



        const username =
            user.username
            ? user.username
            : "";



        await dbQuery(
            `
            INSERT INTO users
            (
                user_id,
                username
            )

            VALUES
            (
                $1,
                $2
            )

            ON CONFLICT
            (user_id)

            DO UPDATE SET

            username=$2;
            `,
            [
                user.id,
                username
            ]
        );



        return true;


    }

    catch(error) {


        console.error(
            "User Registration Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// GET USER DATA
// ===================================================

async function getUser(
    userId
) {

    try {


        const result =
            await dbQuery(
                `
                SELECT *

                FROM users

                WHERE user_id=$1;
                `,
                [
                    userId
                ]
            );



        if(result.rows.length === 0)
            return null;



        return result.rows[0];


    }

    catch(error) {


        console.error(
            "Get User Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// CHECK BANNED USER
// ===================================================

async function isBanned(
    userId
) {

    try {


        const result =
            await dbQuery(
                `
                SELECT id

                FROM banned_users

                WHERE user_id=$1;
                `,
                [
                    userId
                ]
            );



        return result.rows.length > 0;


    }

    catch(error) {


        console.error(
            "Ban Check Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// BAN USER
// ===================================================

async function banUser(
    userId,
    reason = ""
) {

    try {


        await dbQuery(
            `
            INSERT INTO banned_users
            (
                user_id,
                reason
            )

            VALUES
            (
                $1,
                $2
            )

            ON CONFLICT
            (user_id)

            DO UPDATE SET

            reason=$2;
            `,
            [
                userId,
                reason
            ]
        );



        await adminLog(
            "User Banned",
            `User: ${userId}`
        );



        return true;


    }

    catch(error) {


        console.error(
            "Ban User Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// UNBAN USER
// ===================================================

async function unbanUser(
    userId
) {

    try {


        await dbQuery(
            `
            DELETE FROM banned_users

            WHERE user_id=$1;
            `,
            [
                userId
            ]
        );



        await adminLog(
            "User Unbanned",
            `User: ${userId}`
        );



        return true;


    }

    catch(error) {


        console.error(
            "Unban Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// CHECK PREMIUM USER
// ===================================================

async function isPremiumUser(
    userId
) {

    try {


        const result =
            await dbQuery(
                `
                SELECT is_premium

                FROM users

                WHERE user_id=$1;
                `,
                [
                    userId
                ]
            );



        if(result.rows.length === 0)
            return false;



        return result.rows[0].is_premium === true;


    }

    catch(error) {


        console.error(
            "Premium Check Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// SET PREMIUM USER
// ===================================================

async function setPremiumUser(
    userId,
    status = true
) {

    try {


        await dbQuery(
            `
            UPDATE users

            SET is_premium=$1

            WHERE user_id=$2;
            `,
            [
                status,
                userId
            ]
        );



        if(status) {


            await premiumJoinLog(
                userId
            );


        }



        return true;


    }

    catch(error) {


        console.error(
            "Premium Update Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// USER ACCESS CHECK
// ===================================================

async function canAccessContent(
    userId,
    accessType
) {


    if(
        accessType === "normal"
    ) {

        return true;

    }



    if(
        accessType === "premium"
    ) {


        return await isPremiumUser(
            userId
        );


    }



    return false;


}



// ===================================================
// PART 1B-3 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-4
// Content Database System
// ===================================================


// ===================================================
// SAVE CONTENT
// ===================================================

async function saveContent(
    data
) {

    try {


        const result =
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
                    access_type,
                    file_id
                )

                VALUES
                (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
                )

                RETURNING *;
                `,
                [

                    data.content_id,

                    data.title,

                    data.type,

                    data.collection || null,

                    data.year || null,

                    data.season || null,

                    data.episode || null,

                    data.quality || null,

                    data.audio || null,

                    data.size || null,

                    data.language || null,

                    data.access_type || "normal",

                    data.file_id

                ]
            );



        return result.rows[0];


    }

    catch(error) {


        console.error(
            "Save Content Error:",
            error.message
        );


        throw error;


    }

}



// ===================================================
// GET CONTENT BY ID
// ===================================================

async function getContentById(
    contentId
) {


    try {


        const result =
            await dbQuery(
                `
                SELECT *

                FROM contents

                WHERE content_id=$1;
                `,
                [
                    contentId
                ]
            );



        if(result.rows.length === 0)
            return null;



        return result.rows[0];


    }

    catch(error) {


        console.error(
            "Get Content Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// SEARCH CONTENT BY TITLE
// ===================================================

async function searchContent(
    title
) {


    try {


        const result =
            await dbQuery(
                `
                SELECT *

                FROM contents

                WHERE title ILIKE $1

                ORDER BY created_at DESC;
                `,
                [
                    `%${title}%`
                ]
            );



        return result.rows;


    }

    catch(error) {


        console.error(
            "Search Content Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// GET MOVIE QUALITY FILE
// ===================================================

async function getQualityFile(
    title,
    year,
    quality
) {


    try {


        const result =
            await dbQuery(
                `
                SELECT *

                FROM contents

                WHERE title ILIKE $1

                AND year=$2

                AND quality=$3

                LIMIT 1;
                `,
                [

                    `%${title}%`,

                    year,

                    quality

                ]
            );



        if(result.rows.length === 0)
            return null;



        return result.rows[0];


    }

    catch(error) {


        console.error(
            "Quality Search Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// GET SERIES EPISODE
// ===================================================

async function getEpisodeFile(
    collection,
    season,
    episode,
    quality
) {


    try {


        const result =
            await dbQuery(
                `
                SELECT *

                FROM contents

                WHERE collection ILIKE $1

                AND season=$2

                AND episode=$3

                AND quality=$4

                LIMIT 1;
                `,
                [

                    `%${collection}%`,

                    season,

                    episode,

                    quality

                ]
            );



        if(result.rows.length === 0)
            return null;



        return result.rows[0];


    }

    catch(error) {


        console.error(
            "Episode Search Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// GET ALL EPISODES
// ===================================================

async function getAllEpisodes(
    collection,
    season
) {


    try {


        const result =
            await dbQuery(
                `
                SELECT *

                FROM contents

                WHERE collection ILIKE $1

                AND season=$2

                ORDER BY episode ASC;
                `,
                [

                    `%${collection}%`,

                    season

                ]
            );



        return result.rows;


    }

    catch(error) {


        console.error(
            "Episodes Fetch Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// DELETE CONTENT
// ===================================================

async function deleteContent(
    contentId
) {


    try {


        await dbQuery(
            `
            DELETE FROM contents

            WHERE content_id=$1;
            `,
            [
                contentId
            ]
        );



        await fileDeletedLog(
            contentId
        );



        return true;


    }

    catch(error) {


        console.error(
            "Delete Content Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// CHANGE CONTENT ACCESS
// ===================================================

async function changeAccess(
    contentId,
    access
) {


    try {


        await dbQuery(
            `
            UPDATE contents

            SET access_type=$1

            WHERE content_id=$2;
            `,
            [
                access,
                contentId
            ]
        );



        await accessChangedLog(
            contentId,
            access
        );



        return true;


    }

    catch(error) {


        console.error(
            "Access Change Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// PART 1B-4 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-5
// Caption Parser System
// ===================================================


// ===================================================
// PARSE CAPTION DATA
// ===================================================

function parseCaption(
    caption = ""
) {


    try {


        const data = {};



        const lines =
            caption
            .split("\n")
            .map(
                line => line.trim()
            )
            .filter(
                line => line.length > 0
            );



        for(
            const line of lines
        ) {


            const separator =
                line.indexOf(":");



            if(separator === -1)
                continue;



            const key =
                line
                .substring(
                    0,
                    separator
                )
                .trim()
                .toLowerCase();



            const value =
                line
                .substring(
                    separator + 1
                )
                .trim();



            data[key] = value;


        }



        return data;


    }

    catch(error) {


        console.error(
            "Caption Parse Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// FORMAT PARSED CONTENT
// ===================================================

function formatContentData(
    parsed
) {


    if(!parsed)
        return null;



    return {

        content_id:
            parsed.id || null,


        title:
            parsed.title || null,


        type:
            parsed.type || null,


        collection:
            parsed.collection || null,


        year:
            parsed.year
            ? Number(parsed.year)
            : null,


        season:
            parsed.season
            ? Number(parsed.season)
            : null,


        episode:
            parsed.episode
            ? Number(parsed.episode)
            : null,


        quality:
            parsed.quality || null,


        audio:
            parsed.audio || null,


        size:
            parsed.size || null,


        language:
            parsed.language || null

    };


}



// ===================================================
// VALIDATE CAPTION
// ===================================================

function validateCaption(
    data
) {


    if(!data)
        return {
            valid:false,
            reason:"Caption empty"
        };



    if(!data.id)
        return {
            valid:false,
            reason:"Content ID missing"
        };



    if(!data.title)
        return {
            valid:false,
            reason:"Title missing"
        };



    if(!data.type)
        return {
            valid:false,
            reason:"Type missing"
        };



    const allowedTypes = [

        "Movie",
        "Series",
        "Anime"

    ];



    if(
        !allowedTypes.includes(
            data.type
        )
    ) {


        return {

            valid:false,

            reason:
            "Invalid content type"

        };


    }



    return {

        valid:true,

        reason:"Valid"

    };


}



// ===================================================
// VERIFY FILE ID
// ===================================================

function verifyFileId(
    fileId
) {


    try {


        if(
            !fileId ||
            typeof fileId !== "string"
        ) {


            return false;


        }



        return true;


    }

    catch(error) {


        console.error(
            "File ID Verification Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// CREATE CONTENT OBJECT FROM UPLOAD
// ===================================================

function createUploadObject(
    captionData,
    fileId,
    accessType = "normal"
) {


    return {

        content_id:
            captionData.id,


        title:
            captionData.title,


        type:
            captionData.type,


        collection:
            captionData.collection || null,


        year:
            captionData.year
            ? Number(captionData.year)
            : null,


        season:
            captionData.season
            ? Number(captionData.season)
            : null,


        episode:
            captionData.episode
            ? Number(captionData.episode)
            : null,


        quality:
            captionData.quality || null,


        audio:
            captionData.audio || null,


        size:
            captionData.size || null,


        language:
            captionData.language || null,


        access_type:
            accessType,


        file_id:
            fileId

    };


}



// ===================================================
// PART 1B-5 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-6
// Upload Validation System
// ===================================================


// ===================================================
// CHECK DUPLICATE CONTENT
// ===================================================

async function checkDuplicateContent(
    contentId
) {

    try {


        const result =
            await dbQuery(
                `
                SELECT id

                FROM contents

                WHERE content_id=$1;
                `,
                [
                    contentId
                ]
            );



        return result.rows.length > 0;


    }

    catch(error) {


        console.error(
            "Duplicate Check Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// COMPLETE UPLOAD VALIDATION
// ===================================================

async function validateUpload(
    caption,
    fileId
) {


    try {


        if(
            !verifyFileId(fileId)
        ) {


            return {

                success:false,

                reason:
                "File ID missing"

            };


        }



        const parsed =
            parseCaption(
                caption
            );



        const contentData =
            formatContentData(
                parsed
            );



        const validation =
            validateCaption(
                contentData
            );



        if(
            !validation.valid
        ) {


            return {

                success:false,

                reason:
                validation.reason

            };


        }



        const duplicate =
            await checkDuplicateContent(
                contentData.content_id
            );



        if(duplicate) {


            return {

                success:false,

                reason:
                "Duplicate content"

            };


        }



        return {

            success:true,

            data:
            contentData

        };


    }

    catch(error) {


        console.error(
            "Upload Validation Error:",
            error.message
        );



        return {

            success:false,

            reason:
            "Validation error"

        };


    }

}



// ===================================================
// SAVE UPLOAD CONTENT
// ===================================================

async function processUpload(
    caption,
    fileId,
    accessType = "normal"
) {


    try {


        const validation =
            await validateUpload(
                caption,
                fileId
            );



        if(
            !validation.success
        ) {


            await uploadFailedLog(
                validation.reason
            );



            return {

                success:false,

                reason:
                validation.reason

            };


        }



        const uploadData =
            createUploadObject(
                validation.data,
                fileId,
                accessType
            );



        const saved =
            await saveContent(
                uploadData
            );



        await uploadSuccessLog(
            saved.title,
            saved.content_id
        );



        return {

            success:true,

            data:
            saved

        };


    }

    catch(error) {


        console.error(
            "Upload Process Failed:",
            error.message
        );



        await uploadFailedLog(
            error.message
        );



        return {

            success:false,

            reason:
            error.message

        };


    }

}



// ===================================================
// GET CONTENT COUNT
// ===================================================

async function getContentCount(
    type = null
) {


    try {


        let query =
        `
        SELECT COUNT(*)

        FROM contents
        `;



        let params = [];



        if(type) {


            query +=
            `
            WHERE type=$1
            `;


            params.push(
                type
            );


        }



        const result =
            await dbQuery(
                query,
                params
            );



        return Number(
            result.rows[0].count
        );


    }

    catch(error) {


        console.error(
            "Content Count Error:",
            error.message
        );


        return 0;


    }

}



// ===================================================
// PART 1B-6 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-7
// Admin Security + Statistics
// ===================================================


// ===================================================
// CHECK ADMIN
// ===================================================

function isAdmin(
    userId
) {


    return Number(userId) === CONFIG.ADMIN_ID;


}



// ===================================================
// REQUIRE ADMIN ACCESS
// ===================================================

async function requireAdmin(
    userId
) {


    if(
        !isAdmin(userId)
    ) {


        return false;


    }



    return true;


}



// ===================================================
// GET TOTAL USERS
// ===================================================

async function getTotalUsers() {


    try {


        const result =
            await dbQuery(
                `
                SELECT COUNT(*)

                FROM users;
                `
            );



        return Number(
            result.rows[0].count
        );


    }

    catch(error) {


        console.error(
            "User Count Error:",
            error.message
        );


        return 0;


    }

}



// ===================================================
// GET PREMIUM USERS COUNT
// ===================================================

async function getPremiumUsersCount() {


    try {


        const result =
            await dbQuery(
                `
                SELECT COUNT(*)

                FROM users

                WHERE is_premium=true;
                `
            );



        return Number(
            result.rows[0].count
        );


    }

    catch(error) {


        console.error(
            "Premium Count Error:",
            error.message
        );


        return 0;


    }

}



// ===================================================
// GET BANNED USERS COUNT
// ===================================================

async function getBannedUsersCount() {


    try {


        const result =
            await dbQuery(
                `
                SELECT COUNT(*)

                FROM banned_users;
                `
            );



        return Number(
            result.rows[0].count
        );


    }

    catch(error) {


        console.error(
            "Banned Count Error:",
            error.message
        );


        return 0;


    }

}



// ===================================================
// GET REQUEST COUNT
// ===================================================

async function getRequestCount() {


    try {


        const result =
            await dbQuery(
                `
                SELECT COUNT(*)

                FROM requests;
                `
            );



        return Number(
            result.rows[0].count
        );


    }

    catch(error) {


        console.error(
            "Request Count Error:",
            error.message
        );


        return 0;


    }

}



// ===================================================
// GET FULL STATISTICS
// ===================================================

async function getStatistics() {


    try {


        return {


            users:
            await getTotalUsers(),


            movies:
            await getContentCount(
                "Movie"
            ),


            series:
            await getContentCount(
                "Series"
            ),


            anime:
            await getContentCount(
                "Anime"
            ),


            premiumFiles:
            await dbQuery(
                `
                SELECT COUNT(*)

                FROM contents

                WHERE access_type='premium';
                `
            )
            .then(
                res =>
                Number(
                    res.rows[0].count
                )
            ),


            requests:
            await getRequestCount(),


            banned:
            await getBannedUsersCount()


        };


    }

    catch(error) {


        console.error(
            "Statistics Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// PART 1B-7 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-8
// Request Management System
// ===================================================


// ===================================================
// ADD REQUEST
// ===================================================

async function addRequest(
    userId,
    requestText
) {

    try {


        const result =
            await dbQuery(
                `
                INSERT INTO requests
                (
                    user_id,
                    request_text
                )

                VALUES
                (
                    $1,
                    $2
                )

                RETURNING *;
                `,
                [
                    userId,
                    requestText
                ]
            );



        await addLog(
            "New Request",
            `User: ${userId} | Request: ${requestText}`
        );



        return result.rows[0];


    }

    catch(error) {


        console.error(
            "Add Request Error:",
            error.message
        );


        throw error;


    }

}



// ===================================================
// GET PENDING REQUESTS
// ===================================================

async function getPendingRequests() {


    try {


        const result =
            await dbQuery(
                `
                SELECT *

                FROM requests

                WHERE status='pending'

                ORDER BY created_at ASC;
                `
            );



        return result.rows;


    }

    catch(error) {


        console.error(
            "Pending Request Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// GET ALL REQUESTS
// ===================================================

async function getAllRequests() {


    try {


        const result =
            await dbQuery(
                `
                SELECT *

                FROM requests

                ORDER BY created_at DESC;
                `
            );



        return result.rows;


    }

    catch(error) {


        console.error(
            "All Request Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// UPDATE REQUEST STATUS
// ===================================================

async function updateRequestStatus(
    requestId,
    status
) {


    try {


        await dbQuery(
            `
            UPDATE requests

            SET status=$1

            WHERE id=$2;
            `,
            [
                status,
                requestId
            ]
        );



        await addLog(
            "Request Status Changed",
            `Request: ${requestId} | Status: ${status}`
        );



        return true;


    }

    catch(error) {


        console.error(
            "Request Update Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// DELETE REQUEST
// ===================================================

async function deleteRequest(
    requestId
) {


    try {


        await dbQuery(
            `
            DELETE FROM requests

            WHERE id=$1;
            `,
            [
                requestId
            ]
        );



        await addLog(
            "Request Deleted",
            `Request ID: ${requestId}`
        );



        return true;


    }

    catch(error) {


        console.error(
            "Request Delete Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// FIND USER REQUESTS
// ===================================================

async function getUserRequests(
    userId
) {


    try {


        const result =
            await dbQuery(
                `
                SELECT *

                FROM requests

                WHERE user_id=$1

                ORDER BY created_at DESC;
                `,
                [
                    userId
                ]
            );



        return result.rows;


    }

    catch(error) {


        console.error(
            "User Request Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// PART 1B-8 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-9
// Force Join + Channel Access System
// ===================================================


// ===================================================
// CHECK CHANNEL MEMBERSHIP
// ===================================================

async function checkChannelMember(
    userId,
    channel
) {


    try {


        const member =
            await bot.getChatMember(
                channel,
                userId
            );



        const allowedStatus = [

            "creator",

            "administrator",

            "member",

            "restricted"

        ];



        return allowedStatus.includes(
            member.status
        );


    }

    catch(error) {


        console.error(
            "Channel Member Check Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// FORCE JOIN ENABLE CHECK
// ===================================================

function isForceJoinEnabled() {


    return (
        botSettings.force_join === "true"
    );


}



// ===================================================
// FORCE JOIN VERIFY
// ===================================================

async function verifyForceJoin(
    userId
) {


    try {


        if(
            !isForceJoinEnabled()
        ) {


            return true;


        }



        const joined =
            await checkChannelMember(
                userId,
                CONFIG.CHANNEL
            );



        return joined;


    }

    catch(error) {


        console.error(
            "Force Join Verify Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// SEND FORCE JOIN MESSAGE
// ===================================================

async function sendForceJoinMessage(
    chatId
) {


    try {


        const message =
            await bot.sendMessage(

                chatId,

                `
⚠️ You must join our channel first.

Join @CineXClub to access movies.
                `,

                {

                    reply_markup: {

                        inline_keyboard: [

                            [

                                {

                                    text:
                                    "📢 Join Channel",

                                    url:
                                    "https://t.me/CineXClub"

                                }

                            ],

                            [

                                {

                                    text:
                                    "✅ Joined",

                                    callback_data:
                                    "check_join"

                                }

                            ]

                        ]

                    }

                }

            );



        await scheduleDelete(
            chatId,
            message.message_id
        );



        return message;


    }

    catch(error) {


        console.error(
            "Force Join Message Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// PREMIUM CONTENT MESSAGE
// ===================================================

async function sendPremiumMessage(
    chatId
) {


    try {


        const message =
            await bot.sendMessage(

                chatId,

                `
⭐ Premium Content

This content is available only for Premium Members.

Contact Admin for Premium Files Access.
                `,

                {

                    reply_markup: {

                        inline_keyboard: [

                            [

                                {

                                    text:
                                    "👤 Contact Admin",

                                    url:
                                    CONFIG.ADMIN_BOT_LINK

                                }

                            ],

                            [

                                {

                                    text:
                                    "❌ Close",

                                    callback_data:
                                    "close"

                                }

                            ]

                        ]

                    }

                }

            );



        await scheduleDelete(
            chatId,
            message.message_id
        );



        return message;


    }

    catch(error) {


        console.error(
            "Premium Message Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// CONTENT ACCESS VERIFY
// ===================================================

async function verifyContentAccess(
    userId,
    content
) {


    try {


        if(
            content.access_type === "normal"
        ) {


            return true;


        }



        if(
            content.access_type === "premium"
        ) {


            return await isPremiumUser(
                userId
            );


        }



        return false;


    }

    catch(error) {


        console.error(
            "Content Access Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// PART 1B-9 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-10
// Welcome System Base
// ===================================================


// ===================================================
// GET USER DISPLAY NAME
// ===================================================

function getDisplayName(
    user
) {


    try {


        if(
            user.username
        ) {


            return user.username
            .replace(
                "@",
                ""
            );


        }



        if(
            user.first_name
        ) {


            return user.first_name;


        }



        return "User";


    }

    catch(error) {


        console.error(
            "Username Format Error:",
            error.message
        );


        return "User";


    }

}



// ===================================================
// GET WELCOME IMAGES
// ===================================================

function getWelcomeImages() {


    try {


        if(
            !botSettings.welcome_images
        ) {


            return [];


        }



        const images =
            JSON.parse(
                botSettings.welcome_images
            );



        if(
            Array.isArray(images)
        ) {


            return images;


        }



        return [];


    }

    catch(error) {


        console.error(
            "Welcome Images Load Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// GET RANDOM WELCOME IMAGE
// ===================================================

function getRandomWelcomeImage() {


    const images =
        getWelcomeImages();



    if(
        images.length === 0
    ) {


        return null;


    }



    const randomIndex =
        Math.floor(
            Math.random()
            *
            images.length
        );



    return images[randomIndex];


}



// ===================================================
// GET WELCOME CAPTION
// ===================================================

function getWelcomeCaption(
    user
) {


    try {


        const username =
            getDisplayName(
                user
            );



        const customCaption =
            botSettings.welcome_caption;



        if(
            customCaption
        ) {


            return customCaption
            .replace(
                "{username}",
                username
            );


        }



        return `

👋 Welcome ${username}

🎬 CineXClub Bot

Search Movies, Series & Anime instantly.

Enjoy your entertainment!

        `;


    }

    catch(error) {


        console.error(
            "Welcome Caption Error:",
            error.message
        );


        return "Welcome to CineXClub Bot";


    }

}



// ===================================================
// SEND WELCOME MESSAGE
// ===================================================

async function sendWelcomeMessage(
    chatId,
    user
) {


    try {


        const caption =
            getWelcomeCaption(
                user
            );



        const image =
            getRandomWelcomeImage();



        let message;



        if(
            image
        ) {


            message =
                await bot.sendPhoto(

                    chatId,

                    image,

                    {

                        caption,

                        reply_markup: {

                            inline_keyboard: [

                                [

                                    {

                                        text:
                                        "ℹ️ About",

                                        callback_data:
                                        "about"

                                    },

                                    {

                                        text:
                                        "❌ Close",

                                        callback_data:
                                        "close"

                                    }

                                ]

                            ]

                        }

                    }

                );


        }

        else {


            message =
                await bot.sendMessage(

                    chatId,

                    caption,

                    {

                        reply_markup: {

                            inline_keyboard: [

                                [

                                    {

                                        text:
                                        "ℹ️ About",

                                        callback_data:
                                        "about"

                                    },

                                    {

                                        text:
                                        "❌ Close",

                                        callback_data:
                                        "close"

                                    }

                                ]

                            ]

                        }

                    }

                );


        }



        return message;


    }

    catch(error) {


        console.error(
            "Welcome Send Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// UPDATE WELCOME IMAGES
// ===================================================

async function updateWelcomeImages(
    images
) {


    try {


        await dbQuery(

            `
            UPDATE settings

            SET setting_value=$1

            WHERE setting_key='welcome_images';
            `,

            [

                JSON.stringify(
                    images
                )

            ]

        );



        botSettings.welcome_images =
            JSON.stringify(
                images
            );



        await welcomeImageChangedLog(
            "Images Updated"
        );



        return true;


    }

    catch(error) {


        console.error(
            "Welcome Image Update Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// UPDATE WELCOME CAPTION
// ===================================================

async function updateWelcomeCaption(
    caption
) {


    try {


        await dbQuery(

            `
            UPDATE settings

            SET setting_value=$1

            WHERE setting_key='welcome_caption';
            `,

            [
                caption
            ]

        );



        botSettings.welcome_caption =
            caption;



        await welcomeCaptionChangedLog(
            caption
        );



        return true;


    }

    catch(error) {


        console.error(
            "Welcome Caption Update Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// PART 1B-10 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-11
// Button Builder System
// ===================================================


// ===================================================
// CREATE INLINE BUTTON
// ===================================================

function createButton(
    text,
    callback
) {


    return {

        text,

        callback_data:
        callback

    };


}



// ===================================================
// CREATE URL BUTTON
// ===================================================

function createUrlButton(
    text,
    url
) {


    return {

        text,

        url

    };


}



// ===================================================
// QUALITY BUTTONS
// ===================================================

function createQualityButtons(
    qualities = [],
    contentId
) {


    const buttons = [];



    for(
        const quality of qualities
    ) {


        buttons.push(

            [

                createButton(

                    `🎞 ${quality}`,

                    `quality_${contentId}_${quality}`

                )

            ]

        );


    }



    return buttons;


}



// ===================================================
// YEAR BUTTONS
// ===================================================

function createYearButtons(
    years = [],
    contentId
) {


    const buttons = [];



    for(
        const year of years
    ) {


        buttons.push(

            [

                createButton(

                    `📅 ${year}`,

                    `year_${contentId}_${year}`

                )

            ]

        );


    }



    return buttons;


}



// ===================================================
// SEASON BUTTONS
// ===================================================

function createSeasonButtons(
    seasons = [],
    collection
) {


    const buttons = [];



    for(
        const season of seasons
    ) {


        buttons.push(

            [

                createButton(

                    `📺 Season ${season}`,

                    `season_${collection}_${season}`

                )

            ]

        );


    }



    return buttons;


}



// ===================================================
// EPISODE BUTTONS
// ===================================================

function createEpisodeButtons(
    episodes = [],
    collection,
    season
) {


    const buttons = [];

    let row = [];



    for(
        const episode of episodes
    ) {


        row.push(

            createButton(

                `Episode ${episode}`,

                `episode_${collection}_${season}_${episode}`

            )

        );



        if(
            row.length === 3
        ) {


            buttons.push(
                row
            );


            row = [];


        }


    }



    if(
        row.length > 0
    ) {


        buttons.push(
            row
        );


    }



    return buttons;


}



// ===================================================
// SEND ALL EPISODES BUTTON
// ===================================================

function createAllEpisodesButton(
    collection,
    season
) {


    return [

        [

            createButton(

                "📥 Send All Episodes",

                `all_episode_${collection}_${season}`

            )

        ]

    ];

}



// ===================================================
// CLOSE BUTTON
// ===================================================

function createCloseButton() {


    return [

        [

            createButton(

                "❌ Close",

                "close"

            )

        ]

    ];

}



// ===================================================
// BACK BUTTON
// ===================================================

function createBackButton(
    data
) {


    return [

        [

            createButton(

                "⬅️ Back",

                data

            )

        ]

    ];

}



// ===================================================
// ABOUT BUTTON MENU
// ===================================================

function createAboutButtons() {


    return {


        inline_keyboard:

        [

            [

                createUrlButton(

                    "👤 Contact Admin",

                    CONFIG.ADMIN_BOT_LINK

                )

            ],

            [

                createButton(

                    "❌ Close",

                    "close"

                )

            ]

        ]


    };


}



// ===================================================
// PART 1B-11 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-12
// Content Navigation System Base
// ===================================================


// ===================================================
// GET AVAILABLE YEARS
// ===================================================

async function getAvailableYears(
    title
) {

    try {


        const result =
            await dbQuery(
                `
                SELECT DISTINCT year

                FROM contents

                WHERE title ILIKE $1

                AND year IS NOT NULL

                ORDER BY year DESC;
                `,
                [
                    `%${title}%`
                ]
            );



        return result.rows.map(
            row => row.year
        );


    }

    catch(error) {


        console.error(
            "Year Fetch Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// GET AVAILABLE QUALITIES
// ===================================================

async function getAvailableQualities(
    title,
    year = null
) {


    try {


        let query =

        `
        SELECT DISTINCT quality

        FROM contents

        WHERE title ILIKE $1

        `;



        const params = [

            `%${title}%`

        ];



        if(year) {


            query +=
            `
            AND year=$2
            `;


            params.push(
                year
            );


        }



        query +=
        `
        ORDER BY quality;
        `;



        const result =
            await dbQuery(
                query,
                params
            );



        return result.rows.map(
            row => row.quality
        );


    }

    catch(error) {


        console.error(
            "Quality Fetch Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// GET AVAILABLE SEASONS
// ===================================================

async function getAvailableSeasons(
    collection
) {


    try {


        const result =
            await dbQuery(
                `
                SELECT DISTINCT season

                FROM contents

                WHERE collection ILIKE $1

                AND season IS NOT NULL

                ORDER BY season;
                `,
                [
                    `%${collection}%`
                ]
            );



        return result.rows.map(
            row => row.season
        );


    }

    catch(error) {


        console.error(
            "Season Fetch Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// GET AVAILABLE EPISODES
// ===================================================

async function getAvailableEpisodes(
    collection,
    season
) {


    try {


        const result =
            await dbQuery(
                `
                SELECT DISTINCT episode

                FROM contents

                WHERE collection ILIKE $1

                AND season=$2

                ORDER BY episode;
                `,
                [

                    `%${collection}%`,

                    season

                ]
            );



        return result.rows.map(
            row => row.episode
        );


    }

    catch(error) {


        console.error(
            "Episode Fetch Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// FIND MOVIE FILE
// ===================================================

async function findMovieFile(
    title,
    year,
    quality
) {


    try {


        const result =
            await dbQuery(
                `
                SELECT *

                FROM contents

                WHERE title ILIKE $1

                AND year=$2

                AND quality=$3

                LIMIT 1;
                `,
                [

                    `%${title}%`,

                    year,

                    quality

                ]
            );



        if(
            result.rows.length === 0
        )
            return null;



        return result.rows[0];


    }

    catch(error) {


        console.error(
            "Movie File Find Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// SEND VIDEO FILE
// ===================================================

async function sendVideoFile(
    chatId,
    content
) {


    try {


        if(
            !content ||
            !content.file_id
        ) {


            return null;


        }



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

📦 Size: ${content.size || "N/A"}
`

                }

            );



        await scheduleDelete(
            chatId,
            message.message_id
        );



        return message;


    }

    catch(error) {


        console.error(
            "Video Send Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// PART 1B-12 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-13
// Search System Base
// ===================================================


// ===================================================
// NORMALIZE SEARCH TEXT
// ===================================================

function normalizeText(
    text = ""
) {


    return text
    .toLowerCase()
    .trim()
    .replace(
        /\s+/g,
        " "
    );


}



// ===================================================
// SEARCH EXACT CONTENT
// ===================================================

async function searchExactContent(
    title
) {


    try {


        const result =
            await dbQuery(
                `
                SELECT *

                FROM contents

                WHERE LOWER(title)=LOWER($1)

                ORDER BY created_at DESC;
                `,
                [
                    title
                ]
            );



        return result.rows;


    }

    catch(error) {


        console.error(
            "Exact Search Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// SEARCH CONTENT SMART
// ===================================================

async function smartSearchContent(
    title
) {


    try {


        const exact =
            await searchExactContent(
                title
            );



        if(
            exact.length > 0
        ) {


            return exact;


        }



        return await searchContent(
            title
        );


    }

    catch(error) {


        console.error(
            "Smart Search Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// CREATE SEARCH BUTTONS
// ===================================================

function createSearchButtons(
    contents
) {


    const buttons = [];



    for(
        const item of contents
    ) {


        buttons.push(

            [

                createButton(

                    `${item.title} (${item.quality || "File"})`,

                    `open_${item.content_id}`

                )

            ]

        );


    }



    buttons.push(

        [

            createButton(

                "❌ Close",

                "close"

            )

        ]

    );



    return buttons;


}



// ===================================================
// SEND SEARCH RESULTS
// ===================================================

async function sendSearchResults(
    chatId,
    results
) {


    try {


        if(
            results.length === 0
        ) {


            const message =
                await bot.sendMessage(

                    chatId,

`
❌ File not found.

⚠️ Type exact spelling.
Wrong spelling will not find the file.
                    `,

                    {

                        reply_markup: {

                            inline_keyboard:

                            [

                                [

                                    createUrlButton(

                                        "🔎 Google Search",

                                        "https://www.google.com/search?q="

                                    )

                                ],

                                [

                                    createUrlButton(

                                        "👤 Contact Admin",

                                        CONFIG.ADMIN_BOT_LINK

                                    )

                                ],

                                [

                                    createButton(

                                        "❌ Close",

                                        "close"

                                    )

                                ]

                            ]

                        }

                    }

                );



            await scheduleDelete(
                chatId,
                message.message_id
            );



            return message;


        }



        const message =
            await bot.sendMessage(

                chatId,

`
🔎 Search Results

Select your file:
                `,

                {

                    reply_markup: {

                        inline_keyboard:

                        createSearchButtons(
                            results
                        )

                    }

                }

            );



        await scheduleDelete(
            chatId,
            message.message_id
        );



        return message;


    }

    catch(error) {


        console.error(
            "Search Result Send Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// SEARCH TYPE FILTER
// ===================================================

async function searchByType(
    title,
    type
) {


    try {


        const result =
            await dbQuery(
                `
                SELECT *

                FROM contents

                WHERE title ILIKE $1

                AND type=$2

                ORDER BY created_at DESC;
                `,
                [

                    `%${title}%`,

                    type

                ]
            );



        return result.rows;


    }

    catch(error) {


        console.error(
            "Type Search Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// PART 1B-13 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-14
// Deep Link + Content Loader Base
// ===================================================


// ===================================================
// GET CONTENT TYPE
// ===================================================

function getContentType(
    content
) {


    if(
        !content ||
        !content.type
    ) {

        return null;

    }



    return content.type;


}



// ===================================================
// LOAD CONTENT BY DEEP LINK
// ===================================================

async function loadDeepLinkContent(
    contentId
) {


    try {


        const content =
            await getContentById(
                contentId
            );



        if(
            !content
        ) {


            return null;


        }



        return content;


    }

    catch(error) {


        console.error(
            "Deep Link Load Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// SAVE SEARCH STATE
// ===================================================

function setSearchState(
    userId,
    data
) {


    searchStates.set(
        userId,
        {

            ...data,

            created:
            Date.now()

        }
    );


}



// ===================================================
// GET SEARCH STATE
// ===================================================

function getSearchState(
    userId
) {


    return (
        searchStates.get(
            userId
        )
        ||
        null
    );


}



// ===================================================
// CLEAR SEARCH STATE
// ===================================================

function clearSearchState(
    userId
) {


    searchStates.delete(
        userId
    );


}



// ===================================================
// CHECK SEARCH TEXT
// ===================================================

function isSearchText(
    text
) {


    if(
        !text ||
        text.startsWith("/")
    ) {


        return false;


    }



    return true;


}



// ===================================================
// PROCESS USER SEARCH
// ===================================================

async function processUserSearch(
    chatId,
    userId,
    text
) {


    try {


        const searchText =
            normalizeText(
                text
            );



        setSearchState(

            userId,

            {

                query:
                searchText

            }

        );



        const results =
            await smartSearchContent(
                searchText
            );



        await sendSearchResults(
            chatId,
            results
        );



        return true;


    }

    catch(error) {


        console.error(
            "User Search Process Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// LOAD MOVIE FLOW DATA
// ===================================================

async function loadMovieFlow(
    contentId
) {


    try {


        const content =
            await getContentById(
                contentId
            );



        if(
            !content
        ) {


            return null;


        }



        const years =
            await getAvailableYears(
                content.title
            );



        return {

            content,

            years

        };


    }

    catch(error) {


        console.error(
            "Movie Flow Load Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// LOAD SERIES FLOW DATA
// ===================================================

async function loadSeriesFlow(
    collection
) {


    try {


        const seasons =
            await getAvailableSeasons(
                collection
            );



        return {

            collection,

            seasons

        };


    }

    catch(error) {


        console.error(
            "Series Flow Load Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// LOAD ANIME FLOW DATA
// ===================================================

async function loadAnimeFlow(
    collection
) {


    try {


        const seasons =
            await getAvailableSeasons(
                collection
            );



        return {

            collection,

            seasons

        };


    }

    catch(error) {


        console.error(
            "Anime Flow Load Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// PART 1B-14 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-15
// Movie Flow System
// ===================================================


// ===================================================
// SEND FETCHING MESSAGE
// ===================================================

async function sendFetchingMessage(
    chatId
) {


    try {


        const message =
            await bot.sendMessage(

                chatId,

`
⏳ Fetching Your File...

Please wait...
                `

            );



        return message;


    }

    catch(error) {


        console.error(
            "Fetching Message Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// SEND MOVIE YEAR SELECTION
// ===================================================

async function sendMovieYears(
    chatId,
    content
) {


    try {


        const years =
            await getAvailableYears(
                content.title
            );



        if(
            years.length === 0
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ No year available for this movie.
                `

            );


        }



        const buttons =
            createYearButtons(
                years,
                content.content_id
            );



        const message =
            await bot.sendMessage(

                chatId,

`
🎬 ${content.title}

Select Year:
                `,

                {

                    reply_markup: {

                        inline_keyboard:
                        buttons

                    }

                }

            );



        return message;


    }

    catch(error) {


        console.error(
            "Movie Year Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// SEND MOVIE QUALITY SELECTION
// ===================================================

async function sendMovieQualities(
    chatId,
    title,
    year
) {


    try {


        const qualities =
            await getAvailableQualities(
                title,
                year
            );



        if(
            qualities.length === 0
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ Quality file not available.
                `

            );


        }



        const buttons =
            createQualityButtons(

                qualities,

                `${encodeURIComponent(title)}_${year}`

            );



        const message =
            await bot.sendMessage(

                chatId,

`
🎞 ${title}

📅 Year: ${year}

Select Quality:
                `,

                {

                    reply_markup: {

                        inline_keyboard:
                        buttons

                    }

                }

            );



        return message;


    }

    catch(error) {


        console.error(
            "Movie Quality Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// HANDLE MOVIE QUALITY REQUEST
// ===================================================

async function handleMovieQuality(
    chatId,
    userId,
    title,
    year,
    quality
) {


    try {


        const fetching =
            await sendFetchingMessage(
                chatId
            );



        const content =
            await findMovieFile(

                title,

                Number(year),

                quality

            );



        if(
            fetching
        ) {


            try {

                await bot.deleteMessage(

                    chatId,

                    fetching.message_id

                );

            }

            catch(e){}

        }



        if(
            !content
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ File not found for selected quality.
                `

            );


        }



        const allowed =
            await verifyContentAccess(

                userId,

                content

            );



        if(
            !allowed
        ) {


            return sendPremiumMessage(
                chatId
            );


        }



        await sendVideoFile(

            chatId,

            content

        );



        return true;


    }

    catch(error) {


        console.error(
            "Movie Quality Handler Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// OPEN MOVIE CONTENT
// ===================================================

async function openMovieContent(
    chatId,
    userId,
    contentId
) {


    try {


        const content =
            await getContentById(
                contentId
            );



        if(
            !content
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ Movie not found.
                `

            );


        }



        await sendMovieYears(

            chatId,

            content

        );



    }

    catch(error) {


        console.error(
            "Open Movie Error:",
            error.message
        );


    }

}



// ===================================================
// PART 1B-15 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-16
// Series Flow System
// ===================================================


// ===================================================
// SEND SERIES SEASONS
// ===================================================

async function sendSeriesSeasons(
    chatId,
    collection
) {

    try {


        const seasons =
            await getAvailableSeasons(
                collection
            );



        if(
            seasons.length === 0
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ No seasons available.
                `

            );


        }



        const buttons =
            createSeasonButtons(

                seasons,

                collection

            );



        const message =
            await bot.sendMessage(

                chatId,

`
📺 ${collection}

Select Season:
                `,

                {

                    reply_markup: {

                        inline_keyboard:
                        buttons

                    }

                }

            );



        return message;


    }

    catch(error) {


        console.error(
            "Series Season Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// SEND EPISODES
// ===================================================

async function sendSeriesEpisodes(
    chatId,
    collection,
    season
) {


    try {


        const episodes =
            await getAvailableEpisodes(

                collection,

                season

            );



        if(
            episodes.length === 0
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ No episodes available.
                `

            );


        }



        const buttons =
            createEpisodeButtons(

                episodes,

                collection,

                season

            );



        buttons.push(

            ...createAllEpisodesButton(

                collection,

                season

            )

        );



        const message =
            await bot.sendMessage(

                chatId,

`
📺 ${collection}

Season: ${season}

Select Episode:
                `,

                {

                    reply_markup: {

                        inline_keyboard:
                        buttons

                    }

                }

            );



        return message;


    }

    catch(error) {


        console.error(
            "Episode Button Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// SEND EPISODE QUALITY
// ===================================================

async function sendEpisodeQuality(
    chatId,
    collection,
    season,
    episode
) {


    try {


        const result =
            await dbQuery(

                `
                SELECT DISTINCT quality

                FROM contents

                WHERE collection ILIKE $1

                AND season=$2

                AND episode=$3;
                `,

                [

                    `%${collection}%`,

                    season,

                    episode

                ]

            );



        const qualities =
            result.rows.map(

                row => row.quality

            );



        const buttons =
            createQualityButtons(

                qualities,

                `${encodeURIComponent(collection)}_${season}_${episode}`

            );



        const message =
            await bot.sendMessage(

                chatId,

`
📺 ${collection}

Season: ${season}

Episode: ${episode}

Select Quality:
                `,

                {

                    reply_markup: {

                        inline_keyboard:
                        buttons

                    }

                }

            );



        return message;


    }

    catch(error) {


        console.error(
            "Episode Quality Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// SEND SINGLE EPISODE
// ===================================================

async function sendEpisodeFile(
    chatId,
    userId,
    collection,
    season,
    episode,
    quality
) {


    try {


        const fetching =
            await sendFetchingMessage(
                chatId
            );



        const content =
            await getEpisodeFile(

                collection,

                Number(season),

                Number(episode),

                quality

            );



        if(fetching) {


            try {

                await bot.deleteMessage(

                    chatId,

                    fetching.message_id

                );

            }

            catch(e){}


        }



        if(
            !content
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ Episode file not found.
                `

            );


        }



        const access =
            await verifyContentAccess(

                userId,

                content

            );



        if(
            !access
        ) {


            return sendPremiumMessage(
                chatId
            );


        }



        await sendVideoFile(

            chatId,

            content

        );



        return true;


    }

    catch(error) {


        console.error(
            "Episode Send Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// SEND ALL EPISODES
// ===================================================

async function sendAllEpisodes(
    chatId,
    userId,
    collection,
    season
) {


    try {


        const episodes =
            await getAllEpisodes(

                collection,

                Number(season)

            );



        if(
            episodes.length === 0
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ No episodes found.
                `

            );


        }



        for(
            const episode of episodes
        ) {


            const access =
                await verifyContentAccess(

                    userId,

                    episode

                );



            if(
                !access
            ) {


                continue;


            }



            await sendVideoFile(

                chatId,

                episode

            );


        }



        return true;


    }

    catch(error) {


        console.error(
            "Send All Episodes Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// PART 1B-16 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-17
// Anime Flow System
// ===================================================


// ===================================================
// SEND ANIME SEASONS
// ===================================================

async function sendAnimeSeasons(
    chatId,
    collection
) {

    try {


        const seasons =
            await getAvailableSeasons(
                collection
            );



        if(
            seasons.length === 0
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ No seasons available.
                `

            );


        }



        const buttons =
            createSeasonButtons(

                seasons,

                collection

            );



        const message =
            await bot.sendMessage(

                chatId,

`
🎌 ${collection}

Select Season:
                `,

                {

                    reply_markup: {

                        inline_keyboard:
                        buttons

                    }

                }

            );



        return message;


    }

    catch(error) {


        console.error(
            "Anime Season Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// SEND ANIME EPISODES
// ===================================================

async function sendAnimeEpisodes(
    chatId,
    collection,
    season
) {


    try {


        const episodes =
            await getAvailableEpisodes(

                collection,

                season

            );



        if(
            episodes.length === 0
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ No episodes available.
                `

            );


        }



        const buttons =
            createEpisodeButtons(

                episodes,

                collection,

                season

            );



        buttons.push(

            ...createAllEpisodesButton(

                collection,

                season

            )

        );



        const message =
            await bot.sendMessage(

                chatId,

`
🎌 ${collection}

Season: ${season}

Select Episode:
                `,

                {

                    reply_markup: {

                        inline_keyboard:
                        buttons

                    }

                }

            );



        return message;


    }

    catch(error) {


        console.error(
            "Anime Episode Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// SEND ANIME QUALITY
// ===================================================

async function sendAnimeQuality(
    chatId,
    collection,
    season,
    episode
) {


    try {


        const result =
            await dbQuery(

                `
                SELECT DISTINCT quality

                FROM contents

                WHERE collection ILIKE $1

                AND season=$2

                AND episode=$3;
                `,

                [

                    `%${collection}%`,

                    season,

                    episode

                ]

            );



        const qualities =
            result.rows.map(

                row => row.quality

            );



        const buttons =
            createQualityButtons(

                qualities,

                `${encodeURIComponent(collection)}_${season}_${episode}`

            );



        const message =
            await bot.sendMessage(

                chatId,

`
🎌 ${collection}

Season: ${season}

Episode: ${episode}

Select Quality:
                `,

                {

                    reply_markup: {

                        inline_keyboard:
                        buttons

                    }

                }

            );



        return message;


    }

    catch(error) {


        console.error(
            "Anime Quality Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// SEND ANIME EPISODE FILE
// ===================================================

async function sendAnimeFile(
    chatId,
    userId,
    collection,
    season,
    episode,
    quality
) {


    try {


        const fetching =
            await sendFetchingMessage(
                chatId
            );



        const content =
            await getEpisodeFile(

                collection,

                Number(season),

                Number(episode),

                quality

            );



        if(fetching) {


            try {


                await bot.deleteMessage(

                    chatId,

                    fetching.message_id

                );


            }

            catch(e){}


        }



        if(
            !content
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ Anime episode not found.
                `

            );


        }



        const access =
            await verifyContentAccess(

                userId,

                content

            );



        if(
            !access
        ) {


            return sendPremiumMessage(
                chatId
            );


        }



        await sendVideoFile(

            chatId,

            content

        );



        return true;


    }

    catch(error) {


        console.error(
            "Anime File Send Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// SEND ALL ANIME EPISODES
// ===================================================

async function sendAllAnimeEpisodes(
    chatId,
    userId,
    collection,
    season
) {


    try {


        const episodes =
            await getAllEpisodes(

                collection,

                Number(season)

            );



        if(
            episodes.length === 0
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ No anime episodes found.
                `

            );


        }



        for(
            const episode of episodes
        ) {


            const access =
                await verifyContentAccess(

                    userId,

                    episode

                );
            


            if(
                !access
            ) {


                continue;


            }



            await sendVideoFile(

                chatId,

                episode

            );


        }



        return true;


    }

    catch(error) {


        console.error(
            "All Anime Episode Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// PART 1B-17 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-18
// File Sending System
// ===================================================


// ===================================================
// FORMAT VIDEO CAPTION
// ===================================================

function formatVideoCaption(
    content
) {


    try {


        let caption = "";



        if(
            content.type
            ===
            "Movie"
        ) {


            caption +=
`
🎬 ${content.title}

`;

        }


        else if(
            content.type
            ===
            "Series"
        ) {


            caption +=
`
📺 ${content.title}

`;

        }


        else if(
            content.type
            ===
            "Anime"
        ) {


            caption +=
`
🎌 ${content.title}

`;

        }



        caption +=
`
📅 Year: ${content.year || "N/A"}

`;



        if(
            content.collection
        ) {


            caption +=
`📂 Collection: ${content.collection}

`;

        }



        if(
            content.season
        ) {


            caption +=
`🎞 Season: ${content.season}

`;

        }



        if(
            content.episode
        ) {


            caption +=
`▶️ Episode: ${content.episode}

`;

        }



        caption +=
`🎞 Quality: ${content.quality || "N/A"}

`;



        caption +=
`🔊 Audio: ${content.audio || "N/A"}

`;



        caption +=
`🌐 Language: ${content.language || "N/A"}

`;



        caption +=
`📦 Size: ${content.size || "N/A"}

`;



        caption +=
`
⭐ Powered by CineXClub
`;



        return caption;


    }

    catch(error) {


        console.error(
            "Caption Format Error:",
            error.message
        );


        return "CineXClub File";


    }

}



// ===================================================
// TELEGRAM ERROR HANDLER
// ===================================================

function getTelegramError(
    error
) {


    try {


        if(
            error.response &&
            error.response.body &&
            error.response.body.description
        ) {


            return error.response.body.description;


        }



        return error.message
        ||
        "Unknown Telegram Error";


    }

    catch(e) {


        return "Telegram API Error";


    }

}



// ===================================================
// SAFE VIDEO SEND
// ===================================================

async function safeSendVideo(
    chatId,
    fileId,
    caption
) {


    try {


        const message =
            await bot.sendVideo(

                chatId,

                fileId,

                {

                    caption,

                    parse_mode:
                    "HTML"

                }

            );



        await scheduleDelete(

            chatId,

            message.message_id

        );



        return message;


    }

    catch(error) {


        const reason =
            getTelegramError(
                error
            );



        console.error(
            "Telegram Video Error:",
            reason
        );



        await uploadFailedLog(
            `Telegram API error: ${reason}`
        );



        return null;


    }

}



// ===================================================
// IMPROVED VIDEO SENDER
// ===================================================

async function sendContentFile(
    chatId,
    content
) {


    try {


        if(
            !content ||
            !content.file_id
        ) {


            console.error(
                "File ID missing"
            );


            return null;


        }



        const caption =
            formatVideoCaption(
                content
            );



        return await safeSendVideo(

            chatId,

            content.file_id,

            caption

        );


    }

    catch(error) {


        console.error(
            "Content Send Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// PREMIUM FILE CHECK BEFORE SEND
// ===================================================

async function sendWithAccessCheck(
    chatId,
    userId,
    content
) {


    try {


        const allowed =
            await verifyContentAccess(

                userId,

                content

            );



        if(
            !allowed
        ) {


            return await sendPremiumMessage(
                chatId
            );


        }



        return await sendContentFile(

            chatId,

            content

        );


    }

    catch(error) {


        console.error(
            "Access Send Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// PART 1B-18 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-19
// Admin Panel Base
// ===================================================


// ===================================================
// ADMIN MENU KEYBOARD
// ===================================================

function getAdminMenuKeyboard() {


    return {

        inline_keyboard:

        [

            [

                {

                    text:
                    "📤 Upload",

                    callback_data:
                    "admin_upload"

                },

                {

                    text:
                    "📁 Uploaded Files",

                    callback_data:
                    "admin_files"

                }

            ],


            [

                {

                    text:
                    "📊 Statistics",

                    callback_data:
                    "admin_stats"

                },

                {

                    text:
                    "📢 Broadcast",

                    callback_data:
                    "admin_broadcast"

                }

            ],


            [

                {

                    text:
                    "📥 Requests",

                    callback_data:
                    "admin_requests"

                }

            ],


            [

                {

                    text:
                    "🖼 Welcome Settings",

                    callback_data:
                    "admin_welcome"

                }

            ],


            [

                {

                    text:
                    "⚙ Bot Settings",

                    callback_data:
                    "admin_settings"

                }

            ],


            [

                {

                    text:
                    "🚫 Ban Users",

                    callback_data:
                    "admin_ban"

                }

            ],


            [

                {

                    text:
                    "❌ Close",

                    callback_data:
                    "close"

                }

            ]

        ]

    };


}



// ===================================================
// OPEN ADMIN PANEL
// ===================================================

async function openAdminPanel(
    chatId,
    userId
) {


    try {


        const access =
            await requireAdmin(
                userId
            );



        if(
            !access
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ You are not authorized.
                `

            );


        }



        const message =
            await bot.sendMessage(

                chatId,

`
👑 CineXClub Admin Panel

Select an option:
                `,

                {

                    reply_markup:
                    getAdminMenuKeyboard()

                }

            );



        return message;


    }

    catch(error) {


        console.error(
            "Admin Panel Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// ADMIN ACTION CHECK
// ===================================================

async function verifyAdminAction(
    query
) {


    try {


        if(
            !query ||
            !query.from
        ) {


            return false;


        }



        return isAdmin(
            query.from.id
        );


    }

    catch(error) {


        console.error(
            "Admin Action Check Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// ADMIN STATISTICS MESSAGE
// ===================================================

async function sendAdminStatistics(
    chatId
) {


    try {


        const stats =
            await getStatistics();



        if(
            !stats
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ Statistics unavailable.
                `

            );


        }



        const message =
            await bot.sendMessage(

                chatId,

`
📊 CineXClub Statistics


👥 Users:
${stats.users}


🎬 Movies:
${stats.movies}


📺 Series:
${stats.series}


🎌 Anime:
${stats.anime}


⭐ Premium Files:
${stats.premiumFiles}


📥 Requests:
${stats.requests}


🚫 Banned Users:
${stats.banned}
                `

            );



        return message;


    }

    catch(error) {


        console.error(
            "Admin Statistics Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// ADMIN CLOSE PANEL
// ===================================================

async function closeAdminPanel(
    query
) {


    try {


        await bot.answerCallbackQuery(

            query.id

        );



        await bot.deleteMessage(

            query.message.chat.id,

            query.message.message_id

        );


    }

    catch(error) {


        console.error(
            "Admin Close Error:",
            error.message
        );


    }

}



// ===================================================
// PART 1B-19 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-20
// Admin Upload Wizard Base
// ===================================================


// ===================================================
// START UPLOAD SESSION
// ===================================================

function startUploadSession(
    userId
) {


    uploadStates.set(

        userId,

        {

            step:
            "type",

            data:{}

        }

    );


}



// ===================================================
// GET UPLOAD SESSION
// ===================================================

function getUploadSession(
    userId
) {


    return (

        uploadStates.get(
            userId
        )
        ||
        null

    );


}



// ===================================================
// UPDATE UPLOAD SESSION
// ===================================================

function updateUploadSession(
    userId,
    key,
    value
) {


    const session =
        getUploadSession(
            userId
        );



    if(
        !session
    ) {


        return false;


    }



    session.data[key] =
        value;



    uploadStates.set(

        userId,

        session

    );



    return true;


}



// ===================================================
// CLEAR UPLOAD SESSION
// ===================================================

function clearUploadSession(
    userId
) {


    uploadStates.delete(
        userId
    );


}



// ===================================================
// UPLOAD TYPE BUTTONS
// ===================================================

function getUploadTypeButtons() {


    return {

        inline_keyboard:

        [

            [

                {

                    text:
                    "🎬 Movie",

                    callback_data:
                    "upload_type_Movie"

                },

                {

                    text:
                    "📺 Series",

                    callback_data:
                    "upload_type_Series"

                }

            ],


            [

                {

                    text:
                    "🎌 Anime",

                    callback_data:
                    "upload_type_Anime"

                }

            ],


            [

                {

                    text:
                    "❌ Cancel",

                    callback_data:
                    "upload_cancel"

                }

            ]

        ]

    };


}



// ===================================================
// ACCESS BUTTONS
// ===================================================

function getUploadAccessButtons() {


    return {

        inline_keyboard:

        [

            [

                {

                    text:
                    "🌍 Normal",

                    callback_data:
                    "upload_access_normal"

                },

                {

                    text:
                    "⭐ Premium Only",

                    callback_data:
                    "upload_access_premium"

                }

            ]

        ]

    };


}



// ===================================================
// QUALITY BUTTONS FOR UPLOAD
// ===================================================

function getUploadQualityButtons() {


    return {

        inline_keyboard:

        [

            [

                {

                    text:
                    "480p",

                    callback_data:
                    "upload_quality_480p"

                },

                {

                    text:
                    "720p",

                    callback_data:
                    "upload_quality_720p"

                }

            ],


            [

                {

                    text:
                    "1080p",

                    callback_data:
                    "upload_quality_1080p"

                }

            ]

        ]

    };


}



// ===================================================
// OPEN UPLOAD MENU
// ===================================================

async function openUploadMenu(
    chatId,
    userId
) {


    try {


        const admin =
            await requireAdmin(
                userId
            );



        if(
            !admin
        ) {


            return false;


        }



        startUploadSession(
            userId
        );



        await bot.sendMessage(

            chatId,

`
📤 Upload Content

Select Type:
            `,

            {

                reply_markup:
                getUploadTypeButtons()

            }

        );



        return true;


    }

    catch(error) {


        console.error(
            "Upload Menu Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// REQUEST UPLOAD CAPTION
// ===================================================

async function requestUploadCaption(
    chatId
) {


    await bot.sendMessage(

        chatId,

`
📝 Send file caption now.

Required format:

ID:
Title:
Type:
Year:
Quality:
Audio:
Language:
Size:
        `

    );


}



// ===================================================
// REQUEST UPLOAD FILE
// ===================================================

async function requestUploadFile(
    chatId
) {


    await bot.sendMessage(

        chatId,

`
📁 Now send the video file.
        `

    );


}



// ===================================================
// PART 1B-20 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-21
// Upload Callback Flow
// ===================================================


// ===================================================
// HANDLE UPLOAD TYPE
// ===================================================

async function handleUploadType(
    query
) {


    try {


        const userId =
            query.from.id;



        const type =
            query.data
            .replace(
                "upload_type_",
                ""
            );



        updateUploadSession(

            userId,

            "type",

            type

        );



        await bot.answerCallbackQuery(
            query.id
        );



        await bot.editMessageText(

`
📤 Upload Type:

${type}

Select Access:
            `,

            {

                chat_id:
                query.message.chat.id,

                message_id:
                query.message.message_id,

                reply_markup:
                getUploadAccessButtons()

            }

        );


    }

    catch(error) {


        console.error(
            "Upload Type Error:",
            error.message
        );


    }

}



// ===================================================
// HANDLE UPLOAD ACCESS
// ===================================================

async function handleUploadAccess(
    query
) {


    try {


        const userId =
            query.from.id;



        const access =
            query.data
            .replace(
                "upload_access_",
                ""
            );



        updateUploadSession(

            userId,

            "access_type",

            access

        );



        await bot.answerCallbackQuery(
            query.id
        );



        await bot.editMessageText(

`
🔐 Access:

${access}

Select Quality:
            `,

            {

                chat_id:
                query.message.chat.id,

                message_id:
                query.message.message_id,

                reply_markup:
                getUploadQualityButtons()

            }

        );


    }

    catch(error) {


        console.error(
            "Upload Access Error:",
            error.message
        );


    }

}



// ===================================================
// HANDLE UPLOAD QUALITY
// ===================================================

async function handleUploadQuality(
    query
) {


    try {


        const userId =
            query.from.id;



        const quality =
            query.data
            .replace(
                "upload_quality_",
                ""
            );



        updateUploadSession(

            userId,

            "quality",

            quality

        );



        await bot.answerCallbackQuery(
            query.id
        );



        await bot.editMessageText(

`
🎞 Quality:

${quality}

Now send caption.
            `,

            {

                chat_id:
                query.message.chat.id,

                message_id:
                query.message.message_id

            }

        );



        updateUploadSession(

            userId,

            "step",

            "caption"

        );


    }

    catch(error) {


        console.error(
            "Upload Quality Error:",
            error.message
        );


    }

}



// ===================================================
// CANCEL UPLOAD
// ===================================================

async function cancelUpload(
    query
) {


    try {


        clearUploadSession(

            query.from.id

        );



        await bot.answerCallbackQuery(

            query.id

        );



        await bot.editMessageText(

`
❌ Upload cancelled.
            `,

            {

                chat_id:
                query.message.chat.id,

                message_id:
                query.message.message_id

            }

        );


    }

    catch(error) {


        console.error(
            "Cancel Upload Error:",
            error.message
        );


    }

}



// ===================================================
// SAVE CAPTION TO SESSION
// ===================================================

function saveUploadCaption(
    userId,
    caption
) {


    const session =
        getUploadSession(
            userId
        );



    if(
        !session
    ) {


        return false;


    }



    session.data.caption =
        caption;



    session.step =
        "file";



    uploadStates.set(

        userId,

        session

    );



    return true;


}



// ===================================================
// SAVE FILE TO SESSION
// ===================================================

function saveUploadFile(
    userId,
    fileId
) {


    const session =
        getUploadSession(
            userId
        );



    if(
        !session
    ) {


        return false;


    }



    session.data.file_id =
        fileId;



    session.step =
        "verify";



    uploadStates.set(

        userId,

        session

    );



    return true;


}



// ===================================================
// PART 1B-21 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-22
// Upload Validation + Database Save
// ===================================================


// ===================================================
// PARSE UPLOAD CAPTION
// ===================================================

function parseUploadCaption(
    caption
) {


    try {


        const data = {};



        const lines =
            caption
            .split("\n");



        for(
            const line of lines
        ) {


            const parts =
                line.split(":");



            if(
                parts.length < 2
            ) {

                continue;

            }



            const key =
                parts[0]
                .trim()
                .toLowerCase();



            const value =
                parts
                .slice(1)
                .join(":")
                .trim();



            data[key] =
                value;


        }



        return {


            content_id:
            data.id || null,


            title:
            data.title || null,


            type:
            data.type || null,


            collection:
            data.collection || null,


            year:
            data.year
            ?
            Number(data.year)
            :
            null,


            season:
            data.season
            ?
            Number(data.season)
            :
            null,


            episode:
            data.episode
            ?
            Number(data.episode)
            :
            null,


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

    catch(error) {


        console.error(
            "Caption Parse Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// VALIDATE CAPTION
// ===================================================

function validateUploadCaption(
    data
) {


    if(
        !data
    ) {


        return {

            valid:false,

            reason:
            "Caption invalid"

        };


    }



    const required = [

        "content_id",

        "title",

        "type"

    ];



    for(
        const field of required
    ) {


        if(
            !data[field]
        ) {


            return {

                valid:false,

                reason:
                `${field} missing`

            };


        }


    }



    const allowedTypes = [

        "Movie",

        "Series",

        "Anime"

    ];



    if(
        !allowedTypes.includes(
            data.type
        )
    ) {


        return {

            valid:false,

            reason:
            "Invalid content type"

        };


    }



    return {

        valid:true,

        reason:null

    };


}



// ===================================================
// CHECK DUPLICATE CONTENT
// ===================================================

async function checkDuplicateContent(
    contentId
) {


    try {


        const result =
            await dbQuery(

                `
                SELECT id

                FROM contents

                WHERE content_id=$1;

                `,

                [
                    contentId
                ]

            );



        return (
            result.rows.length > 0
        );


    }

    catch(error) {


        console.error(
            "Duplicate Check Error:",
            error.message
        );


        return true;


    }

}



// ===================================================
// SAVE UPLOADED CONTENT
// ===================================================

async function saveUploadedContent(
    data
) {


    try {


        const duplicate =
            await checkDuplicateContent(

                data.content_id

            );



        if(
            duplicate
        ) {


            throw new Error(
                "Duplicate content"
            );


        }



        const result =
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
access_type,
file_id
)

VALUES
(
$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
)

RETURNING *;
`,

[

data.content_id,

data.title,

data.type,

data.collection,

data.year,

data.season,

data.episode,

data.quality,

data.audio,

data.size,

data.language,

data.access_type,

data.file_id

]

);



        await addLog(

            "Upload Success",

            `Title: ${data.title}`

        );



        return result.rows[0];


    }

    catch(error) {


        console.error(
            "Database Save Error:",
            error.message
        );



        await addLog(

            "Upload Failed",

            error.message

        );



        return null;


    }

}



// ===================================================
// VERIFY UPLOAD BEFORE SAVE
// ===================================================

async function verifyUploadData(
    session
) {


    try {


        if(
            !session
        ) {


            return {

                valid:false,

                reason:
                "Upload session missing"

            };


        }



        if(
            !session.data.file_id
        ) {


            return {

                valid:false,

                reason:
                "File ID missing"

            };


        }



        const captionData =
            parseUploadCaption(

                session.data.caption

            );



        if(
            !captionData
        ) {


            return {

                valid:false,

                reason:
                "Caption invalid"

            };


        }



        Object.assign(

            captionData,

            {

                access_type:
                session.data.access_type,


                quality:
                session.data.quality,


                file_id:
                session.data.file_id

            }

        );



        const validation =
            validateUploadCaption(

                captionData

            );



        if(
            !validation.valid
        ) {


            return validation;


        }



        return {

            valid:true,

            data:
            captionData

        };


    }

    catch(error) {


        console.error(
            "Upload Verify Error:",
            error.message
        );


        return {

            valid:false,

            reason:
            error.message

        };


    }

}



// ===================================================
// PART 1B-22 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-23
// Upload File Receive System
// ===================================================


// ===================================================
// EXTRACT TELEGRAM FILE ID
// ===================================================

function extractFileId(
    message
) {


    try {


        if(
            message.video
        ) {


            return message.video.file_id;


        }



        if(
            message.document
        ) {


            return message.document.file_id;


        }



        return null;


    }

    catch(error) {


        console.error(
            "File ID Extract Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// HANDLE UPLOAD FILE
// ===================================================

async function handleUploadFile(
    message
) {


    try {


        const userId =
            message.from.id;



        const session =
            getUploadSession(
                userId
            );



        if(
            !session
        ) {


            return false;


        }



        const fileId =
            extractFileId(
                message
            );



        if(
            !fileId
        ) {


            await bot.sendMessage(

                message.chat.id,

`
❌ Upload Failed

Reason:
File ID missing

Send a valid video file.
                `

            );


            await addLog(

                "Upload Failed",

                "File ID missing"

            );


            return false;


        }



        saveUploadFile(

            userId,

            fileId

        );



        const verify =
            await verifyUploadData(
                getUploadSession(
                    userId
                )
            );



        if(
            !verify.valid
        ) {


            await bot.sendMessage(

                message.chat.id,

`
❌ Upload Failed

Reason:
${verify.reason}
                `

            );


            await addLog(

                "Upload Failed",

                verify.reason

            );


            clearUploadSession(
                userId
            );


            return false;


        }



        const saved =
            await saveUploadedContent(

                verify.data

            );



        if(
            !saved
        ) {


            await bot.sendMessage(

                message.chat.id,

`
❌ Upload Failed

Reason:
Database failed
                `

            );


            clearUploadSession(
                userId
            );


            return false;


        }



        await bot.sendMessage(

            message.chat.id,

`
✅ Upload Successful


🎬 Title:
${saved.title}


🆔 ID:
${saved.content_id}


🎞 Quality:
${saved.quality}


🔐 Access:
${saved.access_type}


Search is now ready.
            `

        );



        clearUploadSession(

            userId

        );



        return true;


    }

    catch(error) {


        console.error(

            "Upload Handler Error:",

            error.message

        );



        await addLog(

            "Upload Failed",

            error.message

        );



        return false;


    }

}



// ===================================================
// SEND UPLOAD FAILURE MESSAGE
// ===================================================

async function sendUploadFailure(
    chatId,
    reason
) {


    try {


        await bot.sendMessage(

            chatId,

`
❌ Upload Failed

Reason:
${reason}
            `

        );


    }

    catch(error) {


        console.error(

            "Failure Message Error:",

            error.message

        );


    }

}



// ===================================================
// VERIFY TELEGRAM MEDIA
// ===================================================

function isValidMedia(
    message
) {


    return !!(

        message.video
        ||
        message.document

    );


}



// ===================================================
// PROCESS UPLOAD MESSAGE
// ===================================================

async function processUploadMessage(
    message
) {


    try {


        const userId =
            message.from.id;



        const session =
            getUploadSession(
                userId
            );



        if(
            !session
        ) {


            return false;


        }



        if(
            session.step === "caption"
        ) {


            saveUploadCaption(

                userId,

                message.text

            );



            await bot.sendMessage(

                message.chat.id,

`
✅ Caption Saved

Now send video file.
                `

            );



            return true;


        }



        if(
            session.step === "file"
            &&
            isValidMedia(message)
        ) {


            return await handleUploadFile(
                message
            );


        }



        return false;


    }

    catch(error) {


        console.error(

            "Process Upload Message Error:",

            error.message

        );


        return false;


    }

}



// ===================================================
// PART 1B-23 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-24
// Admin Uploaded Files Management
// ===================================================


// ===================================================
// SEARCH UPLOADED FILES BY TITLE
// ===================================================

async function searchUploadedFiles(
    title
) {


    try {


        const result =
            await dbQuery(

`
SELECT *

FROM contents

WHERE title ILIKE $1

ORDER BY created_at DESC;
`,

[

`%${title}%`

]

            );



        return result.rows;


    }

    catch(error) {


        console.error(
            "Admin File Search Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// CREATE ADMIN FILE BUTTONS
// ===================================================

function createAdminFileButtons(
    files
) {


    const buttons = [];



    for(
        const file of files
    ) {


        buttons.push(

            [

                {

                    text:
                    file.title,

                    callback_data:
                    `admin_open_file_${file.id}`

                }

            ]

        );


    }



    buttons.push(

        [

            {

                text:
                "❌ Close",

                callback_data:
                "close"

            }

        ]

    );



    return buttons;


}



// ===================================================
// SEND ADMIN FILE SEARCH RESULTS
// ===================================================

async function sendAdminFileResults(
    chatId,
    files
) {


    try {


        if(
            files.length === 0
        ) {


            return bot.sendMessage(

                chatId,

`
❌ No uploaded files found.
                `

            );


        }



        return bot.sendMessage(

            chatId,

`
📁 Uploaded Files

Select a file:
            `,

            {

                reply_markup:

                {

                    inline_keyboard:

                    createAdminFileButtons(
                        files
                    )

                }

            }

        );


    }

    catch(error) {


        console.error(
            "Admin File Result Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// GET CONTENT BY DATABASE ID
// ===================================================

async function getContentByDatabaseId(
    id
) {


    try {


        const result =
            await dbQuery(

`
SELECT *

FROM contents

WHERE id=$1

LIMIT 1;
`,

[
id
]

            );



        if(
            result.rows.length === 0
        ) {


            return null;


        }



        return result.rows[0];


    }

    catch(error) {


        console.error(
            "Content ID Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// ADMIN FILE DETAILS
// ===================================================

async function sendAdminFileDetails(
    chatId,
    content
) {


    try {


        const message =
            await bot.sendMessage(

                chatId,

`
📁 File Details


🎬 Title:
${content.title}


🆔 ID:
${content.content_id}


📂 Type:
${content.type}


🎞 Quality:
${content.quality}


🔐 Access:
${content.access_type}
                `,

                {

                    reply_markup:

                    {

                        inline_keyboard:

                        [

                            [

                                {

                                    text:
                                    "📤 Resend",

                                    callback_data:
                                    `resend_file_${content.id}`

                                }

                            ],

                            [

                                {

                                    text:
                                    "🔐 Change Access",

                                    callback_data:
                                    `change_access_${content.id}`

                                }

                            ],

                            [

                                {

                                    text:
                                    "🗑 Delete",

                                    callback_data:
                                    `delete_file_${content.id}`

                                }

                            ],

                            [

                                {

                                    text:
                                    "❌ Close",

                                    callback_data:
                                    "close"

                                }

                            ]

                        ]

                    }

                }

            );



        return message;


    }

    catch(error) {


        console.error(
            "File Details Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// RESEND FILE
// ===================================================

async function resendAdminFile(
    chatId,
    content
) {


    try {


        return await sendContentFile(

            chatId,

            content

        );


    }

    catch(error) {


        console.error(
            "Resend File Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// DELETE FILE FROM DATABASE
// ===================================================

async function deleteContentFile(
    id
) {


    try {


        await dbQuery(

`
DELETE FROM contents

WHERE id=$1;
`,

[
id
]

        );



        await addLog(

            "File Deleted",

            `Database ID: ${id}`

        );



        return true;


    }

    catch(error) {


        console.error(
            "Delete File Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// CHANGE CONTENT ACCESS
// ===================================================

async function changeContentAccess(
    id,
    access
) {


    try {


        await dbQuery(

`
UPDATE contents

SET access_type=$1

WHERE id=$2;
`,

[

access,

id

]

        );



        await addLog(

            "Access Changed",

            `File: ${id} | Access: ${access}`

        );



        return true;


    }

    catch(error) {


        console.error(
            "Change Access Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// PART 1B-24 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-25
// Welcome Settings Admin System
// ===================================================


// ===================================================
// GET WELCOME SETTINGS
// ===================================================

async function getWelcomeSettings() {


    try {


        const result =
            await dbQuery(
`
SELECT setting_key, setting_value

FROM settings

WHERE setting_key IN
(
'welcome_images',
'welcome_caption'
);
`
            );



        const settings = {};



        for(
            const row of result.rows
        ) {


            settings[row.setting_key] =
                row.setting_value;


        }



        return settings;


    }

    catch(error) {


        console.error(
            "Welcome Settings Error:",
            error.message
        );


        return {};


    }

}



// ===================================================
// SAVE WELCOME IMAGE
// ===================================================

async function saveWelcomeImage(
    fileId
) {


    try {


        const current =
            getWelcomeImages();



        if(
            current.length >= 3
        ) {


            current.shift();


        }



        current.push(
            fileId
        );



        await dbQuery(

`
INSERT INTO settings
(
setting_key,
setting_value
)

VALUES
(
'welcome_images',
$1
)

ON CONFLICT(setting_key)

DO UPDATE SET

setting_value=$1;
`,

[

JSON.stringify(
    current
)

]

        );



        botSettings.welcome_images =
            JSON.stringify(
                current
            );



        await addLog(

            "Welcome Image Changed",

            "New welcome image added"

        );



        return true;


    }

    catch(error) {


        console.error(
            "Save Welcome Image Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// REMOVE WELCOME IMAGES
// ===================================================

async function removeWelcomeImages() {


    try {


        await dbQuery(

`
UPDATE settings

SET setting_value='[]'

WHERE setting_key='welcome_images';
`

        );



        botSettings.welcome_images =
            "[]";



        await addLog(

            "Welcome Image Changed",

            "All welcome images removed"

        );



        return true;


    }

    catch(error) {


        console.error(
            "Remove Welcome Image Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// SAVE WELCOME CAPTION
// ===================================================

async function saveWelcomeCaption(
    caption
) {


    try {


        await dbQuery(

`
INSERT INTO settings
(
setting_key,
setting_value
)

VALUES
(
'welcome_caption',
$1
)

ON CONFLICT(setting_key)

DO UPDATE SET

setting_value=$1;
`,

[

caption

]

        );



        botSettings.welcome_caption =
            caption;



        await addLog(

            "Welcome Caption Changed",

            caption

        );



        return true;


    }

    catch(error) {


        console.error(
            "Save Welcome Caption Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// WELCOME SETTINGS KEYBOARD
// ===================================================

function getWelcomeSettingsKeyboard() {


    return {


        inline_keyboard:

        [

            [

                {

                    text:
                    "🖼 Add Image",

                    callback_data:
                    "welcome_add_image"

                }

            ],


            [

                {

                    text:
                    "🗑 Remove Images",

                    callback_data:
                    "welcome_remove_images"

                }

            ],


            [

                {

                    text:
                    "✏️ Change Caption",

                    callback_data:
                    "welcome_change_caption"

                }

            ],


            [

                {

                    text:
                    "❌ Close",

                    callback_data:
                    "close"

                }

            ]

        ]

    };


}



// ===================================================
// OPEN WELCOME SETTINGS
// ===================================================

async function openWelcomeSettings(
    chatId
) {


    try {


        await bot.sendMessage(

            chatId,

`
🖼 Welcome Settings

Manage welcome images and caption.
            `,

            {

                reply_markup:

                getWelcomeSettingsKeyboard()

            }

        );


    }

    catch(error) {


        console.error(
            "Open Welcome Settings Error:",
            error.message
        );


    }

}



// ===================================================
// PART 1B-25 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-26
// Bot Settings + Auto Delete System
// ===================================================


// ===================================================
// GET BOT SETTINGS
// ===================================================

async function getBotSettings() {


    try {


        const result =
            await dbQuery(
`
SELECT setting_key, setting_value

FROM settings;
`
            );



        const settings = {};



        for(
            const row of result.rows
        ) {


            settings[row.setting_key] =
                row.setting_value;


        }



        return settings;


    }

    catch(error) {


        console.error(
            "Bot Settings Load Error:",
            error.message
        );


        return {};


    }

}



// ===================================================
// SAVE BOT SETTING
// ===================================================

async function saveBotSetting(
    key,
    value
) {


    try {


        await dbQuery(

`
INSERT INTO settings
(
setting_key,
setting_value
)

VALUES
(
$1,
$2
)

ON CONFLICT(setting_key)

DO UPDATE SET

setting_value=$2;
`,

[
    key,
    value
]

        );



        botSettings[key] =
            value;



        await addLog(

            "Settings Changed",

            `${key}: ${value}`

        );



        return true;


    }

    catch(error) {


        console.error(
            "Save Setting Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// AUTO DELETE OPTIONS
// ===================================================

function getAutoDeleteButtons() {


    return {


        inline_keyboard:

        [

            [

                {

                    text:
                    "5 Minutes",

                    callback_data:
                    "delete_time_300"

                }

            ],


            [

                {

                    text:
                    "10 Minutes",

                    callback_data:
                    "delete_time_600"

                }

            ],


            [

                {

                    text:
                    "30 Minutes",

                    callback_data:
                    "delete_time_1800"

                }

            ],


            [

                {

                    text:
                    "1 Hour",

                    callback_data:
                    "delete_time_3600"

                }

            ],


            [

                {

                    text:
                    "Disable",

                    callback_data:
                    "delete_time_0"

                }

            ],


            [

                {

                    text:
                    "❌ Close",

                    callback_data:
                    "close"

                }

            ]

        ]

    };


}



// ===================================================
// OPEN BOT SETTINGS
// ===================================================

async function openBotSettings(
    chatId
) {


    try {


        await bot.sendMessage(

            chatId,

`
⚙ Bot Settings

Select Auto Delete Time:
            `,

            {

                reply_markup:

                getAutoDeleteButtons()

            }

        );


    }

    catch(error) {


        console.error(
            "Open Bot Settings Error:",
            error.message
        );


    }

}



// ===================================================
// UPDATE AUTO DELETE TIME
// ===================================================

async function updateAutoDeleteTime(
    seconds
) {


    try {


        await saveBotSetting(

            "auto_delete",

            String(seconds)

        );



        return true;


    }

    catch(error) {


        console.error(
            "Auto Delete Update Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// AUTO DELETE TIMER
// ===================================================

async function scheduleDelete(
    chatId,
    messageId
) {


    try {


        const time =
            Number(
                botSettings.auto_delete
                ||
                0
            );



        if(
            time <= 0
        ) {


            return;


        }



        setTimeout(

            async () => {


                try {


                    await bot.deleteMessage(

                        chatId,

                        messageId

                    );


                }

                catch(error) {


                    console.error(

                        "Auto Delete Error:",

                        error.message

                    );


                }


            },

            time * 1000

        );


    }

    catch(error) {


        console.error(
            "Schedule Delete Error:",
            error.message
        );


    }

}



// ===================================================
// SEND AUTO DELETE MESSAGE
// ===================================================

async function sendAutoDeleteMessage(
    chatId,
    text
) {


    try {


        const message =
            await bot.sendMessage(

                chatId,

                text

            );



        await scheduleDelete(

            chatId,

            message.message_id

        );



        return message;


    }

    catch(error) {


        console.error(
            "Auto Delete Message Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// PART 1B-26 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-27
// Ban Users System
// ===================================================


// ===================================================
// CHECK USER BANNED
// ===================================================

async function isUserBanned(
    userId
) {


    try {


        const result =
            await dbQuery(

`
SELECT id

FROM banned_users

WHERE user_id=$1

LIMIT 1;
`,

[
    userId
]

            );



        return (
            result.rows.length > 0
        );


    }

    catch(error) {


        console.error(
            "Ban Check Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// BAN USER
// ===================================================

async function banUser(
    userId,
    reason
) {


    try {


        await dbQuery(

`
INSERT INTO banned_users
(
user_id,
reason
)

VALUES
(
$1,
$2
)

ON CONFLICT(user_id)

DO UPDATE SET

reason=$2;
`,

[

userId,

reason || "No reason"

]

        );



        await addLog(

            "User Banned",

            `User: ${userId} | Reason: ${reason}`

        );



        return true;


    }

    catch(error) {


        console.error(
            "Ban User Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// UNBAN USER
// ===================================================

async function unbanUser(
    userId
) {


    try {


        await dbQuery(

`
DELETE FROM banned_users

WHERE user_id=$1;
`,

[
    userId
]

        );



        await addLog(

            "User Unbanned",

            `User: ${userId}`

        );



        return true;


    }

    catch(error) {


        console.error(
            "Unban User Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// GET BANNED USERS
// ===================================================

async function getBannedUsers() {


    try {


        const result =
            await dbQuery(

`
SELECT *

FROM banned_users

ORDER BY created_at DESC;
`

            );



        return result.rows;


    }

    catch(error) {


        console.error(
            "Get Banned Users Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// BAN USER BUTTONS
// ===================================================

function getBanMenuButtons() {


    return {


        inline_keyboard:

        [

            [

                {

                    text:
                    "🚫 Ban User",

                    callback_data:
                    "ban_add"

                }

            ],


            [

                {

                    text:
                    "✅ Unban User",

                    callback_data:
                    "ban_remove"

                }

            ],


            [

                {

                    text:
                    "📋 Banned List",

                    callback_data:
                    "ban_list"

                }

            ],


            [

                {

                    text:
                    "❌ Close",

                    callback_data:
                    "close"

                }

            ]

        ]

    };


}



// ===================================================
// OPEN BAN PANEL
// ===================================================

async function openBanPanel(
    chatId
) {


    try {


        await bot.sendMessage(

            chatId,

`
🚫 Ban Users Panel

Select Action:
            `,

            {

                reply_markup:
                getBanMenuButtons()

            }

        );


    }

    catch(error) {


        console.error(
            "Ban Panel Error:",
            error.message
        );


    }

}



// ===================================================
// SEND BANNED USERS LIST
// ===================================================

async function sendBannedUsers(
    chatId
) {


    try {


        const users =
            await getBannedUsers();



        if(
            users.length === 0
        ) {


            return bot.sendMessage(

                chatId,

`
✅ No banned users.
                `

            );


        }



        let text =

`
🚫 Banned Users

`;



        for(
            const user of users
        ) {


            text +=

`
👤 User ID:
${user.user_id}

Reason:
${user.reason}

`;

        }



        await bot.sendMessage(

            chatId,

            text

        );


    }

    catch(error) {


        console.error(
            "Banned List Error:",
            error.message
        );


    }

}



// ===================================================
// BAN ACCESS CHECK
// ===================================================

async function checkBanBeforeAccess(
    userId
) {


    try {


        return await isUserBanned(
            userId
        );


    }

    catch(error) {


        console.error(
            "Ban Access Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// PART 1B-27 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-28
// Broadcast System
// ===================================================


// ===================================================
// GET ALL USERS
// ===================================================

async function getAllUsers() {


    try {


        const result =
            await dbQuery(

`
SELECT user_id

FROM users;
`

            );



        return result.rows;


    }

    catch(error) {


        console.error(
            "Get Users Error:",
            error.message
        );


        return [];


    }

}



// ===================================================
// SAVE USER
// ===================================================

async function saveUser(
    user
) {


    try {


        if(
            !user ||
            !user.id
        ) {


            return false;


        }



        await dbQuery(

`
INSERT INTO users
(
user_id,
username
)

VALUES
(
$1,
$2
)

ON CONFLICT(user_id)

DO UPDATE SET

username=$2;
`,

[

user.id,

user.username || null

]

        );



        return true;


    }

    catch(error) {


        console.error(
            "Save User Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// SEND BROADCAST
// ===================================================

async function sendBroadcast(
    fromChatId,
    messageId
) {


    try {


        const users =
            await getAllUsers();



        if(
            users.length === 0
        ) {


            await bot.sendMessage(

                fromChatId,

`
❌ No users found.
                `

            );


            return false;


        }



        let sent = 0;

        let failed = 0;



        for(
            const user of users
        ) {


            try {


                await bot.copyMessage(

                    user.user_id,

                    fromChatId,

                    messageId

                );



                sent++;


            }

            catch(error) {


                failed++;


                console.error(

                    `Broadcast failed for ${user.user_id}:`,

                    error.message

                );


            }


        }



        await addLog(

            "Broadcast",

            `Sent: ${sent} | Failed: ${failed}`

        );



        await bot.sendMessage(

            fromChatId,

`
📢 Broadcast Completed


✅ Sent:
${sent}


❌ Failed:
${failed}
            `

        );



        return true;


    }

    catch(error) {


        console.error(
            "Broadcast Error:",
            error.message
        );


        await addLog(

            "Broadcast",

            error.message

        );


        return false;


    }

}



// ===================================================
// BROADCAST MENU
// ===================================================

function getBroadcastButtons() {


    return {


        inline_keyboard:

        [

            [

                {

                    text:
                    "📢 Start Broadcast",

                    callback_data:
                    "broadcast_start"

                }

            ],


            [

                {

                    text:
                    "❌ Close",

                    callback_data:
                    "close"

                }

            ]

        ]

    };


}



// ===================================================
// OPEN BROADCAST PANEL
// ===================================================

async function openBroadcastPanel(
    chatId
) {


    try {


        await bot.sendMessage(

            chatId,

`
📢 Broadcast Panel

Send the message you want to broadcast.
            `,

            {

                reply_markup:
                getBroadcastButtons()

            }

        );


    }

    catch(error) {


        console.error(
            "Broadcast Panel Error:",
            error.message
        );


    }

}



// ===================================================
// BROADCAST STATE SAVE
// ===================================================

function startBroadcastSession(
    userId
) {


    broadcastStates.set(

        userId,

        {

            active:true

        }

    );


}



// ===================================================
// CHECK BROADCAST SESSION
// ===================================================

function isBroadcasting(
    userId
) {


    const data =
        broadcastStates.get(
            userId
        );



    return !!(
        data &&
        data.active
    );


}



// ===================================================
// CLEAR BROADCAST SESSION
// ===================================================

function clearBroadcastSession(
    userId
) {


    broadcastStates.delete(
        userId
    );


}



// ===================================================
// PART 1B-28 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-29
// Premium System
// ===================================================


// ===================================================
// PREMIUM CHANNEL ID
// ===================================================

const PREMIUM_CHANNEL_ID =
    "-1004429685937";


// ===================================================
// CHECK PREMIUM MEMBER
// ===================================================

async function isPremiumMember(
    userId
) {


    try {


        const member =
            await bot.getChatMember(

                PREMIUM_CHANNEL_ID,

                userId

            );



        const allowed = [

            "member",

            "administrator",

            "creator"

        ];



        return allowed.includes(
            member.status
        );


    }

    catch(error) {


        console.error(
            "Premium Check Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// VERIFY CONTENT ACCESS
// ===================================================

async function verifyContentAccess(
    userId,
    content
) {


    try {


        if(
            !content
        ) {


            return false;


        }



        if(
            content.access_type
            !==
            "premium"
        ) {


            return true;


        }



        return await isPremiumMember(
            userId
        );


    }

    catch(error) {


        console.error(
            "Content Access Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// PREMIUM MESSAGE
// ===================================================

async function sendPremiumMessage(
    chatId
) {


    try {


        const message =
            await bot.sendMessage(

                chatId,

`
⭐ Premium Content


This content is available only for Premium Members.


Contact Admin for Premium Files Access.
                `,

                {

                    reply_markup:

                    {

                        inline_keyboard:

                        [

                            [

                                {

                                    text:
                                    "👤 Contact Admin",

                                    url:
                                    process.env.ADMIN_BOT_LINK

                                }

                            ],

                            [

                                {

                                    text:
                                    "❌ Close",

                                    callback_data:
                                    "close"

                                }

                            ]

                        ]

                    }

                }

            );



        await scheduleDelete(

            chatId,

            message.message_id

        );



        return message;


    }

    catch(error) {


        console.error(
            "Premium Message Error:",
            error.message
        );


        return null;


    }

}



// ===================================================
// PREMIUM FILE COUNT
// ===================================================

async function getPremiumFileCount() {


    try {


        const result =
            await dbQuery(

`
SELECT COUNT(*) 

FROM contents

WHERE access_type='premium';
`

            );



        return Number(
            result.rows[0].count
        );


    }

    catch(error) {


        console.error(
            "Premium Count Error:",
            error.message
        );


        return 0;


    }

}



// ===================================================
// PREMIUM MEMBER LOG
// ===================================================

async function logPremiumMember(
    userId
) {


    try {


        await addLog(

            "Premium Member Joined",

            `User: ${userId}`

        );



    }

    catch(error) {


        console.error(
            "Premium Log Error:",
            error.message
        );


    }

}



// ===================================================
// CHECK PREMIUM JOIN EVENT
// ===================================================

async function checkPremiumJoin(
    userId
) {


    try {


        const premium =
            await isPremiumMember(
                userId
            );



        if(
            premium
        ) {


            await logPremiumMember(
                userId
            );


        }



        return premium;


    }

    catch(error) {


        console.error(
            "Premium Join Check Error:",
            error.message
        );


        return false;


    }

}



// ===================================================
// PART 1B-29 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-30
// Logs + Startup Verification
// ===================================================


// ===================================================
// ADD SYSTEM LOG
// ===================================================

async function addLog(
    action,
    details
) {


    try {


        await dbQuery(

`
INSERT INTO logs
(
action,
details
)

VALUES
(
$1,
$2
);
`,

[

action,

details || ""

]

        );



        console.log(

`
[LOG]
${action}
${details || ""}
`

        );


        return true;


    }

    catch(error) {


        console.error(

            "Log Save Error:",

            error.message

        );


        return false;


    }

}



// ===================================================
// DATABASE CONNECTION CHECK
// ===================================================

async function checkDatabaseConnection() {


    try {


        const result =
            await dbQuery(

`
SELECT NOW();
`

            );



        return !!result.rows[0];


    }

    catch(error) {


        console.error(

            "Database Connection Failed:",

            error.message

        );


        return false;


    }

}



// ===================================================
// VERIFY DATABASE TABLES
// ===================================================

async function verifyTables() {


    try {


        const tables = [

            "contents",

            "users",

            "settings",

            "requests",

            "banned_users",

            "logs"

        ];



        for(
            const table of tables
        ) {


            const result =
                await dbQuery(

`
SELECT EXISTS
(
SELECT FROM information_schema.tables

WHERE table_name=$1
);
`,

[

table

]

                );



            if(
                !result.rows[0].exists
            ) {


                console.error(

                    `Missing table: ${table}`

                );


                return false;


            }


        }



        return true;


    }

    catch(error) {


        console.error(

            "Table Verification Error:",

            error.message

        );


        return false;


    }

}



// ===================================================
// LOAD SETTINGS
// ===================================================

async function loadBotSettings() {


    try {


        const settings =
            await getBotSettings();



        Object.assign(

            botSettings,

            settings

        );



        console.log(

            "Settings Loaded"

        );



        return true;


    }

    catch(error) {


        console.error(

            "Settings Load Error:",

            error.message

        );


        return false;


    }

}



// ===================================================
// STARTUP STATUS
// ===================================================

async function startupCheck() {


    console.log(

`
🚀 CineXClub Bot Starting...
`

    );



    const database =
        await checkDatabaseConnection();



    if(database) {


        console.log(

            "✅ Database Connected"

        );


    }

    else {


        console.error(

            "❌ Database Connection Failed"

        );


    }



    const tables =
        await verifyTables();



    if(tables) {


        console.log(

            "✅ Tables Verified"

        );


    }

    else {


        console.error(

            "❌ Table Verification Failed"

        );


    }



    await loadBotSettings();



    console.log(

        "✅ Welcome Loaded"

    );



    console.log(

        "✅ Upload Ready"

    );



    console.log(

        "✅ Search Ready"

    );



    console.log(

        "✅ Premium Ready"

    );



    console.log(

        "🤖 Bot Ready"

    );


}



// ===================================================
// ERROR LOGGER
// ===================================================

function logError(
    type,
    error
) {


    const reason =
        error.message
        ||
        "Unknown Error";



    console.error(

`
❌ ${type}

Reason:
${reason}
`

    );


}



// ===================================================
// PART 1B-30 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-31
// Start Command System
// ===================================================


// ===================================================
// FORMAT USER NAME
// ===================================================

function formatUserName(
    user
) {


    try {


        if(
            user.first_name
        ) {


            return user.first_name;


        }



        if(
            user.username
        ) {


            return user.username
                .replace(
                    "@",
                    ""
                );


        }



        return "User";


    }

    catch(error) {


        return "User";


    }

}



// ===================================================
// CHECK FORCE JOIN
// ===================================================

async function checkForceJoin(
    userId
) {


    try {


        const member =
            await bot.getChatMember(

                "@CineXClub",

                userId

            );



        const allowed = [

            "member",

            "administrator",

            "creator"

        ];



        return allowed.includes(
            member.status
        );


    }

    catch(error) {


        return false;


    }

}



// ===================================================
// FORCE JOIN MESSAGE
// ===================================================

async function sendForceJoin(
    chatId
) {


    try {


        await bot.sendMessage(

            chatId,

`
⚠️ Join CineXClub to continue.

After joining click Verify.
            `,

            {

                reply_markup:

                {

                    inline_keyboard:

                    [

                        [

                            {

                                text:
                                "📢 Join Channel",

                                url:
                                "https://t.me/CineXClub"

                            }

                        ],

                        [

                            {

                                text:
                                "✅ Verify",

                                callback_data:
                                "verify_join"

                            }

                        ]

                    ]

                }

            }

        );


    }

    catch(error) {


        console.error(

            "Force Join Error:",

            error.message

        );


    }

}



// ===================================================
// GET RANDOM WELCOME IMAGE
// ===================================================

function getRandomWelcomeImage() {


    try {


        const images =
            JSON.parse(

                botSettings.welcome_images
                ||
                "[]"

            );



        if(
            images.length === 0
        ) {


            return null;


        }



        return images[

            Math.floor(

                Math.random()
                *
                images.length

            )

        ];


    }

    catch(error) {


        return null;


    }

}



// ===================================================
// SEND WELCOME
// ===================================================

async function sendWelcome(
    message
) {


    try {


        const chatId =
            message.chat.id;



        const name =
            formatUserName(
                message.from
            );



        const caption =

`
👋 Welcome ${name}


${botSettings.welcome_caption || 
"Search your favourite Movies, Series and Anime."}


Choose an option below:
`;



        const buttons =

        {

            inline_keyboard:

            [

                [

                    {

                        text:
                        "🎬 Movies",

                        callback_data:
                        "category_movies"

                    },

                    {

                        text:
                        "📺 Series",

                        callback_data:
                        "category_series"

                    }

                ],


                [

                    {

                        text:
                        "🎌 Anime",

                        callback_data:
                        "category_anime"

                    },

                    {

                        text:
                        "🔎 Search",

                        callback_data:
                        "search_start"

                    }

                ],


                [

                    {

                        text:
                        "ℹ️ About",

                        callback_data:
                        "about"

                    }

                ],


                [

                    {

                        text:
                        "❌ Close",

                        callback_data:
                        "close_welcome"

                    }

                ]

            ]

        };



        const image =
            getRandomWelcomeImage();



        let sent;



        if(
            image
        ) {


            sent =
            await bot.sendPhoto(

                chatId,

                image,

                {

                    caption,

                    reply_markup:
                    buttons

                }

            );


        }

        else {


            sent =
            await bot.sendMessage(

                chatId,

                caption,

                {

                    reply_markup:
                    buttons

                }

            );


        }



        return sent;


    }

    catch(error) {


        console.error(

            "Welcome Send Error:",

            error.message

        );


        return null;


    }

}



// ===================================================
// GET CONTENT BY ID
// ===================================================

async function getContentById(
    contentId
) {


    try {


        const result =
            await dbQuery(

`
SELECT *

FROM contents

WHERE content_id=$1

LIMIT 1;
`,

[

contentId

]

            );



        return (

            result.rows[0]
            ||
            null

        );


    }

    catch(error) {


        console.error(

            "Deep Link Search Error:",

            error.message

        );


        return null;


    }

}



// ===================================================
// SEND START CONTENT
// ===================================================

async function handleStartContent(
    chatId,
    userId,
    contentId
) {


    try {


        const content =
            await getContentById(
                contentId
            );



        if(
            !content
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ Video not in our database.

Use exact spelling or search again.
                `

            );


        }



        return await sendWithAccessCheck(

            chatId,

            userId,

            content

        );


    }

    catch(error) {


        console.error(

            "Start Content Error:",

            error.message

        );


    }

}



// ===================================================
// PART 1B-31 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-32
// Single Message Handler
// ===================================================


// ===================================================
// SEARCH STATE
// ===================================================

const searchStates =
    new Map();


// ===================================================
// START SEARCH
// ===================================================

function startSearch(
    userId
) {


    searchStates.set(

        userId,

        {

            active:true

        }

    );

}



// ===================================================
// CHECK SEARCH STATE
// ===================================================

function isSearching(
    userId
) {


    return !!(

        searchStates.get(
            userId
        )

    );


}



// ===================================================
// CLEAR SEARCH
// ===================================================

function clearSearch(
    userId
) {


    searchStates.delete(
        userId
    );

}



// ===================================================
// SEARCH CONTENT
// ===================================================

async function searchContent(
    keyword
) {


    try {


        const result =
            await dbQuery(

`
SELECT *

FROM contents

WHERE title ILIKE $1

ORDER BY created_at DESC

LIMIT 20;
`,

[

`%${keyword}%`

]

            );



        return result.rows;


    }

    catch(error) {


        console.error(

            "Search Error:",

            error.message

        );


        return [];

    }

}



// ===================================================
// SEARCH RESULT BUTTONS
// ===================================================

function createSearchButtons(
    contents
) {


    const buttons = [];



    for(
        const item of contents
    ) {


        buttons.push(

            [

                {

                    text:
                    item.title,

                    callback_data:
                    `open_content_${item.id}`

                }

            ]

        );


    }



    return buttons;


}



// ===================================================
// SEND SEARCH RESULTS
// ===================================================

async function sendSearchResults(
    chatId,
    results
) {


    try {


        if(
            results.length === 0
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
❌ No file found.

⚠️ Type exact spelling.
                `

            );


        }



        await bot.sendMessage(

            chatId,

`
🔎 Search Results

Select your file:
            `,

            {

                reply_markup:

                {

                    inline_keyboard:

                    createSearchButtons(
                        results
                    )

                }

            }

        );


    }

    catch(error) {


        console.error(

            "Search Result Error:",

            error.message

        );


    }

}



// ===================================================
// SINGLE MESSAGE HANDLER
// ===================================================

bot.on(
"message",

async (message) => {


    try {


        if(
            !message
            ||
            !message.from
        ) {


            return;


        }



        const userId =
            message.from.id;



        const chatId =
            message.chat.id;



        // Save User

        await saveUser(

            message.from

        );



        // Ban Check

        if(
            await isUserBanned(
                userId
            )
        ) {


            return sendAutoDeleteMessage(

                chatId,

`
🚫 You are banned from using this bot.
                `

            );


        }



        // Upload Process

        if(
            getUploadSession(
                userId
            )
        ) {


            const handled =
                await processUploadMessage(

                    message

                );



            if(
                handled
            ) {


                return;


            }


        }



        // Broadcast Process

        if(
            isBroadcasting(
                userId
            )
        ) {


            clearBroadcastSession(
                userId
            );


            return await sendBroadcast(

                chatId,

                message.message_id

            );


        }



        // Text Only

        if(
            !message.text
        ) {


            return;


        }



        const text =
            message.text.trim();



        // Start Command

        if(
            text.startsWith(
                "/start"
            )
        ) {


            const parts =
                text.split(" ");



            const parameter =
                parts[1];



            const joined =
                await checkForceJoin(
                    userId
                );



            if(
                !joined
            ) {


                return sendForceJoin(
                    chatId
                );


            }



            if(
                parameter
            ) {


                return handleStartContent(

                    chatId,

                    userId,

                    parameter

                );


            }



            return sendWelcome(
                message
            );


        }



        // Search Mode

        if(
            isSearching(
                userId
            )
        ) {


            clearSearch(
                userId
            );



            const results =
                await searchContent(
                    text
                );



            return sendSearchResults(

                chatId,

                results

            );


        }



        // Search Command

        if(
            text === "/search"
        ) {


            startSearch(
                userId
            );



            return bot.sendMessage(

                chatId,

`
🔎 Search your Movie, Series, Anime name

Example:

Iron Man 1

Stranger Things S01E01

Naruto Episode 1


⚠️ Type exact spelling.
                `

            );


        }



    }

    catch(error) {


        console.error(

            "Message Handler Error:",

            error.message

        );


    }


});



// ===================================================
// PART 1B-32 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-33
// Single Callback Query Handler
// ===================================================


// ===================================================
// CALLBACK QUERY HANDLER
// ONLY ONE CALLBACK HANDLER
// ===================================================

bot.on(
"callback_query",

async (query) => {


    try {


        const data =
            query.data;


        const chatId =
            query.message.chat.id;


        const userId =
            query.from.id;



        await bot.answerCallbackQuery(
            query.id
        );



        // ================================
        // CLOSE MESSAGE
        // ================================

        if(
            data === "close"
            ||
            data === "close_welcome"
        ) {


            try {


                await bot.deleteMessage(

                    chatId,

                    query.message.message_id

                );


            }

            catch(error){}



            return;


        }



        // ================================
        // FORCE JOIN VERIFY
        // ================================

        if(
            data === "verify_join"
        ) {


            const joined =
                await checkForceJoin(
                    userId
                );



            if(
                joined
            ) {


                return sendWelcome(

                    query.message

                );


            }



            return bot.sendMessage(

                chatId,

`
❌ Please join @CineXClub first.
                `

            );


        }



        // ================================
        // ABOUT BUTTON
        // ================================

        if(
            data === "about"
        ) {


            return bot.sendMessage(

                chatId,

`
ℹ️ CineXClub Bot


🎬 Movies
📺 Series
🎌 Anime


Fast and simple movie access system.
                `

            );


        }



        // ================================
        // SEARCH BUTTON
        // ================================

        if(
            data === "search_start"
        ) {


            startSearch(
                userId
            );



            return bot.sendMessage(

                chatId,

`
🔎 Search your Movie, Series, Anime name

Example:

Iron Man 1

Stranger Things S01E01

Naruto Episode 1


⚠️ Type exact spelling.
                `

            );


        }



        // ================================
        // ADMIN PANEL
        // ================================

        if(
            data.startsWith(
                "admin_"
            )
        ) {


            const allowed =
                await verifyAdminAction(
                    query
                );



            if(
                !allowed
            ) {


                return bot.sendMessage(

                    chatId,

`
❌ Admin access required.
                    `

                );


            }



        }



        // ================================
        // OPEN UPLOAD
        // ================================

        if(
            data === "admin_upload"
        ) {


            return openUploadMenu(

                chatId,

                userId

            );


        }



        // ================================
        // ADMIN STATISTICS
        // ================================

        if(
            data === "admin_stats"
        ) {


            return sendAdminStatistics(
                chatId
            );


        }



        // ================================
        // ADMIN WELCOME SETTINGS
        // ================================

        if(
            data === "admin_welcome"
        ) {


            return openWelcomeSettings(
                chatId
            );


        }



        // ================================
        // ADMIN BOT SETTINGS
        // ================================

        if(
            data === "admin_settings"
        ) {


            return openBotSettings(
                chatId
            );


        }



        // ================================
        // ADMIN BROADCAST
        // ================================

        if(
            data === "admin_broadcast"
        ) {


            startBroadcastSession(
                userId
            );



            return openBroadcastPanel(
                chatId
            );


        }



        // ================================
        // ADMIN BAN PANEL
        // ================================

        if(
            data === "admin_ban"
        ) {


            return openBanPanel(
                chatId
            );


        }



        // ================================
        // UPLOAD TYPE
        // ================================

        if(
            data.startsWith(
                "upload_type_"
            )
        ) {


            return handleUploadType(
                query
            );


        }



        // ================================
        // UPLOAD ACCESS
        // ================================

        if(
            data.startsWith(
                "upload_access_"
            )
        ) {


            return handleUploadAccess(
                query
            );


        }



        // ================================
        // UPLOAD QUALITY
        // ================================

        if(
            data.startsWith(
                "upload_quality_"
            )
        ) {


            return handleUploadQuality(
                query
            );


        }



        // ================================
        // DELETE TIME SETTINGS
        // ================================

        if(
            data.startsWith(
                "delete_time_"
            )
        ) {


            const seconds =
                data.replace(
                    "delete_time_",
                    ""
                );



            await updateAutoDeleteTime(
                seconds
            );



            return bot.sendMessage(

                chatId,

`
✅ Auto Delete Updated
                `

            );


        }



        // ================================
        // OPEN CONTENT
        // ================================

        if(
            data.startsWith(
                "open_content_"
            )
        ) {


            const id =
                data.replace(
                    "open_content_",
                    ""
                );



            const content =
                await getContentByDatabaseId(
                    id
                );



            if(
                !content
            ) {


                return sendAutoDeleteMessage(

                    chatId,

`
❌ File not found.
                    `

                );


            }



            return sendWithAccessCheck(

                chatId,

                userId,

                content

            );


        }



        // ================================
        // QUALITY SEND
        // ================================

        if(
            data.startsWith(
                "quality_"
            )
        ) {


            const parts =
                data.split("_");



            const contentId =
                parts[1];



            const quality =
                parts[2];



            const content =
                await getContentById(
                    contentId
                );



            if(
                !content
            ) {


                return;

            }



            if(
                content.quality
                !==
                quality
            ) {


                return sendAutoDeleteMessage(

                    chatId,

`
❌ Selected quality unavailable.
                    `

                );


            }



            return sendWithAccessCheck(

                chatId,

                userId,

                content

            );


        }



    }

    catch(error) {


        console.error(

            "Callback Handler Error:",

            error.message

        );


    }


});


// ===================================================
// PART 1B-33 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-34
// Database Initialization System
// ===================================================



// ===================================================
// CREATE DATABASE TABLES
// ===================================================

async function createRequiredTables() {


    try {


        await dbQuery(`

CREATE TABLE IF NOT EXISTS contents
(

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

access_type TEXT DEFAULT 'normal',

file_id TEXT NOT NULL,

created_at TIMESTAMP DEFAULT NOW()

);

        `);



        await dbQuery(`

CREATE TABLE IF NOT EXISTS users
(

id SERIAL PRIMARY KEY,

user_id BIGINT UNIQUE NOT NULL,

username TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

        `);



        await dbQuery(`

CREATE TABLE IF NOT EXISTS settings
(

id SERIAL PRIMARY KEY,

setting_key TEXT UNIQUE NOT NULL,

setting_value TEXT

);

        `);



        await dbQuery(`

CREATE TABLE IF NOT EXISTS requests
(

id SERIAL PRIMARY KEY,

user_id BIGINT,

request TEXT,

status TEXT DEFAULT 'pending',

created_at TIMESTAMP DEFAULT NOW()

);

        `);



        await dbQuery(`

CREATE TABLE IF NOT EXISTS banned_users
(

id SERIAL PRIMARY KEY,

user_id BIGINT UNIQUE NOT NULL,

reason TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

        `);



        await dbQuery(`

CREATE TABLE IF NOT EXISTS logs
(

id SERIAL PRIMARY KEY,

action TEXT,

details TEXT,

created_at TIMESTAMP DEFAULT NOW()

);

        `);



        console.log(
            "✅ Tables Verified"
        );


        return true;


    }

    catch(error) {


        console.error(

            "Table Creation Error:",

            error.message

        );


        return false;


    }

}



// ===================================================
// INSERT DEFAULT SETTINGS
// ===================================================

async function insertDefaultSettings() {


    try {


        const defaults = [

            [

                "welcome_images",

                "[]"

            ],


            [

                "welcome_caption",

                "Search your favourite Movies, Series and Anime."

            ],


            [

                "auto_delete",

                "600"

            ]

        ];



        for(
            const item of defaults
        ) {


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

DO NOTHING;

`,

item

            );


        }



        console.log(

            "✅ Default Settings Loaded"

        );


        return true;


    }

    catch(error) {


        console.error(

            "Default Settings Error:",

            error.message

        );


        return false;


    }

}



// ===================================================
// COMPLETE DATABASE INITIALIZATION
// ===================================================

async function initializeDatabase() {


    try {


        const connected =
            await checkDatabaseConnection();



        if(
            !connected
        ) {


            throw new Error(
                "Database connection failed"
            );


        }



        await createRequiredTables();



        await insertDefaultSettings();



        await loadBotSettings();



        console.log(

            "✅ Database Initialization Complete"

        );



        return true;


    }

    catch(error) {


        console.error(

            "Database Initialization Failed:",

            error.message

        );


        return false;


    }

}



// ===================================================
// CHECK REQUIRED SETTINGS
// ===================================================

async function verifySettingsLoaded() {


    try {


        const required = [

            "welcome_images",

            "welcome_caption",

            "auto_delete"

        ];



        for(
            const key of required
        ) {


            if(
                !botSettings[key]
            ) {


                console.error(

                    `Missing setting: ${key}`

                );


                return false;


            }


        }



        console.log(

            "✅ Settings Loaded"

        );



        return true;


    }

    catch(error) {


        console.error(

            "Settings Verify Error:",

            error.message

        );


        return false;


    }

}



// ===================================================
// PART 1B-34 END
// ===================================================
// ===================================================
// CineXClub Bot
// Production Ready Telegram Movie Bot
// PART 1B-35 FINAL
// Bot Launch System
// ===================================================


// ===================================================
// KEEP ALIVE SERVER (RENDER)
// ===================================================

const http =
require("http");



const PORT =
process.env.PORT || 3000;



const server =
http.createServer(

(req,res)=>{


    res.writeHead(
        200,
        {
            "Content-Type":
            "text/plain"
        }
    );


    res.end(
        "CineXClub Bot Running"
    );


}

);



server.listen(

PORT,

()=>{


console.log(

`🌐 Keep Alive Server Started On ${PORT}`

);


}

);



// ===================================================
// BOT POLLING ERROR HANDLER
// ===================================================

bot.on(
"polling_error",

(error)=>{


console.error(

"Telegram Polling Error:",

error.message

);


}

);



// ===================================================
// WEBHOOK ERROR HANDLER
// ===================================================

process.on(

"uncaughtException",

(error)=>{


console.error(

"Uncaught Exception:",

error.message

);


}

);



process.on(

"unhandledRejection",

(error)=>{


console.error(

"Unhandled Rejection:",

error

);


}

);



// ===================================================
// BOT STARTUP
// ===================================================

async function startBot(){


    try{


        console.log(

`
🚀 Starting CineXClub Bot...
`

        );



        const database =
        await initializeDatabase();



        if(
            !database
        ){


            throw new Error(

                "Database initialization failed"

            );


        }



        await startupCheck();



        const settings =
        await verifySettingsLoaded();



        if(
            !settings
        ){


            throw new Error(

                "Settings loading failed"

            );


        }



        console.log(

`
==============================

✅ Database Connected

✅ Tables Verified

✅ Settings Loaded

✅ Welcome Loaded

✅ Upload Ready

✅ Search Ready

✅ Premium Ready

🤖 CineXClub Bot Ready

==============================
`

        );



        await addLog(

            "Bot Started",

            "CineXClub Bot is online"

        );



    }

    catch(error){


        console.error(

            "BOT START FAILED:",

            error.message

        );


        process.exit(1);


    }


}



// ===================================================
// START APPLICATION
// ===================================================

startBot();



// ===================================================
// END OF CineXClub BOT
// ===================================================
