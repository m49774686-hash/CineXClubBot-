require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");

// ================================
// ENV CONFIG
// ================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME || "CineXClubBot";

const FORCE_CHANNEL = process.env.FORCE_CHANNEL; 
const STORAGE_CHANNEL = process.env.STORAGE_CHANNEL;

const ADMIN_ID = Number(process.env.ADMIN_ID);

const AUTO_DELETE_TIME = 30 * 60 * 1000; // 30 Minutes


// ================================
// TELEGRAM BOT
// ================================

const bot = new TelegramBot(BOT_TOKEN, {
    polling: {
        interval: 300,
        autoStart: true
    }
});

console.log("✅ CineXClub Bot Started");


// ================================
// POSTGRES DATABASE
// ================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


// ================================
// DATABASE INIT
// ================================

async function initDB(){

    try{

        await pool.query(`
        CREATE TABLE IF NOT EXISTS videos(
            id SERIAL PRIMARY KEY,
            movie_id TEXT UNIQUE NOT NULL,
            file_id TEXT NOT NULL,
            caption TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
        `);

        console.log("✅ Database Connected");

    }catch(err){

        console.log("❌ Database Error:",err.message);

    }

}

initDB();


// ================================
// KEEP ALIVE SERVER (Render)
// ================================

http.createServer((req,res)=>{

    res.write("CineXClub Bot Running");
    res.end();

}).listen(process.env.PORT || 3000);


// ================================
// BASIC ERROR HANDLING
// ================================

bot.on("polling_error",(error)=>{

    console.log(
        "Polling Error:",
        error.message
    );

});


process.on("unhandledRejection",(error)=>{

    console.log(
        "Unhandled Error:",
        error
    );

});
// ================================
// FORCE JOIN CHECK
// ================================

async function checkJoin(userId){

    try{

        if(!FORCE_CHANNEL) return true;

        const member = await bot.getChatMember(
            FORCE_CHANNEL,
            userId
        );

        const allowed = [
            "member",
            "administrator",
            "creator"
        ];

        return allowed.includes(member.status);


    }catch(err){

        console.log(
            "Force Join Error:",
            err.message
        );

        return false;

    }

}


// ================================
// FORCE JOIN MESSAGE
// ================================

async function sendJoinMessage(chatId){

    await bot.sendMessage(
        chatId,
        "⚠️ Please join our channel first to access videos.",
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
                            text:"✅ I Joined",
                            callback_data:"check_join"
                        }
                    ]

                ]
            }
        }
    );

}


// ================================
// START COMMAND
// ================================

bot.onText(
    /\/start(?:\s(.+))?/,
    async(msg,match)=>{

        const chatId = msg.chat.id;
        const userId = msg.from.id;

        const movieId = match[1];


        // Force Join

        const joined = await checkJoin(userId);


        if(!joined){

            return sendJoinMessage(chatId);

        }



        // Normal Start

        if(!movieId){

            return bot.sendMessage(
                chatId,
                `
🎬 Welcome to CineXClub Bot

Here you can get movies instantly.

🔎 Send movie ID to get video.

                `,
                {
                    parse_mode:"Markdown"
                }
            );

        }



        // Movie ID received
        console.log(
            "Requested Movie:",
            movieId
        );


    }
);


// ================================
// JOIN CHECK BUTTON
// ================================

bot.on(
"callback_query",
async(query)=>{


    if(query.data === "check_join"){


        const userId = query.from.id;
        const chatId = query.message.chat.id;


        const joined = await checkJoin(userId);


        if(joined){

            bot.answerCallbackQuery(
                query.id,
                {
                    text:"✅ Verified"
                }
            );


            bot.sendMessage(
                chatId,
                "✅ You can now use the bot."
            );


        }else{


            bot.answerCallbackQuery(
                query.id,
                {
                    text:"❌ Join the channel first"
                }
            );


        }


    }


});
// ================================
// SAVE VIDEO TO DATABASE
// ================================

async function saveVideo(movieId, fileId, caption){


    try{


        await pool.query(
            `
            INSERT INTO videos
            (movie_id, file_id, caption)

            VALUES($1,$2,$3)

            ON CONFLICT(movie_id)

            DO UPDATE SET
            file_id = EXCLUDED.file_id,
            caption = EXCLUDED.caption
            `,
            [
                movieId,
                fileId,
                caption
            ]
        );


        console.log(
            "✅ Saved:",
            movieId
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
// GET FILE ID FROM VIDEO
// ================================

function getVideoFileId(msg){

    if(msg.video){

        return msg.video.file_id;

    }


    if(msg.document){

        return msg.document.file_id;

    }


    return null;

}



// ================================
// STORAGE CHANNEL HANDLER
// ================================

bot.on(
"channel_post",
async(msg)=>{


    try{


        // Only storage channel
if (msg.chat.id.toString() !== STORAGE_CHANNEL.toString()) {
    return;
}
        



        const fileId = getVideoFileId(msg);



        if(!msg.caption){

            console.log(
                "❌ Caption Missing"
            );

            return;

        }



        /*
          Caption format:

          ironman1
          OR

          ironman1
          Iron Man 1
          Hindi + English
          1080p
          2GB
        */


        const movieId =
        msg.caption
        .split("\n")[0]
        .trim()
        .toLowerCase()
        .replace(/\s+/g,"");



        if(!movieId){

            return;

        }



        const saved =
        await saveVideo(
            movieId,
            fileId,
            msg.caption
        );



        if(saved){


            const botLink =
            `https://t.me/${BOT_USERNAME}?start=${movieId}`;



            await bot.sendMessage(
                msg.chat.id,
                `
✅ Video Saved Successfully

🎬 Movie ID:
\`${movieId}\`

🔗 Bot Link:
${botLink}
                `,
                {
                    parse_mode:"Markdown"
                }
            );


        }



    }catch(err){


        console.log(
            "Channel Error:",
            err.message
        );


    }


});
// ================================
// GET VIDEO FROM DATABASE
// ================================

async function getVideo(movieId){

    try{

        const result = await pool.query(
            `
            SELECT *
            FROM videos
            WHERE movie_id=$1
            `,
            [
                movieId.toLowerCase()
            ]
        );


        if(result.rows.length === 0){

            return null;

        }


        return result.rows[0];


    }catch(err){

        console.log(
            "Fetch Error:",
            err.message
        );

        return null;

    }

}



// ================================
// SEND MOVIE VIDEO
// ================================

async function sendMovie(chatId, movieId){


    const video =
    await getVideo(movieId);



    if(!video){


        return bot.sendMessage(
            chatId,
            `
❌ Video not found in our database.

Try searching here:
            `,
            {
                reply_markup:{
                    inline_keyboard:[

                        [
                            {
                                text:"🔎 Google Search",
                                url:
                                `https://www.google.com/search?q=${encodeURIComponent(movieId)}`
                            }
                        ]

                    ]
                }
            }
        );


    }



    try{


        const sent =
        await bot.sendVideo(
            chatId,
            video.file_id,
            {
                caption:
                video.caption ||
                `🎬 ${movieId}`
            }
        );



        // Auto Delete after 30 minutes

        setTimeout(
            async()=>{

                try{

                    await bot.deleteMessage(
                        chatId,
                        sent.message_id
                    );


                    console.log(
                        "🗑️ Deleted:",
                        movieId
                    );


                }catch(err){

                    console.log(
                        "Delete Error:",
                        err.message
                    );

                }


            },
            AUTO_DELETE_TIME
        );



    }catch(err){


        console.log(
            "Send Video Error:",
            err.message
        );


        bot.sendMessage(
            chatId,
            "❌ Unable to send video."
        );


    }


}



// ================================
// HANDLE MOVIE START REQUEST
// ================================

bot.onText(
/\/start(?:\s(.+))?/,
async(msg,match)=>{


    const movieId = match[1];


    if(movieId){


        const joined =
        await checkJoin(msg.from.id);



        if(!joined){

            return sendJoinMessage(
                msg.chat.id
            );

        }



        return sendMovie(
            msg.chat.id,
            movieId
        );


    }


});
// ================================
// FORMAT MOVIE CAPTION
// ================================

function formatCaption(caption, movieId){

    if(!caption){

        return `🎬 ${movieId}`;

    }


    const lines = caption.split("\n");


    return `
🎬 Movie ID:
${movieId}

${lines.slice(1).join("\n")}

⚡ Powered by CineXClub
    `;

}



// ================================
// ADMIN CHECK
// ================================

function isAdmin(userId){

    return userId === ADMIN_ID;

}



// ================================
// ADMIN START
// ================================

bot.onText(
/\/admin/,
async(msg)=>{


    if(!isAdmin(msg.from.id)){


        return bot.sendMessage(
            msg.chat.id,
            "❌ You are not authorized."
        );


    }



    bot.sendMessage(
        msg.chat.id,
        `
👑 CineXClub Admin Panel

Available:

📤 Upload video to storage channel
📊 Database managed automatically
🔗 Bot links generated automatically
        `,
        {

            reply_markup:{
                inline_keyboard:[

                    [
                        {
                            text:"🤖 Open Bot",
                            url:`https://t.me/${BOT_USERNAME}`
                        }
                    ]

                ]
            }

        }
    );


});



// ================================
// ADMIN SEND DATABASE COUNT
// ================================

bot.onText(
/\/stats/,
async(msg)=>{


    if(!isAdmin(msg.from.id)){

        return;

    }



    try{


        const result =
        await pool.query(
            "SELECT COUNT(*) FROM videos"
        );


        bot.sendMessage(
            msg.chat.id,
            `
📊 Database Statistics

🎬 Total Videos:
${result.rows[0].count}
            `
        );


    }catch(err){


        console.log(
            err.message
        );


    }


});



// ================================
// ADMIN DELETE MOVIE FROM DB
// ================================

bot.onText(
/\/delete (.+)/,
async(msg,match)=>{


    if(!isAdmin(msg.from.id)){

        return;

    }


    const movieId =
    match[1]
    .trim()
    .toLowerCase();



    await pool.query(
        `
        DELETE FROM videos
        WHERE movie_id=$1
        `,
        [
            movieId
        ]
    );



    bot.sendMessage(
        msg.chat.id,
        `
🗑️ Deleted:

${movieId}
        `
    );


});
