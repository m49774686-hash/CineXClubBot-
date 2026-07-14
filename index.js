require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");


// ================================
// ENV CONFIG
// ================================

const BOT_TOKEN = process.env.BOT_TOKEN;

const BOT_USERNAME =
process.env.BOT_USERNAME || "CineXClubBot";

const FORCE_CHANNEL =
process.env.FORCE_CHANNEL;

const STORAGE_CHANNEL =
String(process.env.STORAGE_CHANNEL);

const ADMIN_ID =
Number(process.env.ADMIN_ID);


const AUTO_DELETE_TIME =
30 * 60 * 1000;


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


console.log("✅ CineXClub Bot Started");



// ================================
// POSTGRES
// ================================

const pool = new Pool({

    connectionString:
    process.env.DATABASE_URL,

    ssl:{
        rejectUnauthorized:false
    }

});




// ================================
// DATABASE CREATE
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


        console.log(
            "✅ Database Ready"
        );


    }catch(err){

        console.log(
            "❌ Database Error:",
            err.message
        );

    }

}


initDB();




// ================================
// RENDER KEEP ALIVE
// ================================

http.createServer(
(req,res)=>{

    res.end(
        "CineXClub Bot Running"
    );

}

).listen(
process.env.PORT || 3000
);




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
(error)=>{

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

        if(!FORCE_CHANNEL){

            return true;

        }


        const member =
        await bot.getChatMember(
            FORCE_CHANNEL,
            userId
        );


        return [
            "member",
            "administrator",
            "creator"
        ].includes(member.status);



    }catch(err){

        console.log(
            "Force Join Error:",
            err.message
        );

        return false;

    }

}




// ================================
// JOIN MESSAGE
// ================================

async function sendJoinMessage(chatId){


    await bot.sendMessage(

        chatId,

        "⚠️ Please join our channel first.",

        {

            reply_markup:{

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
                            text:"✅ Check Join",

                            callback_data:"check_join"
                        }

                    ]

                ]

            }

        }

    );

}




// ================================
// GET VIDEO FROM DATABASE
// ================================

async function getVideo(movieId){


    try{


        const result =
        await pool.query(

            `
            SELECT *
            FROM videos
            WHERE movie_id=$1
            `,

            [
                movieId
                .toLowerCase()
                .trim()
            ]

        );


        if(result.rows.length === 0){

            return null;

        }


        return result.rows[0];



    }catch(err){


        console.log(
            "Database Fetch Error:",
            err.message
        );


        return null;

    }


}





// ================================
// SINGLE START COMMAND
// ================================

bot.onText(
/\/start(?:\s(.+))?/,

async(msg,match)=>{


    const chatId =
    msg.chat.id;


    const movieId =
    match[1];



    const joined =
    await checkJoin(
        msg.from.id
    );



    if(!joined){

        return sendJoinMessage(
            chatId
        );

    }




    // Normal start

    if(!movieId){


        return bot.sendMessage(

            chatId,

`
🎬 Welcome to CineXClub Bot

Get movies instantly.

Send Movie ID or open movie link.

Example:
ironman1
`

        );


    }




    console.log(
        "Movie Requested:",
        movieId
    );


    const video =
    await getVideo(movieId);



    if(!video){


        return bot.sendMessage(

            chatId,

`
❌ Video not found in our database.
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



    // Video send part will continue in Part 3



});





// ================================
// JOIN CALLBACK
// ================================

bot.on(
"callback_query",

async(query)=>{


    if(query.data !== "check_join"){

        return;

    }



    const joined =
    await checkJoin(
        query.from.id
    );



    if(joined){


        await bot.answerCallbackQuery(
            query.id,
            {
                text:"✅ Verified"
            }
        );


        bot.sendMessage(

            query.message.chat.id,

            "✅ You can access videos now."

        );



    }else{


        await bot.answerCallbackQuery(

            query.id,

            {
                text:"❌ Please join first"
            }

        );

    }


});
// ================================
// SAVE VIDEO TO DATABASE
// ================================

async function saveVideo(movieId,fileId,caption){

    try{


        await pool.query(

            `
            INSERT INTO videos
            (movie_id,file_id,caption)

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
// GET FILE ID
// ================================

function getFileId(msg){


    if(msg.video){

        return msg.video.file_id;

    }


    if(msg.document){

        return msg.document.file_id;

    }


    return null;

}





// ================================
// STORAGE CHANNEL UPLOAD
// ================================

bot.on(
"channel_post",

async(msg)=>{


    try{


        console.log(
            "Channel Post:",
            msg.chat.id
        );



        // Check storage channel

        if(
            String(msg.chat.id)
            !==
            String(STORAGE_CHANNEL)
        ){

            console.log(
                "Not Storage Channel"
            );

            return;

        }




        const fileId =
        getFileId(msg);



        if(!fileId){


            console.log(
                "❌ File ID Missing"
            );


            return;

        }




        if(!msg.caption){


            console.log(
                "❌ Caption Missing"
            );


            return;

        }





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



            const link =

            `https://t.me/${BOT_USERNAME}?start=${movieId}`;





            await bot.sendMessage(

                msg.chat.id,

`
✅ Video Saved Successfully

🎬 Movie ID:
${movieId}

🔗 Bot Link:
${link}
`

            );


        }





    }catch(err){


        console.log(

            "Channel Handler Error:",

            err.message

        );


    }


});







// ================================
// SEND VIDEO
// ================================

async function sendMovie(chatId,movieId){



    const video =
    await getVideo(movieId);




    if(!video){


        return bot.sendMessage(

            chatId,

            "❌ Video not found."

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

            "Send Error:",

            err.message

        );


    }


}
// ================================
// ADMIN CHECK
// ================================

function isAdmin(userId){

    return userId === ADMIN_ID;

}



// ================================
// ADMIN PANEL
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

Commands:

/stats - Total videos
/delete movieid - Delete movie

✅ Bot is working
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
// DATABASE COUNT
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
📊 Database Stats

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
// DELETE MOVIE
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





console.log(
"✅ All Features Loaded"
);
