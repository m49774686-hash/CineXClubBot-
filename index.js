require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const http = require("http");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});


// Movies storage (Memory)
let movies = [];


// Start
bot.onText(/\/start/, (msg) => {

  bot.sendMessage(
    msg.chat.id,
    "✅ CineXClub Bot Working!\n\nMovie name send cheyyandi."
  );

});


// Channel video save
bot.on("channel_post", (msg) => {

  console.log("📩 Channel post received");


  if (msg.video && msg.caption) {

    const movieName = msg.caption.trim().toLowerCase();
    const fileId = msg.video.file_id;


    movies.push({
      name: movieName,
      file_id: fileId
    });


    console.log("🎬 Saved:", movieName);
    console.log("FILE ID:", fileId);

  }

});


// Movie search
bot.on("message", (msg) => {

  if (!msg.text) return;

  if (msg.text.startsWith("/")) return;


  const movieName = msg.text.trim().toLowerCase();


  const movie = movies.find(
    (m) => m.name === movieName
  );


  if (movie) {

    bot.sendVideo(
      msg.chat.id,
      movie.file_id
    );


  } else {

    bot.sendMessage(
      msg.chat.id,
      "❌ Movie not found"
    );

  }

});


// Error
bot.on("polling_error", (err) => {

  console.log("Polling Error:", err.message);

});


console.log("🤖 Bot Started");


// Render server
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {

  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("Bot is running");

}).listen(PORT, () => {

  console.log(`🌐 Server running on ${PORT}`);

});
