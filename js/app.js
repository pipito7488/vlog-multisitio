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

  // Renderizar redes sociales
  renderSocialLinks(config.socials);

  // Renderizar Layout Dinámico (Bloques)
  await renderLayout(config);

  // Escuchar cambios en vivo desde el editor visual
  window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'LIVE_PREVIEW_UPDATE') {
      const liveConfig = event.data.config;
      DB.applyDesign(liveConfig);
      
      if (document.getElementById('siteLogo')) {
        document.getElementById('siteLogo').textContent = liveConfig.siteName || 'Mi Vlog';
        document.getElementById('footerSiteName').textContent = liveConfig.siteName || 'Mi Vlog';
      }
      
      await renderLayout(liveConfig);
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

async function renderLayout(config) {
  const main = document.getElementById('dynamicLayout');
  if (!main) return;
  
  const layout = config.layout || ['hero', 'articles'];
  const blocks = config.blocks || {};
  
  let layoutHtml = '';
  
  for (const blockId of layout) {
    const blockData = blocks[blockId];
    if (!blockData) continue;
    
    if (blockData.type === 'hero') {
      const hasImage = blockData.image && blockData.image !== '';
      const bgStyle = hasImage ? `background-image: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url(${blockData.image}); background-size: cover; background-position: center;` : '';
      layoutHtml += `
        <section class="hero" id="block-${blockId}" style="${bgStyle}">
          <div class="container">
            <h1 class="hero-title">${blockData.title || ''}</h1>
            <p class="hero-description">${blockData.desc || ''}</p>
          </div>
        </section>
      `;
    } 
    else if (blockData.type === 'about') {
      layoutHtml += `
        <section class="about-section" id="block-${blockId}" style="padding: var(--space-3xl) 0;">
          <div class="container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-2xl); align-items: center;">
            ${blockData.image ? `<img src="${blockData.image}" style="border-radius: var(--radius-lg); width: 100%; max-height: 400px; object-fit: cover;">` : '<div style="background: var(--bg-tertiary); height: 300px; border-radius: var(--radius-lg);"></div>'}
            <div>
              <h2 style="font-size: 2.5rem; margin-bottom: var(--space-lg);">${blockData.title || 'Sobre Mí'}</h2>
              <p style="color: var(--text-secondary); font-size: 1.1rem; line-height: 1.8;">${blockData.desc || ''}</p>
            </div>
          </div>
        </section>
      `;
    }
    else if (blockData.type === 'youtube') {
      if (blockData.url) {
        const embedUrl = DB.getYouTubeEmbed(blockData.url);
        if (embedUrl) {
          layoutHtml += `
            <section class="youtube-section" id="block-${blockId}" style="padding: var(--space-2xl) 0;">
              <div class="container" style="max-width: 900px;">
                <div class="video-container">
                  <iframe src="${embedUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                </div>
              </div>
            </section>
          `;
        }
      }
    }
    else if (blockData.type === 'articles') {
      const articlesHtml = await getArticlesHtml();
      layoutHtml += `
        <section class="articles-section" id="block-${blockId}">
          <div class="container">
            <h2 class="section-title">${blockData.title || 'Últimas Publicaciones'}</h2>
            <div class="grid">
              ${articlesHtml}
            </div>
          </div>
        </section>
      `;
    }
    else if (blockData.type === 'html') {
      layoutHtml += `
        <section class="html-section" id="block-${blockId}" style="padding: var(--space-2xl) 0; overflow: hidden;">
          <div class="container" style="text-align: center; width: 100%;">
            ${blockData.html || '<p style="color:var(--text-muted);">Bloque HTML vacío.</p>'}
          </div>
        </section>
      `;
    }
    else if (blockData.type === 'contact') {
      layoutHtml += `
        <section class="contact-section" id="block-${blockId}" style="padding: var(--space-3xl) 0; background: var(--bg-secondary); border-top: 1px solid var(--bg-tertiary); border-bottom: 1px solid var(--bg-tertiary); margin: var(--space-2xl) 0;">
          <div class="container" style="max-width: 600px; text-align: center;">
            <h2 class="section-title" style="justify-content: center; font-size: 2.5rem;">${blockData.title || 'Contáctame'}</h2>
            <form class="contact-form" style="margin-top: var(--space-xl);" onsubmit="event.preventDefault(); window.location.href='mailto:${blockData.email || ''}?subject=Contacto desde mi sitio web'">
              <div class="input-group">
                <input type="text" placeholder="Tu Nombre" required style="width: 100%; padding: 1rem; margin-bottom: var(--space-sm); border-radius: var(--radius-md); border: 1px solid var(--bg-tertiary); background: var(--bg-primary); color: var(--text-primary);">
              </div>
              <div class="input-group">
                <textarea placeholder="Tu Mensaje" required rows="4" style="width: 100%; padding: 1rem; margin-bottom: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--bg-tertiary); background: var(--bg-primary); color: var(--text-primary); resize: vertical;"></textarea>
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%; font-size: 1.1rem; padding: 1rem; border-radius: var(--radius-md);">${blockData.btnText || 'Enviar Mensaje'}</button>
            </form>
          </div>
        </section>
      `;
    }
    else if (blockData.type === 'gallery') {
      let imagesHtml = '';
      if(blockData.img1) imagesHtml += `<div style="border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); aspect-ratio: 1; background-image: url(${blockData.img1}); background-size: cover; background-position: center; transition: transform var(--transition-normal);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"></div>`;
      if(blockData.img2) imagesHtml += `<div style="border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); aspect-ratio: 1; background-image: url(${blockData.img2}); background-size: cover; background-position: center; transition: transform var(--transition-normal);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"></div>`;
      if(blockData.img3) imagesHtml += `<div style="border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); aspect-ratio: 1; background-image: url(${blockData.img3}); background-size: cover; background-position: center; transition: transform var(--transition-normal);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"></div>`;
      
      layoutHtml += `
        <section class="gallery-section" id="block-${blockId}" style="padding: var(--space-3xl) 0;">
          <div class="container">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-xl);">
              ${imagesHtml || '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: var(--space-xl); background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px dashed var(--bg-tertiary);">Sube imágenes desde el panel de control para ver la galería.</div>'}
            </div>
          </div>
        </section>
      `;
    }
  }
  
  main.innerHTML = layoutHtml;
}

async function getArticlesHtml() {
  const articles = await DB.getPublishedArticles();

  if (articles.length === 0) {
    return '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: var(--space-2xl) 0;">No hay artículos publicados todavía.</p>';
  }

  let html = '';
  articles.forEach(article => {
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

  return html;
}
