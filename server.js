// ============================================================
//  LUMIÈRE — Serveur Backend (Node.js + Express + PostgreSQL)
//  Stockage fichiers : Cloudinary
//  Production-ready pour Render
// ============================================================

const express      = require('express');
const { Pool }     = require('pg');
const cors         = require('cors');
const path         = require('path');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const cloudinary   = require('cloudinary').v2;
const { body, param, query, validationResult } = require('express-validator');

const app  = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET non défini. Arrêt.');
  process.exit(1);
}

// ── Cloudinary ────────────────────────────────────────────────
cloudinary.config({
  cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
  api_key    : process.env.CLOUDINARY_API_KEY,
  api_secret : process.env.CLOUDINARY_API_SECRET,
  secure     : true,
});

const cloudinaryEnabled = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

// ── Middleware sécurité ───────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc : ["'self'"],
      scriptSrc  : ["'self'", "'unsafe-inline'"],
      styleSrc   : ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc    : ["'self'", 'https://fonts.gstatic.com'],
      imgSrc     : ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      mediaSrc   : ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origin non autorisée par CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// ── Désactive le cache sur toutes les routes API ──────────────
app.use('/api/', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ── Fichiers statiques ────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false }));

// ── Connexion PostgreSQL ──────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Erreur pool PostgreSQL :', err.message);
});

(async () => {
  const MAX_RETRIES = 10;
  const RETRY_DELAY_MS = 3000;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = await pool.connect();
      console.log('Connecté à PostgreSQL');
      client.release();
      await initTables();
      await initAdminPassword();
      return;
    } catch (err) {
      console.error(`Connexion PostgreSQL échouée (tentative ${attempt}/${MAX_RETRIES}) :`, err.message);
      if (attempt === MAX_RETRIES) {
        console.error('Impossible de se connecter à PostgreSQL après plusieurs tentatives. Arrêt.');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
})();

// ── Création automatique des tables ──────────────────────────
async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      email      VARCHAR(255) PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      phone      VARCHAR(50),
      address    TEXT,
      password   VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id          BIGINT       PRIMARY KEY,
      name        VARCHAR(255) NOT NULL,
      price       INTEGER      NOT NULL,
      category    VARCHAR(100),
      quantite    VARCHAR(100),
      description TEXT,
      created_at  TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id         SERIAL PRIMARY KEY,
      product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
      image_url  TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id             VARCHAR(50)  PRIMARY KEY,
      "userId"       VARCHAR(255) REFERENCES customers(email) ON DELETE SET NULL,
      customer       VARCHAR(255),
      total          INTEGER,
      status         VARCHAR(50)  DEFAULT 'pending',
      address        TEXT,
      "trackingCode" VARCHAR(50),
      proof_url      TEXT,
      created_at     TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_orders_userid       ON orders("userId");
    CREATE INDEX IF NOT EXISTS idx_orders_trackingcode ON orders("trackingCode");

    CREATE TABLE IF NOT EXISTS order_items (
      id           SERIAL      PRIMARY KEY,
      order_id     VARCHAR(50) REFERENCES orders(id) ON DELETE CASCADE,
      product_id   BIGINT,
      product_name VARCHAR(255),
      quantity     INTEGER,
      price        INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
      id            INTEGER PRIMARY KEY DEFAULT 1,
      "bankName"    VARCHAR(255),
      "bankAccount" VARCHAR(255),
      "bankHolder"  VARCHAR(255),
      "bankMobile"  VARCHAR(50),
      CONSTRAINT settings_single_row CHECK (id = 1)
    );

    INSERT INTO settings (id, "bankName", "bankAccount", "bankHolder", "bankMobile")
    VALUES (1, '', '', '', '')
    ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS videos (
      id         BIGINT      PRIMARY KEY,
      title      VARCHAR(255),
      url        TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admins (
      id       SERIAL       PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255)        NOT NULL
    );
  `);
  console.log('Tables vérifiées / créées');
}

// ── Initialise le mot de passe admin ─────────────────────────
async function initAdminPassword() {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return;
  try {
    const { rows } = await pool.query(
      'SELECT password FROM admins WHERE username=$1', [ADMIN_USERNAME]
    );
    if (rows.length === 0) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await pool.query(
        'INSERT INTO admins (username, password) VALUES ($1,$2) ON CONFLICT (username) DO UPDATE SET password=EXCLUDED.password',
        [ADMIN_USERNAME, hash]
      );
      console.log('Admin initialisé');
    } else {
      const stored = rows[0].password;
      if (!stored.startsWith('$2')) {
        const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
        await pool.query('UPDATE admins SET password=$1 WHERE username=$2', [hash, ADMIN_USERNAME]);
        console.log('Mot de passe admin hashé');
      }
    }
  } catch (err) {
    console.error('Erreur init admin:', err.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
}

function authenticateAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token requis' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function authenticateUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Connexion requise' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));


// ════════════════════════════════════════════════════════════
//  UPLOAD CLOUDINARY
// ════════════════════════════════════════════════════════════

// POST /api/upload  — upload admin (images produits, vidéos)
app.post('/api/upload', authenticateAdmin, [
  body('data').notEmpty().withMessage('Données requises'),
  body('resourceType').optional().isIn(['image', 'video', 'auto']),
], validate, async (req, res) => {
  if (!cloudinaryEnabled) {
    return res.status(503).json({ error: 'Stockage cloud non configuré (CLOUDINARY_*)' });
  }
  const { data, resourceType = 'auto' } = req.body;
  try {
    const result = await cloudinary.uploader.upload(data, {
      folder        : 'lumiere',
      resource_type : resourceType,
      quality       : 'auto',
      fetch_format  : 'auto',
    });
    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    console.error('Cloudinary upload error:', err.message);
    res.status(500).json({ error: 'Erreur upload fichier' });
  }
});

// POST /api/upload/proof  — upload preuve de paiement (client connecté)
app.post('/api/upload/proof', authenticateUser, [
  body('data').notEmpty().withMessage('Données requises'),
], validate, async (req, res) => {
  if (!cloudinaryEnabled) {
    return res.status(503).json({ error: 'Stockage cloud non configuré (CLOUDINARY_*)' });
  }
  const { data } = req.body;
  try {
    const result = await cloudinary.uploader.upload(data, {
      folder        : 'lumiere/proofs',
      resource_type : 'image',
      quality       : 'auto',
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error('Cloudinary proof upload error:', err.message);
    res.status(500).json({ error: 'Erreur upload preuve' });
  }
});


// ════════════════════════════════════════════════════════════
//  AUTH CLIENTS
// ════════════════════════════════════════════════════════════

app.post('/api/register', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('name').trim().notEmpty().isLength({ max: 255 }).withMessage('Nom requis'),
  body('password').isLength({ min: 6 }).withMessage('Mot de passe : 6 caractères minimum'),
  body('phone').optional().trim().isLength({ max: 50 }),
  body('address').optional().trim().isLength({ max: 1000 }),
], validate, async (req, res) => {
  const { name, email, phone, address, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO customers (email, name, phone, address, password) VALUES ($1,$2,$3,$4,$5)',
      [email, name, phone || null, address || null, hash]
    );
    const token = jwt.sign({ email, name, role: 'customer' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ ok: true, token, user: { email, name, phone, address } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email déjà utilisé' });
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/login', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
], validate, async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query(
      'SELECT email, name, phone, address, password AS hash FROM customers WHERE email=$1',
      [email]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Identifiants incorrects' });
    const user    = rows[0];
    const stored  = user.hash;
    const isBcrypt = stored && stored.startsWith('$2');
    const valid   = isBcrypt
      ? await bcrypt.compare(password, stored)
      : password === stored;
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });
    if (!isBcrypt) {
      const h = await bcrypt.hash(password, 12);
      await pool.query('UPDATE customers SET password=$1 WHERE email=$2', [h, email]);
    }
    const token = jwt.sign({ email: user.email, name: user.name, role: 'customer' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ ok: true, token, user: { email: user.email, name: user.name, phone: user.phone, address: user.address } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// ════════════════════════════════════════════════════════════
//  PRODUITS
// ════════════════════════════════════════════════════════════

app.get('/api/products', async (_req, res) => {
  try {
    const { rows: products } = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    for (const p of products) {
      const { rows: imgs } = await pool.query(
        'SELECT image_url FROM product_images WHERE product_id=$1', [p.id]
      );
      p.images = imgs.map(r => r.image_url);
      p.desc   = p.description;
    }
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur chargement produits' });
  }
});

app.post('/api/products', authenticateAdmin, [
  body('name').trim().notEmpty().isLength({ max: 255 }),
  body('price').isInt({ min: 0 }),
  body('category').optional().trim().isLength({ max: 100 }),
  body('quantite').optional().trim().isLength({ max: 100 }),
  body('desc').optional().trim().isLength({ max: 5000 }),
  body('images').optional().isArray(),
], validate, async (req, res) => {
  const { id, name, price, category, quantite, desc, images = [] } = req.body;
  const productId = id || Date.now();
  try {
    await pool.query(
      'INSERT INTO products (id, name, price, category, quantite, description) VALUES ($1,$2,$3,$4,$5,$6)',
      [productId, name, price, category, quantite, desc]
    );
    for (const url of images) {
      await pool.query('INSERT INTO product_images (product_id, image_url) VALUES ($1,$2)', [productId, url]);
    }
    res.json({ ok: true, id: productId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur création produit' });
  }
});

app.put('/api/products/:id', authenticateAdmin, [
  param('id').isNumeric(),
  body('name').optional().trim().isLength({ max: 255 }),
  body('price').optional().isInt({ min: 0 }),
  body('images').optional().isArray(),
], validate, async (req, res) => {
  const { id } = req.params;
  const { name, price, desc, category, quantite, images = [] } = req.body;
  try {
    await pool.query(
      'UPDATE products SET name=$1, price=$2, description=$3, category=$4, quantite=$5 WHERE id=$6',
      [name, price, desc, category, quantite, id]
    );
    await pool.query('DELETE FROM product_images WHERE product_id=$1', [id]);
    for (const url of images) {
      await pool.query('INSERT INTO product_images (product_id, image_url) VALUES ($1,$2)', [id, url]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur modification produit' });
  }
});

app.delete('/api/products/:id', authenticateAdmin, [
  param('id').isNumeric(),
], validate, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur suppression produit' });
  }
});


// ════════════════════════════════════════════════════════════
//  COMMANDES
// ════════════════════════════════════════════════════════════

app.get('/api/orders/track', [
  query('code').trim().notEmpty().isLength({ max: 50 }),
], validate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, customer, total, status, "trackingCode", created_at
       FROM orders WHERE "trackingCode"=$1`,
      [req.query.code]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Commande introuvable' });
    const o = rows[0];
    const { rows: items } = await pool.query(
      'SELECT product_name, quantity FROM order_items WHERE order_id=$1', [o.id]
    );
    res.json({ ...o, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur recherche commande' });
  }
});

app.get('/api/orders/me', authenticateUser, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT *, "userId", "trackingCode", proof_url FROM orders WHERE "userId"=$1 ORDER BY created_at DESC`,
      [req.user.email]
    );
    for (const o of rows) {
      const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_id=$1', [o.id]);
      o.items    = items;
      o.proofUrl = o.proof_url;
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur chargement commandes' });
  }
});

app.get('/api/orders', authenticateAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT *, "userId", "trackingCode", proof_url FROM orders ORDER BY created_at DESC'
    );
    for (const o of rows) {
      const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_id=$1', [o.id]);
      o.items    = items;
      o.proofUrl = o.proof_url;
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur chargement commandes' });
  }
});

app.post('/api/orders', authenticateUser, [
  body('id').trim().notEmpty().isLength({ max: 50 }),
  body('customer').trim().notEmpty().isLength({ max: 255 }),
  body('total').isInt({ min: 0 }),
  body('address').trim().notEmpty().isLength({ max: 1000 }),
  body('items').isArray({ min: 1 }),
], validate, async (req, res) => {
  const { id, customer, items = [], total, address, trackingCode, proofUrl } = req.body;
  const userId = req.user.email;
  try {
    await pool.query(
      `INSERT INTO orders (id, "userId", customer, total, status, address, "trackingCode", proof_url)
       VALUES ($1,$2,$3,$4,'pending',$5,$6,$7)`,
      [id, userId, customer, total, address, trackingCode, proofUrl || null]
    );
    for (const item of items) {
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES ($1,$2,$3,$4,$5)',
        [id, item.id, item.name, item.qty, item.price]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur création commande' });
  }
});

app.put('/api/orders/:id', authenticateAdmin, [
  param('id').trim().notEmpty().isLength({ max: 50 }),
  body('status').isIn(['pending', 'confirmed', 'shipping', 'delivered']),
], validate, async (req, res) => {
  try {
    await pool.query('UPDATE orders SET status=$1 WHERE id=$2', [req.body.status, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur mise à jour commande' });
  }
});

app.delete('/api/orders/:id', authenticateAdmin, [
  param('id').trim().notEmpty().isLength({ max: 50 }),
], validate, async (req, res) => {
  try {
    await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur suppression commande' });
  }
});


// ════════════════════════════════════════════════════════════
//  PARAMÈTRES BANCAIRES
// ════════════════════════════════════════════════════════════

app.get('/api/settings', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT "bankName", "bankAccount", "bankHolder", "bankMobile" FROM settings WHERE id=1`
    );
    res.json(rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur paramètres' });
  }
});

app.post('/api/settings', authenticateAdmin, [
  body('bankName').optional().trim().isLength({ max: 255 }),
  body('bankAccount').optional().trim().isLength({ max: 255 }),
  body('bankHolder').optional().trim().isLength({ max: 255 }),
  body('bankMobile').optional().trim().isLength({ max: 50 }),
], validate, async (req, res) => {
  const { bankName, bankAccount, bankHolder, bankMobile } = req.body;
  try {
    await pool.query(
      `INSERT INTO settings (id, "bankName", "bankAccount", "bankHolder", "bankMobile")
       VALUES (1,$1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET
         "bankName"=EXCLUDED."bankName",
         "bankAccount"=EXCLUDED."bankAccount",
         "bankHolder"=EXCLUDED."bankHolder",
         "bankMobile"=EXCLUDED."bankMobile"`,
      [bankName, bankAccount, bankHolder, bankMobile]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur sauvegarde paramètres' });
  }
});


// ════════════════════════════════════════════════════════════
//  VIDÉOS
// ════════════════════════════════════════════════════════════

app.get('/api/videos', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, title, url, created_at FROM videos ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur chargement vidéos' });
  }
});

app.post('/api/videos', authenticateAdmin, [
  body('title').trim().notEmpty().isLength({ max: 255 }),
  body('url').notEmpty(),
], validate, async (req, res) => {
  const { id, title, url } = req.body;
  const videoId = id || Date.now();
  try {
    await pool.query('INSERT INTO videos (id, title, url) VALUES ($1,$2,$3)', [videoId, title, url]);
    res.json({ ok: true, id: videoId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur ajout vidéo' });
  }
});

app.delete('/api/videos/:id', authenticateAdmin, [
  param('id').isNumeric(),
], validate, async (req, res) => {
  try {
    await pool.query('DELETE FROM videos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur suppression vidéo' });
  }
});


// ════════════════════════════════════════════════════════════
//  ADMIN — Auth
// ════════════════════════════════════════════════════════════

app.post('/api/admin/login', authLimiter, [
  body('username').trim().notEmpty().isLength({ max: 100 }),
  body('password').notEmpty(),
], validate, async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query(
      'SELECT id, password FROM admins WHERE username=$1', [username]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Identifiants admin incorrects' });
    const stored   = rows[0].password;
    const isBcrypt = stored && stored.startsWith('$2');
    const valid    = isBcrypt
      ? await bcrypt.compare(password, stored)
      : password === stored;
    if (!valid) return res.status(401).json({ error: 'Identifiants admin incorrects' });
    if (!isBcrypt) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query('UPDATE admins SET password=$1 WHERE username=$2', [hash, username]);
    }
    const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ ok: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// ════════════════════════════════════════════════════════════
//  CLIENTS (admin)
// ════════════════════════════════════════════════════════════

app.get('/api/customers', authenticateAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT email, name, phone, address, created_at FROM customers ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur chargement clients' });
  }
});


// ════════════════════════════════════════════════════════════
//  Fallback SPA
// ════════════════════════════════════════════════════════════
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ── Démarrage ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Serveur LUMIÈRE démarré sur le port ${PORT}`);
  if (!cloudinaryEnabled) console.warn('ATTENTION: Cloudinary non configuré — uploads désactivés');
});
