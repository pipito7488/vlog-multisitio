/**
 * article.js — Lógica para la vista de artículo individual
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Cargar configuración global
  const config = await DB.getConfig();
  DB.applyAccentColor(config.accentColor);

  document.getElementById('siteLogo').textContent = config.siteName || 'Mi Vlog';
  document.getElementById('footerSiteName').textContent = config.siteName || 'Mi Vlog';
  document.getElementById('currentYear').textContent = new Date().getFullYear();
  
  // Renderizar header social links
  const socialIcons = { youtube: '📺', instagram: '📸', twitter: '🐦', tiktok: '🎵' };
  let socialHtml = '';
  for (const [platform, url] of Object.entries(config.socials || {})) {
    if (url) {
      socialHtml += `<a href="${url}" target="_blank" rel="noopener noreferrer" class="social-link" title="${platform}">${socialIcons[platform] || '🔗'}</a>`;
    }
  }
  document.getElementById('socialNavTop').innerHTML = socialHtml;

  // Obtener ID de artículo
  function getArticleIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromParam = urlParams.get('id');
    if (idFromParam) return idFromParam;

    const pathParts = window.location.pathname.split('/').filter(p => p.length > 0);
    if (pathParts.length >= 3 && pathParts[1] === 'article') {
      return pathParts[2];
    }
    return null;
  }
  const articleId = getArticleIdFromUrl();

  if (!articleId) {
    showError();
    return;
  }

  const article = await DB.getArticleById(articleId);

  // Si no existe o es borrador (y no somos admin), mostrar error
  if (!article || (article.status !== 'published' && !DB.isLoggedIn())) {
    showError();
    return;
  }

  renderArticle(article, config.siteName);
});

function showError() {
  document.getElementById('articleContainer').style.display = 'none';
  document.getElementById('errorContainer').style.display = 'block';
  document.title = 'Artículo no encontrado';
}

function renderArticle(article, siteName) {
  // Título
  document.title = `${article.title} - ${siteName || 'Mi Vlog'}`;
  document.getElementById('articleTitle').textContent = article.title;

  // Meta (Fecha y tags)
  const metaContainer = document.getElementById('articleMeta');
  let metaHtml = `<span>📅 ${DB.formatDate(article.date)}</span>`;
  
  if (article.tags && article.tags.length > 0) {
    metaHtml += `<span>•</span><div style="display: flex; gap: 8px;">`;
    article.tags.forEach(tag => {
      metaHtml += `<span class="card-tag">${tag}</span>`;
    });
    metaHtml += `</div>`;
  }
  metaContainer.innerHTML = metaHtml;

  // Media (Imagen o YouTube)
  const mediaContainer = document.getElementById('articleMedia');
  if (article.mediaType === 'image' && article.mediaData) {
    mediaContainer.innerHTML = `<img src="${article.mediaData}" alt="${article.title}" class="article-featured-image">`;
  } else if (article.mediaType === 'youtube' && article.mediaData) {
    const embedUrl = DB.getYouTubeEmbed(article.mediaData);
    if (embedUrl) {
      mediaContainer.innerHTML = `
        <div class="video-container" style="margin-bottom: var(--space-2xl);">
          <iframe src="${embedUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
      `;
    }
  }

  // Contenido
  document.getElementById('articleContent').innerHTML = article.content || '<p>Sin contenido.</p>';

  // Botones de Redirección
  const linksContainer = document.getElementById('articleLinks');
  if (article.links && article.links.length > 0) {
    let linksHtml = '';
    article.links.forEach(link => {
      if (link.url && link.text) {
        linksHtml += `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="btn-redirect">${link.text} ↗</a>`;
      }
    });
    linksContainer.innerHTML = linksHtml;
  }
}
