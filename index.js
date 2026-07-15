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
// ================================
// WELCOME MESSAGE
// ================================

const WELCOME_TEXT = `
🎬 Welcome to CineXClub Bot

⚡ Fast • Secure • Free

📥 Send your movie link to receive your file instantly.

⏳ Files are automatically deleted after 30 minutes.
`;

// ================================
// SAVE VIDEO
// ================================

async function saveVideo(movieId, fileId) {
  try {

    movieId = movieId.trim().toLowerCase();

    await pool.query(
      `INSERT INTO videos(movie_id,file_id)
       VALUES($1,$2)
       ON CONFLICT(movie_id)
       DO UPDATE SET file_id=EXCLUDED.file_id`,
      [movieId, fileId]
    );

    console.log("✅ Saved:", movieId);

  } catch (err) {

    console.log("❌ Save Error");
    console.log(err);

  }
}

// ================================
// GET VIDEO
// ================================

async function getVideo(movieId) {

  try {

    movieId = movieId.trim().toLowerCase();

    const result = await pool.query(
      "SELECT * FROM videos WHERE LOWER(movie_id)=$1",
      [movieId]
    );

    console.log("🔎 Searching:", movieId);
    console.log(result.rows);

    return result.rows[0] || null;

  } catch (err) {

    console.log("❌ Database Error");
    console.log(err);

    return null;

  }

}

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

    console.log("Join Error:", err.message);
    return false;

  }

}
// ================================
// STORAGE CHANNEL HANDLER
// ================================

bot.on("channel_post", async (msg) => {

  if (msg.chat.id.toString() !== STORAGE_CHANNEL) return;

  if (!msg.video && !msg.document) return;

  if (!msg.caption) {
    console.log("❌ Caption Missing");
    return;
  }

  let movieId = "";

  // Caption format:
  // MovieID: ironman1
  const match = msg.caption.match(/movieid\s*:\s*(.+)/i);

  if (match) {
    movieId = match[1];
  } else {
    movieId = msg.caption;
  }

  movieId = movieId
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();

  const file = msg.video || msg.document;
  const fileId = file.file_id;

  console.log("📥 Upload Received");
  console.log("Movie ID :", movieId);
  console.log("File ID :", fileId);

  await saveVideo(movieId, fileId);

  const botLink = `https://t.me/${BOT_USERNAME}?start=${movieId}`;

  await bot.sendMessage(
    msg.chat.id,
    `✅ File Saved Successfully

🎬 Movie ID : ${movieId}

🔗 Click Here
${botLink}`
  );

  console.log("✅ Database Saved");
  console.log("🔗", botLink);

});
// ================================
// START COMMAND
// ================================

bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {

  const chatId = msg.chat.id;
  const movieId = (match[1] || "").trim().toLowerCase();

  // Welcome Message
  if (!movieId) {

    return bot.sendMessage(
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

  }

  console.log("🎬 Requested Movie:", movieId);

  // Force Join Check
  const joined = await checkJoin(chatId);

  if (!joined) {

    return bot.sendMessage(
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
                callback_data: `verify_${movieId}`
              }
            ]
          ]
        }
      }
    );

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

    return bot.answerCallbackQuery(query.id, {
      text: "❌ Please join the channel first.",
      show_alert: true
    });

  }

  await bot.answerCallbackQuery(query.id, {
    text: "✅ Verification Successful"
  });

  await sendVideo(chatId, movieId);

});
// ================================
// SEND FILE
// ================================

async function sendVideo(chatId, movieId) {

  console.log("🎬 Requested:", movieId);

  const video = await getVideo(movieId);

  console.log("Database Result:", video);

  if (!video) {

    return bot.sendMessage(
      chatId,
      "❌ Movie not found in our database.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔎 Search on Google",
                url: `https://www.google.com/search?q=${encodeURIComponent(movieId + " movie")}`
              }
            ],
            [
              {
                text: "👨‍💻 Support",
                url: ADMIN_LINK
              }
            ]
          ]
        }
      }
    );

  }

  try {

    const sent = await bot.sendDocument(
      chatId,
      video.file_id,
      {
        caption: `╭━━━━━━━━━━━━━━━━━━╮
🎬 𝗖𝗶𝗻𝗲𝗫𝗖𝗹𝘂𝗯
╰━━━━━━━━━━━━━━━━━━╯

✅ Your requested file is ready.

⚡ Fast Download
🔒 Original File
📁 High Quality

⏳ This file will be deleted automatically after 30 minutes.

📌 Please save or forward it before it is deleted.

❤️ Thanks for using CineXClub

🤖 @${BOT_USERNAME}`
      }
    );

    console.log("✅ File Sent");

    setTimeout(async () => {

      try {

        await bot.deleteMessage(chatId, sent.message_id);

        await bot.sendMessage(
          chatId,
          "🗑️ Your file has been deleted automatically.\n\nRequest it again anytime using your link."
        );

        console.log("🗑️ File Deleted");

      } catch (err) {

        console.log("Delete Error:", err.message);

      }

    }, AUTO_DELETE_TIME);

  } catch (err) {

    console.log("❌ Send Error");
    console.log(err);

    await bot.sendMessage(
      chatId,
      "❌ Unable to send this file.\nPlease contact Admin."
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

console.clear();

console.log(`
╔══════════════════════════════╗
║        🎬 CineXClub Bot      ║
║          Started ✅          ║
╚══════════════════════════════╝
`);

console.log("🤖 Bot Username :", BOT_USERNAME);
console.log("📢 Force Channel :", FORCE_CHANNEL);
console.log("💾 Storage Channel :", STORAGE_CHANNEL);
console.log("⏱️ Auto Delete :", AUTO_DELETE_TIME / 60000, "Minutes");
console.log("🗄️ Database :", process.env.DATABASE_URL ? "Configured ✅" : "Missing ❌");
console.log("🚀 Bot Ready...");
