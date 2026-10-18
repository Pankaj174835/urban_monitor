/**
 * Authentication and Session Management
 */

const Auth = {
  getUser() {
    try {
      const data = localStorage.getItem('user');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  getToken() {
    return localStorage.getItem('token');
  },

  isLoggedIn() {
    return !!(this.getToken() && this.getUser());
  },

  getRole() {
    const user = this.getUser();
    return user ? user.role : 'guest';
  },

  logout() {
    API.post('/api/auth/logout').catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
  },

  requireAuth(allowedRoles = []) {
    if (!this.isLoggedIn()) {
      window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
      return false;
    }

    const role = this.getRole();
    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      alert(`Access restricted. Your account role (${role}) cannot access this section.`);
      if (role === 'admin') window.location.href = '/admin-dashboard.html';
      else window.location.href = '/citizen-dashboard.html';
      return false;
    }

    return true;
  },

  renderHeader() {
    const headerContainer = document.getElementById('main-header');
    if (!headerContainer) return;

    const user = this.getUser();
    const loggedIn = this.isLoggedIn();

    let userDropdownHtml = '';
    if (loggedIn) {
      const roleBadges = {
        citizen: '<span class="badge bg-primary">Citizen</span>',
        admin: '<span class="badge bg-danger">Municipal Admin</span>'
      };

      const dashboardLinks = {
        citizen: '/citizen-dashboard.html',
        admin: '/admin-dashboard.html'
      };

      userDropdownHtml = `
        <div class="d-flex align-items-center gap-3">
          <a href="/notifications.html" class="notif-bell-btn text-decoration-none" title="Notifications">
            <i class="bi bi-bell-fill"></i>
            <span id="header-notif-badge" class="notif-badge-count d-none">0</span>
          </a>
          <div class="dropdown">
            <button class="btn btn-sm btn-outline-secondary dropdown-toggle d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown">
              <i class="bi bi-person-circle fs-6"></i>
              <span class="fw-semibold text-truncate" style="max-width:140px;">${user.name}</span>
              ${roleBadges[user.role] || ''}
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0">
              <li><h6 class="dropdown-header">${user.email}</h6></li>
              <li><a class="dropdown-item" href="${dashboardLinks[user.role] || '/citizen-dashboard.html'}"><i class="bi bi-speedometer2 me-2"></i>My Dashboard</a></li>
              <li><a class="dropdown-item" href="/risk-map.html"><i class="bi bi-geo-alt me-2"></i>Risk Map</a></li>
              <li><a class="dropdown-item" href="/notifications.html"><i class="bi bi-bell me-2"></i>Notifications</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item text-danger" href="javascript:void(0)" onclick="Auth.logout()"><i class="bi bi-box-arrow-right me-2"></i>Log Out</a></li>
            </ul>
          </div>
        </div>
      `;
    } else {
      userDropdownHtml = `
        <div class="d-flex align-items-center gap-2">
          <a href="/login.html" class="btn btn-outline-primary btn-sm px-3 fw-semibold">Sign In</a>
          <a href="/register.html" class="btn btn-primary btn-sm px-3 fw-semibold">Register</a>
        </div>
      `;
    }

    headerContainer.innerHTML = `
      <div class="gov-topbar">
        <div class="container d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-3">
            <span><i class="bi bi-building me-1"></i> Municipal Urban Drainage Operations</span>
            <span class="d-none d-md-inline text-secondary">|</span>
            <span class="d-none d-md-inline"><i class="bi bi-shield-check me-1"></i> Smart City Safety Initiative</span>
          </div>
          <div class="d-flex align-items-center gap-3">
            <a href="/about.html" class="text-white text-decoration-none"><i class="bi bi-info-circle me-1"></i>About System</a>
          </div>
        </div>
      </div>
      <nav class="navbar navbar-expand-lg main-navbar sticky-top">
        <div class="container">
          <a class="navbar-brand-custom" href="/index.html">
            <img src="/assets/images/logo.svg" alt="Smart Drain Monitor Logo">
            <div>
              <div class="brand-text-title text-dark">UrbanDrain<span class="text-primary">Monitor</span></div>
              <div class="brand-text-subtitle text-primary">Early Detection. Smart Analysis. Timely Action.</div>
            </div>
          </a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navContent">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="navContent">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-4">
              <li class="nav-item"><a class="nav-link nav-link-custom" href="/index.html">Home</a></li>
              <li class="nav-item"><a class="nav-link nav-link-custom" href="/report-problem.html">Report Issue</a></li>
              <li class="nav-item"><a class="nav-link nav-link-custom" href="/risk-map.html">Risk Map</a></li>
              <li class="nav-item"><a class="nav-link nav-link-custom" href="/hotspots.html">Hotspots</a></li>
              <li class="nav-item"><a class="nav-link nav-link-custom" href="/sustainability.html">Sustainability</a></li>
              <li class="nav-item"><a class="nav-link nav-link-custom" href="/prevention-insights.html">Prevention</a></li>
            </ul>
            ${userDropdownHtml}
          </div>
        </div>
      </nav>
    `;

    if (loggedIn) {
      window.updateNotificationBadge = async () => {
        try {
          const res = await API.get('/api/notifications');
          const badge = document.getElementById('header-notif-badge');
          if (badge && res.unreadCount > 0) {
            badge.textContent = res.unreadCount;
            badge.classList.remove('d-none');
          } else if (badge) {
            badge.classList.add('d-none');
          }
        } catch (e) {}
      };
      window.updateNotificationBadge();
    }
  },

  renderSidebar(activePage = '') {
    const sidebar = document.getElementById('dashboard-sidebar');
    if (!sidebar) return;

    const user = this.getUser();
    if (!user) return;

    let navItems = [];

    if (user.role === 'admin') {
      navItems = [
        { href: '/admin-dashboard.html', icon: 'bi-speedometer2', label: 'Admin Dashboard', id: 'admin-dashboard' },
        { href: '/manage-reports.html', icon: 'bi-file-earmark-medical-fill', label: 'All Citizen Reports', id: 'manage-reports' },
        { href: '/risk-map.html', icon: 'bi-map-fill', label: 'Risk Map', id: 'risk-map' },
        { href: '/risk-map.html?layer=heatmap', icon: 'bi-layers-fill', label: 'Heatmap', id: 'heatmap' },
        { href: '/risk-map.html?layer=risk-areas', icon: 'bi-shield-shaded', label: 'Risk Areas', id: 'risk-areas' },
        { href: '/admin-dashboard.html#analytics', icon: 'bi-bar-chart-line-fill', label: 'Complaint Analytics', id: 'analytics' },
        { href: '/hotspots.html', icon: 'bi-fire', label: 'Recurring Hotspots', id: 'hotspots' },
        { href: '/notifications.html', icon: 'bi-bell-fill', label: 'Notifications', id: 'notifications' },
        { href: '/sustainability.html', icon: 'bi-recycle', label: 'Sustainability Insights', id: 'sustainability' }
      ];
    } else {
      // Citizen
      navItems = [
        { href: '/citizen-dashboard.html', icon: 'bi-speedometer2', label: 'My Citizen Dashboard', id: 'citizen-dashboard' },
        { href: '/report-problem.html', icon: 'bi-plus-circle-fill', label: 'Report Drainage Problem', id: 'report-problem' },
        { href: '/my-reports.html', icon: 'bi-card-checklist', label: 'My Complaints History', id: 'my-reports' },
        { href: '/risk-map.html', icon: 'bi-geo-alt-fill', label: 'Live Drainage Map', id: 'risk-map' },
        { href: '/hotspots.html', icon: 'bi-fire', label: 'Drainage Hotspots', id: 'hotspots' },
        { href: '/sustainability.html', icon: 'bi-recycle', label: 'Sustainability Metrics', id: 'sustainability' },
        { href: '/notifications.html', icon: 'bi-bell-fill', label: 'In-App Alerts', id: 'notifications' }
      ];
    }

    const roleTitles = {
      admin: 'MUNICIPAL OPERATIONS',
      citizen: 'CITIZEN SERVICES'
    };

    sidebar.innerHTML = `
      <div class="p-3 border-bottom border-secondary d-flex align-items-center gap-3">
        <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width:40px;height:40px;">
          ${user.name.charAt(0).toUpperCase()}
        </div>
        <div class="overflow-hidden">
          <div class="fw-bold text-white text-truncate">${user.name}</div>
          <div class="text-secondary small text-uppercase" style="font-size:0.7rem;">${user.role}</div>
        </div>
      </div>
      <div class="sidebar-heading">${roleTitles[user.role] || 'NAVIGATION'}</div>
      <nav class="nav flex-column mb-auto">
        ${navItems.map(item => `
          <a class="sidebar-nav-link ${activePage === item.id ? 'active' : ''}" href="${item.href}">
            <i class="bi ${item.icon}"></i>
            <span>${item.label}</span>
          </a>
        `).join('')}
      </nav>
      <div class="p-3 border-top border-secondary mt-auto">
        <div class="small text-muted mb-2"><i class="bi bi-shield-lock me-1"></i> Role: ${user.role.toUpperCase()}</div>
        <button class="btn btn-outline-danger btn-sm w-100 fw-semibold" onclick="Auth.logout()">
          <i class="bi bi-box-arrow-right me-1"></i> Log Out
        </button>
      </div>
    `;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Auth.renderHeader();
});
