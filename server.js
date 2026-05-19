// ============================================================
//  LUMIÈRE — Serveur Backend (Node.js + Express + PostgreSQL)
//  Stockage fichiers : Cloudinary
//  Production-ready pour Railway / Render
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

app.set('trust proxy', 1);

const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET non défini. Arrêt.');
  process.exit(1);
}

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

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc    : ["'self'"],
      scriptSrc     : ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
      scriptSrcAttr : ["'unsafe-inline'"],
      styleSrc      : ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc       : ["'self'", 'https://fonts.gstatic.com'],
      imgSrc        : ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      mediaSrc      : ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      connectSrc    : ["'self'", 'https://res.cloudinary.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

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

app.use(express.json({ limit: '600mb' }));
app.use(express.urlencoded({ extended: true }));

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

app.use('/api/', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

function buildDbUrl() {
  const u = process.env.DATABASE_URL || '';
  if (u.startsWith('postgres')) return u;
  const h  = process.env.PGHOST;
  const p  = process.env.PGPORT  || '5432';
  const us = process.env.PGUSER;
  const pw = process.env.PGPASSWORD;
  const db = process.env.PGDATABASE;
  if (h && us && pw && db) {
    return `postgresql://${encodeURIComponent(us)}:${encodeURIComponent(pw)}@${h}:${p}/${db}`;
  }
  return '';
}

const dbUrl = buildDbUrl();
if (!dbUrl) {
  console.error('FATAL: Aucune URL PostgreSQL valide.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Erreur pool PostgreSQL :', err.message);
});

app.listen(PORT, () => {
  console.log(`Serveur LUMIÈRE démarré sur le port ${PORT}`);
  if (!cloudinaryEnabled) console.warn('ATTENTION: Cloudinary non configuré — uploads désactivés');
  connectWithRetry();
});

async function connectWithRetry(attempts = 10, delayMs = 3000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const client = await pool.connect();
      console.log('Connecté à PostgreSQL');
      client.release();
      await initDatabase();
      await initAdminPassword();
      return;
    } catch (err) {
      console.error(`Tentative ${i}/${attempts} — PostgreSQL inaccessible : ${err.message || err.code}`);
      if (i === attempts) {
        console.error('FATAL: Impossible de joindre PostgreSQL. Arrêt.');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        email     VARCHAR(255) PRIMARY KEY,
        name      VARCHAR(255) NOT NULL,
        phone     VARCHAR(50),
        address   TEXT,
        password  VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS products (
        id          BIGINT PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        price       INTEGER NOT NULL,
        category    VARCHAR(100),
        quantite    VARCHAR(100),
        description TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS product_images (
        id         SERIAL PRIMARY KEY,
        product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
        image_url  TEXT
      );
      CREATE TABLE IF NOT EXISTS orders (
        id             VARCHAR(50) PRIMARY KEY,
        "userId"       VARCHAR(255) REFERENCES customers(email) ON DELETE SET NULL,
        customer       VARCHAR(255),
        total          INTEGER,
        status         VARCHAR(50) DEFAULT 'pending',
        address        TEXT,
        "trackingCode" VARCHAR(50),
        proof_url      TEXT,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_orders_userid       ON orders("userId");
      CREATE INDEX IF NOT EXISTS idx_orders_trackingcode ON orders("trackingCode");
      CREATE TABLE IF NOT EXISTS order_items (
        id           SERIAL PRIMARY KEY,
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
      VALUES (1, '', '', '', '') ON CONFLICT (id) DO NOTHING;
      CREATE TABLE IF NOT EXISTS promo_codes (
        id             SERIAL PRIMARY KEY,
        code           VARCHAR(50) UNIQUE NOT NULL,
        discount_type  VARCHAR(20) NOT NULL DEFAULT 'percent',
        discount_value INTEGER NOT NULL DEFAULT 0,
        max_uses       INTEGER,
        used_count     INTEGER NOT NULL DEFAULT 0,
        active         BOOLEAN NOT NULL DEFAULT TRUE,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS admins (
        id       SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS videos (
        id         BIGINT PRIMARY KEY,
        title      VARCHAR(255),
        url        TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('Tables initialisées avec succès');
  } catch (err) {
    console.error('Erreur init tables :', err.message);
    throw err;
  }
}

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

// ── Générateur d'identifiants unique côté serveur ─────────────
function genOrderId() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return 'CMD-' + ts.slice(-4) + rand;
}
function genTrackingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LUM-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += '-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code; // ex: LUM-K3MX-A7B2C3
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));


// ════════════════════════════════════════════════════════════
//  UPLOAD CLOUDINARY
// ════════════════════════════════════════════════════════════

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
    res.status(500).json({ error: 'Erreur upload fichier : ' + err.message });
  }
});

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
    await migrateCustomersColumns();
    const { rows } = await pool.query(
      'SELECT email, name, phone, address, photo_url, password AS hash FROM customers WHERE email=$1',
      [email]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Identifiants incorrects' });
    const user     = rows[0];
    const stored   = user.hash;
    const isBcrypt = stored && stored.startsWith('$2');
    const valid    = isBcrypt
      ? await bcrypt.compare(password, stored)
      : password === stored;
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });
    if (!isBcrypt) {
      const h = await bcrypt.hash(password, 12);
      await pool.query('UPDATE customers SET password=$1 WHERE email=$2', [h, email]);
    }
    const token = jwt.sign({ email: user.email, name: user.name, role: 'customer' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ ok: true, token, user: { email: user.email, name: user.name, phone: user.phone, address: user.address, photoUrl: user.photo_url || null } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// ── Migration photo_url ──────────────────────────────────────
async function migrateCustomersColumns() {
  try {
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS photo_url TEXT`);
  } catch (_) {}
}

// ── Modifier le profil (nom) ──────────────────────────────────
app.patch('/api/auth/profile', authenticateUser, [
  body('name').trim().notEmpty().withMessage('Nom requis'),
], validate, async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query('UPDATE customers SET name=$1 WHERE email=$2', [name, req.user.email]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Modifier la photo de profil ───────────────────────────────
app.patch('/api/auth/photo', authenticateUser, [
  body('photoUrl').trim().notEmpty().isURL().withMessage('URL valide requise'),
], validate, async (req, res) => {
  const { photoUrl } = req.body;
  try {
    await migrateCustomersColumns();
    await pool.query('UPDATE customers SET photo_url=$1 WHERE email=$2', [photoUrl, req.user.email]);
    res.json({ ok: true, photoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur mise à jour photo' });
  }
});

// ── Changer le mot de passe ────────────────────────────────────
app.patch('/api/auth/password', authenticateUser, [
  body('currentPassword').notEmpty().withMessage('Mot de passe actuel requis'),
  body('newPassword').isLength({ min: 6 }).withMessage('Nouveau mot de passe : 6 caractères minimum'),
], validate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const { rows } = await pool.query('SELECT password FROM customers WHERE email=$1', [req.user.email]);
    if (!rows.length) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const valid = await bcrypt.compare(currentPassword, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE customers SET password=$1 WHERE email=$2', [hash, req.user.email]);
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
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

// POST /api/orders — IDs générés côté serveur (plus de collision possible)
app.post('/api/orders', authenticateUser, [
  body('customer').trim().notEmpty().isLength({ max: 255 }),
  body('total').isInt({ min: 0 }),
  body('address').trim().notEmpty().isLength({ max: 1000 }),
  body('items').isArray({ min: 1 }),
  body('proofUrl').notEmpty().withMessage('Preuve de paiement requise'),
  body('promoCode').optional().trim().isLength({ max: 50 }),
], validate, async (req, res) => {
  const { customer, items = [], total, address, proofUrl, promoCode } = req.body;
  const userId      = req.user.email;
  const id          = genOrderId();
  const trackingCode = genTrackingCode();
  try {
    await pool.query(
      `INSERT INTO orders (id, "userId", customer, total, status, address, "trackingCode", proof_url)
       VALUES ($1,$2,$3,$4,'pending',$5,$6,$7)`,
      [id, userId, customer, total, address, trackingCode, proofUrl]
    );
    for (const item of items) {
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES ($1,$2,$3,$4,$5)',
        [id, item.id, item.name || item.product_name, item.qty || item.quantity, item.price]
      );
    }
    res.json({ ok: true, id, trackingCode });
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
//  PARAMÈTRES BOUTIQUE
// ════════════════════════════════════════════════════════════

// Migration : ajout des nouvelles colonnes si elles n'existent pas encore
async function migrateSettingsColumns() {
  const cols = [
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS "siteName"     VARCHAR(255) DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS "siteMotto"    VARCHAR(500) DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS "sitePhone"    VARCHAR(100) DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS "siteEmail"    VARCHAR(255) DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS "siteWhatsapp" VARCHAR(100) DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS "siteInstagram"VARCHAR(255) DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS "siteFacebook" VARCHAR(255) DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS "siteAddress"  TEXT         DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS "bankMobile"   VARCHAR(50)  DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS "siteTiktok"  VARCHAR(255) DEFAULT ''`,
  ];
  for (const sql of cols) {
    try { await pool.query(sql); } catch (_) {}
  }
}

app.get('/api/settings', async (_req, res) => {
  try {
    await migrateSettingsColumns();
    const { rows } = await pool.query(`SELECT * FROM settings WHERE id=1`);
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
  body('siteName').optional().trim().isLength({ max: 255 }),
  body('siteMotto').optional().trim().isLength({ max: 500 }),
  body('sitePhone').optional().trim().isLength({ max: 100 }),
  body('siteEmail').optional().trim().isLength({ max: 255 }),
  body('siteWhatsapp').optional().trim().isLength({ max: 100 }),
  body('siteInstagram').optional().trim().isLength({ max: 255 }),
  body('siteFacebook').optional().trim().isLength({ max: 255 }),
  body('siteAddress').optional().trim().isLength({ max: 1000 }),
  body('siteTiktok').optional().trim().isLength({ max: 255 }),
], validate, async (req, res) => {
  const {
    bankName, bankAccount, bankHolder, bankMobile,
    siteName, siteMotto, sitePhone, siteEmail,
    siteWhatsapp, siteInstagram, siteFacebook, siteAddress, siteTiktok,
  } = req.body;
  try {
    await migrateSettingsColumns();
    await pool.query(
      `INSERT INTO settings (id,"bankName","bankAccount","bankHolder","bankMobile",
        "siteName","siteMotto","sitePhone","siteEmail","siteWhatsapp","siteInstagram","siteFacebook","siteAddress","siteTiktok")
       VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         "bankName"=EXCLUDED."bankName","bankAccount"=EXCLUDED."bankAccount",
         "bankHolder"=EXCLUDED."bankHolder","bankMobile"=EXCLUDED."bankMobile",
         "siteName"=EXCLUDED."siteName","siteMotto"=EXCLUDED."siteMotto",
         "sitePhone"=EXCLUDED."sitePhone","siteEmail"=EXCLUDED."siteEmail",
         "siteWhatsapp"=EXCLUDED."siteWhatsapp","siteInstagram"=EXCLUDED."siteInstagram",
         "siteFacebook"=EXCLUDED."siteFacebook","siteAddress"=EXCLUDED."siteAddress",
         "siteTiktok"=EXCLUDED."siteTiktok"`,
      [bankName||'', bankAccount||'', bankHolder||'', bankMobile||'',
       siteName||'', siteMotto||'', sitePhone||'', siteEmail||'',
       siteWhatsapp||'', siteInstagram||'', siteFacebook||'', siteAddress||'', siteTiktok||'']
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur sauvegarde paramètres' });
  }
});

// ════════════════════════════════════════════════════════════
//  CODES PROMO
// ════════════════════════════════════════════════════════════

app.get('/api/promo-codes', authenticateAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM promo_codes ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur chargement codes promo' });
  }
});

app.post('/api/promo-codes', authenticateAdmin, [
  body('code').trim().notEmpty().isLength({ max: 50 }),
  body('discount_type').isIn(['percent', 'fixed']),
  body('discount_value').isInt({ min: 1 }),
  body('max_uses').optional({ nullable: true }).isInt({ min: 1 }),
], validate, async (req, res) => {
  const { code, discount_type, discount_value, max_uses } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO promo_codes (code, discount_type, discount_value, max_uses)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [code.toUpperCase(), discount_type, discount_value, max_uses || null]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ce code existe déjà' });
    console.error(err);
    res.status(500).json({ error: 'Erreur création code promo' });
  }
});

app.patch('/api/promo-codes/:id/toggle', authenticateAdmin, [
  param('id').isInt(),
], validate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE promo_codes SET active = NOT active WHERE id=$1`, [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur mise à jour code' });
  }
});

app.delete('/api/promo-codes/:id', authenticateAdmin, [
  param('id').isInt(),
], validate, async (req, res) => {
  try {
    await pool.query(`DELETE FROM promo_codes WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur suppression code promo' });
  }
});

app.post('/api/promo-codes/apply', [
  body('code').trim().notEmpty().isLength({ max: 50 }),
  body('total').isInt({ min: 1 }),
], validate, async (req, res) => {
  const { code, total } = req.body;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM promo_codes WHERE code=$1 AND active=TRUE`,
      [code.toUpperCase()]
    );
    if (!rows.length) return res.status(404).json({ error: 'Code promo invalide ou désactivé' });
    const promo = rows[0];
    if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
      return res.status(400).json({ error: 'Ce code promo a atteint sa limite d\'utilisation' });
    }
    const discount = promo.discount_type === 'percent'
      ? Math.round(total * promo.discount_value / 100)
      : Math.min(promo.discount_value, total);
    const finalTotal = Math.max(0, total - discount);
    res.json({
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      discount,
      finalTotal,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur validation code promo' });
  }
});

// Incrément usage lors d'une commande confirmée (appelé en interne)
async function incrementPromoUsage(code) {
  if (!code) return;
  try {
    await pool.query(
      `UPDATE promo_codes SET used_count = used_count + 1 WHERE code=$1`, [code]
    );
  } catch (_) {}
}


// ════════════════════════════════════════════════════════════
//  VIDÉOS
// ════════════════════════════════════════════════════════════

// Détection de langue — via Accept-Language du navigateur (fiable, sans API externe)
app.get('/api/geoip', (req, res) => {
  const accept = req.headers['accept-language'] || '';
  const top = accept.split(',')[0].trim().toLowerCase().split(/[-_]/)[0];
  const supported = ['en','ar','es','pt','de'];
  const lang = supported.includes(top) ? top : null;
  res.json({ country_code: null, lang });
});

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
