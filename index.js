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
  bot.sendMessage(msg.chat.id, "✅ CineXClub Bot Working!");
});

console.log("Bot Started...");
