require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");

// ================================
// BOT START
// ================================

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true
  }
});

// ================================
// SETTINGS
// ================================

const FORCE_CHANNEL = "@CineXClub";
const STORAGE_CHANNEL = "-1004426096451";
const BOT_USERNAME = "CineXClubBot";
const ADMIN_LINK = "https://t.me/CineXClub_AdminBot";

const AUTO_DELETE_TIME = 30 * 60 * 1000; // 30 Minutes


// ================================
// POSTGRESQL
// ================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect()
  .then((client) => {
    console.log("✅ PostgreSQL Connected");
    client.release();
    createTable();
  })
  .catch((err) => {
    console.log("❌ PostgreSQL Connection Failed");
    console.log(err);
  });

// ================================
// CREATE TABLE
// ================================

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

    console.log("✅ Table Ready");

  } catch (err) {

    console.log("❌ Create Table Error");
    console.log(err);

  }
}

createTable();
// ================================
// WELCOME MESSAGE
// ================================

const WELCOME_TEXT = `
🎬 Welcome to CineXClub Bot

⚡ Fast • Secure • Free

📥 Send your movie link to receive the file instantly.

⏳ Files are automatically deleted after 10 minutes.

Enjoy your movie 🍿
`;

// ================================
// SAVE VIDEO
// ================================

async function saveVideo(movieId, fileId) {
  try {

    await pool.query(
      `
      INSERT INTO videos(movie_id,file_id)
      VALUES($1,$2)
      ON CONFLICT(movie_id)
      DO UPDATE SET file_id=$2
      `,
      [movieId.toLowerCase(), fileId]
    );

    console.log("✅ Saved:", movieId);

  } catch (err) {

    console.log("❌ Save Error:", err.message);

  }
}

// ================================
// GET VIDEO
// ================================

async function getVideo(movieId) {

  try {

    const result = await pool.query(
      "SELECT * FROM videos WHERE movie_id=$1",
      [movieId.toLowerCase()]
    );

    return result.rows.length ? result.rows[0] : null;

  } catch (err) {

    console.log("❌ Database Error:", err.message);
    return null;

  }

}
// ================================
// STORAGE CHANNEL HANDLER
// ================================

bot.on("channel_post", async (msg) => {

  if (msg.chat.id.toString() !== STORAGE_CHANNEL) return;

  // Accept Video or Document
  if (!msg.video && !msg.document) return;

  if (!msg.caption) {
    console.log("❌ Caption Missing");
    return;
  }

  // Caption example:
  // MovieID: ironman1

  let movieId = msg.caption;

  const match = msg.caption.match(/movieid\s*:\s*(.+)/i);

  if (match) {
    movieId = match[1].trim();
  } else {
    movieId = msg.caption.trim();
  }

  movieId = movieId
    .replace(/\s+/g, "")
    .toLowerCase();

  const file = msg.video || msg.document;
  const fileId = file.file_id;

  // Save File
  await saveVideo(movieId, fileId);

  // Bot Link
  const botLink =
    `https://t.me/${BOT_USERNAME}?start=${movieId}`;

  // Confirmation
  await bot.sendMessage(
    msg.chat.id,
    `✅ File Saved Successfully

🎬 Movie ID: ${movieId}

🔗 Click Here:
${botLink}`
  );

  console.log("✅ Saved:", movieId);
  console.log("🔗", botLink);

});
// ================================
// START COMMAND
// ================================

bot.onText(/\/start(.*)/, async (msg, match) => {

  const chatId = msg.chat.id;
  const movieId = match[1].trim().toLowerCase();

  // Normal Start
  if (!movieId) {

    await bot.sendMessage(
      chatId,
      WELCOME_TEXT,
      {
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
      }
    );

    return;
  }

  // Force Join
  const joined = await checkJoin(chatId);

  if (!joined) {

    await bot.sendMessage(
      chatId,
      "⚠️ Please join our channel first.",
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

  await sendVideo(chatId, movieId);

});

// ================================
// VERIFY BUTTON
// ================================

bot.on("callback_query", async (query) => {

  if (!query.data.startsWith("verify_")) return;

  const chatId = query.message.chat.id;
  const movieId = query.data.replace("verify_", "");

  const joined = await checkJoin(chatId);

  if (!joined) {

    await bot.answerCallbackQuery(query.id, {
      text: "❌ Please join our channel first.",
      show_alert: true
    });

    return;
  }

  await bot.answerCallbackQuery(query.id);

  await sendVideo(chatId, movieId);

});
// ================================
// SEND FILE
// ================================

async function sendVideo(chatId, movieId) {

  const video = await getVideo(movieId);

  if (!video) {

    await bot.sendMessage(
      chatId,
      "❌ File not found in our database.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔎 Google Search",
                url: `https://www.google.com/search?q=${encodeURIComponent(movieId + " movie")}`
              }
            ],
            [
              {
                text: "👨‍💻 Admin",
                url: ADMIN_LINK
              }
            ]
          ]
        }
      }
    );

    return;
  }

  try {

    const sent = await bot.sendDocument(
      chatId,
      video.file_id,
      {
        caption:
`🎬 Here is your file

⚠️ This file will be automatically deleted after 10 minutes.

📥 Please save or forward it before it is deleted.

━━━━━━━━━━━━━━
🤖 @${BOT_USERNAME}`
      }
    );

    // Delete after 10 minutes
    setTimeout(async () => {

      try {

        await bot.deleteMessage(
          chatId,
          sent.message_id
        );

        await bot.sendMessage(
          chatId,
          "🗑️ Your file has been deleted automatically after 10 minutes."
        );

        console.log("🗑️ File Deleted");

      } catch (err) {

        console.log(
          "Delete Error:",
          err.message
        );

      }

    }, AUTO_DELETE_TIME);

  } catch (err) {

    console.log(
      "Send Error:",
      err.message
    );

    await bot.sendMessage(
      chatId,
      "❌ Unable to send file. Please try again later."
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
  console.log("❌ Uncaught Exception");
  console.log(err);
});

process.on("unhandledRejection", (reason) => {
  console.log("❌ Unhandled Rejection");
  console.log(reason);
});

// ================================
// KEEP RENDER ALIVE
// ================================

const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {

  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("✅ CineXClub Bot Running");

}).listen(PORT, () => {

  console.log(`🌐 Server Running On Port ${PORT}`);

});

// ================================
// BOT STARTED
// ================================

console.log(`
╔══════════════════════════════╗
║      🎬 CineXClub Bot        ║
║         Started ✅           ║
╚══════════════════════════════╝
`);

console.log("🤖 Bot Username :", BOT_USERNAME);
console.log("📢 Force Channel :", FORCE_CHANNEL);
console.log("💾 Storage Channel :", STORAGE_CHANNEL);
console.log("⏱️ Auto Delete :", AUTO_DELETE_TIME / 60000, "Minutes");
console.log("🚀 Bot Ready...");
