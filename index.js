require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { MongoClient } = require("mongodb");
const http = require("http");


// MongoDB
const client = new MongoClient(process.env.MONGO_URI);

async function connectDB() {
  try {
    await client.connect();
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


// Start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "✅ CineXClub Bot Working!"
  );
});


// Private Channel Video File ID
bot.on("channel_post", (msg) => {

  console.log("📩 CHANNEL POST RECEIVED");

  if (msg.video) {

    const fileId = msg.video.file_id;

    console.log("🎬 FILE_ID:", fileId);

    bot.sendMessage(
      msg.chat.id,
      `File ID:\n${fileId}`
    );

  } else {
    console.log("No video found");
  }

});


// Error handler
bot.on("polling_error", (error) => {
  console.log("Polling Error:", error.message);
});


console.log("🤖 Bot Started...");


// Render keep alive server
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("Bot is running!");
}).listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
