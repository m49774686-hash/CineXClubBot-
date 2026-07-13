require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const http = require("http");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});


// Settings
const FORCE_CHANNEL = "@CineXClub";
const STORAGE_CHANNEL = "-1004426096451";


// Temporary video storage
let videos = [];


// Save videos from private channel
bot.on("channel_post", (msg) => {

  if (msg.chat.id.toString() === STORAGE_CHANNEL) {

    console.log("📩 Storage channel post");


    if (msg.video && msg.caption) {

      const videoId = msg.caption
        .trim()
        .replace(/\s+/g, "");


      videos.push({
        id: videoId,
        file_id: msg.video.file_id
      });


      console.log("✅ Saved:", videoId);
      console.log("FILE ID:", msg.video.file_id);

    }

  }

});



// Check channel join
async function checkJoin(userId) {

  try {

    const member = await bot.getChatMember(
      FORCE_CHANNEL,
      userId
    );


    return (
      member.status === "member" ||
      member.status === "administrator" ||
      member.status === "creator"
    );


  } catch (err) {

    console.log("Join error:", err.message);
    return false;

  }

}



// /start handler
bot.onText(/\/start(.*)/, async (msg, match) => {


  const chatId = msg.chat.id;

  const videoId = match[1].trim();



  if (!videoId) {

    bot.sendMessage(
      chatId,
      "🎬 Welcome to CineXClub Bot"
    );

    return;

  }



  const joined = await checkJoin(chatId);



  if (!joined) {


    bot.sendMessage(
      chatId,
      "Please join our channel first.",
      {
        reply_markup: {
          inline_keyboard: [

            [
              {
                text: "Join Channel",
                url: "https://t.me/CineXClub"
              }
            ],

            [
              {
                text: "I've Joined ✅",
                callback_data: "verify_" + videoId
              }
            ]

          ]
        }
      }
    );


    return;

  }



  sendVideo(chatId, videoId);


});




// Verify button
bot.on("callback_query", async (query) => {


  const chatId = query.message.chat.id;


  if (query.data.startsWith("verify_")) {


    const videoId = query.data.replace(
      "verify_",
      ""
    );


    const joined = await checkJoin(chatId);



    if (!joined) {


      bot.answerCallbackQuery(
        query.id,
        {
          text: "Join channel first"
        }
      );


      return;

    }



    bot.answerCallbackQuery(query.id);


    sendVideo(
      chatId,
      videoId
    );


  }

});




// Send video + delete after 30 minutes
function sendVideo(chatId, videoId) {


  const video = videos.find(
    v => v.id === videoId
  );


  if (!video) {


    bot.sendMessage(
      chatId,
      "❌ Video not found"
    );


    return;

  }



  bot.sendVideo(
    chatId,
    video.file_id,
    {
      caption: "🎬 Here is your video\n\n⏳ This video will be deleted after 30 minutes."
    }

  ).then((sentMsg)=>{


    setTimeout(()=>{


      bot.deleteMessage(
        chatId,
        sentMsg.message_id
      )
      .then(()=>{

        console.log("🗑️ Video deleted");

      })
      .catch(err=>{

        console.log(
          "Delete error:",
          err.message
        );

      });


    }, 30 * 60 * 1000);



  });


}



// Error
bot.on("polling_error",(err)=>{

  console.log(
    "Polling Error:",
    err.message
  );

});



console.log("🤖 Bot Started");



// Render server
const PORT = process.env.PORT || 10000;


http.createServer((req,res)=>{

  res.writeHead(200);

  res.end("Bot Running");


}).listen(PORT,()=>{

  console.log(
    "🌐 Server running on",
    PORT
  );

});
