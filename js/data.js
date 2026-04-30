/**
 * data.js — Capa de datos del Vlog (Firebase Multi-sitio)
 */

const firebaseConfig = {
  apiKey: "AIzaSyBmUIpoLKfVPNwFmVv4ObkQ4V5AjbAnuCw",
  authDomain: "plantilla-b102b.firebaseapp.com",
  projectId: "plantilla-b102b",
  storageBucket: "plantilla-b102b.firebasestorage.app",
  messagingSenderId: "187235050480",
  appId: "1:187235050480:web:4dc89b91eb39687a74b335",
  measurementId: "G-YF758C6ELB"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();

// Obtener siteId de la URL (Clean URLs o Query Params)
function getSiteIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  let siteFromParam = urlParams.get('site');
  if (siteFromParam) return siteFromParam;

  // Para Clean URLs (ej: /vlog-juan o /vlog-juan/admin)
  const pathParts = window.location.pathname.split('/').filter(p => p.length > 0);
  if (pathParts.length > 0 && pathParts[0] !== 'superadmin' && !pathParts[0].endsWith('.html')) {
    return pathParts[0];
  }
  
  return localStorage.getItem('last_site_id') || 'default-site';
}

let currentSiteId = getSiteIdFromUrl();
localStorage.setItem('last_site_id', currentSiteId);

const DB = {
  siteId: currentSiteId,

  defaultConfig: {
    siteName: 'Mi Vlog',
    tagline: 'Historias, videos y experiencias',
    heroTitle: '¡Bienvenido a Mi Vlog!',
    heroDescription: 'Un espacio para compartir historias, videos y todo lo que me apasiona.',
    accentColor: '#7C3AED',
    password: 'admin123',
    socials: {
      youtube: '',
      instagram: '',
      twitter: '',
      tiktok: ''
    }
  },

  // ── Configuración ─────────────────────────────────────────────────────────

  async getConfig() {
    try {
      const doc = await firestore.collection('sites').doc(this.siteId).get();
      if (!doc.exists) {
        // Si no existe, lo creamos con config por defecto
        await this.saveConfig(this.defaultConfig);
        return { ...this.defaultConfig };
      }
      return { ...this.defaultConfig, ...doc.data() };
    } catch (err) {
      console.error("Error obteniendo config:", err);
      return { ...this.defaultConfig };
    }
  },

  async saveConfig(config) {
    try {
      await firestore.collection('sites').doc(this.siteId).set(config, { merge: true });
      this.applyAccentColor(config.accentColor);
      return true;
    } catch (err) {
      console.error("Error guardando config:", err);
      return false;
    }
  },

  applyAccentColor(color) {
    if (!color) return;
    document.documentElement.style.setProperty('--accent-primary', color);
    document.documentElement.style.setProperty('--accent-secondary', color + 'BB');
  },

  // ── Artículos ─────────────────────────────────────────────────────────────

  async getArticles() {
    try {
      const snapshot = await firestore.collection('articles')
        .where('siteId', '==', this.siteId)
        .get();
      
      const articles = [];
      snapshot.forEach(doc => {
        articles.push({ id: doc.id, ...doc.data() });
      });
      return articles;
    } catch (err) {
      console.error("Error obteniendo artículos:", err);
      return [];
    }
  },

  async getPublishedArticles() {
    const articles = await this.getArticles();
    return articles
      .filter(a => a.status === 'published')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  async getArticleById(id) {
    try {
      const doc = await firestore.collection('articles').doc(id).get();
      if (!doc.exists) return null;
      const data = doc.data();
      // Validar que pertenezca a este sitio
      if (data.siteId !== this.siteId) return null;
      return { id: doc.id, ...data };
    } catch (err) {
      console.error("Error obteniendo artículo:", err);
      return null;
    }
  },

  async saveArticle(article) {
    try {
      const articleData = { ...article, siteId: this.siteId };
      const id = articleData.id;
      delete articleData.id; // No guardar el id dentro del documento

      if (id) {
        await firestore.collection('articles').doc(id).set(articleData);
        return { id, ...articleData };
      } else {
        const docRef = await firestore.collection('articles').add(articleData);
        return { id: docRef.id, ...articleData };
      }
    } catch (err) {
      console.error("Error guardando artículo:", err);
      throw err;
    }
  },

  async deleteArticle(id) {
    try {
      await firestore.collection('articles').doc(id).delete();
    } catch (err) {
      console.error("Error borrando artículo:", err);
      throw err;
    }
  },

  generateId() {
    // Ya no es estrictamente necesario, Firestore genera IDs, pero lo mantenemos por compatibilidad.
    return firestore.collection('articles').doc().id;
  },

  // ── Autenticación ─────────────────────────────────────────────────────────

  async checkPassword(password) {
    const config = await this.getConfig();
    return config.password === password;
  },

  isLoggedIn() {
    return sessionStorage.getItem(`vlog_admin_auth_${this.siteId}`) === 'true';
  },

  login() {
    sessionStorage.setItem(`vlog_admin_auth_${this.siteId}`, 'true');
  },

  logout() {
    sessionStorage.removeItem(`vlog_admin_auth_${this.siteId}`);
  },

  // ── Imágenes y YouTube (se mantienen igual que antes) ─────────────────────

  resizeImage(file, maxWidth = 1200, quality = 0.85) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('El archivo no es una imagen.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(file);
    });
  },

  getYouTubeId(url) {
    if (!url || typeof url !== 'string') return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
      /(?:youtu\.be\/)([^&\n?#]+)/,
      /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
      /(?:youtube\.com\/shorts\/)([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  },

  getYouTubeEmbed(url) {
    const id = this.getYouTubeId(url);
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
  },

  // ── Utilidades ────────────────────────────────────────────────────────────

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  getExcerpt(htmlContent, maxLength = 150) {
    if (!htmlContent) return '';
    const text = htmlContent.replace(/<[^>]*>/g, '').trim();
    return text.length > maxLength ? text.substring(0, maxLength).trim() + '…' : text;
  }
};
