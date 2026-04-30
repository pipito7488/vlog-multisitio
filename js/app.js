/**
 * app.js — Lógica para la página principal (index.html)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Cargar configuración y aplicar colores
  const config = await DB.getConfig();
  DB.applyDesign(config);

  // Poblar textos principales y enlaces
  const siteLogo = document.getElementById('siteLogo');
  if (siteLogo) {
    siteLogo.textContent = config.siteName || 'Mi Vlog';
    siteLogo.href = `/${DB.siteId}`;
  }

  const floatingAdmin = document.getElementById('floatingAdminBtn');
  if (floatingAdmin) {
    floatingAdmin.href = `/${DB.siteId}/admin`;
  }

  document.getElementById('footerSiteName').textContent = config.siteName || 'Mi Vlog';
  document.getElementById('currentYear').textContent = new Date().getFullYear();
  document.getElementById('heroTitle').textContent = config.heroTitle || 'Bienvenido';
  document.getElementById('heroDesc').textContent = config.heroDescription || '';

  // Renderizar redes sociales
  renderSocialLinks(config.socials);

  // Renderizar artículos
  await renderArticles();

  // Escuchar cambios en vivo desde el editor visual
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'LIVE_PREVIEW_UPDATE') {
      const liveConfig = event.data.config;
      DB.applyDesign(liveConfig);
      
      if (document.getElementById('siteLogo')) {
        document.getElementById('siteLogo').textContent = liveConfig.siteName || 'Mi Vlog';
        document.getElementById('footerSiteName').textContent = liveConfig.siteName || 'Mi Vlog';
      }
      if (document.getElementById('heroTitle')) {
        document.getElementById('heroTitle').textContent = liveConfig.heroTitle || 'Bienvenido';
        document.getElementById('heroDesc').textContent = liveConfig.heroDescription || '';
      }
    }
  });
});

function renderSocialLinks(socials) {
  if (!socials) return;
  
  const socialIcons = {
    youtube: '📺',
    instagram: '📸',
    twitter: '🐦',
    tiktok: '🎵'
  };

  const topNav = document.getElementById('socialNavTop');
  const bottomNav = document.getElementById('socialNavBottom');
  
  let html = '';
  
  for (const [platform, url] of Object.entries(socials)) {
    if (url && url.trim() !== '') {
      html += `<a href="${url}" target="_blank" rel="noopener noreferrer" class="social-link" title="${platform}">
                ${socialIcons[platform] || '🔗'}
              </a>`;
    }
  }

  if (topNav) topNav.innerHTML = html;
  if (bottomNav) bottomNav.innerHTML = html;
}

async function renderArticles() {
  const grid = document.getElementById('articlesGrid');
  const articles = await DB.getPublishedArticles();

  if (articles.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: var(--space-2xl) 0;">No hay artículos publicados todavía.</p>';
    return;
  }

  let html = '';

  articles.forEach(article => {
    // Determinar miniatura
    let thumbUrl = '';
    if (article.mediaType === 'image' && article.mediaData) {
      thumbUrl = article.mediaData;
    } else if (article.mediaType === 'youtube' && article.mediaData) {
      const ytId = DB.getYouTubeId(article.mediaData);
      thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : '';
    }

    const hasThumb = thumbUrl ? true : false;
    const fallbackBg = 'linear-gradient(45deg, var(--bg-tertiary), var(--accent-tertiary))';

    const tagsHtml = (article.tags || []).slice(0, 2).map(tag => 
      `<span class="card-tag">${tag}</span>`
    ).join('');

    html += `
      <article class="card">
        <div class="card-image-wrapper" style="${!hasThumb ? `background: ${fallbackBg}` : ''}">
          ${hasThumb ? `<img src="${thumbUrl}" alt="${article.title}" class="card-image" loading="lazy">` : ''}
        </div>
        <div class="card-content">
          <div class="card-meta">
            <span>${DB.formatDate(article.date)}</span>
            ${tagsHtml ? '<span style="margin: 0 8px;">•</span>' : ''}
            ${tagsHtml}
          </div>
          <h3 class="card-title">
            <a href="/${DB.siteId}/article/${article.id}">${article.title}</a>
          </h3>
          <div class="card-excerpt">
            ${DB.getExcerpt(article.content, 120)}
          </div>
          <div class="card-footer">
            <a href="/${DB.siteId}/article/${article.id}" class="read-more">Leer más</a>
          </div>
        </div>
      </article>
    `;
  });

  grid.innerHTML = html;
}
