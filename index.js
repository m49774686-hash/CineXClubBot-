require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const http = require("http");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});


// Private storage channel
const STORAGE_CHANNEL = "-1004426096451";

// Force join channel
const FORCE_CHANNEL = "@CineXClub";


// Video database (temporary)
let movies = [];


// Start + AroLinks parameter
bot.onText(/\/start(.*)/, async (msg, match) => {

  const chatId = msg.chat.id;
  const videoId = match[1].trim();


  if (!videoId) {

    bot.sendMessage(
      chatId,
      "Welcome to CineXClub Bot"
    );

    return;
  }


  try {

    const member = await bot.getChatMember(
      FORCE_CHANNEL,
      chatId
    );


    if (
      member.status === "left" ||
      member.status === "kicked"
    ) {

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
              ]
            ]
          }
        }
      );

      return;
    }


    const movie = movies.find(
      (m) => m.id === videoId
    );


    if (movie) {

      bot.sendVideo(
        chatId,
        movie.file_id
      );

    } else {

      bot.sendMessage(
        chatId,
        "Video not found."
      );

    }


  } catch (err) {

    console.log(err);

  }

});



// Private channel video save
bot.on("channel_post", (msg) => {


  if (msg.chat.id.toString() === STORAGE_CHANNEL) {


    if (msg.video && msg.caption) {


      const id = msg.caption
      .trim()
      .replace(/\s+/g, "");


      movies.push({

        id: id,
        file_id: msg.video.file_id

      });


      console.log(
        "Saved:",
        id
      );

    }

  }

});



// Error
bot.on("polling_error", (err)=>{

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
    "Server running",
    PORT
  );

});
