require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true
  }
});

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Create Table
async function createTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        movie_id TEXT UNIQUE NOT NULL,
        file_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("✅ Database Connected");
  } catch (err) {
    console.log("Database Error:", err.message);
  }
}

createTable();

// Settings
const FORCE_CHANNEL = "@CineXClub";
const STORAGE_CHANNEL = "-1004426096451";

// Welcome Message
const WELCOME_TEXT = `
🎬 Welcome to CineXClub Bot

✅ Send your movie link to receive the video.

⚡ Fast | Secure | Free
`;

// Save Video to Database
async function saveVideo(movieId, fileId) {
  try {
    await pool.query(
      `INSERT INTO videos(movie_id,file_id)
       VALUES($1,$2)
       ON CONFLICT(movie_id)
       DO UPDATE SET file_id=$2`,
      [movieId, fileId]
    );

    console.log("✅ Saved:", movieId);

  } catch (err) {
    console.log(err.message);
  }
}

// Get Video
async function getVideo(movieId) {
  try {
    const result = await pool.query(
      "SELECT * FROM videos WHERE movie_id = $1",
      [movieId]
    );

    return result.rows[0];

  } catch (err) {
    console.log(err.message);
    return null;
  }
}
// ================================
// STORAGE CHANNEL HANDLER
// ================================

bot.on("channel_post", async (msg) => {

  if (msg.chat.id.toString() !== STORAGE_CHANNEL) return;

  console.log("📥 New post received");

  if (!msg.video) return;

  if (!msg.caption) {
    console.log("❌ Caption missing");
    return;
  }

  const movieId = msg.caption
    .trim()
    .replace(/\s+/g, "");

  const fileId = msg.video.file_id;

  await saveVideo(movieId, fileId);

  console.log("🎬 Movie ID :", movieId);
  console.log("🆔 File ID :", fileId);

});


// ================================
// FORCE JOIN CHECK
// ================================

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

    console.log("Join Check Error:", err.message);

    return false;

  }

       }
// ================================
// /START HANDLER
// ================================

bot.onText(/\/start(.*)/, async (msg, match) => {

  const chatId = msg.chat.id;
  const movieId = match[1].trim();

  // Normal /start
  if (!movieId) {
    await bot.sendMessage(chatId, WELCOME_TEXT, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📢 Join Channel",
              url: "https://t.me/CineXClub"
            }
          ]
        ]
      }
    });

    return;
  }

  // Force Join Check
  const joined = await checkJoin(chatId);

  if (!joined) {

    await bot.sendMessage(
      chatId,
      "⚠️ Please join our channel first to access the movie.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📢 Join Channel",
                url: "https://t.me/CineXClub"
              }
            ],
            [
              {
                text: "✅ I've Joined",
                callback_data: "verify_" + movieId
              }
            ]
          ]
        }
      }
    );

    return;
  }

  // User joined → send movie
  await sendVideo(chatId, movieId);

});


// ================================
// VERIFY BUTTON
// ================================

bot.on("callback_query", async (query) => {

  const chatId = query.message.chat.id;

  if (!query.data.startsWith("verify_")) return;

  const movieId = query.data.replace("verify_", "");

  const joined = await checkJoin(chatId);

  if (!joined) {

    await bot.answerCallbackQuery(query.id, {
      text: "❌ Please join the channel first.",
      show_alert: true
    });

    return;
  }

  await bot.answerCallbackQuery(query.id);

  await sendVideo(chatId, movieId);

});
// ================================
// SEND VIDEO
// ================================

async function sendVideo(chatId, movieId) {

  const video = await getVideo(movieId);

  // Video not found
  if (!video) {

    await bot.sendMessage(
      chatId,
      "❌ Video not in our database.\n\n🔍 You can search it on Google.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔎 Google Search",
                url: `https://www.google.com/search?q=${encodeURIComponent(movieId + " movie")}`
              }
            ]
          ]
        }
      }
    );

    return;
  }

  try {

    const sent = await bot.sendVideo(
      chatId,
      video.file_id,
      {
        caption:
`🎬 Here is your movie

⏳ This message will be deleted after 30 minutes.`
      }
    );

    // Delete after 30 minutes
    setTimeout(async () => {

      try {

        await bot.deleteMessage(
          chatId,
          sent.message_id
        );

        console.log("🗑️ Video deleted");

      } catch (err) {

        console.log(
          "Delete Error:",
          err.message
        );

      }

    }, 30 * 60 * 1000);

  } catch (err) {

    console.log(
      "Send Video Error:",
      err.message
    );

    await bot.sendMessage(
      chatId,
      "❌ Unable to send video."
    );

  }

}
// ================================
// BOT EVENTS
// ================================

bot.on("polling_error", (err) => {
  console.log("❌ Polling Error:", err.message);
});

bot.on("webhook_error", (err) => {
  console.log("❌ Webhook Error:", err.message);
});


// ================================
// GLOBAL ERROR HANDLING
// ================================

process.on("uncaughtException", (err) => {
  console.log("❌ Uncaught Exception:");
  console.log(err);
});

process.on("unhandledRejection", (reason) => {
  console.log("❌ Unhandled Rejection:");
  console.log(reason);
});


// ================================
// HTTP SERVER (Render Health Check)
// ================================

const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {

  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("✅ CineXClub Bot Running");

}).listen(PORT, () => {

  console.log(`🌐 Server running on port ${PORT}`);

});


// ================================
// BOT STARTED
// ================================

console.log("🤖 CineXClub Bot Started Successfully");
