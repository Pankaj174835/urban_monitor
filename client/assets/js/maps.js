/**
 * Interactive Leaflet Map Utilities
 */

const MapUtils = {
  defaultCenter: [19.4635, 72.8025], // Virar West, Maharashtra
  defaultZoom: 13,

  createIcon(color = '#dc2626') {
    return L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="background-color:${color};width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #ffffff;box-shadow:0 3px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
          <div style="width:8px;height:8px;background:#ffffff;border-radius:50%;"></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28]
    });
  },

  getRiskColor(riskLevel, status) {
    if (status === 'COMPLETED') return '#059669'; // Green / resolved
    if (riskLevel === 'HIGH') return '#dc2626'; // Red
    if (riskLevel === 'MEDIUM') return '#d97706'; // Orange
    return '#2563eb'; // Blue
  },

  initMap(containerId, options = {}) {
    const center = options.center || this.defaultCenter;
    const zoom = options.zoom || this.defaultZoom;

    const map = L.map(containerId, {
      zoomControl: true,
      attributionControl: true
    }).setView(center, zoom);

    // OpenStreetMap standard tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    return map;
  },

  createReportPopup(report) {
    const badgeColors = {
      HIGH: 'bg-danger text-white',
      MEDIUM: 'bg-warning text-dark',
      LOW: 'bg-success text-white'
    };

    const statusBadgeColors = {
      SUBMITTED: 'bg-primary text-white',
      'UNDER INSPECTION': 'bg-purple text-white',
      'CLEANING STARTED': 'bg-warning text-dark',
      COMPLETED: 'bg-success text-white',
      REJECTED: 'bg-secondary text-white'
    };

    const formattedDate = new Date(report.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div style="min-width:240px;max-width:300px;font-family:'Plus Jakarta Sans',sans-serif;">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span class="badge ${badgeColors[report.riskLevel] || 'bg-secondary'}">${report.riskLevel} RISK (${report.riskScore}/100)</span>
          <span class="badge ${statusBadgeColors[report.status] || 'bg-light text-dark'}">${report.status}</span>
        </div>
        <h6 class="fw-bold mb-1 mt-2 text-dark">${report.reportId}: ${report.problemType}</h6>
        <div class="small text-muted mb-2"><i class="bi bi-geo-alt-fill text-danger me-1"></i>${report.locationName}</div>
        
        ${report.photoUrl ? `
          <div class="mb-2 rounded overflow-hidden" style="max-height:120px;">
            <img src="${report.photoUrl}" alt="Evidence" style="width:100%;height:120px;object-fit:cover;">
          </div>
        ` : ''}

        <div class="small mb-1"><strong>Water Level:</strong> <span class="badge bg-light text-dark border">${report.waterLevel}</span></div>
        <div class="small mb-2"><strong>Reported:</strong> ${formattedDate}</div>
        
        <p class="small text-secondary mb-2" style="max-height:60px;overflow:hidden;text-overflow:ellipsis;">
          ${report.description || ''}
        </p>

        <a href="/report-details.html?id=${report.reportId}" class="btn btn-primary btn-sm w-100 fw-semibold text-white">
          <i class="bi bi-eye-fill me-1"></i> View Full Timeline
        </a>
      </div>
    `;
  }
};
