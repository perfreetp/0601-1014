(function() {
  'use strict';

  const state = {
    product: {
      title: '',
      price: '',
      originalPrice: '',
      imageUrl: '',
      imageData: null,
      tags: []
    },
    canvas: {
      width: 800,
      height: 800,
      bgColor: '#FF4757',
      textColor: '#FFFFFF',
      fontFamily: "'Microsoft YaHei', sans-serif",
      borderWidth: 4,
      borderColor: '#FFFFFF',
      borderRadius: 16,
      stickers: [],
      showSafeArea: true
    },
    selectedTemplate: null,
    customTemplates: [],
    favoriteTemplates: [],
    brandColors: [],
    history: [],
    recentProducts: [],
    batchImages: {},
    candidateImages: [],
    candidatePrices: [],
    candidateTitles: [],
    selectedHistoryIds: [],
    batchTweaks: {},
    activeBatchType: null,
    batchSizes: {
      cover: { name: '直播封面', width: 800, height: 800, enabled: true },
      corner: { name: '直播间角标', width: 200, height: 200, enabled: true },
      banner: { name: '横幅海报', width: 1920, height: 1080, enabled: true },
      danmu: { name: '弹幕贴图', width: 600, height: 150, enabled: true }
    }
  };

  const templates = [
    { id: 'seckill-1', name: '秒杀爆款', category: 'seckill', icon: '⚡', bgColor: '#FF4757', accentColor: '#FFD700' },
    { id: 'seckill-2', name: '限时特惠', category: 'seckill', icon: '⏰', bgColor: '#E74C3C', accentColor: '#FFFFFF' },
    { id: 'seckill-3', name: '闪购疯抢', category: 'seckill', icon: '🔥', bgColor: '#C0392B', accentColor: '#F1C40F' },
    { id: 'new-1', name: '新品首发', category: 'new', icon: '🆕', bgColor: '#3498DB', accentColor: '#FFFFFF' },
    { id: 'new-2', name: '上新预告', category: 'new', icon: '✨', bgColor: '#9B59B6', accentColor: '#F39C12' },
    { id: 'new-3', name: '独家新品', category: 'new', icon: '💎', bgColor: '#1ABC9C', accentColor: '#FFFFFF' },
    { id: 'lottery-1', name: '幸运抽奖', category: 'lottery', icon: '🎁', bgColor: '#E91E63', accentColor: '#FFEB3B' },
    { id: 'lottery-2', name: '关注抽奖', category: 'lottery', icon: '🎰', bgColor: '#9C27B0', accentColor: '#FFFFFF' },
    { id: 'lottery-3', name: '福利放送', category: 'lottery', icon: '🎉', bgColor: '#FF5722', accentColor: '#FFFFFF' },
    { id: 'preview-1', name: '直播预告', category: 'preview', icon: '📺', bgColor: '#2C3E50', accentColor: '#E74C3C' },
    { id: 'preview-2', name: '开播提醒', category: 'preview', icon: '🔔', bgColor: '#34495E', accentColor: '#F39C12' },
    { id: 'preview-3', name: '即将开始', category: 'preview', icon: '⏳', bgColor: '#1A1A2E', accentColor: '#00D9FF' }
  ];

  const SHARE_PREFIX = 'LIVE-DESIGN-v1:';

  function $(id) { return document.getElementById(id); }

  function showToast(msg, duration = 2000) {
    const toast = $('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  }

  function saveAllState() {
    chrome.storage.local.set({
      favoriteTemplates: state.favoriteTemplates,
      brandColors: state.brandColors,
      history: state.history.slice(0, 100),
      recentProducts: state.recentProducts.slice(0, 20),
      customTemplates: state.customTemplates
    });
  }

  function loadAllState() {
    chrome.storage.local.get(
      ['favoriteTemplates', 'brandColors', 'history', 'recentProducts', 'customTemplates'],
      (data) => {
        if (data.favoriteTemplates) state.favoriteTemplates = data.favoriteTemplates;
        if (data.brandColors) state.brandColors = data.brandColors;
        if (data.history) state.history = data.history;
        if (data.recentProducts) state.recentProducts = data.recentProducts;
        if (data.customTemplates) state.customTemplates = data.customTemplates;
        renderBrandColors();
        renderFavoriteTemplates();
        renderHistory();
        renderRecentProducts();
      }
    );
  }

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        $('panel-' + btn.dataset.panel).classList.add('active');
        if (btn.dataset.panel === 'batch') renderBatchPreviews();
        if (btn.dataset.panel === 'preview') updatePreviewImages();
      });
    });
  }

  function showModal(title, html, onConfirm, wide) {
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = html;
    $('modal-overlay').style.display = 'flex';
    const modalEl = $('modal');
    if (wide) modalEl.classList.add('modal-wide'); else modalEl.classList.remove('modal-wide');
    const closeBtn = $('modal-close');
    const close = () => { $('modal-overlay').style.display = 'none'; closeBtn.removeEventListener('click', close); };
    closeBtn.addEventListener('click', close);
    if (onConfirm) {
      const btn = $('modal-body').querySelector('[data-confirm]');
      if (btn) btn.addEventListener('click', () => { onConfirm(); close(); });
    }
    $('modal-overlay').onclick = (e) => {
      if (e.target.id === 'modal-overlay') close();
    };
  }

  function drawDesign(ctx, w, h, opts = {}) {
    const scale = opts.scale || (w / 800);
    const product = opts.product || state.product;
    const canvas = opts.canvas || state.canvas;
    const tpl = opts.template || state.selectedTemplate;
    const tweaks = opts.tweaks || {};
    const titleY = (tweaks.titleY != null ? tweaks.titleY : 78) / 100;
    const priceSize = (tweaks.priceSize != null ? tweaks.priceSize : 10) / 100;
    const priceY = (tweaks.priceY != null ? tweaks.priceY : 68) / 100;

    ctx.clearRect(0, 0, w, h);

    const borderRadius = (canvas.borderRadius || 16) * scale;
    const borderWidth = (canvas.borderWidth || 0) * scale;

    roundRect(ctx, 0, 0, w, h, borderRadius);
    ctx.fillStyle = canvas.bgColor;
    ctx.fill();

    if (borderWidth > 0) {
      ctx.save();
      ctx.strokeStyle = canvas.borderColor;
      ctx.lineWidth = borderWidth;
      roundRect(ctx, borderWidth / 2, borderWidth / 2,
        w - borderWidth, h - borderWidth,
        Math.max(0, borderRadius - borderWidth / 2));
      ctx.stroke();
      ctx.restore();
    }

    if (tpl) {
      ctx.fillStyle = tpl.accentColor;
      ctx.font = `bold ${Math.floor(w * 0.2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(tpl.icon, w / 2, h * 0.25);
    }

    const drawTextAndStickers = () => {
      if (product.tags && product.tags.length > 0) {
        ctx.font = `bold ${Math.floor(w * 0.035)}px ${canvas.fontFamily}`;
        let tagY = h * 0.08;
        product.tags.forEach((tag, i) => {
          const tagW = ctx.measureText(tag).width + w * 0.04;
          const tagX = w * 0.06;
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          roundRect(ctx, tagX, tagY + i * (w * 0.06), tagW, w * 0.05, w * 0.025);
          ctx.fill();
          ctx.fillStyle = canvas.bgColor;
          ctx.textAlign = 'left';
          ctx.fillText(tag, tagX + w * 0.02, tagY + i * (w * 0.06) + w * 0.035);
        });
      }

      ctx.fillStyle = canvas.textColor;
      ctx.textAlign = 'center';

      if (product.originalPrice) {
        ctx.font = `${Math.floor(w * 0.035)}px ${canvas.fontFamily}`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(product.originalPrice, w / 2, h * (priceY - 0.1));
      }

      if (product.price) {
        ctx.font = `bold ${Math.floor(w * priceSize)}px ${canvas.fontFamily}`;
        ctx.fillStyle = canvas.textColor;
        ctx.fillText(product.price, w / 2, h * priceY);
      }

      if (product.title) {
        ctx.font = `bold ${Math.floor(w * 0.05)}px ${canvas.fontFamily}`;
        ctx.fillStyle = canvas.textColor;
        wrapText(ctx, product.title, w / 2, h * titleY, w * 0.85, w * 0.06);
      }

      if (canvas.stickers && canvas.stickers.length > 0) {
        canvas.stickers.forEach((emoji, i) => {
          ctx.font = `${Math.floor(w * 0.08)}px sans-serif`;
          ctx.textAlign = 'center';
          const x = w * 0.15 + (i % 5) * w * 0.18;
          const y = h * 0.9;
          ctx.fillText(emoji, x, y);
        });
      }
    };

    if (product.imageData) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const imgW = w * 0.6;
          const imgH = imgW;
          const ix = (w - imgW) / 2;
          const iy = h * 0.15;
          ctx.save();
          roundRect(ctx, ix, iy, imgW, imgH, 12 * scale);
          ctx.clip();
          ctx.drawImage(img, ix, iy, imgW, imgH);
          ctx.restore();
        } catch (e) {}
        drawTextAndStickers();
        if (opts.onComplete) opts.onComplete();
      };
      img.onerror = () => {
        drawTextAndStickers();
        if (opts.onComplete) opts.onComplete();
      };
      img.src = product.imageData;
    } else {
      drawTextAndStickers();
      if (opts.onComplete) opts.onComplete();
    }
  }

  function initProductPanel() {
    $('btn-scrape').addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return showToast('无法获取当前标签页');
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: scrapeProductInfo
        });
        if (results && results[0] && results[0].result) {
          const info = results[0].result;
          state.product.title = info.title || '';
          state.product.price = info.price || '';
          state.product.originalPrice = info.originalPrice || '';
          state.product.imageUrl = info.imageUrl || '';
          state.candidateTitles = info.allTitles || [];
          state.candidateImages = info.allImages || [];
          state.candidatePrices = info.allPrices || [];
          if (info.imageUrl) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { state.product.imageData = info.imageUrl; renderCanvas(); renderCandidates(); };
            img.onerror = () => { renderCanvas(); renderCandidates(); };
            img.src = info.imageUrl;
          } else {
            renderCanvas();
            renderCandidates();
          }
          updateProductForm();
          showToast(`抓取成功：${state.candidateTitles.length}个标题，${state.candidateImages.length}张图，${state.candidatePrices.length}个价格`);
        } else {
          showToast('未找到商品信息，请手动输入');
        }
      } catch (e) {
        showToast('抓取失败：' + e.message);
      }
    });

    const cropBtn = $('btn-crop-image');
    if (cropBtn) cropBtn.addEventListener('click', showCropModal);
    const saveCardBtn = $('btn-save-product-card');
    if (saveCardBtn) saveCardBtn.addEventListener('click', saveProductCard);

    $('btn-manual').addEventListener('click', () => {
      state.product.title = $('product-title').value;
      state.product.price = $('product-price').value;
      state.product.originalPrice = $('product-original-price').value;
      state.product.imageUrl = $('product-image-url').value;
      if (state.product.imageUrl) loadImageFromUrl(state.product.imageUrl);
      addToRecentProducts();
      renderCanvas();
      showToast('商品信息已保存');
    });

    $('btn-clear-recent').addEventListener('click', () => {
      if (confirm('确定清空最近商品？')) {
        state.recentProducts = [];
        saveAllState();
        renderRecentProducts();
      }
    });

    ['product-title', 'product-price', 'product-original-price'].forEach(id => {
      $(id).addEventListener('input', () => {
        const key = id.replace('product-', '').replace(/-([a-z])/g, (m, c) => c.toUpperCase());
        state.product[key] = $(id).value;
        renderCanvas();
      });
    });

    $('product-image-url').addEventListener('change', (e) => {
      state.product.imageUrl = e.target.value;
      if (e.target.value) loadImageFromUrl(e.target.value);
    });

    $('image-preview').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          state.product.imageData = ev.target.result;
          state.product.imageUrl = '';
          $('image-preview').innerHTML = '<img src="' + ev.target.result + '" alt="商品图">';
          addToRecentProducts();
          renderCanvas();
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });

    document.querySelectorAll('#tag-list .tag').forEach(tag => {
      tag.addEventListener('click', () => {
        tag.classList.toggle('active');
        const tagText = tag.textContent;
        const idx = state.product.tags.indexOf(tagText);
        if (idx >= 0) state.product.tags.splice(idx, 1);
        else state.product.tags.push(tagText);
        renderCanvas();
      });
    });
  }

  function scrapeProductInfo() {
    const result = {
      title: '', price: '', originalPrice: '', imageUrl: '',
      allTitles: [], allPrices: [], allImages: []
    };
    const titleSels = ['h1', '.title', '.product-title', '.goods-title', '[class*="title"]', 'meta[name="title"]', 'title'];
    const titlesSet = new Set();
    for (const sel of titleSels) {
      try {
        document.querySelectorAll(sel).forEach(el => {
          const t = (el.textContent || '').trim();
          if (t.length > 4) titlesSet.add(t.slice(0, 80));
        });
      } catch (e) {}
    }
    result.allTitles = Array.from(titlesSet).slice(0, 5);
    result.title = result.allTitles[0] || '';

    const priceSels = ['.price', '.product-price', '.goods-price', '.tm-price', '[class*="price"]', '[data-price]', '.price-value'];
    const pricesSet = new Set();
    for (const sel of priceSels) {
      try {
        document.querySelectorAll(sel).forEach(el => {
          const text = (el.textContent || '').trim();
          const m = text.match(/[¥￥$]?\s*\d+(?:\.\d{1,2})?/);
          if (m) pricesSet.add(m[0]);
          else if (text.length < 20 && /\d/.test(text)) pricesSet.add(text);
        });
      } catch (e) {}
    }
    result.allPrices = Array.from(pricesSet).slice(0, 8);
    result.price = result.allPrices[0] || '';
    if (result.allPrices.length > 1) {
      const nums = result.allPrices
        .map(p => parseFloat(p.replace(/[^\d.]/g, '')))
        .filter(n => !isNaN(n)).sort((a, b) => b - a);
      if (nums.length > 1) {
        const maxStr = result.allPrices.find(p => parseFloat(p.replace(/[^\d.]/g, '')) === nums[0]);
        if (maxStr && maxStr !== result.price) result.originalPrice = maxStr;
      }
    }

    const imgSels = ['img.product-image', 'img[class*="product"]', 'img[class*="main"]',
      'img[class*="goods"]', 'img[class*="item"]', 'img[alt*="商品"]', 'img[alt*="产品"]',
      '.main-image img', '#main-image img', '.goods-img img'];
    const imgsSet = new Set();
    for (const sel of imgSels) {
      try {
        document.querySelectorAll(sel).forEach(el => {
          if (el.src && el.src.startsWith('http')) {
            const w = el.naturalWidth || el.width || 0;
            const h = el.naturalHeight || el.height || 0;
            if (w > 100 && h > 100) imgsSet.add(el.src);
          }
        });
      } catch (e) {}
    }
    if (!imgsSet.size) {
      try {
        document.querySelectorAll('img').forEach(img => {
          if (img.src && img.src.startsWith('http')) {
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            if (w > 300 && h > 300) imgsSet.add(img.src);
          }
        });
      } catch (e) {}
    }
    try {
      const og = document.querySelector('meta[property="og:image"]');
      if (og && og.content) imgsSet.add(og.content);
    } catch (e) {}
    result.allImages = Array.from(imgsSet).slice(0, 12);
    result.imageUrl = result.allImages[0] || '';
    return result;
  }

  function renderCandidates() {
    const sec = $('candidate-section');
    const hasAny = state.candidateTitles.length || state.candidateImages.length || state.candidatePrices.length;
    if (!hasAny) {
      sec.style.display = 'none';
      return;
    }
    sec.style.display = 'flex';

    const titleBox = $('candidate-titles');
    if (titleBox) {
      titleBox.innerHTML = '';
      if (state.candidateTitles.length === 0) {
        titleBox.innerHTML = '<div class="empty-state" style="padding:6px;font-size:11px;color:#999">暂无候选标题</div>';
      } else {
        state.candidateTitles.forEach(t => {
          const div = document.createElement('div');
          div.className = 'candidate-title-item' + (t === state.product.title ? ' selected' : '');
          div.textContent = t;
          div.title = t;
          div.addEventListener('click', () => {
            state.product.title = t;
            $('product-title').value = t;
            renderCanvas();
            renderCandidates();
          });
          titleBox.appendChild(div);
        });
      }
    }

    const cropBtn = $('btn-crop-image');
    if (cropBtn) cropBtn.style.display = (state.product.imageData || state.product.imageUrl) ? 'inline-block' : 'none';

    const imgBox = $('candidate-images');
    imgBox.innerHTML = '';
    if (state.candidateImages.length === 0) {
      imgBox.innerHTML = '<div class="empty-state" style="padding:6px;font-size:11px;color:#999">暂无候选图片</div>';
    } else {
      state.candidateImages.forEach((url, i) => {
        const div = document.createElement('div');
        div.className = 'candidate-img-thumb' + (url === state.product.imageUrl || url === state.product.imageData ? ' selected' : '');
        div.innerHTML = `<img src="${url}" alt="">`;
        div.addEventListener('click', () => {
          state.product.imageUrl = url;
          state.product.imageData = url;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            $('image-preview').innerHTML = '<img src="' + url + '" alt="商品图">';
            $('product-image-url').value = url;
            renderCanvas();
            renderCandidates();
          };
          img.onerror = () => renderCandidates();
          img.src = url;
        });
        imgBox.appendChild(div);
      });
    }

    const priceBox = $('candidate-prices');
    priceBox.innerHTML = '';
    if (state.candidatePrices.length === 0) {
      priceBox.innerHTML = '<div class="empty-state" style="padding:6px;font-size:11px;color:#999">暂无候选价格</div>';
    } else {
      state.candidatePrices.forEach(p => {
        const span = document.createElement('span');
        span.className = 'candidate-price-tag' + (p === state.product.price ? ' selected' : '');
        span.textContent = p;
        span.addEventListener('click', () => {
          state.product.price = p;
          $('product-price').value = p;
          renderCanvas();
          renderCandidates();
        });
        priceBox.appendChild(span);
      });
    }
  }

  function showCropModal() {
    const src = state.product.imageData || state.product.imageUrl;
    if (!src) return showToast('请先选择商品图');
    showModal('裁剪主图', `
      <canvas id="crop-canvas" class="crop-modal-canvas"></canvas>
      <div class="crop-controls">
        <div class="crop-control-row">
          <label>缩放</label>
          <input type="range" id="crop-scale" min="50" max="200" value="100">
          <span id="crop-scale-val">100%</span>
        </div>
        <div class="crop-control-row">
          <label>偏移X</label>
          <input type="range" id="crop-x" min="-100" max="100" value="0">
          <span id="crop-x-val">0</span>
        </div>
        <div class="crop-control-row">
          <label>偏移Y</label>
          <input type="range" id="crop-y" min="-100" max="100" value="0">
          <span id="crop-y-val">0</span>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-close>取消</button>
        <button class="btn btn-primary" data-crop-confirm>确认裁剪</button>
      </div>
    `, null, true);
    setTimeout(() => {
      const canvas = $('crop-canvas');
      const out = document.createElement('canvas');
      out.width = 600; out.height = 600;
      canvas.width = 600; canvas.height = 600;
      const ctx = canvas.getContext('2d');
      const octx = out.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const params = { scale: 1, ox: 0, oy: 0 };
      function redraw() {
        ctx.clearRect(0, 0, 600, 600);
        octx.clearRect(0, 0, 600, 600);
        const s = params.scale;
        const iw = 600 * s, ih = 600 * s;
        const ix = (600 - iw) / 2 + params.ox;
        const iy = (600 - ih) / 2 + params.oy;
        ctx.drawImage(img, ix, iy, iw, ih);
        octx.drawImage(img, ix, iy, iw, ih);
        ctx.strokeStyle = 'rgba(102,126,234,0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(4, 4, 592, 592);
        ctx.setLineDash([]);
      }
      img.onload = () => { redraw(); };
      img.src = src;
      ['crop-scale','crop-x','crop-y'].forEach(id => {
        const el = $(id);
        const v = $(id + '-val');
        el.addEventListener('input', () => {
          if (id === 'crop-scale') { params.scale = el.value / 100; v.textContent = el.value + '%'; }
          if (id === 'crop-x') { params.ox = parseInt(el.value); v.textContent = el.value; }
          if (id === 'crop-y') { params.oy = parseInt(el.value); v.textContent = el.value; }
          redraw();
        });
      });
      const close = $('modal-body').querySelector('[data-close]');
      if (close) close.addEventListener('click', () => $('modal-overlay').style.display = 'none');
      const confirmBtn = $('modal-body').querySelector('[data-crop-confirm]');
      if (confirmBtn) confirmBtn.addEventListener('click', () => {
        const dataUrl = out.toDataURL('image/png');
        state.product.imageData = dataUrl;
        state.product.imageUrl = '';
        $('image-preview').innerHTML = '<img src="' + dataUrl + '" alt="商品图">';
        $('modal-overlay').style.display = 'none';
        renderCanvas();
        showToast('主图已裁剪');
      });
    }, 80);
  }

  function saveProductCard() {
    if (!state.product.title && !state.product.price) return showToast('请先填写商品标题或价格');
    showModal('保存商品卡片', `
      <input type="text" class="input-rename" id="card-name-input" placeholder="卡片名称" value="${state.product.title || '商品卡片'}">
      <div class="modal-actions">
        <button class="btn btn-secondary" data-close>取消</button>
        <button class="btn btn-primary" data-confirm>保存</button>
      </div>
    `, () => {
      const name = $('card-name-input').value.trim() || state.product.title || '商品卡片';
      const item = {
        id: Date.now(),
        cardName: name,
        time: new Date().toLocaleString('zh-CN'),
        title: state.product.title || '',
        price: state.product.price || '',
        originalPrice: state.product.originalPrice || '',
        imageUrl: state.product.imageUrl || '',
        imageData: state.product.imageData || null,
        tags: [...(state.product.tags || [])],
        isCard: true
      };
      state.recentProducts = state.recentProducts.filter(r => r.id !== item.id && !(r.title === item.title && r.isCard));
      state.recentProducts.unshift(item);
      if (state.recentProducts.length > 30) state.recentProducts = state.recentProducts.slice(0, 30);
      saveAllState();
      renderRecentProducts();
      showToast('商品卡片已保存');
    });
    setTimeout(() => {
      const inp = $('card-name-input'); if (inp) inp.focus();
      const c = $('modal-body').querySelector('[data-close]');
      if (c) c.addEventListener('click', () => $('modal-overlay').style.display = 'none');
    }, 50);
  }

  function loadImageFromUrl(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      state.product.imageData = url;
      $('image-preview').innerHTML = '<img src="' + url + '" alt="商品图">';
      renderCanvas();
    };
    img.onerror = () => showToast('图片加载失败，请检查URL');
    img.src = url;
  }

  function updateProductForm() {
    $('product-title').value = state.product.title;
    $('product-price').value = state.product.price;
    $('product-original-price').value = state.product.originalPrice;
    $('product-image-url').value = state.product.imageUrl;
    if (state.product.imageData || state.product.imageUrl) {
      const src = state.product.imageData || state.product.imageUrl;
      $('image-preview').innerHTML = `<img src="${src}" alt="商品图">`;
    }
    document.querySelectorAll('#tag-list .tag').forEach(tag => {
      tag.classList.toggle('active', state.product.tags.includes(tag.textContent));
    });
  }

  function addToRecentProducts() {
    if (!state.product.title && !state.product.price) return;
    const item = {
      id: Date.now(),
      time: new Date().toLocaleString('zh-CN'),
      title: state.product.title || '未命名商品',
      price: state.product.price,
      originalPrice: state.product.originalPrice,
      imageUrl: state.product.imageUrl,
      imageData: state.product.imageData,
      tags: [...state.product.tags]
    };
    state.recentProducts = state.recentProducts.filter(r => r.title !== item.title);
    state.recentProducts.unshift(item);
    if (state.recentProducts.length > 20) state.recentProducts = state.recentProducts.slice(0, 20);
    saveAllState();
    renderRecentProducts();
  }

  function renderRecentProducts() {
    const box = $('recent-products');
    if (!box) return;
    box.innerHTML = '';
    if (state.recentProducts.length === 0) {
      box.innerHTML = '<div class="empty-state" style="padding:10px">暂无商品卡片</div>';
      return;
    }
    state.recentProducts.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'recent-product-item';
      const thumb = item.imageData || item.imageUrl
        ? `<img class="recent-product-thumb" src="${item.imageData || item.imageUrl}" alt="">`
        : '<div class="recent-product-thumb">📦</div>';
      const tag = item.isCard ? '<span class="product-card-tag">卡片</span>' : '';
      const displayTitle = (item.cardName || item.title || '未命名商品').slice(0, 18);
      div.innerHTML = `
        ${thumb}
        <div class="recent-product-info" style="flex:1;min-width:0">
          <div class="recent-product-title">${displayTitle}${tag}</div>
          <div class="recent-product-meta">${item.price || '-'} · ${item.time}</div>
        </div>
        <button class="recent-product-del" data-del="${item.id}" title="删除" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:14px;padding:2px 6px;border-radius:4px">×</button>
      `;
      div.addEventListener('click', (e) => {
        if (e.target.dataset.del) return;
        state.product = {
          title: item.title,
          price: item.price,
          originalPrice: item.originalPrice,
          imageUrl: item.imageUrl,
          imageData: item.imageData,
          tags: [...(item.tags || [])]
        };
        updateProductForm();
        renderCanvas();
        showToast('已载入：' + (item.cardName || item.title));
      });
      const delBtn = div.querySelector('[data-del]');
      if (delBtn) delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.recentProducts.splice(idx, 1);
        saveAllState();
        renderRecentProducts();
      });
      box.appendChild(div);
    });
  }

  function initTemplatePanel() {
    const grid = $('template-grid');

    function render(category) {
      grid.innerHTML = '';
      let list = templates;
      if (category === 'custom') {
        list = state.customTemplates.map(t => ({ ...t, category: 'custom', icon: '💾' }));
      } else if (category !== 'all') {
        list = templates.filter(t => t.category === category);
      }
      if (list.length === 0) {
        grid.innerHTML = '<div class="empty-state">暂无模板，在画布面板可另存为自定义模板</div>';
        return;
      }
      list.forEach(tpl => {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.dataset.id = tpl.id;
        card.innerHTML = `
          <div class="template-thumb" style="background: linear-gradient(135deg, ${tpl.bgColor}, ${adjustColor(tpl.bgColor, -30)})">
            <span style="font-size:40px">${tpl.icon}</span>
          </div>
          <div class="template-info">
            <div class="template-name">${tpl.name}</div>
          </div>
          <button class="template-fav ${state.favoriteTemplates.includes(tpl.id) ? 'active' : ''}" data-id="${tpl.id}">
            ${state.favoriteTemplates.includes(tpl.id) ? '★' : '☆'}
          </button>
          ${tpl.category === 'custom' ? '<button class="template-fav" data-del="' + tpl.id + '" style="right:auto;left:6px;background:rgba(255,80,80,0.9);color:white">🗑️</button>' : ''}
        `;
        card.addEventListener('click', (e) => {
          if (e.target.classList.contains('template-fav')) return;
          document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          applyTemplate(tpl);
          showToast('已选择：' + tpl.name);
        });
        const fav = card.querySelector('[data-id="' + tpl.id + '"]');
        if (fav) fav.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = fav.dataset.id;
          const idx = state.favoriteTemplates.indexOf(id);
          if (idx >= 0) {
            state.favoriteTemplates.splice(idx, 1);
            fav.classList.remove('active');
            fav.textContent = '☆';
          } else {
            state.favoriteTemplates.push(id);
            fav.classList.add('active');
            fav.textContent = '★';
          }
          saveAllState();
          renderFavoriteTemplates();
        });
        const del = card.querySelector('[data-del]');
        if (del) del.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!confirm('删除此自定义模板？')) return;
          state.customTemplates = state.customTemplates.filter(t => t.id !== tpl.id);
          saveAllState();
          render(category);
          renderFavoriteTemplates();
          showToast('已删除');
        });
        grid.appendChild(card);
      });
    }

    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render(btn.dataset.category);
      });
    });

    render('all');
    renderFavoriteTemplates();
  }

  function applyTemplate(tpl) {
    state.selectedTemplate = tpl;
    if (tpl.bgColor) state.canvas.bgColor = tpl.bgColor;
    if (tpl.accentColor) state.canvas.textColor = tpl.accentColor;
    if (tpl.fontFamily) state.canvas.fontFamily = tpl.fontFamily;
    if (tpl.borderWidth != null) state.canvas.borderWidth = tpl.borderWidth;
    if (tpl.borderColor) state.canvas.borderColor = tpl.borderColor;
    if (tpl.borderRadius != null) state.canvas.borderRadius = tpl.borderRadius;
    if (tpl.stickers) state.canvas.stickers = [...tpl.stickers];
    syncCanvasControls();
    syncStickerUI();
    renderCanvas();
  }

  function renderFavoriteTemplates() {
    const container = $('favorite-templates');
    if (!container) return;
    container.innerHTML = '';
    if (state.favoriteTemplates.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:10px">点击模板★添加到常用</div>';
      return;
    }
    state.favoriteTemplates.forEach(id => {
      let tpl = templates.find(t => t.id === id);
      if (!tpl) tpl = state.customTemplates.find(t => t.id === id);
      if (!tpl) return;
      const card = document.createElement('div');
      card.className = 'template-card';
      card.innerHTML = `
        <div class="template-thumb" style="background: linear-gradient(135deg, ${tpl.bgColor}, ${adjustColor(tpl.bgColor, -30)})">
          <span style="font-size:28px">${tpl.icon}</span>
        </div>
        <div class="template-info">
          <div class="template-name" style="font-size:11px">${tpl.name}</div>
        </div>
      `;
      card.addEventListener('click', () => { applyTemplate(tpl); showToast('已套用：' + tpl.name); });
      container.appendChild(card);
    });
  }

  function adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function initCanvasPanel() {
    $('canvas-size').addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        $('custom-size-inputs').style.display = 'flex';
      } else {
        $('custom-size-inputs').style.display = 'none';
        const [w, h] = e.target.value.split('x').map(Number);
        state.canvas.width = w;
        state.canvas.height = h;
        $('canvas-width').value = w;
        $('canvas-height').value = h;
        renderCanvas();
      }
    });
    $('canvas-width').addEventListener('input', e => { state.canvas.width = parseInt(e.target.value) || 800; renderCanvas(); });
    $('canvas-height').addEventListener('input', e => { state.canvas.height = parseInt(e.target.value) || 800; renderCanvas(); });

    bindColorInput('bg-color', 'bg-color-text', 'bgColor');
    bindColorInput('text-color', 'text-color-text', 'textColor');
    bindColorInput('border-color', 'border-color-text', 'borderColor');

    $('font-family').addEventListener('change', e => { state.canvas.fontFamily = e.target.value; renderCanvas(); });

    $('border-width').addEventListener('input', e => {
      state.canvas.borderWidth = parseInt(e.target.value);
      $('border-width-value').textContent = e.target.value + 'px';
      renderCanvas();
    });
    $('border-radius').addEventListener('input', e => {
      state.canvas.borderRadius = parseInt(e.target.value);
      $('border-radius-value').textContent = e.target.value + 'px';
      renderCanvas();
    });

    document.querySelectorAll('.sticker').forEach(stk => {
      stk.addEventListener('click', () => {
        const emoji = stk.dataset.sticker;
        const idx = state.canvas.stickers.indexOf(emoji);
        if (idx >= 0) { state.canvas.stickers.splice(idx, 1); stk.classList.remove('active'); }
        else { state.canvas.stickers.push(emoji); stk.classList.add('active'); }
        renderCanvas();
      });
    });

    $('show-safe-area').addEventListener('change', e => {
      state.canvas.showSafeArea = e.target.checked;
      $('safe-area-overlay').classList.toggle('hidden', !e.target.checked);
    });

    $('btn-save-as-template').addEventListener('click', () => {
      showModal(
        '保存为自定义模板',
        `<input type="text" class="input-rename" id="tpl-name-input" placeholder="请输入模板名称" value="自定义模板">
         <div class="modal-actions">
           <button class="btn btn-secondary" data-close>取消</button>
           <button class="btn btn-primary" data-confirm>保存</button>
         </div>`,
        () => {
          const name = $('tpl-name-input').value.trim() || '自定义模板';
          const tpl = {
            id: 'custom-' + Date.now(),
            name,
            category: 'custom',
            icon: '💾',
            bgColor: state.canvas.bgColor,
            accentColor: state.canvas.textColor,
            fontFamily: state.canvas.fontFamily,
            borderWidth: state.canvas.borderWidth,
            borderColor: state.canvas.borderColor,
            borderRadius: state.canvas.borderRadius,
            stickers: [...state.canvas.stickers]
          };
          state.customTemplates.unshift(tpl);
          saveAllState();
          document.querySelector('.category-btn[data-category="custom"]').click();
          showToast('模板已保存：' + name);
        }
      );
      setTimeout(() => {
        const inp = $('tpl-name-input');
        if (inp) inp.focus();
        const close = $('modal-body').querySelector('[data-close]');
        if (close) close.addEventListener('click', () => $('modal-overlay').style.display = 'none');
      }, 50);
    });

    renderBrandColors();
    syncStickerUI();
  }

  function syncStickerUI() {
    document.querySelectorAll('.sticker').forEach(s => {
      s.classList.toggle('active', state.canvas.stickers.includes(s.dataset.sticker));
    });
  }

  function bindColorInput(colorId, textId, stateKey) {
    $(colorId).addEventListener('input', e => {
      state.canvas[stateKey] = e.target.value;
      $(textId).value = e.target.value;
      renderCanvas();
    });
    $(textId).addEventListener('input', e => {
      if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
        state.canvas[stateKey] = e.target.value;
        $(colorId).value = e.target.value;
        renderCanvas();
      }
    });
  }

  function renderBrandColors() {
    const c1 = $('brand-colors');
    const c2 = $('brand-colors-list');
    if (c1) {
      c1.innerHTML = '';
      state.brandColors.forEach(bc => {
        const d = document.createElement('div');
        d.className = 'brand-color-swatch';
        d.style.background = bc.color;
        d.title = bc.name || bc.color;
        d.addEventListener('click', () => {
          state.canvas.bgColor = bc.color;
          $('bg-color').value = bc.color;
          $('bg-color-text').value = bc.color;
          renderCanvas();
          showToast('已应用：' + (bc.name || bc.color));
        });
        c1.appendChild(d);
      });
    }
    if (c2) {
      c2.innerHTML = '';
      if (state.brandColors.length === 0) {
        c2.innerHTML = '<div class="empty-state" style="padding:10px">暂无品牌色</div>';
        return;
      }
      state.brandColors.forEach((bc, i) => {
        const item = document.createElement('div');
        item.className = 'brand-color-item';
        item.innerHTML = `
          <div class="swatch" style="background:${bc.color}"></div>
          <span class="name">${bc.name || bc.color}</span>
          <button class="remove" title="删除">×</button>
        `;
        item.querySelector('.remove').addEventListener('click', () => {
          state.brandColors.splice(i, 1);
          saveAllState();
          renderBrandColors();
        });
        c2.appendChild(item);
      });
    }
  }

  function renderCanvas() {
    const canvas = $('main-canvas');
    const ctx = canvas.getContext('2d');
    const w = state.canvas.width;
    const h = state.canvas.height;
    canvas.width = w;
    canvas.height = h;
    drawDesign(ctx, w, h);
  }

  function drawText(ctx, w, h) {}
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = text.split('');
    let line = '', lines = [];
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = chars[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    lines = lines.slice(0, 2);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function initBatchPanel() {
    renderBatchSizeGrid();
    updateExportNamePreview();

    $('btn-select-all-sizes').addEventListener('click', () => {
      const allOn = Object.values(state.batchSizes).every(s => s.enabled);
      Object.keys(state.batchSizes).forEach(k => state.batchSizes[k].enabled = !allOn);
      renderBatchSizeGrid();
      updateExportNamePreview();
      renderBatchPreviews();
    });

    ['tweak-title-y', 'tweak-price-size', 'tweak-price-y'].forEach(id => {
      const el = $(id);
      const v = $(id + '-val');
      if (!el) return;
      el.addEventListener('input', () => {
        v.textContent = id === 'tweak-price-size' || id === 'tweak-title-y' || id === 'tweak-price-y'
          ? (id === 'tweak-price-size' ? el.value + '%' : el.value + '%')
          : el.value;
      });
    });

    $('btn-apply-tweak')?.addEventListener('click', () => {
      if (!state.activeBatchType) return showToast('请先点击下方预览图选择要微调的规格');
      state.batchTweaks[state.activeBatchType] = {
        titleY: parseInt($('tweak-title-y').value),
        priceSize: parseInt($('tweak-price-size').value),
        priceY: parseInt($('tweak-price-y').value)
      };
      renderBatchPreviews();
      showToast('已应用到：' + state.batchSizes[state.activeBatchType].name);
    });

    $('btn-reset-tweak')?.addEventListener('click', () => {
      if (state.activeBatchType) delete state.batchTweaks[state.activeBatchType];
      $('tweak-title-y').value = 78; $('tweak-title-y-val').textContent = '78%';
      $('tweak-price-size').value = 10; $('tweak-price-size-val').textContent = '10%';
      $('tweak-price-y').value = 68; $('tweak-price-y-val').textContent = '68%';
      renderBatchPreviews();
      showToast('已重置当前规格微调');
    });

    $('export-name-prefix')?.addEventListener('input', updateExportNamePreview);

    $('btn-generate-all').addEventListener('click', () => {
      const enabled = Object.entries(state.batchSizes).filter(([k, s]) => s.enabled);
      if (enabled.length === 0) return showToast('请至少勾选一个规格');
      renderBatchPreviews(true);
      setTimeout(() => {
        enabled.forEach(([type, cfg], i) => {
          setTimeout(() => {
            const prefix = $('export-name-prefix')?.value.trim() || state.product.title?.replace(/[\\/:*?"<>|]/g, '_') || '直播物料';
            const fname = `${prefix}_${cfg.name}_${cfg.width}x${cfg.height}.png`;
            downloadDataUrl(state.batchImages[type], fname);
          }, i * 350);
        });
        addToHistory();
        showToast('已开始下载 ' + enabled.length + ' 张图');
      }, 600);
    });
  }

  function renderBatchSizeGrid() {
    const box = $('batch-size-grid');
    if (!box) return;
    box.innerHTML = '';
    Object.entries(state.batchSizes).forEach(([type, cfg]) => {
      const div = document.createElement('div');
      div.className = 'batch-size-card' + (cfg.enabled ? ' selected' : '') + (state.activeBatchType === type ? ' selected' : '');
      div.innerHTML = `
        <input type="checkbox" ${cfg.enabled ? 'checked' : ''}>
        <div class="batch-size-info">
          <div class="batch-size-name">${cfg.name}</div>
          <div class="batch-size-dim">${cfg.width}×${cfg.height}</div>
        </div>
      `;
      div.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') {
          cfg.enabled = e.target.checked;
          div.classList.toggle('selected', cfg.enabled);
          updateExportNamePreview();
          renderBatchPreviews();
          return;
        }
        state.activeBatchType = type;
        const t = state.batchTweaks[type] || { titleY: 78, priceSize: 10, priceY: 68 };
        $('tweak-title-y').value = t.titleY; $('tweak-title-y-val').textContent = t.titleY + '%';
        $('tweak-price-size').value = t.priceSize; $('tweak-price-size-val').textContent = t.priceSize + '%';
        $('tweak-price-y').value = t.priceY; $('tweak-price-y-val').textContent = t.priceY + '%';
        $('batch-tweaks-section').style.display = 'flex';
        renderBatchSizeGrid();
        renderBatchPreviews();
      });
      box.appendChild(div);
    });
  }

  function updateExportNamePreview() {
    const box = $('export-preview');
    if (!box) return;
    const prefix = $('export-name-prefix')?.value.trim() || state.product.title?.replace(/[\\/:*?"<>|]/g, '_') || '直播物料';
    const list = Object.entries(state.batchSizes).filter(([k, s]) => s.enabled);
    if (list.length === 0) {
      box.innerHTML = '<div style="color:#999">请先勾选规格</div>';
      return;
    }
    box.innerHTML = list.map(([type, cfg]) => `
      <div class="export-preview-item">
        <span>${cfg.name}</span>
        <span style="font-family:monospace;color:#667eea">${prefix}_${cfg.name}_${cfg.width}x${cfg.height}.png</span>
      </div>
    `).join('');
  }

  function renderBatchPreviews(force = false) {
    const grid = $('batch-preview-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const list = Object.entries(state.batchSizes).filter(([k, s]) => s.enabled);
    if (list.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="padding:20px">请先勾选上方规格</div>';
      return;
    }
    list.forEach(([type, cfg]) => {
      const item = document.createElement('div');
      item.className = 'batch-preview-item' + (state.activeBatchType === type ? ' active' : '');
      item.style.cursor = 'pointer';
      if (state.activeBatchType === type) {
        item.style.border = '2px solid #667eea';
        item.style.borderRadius = '8px';
        item.style.padding = '4px';
      }

      const canvas = document.createElement('canvas');
      canvas.width = cfg.width;
      canvas.height = cfg.height;
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';

      const ctx = canvas.getContext('2d');
      const tweaks = state.batchTweaks[type] || {};
      drawDesign(ctx, cfg.width, cfg.height, {
        tweaks,
        onComplete: () => {
          state.batchImages[type] = canvas.toDataURL('image/png');
        }
      });

      const label = document.createElement('div');
      label.className = 'batch-preview-label';
      const tweakBadge = state.batchTweaks[type] ? ' <span style="color:#f39c12">✓ 已微调</span>' : '';
      label.innerHTML = cfg.name + ' ' + cfg.width + '×' + cfg.height + tweakBadge;
      item.appendChild(canvas);
      item.appendChild(label);
      item.addEventListener('click', () => {
        state.activeBatchType = type;
        const t = state.batchTweaks[type] || { titleY: 78, priceSize: 10, priceY: 68 };
        $('tweak-title-y').value = t.titleY; $('tweak-title-y-val').textContent = t.titleY + '%';
        $('tweak-price-size').value = t.priceSize; $('tweak-price-size-val').textContent = t.priceSize + '%';
        $('tweak-price-y').value = t.priceY; $('tweak-price-y-val').textContent = t.priceY + '%';
        $('batch-tweaks-section').style.display = 'flex';
        renderBatchSizeGrid();
        renderBatchPreviews();
      });
      grid.appendChild(item);
    });
  }

  function initPreviewPanel() {
    document.querySelectorAll('.device-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $('device-frame').className = 'device-frame ' + btn.dataset.device;
      });
    });
  }

  function updatePreviewImages() {
    const dataUrl = $('main-canvas').toDataURL('image/png');
    if ($('simulated-cover')) $('simulated-cover').src = dataUrl;
    if (state.batchImages.corner && $('simulated-corner')) {
      $('simulated-corner').src = state.batchImages.corner;
    }
    if (state.batchImages.banner && $('simulated-banner')) {
      $('simulated-banner').src = state.batchImages.banner;
    }
  }

  function initExportPanel() {
    $('btn-copy-image').addEventListener('click', async () => {
      try {
        $('main-canvas').toBlob(async blob => {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          showToast('图片已复制');
        });
      } catch (e) { showToast('复制失败：' + e.message); }
    });

    $('btn-download-current').addEventListener('click', () => {
      downloadCanvas($('main-canvas'), generateFileName('封面'));
      addToHistory();
    });

    $('btn-download-all').addEventListener('click', () => {
      renderBatchPreviews(true);
      setTimeout(() => {
        Object.entries(state.batchSizes).filter(([k, s]) => s.enabled).forEach(([type, cfg], i) => {
          if (!state.batchImages[type]) return;
          setTimeout(() => {
            downloadDataUrl(state.batchImages[type], generateFileName(cfg.name));
          }, i * 300);
        });
        addToHistory();
        showToast('套图下载已开始');
      }, 500);
    });

    $('btn-add-brand-color').addEventListener('click', () => {
      const color = $('new-brand-color').value;
      const name = $('new-brand-color-name').value.trim();
      if (!color) return showToast('请选择颜色');
      state.brandColors.push({ color, name });
      saveAllState();
      renderBrandColors();
      $('new-brand-color-name').value = '';
      showToast('品牌色已保存');
    });

    $('btn-clear-history').addEventListener('click', () => {
      if (!confirm('确定清空所有历史？')) return;
      state.history = [];
      state.selectedHistoryIds = [];
      saveAllState();
      renderHistory();
    });

    $('btn-compare-history').addEventListener('click', () => {
      if (state.selectedHistoryIds.length !== 2) return showToast('请勾选 2 个版本');
      const a = state.history.find(h => h.id === state.selectedHistoryIds[0]);
      const b = state.history.find(h => h.id === state.selectedHistoryIds[1]);
      if (!a || !b) return;
      showCompareModal(a, b);
    });

    $('btn-generate-share').addEventListener('click', () => {
      try {
        const code = serializeShareConfig();
        $('share-link').value = SHARE_PREFIX + code;
        showToast('分享码已生成');
      } catch (e) { showToast('生成失败：' + e.message); }
    });

    $('btn-copy-share').addEventListener('click', () => {
      const v = $('share-link').value;
      if (!v) return showToast('请先生成');
      navigator.clipboard.writeText(v).then(() => showToast('已复制'));
    });

    $('btn-import-share').addEventListener('click', () => {
      const raw = $('import-code').value.trim();
      if (!raw) return showToast('请粘贴分享码');
      try {
        deserializeShareConfig(raw);
        showToast('配置已恢复，可继续编辑');
      } catch (e) { showToast('导入失败：' + e.message); }
    });

    $('btn-export-pack')?.addEventListener('click', exportTeamPack);
    $('btn-import-pack')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            importTeamPack(JSON.parse(ev.target.result));
          } catch (err) { showToast('导入失败：文件格式错误'); }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }

  function exportTeamPack() {
    const name = $('team-pack-name')?.value.trim() || ('素材包_' + new Date().toISOString().slice(0, 10));
    const pack = {
      v: 2,
      type: 'team-pack',
      name,
      exportTime: new Date().toLocaleString('zh-CN'),
      brandColors: $('pack-brand')?.checked ? [...state.brandColors] : [],
      customTemplates: $('pack-templates')?.checked ? [...state.customTemplates] : [],
      favoriteTemplateIds: $('pack-templates')?.checked ? [...state.favoriteTemplates] : [],
      stickers: $('pack-stickers')?.checked ? [...state.canvas.stickers] : [],
      products: $('pack-products')?.checked ? state.recentProducts.filter(p => p.isCard).map(p => ({ ...p })) : [],
      currentConfig: $('pack-current')?.checked ? {
        product: { ...state.product },
        canvas: { ...state.canvas },
        template: state.selectedTemplate ? { id: state.selectedTemplate.id, isCustom: state.selectedTemplate.category === 'custom' } : null
      } : null
    };
    const json = JSON.stringify(pack, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name.replace(/[\\/:*?"<>|]/g, '_') + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast('素材包已导出：' + name);
  }

  function importTeamPack(pack) {
    if (!pack || pack.type !== 'team-pack') return showToast('文件不是有效的团队素材包');
    let summary = [];
    if (pack.brandColors && pack.brandColors.length) {
      pack.brandColors.forEach(bc => {
        if (!state.brandColors.find(x => x.color === bc.color)) state.brandColors.push(bc);
      });
      summary.push('🎨 品牌色 ' + pack.brandColors.length + ' 个');
    }
    if (pack.customTemplates && pack.customTemplates.length) {
      pack.customTemplates.forEach(tpl => {
        if (!state.customTemplates.find(t => t.id === tpl.id)) state.customTemplates.push(tpl);
      });
      summary.push('📋 自定义模板 ' + pack.customTemplates.length + ' 个');
    }
    if (pack.favoriteTemplateIds && pack.favoriteTemplateIds.length) {
      pack.favoriteTemplateIds.forEach(id => {
        if (!state.favoriteTemplates.includes(id)) state.favoriteTemplates.push(id);
      });
    }
    if (pack.stickers && pack.stickers.length) {
      pack.stickers.forEach(s => {
        if (!state.canvas.stickers.includes(s)) state.canvas.stickers.push(s);
      });
      summary.push('🏷️ 贴纸 ' + pack.stickers.length + ' 个');
      syncStickerUI();
    }
    if (pack.products && pack.products.length) {
      pack.products.forEach(p => {
        if (!state.recentProducts.find(r => r.id === p.id)) state.recentProducts.push(p);
      });
      if (state.recentProducts.length > 30) state.recentProducts = state.recentProducts.slice(0, 30);
      summary.push('💳 商品卡片 ' + pack.products.length + ' 个');
    }
    if (pack.currentConfig) {
      if (pack.currentConfig.product) Object.assign(state.product, pack.currentConfig.product);
      if (pack.currentConfig.canvas) Object.assign(state.canvas, pack.currentConfig.canvas);
      if (pack.currentConfig.template) {
        let tpl = templates.find(t => t.id === pack.currentConfig.template.id);
        if (!tpl) tpl = state.customTemplates.find(t => t.id === pack.currentConfig.template.id);
        if (tpl) state.selectedTemplate = tpl;
      }
      updateProductForm();
      syncCanvasControls();
      syncStickerUI();
      summary.push('🖼️ 当前画布配置已恢复');
    }
    saveAllState();
    renderBrandColors();
    renderFavoriteTemplates();
    renderRecentProducts();
    renderCanvas();
    showModal('导入成功', `
      <div style="font-size:13px;color:#333;margin-bottom:10px">
        素材包「<b>${pack.name}</b>」导入完成：
      </div>
      <ul class="compare-summary-list" style="margin-left:0">
        ${summary.map(s => '<li>' + s + '</li>').join('')}
      </ul>
      <div class="modal-actions">
        <button class="btn btn-primary" data-confirm>确定</button>
      </div>
    `, null, true);
  }

  function serializeShareConfig() {
    const payload = {
      v: 1,
      product: {
        title: state.product.title,
        price: state.product.price,
        originalPrice: state.product.originalPrice,
        imageUrl: state.product.imageUrl,
        tags: [...state.product.tags]
      },
      canvas: { ...state.canvas },
      template: state.selectedTemplate
        ? { id: state.selectedTemplate.id, isCustom: state.selectedTemplate.category === 'custom' }
        : null,
      brandColors: [...state.brandColors],
      stickers: [...state.canvas.stickers]
    };
    let data = JSON.stringify(payload);
    try {
      if (state.product.imageData && state.product.imageData.length < 300000) {
        const withImg = JSON.stringify({ ...payload, _img: state.product.imageData });
        if (withImg.length < 500000) data = withImg;
      }
    } catch (e) {}
    const bytes = new TextEncoder().encode(data);
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
  }

  function deserializeShareConfig(raw) {
    let code = raw.trim();
    if (code.startsWith(SHARE_PREFIX)) code = code.slice(SHARE_PREFIX.length);
    if (code.startsWith('live-design://share?data=')) code = code.split('data=')[1] || '';
    const bin = atob(code);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json);

    if (payload.product) {
      state.product.title = payload.product.title || '';
      state.product.price = payload.product.price || '';
      state.product.originalPrice = payload.product.originalPrice || '';
      state.product.imageUrl = payload.product.imageUrl || '';
      state.product.tags = payload.product.tags || [];
      if (payload._img) state.product.imageData = payload._img;
    }
    if (payload.canvas) {
      Object.assign(state.canvas, payload.canvas);
      if (payload.stickers) state.canvas.stickers = payload.stickers;
    }
    if (payload.template) {
      let tpl = templates.find(t => t.id === payload.template.id);
      if (!tpl) tpl = state.customTemplates.find(t => t.id === payload.template.id);
      if (tpl) state.selectedTemplate = tpl;
    }
    if (payload.brandColors && payload.brandColors.length) {
      payload.brandColors.forEach(bc => {
        if (!state.brandColors.find(x => x.color === bc.color)) {
          state.brandColors.push(bc);
        }
      });
    }

    saveAllState();
    updateProductForm();
    syncCanvasControls();
    syncStickerUI();
    renderBrandColors();
    renderCanvas();
  }

  function generateFileName(prefix) {
    const d = new Date();
    const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
    return `${prefix}_${ts}.png`;
  }

  function downloadCanvas(canvas, filename) {
    const a = document.createElement('a');
    a.download = filename;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }
  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.download = filename;
    a.href = dataUrl;
    a.click();
  }

  function addToHistory(sourceId) {
    const thumb = $('main-canvas').toDataURL('image/png');
    const entry = {
      id: Date.now(),
      thumb,
      title: state.product.title || '未命名物料',
      template: state.selectedTemplate?.name || '自定义',
      time: new Date().toLocaleString('zh-CN'),
      product: JSON.parse(JSON.stringify(state.product)),
      canvas: JSON.parse(JSON.stringify(state.canvas)),
      templateId: state.selectedTemplate?.id,
      templateIsCustom: state.selectedTemplate?.category === 'custom',
      sourceId: sourceId || null
    };
    state.history.unshift(entry);
    if (state.history.length > 100) state.history = state.history.slice(0, 100);
    saveAllState();
    renderHistory();
  }

  function toggleHistorySelect(id) {
    const i = state.selectedHistoryIds.indexOf(id);
    if (i >= 0) state.selectedHistoryIds.splice(i, 1);
    else {
      if (state.selectedHistoryIds.length >= 2) state.selectedHistoryIds.shift();
      state.selectedHistoryIds.push(id);
    }
    $('btn-compare-history').disabled = state.selectedHistoryIds.length !== 2;
    renderHistory();
  }

  function renderHistory() {
    const box = $('history-list');
    if (!box) return;
    box.innerHTML = '';
    if (state.history.length === 0) {
      box.innerHTML = '<div class="empty-state">暂无历史记录</div>';
      return;
    }
    state.history.forEach((item, idx) => {
      const el = document.createElement('div');
      const selected = state.selectedHistoryIds.includes(item.id);
      el.className = 'history-item has-checkbox' + (selected ? ' selected' : '');
      const srcItem = item.sourceId ? state.history.find(h => h.id === item.sourceId) : null;
      const srcTag = item.sourceId
        ? (srcItem
            ? `<span class="history-source-tag" title="来源：${srcItem.title}">分支自：${srcItem.title.slice(0, 8)}${srcItem.title.length > 8 ? '…' : ''}</span>`
            : `<span class="history-branch-tag">源自历史版本</span>`)
        : '';
      el.innerHTML = `
        <div class="history-item-checkbox-wrapper">
          <input type="checkbox" class="history-item-checkbox" ${selected ? 'checked' : ''} title="勾选用于对比">
        </div>
        <img class="history-thumb" src="${item.thumb}" alt="">
        <div class="history-info">
          <div class="history-title">${item.title}${srcTag}</div>
          <div class="history-time">${item.template} · ${item.time}</div>
          <div class="history-item-action">
            <button data-act="rename" title="重命名">✏️改名</button>
            <button data-act="restore" title="恢复版本">↩️恢复</button>
            <button data-act="duplicate" title="复制为新版本并继续编辑">📋复制</button>
            <button data-act="fav" title="存为常用模板">⭐存模板</button>
            <button data-act="del" title="删除">🗑️</button>
          </div>
        </div>
      `;
      el.querySelector('.history-item-checkbox').addEventListener('click', e => {
        e.stopPropagation();
        toggleHistorySelect(item.id);
      });
      el.querySelector('[data-act="rename"]').addEventListener('click', e => {
        e.stopPropagation();
        showModal('重命名版本',
          `<input type="text" class="input-rename" id="rename-input" value="${item.title}">
           <div class="modal-actions">
             <button class="btn btn-secondary" data-close>取消</button>
             <button class="btn btn-primary" data-confirm>保存</button>
           </div>`,
          () => {
            const v = $('rename-input').value.trim();
            if (!v) return showToast('名称不能为空');
            item.title = v;
            saveAllState();
            renderHistory();
            showToast('已保存');
          }
        );
        setTimeout(() => {
          const inp = $('rename-input'); if (inp) inp.focus();
          const c = $('modal-body').querySelector('[data-close]');
          if (c) c.addEventListener('click', () => $('modal-overlay').style.display = 'none');
        }, 50);
      });
      el.querySelector('[data-act="restore"]').addEventListener('click', e => {
        e.stopPropagation();
        restoreHistoryItem(item);
      });
      el.querySelector('[data-act="duplicate"]').addEventListener('click', e => {
        e.stopPropagation();
        restoreHistoryItem(item);
        const origId = item.id;
        setTimeout(() => {
          addToHistory(origId);
          showToast('已复制为分支版本，可继续编辑');
        }, 50);
      });
      el.querySelector('[data-act="fav"]').addEventListener('click', e => {
        e.stopPropagation();
        showModal('存为常用模板',
          `<input type="text" class="input-rename" id="fav-input" value="${item.title}">
           <div class="modal-actions">
             <button class="btn btn-secondary" data-close>取消</button>
             <button class="btn btn-primary" data-confirm>保存</button>
           </div>`,
          () => {
            const name = $('fav-input').value.trim() || item.title;
            const tpl = {
              id: 'custom-' + Date.now(),
              name,
              category: 'custom',
              icon: '💾',
              bgColor: item.canvas.bgColor,
              accentColor: item.canvas.textColor,
              fontFamily: item.canvas.fontFamily,
              borderWidth: item.canvas.borderWidth,
              borderColor: item.canvas.borderColor,
              borderRadius: item.canvas.borderRadius,
              stickers: [...(item.canvas.stickers || [])]
            };
            state.customTemplates.unshift(tpl);
            state.favoriteTemplates.push(tpl.id);
            saveAllState();
            renderFavoriteTemplates();
            showToast('已存为常用模板');
          }
        );
        setTimeout(() => {
          const inp = $('fav-input'); if (inp) inp.focus();
          const c = $('modal-body').querySelector('[data-close]');
          if (c) c.addEventListener('click', () => $('modal-overlay').style.display = 'none');
        }, 50);
      });
      el.querySelector('[data-act="del"]').addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm('删除此历史版本？')) return;
        state.history.splice(idx, 1);
        state.selectedHistoryIds = state.selectedHistoryIds.filter(x => x !== item.id);
        saveAllState();
        renderHistory();
      });
      el.addEventListener('click', () => restoreHistoryItem(item));
      box.appendChild(el);
    });
    $('btn-compare-history').disabled = state.selectedHistoryIds.length !== 2;
  }

  function restoreHistoryItem(item) {
    state.product = JSON.parse(JSON.stringify(item.product));
    state.canvas = JSON.parse(JSON.stringify(item.canvas));
    if (item.templateId) {
      let tpl = templates.find(t => t.id === item.templateId);
      if (!tpl) tpl = state.customTemplates.find(t => t.id === item.templateId);
      state.selectedTemplate = tpl || null;
    } else {
      state.selectedTemplate = null;
    }
    updateProductForm();
    syncCanvasControls();
    syncStickerUI();
    renderCanvas();
    showToast('已恢复：' + item.title);
  }

  function showCompareModal(a, b) {
    const fields = [
      { label: '标题', path: 'product.title' },
      { label: '现价', path: 'product.price' },
      { label: '原价', path: 'product.originalPrice' },
      { label: '标签', path: 'product.tags', fmt: v => (v || []).join(',') || '-' },
      { label: '尺寸', path: 'canvas', fmt: v => v ? v.width + '×' + v.height : '-' },
      { label: '背景色', path: 'canvas.bgColor' },
      { label: '文字色', path: 'canvas.textColor' },
      { label: '边框色', path: 'canvas.borderColor' },
      { label: '边框宽', path: 'canvas.borderWidth', fmt: v => v + 'px' },
      { label: '圆角', path: 'canvas.borderRadius', fmt: v => v + 'px' },
      { label: '字体', path: 'canvas.fontFamily', fmt: v => (v || '').split(',')[0].replace(/'/g, '') },
      { label: '贴纸', path: 'canvas.stickers', fmt: v => (v || []).join(' ') || '-' },
      { label: '模板', path: 'template', fmt: v => v || '自定义' }
    ];
    const get = (obj, path, fmt) => {
      const parts = path.split('.');
      let v = obj;
      for (const p of parts) { if (v == null) return '-'; v = v[p]; }
      if (fmt) return fmt(v);
      return v == null || v === '' ? '-' : String(v);
    };
    const fa = JSON.parse(JSON.stringify(a));
    const fb = JSON.parse(JSON.stringify(b));
    const diffs = [];
    let rowsHtml = '';
    fields.forEach(f => {
      const va = get(fa, f.path, f.fmt);
      const vb = get(fb, f.path, f.fmt);
      const diff = va !== vb;
      if (diff) diffs.push(f);
      rowsHtml += `
        <div class="compare-item ${diff ? 'different' : ''}">
          <div class="compare-label">${f.label}</div>
          <div class="compare-value compare-value-a" title="${va}">${va}</div>
          <div class="compare-value compare-value-b" title="${vb}">${vb}</div>
        </div>
      `;
    });
    const summaryItems = [];
    if (diffs.length === 0) {
      summaryItems.push('两个版本参数完全相同');
    } else {
      diffs.forEach(f => summaryItems.push(`${f.label}：「${get(fa, f.path, f.fmt)}」 → 「${get(fb, f.path, f.fmt)}」`));
    }
    showModal('版本对比', `
      <div class="compare-side-by-side">
        <div class="compare-side-box">
          <img src="${a.thumb}" alt="">
          <div class="compare-side-label">A：${a.title}</div>
        </div>
        <div class="compare-side-box">
          <img src="${b.thumb}" alt="">
          <div class="compare-side-label">B：${b.title}</div>
        </div>
      </div>
      <div class="compare-summary">
        <div class="compare-summary-title">📊 主要变化（${diffs.length} 处差异）</div>
        <ul class="compare-summary-list">
          ${summaryItems.map(s => '<li>' + s + '</li>').join('')}
        </ul>
      </div>
      <div class="compare-section">${rowsHtml}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-close>关闭</button>
      </div>
    `, null, true);
    setTimeout(() => {
      const c = $('modal-body').querySelector('[data-close]');
      if (c) c.addEventListener('click', () => $('modal-overlay').style.display = 'none');
    }, 50);
  }

  function syncCanvasControls() {
    const c = state.canvas;
    $('bg-color').value = c.bgColor;
    $('bg-color-text').value = c.bgColor;
    $('text-color').value = c.textColor;
    $('text-color-text').value = c.textColor;
    $('font-family').value = c.fontFamily;
    $('border-width').value = c.borderWidth;
    $('border-width-value').textContent = c.borderWidth + 'px';
    $('border-color').value = c.borderColor;
    $('border-color-text').value = c.borderColor;
    $('border-radius').value = c.borderRadius;
    $('border-radius-value').textContent = c.borderRadius + 'px';
    $('show-safe-area').checked = c.showSafeArea;
    $('safe-area-overlay').classList.toggle('hidden', !c.showSafeArea);
    if (c.width === 800 && c.height === 800) {
      $('canvas-size').value = '800x800';
      $('custom-size-inputs').style.display = 'none';
    } else {
      const preset = document.querySelector(`#canvas-size option[value="${c.width}x${c.height}"]`);
      if (preset) {
        $('canvas-size').value = c.width + 'x' + c.height;
        $('custom-size-inputs').style.display = 'none';
      } else {
        $('canvas-size').value = 'custom';
        $('custom-size-inputs').style.display = 'flex';
      }
    }
    $('canvas-width').value = c.width;
    $('canvas-height').value = c.height;
  }

  function init() {
    loadAllState();
    initTabs();
    initProductPanel();
    initTemplatePanel();
    initCanvasPanel();
    initBatchPanel();
    initPreviewPanel();
    initExportPanel();

    state.product.title = '【爆款推荐】时尚百搭休闲商品';
    state.product.price = '¥99';
    state.product.originalPrice = '¥199';
    state.product.tags = ['秒杀'];
    updateProductForm();
    renderCanvas();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
