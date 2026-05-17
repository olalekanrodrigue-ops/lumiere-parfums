// ============================================================
//  LUMIÈRE — Frontend JavaScript
//  Stockage fichiers : Cloudinary via /api/upload
// ============================================================

// ── Icônes SVG inline (remplace tous les emojis) ─────────────
const SVG = {
  user:     `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  trash:    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  perfume:  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v2H9z"/><path d="M10 5v2"/><path d="M14 5v2"/><rect x="7" y="7" width="10" height="14" rx="2"/><path d="M10 11h4"/></svg>`,
  check:    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  clock:    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  truck:    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  package:  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  loader:   `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`,
  circleX:  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  circleOk: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

// ── Style spin ─────────────────────────────────────────────────
const _spinStyle = document.createElement('style');
_spinStyle.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
document.head.appendChild(_spinStyle);

// ── État global ───────────────────────────────────────────────
let state = {
  currentUser    : null,
  isAdmin        : false,
  adminToken     : null,
  userToken      : null,
  adminUsername  : null,
  cart           : [],
  videos         : [],
  proofUrl       : null,
  products       : [],
  orders         : [],
  customers      : [],
  settings       : { bankName:'', bankAccount:'', bankHolder:'', },
  currentEditProductId : null,
  currentUpdateOrderId : null,
};

let newProdFiles  = [];
let editProdFiles = [];

// ── Helpers ───────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function saveState() {
  localStorage.setItem('lumiere_state', JSON.stringify({
    currentUser  : state.currentUser,
    cart         : state.cart,
    isAdmin      : state.isAdmin,
    adminToken   : state.adminToken,
    userToken    : state.userToken,
    adminUsername: state.adminUsername,
  }));
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('lumiere_state') || '{}');
    state.currentUser   = s.currentUser   || null;
    state.cart          = s.cart          || [];
    state.isAdmin       = s.isAdmin       || false;
    state.adminToken    = s.adminToken    || null;
    state.userToken     = s.userToken     || null;
    state.adminUsername = s.adminUsername || null;
  } catch (_) {}
}

// ── Headers ───────────────────────────────────────────────────
function userHeaders()  {
  const h = { 'Content-Type': 'application/json' };
  if (state.userToken)  h['Authorization'] = 'Bearer ' + state.userToken;
  return h;
}
function adminHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (state.adminToken) h['Authorization'] = 'Bearer ' + state.adminToken;
  return h;
}

// ── Init ──────────────────────────────────────────────────────
window.onload = () => {
  loadState();
  applyI18n();
  listenProducts();
  listenOrders();
  listenSettings();
  listenVideos();
  updateCartCount();
  updateNavUser();
  setInterval(() => { listenProducts(); listenOrders(); listenVideos(); }, 8000);
};

// ════════════════════════════════════════════════════════════
//  UPLOAD CLOUDINARY
// ════════════════════════════════════════════════════════════

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function uploadToCloud(dataUri, resourceType = 'auto', token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res  = await fetch('/api/upload', {
    method : 'POST',
    headers,
    body   : JSON.stringify({ data: dataUri, resourceType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur upload');
  return data.url;
}

async function uploadProofToCloud(dataUri) {
  const res  = await fetch('/api/upload/proof', {
    method : 'POST',
    headers: userHeaders(),
    body   : JSON.stringify({ data: dataUri }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur upload preuve');
  return data.url;
}

// ════════════════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════════════════
function showPage(name) {
  if ((name === 'payment' || name === 'tracking' || name === 'profile') && !state.currentUser) {
    showToast('Veuillez vous connecter', 'warning');
    return showPage('auth');
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  if (name === 'boutique') renderProducts();
  if (name === 'cart')     renderCart();
  if (name === 'tracking') { listenOrders(); renderTracking(); }
  if (name === 'payment')  renderPayment();
  if (name === 'profile')  renderProfile();
  window.scrollTo(0, 0);
  updateBottomNav(name);
}

function requireAuth(callback) {
  if (state.currentUser) callback();
  else { showToast('Veuillez vous connecter', 'warning'); showPage('auth'); }
}

// ════════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════════
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3500);
}

// ════════════════════════════════════════════════════════════
//  AUTH CLIENTS
// ════════════════════════════════════════════════════════════
function switchAuthTab(tab) {
  document.getElementById('form-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  if (!email || !pass) { showToast('Remplissez tous les champs', 'error'); return; }
  try {
    const res  = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Erreur connexion', 'error'); return; }
    state.currentUser = data.user;
    state.userToken   = data.token;
    saveState(); updateNavUser();
    showToast('Bienvenue ' + data.user.name + ' !', 'success');
    state.cart.length > 0 ? showPage('payment') : showPage('boutique');
  } catch { showToast('Erreur réseau', 'error'); }
}

async function doRegister() {
  const name    = document.getElementById('reg-name').value.trim();
  const email   = document.getElementById('reg-email').value.trim();
  const phone   = document.getElementById('reg-phone').value.trim();
  const address = document.getElementById('reg-address').value.trim();
  const pass    = document.getElementById('reg-password').value;
  if (!name || !email || !phone || !address || !pass) {
    showToast('Tous les champs sont requis', 'error'); return;
  }
  try {
    const res  = await fetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, address, password: pass })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Erreur inscription', 'error'); return; }
    state.currentUser = data.user;
    state.userToken   = data.token;
    saveState(); updateNavUser();
    showToast('Compte créé ! Bienvenue ' + name, 'success');
    state.cart.length > 0 ? showPage('payment') : showPage('boutique');
  } catch { showToast('Erreur réseau', 'error'); }
}

function updateNavUser() {
  const sec = document.getElementById('nav-user-section');
  if (state.currentUser) {
    sec.innerHTML = `
      <button class="nav-profile-btn" onclick="showPage('profile')" title="${escHtml(state.currentUser.name)}">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </button>`;
  } else {
    sec.innerHTML = `<button class="btn-nav" onclick="showPage('auth')" data-i18n="btn-login">Connexion</button>`;
  }
  // Bouton hero accueil : adapter selon connexion
  const heroBtn = document.getElementById('hero-account-btn');
  if (heroBtn) {
    if (state.currentUser) {
      heroBtn.textContent = 'Voir votre Profil';
      heroBtn.onclick = () => showPage('profile');
    } else {
      heroBtn.textContent = 'Créer un Compte';
      heroBtn.onclick = () => showPage('auth');
    }
  }
  // Mobile menu : afficher/cacher lien Profil
  const profileLink = document.getElementById('mobile-profile-link');
  if (profileLink) profileLink.style.display = state.currentUser ? 'flex' : 'none';
  updateMobileMenuAuth();
  updateCartCount();
  // Bottom nav : label du bouton compte
  const lbl = document.getElementById('bnav-account-label');
  if (lbl) lbl.textContent = state.currentUser ? 'Profil' : 'Compte';
}

// Bouton compte de la bottom nav
function bnav_account() {
  if (state.currentUser) showPage('profile');
  else showPage('auth');
}

function logout() {
  state.currentUser = null; state.userToken = null;
  saveState(); updateNavUser();
  showToast('Déconnecté', 'info'); showPage('home');
}

// ════════════════════════════════════════════════════════════
//  PRODUITS
// ════════════════════════════════════════════════════════════
let activeCategory = 'all';

async function listenProducts() {
  try {
    const data = await fetch('/api/products').then(r => r.json());
    state.products = data;
    renderCategoryFilter();
    renderProducts();
    if (state.isAdmin) renderAdminProducts();
  } catch (_) {}
}

function renderCategoryFilter() {
  const bar = document.getElementById('category-filter');
  if (!bar) return;
  const cats = ['all', ...new Set(state.products.map(p => p.category).filter(Boolean))];
  bar.innerHTML = cats.map(cat => `
    <button class="filter-btn ${activeCategory === cat ? 'active' : ''}"
      onclick="setCategory('${escHtml(cat)}')">
      ${cat === 'all' ? 'Tous' : escHtml(cat)}
    </button>
  `).join('');
}

function setCategory(cat) {
  activeCategory = cat;
  renderCategoryFilter();
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  const filtered = activeCategory === 'all'
    ? state.products
    : state.products.filter(p => p.category === activeCategory);
  if (!filtered.length) {
    grid.innerHTML = `<div style="text-align:center;padding:80px;color:var(--text-dim);font-family:'Cormorant Garamond',serif;font-size:24px">
      ${state.products.length ? 'Aucun produit dans cette catégorie' : 'La collection arrive bientôt…'}
    </div>`;
    return;
  }
  grid.innerHTML = filtered.map(p => `
    <div class="product-card">
      <div class="product-img-wrap">
        ${p.images && p.images.length > 0
          ? `<img src="${escHtml(p.images[0])}" alt="${escHtml(p.name)}">`
          : `<div class="product-img-placeholder">${SVG.perfume}<span>${escHtml(p.category)}</span></div>`}
      </div>
      <div class="product-info">
        <div class="product-tag">${escHtml(p.category)} — ${escHtml(p.quantite)}</div>
        <div class="product-name">${escHtml(p.name)}</div>
        <div class="product-desc">${escHtml(p.desc || p.description || '')}</div>
        <div class="product-price">${p.price.toLocaleString('fr-FR')} $</div>
        <button class="btn-add-cart" onclick="addToCart(${p.id})">Ajouter au Panier</button>
      </div>
    </div>
  `).join('');
}

// ════════════════════════════════════════════════════════════
//  PANIER
// ════════════════════════════════════════════════════════════
function addToCart(productId) {
  const prod = state.products.find(p => p.id == productId);
  if (!prod) return;
  const existing = state.cart.find(i => i.id == productId);
  if (existing) existing.qty++;
  else state.cart.push({ ...prod, qty: 1 });
  saveState(); updateCartCount();
  showToast(escHtml(prod.name) + ' ajouté au panier', 'success');
}

function updateCartCount() {
  const count = state.cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cart-count').textContent = count;
}

function renderCart() {
  const content = document.getElementById('cart-content');
  if (state.cart.length === 0) {
    content.innerHTML = `
      <div class="cart-empty">
        <p>Votre panier est vide</p>
        <button class="btn-primary" onclick="showPage('boutique')">Découvrir la Collection</button>
      </div>`; return;
  }
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  content.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">
        ${item.images && item.images.length > 0
          ? `<img src="${escHtml(item.images[0])}" alt="${escHtml(item.name)}">`
          : SVG.perfume}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(item.name)}</div>
        <div class="cart-item-price">${item.price.toLocaleString('fr-FR')} $</div>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
        <span>${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
      </div>
      <span style="color:var(--gold);font-family:'Cormorant Garamond',serif;font-size:20px;min-width:120px;text-align:right">
        ${(item.price * item.qty).toLocaleString('fr-FR')} $
      </span>
      <button class="remove-btn" onclick="removeFromCart(${item.id})">${SVG.trash}</button>
    </div>
  `).join('') + `
    <div class="cart-total">
      <span class="cart-total-label">Total</span>
      <span class="cart-total-amount">${total.toLocaleString('fr-FR')} $</span>
    </div>
    <div style="margin-top:20px;text-align:center">
      <button class="btn-primary" style="width:100%" onclick="goToPayment()">Passer au paiement</button>
    </div>`;
}

function changeQty(id, delta) {
  const item = state.cart.find(i => i.id == id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) state.cart = state.cart.filter(i => i.id != id);
  updateCartCount(); renderCart(); saveState();
}

function removeFromCart(id) {
  state.cart = state.cart.filter(i => i.id != id);
  updateCartCount(); renderCart(); saveState();
}

function goToPayment() {
  if (state.cart.length === 0) { showToast('Panier vide', 'error'); return; }
  if (!state.currentUser) { showToast('Connexion requise', 'warning'); showPage('auth'); return; }
  showPage('payment');
}

// ════════════════════════════════════════════════════════════
//  PAIEMENT
// ════════════════════════════════════════════════════════════
async function renderPayment() {
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);

  // Re-fetch les paramètres en direct pour éviter le problème de race condition
  try {
    const fresh = await fetch('/api/settings').then(r => r.json());
    state.settings = fresh;
  } catch (_) {}

  const s = state.settings || {};

  document.getElementById('payment-summary').innerHTML = `
    <h3 style="font-family:'Cormorant Garamond',serif;font-size:20px;color:var(--cream);margin-bottom:16px">Récapitulatif</h3>
    ${state.cart.map(i => `
      <div class="summary-line">
        <span>${escHtml(i.name)} × ${i.qty}</span>
        <span>${(i.price * i.qty).toLocaleString('fr-FR')} $</span>
      </div>`).join('')}
    <div class="summary-total">
      <span>Total à Virer</span>
      <span>${total.toLocaleString('fr-FR')} $</span>
    </div>`;

  if (state.currentUser) {
    document.getElementById('delivery-address').value = state.currentUser.address || '';
  }

  const hasBank = s.bankName || s.bankAccount || s.bankHolder || s.bankMobile;
  const bankBox = document.getElementById('payment-bank-box');
  if (hasBank) {
    bankBox.innerHTML = `
      <h3>Coordonnées Bancaires</h3>
      ${s.bankName    ? `<div class="bank-detail"><span class="bank-label">Banque</span><span class="bank-value">${escHtml(s.bankName)}</span></div>` : ''}
      ${s.bankAccount ? `<div class="bank-detail"><span class="bank-label">Numéro de Compte</span><span class="bank-value">${escHtml(s.bankAccount)}</span></div>` : ''}
      ${s.bankHolder  ? `<div class="bank-detail"><span class="bank-label">Titulaire</span><span class="bank-value">${escHtml(s.bankHolder)}</span></div>` : ''}
      ${s.bankMobile  ? `<div class="bank-detail"><span class="bank-label">Mobile Money</span><span class="bank-value">${escHtml(s.bankMobile)}</span></div>` : ''}`;
  } else {
    bankBox.innerHTML = `
      <h3>Coordonnées Bancaires</h3>
      <div class="bank-unconfigured">
        Les coordonnées bancaires ne sont pas encore configurées.<br>
        Veuillez contacter le vendeur directement pour effectuer votre paiement.
      </div>`;
  }

  // Réinitialise la zone de preuve
  state.proofUrl = null;
  const nameEl = document.getElementById('proof-name');
  if (nameEl) { nameEl.style.display = 'none'; nameEl.textContent = ''; }
  const zone = document.getElementById('proof-zone');
  if (zone) zone.style.borderColor = 'rgba(201,169,110,0.3)';
  const input = document.getElementById('proof-input');
  if (input) input.value = '';
}

// Preuve de paiement : upload immédiat vers Cloudinary
async function handleProofUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const nameEl = document.getElementById('proof-name');
  const zone   = document.getElementById('proof-zone');
  nameEl.innerHTML  = SVG.loader + ' &nbsp;Envoi en cours…';
  nameEl.style.display = 'block';
  nameEl.style.color   = 'var(--gold)';
  zone.style.borderColor = 'var(--gold)';
  try {
    const dataUri      = await readFileAsDataUrl(file);
    const url          = await uploadProofToCloud(dataUri);
    state.proofUrl     = url;
    nameEl.innerHTML   = SVG.circleOk + ' &nbsp;Preuve envoyée avec succès';
    nameEl.style.color = 'var(--green)';
    zone.style.borderColor = 'var(--green)';
  } catch (err) {
    state.proofUrl     = null;
    nameEl.innerHTML   = SVG.circleX + ' &nbsp;Erreur : ' + escHtml(err.message);
    nameEl.style.color = 'var(--red)';
    zone.style.borderColor = 'var(--red)';
  }
}

async function submitOrder() {
  if (!state.proofUrl) { showToast('Ajoutez une preuve de paiement', 'error'); return; }
  const address = document.getElementById('delivery-address').value.trim();
  if (!address) { showToast('Adresse de livraison requise', 'error'); return; }
  if (state.cart.length === 0) { showToast('Panier vide', 'error'); return; }

  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const order = {
    customer : state.currentUser.name,
    items    : state.cart,
    total,
    proofUrl : state.proofUrl,
    address,
  };

  const btn = document.querySelector('#page-payment .btn-primary.btn-full');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi en cours…'; }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST', headers: userHeaders(), body: JSON.stringify(order)
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) { showToast('Session expirée, reconnectez-vous', 'error'); logout(); return; }
      showToast(data.error || 'Erreur commande', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Soumettre la Commande'; }
      return;
    }
    // Succès : vider le panier et afficher l'écran de confirmation
    state.cart     = [];
    state.proofUrl = null;
    updateCartCount(); saveState();
    showOrderConfirmation(data.trackingCode);
    listenOrders();
  } catch {
    showToast('Erreur réseau', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Soumettre la Commande'; }
  }
}

// ── Écran de confirmation post-commande ───────────────────────
function showOrderConfirmation(trackingCode) {
  document.getElementById('confirm-code').textContent = trackingCode || '—';
  showPage('confirm');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ════════════════════════════════════════════════════════════
//  SUIVI
// ════════════════════════════════════════════════════════════
async function listenOrders() {
  if (!state.currentUser && !state.isAdmin) return;
  try {
    const url     = state.isAdmin ? '/api/orders' : '/api/orders/me';
    const headers = state.isAdmin ? adminHeaders() : userHeaders();
    const res     = await fetch(url, { headers });
    if (!res.ok) return;
    state.orders  = await res.json();
    renderTracking();
    if (state.isAdmin) { renderAdminOrders(); renderAdminDashboard(); }
  } catch (_) {}
}

function renderTracking() {
  if (!state.currentUser) return;
  // Réinitialise le champ de recherche à chaque ouverture
  const inp = document.getElementById('tracking-input');
  if (inp) { inp.value = ''; }
  // Vide les résultats — chaque commande reste confidentielle,
  // visible uniquement après saisie du code de suivi personnel.
  const resultBox = document.getElementById('tracking-result');
  if (resultBox) resultBox.innerHTML = '';
  const box = document.getElementById('tracking-content');
  if (box) box.innerHTML = '';
}

function statusInfo(status) {
  const map = {
    pending  : { icon: SVG.clock,   label: 'Paiement en attente' },
    confirmed: { icon: SVG.circleOk,label: 'Confirmé' },
    shipping : { icon: SVG.truck,   label: 'En livraison' },
    delivered: { icon: SVG.package, label: 'Livré' },
  };
  return map[status] || { icon: '', label: status };
}

async function searchTracking() {
  const code      = document.getElementById('tracking-input').value.trim().toUpperCase();
  const resultBox = document.getElementById('tracking-result');
  if (!code) { showToast('Entrez un code de suivi', 'error'); return; }
  resultBox.innerHTML = `<p style="text-align:center;color:var(--text-dim)">${SVG.loader} &nbsp;Recherche…</p>`;
  try {
    const res   = await fetch('/api/orders/track?code=' + encodeURIComponent(code));
    const order = await res.json();
    if (!res.ok) {
      resultBox.innerHTML = `<div style="text-align:center;padding:20px;color:var(--red)">Commande introuvable — vérifiez le code</div>`;
      return;
    }
    const { icon, label } = statusInfo(order.status);
    const items = (order.items || []).map(i => escHtml(i.product_name) + ' ×' + i.quantity).join(', ');
    resultBox.innerHTML = `
      <div style="text-align:center;padding:28px;background:var(--dark-2);border:1px solid rgba(201,169,110,0.15)">
        <div style="font-family:'Cormorant Garamond',serif;font-size:28px;color:var(--gold);letter-spacing:3px;margin-bottom:12px">
          ${escHtml(order.trackingCode || order.trackingcode || code)}
        </div>
        <div style="margin-bottom:10px;font-size:13px;color:var(--text-dim)">${items}</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:20px;color:var(--gold);margin-bottom:14px">${order.total.toLocaleString('fr-FR')} $</div>
        <span class="t-status ${order.status}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 16px;font-size:11px;letter-spacing:2px;text-transform:uppercase">
          ${icon} ${label}
        </span>
      </div>`;
  } catch { showToast('Erreur réseau', 'error'); resultBox.innerHTML = ''; }
}

// ════════════════════════════════════════════════════════════
//  PARAMÈTRES
// ════════════════════════════════════════════════════════════
async function listenSettings() {
  try {
    state.settings = await fetch('/api/settings').then(r => r.json());
  } catch (_) {}
}

function loadSettings() {
  const s = state.settings || {};
  document.getElementById('s-bank-name').value    = s.bankName    || '';
  document.getElementById('s-bank-account').value = s.bankAccount || '';
  document.getElementById('s-bank-holder').value  = s.bankHolder  || '';
  document.getElementById('s-bank-mobile').value  = s.bankMobile  || '';
}

async function saveSettings() {
  const settings = {
    bankName   : document.getElementById('s-bank-name').value.trim(),
    bankAccount: document.getElementById('s-bank-account').value.trim(),
    bankHolder : document.getElementById('s-bank-holder').value.trim(),
    bankMobile : document.getElementById('s-bank-mobile').value.trim(),
  };
  try {
    const res = await fetch('/api/settings', {
      method: 'POST', headers: adminHeaders(), body: JSON.stringify(settings)
    });
    if (!res.ok) { showToast('Erreur sauvegarde', 'error'); return; }
    state.settings = settings;
    showToast('Paramètres sauvegardés', 'success');
  } catch { showToast('Erreur sauvegarde', 'error'); }
}

// ════════════════════════════════════════════════════════════
//  ADMIN — Login
// ════════════════════════════════════════════════════════════
async function doAdminLogin() {
  const u = document.getElementById('admin-user').value;
  const p = document.getElementById('admin-pass').value;
  try {
    const res  = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Identifiants incorrects', 'error'); return; }
    state.isAdmin = true; state.adminToken = data.token; state.adminUsername = u;
    saveState();
    listenOrders(); listenProducts(); fetchCustomers();
    showPage('admin'); renderAdminDashboard();
    showToast('Bienvenue Administrateur', 'success');
  } catch { showToast('Erreur réseau', 'error'); }
}

function adminLogout() {
  state.isAdmin = false; state.adminToken = null; state.adminUsername = null; state.orders = [];
  saveState(); showPage('home'); showToast('Déconnecté', 'info');
}

function adminSection(name) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.getElementById('admin-' + name).classList.add('active');
  document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
  const nav = document.querySelector(`.admin-nav-item[onclick="adminSection('${name}')"]`);
  if (nav) nav.classList.add('active');
  if (name === 'settings') loadSettings();
  if (name === 'videos') renderAdminVideos();
  adminNavMobileCollapse();
}

// ── Dashboard ─────────────────────────────────────────────────
function renderAdminDashboard() {
  const pending   = state.orders.filter(o => o.status === 'pending').length;
  const confirmed = state.orders.filter(o => o.status === 'confirmed').length;
  const revenue   = state.orders
    .filter(o => ['confirmed','shipping','delivered'].includes(o.status))
    .reduce((s, o) => s + o.total, 0);
  document.getElementById('admin-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Commandes Totales</div><div class="stat-value">${state.orders.length}</div></div>
    <div class="stat-card"><div class="stat-label">En Attente</div><div class="stat-value" style="color:var(--orange)">${pending}</div></div>
    <div class="stat-card"><div class="stat-label">Confirmées</div><div class="stat-value" style="color:var(--green)">${confirmed}</div></div>
    <div class="stat-card"><div class="stat-label">Produits</div><div class="stat-value">${state.products.length}</div></div>
    <div class="stat-card"><div class="stat-label">Clients</div><div class="stat-value">${state.customers.length}</div></div>
    <div class="stat-card"><div class="stat-label">Chiffre d'Affaires</div><div class="stat-value" style="font-size:28px">${revenue >= 1000 ? (revenue/1000).toFixed(1) + 'K' : revenue.toLocaleString('fr-FR')}</div><div class="stat-sub">$ confirmé</div></div>`;
}

// ── Commandes admin ───────────────────────────────────────────
function renderAdminOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.orders.map(o => {
    const tid    = escHtml(o.id);
    const { icon, label } = statusInfo(o.status || 'pending');
    return `
    <tr>
      <td style="color:var(--gold);font-family:'Cormorant Garamond',serif">${tid}</td>
      <td>
        <div>${escHtml(o.customer)}</div>
        <div style="font-size:11px;color:var(--text-dim)">${escHtml(o.userId || o.userid || '')}</div>
      </td>
      <td style="font-size:12px">${(o.items||[]).map(i => escHtml(i.product_name) + ' ×' + i.quantity).join('<br>')}</td>
      <td style="color:var(--gold);font-family:'Cormorant Garamond',serif">${o.total.toLocaleString('fr-FR')} $</td>
      <td>${o.proof_url
          ? `<img class="proof-thumb" src="${escHtml(o.proof_url)}" onclick="viewProof('${tid}')" title="Voir la preuve">`
          : '<span style="color:var(--text-dim);font-size:11px">Aucune</span>'}</td>
      <td><span class="status-badge badge-${o.status || 'pending'}" style="display:inline-flex;align-items:center;gap:4px">${icon} ${label}</span></td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${o.status === 'pending' && o.proof_url ? `<button class="action-btn btn-validate" onclick="validateOrder('${tid}')">Valider</button>` : ''}
        <button class="action-btn btn-update" onclick="openStatusModal('${tid}')">Statut</button>
        <button class="action-btn btn-danger"  onclick="deleteOrder('${tid}')">Supprimer</button>
      </td>
    </tr>`;
  }).join('');
}

function viewProof(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order || !order.proof_url) return;
  document.getElementById('modal-proof-img').src = order.proof_url;
  document.getElementById('modal-proof').classList.add('open');
}

async function validateOrder(orderId) {
  try {
    const res = await fetch('/api/orders/' + encodeURIComponent(orderId), {
      method: 'PUT', headers: adminHeaders(), body: JSON.stringify({ status: 'confirmed' })
    });
    if (!res.ok) { showToast('Erreur validation', 'error'); return; }
    showToast('Commande ' + orderId + ' validée', 'success'); listenOrders();
  } catch { showToast('Erreur validation', 'error'); }
}

function openStatusModal(orderId) {
  state.currentUpdateOrderId = orderId;
  const order = state.orders.find(o => o.id === orderId);
  if (order) document.getElementById('modal-status-select').value = order.status;
  document.getElementById('modal-status').classList.add('open');
}

async function confirmStatusUpdate() {
  const orderId   = state.currentUpdateOrderId;
  const newStatus = document.getElementById('modal-status-select').value;
  try {
    const res = await fetch('/api/orders/' + encodeURIComponent(orderId), {
      method: 'PUT', headers: adminHeaders(), body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) { showToast('Erreur statut', 'error'); return; }
    closeModal('modal-status'); showToast('Statut mis à jour', 'success'); listenOrders();
  } catch { showToast('Erreur statut', 'error'); }
}

async function deleteOrder(orderId) {
  if (!confirm('Supprimer cette commande ?')) return;
  try {
    const res = await fetch('/api/orders/' + encodeURIComponent(orderId), {
      method: 'DELETE', headers: adminHeaders()
    });
    if (!res.ok) { showToast('Erreur suppression', 'error'); return; }
    showToast('Commande supprimée', 'info'); listenOrders();
  } catch { showToast('Erreur suppression', 'error'); }
}

// ── Produits admin ────────────────────────────────────────────
function renderAdminProducts() {
  const grid = document.getElementById('admin-products-grid');
  if (!grid) return;
  grid.innerHTML = state.products.map(p => `
    <div class="product-admin-card">
      <div class="product-admin-img">
        ${p.images && p.images.length > 0 ? `<img src="${escHtml(p.images[0])}" alt="${escHtml(p.name)}">` : SVG.perfume}
      </div>
      <div class="product-admin-info">
        <h4>${escHtml(p.name)}</h4>
        <div class="price">${p.price.toLocaleString('fr-FR')} $</div>
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:14px">
          ${escHtml(p.category)} — ${escHtml(p.quantite)} — ${(p.images||[]).length} photo(s)
        </div>
        <div class="admin-btn-row">
          <button class="action-btn btn-update" onclick="openEditProduct(${p.id})">Modifier</button>
          <button class="action-btn btn-danger"  onclick="deleteProduct(${p.id})">Supprimer</button>
        </div>
      </div>
    </div>
  `).join('');
}

function handleProductImages(e) {
  newProdFiles = Array.from(e.target.files);
  const grid = document.getElementById('img-preview-grid');
  grid.innerHTML = '';
  newProdFiles.forEach((file, idx) => {
    const reader  = new FileReader();
    reader.onload = ev => {
      const item = document.createElement('div'); item.className = 'img-preview-item';
      const img  = document.createElement('img'); img.src = ev.target.result;
      const btn  = document.createElement('button'); btn.className = 'remove-img'; btn.textContent = '✕';
      btn.onclick = () => { newProdFiles.splice(idx, 1); handleProductImages({ target: { files: newProdFiles } }); };
      item.appendChild(img); item.appendChild(btn); grid.appendChild(item);
    };
    reader.readAsDataURL(file);
  });
}

async function saveProduct() {
  const name     = document.getElementById('prod-name').value.trim();
  const price    = parseInt(document.getElementById('prod-price').value);
  const category = document.getElementById('prod-category').value;
  const quantite = document.getElementById('prod-quantite').value.trim();
  const desc     = document.getElementById('prod-desc').value.trim();
  if (!name || !price || !desc) { showToast('Remplissez tous les champs', 'error'); return; }

  showToast('Envoi des photos en cours…', 'info');
  let images = [];
  try {
    for (const file of newProdFiles) {
      const dataUri = await readFileAsDataUrl(file);
      const url     = await uploadToCloud(dataUri, 'image', state.adminToken);
      images.push(url);
    }
  } catch (err) {
    showToast('Erreur upload image : ' + err.message, 'error'); return;
  }

  try {
    const res = await fetch('/api/products', {
      method: 'POST', headers: adminHeaders(),
      body: JSON.stringify({ id: Date.now(), name, price, category, quantite, desc, images })
    });
    if (!res.ok) { showToast('Erreur création produit', 'error'); return; }
    newProdFiles = [];
    document.getElementById('img-preview-grid').innerHTML = '';
    document.getElementById('prod-name').value    = '';
    document.getElementById('prod-price').value   = '';
    document.getElementById('prod-quantite').value = '';
    document.getElementById('prod-desc').value    = '';
    showToast('Produit ajouté avec succès', 'success'); listenProducts();
  } catch { showToast('Erreur création produit', 'error'); }
}

function openEditProduct(id) {
  const p = state.products.find(pr => pr.id == id);
  if (!p) return;
  state.currentEditProductId = id;
  editProdFiles = [];
  document.getElementById('edit-prod-id').value    = id;
  document.getElementById('edit-prod-name').value  = p.name;
  document.getElementById('edit-prod-price').value = p.price;
  document.getElementById('edit-prod-desc').value  = p.desc || p.description;
  const grid = document.getElementById('edit-preview-grid');
  grid.innerHTML = '';
  (p.images || []).forEach((url, i) => {
    const item = document.createElement('div'); item.className = 'img-preview-item';
    const img  = document.createElement('img'); img.src = url;
    const btn  = document.createElement('button'); btn.className = 'remove-img'; btn.textContent = '✕';
    btn.onclick = () => {
      const prod = state.products.find(pr => pr.id == id);
      if (prod) { prod.images.splice(i, 1); openEditProduct(id); }
    };
    item.appendChild(img); item.appendChild(btn); grid.appendChild(item);
  });
  document.getElementById('modal-edit-product').classList.add('open');
}

function handleEditImages(e) {
  editProdFiles = Array.from(e.target.files);
  const grid = document.getElementById('edit-preview-grid');
  editProdFiles.forEach(file => {
    const reader  = new FileReader();
    reader.onload = ev => {
      const item = document.createElement('div'); item.className = 'img-preview-item img-preview-pending';
      const img  = document.createElement('img'); img.src = ev.target.result;
      const lbl  = document.createElement('span');
      lbl.textContent = 'Nouveau';
      lbl.style.cssText = 'position:absolute;top:4px;left:4px;background:var(--gold);color:var(--dark);font-size:9px;padding:2px 5px;letter-spacing:1px';
      item.appendChild(img); item.appendChild(lbl); grid.appendChild(item);
    };
    reader.readAsDataURL(file);
  });
}

async function saveEditProduct() {
  const id = state.currentEditProductId;
  const p  = state.products.find(pr => pr.id == id);
  let existingImages = p ? [...(p.images || [])] : [];

  if (editProdFiles.length > 0) {
    showToast('Envoi des nouvelles photos…', 'info');
    try {
      for (const file of editProdFiles) {
        const dataUri = await readFileAsDataUrl(file);
        const url     = await uploadToCloud(dataUri, 'image', state.adminToken);
        existingImages.push(url);
      }
    } catch (err) {
      showToast('Erreur upload : ' + err.message, 'error'); return;
    }
  }

  const updated = {
    name    : document.getElementById('edit-prod-name').value,
    price   : parseInt(document.getElementById('edit-prod-price').value),
    desc    : document.getElementById('edit-prod-desc').value,
    images  : existingImages,
    category: p?.category || '',
    quantite: p?.quantite  || '',
  };
  try {
    const res = await fetch('/api/products/' + id, {
      method: 'PUT', headers: adminHeaders(), body: JSON.stringify(updated)
    });
    if (!res.ok) { showToast('Erreur modification', 'error'); return; }
    editProdFiles = [];
    closeModal('modal-edit-product');
    showToast('Produit mis à jour', 'success'); listenProducts();
  } catch { showToast('Erreur modification', 'error'); }
}

async function deleteProduct(id) {
  if (!confirm('Supprimer ce produit ?')) return;
  try {
    const res = await fetch('/api/products/' + id, { method: 'DELETE', headers: adminHeaders() });
    if (!res.ok) { showToast('Erreur suppression', 'error'); return; }
    showToast('Produit supprimé', 'info'); listenProducts();
  } catch { showToast('Erreur suppression', 'error'); }
}

// ── Clients ───────────────────────────────────────────────────
async function fetchCustomers() {
  try {
    const res = await fetch('/api/customers', { headers: adminHeaders() });
    if (!res.ok) return;
    state.customers = await res.json();
    renderCustomers(); renderAdminDashboard();
  } catch (_) {}
}

function renderCustomers() {
  const tbody = document.getElementById('customers-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.customers.map(c => `
    <tr>
      <td style="color:var(--cream)">${escHtml(c.name)}</td>
      <td>${escHtml(c.email)}</td>
      <td>${escHtml(c.phone || '—')}</td>
      <td>${escHtml(c.address || '—')}</td>
      <td style="color:var(--text-dim)">${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
    </tr>
  `).join('');
}

// ════════════════════════════════════════════════════════════
//  VIDÉOS
// ════════════════════════════════════════════════════════════
async function listenVideos() {
  try {
    state.videos = await fetch('/api/videos').then(r => r.json());
    renderVideos();
    if (state.isAdmin) renderAdminVideos();
  } catch (_) {}
}

function renderVideos() {
  const grid = document.getElementById('videos-grid');
  if (!grid) return;
  if (state.videos.length === 0) {
    grid.innerHTML = "<p style='text-align:center;color:var(--text-dim);padding:60px 0'>Aucune vidéo disponible pour le moment</p>";
    return;
  }
  grid.innerHTML = state.videos.map(v => `
    <div style="background:var(--dark-2);border:1px solid rgba(201,169,110,0.1);padding:24px">
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:22px;color:var(--cream);margin-bottom:16px">${escHtml(v.title)}</h3>
      <video src="${escHtml(v.url)}" controls style="width:100%;max-height:480px;background:#000"></video>
    </div>
  `).join('');
}

function renderAdminVideos() {
  const box = document.getElementById('admin-videos-list');
  if (!box) return;
  if (state.videos.length === 0) { box.innerHTML = '<p style="color:var(--text-dim);font-size:13px">Aucune vidéo publiée</p>'; return; }
  box.innerHTML = state.videos.map(v => `
    <div style="margin-bottom:16px;padding:16px;background:var(--dark-2);border:1px solid rgba(201,169,110,0.1);display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <div style="color:var(--cream);font-family:'Cormorant Garamond',serif;font-size:18px;margin-bottom:8px">${escHtml(v.title)}</div>
        <video src="${escHtml(v.url)}" controls style="width:100%;max-width:300px;border-radius:4px;background:#000"></video>
      </div>
      <button class="action-btn btn-danger" style="flex-shrink:0" onclick="deleteVideo(${v.id})">Supprimer</button>
    </div>
  `).join('');
}

// Upload vidéo → Cloudinary → DB
async function uploadVideo() {
  const title     = document.getElementById('video-title').value.trim();
  const fileInput = document.getElementById('video-file');
  const file      = fileInput && fileInput.files[0];
  const statusDiv = document.getElementById('video-upload-status');

  if (!title) { showToast('Titre requis', 'error'); return; }
  if (!file)  { showToast('Fichier vidéo requis', 'error'); return; }

  // Vérification taille fichier
  const maxMB = 400;
  if (file.size > maxMB * 1024 * 1024) {
    showToast('Fichier trop lourd (max ' + maxMB + ' Mo)', 'error'); return;
  }

  statusDiv.style.display = 'flex';
  showToast('Envoi de la vidéo en cours… (peut prendre une minute)', 'info');

  try {
    const dataUri = await readFileAsDataUrl(file);
    const url     = await uploadToCloud(dataUri, 'video', state.adminToken);

    const res = await fetch('/api/videos', {
      method: 'POST', headers: adminHeaders(),
      body: JSON.stringify({ title, url })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Erreur enregistrement vidéo', 'error'); statusDiv.style.display = 'none'; return; }
    document.getElementById('video-title').value = '';
    fileInput.value = '';
    statusDiv.style.display = 'none';
    showToast('Vidéo publiée avec succès', 'success'); listenVideos();
  } catch (err) {
    statusDiv.style.display = 'none';
    showToast('Erreur upload : ' + err.message, 'error');
  }
}

async function deleteVideo(id) {
  if (!confirm('Supprimer cette vidéo ?')) return;
  try {
    const res = await fetch('/api/videos/' + id, { method: 'DELETE', headers: adminHeaders() });
    if (!res.ok) { showToast('Erreur suppression', 'error'); return; }
    showToast('Vidéo supprimée', 'info'); listenVideos();
  } catch { showToast('Erreur suppression', 'error'); }
}

// ════════════════════════════════════════════════════════════
//  MODALS
// ════════════════════════════════════════════════════════════
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(m =>
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); })
  );
});

// ════════════════════════════════════════════════════════════
//  PAGE PROFIL
// ════════════════════════════════════════════════════════════
function renderProfile() {
  if (!state.currentUser) return;
  const u = state.currentUser;
  const initials = u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const el = id => document.getElementById(id);
  if (el('profile-avatar'))       el('profile-avatar').textContent = initials;
  if (el('profile-name-display')) el('profile-name-display').textContent = u.name;
  if (el('profile-email-display'))el('profile-email-display').textContent = u.email;
  if (el('profile-name-input'))   el('profile-name-input').value = u.name;
  // Résumé commandes
  const box = el('profile-orders-summary');
  if (box) {
    const total = state.orders.length;
    const pending = state.orders.filter(o => o.status === 'pending').length;
    const delivered = state.orders.filter(o => o.status === 'delivered').length;
    box.innerHTML = total === 0
      ? '<span>Aucune commande pour le moment</span>'
      : `<span style="color:var(--gold);font-family:\'Cormorant Garamond\',serif;font-size:28px">${total}</span>
         <span style="display:block;font-size:11px;letter-spacing:2px;margin-top:4px">commande${total>1?'s':''} • ${pending} en attente • ${delivered} livré${delivered>1?'s':''}</span>`;
  }
  // Clear password fields
  ['profile-pwd-current','profile-pwd-new','profile-pwd-confirm'].forEach(id => {
    const f = el(id); if (f) f.value = '';
  });
}

async function saveProfileName() {
  const input = document.getElementById('profile-name-input');
  const name  = input ? input.value.trim() : '';
  if (!name) { showToast('Le nom ne peut pas être vide', 'error'); return; }
  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH', headers: userHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erreur'); }
    state.currentUser.name = name;
    saveState(); updateNavUser(); renderProfile();
    showToast('Nom mis à jour', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

async function saveProfilePassword() {
  const current  = document.getElementById('profile-pwd-current')?.value || '';
  const newPwd   = document.getElementById('profile-pwd-new')?.value || '';
  const confirm  = document.getElementById('profile-pwd-confirm')?.value || '';
  if (!current || !newPwd) { showToast('Remplissez tous les champs', 'error'); return; }
  if (newPwd.length < 6)   { showToast('Mot de passe trop court (6 min)', 'error'); return; }
  if (newPwd !== confirm)  { showToast('Les mots de passe ne correspondent pas', 'error'); return; }
  try {
    const res = await fetch('/api/auth/password', {
      method: 'PATCH', headers: userHeaders(),
      body: JSON.stringify({ currentPassword: current, newPassword: newPwd }),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erreur'); }
    ['profile-pwd-current','profile-pwd-new','profile-pwd-confirm'].forEach(id => {
      const f = document.getElementById(id); if (f) f.value = '';
    });
    showToast('Mot de passe mis à jour', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

// ════════════════════════════════════════════════════════════
//  I18N — TRADUCTION AUTOMATIQUE PAR LANGUE DU NAVIGATEUR
// ════════════════════════════════════════════════════════════
const I18N = {
  en: {
    'nav-home':'Home','nav-boutique':'Shop','nav-videos':'Videos','nav-cart':'Cart',
    'nav-tracking':'My Orders','nav-profile':'My Profile','btn-login':'Sign In','btn-logout':'Sign Out',
    'profile-edit-title':'Edit Name','profile-name-label':'Full Name','profile-save-btn':'Save',
    'profile-pwd-title':'Change Password','profile-pwd-current':'Current Password',
    'profile-pwd-new':'New Password','profile-pwd-confirm':'Confirm Password',
    'profile-pwd-btn':'Update Password','profile-orders-title':'My Orders',
    'profile-see-orders':'View All Orders',
  },
  ar: {
    'nav-home':'الرئيسية','nav-boutique':'المتجر','nav-videos':'مقاطع','nav-cart':'السلة',
    'nav-tracking':'طلباتي','nav-profile':'ملفي','btn-login':'تسجيل الدخول','btn-logout':'خروج',
    'profile-edit-title':'تعديل الاسم','profile-name-label':'الاسم الكامل','profile-save-btn':'حفظ',
    'profile-pwd-title':'تغيير كلمة المرور','profile-pwd-current':'كلمة المرور الحالية',
    'profile-pwd-new':'كلمة المرور الجديدة','profile-pwd-confirm':'تأكيد كلمة المرور',
    'profile-pwd-btn':'تحديث','profile-orders-title':'طلباتي','profile-see-orders':'عرض الكل',
  },
  es: {
    'nav-home':'Inicio','nav-boutique':'Tienda','nav-videos':'Videos','nav-cart':'Carrito',
    'nav-tracking':'Mis Pedidos','nav-profile':'Mi Perfil','btn-login':'Iniciar sesión','btn-logout':'Cerrar sesión',
    'profile-edit-title':'Editar nombre','profile-name-label':'Nombre completo','profile-save-btn':'Guardar',
    'profile-pwd-title':'Cambiar contraseña','profile-pwd-current':'Contraseña actual',
    'profile-pwd-new':'Nueva contraseña','profile-pwd-confirm':'Confirmar contraseña',
    'profile-pwd-btn':'Actualizar','profile-orders-title':'Mis pedidos','profile-see-orders':'Ver todos',
  },
  pt: {
    'nav-home':'Início','nav-boutique':'Loja','nav-videos':'Vídeos','nav-cart':'Carrinho',
    'nav-tracking':'Meus Pedidos','nav-profile':'Meu Perfil','btn-login':'Entrar','btn-logout':'Sair',
    'profile-edit-title':'Editar nome','profile-name-label':'Nome completo','profile-save-btn':'Salvar',
    'profile-pwd-title':'Alterar senha','profile-pwd-current':'Senha atual',
    'profile-pwd-new':'Nova senha','profile-pwd-confirm':'Confirmar senha',
    'profile-pwd-btn':'Atualizar','profile-orders-title':'Meus pedidos','profile-see-orders':'Ver todos',
  },
};

function applyI18n() {
  const lang = (navigator.language || 'fr').slice(0, 2).toLowerCase();
  const t = I18N[lang];
  if (!t) return; // French is default — no translation needed
  if (lang === 'ar') {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
  }
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key]) el.textContent = t[key];
  });
}

// ════════════════════════════════════════════════════════════
//  BOTTOM NAV MOBILE
// ════════════════════════════════════════════════════════════
function updateBottomNav(activePage) {
  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === activePage);
  });
  // Compte : actif sur auth / profile / tracking
  const accountItem = document.querySelector('.bottom-nav-item[data-page="auth"]');
  if (accountItem) {
    accountItem.classList.toggle('active',
      activePage === 'auth' || activePage === 'profile' || activePage === 'tracking'
    );
  }
}

// ════════════════════════════════════════════════════════════
//  MENU MOBILE — Hamburger drawer
// ════════════════════════════════════════════════════════════
function toggleMobileMenu() {
  const btn     = document.getElementById('hamburger-btn');
  const menu    = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-menu-overlay');
  const isOpen  = menu.classList.contains('open');
  if (isOpen) {
    closeMobileMenu();
  } else {
    btn.classList.add('open');
    menu.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeMobileMenu() {
  document.getElementById('hamburger-btn').classList.remove('open');
  document.getElementById('mobile-menu').classList.remove('open');
  document.getElementById('mobile-menu-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function mobileNav(page) {
  closeMobileMenu();
  showPage(page);
}

function mobileNavAuth(callback) {
  closeMobileMenu();
  if (state.currentUser) callback();
  else { showToast('Veuillez vous connecter', 'warning'); showPage('auth'); }
}

// Mettre à jour le menu mobile quand l'état user change
function updateMobileMenuAuth() {
  const section = document.getElementById('mobile-menu-auth-section');
  if (!section) return;
  if (state.currentUser) {
    section.innerHTML = `
      <div style="color:var(--gold);font-size:12px;letter-spacing:1px;margin-bottom:12px">
        ${escHtml(state.currentUser.name.split(' ')[0])}
      </div>
      <button class="btn-nav" style="width:100%;text-align:center" onclick="closeMobileMenu();logout()">Déconnexion</button>`;
  } else {
    section.innerHTML = `<button class="btn-nav" style="width:100%;text-align:center" onclick="mobileNav('auth')">Connexion</button>`;
  }
  // Badge panier mobile
  const badge = document.getElementById('mobile-cart-badge');
  if (badge) badge.textContent = state.cart.reduce((s, i) => s + i.qty, 0);
}

// ── Admin sidebar collapse on mobile ─────────────────────────
function toggleAdminSidebar() {
  const sidebar = document.getElementById('admin-sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed');
}

// Auto-collapse admin nav on mobile after section click
function adminNavMobileCollapse() {
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('admin-sidebar');
    if (sidebar) sidebar.classList.add('collapsed');
  }
}

// ════════════════════════════════════════════════════════════
//  ADMIN ACCESS via URL hash
// ════════════════════════════════════════════════════════════
window.addEventListener('hashchange', () => { if (location.hash === '#admin') showPage('admin-login'); });
if (location.hash === '#admin') showPage('admin-login');

const adminLink = document.createElement('a');
adminLink.href = '#admin';
adminLink.className = 'admin-secret-link';
adminLink.style.cssText = 'position:fixed;bottom:16px;right:16px;color:rgba(201,169,110,0.3);font-size:9px;letter-spacing:2px;text-decoration:none;text-transform:uppercase;transition:color 0.3s;z-index:999';
adminLink.textContent = 'Admin';
adminLink.addEventListener('mouseenter', () => adminLink.style.color = 'rgba(201,169,110,0.8)');
adminLink.addEventListener('mouseleave', () => adminLink.style.color = 'rgba(201,169,110,0.3)');
adminLink.addEventListener('click', () => showPage('admin-login'));
document.body.appendChild(adminLink);
