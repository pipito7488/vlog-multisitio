/**
 * admin.js — Lógica del panel de administración
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Aplicar color de acento global
  const config = await DB.getConfig();
  DB.applyAccentColor(config.accentColor);

  // Comprobar autenticación
  if (DB.isLoggedIn()) {
    await showAdminApp();
  } else {
    document.getElementById('loginScreen').classList.remove('hidden');
  }

  // Actualizar enlace "Ver sitio" en el sidebar
  const viewSiteBtn = document.getElementById('viewSiteBtn');
  if (viewSiteBtn) {
    viewSiteBtn.href = `/${DB.siteId}`;
  }

  // Eventos de Login
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const prevText = btn.textContent;
    btn.textContent = 'Verificando...';
    btn.disabled = true;

    const pass = document.getElementById('passwordInput').value;
    const isValid = await DB.checkPassword(pass);
    
    if (isValid) {
      DB.login();
      await showAdminApp();
    } else {
      showToast('Contraseña incorrecta', 'error');
    }

    btn.textContent = prevText;
    btn.disabled = false;
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    DB.logout();
    location.reload();
  });

  // Eventos de Navegación del Panel
  document.querySelectorAll('.admin-nav-item[data-target]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach(nav => nav.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.remove('active'));
      
      item.classList.add('active');
      document.getElementById(item.dataset.target).classList.add('active');
    });
  });
});

// ── Notificaciones (Toasts) ─────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${message}`;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function showAdminApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');

  // Inicializar Paneles
  await initArticlesPanel();
  initEditorPanel();
  await initSettingsPanel();
}

// ── Panel de Artículos ──────────────────────────────────────────────────────

async function initArticlesPanel() {
  const tbody = document.getElementById('articlesTableBody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Cargando artículos...</td></tr>';

  const articlesRaw = await DB.getArticles();
  const articles = articlesRaw.sort((a, b) => new Date(b.date) - new Date(a.date));

  tbody.innerHTML = '';
  
  if (articles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No hay artículos. ¡Crea el primero!</td></tr>';
    return;
  }

  articles.forEach(article => {
    const tr = document.createElement('tr');
    
    const statusClass = article.status === 'published' ? 'status-published' : 'status-draft';
    const statusText = article.status === 'published' ? 'Publicado' : 'Borrador';

    tr.innerHTML = `
      <td style="font-weight: 500;">${article.title}</td>
      <td>${DB.formatDate(article.date)}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td class="actions">
        <button class="btn btn-small btn-outline btn-edit" data-id="${article.id}">Editar</button>
        <button class="btn btn-small btn-danger btn-delete" data-id="${article.id}">Borrar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Eventos de botones (usamos event delegation)
  tbody.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-edit')) {
      await openEditor(e.target.dataset.id);
    } else if (e.target.classList.contains('btn-delete')) {
      if (confirm('¿Estás seguro de eliminar este artículo? Esta acción no se puede deshacer.')) {
        e.target.textContent = '...';
        e.target.disabled = true;
        await DB.deleteArticle(e.target.dataset.id);
        await initArticlesPanel();
        showToast('Artículo eliminado');
      }
    }
  });

  const btnNew = document.getElementById('btnNewArticle');
  // Evitar duplicar listeners si se llama a initArticlesPanel múltiples veces
  const newBtnClone = btnNew.cloneNode(true);
  btnNew.parentNode.replaceChild(newBtnClone, btnNew);
  newBtnClone.addEventListener('click', () => openEditor(null));
}

// ── Editor de Artículos ─────────────────────────────────────────────────────

function initEditorPanel() {
  document.querySelectorAll('.editor-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const command = btn.dataset.command;
      if (command === 'createLink') {
        const url = prompt('Ingresa la URL del enlace:');
        if (url) document.execCommand(command, false, url);
      } else {
        document.execCommand(command, false, null);
      }
      document.getElementById('artContent').focus();
    });
  });

  document.getElementById('mediaType').addEventListener('change', (e) => {
    if (e.target.value === 'image') {
      document.getElementById('mediaImageConfig').classList.remove('hidden');
      document.getElementById('mediaYoutubeConfig').classList.add('hidden');
    } else {
      document.getElementById('mediaImageConfig').classList.add('hidden');
      document.getElementById('mediaYoutubeConfig').classList.remove('hidden');
    }
  });

  document.getElementById('artImageUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      showToast('Procesando imagen...', 'success');
      const base64 = await DB.resizeImage(file);
      document.getElementById('artImageBase64').value = base64;
      document.getElementById('imagePreview').style.backgroundImage = `url(${base64})`;
      document.querySelector('.image-upload-text').style.display = 'none';
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btnAddLink').addEventListener('click', () => {
    addLinkField();
  });

  document.getElementById('btnCancelEdit').addEventListener('click', (e) => {
    e.preventDefault();
    switchToPanel('articlesPanel');
  });

  document.getElementById('btnSaveArticle').addEventListener('click', async (e) => {
    e.preventDefault();
    await saveArticle();
  });
}

async function openEditor(articleId = null) {
  const form = document.getElementById('articleForm');
  form.reset();
  document.getElementById('artContent').innerHTML = '';
  document.getElementById('imagePreview').style.backgroundImage = 'none';
  document.querySelector('.image-upload-text').style.display = 'block';
  document.getElementById('linksEditorList').innerHTML = '';

  if (articleId) {
    document.getElementById('editorTitle').textContent = 'Editar Artículo';
    document.getElementById('btnSaveArticle').textContent = 'Cargando...';
    document.getElementById('btnSaveArticle').disabled = true;
    
    switchToPanel('editorPanel');

    const article = await DB.getArticleById(articleId);
    
    document.getElementById('btnSaveArticle').textContent = 'Guardar';
    document.getElementById('btnSaveArticle').disabled = false;

    if (!article) return;

    document.getElementById('articleId').value = article.id;
    document.getElementById('artTitle').value = article.title;
    document.getElementById('artDate').value = article.date;
    document.getElementById('artStatus').value = article.status;
    document.getElementById('mediaType').value = article.mediaType;
    
    document.getElementById('mediaType').dispatchEvent(new Event('change'));

    if (article.mediaType === 'image' && article.mediaData) {
      document.getElementById('artImageBase64').value = article.mediaData;
      document.getElementById('imagePreview').style.backgroundImage = `url(${article.mediaData})`;
      document.querySelector('.image-upload-text').style.display = 'none';
    } else if (article.mediaType === 'youtube' && article.mediaData) {
      document.getElementById('artYoutube').value = article.mediaData;
    }

    document.getElementById('artContent').innerHTML = article.content || '';
    document.getElementById('artTags').value = (article.tags || []).join(', ');

    if (article.links) {
      article.links.forEach(link => addLinkField(link.text, link.url));
    }
  } else {
    document.getElementById('editorTitle').textContent = 'Nuevo Artículo';
    document.getElementById('articleId').value = '';
    document.getElementById('artDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('mediaType').dispatchEvent(new Event('change'));
    switchToPanel('editorPanel');
  }
}

function addLinkField(text = '', url = '') {
  const container = document.getElementById('linksEditorList');
  const div = document.createElement('div');
  div.className = 'link-edit-row';
  div.innerHTML = `
    <input type="text" placeholder="Texto del botón (ej: Ver video)" value="${text}" class="link-text">
    <input type="url" placeholder="https://..." value="${url}" class="link-url">
    <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">X</button>
  `;
  container.appendChild(div);
}

async function saveArticle() {
  const title = document.getElementById('artTitle').value.trim();
  if (!title) {
    showToast('El título es obligatorio', 'error');
    return;
  }

  const btnSave = document.getElementById('btnSaveArticle');
  btnSave.textContent = 'Guardando...';
  btnSave.disabled = true;

  const mediaType = document.getElementById('mediaType').value;
  let mediaData = '';
  if (mediaType === 'image') {
    mediaData = document.getElementById('artImageBase64').value;
  } else {
    mediaData = document.getElementById('artYoutube').value.trim();
  }

  const links = [];
  document.querySelectorAll('.link-edit-row').forEach(row => {
    const text = row.querySelector('.link-text').value.trim();
    const url = row.querySelector('.link-url').value.trim();
    if (text && url) links.push({ text, url });
  });

  const tagsRaw = document.getElementById('artTags').value;
  const tags = tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);

  const article = {
    id: document.getElementById('articleId').value || null,
    title,
    date: document.getElementById('artDate').value,
    status: document.getElementById('artStatus').value,
    mediaType,
    mediaData,
    content: document.getElementById('artContent').innerHTML,
    tags,
    links
  };

  try {
    await DB.saveArticle(article);
    showToast('Artículo guardado correctamente');
    await initArticlesPanel();
    switchToPanel('articlesPanel');
  } catch (err) {
    showToast('Error al guardar: ' + err.message, 'error');
  } finally {
    btnSave.textContent = 'Guardar';
    btnSave.disabled = false;
  }
}

// ── Panel de Configuración ──────────────────────────────────────────────────

async function initSettingsPanel() {
  const config = await DB.getConfig();
  
  let currentLayout = config.layout ? [...config.layout] : ['hero', 'articles'];
  let currentBlocks = config.blocks ? JSON.parse(JSON.stringify(config.blocks)) : {
    hero: { type: 'hero', title: config.heroTitle || 'Bienvenido', desc: config.heroDescription || '', image: config.heroImage || '' },
    articles: { type: 'articles', title: 'Últimas Publicaciones' }
  };
  
  document.getElementById('cfgSiteName').value = config.siteName || '';
  document.getElementById('cfgAccentColor').value = config.accentColor || '#7C3AED';
  document.getElementById('cfgTheme').value = config.theme || 'dark';
  document.getElementById('cfgFontFamily').value = config.fontFamily || 'Inter';
  document.getElementById('cfgBorderRadius').value = config.borderRadius || '12px';

  const socials = config.socials || {};
  document.getElementById('cfgSocYoutube').value = socials.youtube || '';
  document.getElementById('cfgSocInsta').value = socials.instagram || '';
  document.getElementById('cfgSocTwitter').value = socials.twitter || '';
  document.getElementById('cfgSocTiktok').value = socials.tiktok || '';

  // Setup Iframe Live Preview
  const iframe = document.getElementById('livePreviewFrame');
  if (iframe) iframe.src = `/${DB.siteId}`;

  // Blocks Renderer
  function renderAdminBlocks() {
    const container = document.getElementById('blocksList');
    container.innerHTML = '';
    
    currentLayout.forEach(blockId => {
      const block = currentBlocks[blockId];
      if(!block) return;
      
      const div = document.createElement('div');
      div.className = 'admin-block-item';
      div.dataset.id = blockId;
      div.style.cssText = 'background: var(--bg-primary); border: 1px solid var(--bg-tertiary); border-radius: var(--radius-md); padding: var(--space-sm); cursor: grab;';
      
      const header = document.createElement('div');
      header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; font-weight: bold;';
      
      const titleSpan = document.createElement('span');
      titleSpan.innerHTML = `☰ ${block.type.toUpperCase()}`;
      
      const actions = document.createElement('div');
      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn btn-outline btn-small';
      btnEdit.textContent = '⚙️';
      
      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn btn-danger btn-small';
      btnDel.textContent = '❌';
      btnDel.style.marginLeft = '4px';
      btnDel.onclick = () => {
         currentLayout = currentLayout.filter(id => id !== blockId);
         delete currentBlocks[blockId];
         renderAdminBlocks();
         sendLiveUpdate();
      };
      
      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);
      header.appendChild(titleSpan);
      header.appendChild(actions);
      div.appendChild(header);
      
      const body = document.createElement('div');
      body.className = 'hidden';
      body.style.cssText = 'margin-top: var(--space-md); padding-top: var(--space-sm); border-top: 1px solid var(--bg-tertiary); display: grid; gap: var(--space-sm); cursor: default;';
      
      btnEdit.onclick = () => { body.classList.toggle('hidden'); };

      if (block.type === 'hero' || block.type === 'about') {
         body.innerHTML = `
           <div class="input-group">
             <label>Título</label>
             <input type="text" class="b-title" value="${block.title || ''}">
           </div>
           <div class="input-group">
             <label>Descripción</label>
             <textarea class="b-desc" rows="2">${block.desc || ''}</textarea>
           </div>
           <div class="input-group">
             <label>URL Imagen</label>
             <input type="text" class="b-image" value="${block.image || ''}" placeholder="Pega URL base64...">
           </div>
         `;
      } else if (block.type === 'youtube') {
         body.innerHTML = `
           <div class="input-group">
             <label>URL Video YouTube</label>
             <input type="url" class="b-url" value="${block.url || ''}" placeholder="https://youtube.com/...">
           </div>
         `;
      } else if (block.type === 'articles') {
         body.innerHTML = `
           <div class="input-group">
             <label>Título de Sección</label>
             <input type="text" class="b-title" value="${block.title || 'Últimas Publicaciones'}">
           </div>
         `;
      } else if (block.type === 'html') {
         body.innerHTML = `
           <div class="input-group">
             <label>Código HTML / Embed</label>
             <textarea class="b-html" rows="5" placeholder="<iframe>...</iframe>">${block.html || ''}</textarea>
             <small style="color:var(--text-muted)">Puedes pegar mapas de Google, listas de Spotify, etc.</small>
           </div>
         `;
      } else if (block.type === 'contact') {
         body.innerHTML = `
           <div class="input-group">
             <label>Título</label>
             <input type="text" class="b-title" value="${block.title || 'Contáctame'}">
           </div>
           <div class="input-group">
             <label>Correo Destino</label>
             <input type="email" class="b-email" value="${block.email || ''}" placeholder="tu@email.com">
           </div>
           <div class="input-group">
             <label>Texto del Botón</label>
             <input type="text" class="b-btn" value="${block.btnText || 'Enviar Mensaje'}">
           </div>
         `;
      } else if (block.type === 'gallery') {
         body.innerHTML = `
           <div class="input-group">
             <label>Imagen 1 (Base64 / URL)</label>
             <input type="text" class="b-img1" value="${block.img1 || ''}">
           </div>
           <div class="input-group">
             <label>Imagen 2 (Base64 / URL)</label>
             <input type="text" class="b-img2" value="${block.img2 || ''}">
           </div>
           <div class="input-group">
             <label>Imagen 3 (Base64 / URL)</label>
             <input type="text" class="b-img3" value="${block.img3 || ''}">
           </div>
         `;
      }
      
      body.querySelectorAll('input, textarea').forEach(inp => {
         inp.addEventListener('input', (e) => {
           if(e.target.classList.contains('b-title')) block.title = e.target.value;
           if(e.target.classList.contains('b-desc')) block.desc = e.target.value;
           if(e.target.classList.contains('b-image')) block.image = e.target.value;
           if(e.target.classList.contains('b-url')) block.url = e.target.value;
           if(e.target.classList.contains('b-html')) block.html = e.target.value;
           if(e.target.classList.contains('b-email')) block.email = e.target.value;
           if(e.target.classList.contains('b-btn')) block.btnText = e.target.value;
           if(e.target.classList.contains('b-img1')) block.img1 = e.target.value;
           if(e.target.classList.contains('b-img2')) block.img2 = e.target.value;
           if(e.target.classList.contains('b-img3')) block.img3 = e.target.value;
           sendLiveUpdate();
         });
      });
      
      div.appendChild(body);
      container.appendChild(div);
    });
  }

  renderAdminBlocks();

  // Initialize SortableJS
  if (typeof Sortable !== 'undefined') {
    Sortable.create(document.getElementById('blocksList'), {
      animation: 150,
      onEnd: function (evt) {
        // Reorder currentLayout array based on DOM order
        const items = document.querySelectorAll('.admin-block-item');
        currentLayout = Array.from(items).map(item => item.dataset.id);
        sendLiveUpdate();
      }
    });
  }

  // Block Selector Logic
  const blockSelector = document.getElementById('blockSelector');
  document.getElementById('btnAddBlock').addEventListener('click', () => {
    blockSelector.classList.toggle('hidden');
  });

  document.querySelectorAll('.block-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
       const type = e.target.dataset.type;
       const newId = type + '_' + Date.now();
       
       currentLayout.push(newId);
       currentBlocks[newId] = { type: type };
       if(type === 'hero' || type === 'about') {
         currentBlocks[newId].title = 'Nuevo Bloque';
       }
       if(type === 'articles') {
         currentBlocks[newId].title = 'Últimas Publicaciones';
       }
       if(type === 'contact') {
         currentBlocks[newId].title = 'Contáctame';
       }
       
       renderAdminBlocks();
       sendLiveUpdate();
       blockSelector.classList.add('hidden');
    });
  });

  function sendLiveUpdate() {
    const liveConfig = {
      ...config,
      siteName: document.getElementById('cfgSiteName').value,
      accentColor: document.getElementById('cfgAccentColor').value,
      theme: document.getElementById('cfgTheme').value,
      fontFamily: document.getElementById('cfgFontFamily').value,
      borderRadius: document.getElementById('cfgBorderRadius').value,
      layout: currentLayout,
      blocks: currentBlocks
    };
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'LIVE_PREVIEW_UPDATE', config: liveConfig }, '*');
    }
  }

  const staticInputs = document.querySelectorAll('#cfgSiteName, #cfgAccentColor, #cfgTheme, #cfgFontFamily, #cfgBorderRadius');
  staticInputs.forEach(input => {
    input.addEventListener('input', sendLiveUpdate);
    input.addEventListener('change', sendLiveUpdate);
  });

  // Guardar configuración
  document.getElementById('btnSaveConfig').addEventListener('click', async (e) => {
    e.preventDefault();
    
    const btnSave = document.getElementById('btnSaveConfig');
    btnSave.textContent = 'Guardando...';
    btnSave.disabled = true;

    const newConfig = {
      ...config,
      siteName: document.getElementById('cfgSiteName').value,
      accentColor: document.getElementById('cfgAccentColor').value,
      theme: document.getElementById('cfgTheme').value,
      fontFamily: document.getElementById('cfgFontFamily').value,
      borderRadius: document.getElementById('cfgBorderRadius').value,
      layout: currentLayout,
      blocks: currentBlocks,
      socials: {
        youtube: document.getElementById('cfgSocYoutube').value,
        instagram: document.getElementById('cfgSocInsta').value,
        twitter: document.getElementById('cfgSocTwitter').value,
        tiktok: document.getElementById('cfgSocTiktok').value
      }
    };

    const newPass = document.getElementById('cfgPassword').value;
    if (newPass.trim() !== '') {
      newConfig.password = newPass;
    }

    const success = await DB.saveConfig(newConfig);
    if (success) {
      document.getElementById('cfgPassword').value = '';
      showToast('Configuración guardada.', 'success');
    } else {
      showToast('Error guardando configuración', 'error');
    }

    btnSave.textContent = 'Guardar';
    btnSave.disabled = false;
  });
}

function switchToPanel(panelId) {
  document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.remove('active'));
  document.getElementById(panelId).classList.add('active');
  
  document.querySelectorAll('.admin-nav-item').forEach(nav => nav.classList.remove('active'));
  const navItem = document.querySelector(`.admin-nav-item[data-target="${panelId}"]`);
  if (navItem) navItem.classList.add('active');
}
