require("dotenv").config();

const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGO_URI);

async function connectDB() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Error:", err);
  }
}

connectDB();
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true,
});


bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Welcome to CineXClub Bot");
});

bot.on("channel_post", (msg) => {
  if (msg.video) {
    console.log("FILE_ID:", msg.video.file_id);

    bot.sendMessage(msg.chat.id, 
      `File ID:\n${msg.video.file_id}`
    );
  }
});
console.log("Bot Started...");

const http = require("http");

const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running!");
}).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
