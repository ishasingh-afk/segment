// Segment Website - Shared JavaScript
// Includes Segment integration, consent, identity, cart, and event firing

// Segment Snippet (already in HTML, but ensuring it's loaded)
if (typeof analytics === 'undefined') {
  console.error('Segment not loaded');
}

// ---------- Consent Management ----------
let consentGranted = localStorage.getItem('consent_marketing') === 'true';

function updateConsentBanner() {
  const banner = document.getElementById('consent-banner');
  if (banner) {
    if (!localStorage.getItem('consent_shown')) {
      banner.classList.add('show');
    }
  }
}

function setConsent(granted) {
  consentGranted = granted;
  localStorage.setItem('consent_marketing', granted ? 'true' : 'false');
  localStorage.setItem('consent_shown', 'true');

  const banner = document.getElementById('consent-banner');
  if (banner) {
    banner.classList.remove('show');
  }

  const status = document.getElementById('consent-status');
  if (status) {
    status.textContent = granted ? 'Granted' : 'Revoked';
    status.className = granted ? 'ok' : 'warn';
  }

  console.log('[Consent] Updated to:', granted);
}

function getConsentProps() {
  return { consent_marketing: consentGranted };
}

// ---------- Identity Management ----------
let currentUserId = null;
let currentAnonymousId = null;

function updateUserInfo() {
  const userInfo = document.getElementById('user-info');
  if (userInfo) {
    const anonId = analytics.user().anonymousId();
    const userId = analytics.user().id();
    userInfo.innerHTML = `
      <small>Anonymous ID: ${anonId ? anonId.substring(0, 8) + '...' : 'N/A'}</small>
      <small>User ID: ${userId || 'Anonymous'}</small>
    `;
  }
}

function identifyUser(email, plan) {
  const userId = email.split('@')[0]; // Simple ID
  analytics.identify(userId, { email, plan });
  currentUserId = userId;
  localStorage.setItem('user_email', email);
  localStorage.setItem('user_plan', plan);
  updateUserInfo();
  console.log('[Segment] identify:', userId);
}

function resetIdentity() {
  analytics.reset();
  currentUserId = null;
  localStorage.removeItem('user_email');
  localStorage.removeItem('user_plan');
  updateUserInfo();
  console.log('[Segment] reset (logout)');
}

function loadPersistedIdentity() {
  const email = localStorage.getItem('user_email');
  const plan = localStorage.getItem('user_plan');
  if (email && plan) {
    identifyUser(email, plan);
  }
}

// ---------- Cart Management ----------
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.quantity += product.quantity || 1;
  } else {
    cart.push({ ...product, quantity: product.quantity || 1 });
  }
  saveCart();
  updateCartDisplay();
  console.log('[Cart] Added:', product);
}

function removeFromCart(productId, quantity = null) {
  const index = cart.findIndex(item => item.id === productId);
  if (index > -1) {
    if (quantity && cart[index].quantity > quantity) {
      cart[index].quantity -= quantity;
    } else {
      cart.splice(index, 1);
    }
    saveCart();
    updateCartDisplay();
    console.log('[Cart] Removed:', productId);
  }
}

function updateCartDisplay() {
  const cartCount = document.getElementById('cart-count');
  if (cartCount) {
    cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  const cartItems = document.getElementById('cart-items');
  if (cartItems) {
    cartItems.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <p>$${item.price} x ${item.quantity} = $${(item.price * item.quantity).toFixed(2)}</p>
        </div>
        <div class="cart-item-controls">
          <div class="quantity-controls">
            <button onclick="changeQuantity('${item.id}', -1)">-</button>
            <span>${item.quantity}</span>
            <button onclick="changeQuantity('${item.id}', 1)">+</button>
          </div>
          <button class="btn btn-danger btn-sm" onclick="removeFromCart('${item.id}')">Remove</button>
        </div>
      </div>
    `).join('');

    const cartTotal = document.getElementById('cart-total');
    if (cartTotal) {
      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      cartTotal.textContent = `$${total.toFixed(2)}`;
    }
  }
}

function changeQuantity(productId, delta) {
  const item = cart.find(item => item.id === productId);
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) {
      removeFromCart(productId);
    } else {
      saveCart();
      updateCartDisplay();
    }
  }
}

function getCartValue() {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function getCartItems() {
  return cart.length;
}

// ---------- Event Firing Functions ----------
function firePage(category) {
  analytics.page({ page_category: category, ...getConsentProps() });
  console.log('[Segment] page:', category);
}

function fireProductViewed(product) {
  analytics.track('product_viewed', {
    product_id: product.id,
    product_name: product.name,
    product_brand: product.brand || 'Brand',
    product_category: product.category || 'Category',
    product_price: product.price,
    ...getConsentProps()
  });
  console.log('[Segment] product_viewed:', product.name);
}

function fireAddToCart(product, quantity = 1) {
  const lineTotal = product.price * quantity;
  analytics.track('add_to_cart', {
    product_id: product.id,
    product_name: product.name,
    product_brand: product.brand || 'Brand',
    product_category: product.category || 'Category',
    product_price: product.price,
    qty: quantity,
    line_total: lineTotal,
    ...getConsentProps()
  });
  console.log('[Segment] add_to_cart:', product.name);
}

function fireRemoveFromCart(productId, quantity, lineTotal) {
  analytics.track('remove_from_cart', {
    product_id: productId,
    qty: quantity,
    line_total: lineTotal,
    ...getConsentProps()
  });
  console.log('[Segment] remove_from_cart:', productId);
}

function fireSignupStarted() {
  analytics.track('signup_started', {
    source: 'web',
    ...getConsentProps()
  });
  console.log('[Segment] signup_started');
}

function fireCheckoutStarted() {
  analytics.track('checkout_started', {
    cart_value: getCartValue(),
    num_items: getCartItems(),
    ...getConsentProps()
  });
  console.log('[Segment] checkout_started');
}

function fireOrderCompleted(orderId, checkoutId) {
  const products = cart.map(item => ({
    product_id: item.id,
    name: item.name,
    brand: item.brand || 'Brand',
    category: item.category || 'Category',
    price: item.price,
    quantity: item.quantity
  }));

  analytics.track('order_completed', {
    order_id: orderId,
    checkout_id: checkoutId,
    num_items: getCartItems(),
    total: getCartValue(),
    revenue: getCartValue(),
    shipping: 0,
    tax: 0,
    affiliation: 'Store',
    products: products,
    ...getConsentProps()
  });
  console.log('[Segment] order_completed:', orderId);
}

// ---------- Debug Tools ----------
function simulateTraffic() {
  const users = ['user001@demo.com', 'user002@demo.com', 'user003@demo.com'];
  const products = [
    { id: 'SKU-001', name: 'Tee', price: 19.99, brand: 'Brand', category: 'Clothing' },
    { id: 'SKU-002', name: 'Hoodie', price: 39.99, brand: 'Brand', category: 'Clothing' },
    { id: 'SKU-003', name: 'Mug', price: 9.99, brand: 'Brand', category: 'Accessories' }
  ];

  users.forEach((email, index) => {
    setTimeout(() => {
      identifyUser(email, 'trial');
      firePage('home');

      const product = products[Math.floor(Math.random() * products.length)];
      fireProductViewed(product);
      fireAddToCart(product, Math.floor(Math.random() * 3) + 1);

      if (Math.random() > 0.5) {
        fireCheckoutStarted();
        fireOrderCompleted(`ORD-${Date.now()}`, `CHK-${Date.now()}`);
      }

      resetIdentity();
    }, index * 500);
  });
}

function fireEventManually(eventName) {
  switch (eventName) {
    case 'page':
      firePage('home');
      break;
    case 'product_viewed':
      fireProductViewed({ id: 'SKU-001', name: 'Tee', price: 19.99 });
      break;
    case 'add_to_cart':
      fireAddToCart({ id: 'SKU-001', name: 'Tee', price: 19.99 });
      break;
    case 'signup_started':
      fireSignupStarted();
      break;
    case 'checkout_started':
      fireCheckoutStarted();
      break;
    case 'order_completed':
      fireOrderCompleted(`ORD-${Date.now()}`, `CHK-${Date.now()}`);
      break;
  }
}

// ---------- Initialization ----------
document.addEventListener('DOMContentLoaded', function() {
  updateConsentBanner();
  loadPersistedIdentity();
  updateUserInfo();
  updateCartDisplay();

  // Consent banner buttons - use setTimeout to ensure DOM is ready
  setTimeout(() => {
    const grantBtn = document.getElementById('grant-consent');
    const revokeBtn = document.getElementById('revoke-consent');
    if (grantBtn) {
      grantBtn.addEventListener('click', () => setConsent(true));
      console.log('Grant consent button listener attached');
    }
    if (revokeBtn) {
      revokeBtn.addEventListener('click', () => setConsent(false));
      console.log('Revoke consent button listener attached');
    }
  }, 100);

  // Debug tools
  const simulateBtn = document.getElementById('simulate-traffic');
  if (simulateBtn) simulateBtn.addEventListener('click', simulateTraffic);

  const eventButtons = document.querySelectorAll('[data-fire-event]');
  eventButtons.forEach(btn => {
    btn.addEventListener('click', () => fireEventManually(btn.dataset.fireEvent));
  });
});
