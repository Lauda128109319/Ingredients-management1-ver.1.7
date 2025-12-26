const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// ★ Renderでは必ず process.env.PORT を使う
const PORT = process.env.PORT || 3000;

// SQLiteの保存場所（RenderでもOK）
const DB_PATH = path.join(__dirname, 'food-alert.db');

// --- ミドルウェア設定 ---
app.use(cors());
app.use(bodyParser.json());

// ★ 静的ファイル（HTML, CSS, JS）を配信
app.use(express.static(path.join(__dirname)));

// --- データベース初期化 ---
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('DB接続エラー:', err.message);
    } else {
        console.log('SQLiteデータベースに接続しました');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS foods (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                qty REAL,
                expiry INTEGER,
                originalExpiry INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
    });
}

// --- API ---

// 新規登録
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: '入力が必要です' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        db.run(
            `INSERT INTO users (username, password_hash) VALUES (?, ?)`,
            [username, hash],
            function (err) {
                if (err) {
                    return res.status(409).json({ error: 'その名前は既に使用されています' });
                }
                res.status(201).json({ message: '登録完了' });
            }
        );
    } catch (e) {
        res.status(500).json({ error: 'エラーが発生しました' });
    }
});

// ログイン
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get(
        `SELECT * FROM users WHERE username = ?`,
        [username],
        async (err, user) => {
            if (!user) {
                return res.status(401).json({ error: 'ユーザー名かパスワードが違います' });
            }

            const match = await bcrypt.compare(password, user.password_hash);
            if (match) {
                res.json({
                    message: '成功',
                    user: { id: user.id, username: user.username }
                });
            } else {
                res.status(401).json({ error: 'ユーザー名かパスワードが違います' });
            }
        }
    );
});

// 食材一覧取得
app.get('/api/foods', (req, res) => {
    const username = req.query.username;
    if (!username) {
        return res.status(400).json({ error: 'ユーザー名が必要です' });
    }

    db.all(
        `
        SELECT foods.*
        FROM foods
        JOIN users ON foods.user_id = users.id
        WHERE users.username = ?
        `,
        [username],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows);
            }
        }
    );
});

// 食材追加
app.post('/api/foods', (req, res) => {
    const { id, username, name, qty, expiry, originalExpiry } = req.body;

    db.get(
        `SELECT id FROM users WHERE username = ?`,
        [username],
        (err, user) => {
            if (!user) {
                return res.status(400).json({ error: 'ユーザー不明' });
            }

            db.run(
                `
                INSERT INTO foods (id, user_id, name, qty, expiry, originalExpiry)
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [id, user.id, name, qty, expiry, originalExpiry],
                (err) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                    } else {
                        res.json({ message: '追加成功' });
                    }
                }
            );
        }
    );
});

// 食材削除
app.delete('/api/foods/:id', (req, res) => {
    db.run(
        `DELETE FROM foods WHERE id = ?`,
        [req.params.id],
        () => {
            res.json({ message: '削除成功' });
        }
    );
});

// 食材更新
app.put('/api/foods/:id', (req, res) => {
    const { name, qty, expiry, originalExpiry } = req.body;

    db.run(
        `
        UPDATE foods
        SET name = ?, qty = ?, expiry = ?, originalExpiry = ?
        WHERE id = ?
        `,
        [name, qty, expiry, originalExpiry, req.params.id],
        () => {
            res.json({ message: '更新成功' });
        }
    );
});

// --- サーバー起動 ---
app.listen(PORT, () => {
    console.log(`サーバー起動: http://localhost:${PORT}`);
});
