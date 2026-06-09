(function() {
  function scrapeProduct() {
    const result = { title: '', price: '', originalPrice: '', imageUrl: '' };
    const titleSelectors = [
      'h1', '.title', '.product-title', '.goods-title',
      '[class*="title"]', 'meta[name="title"]', 'title'
    ];
    for (const sel of titleSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.trim()) {
          result.title = el.textContent.trim().slice(0, 60);
          break;
        }
      } catch(e) {}
    }
    const priceSelectors = [
      '.price', '.product-price', '.goods-price', '.tm-price',
      '[class*="price"]', '[data-price]', '.price-value'
    ];
    for (const sel of priceSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.trim()) {
          const match = el.textContent.trim().match(/[¥￥$]?\s*\d+(\.\d{1,2})?/);
          result.price = match ? match[0] : el.textContent.trim();
          break;
        }
      } catch(e) {}
    }
    const imgSelectors = [
      'img.product-image', 'img[class*="product"]', 'img[class*="main"]',
      '.main-image img', '#main-image img', '.goods-img img'
    ];
    for (const sel of imgSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.src) {
          result.imageUrl = el.src;
          break;
        }
      } catch(e) {}
    }
    if (!result.imageUrl) {
      try {
        const ogImg = document.querySelector('meta[property="og:image"]');
        if (ogImg) result.imageUrl = ogImg.content;
      } catch(e) {}
    }
    return result;
  }
  window.__scrapeProduct = scrapeProduct;
})();
