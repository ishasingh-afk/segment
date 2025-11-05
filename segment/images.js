// Placeholder images for products - using placeholder.com for demo purposes
const productImages = {
  'SKU-001': 'https://via.placeholder.com/400x300/667eea/ffffff?text=Tee',
  'SKU-002': 'https://via.placeholder.com/400x300/764ba2/ffffff?text=Hoodie',
  'SKU-003': 'https://via.placeholder.com/400x300/ff6b6b/ffffff?text=Mug',
  'SKU-004': 'https://via.placeholder.com/400x300/4ecdc4/ffffff?text=Hat',
  'SKU-005': 'https://via.placeholder.com/400x300/45b7d1/ffffff?text=Socks',
  'SKU-006': 'https://via.placeholder.com/400x300/f9ca24/ffffff?text=Sticker'
};

// Function to get product image
function getProductImage(productId) {
  return productImages[productId] || 'https://via.placeholder.com/400x300/cccccc/000000?text=No+Image';
}
