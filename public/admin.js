/**
 * Timeless Studio 21 — Comprehensive Administrative Operations & CMS Logic
 * Manages: Inquiries & Bookings, Package Catalog, Portfolio Works, Client Testimonials, FAQs, Studio Settings & PIN
 */

let adminToken = sessionStorage.getItem('ts21_admin_token') || '';
let currentView = 'inquiries';

// Data State
let inquiriesList = [];
let packagesList = [];
let portfolioList = [];
let mediaList = [];
let testimonialsList = [];
let faqsList = [];
let settingsData = {};

// Filter & Selection State
let activeStatus = 'All';
let currentSearch = '';
let activePkgCat = 'All';
let activePortCat = 'All';
let activeMediaSource = 'all';
let currentMediaSearch = '';
let currentInquiry = null;

const formatPeso = (n) => '₱' + Number(n).toLocaleString('en-PH');

// XSS Sanitizer Utility
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// Toast Notification Helper
function showToast(message, isError = false) {
  const container = document.getElementById('admin-toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'admin-toast';
  if (isError) {
    toast.style.borderColor = '#ef4444';
  }
  toast.innerHTML = `<span>${isError ? '⚠️' : '✨'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Authenticated API Fetch Wrapper
async function apiFetch(url, options = {}) {
  const headers = options.headers || {};
  headers['Authorization'] = `Bearer ${adminToken}`;
  headers['Content-Type'] = headers['Content-Type'] || 'application/json';

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    handleAuthExpired();
    throw new Error('Unauthorized');
  }
  return res;
}

// Upload Media File from Client PC via Multipart Form Data
async function uploadMediaApi(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    },
    body: formData
  });

  if (res.status === 401) {
    handleAuthExpired();
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload image from PC');
  }
  return data;
}

// Handle Session Expiry or Invalidation
function handleAuthExpired() {
  adminToken = '';
  sessionStorage.removeItem('ts21_admin_token');
  const loginScreen = document.getElementById('login-screen');
  const dashboardLayout = document.getElementById('dashboard-layout');
  if (dashboardLayout) {
    dashboardLayout.hidden = true;
    dashboardLayout.style.display = 'none';
  }
  if (loginScreen) {
    loginScreen.hidden = false;
    loginScreen.style.display = 'flex';
  }
  checkSetupAndAuthStatus().then(() => {
    const loginError = document.getElementById('login-error');
    if (loginError) {
      loginError.textContent = 'Session expired. Please sign in to continue.';
      loginError.hidden = false;
      loginError.style.display = 'block';
    }
  });
}

// Check if first-time master setup is completed
async function checkSetupAndAuthStatus() {
  const setupCard = document.getElementById('setup-card');
  const loginCard = document.getElementById('login-card');
  const loginScreen = document.getElementById('login-screen');
  const dashboardLayout = document.getElementById('dashboard-layout');

  try {
    const res = await fetch('/api/admin/setup-status');
    const data = await res.json();
    const isSetup = Boolean(data && data.setupCompleted);

    if (!isSetup) {
      // First-time setup required: force setup wizard
      if (setupCard) {
        setupCard.hidden = false;
        setupCard.style.display = 'block';
      }
      if (loginCard) {
        loginCard.hidden = true;
        loginCard.style.display = 'none';
      }
      if (loginScreen) {
        loginScreen.hidden = false;
        loginScreen.style.display = 'flex';
      }
      if (dashboardLayout) {
        dashboardLayout.hidden = true;
        dashboardLayout.style.display = 'none';
      }
      return false;
    } else {
      // Setup completed: display standard login card
      if (setupCard) {
        setupCard.hidden = true;
        setupCard.style.display = 'none';
      }
      if (loginCard) {
        loginCard.hidden = false;
        loginCard.style.display = 'block';
      }
      return true;
    }
  } catch (err) {
    console.error('Failed to verify setup status:', err);
    return true;
  }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  setupAdminAuth();
  setupViewTabs();
  setupInquiryHandlers();
  setupPackageHandlers();
  setupPortfolioHandlers();
  setupMediaHandlers();
  setupTestimonialHandlers();
  setupFaqHandlers();
  setupSettingsHandlers();
  setupTopbarAddButton();

  const isConfigured = await checkSetupAndAuthStatus();
  if (isConfigured && adminToken) {
    showDashboard();
  }
});

// Setup Authentication Form
function setupAdminAuth() {
  const setupForm = document.getElementById('admin-setup-form');
  const setupError = document.getElementById('setup-error');
  const setupSubmitBtn = document.getElementById('btn-setup-submit');

  const loginForm = document.getElementById('admin-login-form');
  const loginError = document.getElementById('login-error');
  const loginSubmitBtn = document.getElementById('btn-login-submit');
  const logoutBtn = document.getElementById('btn-logout');

  // 1. Initial Master Setup Form Submission
  if (setupForm) {
    setupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = (document.getElementById('setup-username')?.value || '').trim();
      const password = (document.getElementById('setup-password')?.value || '').trim();
      const confirmPassword = (document.getElementById('setup-confirm-password')?.value || '').trim();

      if (setupError) {
        setupError.hidden = true;
        setupError.style.display = 'none';
      }

      if (!username || username.length < 3) {
        if (setupError) {
          setupError.textContent = 'Master username must be at least 3 characters long.';
          setupError.hidden = false;
          setupError.style.display = 'block';
        }
        return;
      }

      if (!password || password.length < 8) {
        if (setupError) {
          setupError.textContent = 'Master password must be at least 8 characters long.';
          setupError.hidden = false;
          setupError.style.display = 'block';
        }
        return;
      }

      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        if (setupError) {
          setupError.textContent = 'Master password must contain both letters and numbers.';
          setupError.hidden = false;
          setupError.style.display = 'block';
        }
        return;
      }

      if (password !== confirmPassword) {
        if (setupError) {
          setupError.textContent = 'Password confirmation does not match.';
          setupError.hidden = false;
          setupError.style.display = 'block';
        }
        return;
      }

      if (setupSubmitBtn) {
        setupSubmitBtn.disabled = true;
        setupSubmitBtn.textContent = 'Initializing Security...';
      }

      try {
        const res = await fetch('/api/admin/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, confirmPassword })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to complete security setup');

        adminToken = data.token;
        sessionStorage.setItem('ts21_admin_token', adminToken);
        await checkSetupAndAuthStatus();
        await showDashboard();
        showToast('Master security account created! Welcome to Studio Operations.');
      } catch (err) {
        if (setupError) {
          setupError.textContent = err.message;
          setupError.hidden = false;
          setupError.style.display = 'block';
        }
      } finally {
        if (setupSubmitBtn) {
          setupSubmitBtn.disabled = false;
          setupSubmitBtn.textContent = 'Initialize & Access Dashboard →';
        }
      }
    });
  }

  // 2. Standard Admin Login Form Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('admin-username-input');
      const passwordInput = document.getElementById('admin-password-input');
      const username = (usernameInput ? usernameInput.value : '').trim();
      const password = (passwordInput ? passwordInput.value : '').trim();

      if (loginError) {
        loginError.hidden = true;
        loginError.style.display = 'none';
      }

      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.textContent = 'Signing in...';
      }

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok) {
          if (data.needsSetup) {
            await checkSetupAndAuthStatus();
          }
          throw new Error(data.error || 'Invalid credentials');
        }

        adminToken = data.token;
        sessionStorage.setItem('ts21_admin_token', adminToken);
        await showDashboard();
        showToast(`Welcome back, ${data.username || 'Administrator'}!`);
      } catch (err) {
        if (loginError) {
          loginError.textContent = err.message;
          loginError.hidden = false;
          loginError.style.display = 'block';
        }
      } finally {
        if (loginSubmitBtn) {
          loginSubmitBtn.disabled = false;
          loginSubmitBtn.textContent = 'Sign In to Operations Hub →';
        }
      }
    });
  }

  // 3. Sign Out
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      adminToken = '';
      sessionStorage.removeItem('ts21_admin_token');
      const loginScreen = document.getElementById('login-screen');
      const dashboardLayout = document.getElementById('dashboard-layout');
      if (dashboardLayout) {
        dashboardLayout.hidden = true;
        dashboardLayout.style.display = 'none';
      }
      if (loginScreen) {
        loginScreen.hidden = false;
        loginScreen.style.display = 'flex';
      }
      const uInput = document.getElementById('admin-username-input');
      const pInput = document.getElementById('admin-password-input');
      if (uInput) uInput.value = '';
      if (pInput) pInput.value = '';
      checkSetupAndAuthStatus();
    });
  }
}

// Show Dashboard & Load Data
async function showDashboard() {
  const loginScreen = document.getElementById('login-screen');
  const dashboardLayout = document.getElementById('dashboard-layout');

  if (loginScreen) {
    loginScreen.hidden = true;
    loginScreen.style.display = 'none';
  }
  if (dashboardLayout) {
    dashboardLayout.hidden = false;
    dashboardLayout.style.display = 'flex';
  }

  const dateElem = document.getElementById('topbar-current-date');
  if (dateElem) {
    dateElem.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Load all initial data in parallel
  await Promise.all([
    fetchStats(),
    fetchInquiries(),
    fetchPackages(),
    fetchPortfolio(),
    fetchMedia(),
    fetchTestimonials(),
    fetchFaqs(),
    fetchSettings()
  ]);

  // Set default view
  switchView(currentView);
}

// Setup Topbar Refresh Button
document.getElementById('btn-refresh-data')?.addEventListener('click', async () => {
  await Promise.all([
    fetchStats(),
    fetchInquiries(),
    fetchPackages(),
    fetchPortfolio(),
    fetchMedia(),
    fetchTestimonials(),
    fetchFaqs(),
    fetchSettings()
  ]);
  showToast('Dashboard data refreshed!');
});

// Setup Dynamic Topbar Primary Button (+ New Booking / + New Package / etc)
function setupTopbarAddButton() {
  const topbarBtn = document.getElementById('btn-topbar-add');
  if (!topbarBtn) return;

  topbarBtn.addEventListener('click', () => {
    if (currentView === 'inquiries') {
      document.getElementById('admin-new-inquiry-modal').showModal();
    } else if (currentView === 'packages') {
      openPackageModal(null);
    } else if (currentView === 'portfolio') {
      openPortfolioModal(null);
    } else if (currentView === 'media') {
      document.getElementById('media-page-upload-input').click();
    } else if (currentView === 'testimonials') {
      openTestimonialModal(null);
    } else if (currentView === 'faqs') {
      openFaqModal(null);
    }
  });
}

// ==========================================
// VIEW SWITCHING LOGIC
// ==========================================
function setupViewTabs() {
  const menuToggle = document.getElementById('btn-admin-menu-toggle');
  const sidebar = document.querySelector('.admin-sidebar');
  const backdrop = document.getElementById('admin-sidebar-backdrop');
  const closeBtn = document.getElementById('btn-sidebar-close');

  const closeSidebar = () => {
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('open');
    document.body.style.overflow = '';
  };

  const openSidebar = () => {
    sidebar?.classList.add('open');
    backdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  closeBtn?.addEventListener('click', closeSidebar);
  backdrop?.addEventListener('click', closeSidebar);

  document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      closeSidebar();
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

function switchView(viewName) {
  currentView = viewName;

  // View IDs map
  const views = ['inquiries', 'packages', 'portfolio', 'media', 'testimonials', 'faqs', 'settings'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      if (v === viewName) {
        el.hidden = false;
        el.style.display = 'block';
      } else {
        el.hidden = true;
        el.style.display = 'none';
      }
    }
  });

  const titleEl = document.getElementById('topbar-page-title');
  const exportBtn = document.getElementById('btn-export-csv');
  const addBtn = document.getElementById('btn-topbar-add');

  if (viewName === 'inquiries') {
    if (titleEl) titleEl.textContent = 'Inquiries & Schedule Management';
    if (exportBtn) exportBtn.style.display = 'inline-block';
    if (addBtn) {
      addBtn.style.display = 'inline-block';
      addBtn.textContent = '+ New Booking';
    }
  } else if (viewName === 'packages') {
    if (titleEl) titleEl.textContent = 'Studio Packages & Pricing Catalog';
    if (exportBtn) exportBtn.style.display = 'none';
    if (addBtn) {
      addBtn.style.display = 'inline-block';
      addBtn.textContent = '+ Add Package';
    }
  } else if (viewName === 'portfolio') {
    if (titleEl) titleEl.textContent = 'Portfolio Showcase & Works';
    if (exportBtn) exportBtn.style.display = 'none';
    if (addBtn) {
      addBtn.style.display = 'inline-block';
      addBtn.textContent = '+ Add Work';
    }
  } else if (viewName === 'media') {
    if (titleEl) titleEl.textContent = 'Studio Media Library & PC Uploads';
    if (exportBtn) exportBtn.style.display = 'none';
    if (addBtn) {
      addBtn.style.display = 'inline-block';
      addBtn.textContent = '+ Upload from PC';
    }
  } else if (viewName === 'testimonials') {
    if (titleEl) titleEl.textContent = 'Client Notes & Testimonials';
    if (exportBtn) exportBtn.style.display = 'none';
    if (addBtn) {
      addBtn.style.display = 'inline-block';
      addBtn.textContent = '+ Add Review';
    }
  } else if (viewName === 'faqs') {
    if (titleEl) titleEl.textContent = 'Frequently Asked Questions (FAQ)';
    if (exportBtn) exportBtn.style.display = 'none';
    if (addBtn) {
      addBtn.style.display = 'inline-block';
      addBtn.textContent = '+ Add FAQ';
    }
  } else if (viewName === 'settings') {
    if (titleEl) titleEl.textContent = 'Studio Profile & Security PIN';
    if (exportBtn) exportBtn.style.display = 'none';
    if (addBtn) addBtn.style.display = 'none';
  }
}

// ==========================================
// 1. INQUIRIES & BOOKINGS LOGIC
// ==========================================

async function fetchStats() {
  try {
    const res = await apiFetch('/api/admin/stats');
    if (!res.ok) return;
    const stats = await res.json();
    document.getElementById('kpi-total').textContent = stats.total || 0;
    document.getElementById('kpi-new').textContent = stats.newCount || 0;
    document.getElementById('kpi-confirmed').textContent = stats.confirmed || 0;
    document.getElementById('kpi-pipeline').textContent = formatPeso(stats.totalPipeline || 0);
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

async function fetchInquiries() {
  try {
    const res = await apiFetch('/api/admin/inquiries?limit=300');
    if (!res.ok) return;
    inquiriesList = await res.json();
    renderInquiriesTable();
  } catch (err) {
    console.error('Error loading inquiries:', err);
  }
}

function renderInquiriesTable() {
  const tbody = document.getElementById('inquiries-tbody');
  if (!tbody) return;

  let filtered = inquiriesList;
  if (activeStatus !== 'All') {
    filtered = filtered.filter(inq => inq.status === activeStatus);
  }

  if (currentSearch.trim()) {
    const term = currentSearch.toLowerCase().trim();
    filtered = filtered.filter(inq => 
      inq.client_name?.toLowerCase().includes(term) ||
      inq.reference_code?.toLowerCase().includes(term) ||
      inq.contact_number?.toLowerCase().includes(term) ||
      inq.package_name?.toLowerCase().includes(term) ||
      inq.ceremony_venue?.toLowerCase().includes(term) ||
      inq.reception_venue?.toLowerCase().includes(term)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 3rem; color: var(--admin-muted);">
          No inquiries found matching the selected criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(inq => {
    const statusClass = escapeHtml(inq.status.toLowerCase().replace(/\s+/g, '-'));
    const createdDate = inq.created_at ? new Date(inq.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const eventInfo = inq.event_date ? `<strong>${escapeHtml(inq.event_date)}</strong>` : '<span style="color: var(--admin-subtle);">Unscheduled</span>';
    const venueText = [inq.ceremony_venue, inq.reception_venue].filter(Boolean).map(escapeHtml).join(' • ');

    return `
      <tr data-id="${inq.id}">
        <td><span class="ref-code-pill">${escapeHtml(inq.reference_code)}</span></td>
        <td>
          <span class="client-name-bold">${escapeHtml(inq.client_name)}</span>
          ${inq.facebook_name ? `<br><small style="color: var(--admin-muted);">fb: ${escapeHtml(inq.facebook_name)}</small>` : ''}
        </td>
        <td>
          <a href="tel:${escapeHtml(inq.contact_number)}" style="color: var(--admin-gold); font-weight: 600;">${escapeHtml(inq.contact_number)}</a>
        </td>
        <td>
          <strong>${escapeHtml(inq.package_name || inq.service_category)}</strong>
          ${inq.package_price ? `<br><small style="color: var(--admin-gold); font-weight: 700;">${formatPeso(inq.package_price)}</small>` : ''}
        </td>
        <td>
          ${eventInfo}
          ${venueText ? `<br><small style="color: var(--admin-muted);">${venueText}</small>` : ''}
        </td>
        <td><span class="badge-status ${statusClass}">${escapeHtml(inq.status)}</span></td>
        <td style="font-size: 0.8rem; color: var(--admin-muted);">${createdDate}</td>
        <td>
          <button type="button" class="btn-table-action btn-view-inquiry" data-id="${inq.id}">
            View &amp; Manage
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-view-inquiry').forEach(btn => {
    btn.addEventListener('click', () => openInquiryDetailModal(Number(btn.dataset.id)));
  });
}

function setupInquiryHandlers() {
  // Status filter tabs
  document.querySelectorAll('#status-tabs .status-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#status-tabs .status-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStatus = btn.dataset.status;
      renderInquiriesTable();
    });
  });

  // Search box
  const searchInput = document.getElementById('inquiry-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      renderInquiriesTable();
    });
  }

  // Export CSV
  document.getElementById('btn-export-csv')?.addEventListener('click', exportToCsv);

  // Edit Inquiry Form submission
  const editInqForm = document.getElementById('modal-inquiry-edit-form');
  if (editInqForm) {
    editInqForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentInquiry) return;

      const payload = {
        contact_number: document.getElementById('modal-edit-contact').value.trim(),
        facebook_name: document.getElementById('modal-edit-fb').value.trim(),
        email: document.getElementById('modal-edit-email').value.trim(),
        service_category: document.getElementById('modal-edit-category').value.trim(),
        package_name: document.getElementById('modal-edit-package').value.trim(),
        package_price: Number(document.getElementById('modal-edit-price').value) || 0,
        event_date: document.getElementById('modal-edit-date').value,
        program_time: document.getElementById('modal-edit-time').value.trim(),
        prep_location: document.getElementById('modal-edit-prep').value.trim(),
        ceremony_venue: document.getElementById('modal-edit-ceremony').value.trim(),
        reception_venue: document.getElementById('modal-edit-reception').value.trim(),
        guest_count: document.getElementById('modal-edit-guests').value.trim(),
        status: document.getElementById('modal-status-select').value,
        internal_notes: document.getElementById('modal-internal-notes').value.trim()
      };

      try {
        const res = await apiFetch(`/api/admin/inquiries/${currentInquiry.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to update inquiry');

        showToast(`Inquiry ${currentInquiry.reference_code} updated!`);
        document.getElementById('admin-inquiry-modal').close();
        await Promise.all([fetchStats(), fetchInquiries()]);
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  // Delete Inquiry Button
  document.getElementById('btn-delete-inquiry')?.addEventListener('click', async () => {
    if (!currentInquiry) return;
    if (!confirm(`Are you sure you want to permanently delete inquiry ${currentInquiry.reference_code} for ${currentInquiry.client_name}?`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/admin/inquiries/${currentInquiry.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete inquiry');

      showToast(`Inquiry ${currentInquiry.reference_code} deleted.`);
      document.getElementById('admin-inquiry-modal').close();
      await Promise.all([fetchStats(), fetchInquiries()]);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // New Manual Inquiry Form submission
  const newInqForm = document.getElementById('new-inquiry-form');
  if (newInqForm) {
    newInqForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        client_name: document.getElementById('new-inq-client').value.trim(),
        contact_number: document.getElementById('new-inq-contact').value.trim(),
        facebook_name: document.getElementById('new-inq-fb').value.trim(),
        email: document.getElementById('new-inq-email').value.trim(),
        service_category: document.getElementById('new-inq-category').value,
        package_name: document.getElementById('new-inq-package').value.trim(),
        package_price: Number(document.getElementById('new-inq-price').value) || 0,
        event_date: document.getElementById('new-inq-date').value,
        program_time: document.getElementById('new-inq-time').value.trim(),
        ceremony_venue: document.getElementById('new-inq-ceremony').value.trim(),
        reception_venue: document.getElementById('new-inq-reception').value.trim(),
        prep_location: document.getElementById('new-inq-prep').value.trim(),
        status: document.getElementById('new-inq-status').value,
        notes: document.getElementById('new-inq-notes').value.trim()
      };

      try {
        const res = await apiFetch('/api/admin/inquiries', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to create booking');
        const data = await res.json();

        showToast(`Booking ${data.inquiry.reference_code} created!`);
        newInqForm.reset();
        document.getElementById('admin-new-inquiry-modal').close();
        await Promise.all([fetchStats(), fetchInquiries()]);
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }
}

function openInquiryDetailModal(id) {
  currentInquiry = inquiriesList.find(inq => inq.id === id);
  if (!currentInquiry) return;

  document.getElementById('modal-ref-code').textContent = currentInquiry.reference_code;
  document.getElementById('modal-client-name').textContent = currentInquiry.client_name;
  document.getElementById('modal-edit-contact').value = currentInquiry.contact_number || '';
  document.getElementById('modal-call-link').href = `tel:${currentInquiry.contact_number}`;
  document.getElementById('modal-edit-fb').value = currentInquiry.facebook_name || '';
  document.getElementById('modal-edit-email').value = currentInquiry.email || '';
  document.getElementById('modal-edit-category').value = currentInquiry.service_category || '';
  document.getElementById('modal-edit-package').value = currentInquiry.package_name || '';
  document.getElementById('modal-edit-price').value = currentInquiry.package_price || '';
  document.getElementById('modal-edit-date').value = currentInquiry.event_date || '';
  document.getElementById('modal-edit-time').value = currentInquiry.program_time || '';
  document.getElementById('modal-edit-prep').value = currentInquiry.prep_location || '';
  document.getElementById('modal-edit-ceremony').value = currentInquiry.ceremony_venue || '';
  document.getElementById('modal-edit-reception').value = currentInquiry.reception_venue || '';
  document.getElementById('modal-edit-guests').value = currentInquiry.guest_count || '';
  document.getElementById('modal-client-notes').textContent = currentInquiry.notes || 'No special notes provided by client.';
  document.getElementById('modal-status-select').value = currentInquiry.status;
  document.getElementById('modal-internal-notes').value = currentInquiry.internal_notes || '';

  document.getElementById('admin-inquiry-modal').showModal();
}

function exportToCsv() {
  if (inquiriesList.length === 0) {
    showToast('No inquiries to export.', true);
    return;
  }

  const headers = ['Reference Code', 'Client Name', 'Facebook Name', 'Contact', 'Email', 'Category', 'Package', 'Price', 'Event Date', 'Time', 'Ceremony', 'Reception', 'Status', 'Client Notes', 'Internal Notes', 'Date Received'];
  const rows = inquiriesList.map(inq => [
    inq.reference_code,
    `"${(inq.client_name || '').replace(/"/g, '""')}"`,
    `"${(inq.facebook_name || '').replace(/"/g, '""')}"`,
    `"${inq.contact_number}"`,
    `"${inq.email || ''}"`,
    `"${inq.service_category || ''}"`,
    `"${(inq.package_name || '').replace(/"/g, '""')}"`,
    inq.package_price || 0,
    `"${inq.event_date || ''}"`,
    `"${inq.program_time || ''}"`,
    `"${(inq.ceremony_venue || '').replace(/"/g, '""')}"`,
    `"${(inq.reception_venue || '').replace(/"/g, '""')}"`,
    inq.status,
    `"${(inq.notes || '').replace(/"/g, '""')}"`,
    `"${(inq.internal_notes || '').replace(/"/g, '""')}"`,
    inq.created_at
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `timeless_studio21_inquiries_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Inquiries CSV exported successfully!');
}

// ==========================================
// 2. PACKAGES & PRICING LOGIC
// ==========================================

async function fetchPackages() {
  try {
    const res = await apiFetch('/api/admin/packages');
    if (!res.ok) return;
    packagesList = await res.json();
    renderAdminPackages();
  } catch (err) {
    console.error('Error fetching packages:', err);
  }
}

function renderAdminPackages() {
  const container = document.getElementById('admin-package-list');
  if (!container) return;

  let filtered = packagesList;
  if (activePkgCat !== 'All') {
    filtered = filtered.filter(p => p.category === activePkgCat);
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--admin-muted);">No packages found in this category.</div>`;
    return;
  }

  container.innerHTML = filtered.map(pkg => `
    <article class="admin-pkg-card ${pkg.is_active ? '' : 'inactive'}">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <span class="badge-ref" style="font-size: 0.72rem;">${pkg.category}</span>
        <div>
          ${pkg.badge ? `<span style="font-size: 0.7rem; background: var(--admin-gold); color: #000; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 800; margin-right: 0.4rem;">${pkg.badge}</span>` : ''}
          <span class="${pkg.is_active ? 'badge-active' : 'badge-inactive'}">${pkg.is_active ? 'Active' : 'Hidden'}</span>
        </div>
      </div>
      <h3>${pkg.name}</h3>
      <div class="pkg-price">${formatPeso(pkg.price)}</div>
      <p style="font-size: 0.82rem; color: var(--admin-muted); margin-bottom: 0.8rem;">${pkg.short_desc || ''}</p>
      
      <ul>
        ${(pkg.inclusions || []).slice(0, 5).map(inc => `<li>✓ ${inc}</li>`).join('')}
        ${pkg.inclusions && pkg.inclusions.length > 5 ? `<li style="color: var(--admin-gold); font-style: italic;">+ ${pkg.inclusions.length - 5} more inclusions...</li>` : ''}
      </ul>

      <div class="card-actions-row">
        <button type="button" class="btn-admin-secondary btn-sm btn-edit-package" data-id="${pkg.id}" style="flex: 1;">
          ✏️ Edit
        </button>
        <button type="button" class="btn-admin-secondary btn-sm btn-toggle-package" data-id="${pkg.id}" data-active="${pkg.is_active}">
          ${pkg.is_active ? '👁️ Hide' : '✨ Show'}
        </button>
        <button type="button" class="btn-danger btn-sm btn-delete-package" data-id="${pkg.id}">
          🗑️
        </button>
      </div>
    </article>
  `).join('');

  // Wire buttons
  container.querySelectorAll('.btn-edit-package').forEach(btn => {
    btn.addEventListener('click', () => openPackageModal(btn.dataset.id));
  });

  container.querySelectorAll('.btn-toggle-package').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const current = btn.dataset.active === '1' || btn.dataset.active === 'true';
      try {
        const res = await apiFetch(`/api/admin/packages/${id}/toggle`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !current })
        });
        if (!res.ok) throw new Error('Failed to toggle package');
        showToast(`Package visibility updated!`);
        await fetchPackages();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });

  container.querySelectorAll('.btn-delete-package').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const pkg = packagesList.find(p => p.id === id);
      if (!confirm(`Are you sure you want to delete package "${pkg?.name || id}"?`)) return;

      try {
        const res = await apiFetch(`/api/admin/packages/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete package');
        showToast('Package deleted.');
        await fetchPackages();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

function setupPackageHandlers() {
  // Category filter pills
  document.querySelectorAll('#pkg-category-filters .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#pkg-category-filters .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activePkgCat = btn.dataset.cat;
      renderAdminPackages();
    });
  });

  // Add New Package Button in view
  document.getElementById('btn-add-new-package')?.addEventListener('click', () => {
    openPackageModal(null);
  });

  // Package Form Submit (Add or Edit)
  const pkgForm = document.getElementById('pkg-edit-form');
  if (pkgForm) {
    pkgForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-pkg-id').value;
      const inclusions = document.getElementById('edit-pkg-inclusions').value
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const payload = {
        category: document.getElementById('edit-pkg-category').value,
        name: document.getElementById('edit-pkg-name').value.trim(),
        price: Number(document.getElementById('edit-pkg-price').value),
        badge: document.getElementById('edit-pkg-badge').value.trim(),
        short_desc: document.getElementById('edit-pkg-desc').value.trim(),
        sort_order: Number(document.getElementById('edit-pkg-sort').value) || 0,
        featured: document.getElementById('edit-pkg-featured').checked,
        is_active: document.getElementById('edit-pkg-active').checked,
        inclusions
      };

      try {
        let res;
        if (id) {
          // Update
          res = await apiFetch(`/api/admin/packages/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
        } else {
          // Create
          res = await apiFetch('/api/admin/packages', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }

        if (!res.ok) throw new Error('Failed to save package');
        showToast(id ? 'Package updated successfully!' : 'New package created!');
        document.getElementById('admin-package-modal').close();
        await fetchPackages();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }
}

function openPackageModal(id) {
  const modal = document.getElementById('admin-package-modal');
  const title = document.getElementById('modal-pkg-title');
  const form = document.getElementById('pkg-edit-form');
  form.reset();

  if (id) {
    const pkg = packagesList.find(p => p.id === id);
    if (!pkg) return;
    title.textContent = `Edit Package: ${pkg.name}`;
    document.getElementById('edit-pkg-id').value = pkg.id;
    document.getElementById('edit-pkg-category').value = pkg.category;
    document.getElementById('edit-pkg-name').value = pkg.name;
    document.getElementById('edit-pkg-price').value = pkg.price;
    document.getElementById('edit-pkg-badge').value = pkg.badge || '';
    document.getElementById('edit-pkg-sort').value = pkg.sort_order || 1;
    document.getElementById('edit-pkg-desc').value = pkg.short_desc || '';
    document.getElementById('edit-pkg-inclusions').value = (pkg.inclusions || []).join('\n');
    document.getElementById('edit-pkg-featured').checked = Boolean(pkg.featured);
    document.getElementById('edit-pkg-active').checked = pkg.is_active !== 0;
  } else {
    title.textContent = 'Add New Freelance Package';
    document.getElementById('edit-pkg-id').value = '';
    document.getElementById('edit-pkg-sort').value = packagesList.length + 1;
    document.getElementById('edit-pkg-active').checked = true;
  }

  modal.showModal();
}

// ==========================================
// 3. PORTFOLIO SHOWCASE LOGIC
// ==========================================

async function fetchPortfolio() {
  try {
    const res = await apiFetch('/api/admin/portfolio');
    if (!res.ok) return;
    portfolioList = await res.json();
    renderAdminPortfolio();
  } catch (err) {
    console.error('Error fetching portfolio:', err);
  }
}

function renderAdminPortfolio() {
  const container = document.getElementById('admin-portfolio-list');
  if (!container) return;

  let filtered = portfolioList;
  if (activePortCat !== 'All') {
    filtered = filtered.filter(p => p.category === activePortCat);
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--admin-muted);">No portfolio works found in this category.</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <article class="admin-port-card">
      <div class="port-thumb-wrap">
        <img src="${item.image_url}" alt="${item.title}" onerror="this.src='/assets/timeless-logo.jpg'">
        <span class="port-category-badge">${item.category}</span>
        ${item.featured ? '<span class="port-featured-star">★ Featured</span>' : ''}
      </div>
      <div class="port-info-body">
        <h3>${item.title}</h3>
        <p class="port-subtitle">${item.subtitle || 'On-Location Session'}</p>
        <div class="card-actions-row">
          <button type="button" class="btn-admin-secondary btn-sm btn-edit-portfolio" data-id="${item.id}" style="flex: 1;">
            ✏️ Edit
          </button>
          <button type="button" class="btn-danger btn-sm btn-delete-portfolio" data-id="${item.id}">
            🗑️
          </button>
        </div>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('.btn-edit-portfolio').forEach(btn => {
    btn.addEventListener('click', () => openPortfolioModal(Number(btn.dataset.id)));
  });

  container.querySelectorAll('.btn-delete-portfolio').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      if (!confirm('Are you sure you want to remove this work from the portfolio showcase?')) return;
      try {
        const res = await apiFetch(`/api/admin/portfolio/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete portfolio item');
        showToast('Portfolio work removed.');
        await fetchPortfolio();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

function setupPortfolioHandlers() {
  document.querySelectorAll('#portfolio-category-filters .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#portfolio-category-filters .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activePortCat = btn.dataset.cat;
      renderAdminPortfolio();
    });
  });

  document.getElementById('btn-add-new-portfolio')?.addEventListener('click', () => {
    openPortfolioModal(null);
  });

  // Modal Drag & Drop Zone for PC file uploads
  const portDropzone = document.getElementById('port-modal-dropzone');
  const portFileInput = document.getElementById('port-modal-file-input');
  const portProgress = document.getElementById('port-upload-progress');

  if (portDropzone && portFileInput) {
    portDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      portDropzone.classList.add('dragover');
    });

    portDropzone.addEventListener('dragleave', () => {
      portDropzone.classList.remove('dragover');
    });

    portDropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      portDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        await handlePortfolioModalUpload(e.dataTransfer.files[0]);
      }
    });

    portFileInput.addEventListener('change', async () => {
      if (portFileInput.files && portFileInput.files[0]) {
        await handlePortfolioModalUpload(portFileInput.files[0]);
        portFileInput.value = ''; // Reset input so same file can be re-selected if needed
      }
    });
  }

  // Clear / Replace Image button in preview card
  document.getElementById('btn-port-clear-img')?.addEventListener('click', () => {
    document.getElementById('edit-port-img').value = '';
    const previewCard = document.getElementById('port-preview-card');
    const dropzone = document.getElementById('port-modal-dropzone');
    if (previewCard) previewCard.style.display = 'none';
    if (dropzone) dropzone.style.display = 'block';
  });

  // Open Media Picker from Portfolio Modal
  document.getElementById('btn-port-open-picker')?.addEventListener('click', () => {
    openMediaPicker((selectedUrl, selectedFilename) => {
      setPortfolioModalImage(selectedUrl);
      showToast(`Selected "${selectedFilename}" from Media Library`);
    });
  });

  const form = document.getElementById('portfolio-edit-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-port-id').value;
      const imageUrl = document.getElementById('edit-port-img').value.trim();

      if (!imageUrl) {
        showToast('Please upload an image from your PC or pick one from the Media Library.', true);
        return;
      }

      const payload = {
        category: document.getElementById('edit-port-category').value,
        title: document.getElementById('edit-port-title').value.trim(),
        subtitle: document.getElementById('edit-port-subtitle').value.trim(),
        image_url: imageUrl,
        sort_order: Number(document.getElementById('edit-port-sort').value) || 0,
        featured: document.getElementById('edit-port-featured').checked
      };

      try {
        let res;
        if (id) {
          res = await apiFetch(`/api/admin/portfolio/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          res = await apiFetch('/api/admin/portfolio', { method: 'POST', body: JSON.stringify(payload) });
        }
        if (!res.ok) throw new Error('Failed to save portfolio work');
        showToast(id ? 'Portfolio work updated!' : 'New portfolio work added!');
        document.getElementById('admin-portfolio-modal').close();
        await fetchPortfolio();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }
}

// Upload handler for single photo inside portfolio work modal
async function handlePortfolioModalUpload(file) {
  const progressBox = document.getElementById('port-upload-progress');
  try {
    if (progressBox) progressBox.hidden = false;
    const res = await uploadMediaApi(file);
    setPortfolioModalImage(res.url);
    showToast('Photo uploaded from PC successfully!');
    // Refresh media library list in background
    fetchMedia();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    if (progressBox) progressBox.hidden = true;
  }
}

// Update modal image preview and hidden input
function setPortfolioModalImage(url) {
  const imgInput = document.getElementById('edit-port-img');
  const previewCard = document.getElementById('port-preview-card');
  const previewImg = document.getElementById('port-preview-img');
  const previewUrl = document.getElementById('port-preview-url');
  const dropzone = document.getElementById('port-modal-dropzone');

  if (imgInput) imgInput.value = url;
  if (previewImg) previewImg.src = url;
  if (previewUrl) previewUrl.textContent = url;
  if (previewCard) previewCard.style.display = 'flex';
  if (dropzone) dropzone.style.display = 'none';
}

function openPortfolioModal(id) {
  const modal = document.getElementById('admin-portfolio-modal');
  const title = document.getElementById('modal-portfolio-title');
  const form = document.getElementById('portfolio-edit-form');
  form.reset();

  const previewCard = document.getElementById('port-preview-card');
  const dropzone = document.getElementById('port-modal-dropzone');

  if (id) {
    const item = portfolioList.find(p => p.id === id);
    if (!item) return;
    title.textContent = `Edit Work: ${item.title}`;
    document.getElementById('edit-port-id').value = item.id;
    document.getElementById('edit-port-category').value = item.category;
    document.getElementById('edit-port-title').value = item.title;
    document.getElementById('edit-port-subtitle').value = item.subtitle || '';
    document.getElementById('edit-port-sort').value = item.sort_order || 1;
    document.getElementById('edit-port-featured').checked = Boolean(item.featured);

    if (item.image_url) {
      setPortfolioModalImage(item.image_url);
    } else {
      document.getElementById('edit-port-img').value = '';
      if (previewCard) previewCard.style.display = 'none';
      if (dropzone) dropzone.style.display = 'block';
    }
  } else {
    title.textContent = 'Add Portfolio Showcase Work';
    document.getElementById('edit-port-id').value = '';
    document.getElementById('edit-port-sort').value = portfolioList.length + 1;
    document.getElementById('edit-port-featured').checked = true;
    document.getElementById('edit-port-img').value = '';
    if (previewCard) previewCard.style.display = 'none';
    if (dropzone) dropzone.style.display = 'block';
  }

  modal.showModal();
}

// ==========================================
// 3B. STUDIO MEDIA LIBRARY & PC UPLOADS
// ==========================================

let activeMediaPickerCallback = null;

async function fetchMedia() {
  try {
    const res = await apiFetch('/api/admin/media');
    if (!res.ok) return;
    mediaList = await res.json();
    renderAdminMedia();
  } catch (err) {
    console.error('Error fetching media library:', err);
  }
}

function renderAdminMedia() {
  const container = document.getElementById('admin-media-list');
  const countAll = document.getElementById('media-count-all');
  const countUploads = document.getElementById('media-count-uploads');
  const countAssets = document.getElementById('media-count-assets');

  const uploadCount = mediaList.filter(m => m.type === 'upload').length;
  const assetCount = mediaList.filter(m => m.type === 'asset').length;

  if (countAll) countAll.textContent = mediaList.length;
  if (countUploads) countUploads.textContent = uploadCount;
  if (countAssets) countAssets.textContent = assetCount;

  if (!container) return;

  let filtered = mediaList;
  if (activeMediaSource === 'upload') {
    filtered = filtered.filter(m => m.type === 'upload');
  } else if (activeMediaSource === 'asset') {
    filtered = filtered.filter(m => m.type === 'asset');
  }

  if (currentMediaSearch.trim()) {
    const q = currentMediaSearch.toLowerCase().trim();
    filtered = filtered.filter(m => m.filename.toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3.5rem 1rem; color: var(--admin-muted);">
        <span style="font-size: 2.2rem; display: block; margin-bottom: 0.5rem;">📷</span>
        No media files match your current filter or search query.
      </div>`;
    return;
  }

  const formatSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  container.innerHTML = filtered.map(item => `
    <article class="admin-media-card">
      <div class="media-thumb-frame">
        <img src="${item.url}" alt="${item.filename}" loading="lazy" onerror="this.src='/assets/timeless-logo.jpg'">
        <span class="media-source-pill ${item.type === 'upload' ? 'source-upload' : 'source-asset'}">
          ${item.type === 'upload' ? 'PC Upload' : 'Core Asset'}
        </span>
      </div>
      <div class="media-card-meta">
        <div class="media-filename" title="${item.filename}">${item.filename}</div>
        <div class="media-details-row">
          <span>${formatSize(item.size)}</span>
          <span>${item.mtime ? new Date(item.mtime).toLocaleDateString() : ''}</span>
        </div>
      </div>
      <div class="media-card-actions">
        <button type="button" class="btn-admin-secondary btn-sm btn-copy-media-link" data-url="${item.url}" style="flex: 1;" title="Copy file URL">
          📋 Copy Link
        </button>
        ${item.type === 'upload' ? `
          <button type="button" class="btn-danger btn-sm btn-delete-media-file" data-filename="${item.filename}" title="Delete file from server">
            🗑️
          </button>
        ` : ''}
      </div>
    </article>
  `).join('');

  // Copy link buttons
  container.querySelectorAll('.btn-copy-media-link').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = btn.dataset.url;
      try {
        await navigator.clipboard.writeText(url);
        showToast(`Copied URL: ${url}`);
      } catch {
        // Fallback prompt if clipboard API blocked
        prompt('Copy image URL:', url);
      }
    });
  });

  // Delete uploaded file buttons
  container.querySelectorAll('.btn-delete-media-file').forEach(btn => {
    btn.addEventListener('click', async () => {
      const filename = btn.dataset.filename;
      if (!confirm(`Delete image "${filename}" from server? Any portfolio works referencing this file will need to be updated.`)) return;

      try {
        const res = await apiFetch(`/api/admin/media/${encodeURIComponent(filename)}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete file');
        showToast('Image deleted from server.');
        await fetchMedia();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

function setupMediaHandlers() {
  // Source Filter Pills
  document.querySelectorAll('#media-source-filters .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#media-source-filters .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMediaSource = btn.dataset.source;
      renderAdminMedia();
    });
  });

  // Media Search Box
  const searchInput = document.getElementById('media-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentMediaSearch = e.target.value;
      renderAdminMedia();
    });
  }

  // Media Page Drag & Drop Zone and File Input
  const pageDropzone = document.getElementById('media-page-dropzone');
  const pageFileInput = document.getElementById('media-page-upload-input');
  const pageUploadBtn = document.getElementById('btn-trigger-media-upload');
  const pageProgress = document.getElementById('media-upload-progress');

  if (pageUploadBtn && pageFileInput) {
    pageUploadBtn.addEventListener('click', () => pageFileInput.click());
  }

  if (pageDropzone && pageFileInput) {
    pageDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      pageDropzone.classList.add('dragover');
    });

    pageDropzone.addEventListener('dragleave', () => {
      pageDropzone.classList.remove('dragover');
    });

    pageDropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      pageDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        await handleBatchPCUpload(e.dataTransfer.files, pageProgress);
      }
    });

    pageFileInput.addEventListener('change', async () => {
      if (pageFileInput.files && pageFileInput.files.length > 0) {
        await handleBatchPCUpload(pageFileInput.files, pageProgress);
        pageFileInput.value = '';
      }
    });
  }

  // Media Picker Dialog Search & PC Upload Handler
  const pickerSearch = document.getElementById('picker-search-input');
  if (pickerSearch) {
    pickerSearch.addEventListener('input', () => {
      renderMediaPickerGrid(pickerSearch.value);
    });
  }

  const pickerFileInput = document.getElementById('picker-file-input');
  if (pickerFileInput) {
    pickerFileInput.addEventListener('change', async () => {
      if (pickerFileInput.files && pickerFileInput.files[0]) {
        try {
          showToast('Uploading photo from PC...');
          const uploaded = await uploadMediaApi(pickerFileInput.files[0]);
          showToast('Photo uploaded!');
          await fetchMedia();
          if (activeMediaPickerCallback) {
            activeMediaPickerCallback(uploaded.url, uploaded.filename);
            document.getElementById('admin-media-picker-modal').close();
          }
        } catch (err) {
          showToast(err.message, true);
        } finally {
          pickerFileInput.value = '';
        }
      }
    });
  }
}

// Batch upload photos directly from PC
async function handleBatchPCUpload(fileList, progressEl) {
  if (progressEl) progressEl.hidden = false;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    try {
      await uploadMediaApi(file);
      successCount++;
    } catch (err) {
      console.error(`Failed uploading ${file.name}:`, err);
      failCount++;
    }
  }

  if (progressEl) progressEl.hidden = true;
  if (successCount > 0) {
    showToast(`Successfully uploaded ${successCount} photo${successCount > 1 ? 's' : ''} from PC!`);
    await fetchMedia();
  }
  if (failCount > 0) {
    showToast(`Failed to upload ${failCount} file${failCount > 1 ? 's' : ''}. Check size and image format.`, true);
  }
}

// Media Picker Modal Setup
function openMediaPicker(onSelectCallback) {
  activeMediaPickerCallback = onSelectCallback;
  const modal = document.getElementById('admin-media-picker-modal');
  const searchInput = document.getElementById('picker-search-input');
  if (searchInput) searchInput.value = '';

  renderMediaPickerGrid('');
  modal.showModal();
}

function renderMediaPickerGrid(searchQuery = '') {
  const grid = document.getElementById('media-picker-grid');
  if (!grid) return;

  let filtered = mediaList;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(m => m.filename.toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--admin-muted);">No images found. You can upload one using the button above.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(item => `
    <div class="picker-media-card" data-url="${item.url}" data-filename="${item.filename}" title="Click to select ${item.filename}">
      <div class="picker-thumb-wrap">
        <img src="${item.url}" alt="${item.filename}" loading="lazy" onerror="this.src='/assets/timeless-logo.jpg'">
      </div>
      <div class="picker-name-caption">${item.filename}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.picker-media-card').forEach(card => {
    card.addEventListener('click', () => {
      const url = card.dataset.url;
      const filename = card.dataset.filename;
      if (activeMediaPickerCallback) {
        activeMediaPickerCallback(url, filename);
      }
      document.getElementById('admin-media-picker-modal').close();
    });
  });
}

// ==========================================
// 4. CLIENT TESTIMONIALS LOGIC
// ==========================================

async function fetchTestimonials() {
  try {
    const res = await apiFetch('/api/admin/testimonials');
    if (!res.ok) return;
    testimonialsList = await res.json();
    renderAdminTestimonials();
  } catch (err) {
    console.error('Error fetching testimonials:', err);
  }
}

function renderAdminTestimonials() {
  const container = document.getElementById('admin-testimonials-list');
  if (!container) return;

  if (testimonialsList.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--admin-muted);">No client testimonials added yet.</div>`;
    return;
  }

  container.innerHTML = testimonialsList.map(t => {
    const stars = '★'.repeat(t.rating || 5) + '☆'.repeat(Math.max(0, 5 - (t.rating || 5)));
    return `
      <article class="admin-test-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <div class="test-stars">${stars}</div>
          <span class="${t.is_active ? 'badge-active' : 'badge-inactive'}">${t.is_active ? 'Visible' : 'Hidden'}</span>
        </div>
        <p class="test-quote">“${t.quote}”</p>
        <div class="test-author-info">
          <div class="test-author-name">${t.client_name}</div>
          <div class="test-author-loc">${t.event_type} · ${t.location}</div>
        </div>
        <div class="card-actions-row">
          <button type="button" class="btn-admin-secondary btn-sm btn-edit-test" data-id="${t.id}" style="flex: 1;">
            ✏️ Edit
          </button>
          <button type="button" class="btn-danger btn-sm btn-delete-test" data-id="${t.id}">
            🗑️
          </button>
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('.btn-edit-test').forEach(btn => {
    btn.addEventListener('click', () => openTestimonialModal(Number(btn.dataset.id)));
  });

  container.querySelectorAll('.btn-delete-test').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      if (!confirm('Are you sure you want to delete this client testimonial?')) return;
      try {
        const res = await apiFetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete testimonial');
        showToast('Testimonial deleted.');
        await fetchTestimonials();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

function setupTestimonialHandlers() {
  document.getElementById('btn-add-new-testimonial')?.addEventListener('click', () => {
    openTestimonialModal(null);
  });

  const form = document.getElementById('testimonial-edit-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-test-id').value;
      const payload = {
        client_name: document.getElementById('edit-test-name').value.trim(),
        event_type: document.getElementById('edit-test-event').value.trim(),
        location: document.getElementById('edit-test-location').value.trim(),
        rating: Number(document.getElementById('edit-test-rating').value) || 5,
        quote: document.getElementById('edit-test-quote').value.trim(),
        sort_order: Number(document.getElementById('edit-test-sort').value) || 0,
        is_active: document.getElementById('edit-test-active').checked
      };

      try {
        let res;
        if (id) {
          res = await apiFetch(`/api/admin/testimonials/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          res = await apiFetch('/api/admin/testimonials', { method: 'POST', body: JSON.stringify(payload) });
        }
        if (!res.ok) throw new Error('Failed to save testimonial');
        showToast(id ? 'Testimonial updated!' : 'Client review added!');
        document.getElementById('admin-testimonial-modal').close();
        await fetchTestimonials();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }
}

function openTestimonialModal(id) {
  const modal = document.getElementById('admin-testimonial-modal');
  const title = document.getElementById('modal-testimonial-title');
  const form = document.getElementById('testimonial-edit-form');
  form.reset();

  if (id) {
    const item = testimonialsList.find(t => t.id === id);
    if (!item) return;
    title.textContent = `Edit Review: ${item.client_name}`;
    document.getElementById('edit-test-id').value = item.id;
    document.getElementById('edit-test-name').value = item.client_name;
    document.getElementById('edit-test-event').value = item.event_type;
    document.getElementById('edit-test-location').value = item.location;
    document.getElementById('edit-test-rating').value = item.rating || 5;
    document.getElementById('edit-test-quote').value = item.quote;
    document.getElementById('edit-test-sort').value = item.sort_order || 1;
    document.getElementById('edit-test-active').checked = item.is_active !== 0;
  } else {
    title.textContent = 'Add Client Note & Review';
    document.getElementById('edit-test-id').value = '';
    document.getElementById('edit-test-sort').value = testimonialsList.length + 1;
    document.getElementById('edit-test-active').checked = true;
  }

  modal.showModal();
}

// ==========================================
// 5. FAQ MANAGEMENT LOGIC
// ==========================================

async function fetchFaqs() {
  try {
    const res = await apiFetch('/api/admin/faqs');
    if (!res.ok) return;
    faqsList = await res.json();
    renderAdminFaqs();
  } catch (err) {
    console.error('Error fetching FAQs:', err);
  }
}

function renderAdminFaqs() {
  const container = document.getElementById('admin-faqs-list');
  if (!container) return;

  if (faqsList.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--admin-muted);">No FAQs added yet.</div>`;
    return;
  }

  container.innerHTML = faqsList.map(f => `
    <article class="admin-faq-card">
      <div class="faq-card-content">
        <span class="faq-cat-tag">${f.category || 'General'}</span>
        <h3>${f.question}</h3>
        <p>${f.answer}</p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.5rem; flex-shrink: 0;">
        <button type="button" class="btn-admin-secondary btn-sm btn-edit-faq" data-id="${f.id}">
          ✏️ Edit
        </button>
        <button type="button" class="btn-danger btn-sm btn-delete-faq" data-id="${f.id}">
          🗑️
        </button>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('.btn-edit-faq').forEach(btn => {
    btn.addEventListener('click', () => openFaqModal(Number(btn.dataset.id)));
  });

  container.querySelectorAll('.btn-delete-faq').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      if (!confirm('Are you sure you want to delete this FAQ item?')) return;
      try {
        const res = await apiFetch(`/api/admin/faqs/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete FAQ');
        showToast('FAQ deleted.');
        await fetchFaqs();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

function setupFaqHandlers() {
  document.getElementById('btn-add-new-faq')?.addEventListener('click', () => {
    openFaqModal(null);
  });

  const form = document.getElementById('faq-edit-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-faq-id').value;
      const payload = {
        category: document.getElementById('edit-faq-category').value.trim(),
        question: document.getElementById('edit-faq-question').value.trim(),
        answer: document.getElementById('edit-faq-answer').value.trim(),
        sort_order: Number(document.getElementById('edit-faq-sort').value) || 0,
        is_active: document.getElementById('edit-faq-active').checked
      };

      try {
        let res;
        if (id) {
          res = await apiFetch(`/api/admin/faqs/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          res = await apiFetch('/api/admin/faqs', { method: 'POST', body: JSON.stringify(payload) });
        }
        if (!res.ok) throw new Error('Failed to save FAQ');
        showToast(id ? 'FAQ item updated!' : 'New FAQ item created!');
        document.getElementById('admin-faq-modal').close();
        await fetchFaqs();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }
}

function openFaqModal(id) {
  const modal = document.getElementById('admin-faq-modal');
  const title = document.getElementById('modal-faq-title');
  const form = document.getElementById('faq-edit-form');
  form.reset();

  if (id) {
    const item = faqsList.find(f => f.id === id);
    if (!item) return;
    title.textContent = `Edit FAQ Item`;
    document.getElementById('edit-faq-id').value = item.id;
    document.getElementById('edit-faq-category').value = item.category || 'General';
    document.getElementById('edit-faq-question').value = item.question;
    document.getElementById('edit-faq-answer').value = item.answer;
    document.getElementById('edit-faq-sort').value = item.sort_order || 1;
    document.getElementById('edit-faq-active').checked = item.is_active !== 0;
  } else {
    title.textContent = 'Add Frequently Asked Question';
    document.getElementById('edit-faq-id').value = '';
    document.getElementById('edit-faq-sort').value = faqsList.length + 1;
    document.getElementById('edit-faq-active').checked = true;
  }

  modal.showModal();
}

// ==========================================
// 6. STUDIO PROFILE & SECURITY PIN LOGIC
// ==========================================

async function fetchSettings() {
  try {
    const res = await apiFetch('/api/admin/settings');
    if (!res.ok) return;
    settingsData = await res.json();

    document.getElementById('set-biz-name').value = settingsData.business_name || '';
    document.getElementById('set-primary-phone').value = settingsData.primary_phone || '';
    document.getElementById('set-secondary-phone').value = settingsData.secondary_phone || '';
    document.getElementById('set-email').value = settingsData.email || '';
    document.getElementById('set-address').value = settingsData.address || '';
    document.getElementById('set-service-area').value = settingsData.service_area || '';
    document.getElementById('set-tagline').value = settingsData.tagline || '';
    document.getElementById('set-subtitle').value = settingsData.subtitle || '';
    document.getElementById('set-fb-url').value = settingsData.facebook_url || '';
    document.getElementById('set-messenger').value = settingsData.messenger_link || '';
    document.getElementById('set-hours').value = settingsData.operating_hours || '';
  } catch (err) {
    console.error('Error fetching settings:', err);
  }
}

function setupSettingsHandlers() {
  // Save Studio Profile
  const profileForm = document.getElementById('settings-profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        business_name: document.getElementById('set-biz-name').value.trim(),
        primary_phone: document.getElementById('set-primary-phone').value.trim(),
        secondary_phone: document.getElementById('set-secondary-phone').value.trim(),
        email: document.getElementById('set-email').value.trim(),
        address: document.getElementById('set-address').value.trim(),
        service_area: document.getElementById('set-service-area').value.trim(),
        tagline: document.getElementById('set-tagline').value.trim(),
        subtitle: document.getElementById('set-subtitle').value.trim(),
        facebook_url: document.getElementById('set-fb-url').value.trim(),
        messenger_link: document.getElementById('set-messenger').value.trim(),
        operating_hours: document.getElementById('set-hours').value.trim(),
        display_phones: `${document.getElementById('set-primary-phone').value.trim()} / ${document.getElementById('set-secondary-phone').value.trim()}`
      };

      try {
        const res = await apiFetch('/api/admin/settings', {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to save settings');
        showToast('Studio profile and contact details saved!');
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  // Change Master Administrator Credentials
  const credForm = document.getElementById('settings-credentials-form');
  if (credForm) {
    credForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('cred-current-password').value;
      const newUsername = document.getElementById('cred-new-username').value.trim();
      const newPassword = document.getElementById('cred-new-password').value;
      const confirmPassword = document.getElementById('cred-confirm-password').value;
      const feedback = document.getElementById('cred-change-status');

      feedback.hidden = true;
      feedback.className = 'settings-feedback-msg';

      if (newPassword !== confirmPassword) {
        feedback.textContent = 'New Password and Confirmation do not match.';
        feedback.className = 'settings-feedback-msg error';
        feedback.hidden = false;
        return;
      }

      if (newPassword.length < 8) {
        feedback.textContent = 'New Master Password must be at least 8 characters long.';
        feedback.className = 'settings-feedback-msg error';
        feedback.hidden = false;
        return;
      }

      if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        feedback.textContent = 'New Master Password must contain both letters and numbers.';
        feedback.className = 'settings-feedback-msg error';
        feedback.hidden = false;
        return;
      }

      try {
        const res = await apiFetch('/api/admin/change-credentials', {
          method: 'PUT',
          body: JSON.stringify({ currentPassword, newUsername, newPassword, confirmPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update credentials');

        feedback.textContent = 'Master administrator credentials successfully updated!';
        feedback.className = 'settings-feedback-msg success';
        feedback.hidden = false;
        credForm.reset();
        showToast('Master credentials updated successfully!');
      } catch (err) {
        feedback.textContent = err.message;
        feedback.className = 'settings-feedback-msg error';
        feedback.hidden = false;
      }
    });
  }
}
