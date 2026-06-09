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
    favoriteTemplates: [],
    brandColors: [],
    history: [],
    batchImages: {}
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

  function $(id) { return document.getElementById(id); }

  function showToast(msg, duration = 2000) {
    const toast = $('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  }

  function saveState() {
    chrome.storage.local.set({
      favoriteTemplates: state.favoriteTemplates,
      brandColors: state.brandColors,
      history: state.history.slice(0, 50)
    });
  }

  function loadState() {
    chrome.storage.local.get(['favoriteTemplates', 'brandColors', 'history'], (data) => {
      if (data.favoriteTemplates) state.favoriteTemplates = data.favoriteTemplates;
      if (data.brandColors) state.brandColors = data.brandColors;
      if (data.history) state.history = data.history;
      renderBrandColors();
      renderFavoriteTemplates();
      renderHistory();
    });
  }

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panelId = 'panel-' + btn.dataset.panel;
        $(panelId).classList.add('active');
        if (btn.dataset.panel === 'batch') renderBatchPreviews();
        if (btn.dataset.panel === 'preview') updatePreviewImages();
      });
    });
  }

  function initProductPanel() {
    $('btn-scrape').addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          showToast('无法获取当前标签页');
          return;
        }
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
          updateProductForm();
          renderCanvas();
          showToast('商品信息抓取成功！');
        } else {
          showToast('未找到商品信息，请手动输入');
        }
      } catch (e) {
        showToast('抓取失败：' + e.message);
      }
    });

    $('btn-manual').addEventListener('click', () => {
      state.product.title = $('product-title').value;
      state.product.price = $('product-price').value;
      state.product.originalPrice = $('product-original-price').value;
      state.product.imageUrl = $('product-image-url').value;
      if (state.product.imageUrl) {
        loadImageFromUrl(state.product.imageUrl);
      }
      renderCanvas();
      showToast('商品信息已更新');
    });

    ['product-title', 'product-price', 'product-original-price'].forEach(id => {
      $(id).addEventListener('input', () => {
        state.product[id.replace('product-', '').replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = $(id).value;
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
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            state.product.imageData = ev.target.result;
            state.product.imageUrl = '';
            const preview = $('image-preview');
            preview.innerHTML = '<img src="' + ev.target.result + '" alt="商品图">';
            renderCanvas();
          };
          reader.readAsDataURL(file);
        }
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
    const result = { title: '', price: '', originalPrice: '', imageUrl: '' };
    const titleSelectors = ['h1', '.title', '.product-title', '[class*="title"]', 'title'];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        result.title = el.textContent.trim().slice(0, 50);
        break;
      }
    }
    const priceSelectors = ['.price', '.product-price', '[class*="price"]', '[data-price]'];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        result.price = el.textContent.trim().match(/[¥￥]?\s*\d+(\.\d{1,2})?/)?.[0] || el.textContent.trim();
        break;
      }
    }
    const imgSelectors = ['img.product-image', 'img[class*="product"]', '.main-image img', '#main-image img'];
    for (const sel of imgSelectors) {
      const el = document.querySelector(sel);
      if (el && el.src) {
        result.imageUrl = el.src;
        break;
      }
    }
    if (!result.imageUrl) {
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg) result.imageUrl = ogImg.content;
    }
    return result;
  }

  function loadImageFromUrl(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      state.product.imageData = url;
      const preview = $('image-preview');
      preview.innerHTML = '<img src="' + url + '" alt="商品图">';
      renderCanvas();
    };
    img.onerror = () => {
      showToast('图片加载失败，请检查URL');
    };
    img.src = url;
  }

  function updateProductForm() {
    $('product-title').value = state.product.title;
    $('product-price').value = state.product.price;
    $('product-original-price').value = state.product.originalPrice;
    $('product-image-url').value = state.product.imageUrl;
    if (state.product.imageData || state.product.imageUrl) {
      const src = state.product.imageData || state.product.imageUrl;
      $('image-preview').innerHTML = '<img src="' + src + '" alt="商品图">';
    }
  }

  function initTemplatePanel() {
    const grid = $('template-grid');
    grid.innerHTML = '';
    templates.forEach(tpl => {
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
      `;
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('template-fav')) return;
        document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.selectedTemplate = tpl;
        state.canvas.bgColor = tpl.bgColor;
        state.canvas.textColor = tpl.accentColor;
        $('bg-color').value = tpl.bgColor;
        $('bg-color-text').value = tpl.bgColor;
        $('text-color').value = tpl.accentColor;
        $('text-color-text').value = tpl.accentColor;
        renderCanvas();
        showToast('已选择模板：' + tpl.name);
      });
      const favBtn = card.querySelector('.template-fav');
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = favBtn.dataset.id;
        const idx = state.favoriteTemplates.indexOf(id);
        if (idx >= 0) {
          state.favoriteTemplates.splice(idx, 1);
          favBtn.classList.remove('active');
          favBtn.textContent = '☆';
        } else {
          state.favoriteTemplates.push(id);
          favBtn.classList.add('active');
          favBtn.textContent = '★';
        }
        saveState();
        renderFavoriteTemplates();
      });
      grid.appendChild(card);
    });

    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.category;
        document.querySelectorAll('.template-card').forEach(card => {
          const tpl = templates.find(t => t.id === card.dataset.id);
          card.style.display = (cat === 'all' || tpl.category === cat) ? '' : 'none';
        });
      });
    });

    renderFavoriteTemplates();
  }

  function renderFavoriteTemplates() {
    const container = $('favorite-templates');
    if (!container) return;
    container.innerHTML = '';
    if (state.favoriteTemplates.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无常用模板，点击模板右上角★添加</div>';
      return;
    }
    state.favoriteTemplates.forEach(id => {
      const tpl = templates.find(t => t.id === id);
      if (!tpl) return;
      const card = document.createElement('div');
      card.className = 'template-card';
      card.dataset.id = tpl.id;
      card.innerHTML = `
        <div class="template-thumb" style="background: linear-gradient(135deg, ${tpl.bgColor}, ${adjustColor(tpl.bgColor, -30)})">
          <span style="font-size:28px">${tpl.icon}</span>
        </div>
        <div class="template-info">
          <div class="template-name" style="font-size:11px">${tpl.name}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        state.selectedTemplate = tpl;
        state.canvas.bgColor = tpl.bgColor;
        state.canvas.textColor = tpl.accentColor;
        $('bg-color').value = tpl.bgColor;
        $('bg-color-text').value = tpl.bgColor;
        $('text-color').value = tpl.accentColor;
        $('text-color-text').value = tpl.accentColor;
        renderCanvas();
        showToast('已套用：' + tpl.name);
      });
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

    $('canvas-width').addEventListener('input', (e) => {
      state.canvas.width = parseInt(e.target.value) || 800;
      renderCanvas();
    });
    $('canvas-height').addEventListener('input', (e) => {
      state.canvas.height = parseInt(e.target.value) || 800;
      renderCanvas();
    });

    bindColorInput('bg-color', 'bg-color-text', 'bgColor');
    bindColorInput('text-color', 'text-color-text', 'textColor');
    bindColorInput('border-color', 'border-color-text', 'borderColor');

    $('font-family').addEventListener('change', (e) => {
      state.canvas.fontFamily = e.target.value;
      renderCanvas();
    });

    $('border-width').addEventListener('input', (e) => {
      state.canvas.borderWidth = parseInt(e.target.value);
      $('border-width-value').textContent = e.target.value + 'px';
      renderCanvas();
    });

    $('border-radius').addEventListener('input', (e) => {
      state.canvas.borderRadius = parseInt(e.target.value);
      $('border-radius-value').textContent = e.target.value + 'px';
      renderCanvas();
    });

    document.querySelectorAll('.sticker').forEach(stk => {
      stk.addEventListener('click', () => {
        const emoji = stk.dataset.sticker;
        const idx = state.canvas.stickers.indexOf(emoji);
        if (idx >= 0) {
          state.canvas.stickers.splice(idx, 1);
          stk.classList.remove('active');
        } else {
          state.canvas.stickers.push(emoji);
          stk.classList.add('active');
        }
        renderCanvas();
      });
    });

    $('show-safe-area').addEventListener('change', (e) => {
      state.canvas.showSafeArea = e.target.checked;
      $('safe-area-overlay').classList.toggle('hidden', !e.target.checked);
    });

    renderBrandColors();
  }

  function bindColorInput(colorId, textId, stateKey) {
    $(colorId).addEventListener('input', (e) => {
      state.canvas[stateKey] = e.target.value;
      $(textId).value = e.target.value;
      renderCanvas();
    });
    $(textId).addEventListener('input', (e) => {
      if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
        state.canvas[stateKey] = e.target.value;
        $(colorId).value = e.target.value;
        renderCanvas();
      }
    });
  }

  function renderBrandColors() {
    const containers = [ $('brand-colors'), $('brand-colors-list') ];
    containers.forEach((container, ci) => {
      if (!container) return;
      container.innerHTML = '';
      if (ci === 0) {
        if (state.brandColors.length === 0) return;
        state.brandColors.forEach(bc => {
          const swatch = document.createElement('div');
          swatch.className = 'brand-color-swatch';
          swatch.style.background = bc.color;
          swatch.title = bc.name || bc.color;
          swatch.addEventListener('click', () => {
            state.canvas.bgColor = bc.color;
            $('bg-color').value = bc.color;
            $('bg-color-text').value = bc.color;
            renderCanvas();
            showToast('已应用：' + (bc.name || bc.color));
          });
          container.appendChild(swatch);
        });
      } else {
        if (state.brandColors.length === 0) {
          container.innerHTML = '<div class="empty-state" style="padding:10px">暂无品牌色，添加后可快速选用</div>';
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
            saveState();
            renderBrandColors();
          });
          container.appendChild(item);
        });
      }
    });
  }

  function renderCanvas() {
    const canvas = $('main-canvas');
    const ctx = canvas.getContext('2d');
    const w = state.canvas.width;
    const h = state.canvas.height;
    canvas.width = w;
    canvas.height = h;

    roundRect(ctx, 0, 0, w, h, state.canvas.borderRadius);
    ctx.fillStyle = state.canvas.bgColor;
    ctx.fill();

    if (state.canvas.borderWidth > 0) {
      ctx.strokeStyle = state.canvas.borderColor;
      ctx.lineWidth = state.canvas.borderWidth;
      roundRect(ctx, state.canvas.borderWidth / 2, state.canvas.borderWidth / 2,
        w - state.canvas.borderWidth, h - state.canvas.borderWidth,
        Math.max(0, state.canvas.borderRadius - state.canvas.borderWidth / 2));
      ctx.stroke();
    }

    const tpl = state.selectedTemplate;
    if (tpl) {
      ctx.fillStyle = tpl.accentColor;
      ctx.font = `bold ${Math.floor(w * 0.2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(tpl.icon, w / 2, h * 0.25);
    }

    if (state.product.imageData) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const imgW = w * 0.6;
        const imgH = imgW;
        const ix = (w - imgW) / 2;
        const iy = h * 0.15;
        ctx.save();
        roundRect(ctx, ix, iy, imgW, imgH, 12);
        ctx.clip();
        ctx.drawImage(img, ix, iy, imgW, imgH);
        ctx.restore();
        drawText(ctx, w, h);
      };
      img.onerror = () => drawText(ctx, w, h);
      img.src = state.product.imageData;
    } else {
      drawText(ctx, w, h);
    }

    state.canvas.stickers.forEach((emoji, i) => {
      ctx.font = `${Math.floor(w * 0.08)}px sans-serif`;
      ctx.textAlign = 'center';
      const x = w * 0.15 + (i % 5) * w * 0.18;
      const y = h * 0.9;
      ctx.fillText(emoji, x, y);
    });

    if (state.product.tags.length > 0) {
      ctx.font = `bold ${Math.floor(w * 0.035)}px ${state.canvas.fontFamily}`;
      let tagY = h * 0.08;
      state.product.tags.forEach((tag, i) => {
        const tagW = ctx.measureText(tag).width + w * 0.04;
        const tagX = w * 0.06;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        roundRect(ctx, tagX, tagY + i * (w * 0.06), tagW, w * 0.05, w * 0.025);
        ctx.fill();
        ctx.fillStyle = state.canvas.bgColor;
        ctx.textAlign = 'left';
        ctx.fillText(tag, tagX + w * 0.02, tagY + i * (w * 0.06) + w * 0.035);
      });
    }
  }

  function drawText(ctx, w, h) {
    ctx.fillStyle = state.canvas.textColor;
    ctx.textAlign = 'center';

    if (state.product.title) {
      ctx.font = `bold ${Math.floor(w * 0.05)}px ${state.canvas.fontFamily}`;
      wrapText(ctx, state.product.title, w / 2, h * 0.78, w * 0.85, w * 0.06);
    }

    if (state.product.price) {
      ctx.font = `bold ${Math.floor(w * 0.1)}px ${state.canvas.fontFamily}`;
      ctx.fillStyle = state.canvas.textColor;
      ctx.fillText(state.product.price, w / 2, h * 0.68);
    }

    if (state.product.originalPrice) {
      ctx.font = `${Math.floor(w * 0.035)}px ${state.canvas.fontFamily}`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(state.product.originalPrice, w / 2, h * 0.58);
    }
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = text.split('');
    let line = '';
    let lines = [];
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
    lines.forEach((l, i) => {
      ctx.fillText(l, x, y + i * lineHeight);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
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
    $('btn-generate-all').addEventListener('click', () => {
      renderBatchPreviews(true);
      addToHistory();
      showToast('批量生成完成！');
    });

    document.querySelectorAll('.batch-checkbox').forEach(cb => {
      cb.addEventListener('change', renderBatchPreviews);
    });
  }

  function getBatchConfigs() {
    return {
      cover: { name: '直播封面', width: 800, height: 800 },
      corner: { name: '直播间角标', width: 200, height: 200 },
      banner: { name: '横幅海报', width: 1920, height: 1080 },
      danmu: { name: '弹幕贴图', width: 600, height: 150 }
    };
  }

  function renderBatchPreviews(forceGenerate = false) {
    const grid = $('batch-preview-grid');
    grid.innerHTML = '';
    const configs = getBatchConfigs();
    const checked = Array.from(document.querySelectorAll('.batch-checkbox:checked'))
      .map(cb => cb.dataset.type);

    checked.forEach(type => {
      const cfg = configs[type];
      const item = document.createElement('div');
      item.className = 'batch-preview-item';

      const canvas = document.createElement('canvas');
      canvas.width = cfg.width;
      canvas.height = cfg.height;
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';

      const ctx = canvas.getContext('2d');
      const savedW = state.canvas.width;
      const savedH = state.canvas.height;
      state.canvas.width = cfg.width;
      state.canvas.height = cfg.height;

      roundRect(ctx, 0, 0, cfg.width, cfg.height, state.canvas.borderRadius * cfg.width / 800);
      ctx.fillStyle = state.canvas.bgColor;
      ctx.fill();

      ctx.fillStyle = state.canvas.textColor;
      ctx.textAlign = 'center';
      if (state.selectedTemplate) {
        ctx.font = `bold ${Math.floor(cfg.width * 0.18)}px sans-serif`;
        ctx.fillText(state.selectedTemplate.icon, cfg.width / 2, cfg.height * 0.35);
      }
      if (state.product.title) {
        ctx.font = `bold ${Math.floor(cfg.width * 0.05)}px ${state.canvas.fontFamily}`;
        wrapText(ctx, state.product.title, cfg.width / 2, cfg.height * 0.7, cfg.width * 0.85, cfg.width * 0.06);
      }
      if (state.product.price) {
        ctx.font = `bold ${Math.floor(cfg.width * 0.08)}px ${state.canvas.fontFamily}`;
        ctx.fillText(state.product.price, cfg.width / 2, cfg.height * 0.55);
      }

      state.canvas.width = savedW;
      state.canvas.height = savedH;

      state.batchImages[type] = canvas.toDataURL('image/png');

      const label = document.createElement('div');
      label.className = 'batch-preview-label';
      label.textContent = `${cfg.name} ${cfg.width}×${cfg.height}`;

      item.appendChild(canvas);
      item.appendChild(label);
      grid.appendChild(item);
    });
  }

  function initPreviewPanel() {
    document.querySelectorAll('.device-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const frame = $('device-frame');
        frame.className = 'device-frame ' + btn.dataset.device;
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
        const canvas = $('main-canvas');
        canvas.toBlob(async (blob) => {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          showToast('图片已复制到剪贴板');
        });
      } catch (e) {
        showToast('复制失败：' + e.message);
      }
    });

    $('btn-download-current').addEventListener('click', () => {
      downloadCanvas($('main-canvas'), generateFileName('封面'));
      addToHistory();
    });

    $('btn-download-all').addEventListener('click', () => {
      renderBatchPreviews(true);
      setTimeout(() => {
        Object.keys(state.batchImages).forEach((type, i) => {
          setTimeout(() => {
            const cfg = getBatchConfigs()[type];
            downloadDataUrl(state.batchImages[type], generateFileName(cfg.name));
          }, i * 300);
        });
        addToHistory();
        showToast('套图下载已开始');
      }, 200);
    });

    $('btn-add-brand-color').addEventListener('click', () => {
      const color = $('new-brand-color').value;
      const name = $('new-brand-color-name').value.trim();
      if (!color) return showToast('请选择颜色');
      state.brandColors.push({ color, name });
      saveState();
      renderBrandColors();
      $('new-brand-color-name').value = '';
      showToast('品牌色已保存');
    });

    $('btn-clear-history').addEventListener('click', () => {
      if (confirm('确定要清空所有历史版本吗？')) {
        state.history = [];
        saveState();
        renderHistory();
        showToast('历史已清空');
      }
    });

    $('btn-generate-share').addEventListener('click', () => {
      const config = JSON.stringify({
        product: state.product,
        canvas: state.canvas,
        template: state.selectedTemplate?.id
      });
      const encoded = btoa(unescape(encodeURIComponent(config)));
      const link = 'live-design://share?data=' + encoded.slice(0, 50) + '...';
      $('share-link').value = link;
      showToast('分享链接已生成');
    });

    $('btn-copy-share').addEventListener('click', () => {
      const link = $('share-link').value;
      if (!link) return showToast('请先生成分享链接');
      navigator.clipboard.writeText(link).then(() => {
        showToast('链接已复制');
      });
    });
  }

  function generateFileName(prefix) {
    const date = new Date();
    const ts = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}`;
    return `${prefix}_${ts}.png`;
  }

  function downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function downloadDataUrl(dataUrl, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }

  function addToHistory() {
    const dataUrl = $('main-canvas').toDataURL('image/png');
    const entry = {
      id: Date.now(),
      thumb: dataUrl,
      title: state.product.title || '未命名物料',
      template: state.selectedTemplate?.name || '自定义',
      time: new Date().toLocaleString('zh-CN'),
      product: { ...state.product },
      canvas: { ...state.canvas },
      templateId: state.selectedTemplate?.id
    };
    state.history.unshift(entry);
    if (state.history.length > 50) state.history = state.history.slice(0, 50);
    saveState();
    renderHistory();
  }

  function renderHistory() {
    const container = $('history-list');
    if (!container) return;
    container.innerHTML = '';
    if (state.history.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无历史记录</div>';
      return;
    }
    state.history.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <img class="history-thumb" src="${item.thumb}" alt="">
        <div class="history-info">
          <div class="history-title">${item.title}</div>
          <div class="history-time">${item.template} · ${item.time}</div>
        </div>
        <div class="history-actions">
          <button title="恢复此版本">↩️</button>
          <button title="删除">🗑️</button>
        </div>
      `;
      const btns = el.querySelectorAll('.history-actions button');
      btns[0].addEventListener('click', (e) => {
        e.stopPropagation();
        state.product = { ...item.product };
        state.canvas = { ...item.canvas };
        if (item.templateId) {
          state.selectedTemplate = templates.find(t => t.id === item.templateId);
        }
        updateProductForm();
        syncCanvasControls();
        renderCanvas();
        showToast('已恢复历史版本');
      });
      btns[1].addEventListener('click', (e) => {
        e.stopPropagation();
        state.history.splice(i, 1);
        saveState();
        renderHistory();
      });
      el.addEventListener('click', () => {
        state.product = { ...item.product };
        state.canvas = { ...item.canvas };
        if (item.templateId) {
          state.selectedTemplate = templates.find(t => t.id === item.templateId);
        }
        updateProductForm();
        syncCanvasControls();
        renderCanvas();
        showToast('已恢复历史版本');
      });
      container.appendChild(el);
    });
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
  }

  function initBackgroundStub() {
  }

  function init() {
    loadState();
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
    document.querySelector('#tag-list .tag').classList.add('active');
    renderCanvas();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
