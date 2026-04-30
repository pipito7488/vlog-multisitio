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
  
  document.getElementById('cfgSiteName').value = config.siteName || '';
  document.getElementById('cfgAccentColor').value = config.accentColor || '#7C3AED';
  document.getElementById('cfgHeroTitle').value = config.heroTitle || '';
  document.getElementById('cfgHeroDesc').value = config.heroDescription || '';
  
  const socials = config.socials || {};
  document.getElementById('cfgSocYoutube').value = socials.youtube || '';
  document.getElementById('cfgSocInsta').value = socials.instagram || '';
  document.getElementById('cfgSocTwitter').value = socials.twitter || '';
  document.getElementById('cfgSocTiktok').value = socials.tiktok || '';

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
      heroTitle: document.getElementById('cfgHeroTitle').value,
      heroDescription: document.getElementById('cfgHeroDesc').value,
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
      // Actualizar variables de la UI actual si es necesario
      const logoEl = document.querySelector('.admin-sidebar .logo');
      if (logoEl) logoEl.textContent = newConfig.siteName;
    } else {
      showToast('Error guardando configuración', 'error');
    }

    btnSave.textContent = 'Guardar Cambios';
    btnSave.disabled = false;
  });

  // Ocultar export/import ya que ahora usamos base de datos real
  document.getElementById('btnExportData').parentElement.classList.add('hidden');
}

function switchToPanel(panelId) {
  document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.remove('active'));
  document.getElementById(panelId).classList.add('active');
  
  document.querySelectorAll('.admin-nav-item').forEach(nav => nav.classList.remove('active'));
  const navItem = document.querySelector(`.admin-nav-item[data-target="${panelId}"]`);
  if (navItem) navItem.classList.add('active');
}
