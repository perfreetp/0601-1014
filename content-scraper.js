(function() {
  function scrapeProduct() {
    const result = {
      title: '',
      price: '',
      originalPrice: '',
      imageUrl: '',
      allTitles: [],
      allPrices: [],
      allImages: []
    };

    const titleSelectors = [
      'h1', '.title', '.product-title', '.goods-title',
      '[class*="title"]', 'meta[name="title"]', 'title'
    ];
    const titlesSet = new Set();
    for (const sel of titleSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        els.forEach(el => {
          if (el && el.textContent && el.textContent.trim()) {
            const t = el.textContent.trim().slice(0, 80);
            if (t.length > 4) titlesSet.add(t);
          }
        });
      } catch(e) {}
    }
    result.allTitles = Array.from(titlesSet).slice(0, 5);
    result.title = result.allTitles[0] || '';

    const priceSelectors = [
      '.price', '.product-price', '.goods-price', '.tm-price',
      '[class*="price"]', '[data-price]', '.price-value',
      '[class*="Price"]', '.sale-price', '.promotion-price'
    ];
    const pricesSet = new Set();
    for (const sel of priceSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        els.forEach(el => {
          if (el && el.textContent && el.textContent.trim()) {
            const text = el.textContent.trim();
            const match = text.match(/[¥￥$]?\s*\d+(?:\.\d{1,2})?/);
            if (match) {
              pricesSet.add(match[0]);
            } else if (text.length < 20 && /\d/.test(text)) {
              pricesSet.add(text);
            }
          }
        });
      } catch(e) {}
    }
    result.allPrices = Array.from(pricesSet).slice(0, 8);
    result.price = result.allPrices[0] || '';
    if (result.allPrices.length > 1) {
      const nums = result.allPrices
        .map(p => parseFloat(p.replace(/[^\d.]/g, '')))
        .filter(n => !isNaN(n))
        .sort((a, b) => b - a);
      if (nums.length > 1) {
        const maxStr = result.allPrices.find(p => {
          const n = parseFloat(p.replace(/[^\d.]/g, ''));
          return n === nums[0];
        });
        if (maxStr && maxStr !== result.price) {
          result.originalPrice = maxStr;
        }
      }
    }

    const imgSelectors = [
      'img.product-image', 'img[class*="product"]', 'img[class*="main"]',
      'img[class*="goods"]', 'img[class*="item"]', 'img[alt*="商品"]',
      'img[alt*="产品"]', '.main-image img', '#main-image img', '.goods-img img'
    ];
    const imgsSet = new Set();
    for (const sel of imgSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        els.forEach(el => {
          if (el && el.src && el.src.startsWith('http') && !el.src.includes('data:')) {
            const w = el.naturalWidth || el.width || 0;
            const h = el.naturalHeight || el.height || 0;
            if (w > 100 && h > 100) {
              imgsSet.add(el.src);
            }
          }
        });
      } catch(e) {}
    }
    if (!imgsSet.size) {
      try {
        document.querySelectorAll('img').forEach(img => {
          if (img.src && img.src.startsWith('http')) {
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            if (w > 300 && h > 300) {
              imgsSet.add(img.src);
            }
          }
        });
      } catch(e) {}
    }
    try {
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg && ogImg.content) imgsSet.add(ogImg.content);
    } catch(e) {}
    result.allImages = Array.from(imgsSet).slice(0, 12);
    result.imageUrl = result.allImages[0] || '';

    return result;
  }
  window.__scrapeProduct = scrapeProduct;
})();
