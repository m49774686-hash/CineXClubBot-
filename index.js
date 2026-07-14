require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");


// ================= CONFIG =================

const BOT_TOKEN = process.env.BOT_TOKEN;

const BOT_USERNAME =
process.env.BOT_USERNAME || "CineXClubBot";

const FORCE_CHANNEL =
process.env.FORCE_CHANNEL;

const STORAGE_CHANNEL =
String(process.env.STORAGE_CHANNEL);

const ADMIN_USERNAME =
process.env.ADMIN_USERNAME || "CineXClub";


const AUTO_DELETE_TIME =
30 * 60 * 1000;


// ================= BOT =================

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



// ================= DATABASE =================

const pool = new Pool({

    connectionString:
    process.env.DATABASE_URL,

    ssl:{
        rejectUnauthorized:false
    }

});



async function initDB(){

    await pool.query(`

    CREATE TABLE IF NOT EXISTS videos(

        id SERIAL PRIMARY KEY,

        movie_id TEXT UNIQUE NOT NULL,

        file_id TEXT NOT NULL,

        caption TEXT,

        created_at TIMESTAMP DEFAULT NOW()

    )

    `);


    console.log("✅ Database Ready");

}


initDB();



// ================= RENDER KEEP ALIVE =================

http.createServer(
(req,res)=>{

    res.end(
        "CineXClub Bot Running"
    );

}

).listen(
process.env.PORT || 3000
);



// ================= ERROR =================

bot.on(
"polling_error",
(err)=>{

console.log(
"Polling Error:",
err.message
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
// GET VIDEO DATABASE
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
            "DB Error:",
            err.message
        );

        return null;

    }

}





// ================================
// START COMMAND
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




    // Normal Start

    if(!movieId){


        return bot.sendMessage(

            chatId,

`
🎬 Welcome to CineXClub Bot

Click on link

You Received Your File Instantly
`

        );

    }




    console.log(
        "Requested:",
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

],


[

{

text:"👨‍💻 Admin",

url:
`https://t.me/${ADMIN_USERNAME}`

}

]


]

}

}

        );

    }




    // Video sending in Part 3


});






// ================================
// JOIN BUTTON
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


        bot.answerCallbackQuery(

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


        bot.answerCallbackQuery(

            query.id,

            {
                text:"❌ Join first"
            }

        );


    }


});
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
// SAVE VIDEO
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
// PRIVATE STORAGE CHANNEL
// ================================

bot.on(
"channel_post",

async(msg)=>{


    try{


        console.log(
            "Channel Message:",
            msg.chat.id
        );



        // Storage Channel Check

        if(
            String(msg.chat.id)
            !==
            String(STORAGE_CHANNEL)
        ){

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




        // First line = Movie ID

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
            "Channel Error:",
            err.message
        );


    }


});






// ================================
// SEND MOVIE
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
            "Send Video Error:",
            err.message
        );


    }


    }
// ================================
// CONNECT START WITH SEND VIDEO
// ================================

// NOTE:
// Part 2 లో movieId వచ్చినప్పుడు
// sendMovie() call చేయాలి.
// ఇది final connection.


bot.onText(

/\/start(?:\s(.+))?/,

async(msg,match)=>{


    const movieId = match[1];


    if(!movieId){

        return;

    }


    const joined =
    await checkJoin(
        msg.from.id
    );


    if(!joined){

        return sendJoinMessage(
            msg.chat.id
        );

    }


    await sendMovie(

        msg.chat.id,

        movieId

    );


});





console.log(
"✅ CineXClub Bot Fully Loaded"
);
