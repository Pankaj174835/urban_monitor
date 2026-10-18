/**
 * API Wrapper & Realtime Client
 */

const API = {
  baseUrl: '',

  getToken() {
    return localStorage.getItem('token');
  },

  getHeaders(isFormData = false) {
    const headers = {};
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  },

  async request(endpoint, options = {}) {
    const isFormData = options.body instanceof FormData;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(isFormData),
        ...(options.headers || {})
      }
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/login') && !endpoint.includes('/register')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (window.location.pathname !== '/login.html' && window.location.pathname !== '/index.html') {
            window.location.href = '/login.html?expired=true';
          }
        }
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  },

  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { method: 'GET' });
  },

  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  upload(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData
    });
  },

  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColors = {
      success: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
      info: '#2563eb'
    };
    const iconMap = {
      success: 'bi-check-circle-fill',
      danger: 'bi-exclamation-triangle-fill',
      warning: 'bi-exclamation-circle-fill',
      info: 'bi-info-circle-fill'
    };

    toast.className = 'toast-custom shadow-lg';
    toast.style.cssText = `background:${bgColors[type] || bgColors.info};color:#fff;padding:12px 18px;border-radius:8px;font-size:0.875rem;font-weight:600;display:flex;align-items:center;gap:10px;min-width:280px;box-shadow:0 8px 16px rgba(0,0,0,0.15);animation:fadeIn 0.2s ease;`;
    toast.innerHTML = `<i class="bi ${iconMap[type] || 'bi-info-circle-fill'}"></i><span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};

// Real-time socket initialization
let socketClient = null;
function initRealtimeUpdates() {
  if (typeof io !== 'undefined') {
    socketClient = io();
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user && user._id) {
      socketClient.on(`notification:${user._id}`, (notification) => {
        API.showToast(notification.title, 'warning');
        // Refresh unread count if badge exists
        if (window.updateNotificationBadge) {
          window.updateNotificationBadge();
        }
      });
    }

    socketClient.on('global:notification', (notification) => {
      if (notification.type === 'HIGH_RISK_ALERT') {
        API.showToast(`Emergency Drainage Alert: ${notification.title}`, 'danger');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initRealtimeUpdates();
});
