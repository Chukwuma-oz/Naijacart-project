// NaijaCart storefront logic (vanilla JS — no build step, deploys straight to S3).
const API = window.NAIJACART_CONFIG.API_BASE;
const $ = (id) => document.getElementById(id);

let cart = JSON.parse(localStorage.getItem('nc_cart') || '{}');   // {product_id: {qty, name, price}}
let auth = JSON.parse(localStorage.getItem('nc_auth') || 'null'); // {token, user}
let registerMode = false;

// ---------- helpers ----------
const ngn = (n) => 'NGN ' + Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0 });
function saveCart() { localStorage.setItem('nc_cart', JSON.stringify(cart)); renderCartCount(); }
function saveAuth(a) { auth = a; localStorage.setItem('nc_auth', JSON.stringify(a)); renderWho(); }
function clearAuth() { auth = null; localStorage.removeItem('nc_auth'); renderWho(); }

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (auth && auth.token) headers.Authorization = 'Bearer ' + auth.token;
  const res = await fetch(API + path, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || ('Request failed: ' + res.status));
  return body;
}

// ---------- products ----------
async function loadProducts() {
  const grid = $('grid');
  grid.innerHTML = '<p style="padding:20px;">Loading catalogue...</p>';
  try {
    const products = await api('/api/products');
    grid.innerHTML = '';
    products.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="ph">${p.name.slice(0, 1)}</div>
        <h3>${p.name}</h3>
        <p>${p.description || ''}</p>
        <div class="price">${ngn(p.price_ngn)}</div>
        <div class="stock">${p.stock} in stock</div>
        <button class="primary" data-id="${p.id}">Add to cart</button>`;
      card.querySelector('button').onclick = () => addToCart(p);
      grid.appendChild(card);
    });
  } catch (e) {
    grid.innerHTML = `<p style="padding:20px;color:#c0392b;">Could not reach the API at ${API}. Is the backend running and CORS configured? (${e.message})</p>`;
  }
}

// ---------- cart ----------
function addToCart(p) {
  const item = cart[p.id] || { qty: 0, name: p.name, price: p.price_ngn };
  item.qty += 1;
  cart[p.id] = item;
  saveCart();
  openCart();
}
function renderCartCount() {
  $('cart-count').textContent = Object.values(cart).reduce((s, i) => s + i.qty, 0);
}
function renderCart() {
  const wrap = $('cart-items');
  wrap.innerHTML = '';
  let total = 0;
  Object.entries(cart).forEach(([id, i]) => {
    total += i.qty * i.price;
    const row = document.createElement('div');
    row.className = 'ci';
    row.innerHTML = `<span>${i.name}</span>
      <span class="qty"><button data-a="-">-</button>${i.qty}<button data-a="+">+</button></span>
      <span>${ngn(i.qty * i.price)}</span>`;
    row.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      i.qty += b.dataset.a === '+' ? 1 : -1;
      if (i.qty <= 0) delete cart[id];
      saveCart(); renderCart();
    }));
    wrap.appendChild(row);
  });
  if (total === 0) wrap.innerHTML = '<p style="padding:10px 0;color:#7b8781;">Cart is empty.</p>';
  $('cart-total').textContent = ngn(total);
}
function openCart() { renderCart(); $('cart').classList.remove('hidden'); }

// ---------- checkout ----------
async function checkout() {
  const items = Object.entries(cart).map(([product_id, i]) => ({ product_id: Number(product_id), qty: i.qty }));
  if (items.length === 0) { $('cart-msg').textContent = 'Cart is empty.'; return; }
  if (!auth) { $('cart-msg').textContent = 'Please sign in first.'; openAuth(); return; }
  try {
    const out = await api('/api/orders', { method: 'POST', body: JSON.stringify({ items }) });
    cart = {}; saveCart(); renderCart();
    $('cart-msg').textContent = `Order #${out.order_id} placed — ${ngn(out.total_ngn)}. Thank you!`;
    loadProducts(); // refresh stock counts
  } catch (e) { $('cart-msg').textContent = e.message; }
}

// ---------- auth ----------
function openAuth() { $('auth').classList.remove('hidden'); $('auth-msg').textContent = ''; }
function setRegisterMode(on) {
  registerMode = on;
  $('auth-title').textContent = on ? 'Register' : 'Sign in';
  $('auth-submit').textContent = on ? 'Register' : 'Sign in';
  $('auth-name').classList.toggle('hidden', !on);
  $('auth-switch').textContent = on ? 'Have an account? Sign in' : 'Need an account? Register';
}
async function submitAuth() {
  const email = $('auth-email').value.trim();
  const password = $('auth-pass').value;
  try {
    const out = registerMode
      ? await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: $('auth-name').value.trim(), email, password }) })
      : await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    saveAuth(out);
    $('auth').classList.add('hidden');
  } catch (e) { $('auth-msg').textContent = e.message; }
}
function renderWho() {
  if (auth) {
    $('who').textContent = 'Hi, ' + auth.user.name.split(' ')[0];
    $('btn-auth').textContent = 'Sign out';
    $('btn-orders').classList.remove('hidden');
  } else {
    $('who').textContent = '';
    $('btn-auth').textContent = 'Sign in';
    $('btn-orders').classList.add('hidden');
  }
}

// ---------- orders ----------
async function showOrders() {
  try {
    const orders = await api('/api/orders');
    const list = $('orders-list');
    list.innerHTML = orders.length ? '' : '<p>No orders yet.</p>';
    orders.forEach((o) => {
      const items = (typeof o.items === 'string' ? JSON.parse(o.items) : o.items)
        .map((i) => `${i.qty} x ${i.name}`).join(', ');
      const div = document.createElement('div');
      div.className = 'order';
      div.innerHTML = `<b>Order #${o.id}</b> — ${o.status} — ${ngn(o.total_ngn)}<br>${items}<br><small>${new Date(o.created_at).toLocaleString()}</small>`;
      list.appendChild(div);
    });
    $('orders').classList.remove('hidden');
  } catch (e) { alert(e.message); }
}

// ---------- wire up ----------
$('btn-cart').onclick = openCart;
$('cart-close').onclick = () => $('cart').classList.add('hidden');
$('btn-checkout').onclick = checkout;
$('btn-auth').onclick = () => (auth ? clearAuth() : openAuth());
$('auth-close').onclick = (e) => { e.preventDefault(); $('auth').classList.add('hidden'); };
$('auth-switch').onclick = (e) => { e.preventDefault(); setRegisterMode(!registerMode); };
$('auth-submit').onclick = submitAuth;
$('btn-orders').onclick = showOrders;
$('orders-close').onclick = (e) => { e.preventDefault(); $('orders').classList.add('hidden'); };

renderWho(); renderCartCount(); loadProducts();
