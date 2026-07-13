require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { MongoClient } = require("mongodb");
const http = require("http");


// MongoDB
const client = new MongoClient(process.env.MONGO_URI);

let movies;


// Connect Database
async function connectDB() {
  try {
    await client.connect();

    const db = client.db("CineXClub");
    movies = db.collection("movies");

    console.log("✅ MongoDB Connected");

  } catch (err) {
    console.log("❌ MongoDB Error:", err.message);
  }
}

connectDB();


// Telegram Bot
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});


// Start
bot.onText(/\/start/, (msg) => {

  bot.sendMessage(
    msg.chat.id,
    "✅ CineXClub Bot Working!\n\nMovie name send cheyyandi."
  );

});


// Channel video save
bot.on("channel_post", async (msg) => {

  console.log("📩 Channel post received");


  if (msg.video && msg.caption) {

    const movieName = msg.caption.trim();
    const fileId = msg.video.file_id;


    await movies.insertOne({
      name: movieName.toLowerCase(),
      file_id: fileId
    });


    console.log("🎬 Saved:", movieName);

  }

});


// Movie search
bot.on("message", async (msg) => {

  if (!msg.text) return;

  if (msg.text.startsWith("/")) return;


  const movieName = msg.text.trim().toLowerCase();


  try {

    const movie = await movies.findOne({
      name: movieName
    });


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


  } catch (err) {

    console.log(err);

  }

});


// Telegram Error
bot.on("polling_error", (err) => {

  console.log("Polling Error:", err.message);

});



console.log("🤖 Bot Started");


// Render Server
const PORT = process.env.PORT || 10000;


http.createServer((req, res) => {

  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("Bot is running");

}).listen(PORT, () => {

  console.log(`🌐 Server running on ${PORT}`);

});
