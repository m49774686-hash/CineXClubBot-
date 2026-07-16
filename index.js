require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const http = require("http");

// ================================
// BOT START
// ================================
const bot = new TelegramBot(
    process.env.BOT_TOKEN,
    {
        polling: {
            interval: 300,
            autoStart: true
        }
    }
);

// ================================
// SETTINGS
// ================================
const FORCE_CHANNEL = "@CineXClub";
const FORCE_CHANNEL_LINK = "https://t.me";
const STORAGE_CHANNEL = "-1004426096451";
const BOT_USERNAME = "CineXClubBot";
const ADMIN_LINK = "https://t.meBot_Adminbot";
const AUTO_DELETE_TIME = 30 * 60 * 1000; // 30 Minutes

// ================================
// DATABASE
// ================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ================================
// DATABASE CREATE & COLUMN FIXES
// ================================
async function createTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS videos(
                id SERIAL PRIMARY KEY,
                type TEXT DEFAULT 'movie',
                movie_id TEXT,
                series_id TEXT,
                season TEXT,
                episode TEXT,
                title TEXT,
                year TEXT,
                quality TEXT,
                audio TEXT,
                size TEXT,
                language TEXT,
                file_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            ALTER TABLE videos ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'movie';
            ALTER TABLE videos ADD COLUMN IF NOT EXISTS movie_id TEXT;
            ALTER TABLE videos ADD COLUMN IF NOT EXISTS series_id TEXT;
            ALTER TABLE videos ADD COLUMN IF NOT EXISTS season TEXT;
            ALTER TABLE videos ADD COLUMN IF NOT EXISTS episode TEXT;
            ALTER TABLE videos ADD COLUMN IF NOT EXISTS title TEXT;
            ALTER TABLE videos ADD COLUMN IF NOT EXISTS year TEXT;
            ALTER TABLE videos ADD COLUMN IF NOT EXISTS quality TEXT;
            ALTER TABLE videos ADD COLUMN IF NOT EXISTS audio TEXT;
            ALTER TABLE videos ADD COLUMN IF NOT EXISTS size TEXT;
            ALTER TABLE videos ADD COLUMN IF NOT EXISTS language TEXT;
            ALTER TABLE videos ADD COLUMN IF NOT EXISTS file_id TEXT;
        `);

        await pool.query(`DROP INDEX IF EXISTS movie_id_unique_index;`);

        await pool.query(`
            ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_movie_id_key;
            ALTER TABLE videos ADD CONSTRAINT videos_movie_id_key UNIQUE(movie_id);
        `);

        console.log("✅ Database Ready");
    } catch (err) {
        console.log("❌ Database Error:", err.message);
    }
}

// Connect DB
pool.connect()
    .then(client => {
        console.log("✅ PostgreSQL Connected");
        client.release();
        createTable();
    })
    .catch(err => {
        console.log("❌ PostgreSQL Error", err.message);
    });

// ================================
// KEEP ALIVE SERVER
// ================================
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("🎬 CineXClub Bot Running");
}).listen(PORT, () => {
    console.log("🌐 Server Running:", PORT);
});

// ================================
// SAVE MOVIE / SERIES FUNCTIONS (YOUR ORIGINAL)
// ================================
async function saveMovie(data) {
    try {
        await pool.query(`
            INSERT INTO videos (type, movie_id, title, year, quality, audio, size, language, file_id)
            VALUES ('movie', $1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT(movie_id)
            DO UPDATE SET
                file_id=EXCLUDED.file_id,
                title=EXCLUDED.title,
                year=EXCLUDED.year,
                quality=EXCLUDED.quality,
                audio=EXCLUDED.audio,
                size=EXCLUDED.size,
                language=EXCLUDED.language
        `, [data.movie_id, data.title, data.year, data.quality, data.audio, data.size, data.language, data.file_id]);
        console.log("✅ Movie Saved:", data.movie_id);
        return true;
    } catch (err) {
        console.log("❌ Movie Save Error:", err.message);
        return false;
    }
}

async function saveEpisode(data) {
    try {
        await pool.query(`
            INSERT INTO videos (type, series_id, season, episode, title, quality, audio, size, language, file_id)
            VALUES ('series', $1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [data.series_id, data.season, data.episode, data.title, data.quality, data.audio, data.size, data.language, data.file_id]);
        console.log("✅ Episode Saved:", data.series_id, data.episode);
        return true;
    } catch (err) {
        console.log("❌ Episode Error:", err.message);
        return false;
    }
}

// ================================
// METADATA PARSER (YOUR ORIGINAL)
// ================================
function getMeta(text) {
    let data = {
        year: "",
        quality: "HD",
        audio: "Multi Audio",
        size: "",
        language: "Multi Audio"
    };

    let year = text.match(/\b(19|20)\d{2}\b/);
    if (year) data.year = year[0];

    if (/2160p/i.test(text)) data.quality = "2160p";
    else if (/1080p/i.test(text)) data.quality = "1080p";
    else if (/720p/i.test(text)) data.quality = "720p";
    else if (/480p/i.test(text)) data.quality = "480p";

    if (/Telugu/i.test(text)) data.audio = "Telugu";
    else if (/Hindi/i.test(text)) data.audio = "Hindi";
    else if (/Tamil/i.test(text)) data.audio = "Tamil";
    else if (/Malayalam/i.test(text)) data.audio = "Malayalam";

    let size = text.match(/\d+(\.\d+)?\s?(GB|MB)/i);
    if (size) data.size = size[0];

    data.language = data.audio;
    return data;
}

// ================================
// STORAGE CHANNEL UPLOAD (YOUR ORIGINAL)
// ================================
bot.on("channel_post", async (msg) => {
    if (msg.chat.id.toString() !== STORAGE_CHANNEL) return;
    if (!msg.video && !msg.document) return;
    if (!msg.caption) {
        console.log("❌ Caption Missing");
        return;
    }

    const file_id = msg.video ? msg.video.file_id : msg.document.file_id;
    const caption = msg.caption.trim();
    const meta = getMeta(caption);

    // SERIES UPLOAD
    if (/SeriesID:/i.test(caption) && /Episode:/i.test(caption)) {
        const series_id = caption.match(/SeriesID:\s*(.+)/i)[1].trim().toLowerCase();
        const episode = caption.match(/Episode:\s*(.+)/i)[1].trim();
        let season = "S01";
        if (/Season:/i.test(caption)) {
            season = caption.match(/Season:\s*(.+)/i)[1].trim();
        }

        const saved = await saveEpisode({
            series_id, season, episode, title: series_id,
            quality: meta.quality, audio: meta.audio, size: meta.size, language: meta.language, file_id
        });

        if (saved) {
            const link = `https://t.me{BOT_USERNAME}?start=${series_id}`;
            await bot.sendMessage(msg.chat.id, `✅ Episode Saved Successfully\n\n📺 Series: ${series_id}\n🎬 Episode: ${episode}\n🔗 Link:\n${link}`);
        }
        return;
    }

    // MOVIE UPLOAD
    let movie_id;
    if (/MovieID:/i.test(caption)) {
        movie_id = caption.match(/MovieID:\s*(.+)/i)[1];
    } else {
        movie_id = caption;
    }
    movie_id = movie_id.replace(/\s+/g, "").toLowerCase();

    const saved = await saveMovie({
        movie_id, title: movie_id, year: meta.year,
        quality: meta.quality, audio: meta.audio, size: meta.size, language: meta.language, file_id
    });

    if (saved) {
        const link = `https://t.me{BOT_USERNAME}?start=${movie_id}`;
        await bot.sendMessage(msg.chat.id, `✅ Movie Saved Successfully\n\n🎬 ID: ${movie_id}\n🔗 Bot Link:\n${link}`);
    }
});

// ================================
// FORCE JOIN CHECK
// ================================
async function checkJoin(userId) {
    try {
        const member = await bot.getChatMember(FORCE_CHANNEL, userId);
        return ["member", "administrator", "creator"].includes(member.status);
    } catch (err) {
        console.log("Join Check Error:", err.message);
        return false;
    }
}

// ================================
// GET FROM DB FUNCTIONS (YOUR ORIGINAL)
// ================================
async function getMovie(id) {
    try {
        const result = await pool.query("SELECT * FROM videos WHERE type='movie' AND LOWER(movie_id)=LOWER($1) LIMIT 1", [id]);
        return result.rows[0] || null;
    } catch (err) {
        console.log("Movie Search Error:", err.message);
        return null;
    }
}

async function getSeries(id) {
    try {
        const result = await pool.query("SELECT * FROM videos WHERE type='series' AND LOWER(series_id)=LOWER($1) ORDER BY id ASC", [id]);
        return result.rows;
    } catch (err) {
        console.log("Series Search Error:", err.message);
        return [];
    }
}

// ================================
// START COMMAND & DEEP LINK FLOW
// ================================
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || "User";
    const id = match ? match[1].trim().toLowerCase() : "";

    // 1. Normal Start Dashboard
    if (!id) {
        const welcomeKeyboard = {
            inline_keyboard: [
                [{ text: "🎬 Latest Movies", callback_data: "latest_movies" }, { text: "📺 Top Series", callback_data: "top_series" }],
                [{ text: "🎁 Request Movie & Series", url: ADMIN_LINK }]
            ]
        };
        
