/**
 * Timeless Studio 21 — Client Application Logic
 * Premium Conversion-Focused Interactions, Package Catalog, Comparison, Lightbox & Inquiry Flow
 */

// Global State
let packagesData = [];
let portfolioData = [];
let activePackageCategory = 'All';
let activePortfolioCategory = 'All';
let comparedPackageIds = [];
let currentLightboxIndex = 0;

// Currency Formatter for Philippine Peso (₱)
const formatPeso = (amount) => {
  if (amount === 0) return 'Free';
  return '₱' + Number(amount).toLocaleString('en-PH');
};

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


// DOM Elements
const packageGrid = document.getElementById('package-grid');
const packageFilters = document.getElementById('package-filters');
const compareArea = document.getElementById('compare-area');
const compareCountBadge = document.getElementById('compare-count');
const portfolioGrid = document.getElementById('portfolio-grid');
const portfolioFilters = document.getElementById('portfolio-filters');

// Dialog Elements
const packageDialog = document.getElementById('package-dialog');
const packageDetailContent = document.getElementById('package-detail-content');
const inquiryDialog = document.getElementById('inquiry-dialog');
const inquiryForm = document.getElementById('inquiry-form');
const inquirySuccessView = document.getElementById('inquiry-success-view');
const inquiryErrorBox = document.getElementById('inquiry-error-box');
const portfolioLightbox = document.getElementById('portfolio-lightbox');

// Mobile Nav
const menuToggle = document.getElementById('menu-toggle');
const navMenu = document.getElementById('nav-menu');

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupEventListeners();
  updateLiveStudioStatus();
  await loadData();
  setupDeepLinks();
  setupMobileBottomBar();
  setupClipboard();
});

// Toast Notification System
function showToast(message, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>✨</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Live Booking Availability Status (Philippine Time UTC+8)
function updateLiveStudioStatus() {
  const statusElem = document.querySelector('.announcement-left span strong');
  if (!statusElem) return;
  // Preserve verified freelance collective location in Barangay San Juan, Malvar
  statusElem.textContent = 'Brgy. San Juan, Malvar, Batangas';
}

function setupMobileBottomBar() {
  const btn = document.getElementById('btn-mobile-bottom-inquire');
  if (btn) {
    btn.addEventListener('click', () => openInquiryModal());
  }
}

function setupClipboard() {
  document.getElementById('btn-copy-ref-code')?.addEventListener('click', () => {
    const code = document.getElementById('success-ref-code')?.textContent;
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Reference code ${code} copied!`);
      }).catch(() => {
        showToast(`Code: ${code}`);
      });
    }
  });
}

// Setup Mobile & Desktop Navigation
function setupNavigation() {
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    });

    // Close mobile nav when clicking a link
    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  // Active section scroll spy
  const sections = document.querySelectorAll('main section[id]');
  window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset;
    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 120;
      const sectionId = current.getAttribute('id');
      const navLink = document.querySelector(`.nav-menu a[href*="${sectionId}"]`);
      if (navLink && scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
        navLink.classList.add('active');
      }
    });
  });
}

let testimonialsData = [];
let faqsData = [];

// Fetch Packages, Portfolio, Testimonials, FAQs, and Business Profile from API
async function loadData() {
  try {
    const [pkgRes, portRes, testRes, faqRes, infoRes] = await Promise.all([
      fetch('/api/packages'),
      fetch('/api/portfolio'),
      fetch('/api/testimonials'),
      fetch('/api/faqs'),
      fetch('/api/business-info')
    ]);

    if (pkgRes.ok) {
      packagesData = await pkgRes.json();
    }
    if (portRes.ok) {
      portfolioData = await portRes.json();
    }
    if (testRes.ok) {
      testimonialsData = await testRes.json();
      renderTestimonials();
    }
    if (faqRes.ok) {
      faqsData = await faqRes.json();
      renderFaqs();
    }
    if (infoRes.ok) {
      const info = await infoRes.json();
      applyBusinessInfo(info);
    }
  } catch (err) {
    console.warn('Network issue fetching data, using embedded defaults:', err);
  }

  renderPackageFilters();
  renderPackages();
  renderPortfolioFilters();
  renderPortfolio();
  renderCompare();
}

function renderTestimonials() {
  const container = document.getElementById('testimonials-grid');
  if (!container || !testimonialsData || testimonialsData.length === 0) return;

  container.innerHTML = testimonialsData.map(t => `
    <article class="testimonial-card">
      <span class="quote-mark">“</span>
      <blockquote class="review-text">${escapeHtml(t.quote)}</blockquote>
      <div class="review-author">
        <strong>${escapeHtml(t.client_name)}</strong>
        <span class="author-location">${escapeHtml(t.event_type)} · ${escapeHtml(t.location)}</span>
      </div>
    </article>
  `).join('');
}

function renderFaqs() {
  const container = document.getElementById('faq-accordion-wrap');
  if (!container || !faqsData || faqsData.length === 0) return;

  container.innerHTML = faqsData.map((f, idx) => `
    <details class="faq-item" ${idx === 0 ? 'open' : ''}>
      <summary class="faq-question">
        <span>${escapeHtml(f.question)}</span>
        <span class="faq-icon" aria-hidden="true">+</span>
      </summary>
      <div class="faq-answer">
        <p>${escapeHtml(f.answer)}</p>
      </div>
    </details>
  `).join('');
}

function applyBusinessInfo(info) {
  if (!info) return;
  if (info.phoneNumbers && info.phoneNumbers[0]) {
    const rawPhone = info.phoneNumbers[0].replace(/\s+/g, '');
    document.querySelectorAll('a[href^="tel:"]').forEach(el => el.href = `tel:${rawPhone}`);
  }
  if (info.facebookPage) {
    document.querySelectorAll('a[href*="facebook.com/p/Timeless-Studio-21"]').forEach(el => el.href = info.facebookPage);
  }
  if (info.messengerLink) {
    document.querySelectorAll('a[href*="m.me/"]').forEach(el => el.href = info.messengerLink);
  }
}

// Handle Direct Filter Deep-links from Service Cards & Footer
function setupDeepLinks() {
  document.querySelectorAll('[data-filter-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetCat = link.getAttribute('data-filter-target');
      if (targetCat) {
        activePackageCategory = targetCat;
        renderPackageFilters();
        renderPackages();
      }
    });
  });

  // Quick Inquire buttons
  const quickInquireBtn = document.getElementById('btn-quick-inquire');
  const openInquireBtn = document.getElementById('btn-open-inquiry-dialog');
  if (quickInquireBtn) quickInquireBtn.addEventListener('click', () => openInquiryModal());
  if (openInquireBtn) openInquireBtn.addEventListener('click', () => openInquiryModal());
}

// ==========================================
// PACKAGE CATALOG & COMPARISON
// ==========================================

function renderPackageFilters() {
  if (!packageFilters) return;
  const categories = ['All', ...new Set(packagesData.map(p => p.category))];
  packageFilters.innerHTML = categories.map(cat => `
    <button type="button" class="filter-btn ${activePackageCategory === cat ? 'active' : ''}" data-cat="${cat}">
      ${cat}
    </button>
  `).join('');

  packageFilters.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activePackageCategory = btn.getAttribute('data-cat');
      renderPackageFilters();
      renderPackages();
    });
  });
}

function renderPackages() {
  if (!packageGrid) return;
  const filtered = activePackageCategory === 'All' 
    ? packagesData 
    : packagesData.filter(p => p.category === activePackageCategory);

  if (filtered.length === 0) {
    packageGrid.innerHTML = `
      <div class="empty-notice-state" style="grid-column: span 3; text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
        <h3>No packages found in this category</h3>
        <p>Please select another category or send us a custom inquiry for your date.</p>
      </div>
    `;
    return;
  }

  packageGrid.innerHTML = filtered.map(pkg => {
    const isCompared = comparedPackageIds.includes(pkg.id);
    const inclusionsPreview = pkg.inclusions.slice(0, 5);

    return `
      <article class="package-card ${pkg.featured ? 'featured' : ''}" id="card-${pkg.id}">
        <div class="package-card-header">
          <div class="package-meta-row">
            <span class="package-category-label">${escapeHtml(pkg.category)}</span>
            ${pkg.badge ? `<span class="package-badge-tag">${escapeHtml(pkg.badge)}</span>` : ''}
          </div>
          <h3 class="package-name">${escapeHtml(pkg.name)}</h3>
        </div>
        
        <div class="package-price-wrap">
          <span class="package-price-amount">${formatPeso(pkg.price)}</span>
          <span class="package-price-sub">${pkg.price >= 10000 ? 'package rate' : 'milestone rate'}</span>
        </div>

        <p class="package-desc">${escapeHtml(pkg.short_desc || '')}</p>

        <div class="package-inclusions-wrap">
          <span class="inclusions-title">Key Deliverables:</span>
          <ul class="package-inclusions-list">
            ${inclusionsPreview.map(inc => `<li><span class="check-bullet">✓</span><span>${escapeHtml(inc)}</span></li>`).join('')}
          </ul>
          ${pkg.inclusions.length > 5 ? `<button type="button" class="btn-more-inclusions btn-view-detail" data-id="${pkg.id}">+ ${pkg.inclusions.length - 5} more deliverables...</button>` : ''}
        </div>

        <div class="package-actions">
          <button type="button" class="btn btn-primary btn-block btn-inquire-pkg" data-id="${pkg.id}">
            Inquire with This Tier →
          </button>
          <div class="package-sub-actions">
            <button type="button" class="btn-text-action btn-view-detail" data-id="${pkg.id}">
              Full Specs
            </button>
            <span class="sep-dot">·</span>
            <button type="button" class="btn-text-action btn-card-compare ${isCompared ? 'selected' : ''}" data-id="${pkg.id}">
              ${isCompared ? '✓ In Compare' : '+ Add to Compare'}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Attach button listeners
  packageGrid.querySelectorAll('.btn-view-detail').forEach(btn => {
    btn.addEventListener('click', () => openPackageDetailModal(btn.dataset.id));
  });

  packageGrid.querySelectorAll('.btn-inquire-pkg').forEach(btn => {
    btn.addEventListener('click', () => openInquiryModal(btn.dataset.id));
  });

  packageGrid.querySelectorAll('.btn-card-compare').forEach(btn => {
    btn.addEventListener('click', () => toggleCompare(btn.dataset.id));
  });
}

function toggleCompare(pkgId) {
  const pkg = packagesData.find(p => p.id === pkgId);
  const pkgName = pkg ? pkg.name : 'Package';

  if (comparedPackageIds.includes(pkgId)) {
    comparedPackageIds = comparedPackageIds.filter(id => id !== pkgId);
    showToast(`Removed "${pkgName}" from comparison`);
  } else {
    if (comparedPackageIds.length >= 3) {
      showToast('Maximum 3 packages in comparison. Remove one to add another.');
      return;
    }
    comparedPackageIds.push(pkgId);
    showToast(`Added "${pkgName}" to comparison (${comparedPackageIds.length}/3)`);
  }

  // Update badge
  if (compareCountBadge) {
    if (comparedPackageIds.length > 0) {
      compareCountBadge.textContent = comparedPackageIds.length;
      compareCountBadge.hidden = false;
    } else {
      compareCountBadge.hidden = true;
    }
  }

  renderPackages();
  renderCompare();

  // Scroll to compare section if 2 or 3 packages selected
  if (comparedPackageIds.length >= 2) {
    const compareElem = document.getElementById('compare');
    if (compareElem) {
      compareElem.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

function renderCompare() {
  const compareSection = document.getElementById('compare');
  const navCompareLink = document.getElementById('nav-compare-link');

  if (comparedPackageIds.length === 0) {
    if (compareSection) compareSection.style.display = 'none';
    if (navCompareLink) navCompareLink.hidden = true;
    if (compareArea) compareArea.innerHTML = '';
    return;
  }

  if (compareSection) compareSection.style.display = 'block';
  if (navCompareLink) navCompareLink.hidden = false;

  const selectedList = comparedPackageIds.map(id => packagesData.find(p => p.id === id)).filter(Boolean);

  if (!compareArea) return;

  compareArea.innerHTML = `
    <div class="compare-tray-head">
      <p>Comparing <strong>${selectedList.length}</strong> of maximum 3 packages</p>
      <button type="button" class="btn btn-outline btn-sm" id="btn-clear-compare">✕ Clear Tray</button>
    </div>
    <div class="comparison-grid">
      ${selectedList.map(pkg => `
        <article class="compare-card">
          <div class="compare-card-head">
            <span class="eyebrow">${pkg.category}</span>
            <button type="button" class="btn-remove-compare" data-id="${pkg.id}" title="Remove from comparison">×</button>
          </div>
          <h3>${pkg.name}</h3>
          <div class="compare-price">${formatPeso(pkg.price)}</div>
          <p class="compare-desc">${pkg.short_desc || ''}</p>

          <span class="compare-inc-head">All Inclusions:</span>
          <ul class="compare-inclusions-list">
            ${pkg.inclusions.map(inc => `<li><span class="check-bullet">✓</span><span>${inc}</span></li>`).join('')}
          </ul>

          <button type="button" class="btn btn-primary btn-block btn-inquire-compare" data-id="${pkg.id}" style="margin-top: auto;">
            Inquire with this Package →
          </button>
        </article>
      `).join('')}
    </div>
  `;

  document.getElementById('btn-clear-compare')?.addEventListener('click', () => {
    comparedPackageIds = [];
    if (compareCountBadge) compareCountBadge.hidden = true;
    renderPackages();
    renderCompare();
  });

  compareArea.querySelectorAll('.btn-remove-compare').forEach(btn => {
    btn.addEventListener('click', () => toggleCompare(btn.dataset.id));
  });

  compareArea.querySelectorAll('.btn-inquire-compare').forEach(btn => {
    btn.addEventListener('click', () => openInquiryModal(btn.dataset.id));
  });
}

// ==========================================
// PACKAGE DETAIL MODAL
// ==========================================

function openPackageDetailModal(pkgId) {
  const pkg = packagesData.find(p => p.id === pkgId);
  if (!pkg || !packageDialog || !packageDetailContent) return;

  packageDetailContent.innerHTML = `
    <div class="dialog-head" style="margin-bottom: 1.5rem;">
      <span class="eyebrow">${pkg.category}</span>
      <h2 style="font-family: var(--font-heading); font-size: 2rem; color: #fff;">${pkg.name}</h2>
      <div style="font-family: var(--font-heading); font-size: 2.2rem; font-weight: 800; color: var(--accent-gold); margin-top: 0.4rem;">
        ${formatPeso(pkg.price)}
      </div>
      <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 0.5rem;">${pkg.short_desc || ''}</p>
    </div>

    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 2rem;">
      <h3 style="font-family: var(--font-heading); font-size: 1rem; color: #fff; margin-bottom: 1rem;">Complete Package Inclusions:</h3>
      <ul style="list-style: none; font-size: 0.92rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 0.65rem;">
        ${pkg.inclusions.map(inc => `<li style="display: flex; gap: 0.6rem;"><span>✓</span><span>${inc}</span></li>`).join('')}
      </ul>
    </div>

    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
      <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('package-dialog').close()">Close</button>
      <button type="button" class="btn btn-primary" id="btn-dialog-inquire-now">Inquire with This Package</button>
    </div>
  `;

  document.getElementById('btn-dialog-inquire-now')?.addEventListener('click', () => {
    packageDialog.close();
    openInquiryModal(pkg.id);
  });

  packageDialog.showModal();
}

// ==========================================
// PORTFOLIO & LIGHTBOX
// ==========================================

function renderPortfolioFilters() {
  if (!portfolioFilters) return;
  const categories = ['All', ...new Set(portfolioData.map(p => p.category))];
  portfolioFilters.innerHTML = categories.map(cat => `
    <button type="button" class="filter-btn ${activePortfolioCategory === cat ? 'active' : ''}" data-port-cat="${cat}">
      ${cat}
    </button>
  `).join('');

  portfolioFilters.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activePortfolioCategory = btn.getAttribute('data-port-cat');
      renderPortfolioFilters();
      renderPortfolio();
    });
  });
}

function renderPortfolio() {
  if (!portfolioGrid) return;
  const filtered = activePortfolioCategory === 'All'
    ? portfolioData
    : portfolioData.filter(p => p.category === activePortfolioCategory);

  portfolioGrid.innerHTML = filtered.map((item, idx) => `
    <article class="portfolio-item" data-index="${portfolioData.indexOf(item)}" tabindex="0" role="button" aria-label="View ${escapeHtml(item.title)}">
      <img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">
      <div class="portfolio-overlay">
        <span class="portfolio-item-cat">${escapeHtml(item.category)}</span>
        <h3 class="portfolio-item-title">${escapeHtml(item.title)}</h3>
        <p class="portfolio-item-sub">${escapeHtml(item.subtitle || '')}</p>
      </div>
    </article>
  `).join('');

  portfolioGrid.querySelectorAll('.portfolio-item').forEach(el => {
    el.addEventListener('click', () => openLightbox(Number(el.dataset.index)));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(Number(el.dataset.index));
      }
    });
  });
}

function openLightbox(index) {
  if (!portfolioData[index] || !portfolioLightbox) return;
  currentLightboxIndex = index;
  updateLightboxContent();
  portfolioLightbox.showModal();
}

function updateLightboxContent() {
  const item = portfolioData[currentLightboxIndex];
  if (!item) return;

  const img = document.getElementById('lightbox-img');
  const cat = document.getElementById('lightbox-cat');
  const title = document.getElementById('lightbox-title');
  const sub = document.getElementById('lightbox-sub');

  if (img) img.src = item.image_url;
  if (cat) cat.textContent = item.category;
  if (title) title.textContent = item.title;
  if (sub) sub.textContent = item.subtitle || '';
}

// Lightbox Navigation Controls
document.querySelector('.lightbox-prev')?.addEventListener('click', () => {
  currentLightboxIndex = (currentLightboxIndex - 1 + portfolioData.length) % portfolioData.length;
  updateLightboxContent();
});

document.querySelector('.lightbox-next')?.addEventListener('click', () => {
  currentLightboxIndex = (currentLightboxIndex + 1) % portfolioData.length;
  updateLightboxContent();
});

document.querySelector('.lightbox-close')?.addEventListener('click', () => {
  portfolioLightbox?.close();
});

// Keyboard controls for lightbox
window.addEventListener('keydown', (e) => {
  if (portfolioLightbox && portfolioLightbox.open) {
    if (e.key === 'ArrowLeft') {
      currentLightboxIndex = (currentLightboxIndex - 1 + portfolioData.length) % portfolioData.length;
      updateLightboxContent();
    } else if (e.key === 'ArrowRight') {
      currentLightboxIndex = (currentLightboxIndex + 1) % portfolioData.length;
      updateLightboxContent();
    }
  }
});

// ==========================================
// INQUIRY MODAL & SUBMISSION FLOW
// ==========================================

function openInquiryModal(pkgId = null) {
  if (!inquiryDialog || !inquiryForm) return;

  inquiryForm.reset();
  inquiryForm.hidden = false;
  if (inquirySuccessView) inquirySuccessView.hidden = true;
  if (inquiryErrorBox) inquiryErrorBox.hidden = true;

  // Set min date to today
  const dateInput = document.getElementById('input-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
  }

  // Pre-fill selected package if provided
  const pkg = packagesData.find(p => p.id === pkgId);
  const pkgIdInput = document.getElementById('form-package-id');
  const pkgPriceInput = document.getElementById('form-package-price');
  const pkgDisplayInput = document.getElementById('input-package-display');
  const serviceCategorySelect = document.getElementById('input-service-category');

  if (pkg) {
    if (pkgIdInput) pkgIdInput.value = pkg.id;
    if (pkgPriceInput) pkgPriceInput.value = pkg.price;
    if (pkgDisplayInput) pkgDisplayInput.value = `${pkg.name} (${formatPeso(pkg.price)})`;

    // Map package category to select option
    if (serviceCategorySelect) {
      if (['Weddings', 'Debuts & Birthdays', 'Portraits & Lifestyle', 'Christening & Events'].includes(pkg.category)) {
        serviceCategorySelect.value = pkg.category;
      }
    }
  } else {
    if (pkgIdInput) pkgIdInput.value = '';
    if (pkgPriceInput) pkgPriceInput.value = '0';
    if (pkgDisplayInput) pkgDisplayInput.value = 'Custom Inquiry / General Quote';
  }

  inquiryDialog.showModal();
}

// Dialog Close buttons
document.querySelectorAll('.dialog-close').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('dialog')?.close();
  });
});

document.getElementById('btn-close-success')?.addEventListener('click', () => {
  inquiryDialog?.close();
});

// Handle Inquiry Form Submission
if (inquiryForm) {
  inquiryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('btn-submit-inquiry');
    if (!submitBtn || submitBtn.disabled) return;

    if (inquiryErrorBox) inquiryErrorBox.hidden = true;

    // Client Validation
    const clientNameInput = document.getElementById('input-client-name');
    const contactInput = document.getElementById('input-contact');
    const consentInput = document.getElementById('input-consent');

    let isValid = true;

    if (!clientNameInput.value.trim()) {
      document.getElementById('err-client-name').textContent = 'Please provide your full name.';
      isValid = false;
    } else {
      document.getElementById('err-client-name').textContent = '';
    }

    if (!contactInput.value.trim()) {
      document.getElementById('err-contact').textContent = 'Please enter your active mobile or phone number.';
      isValid = false;
    } else {
      document.getElementById('err-contact').textContent = '';
    }

    if (!consentInput.checked) {
      document.getElementById('err-consent').textContent = 'Please check the box to acknowledge inquiry terms.';
      isValid = false;
    } else {
      document.getElementById('err-consent').textContent = '';
    }

    if (!isValid) return;

    // Collect Data
    const formData = new FormData(inquiryForm);
    const payload = {
      clientName: formData.get('clientName')?.trim(),
      facebookName: formData.get('facebookName')?.trim(),
      contactNumber: formData.get('contactNumber')?.trim(),
      email: formData.get('email')?.trim(),
      serviceCategory: formData.get('serviceCategory'),
      packageId: formData.get('packageId'),
      packageName: formData.get('packageDisplay'),
      packagePrice: Number(formData.get('packagePrice') || 0),
      eventDate: formData.get('eventDate'),
      programTime: formData.get('programTime'),
      ceremonyVenue: formData.get('ceremonyVenue')?.trim(),
      receptionVenue: formData.get('receptionVenue')?.trim(),
      notes: formData.get('notes')?.trim(),
      website: formData.get('website') // Honeypot
    };

    // Client-side anti-duplicate submission check
    const fingerprint = [payload.clientName.toLowerCase(), payload.contactNumber.replace(/\D/g, ''), payload.packageId].join('|');
    const lastSub = JSON.parse(sessionStorage.getItem('ts21-last-inquiry') || 'null');
    if (lastSub && lastSub.fingerprint === fingerprint && (Date.now() - lastSub.time < 30000)) {
      if (inquiryErrorBox) {
        inquiryErrorBox.textContent = 'This inquiry was already submitted. Our team has your details and will contact you shortly.';
        inquiryErrorBox.hidden = false;
      }
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending securely to studio...';

    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit inquiry. Please try again.');
      }

      // Save to sessionStorage
      sessionStorage.setItem('ts21-last-inquiry', JSON.stringify({
        fingerprint,
        time: Date.now(),
        code: result.inquiry.referenceCode
      }));

      // Render Confirmation View
      inquiryForm.hidden = true;
      if (inquirySuccessView) {
        document.getElementById('success-client-name').textContent = result.inquiry.clientName.split(' ')[0] || 'Friend';
        document.getElementById('success-ref-code').textContent = result.inquiry.referenceCode;
        document.getElementById('success-package-name').textContent = result.inquiry.packageName || 'Custom Inquiry';
        
        const dateRow = document.getElementById('success-date-row');
        const dateVal = document.getElementById('success-event-date');
        if (result.inquiry.eventDate) {
          dateVal.textContent = result.inquiry.eventDate;
          dateRow.hidden = false;
        } else {
          dateRow.hidden = true;
        }

        // Configure direct Messenger follow-up link
        const messengerFollowupBtn = document.getElementById('btn-messenger-followup');
        if (messengerFollowupBtn) {
          const msg = encodeURIComponent(`Hi Timeless Studio 21! I just submitted an inquiry on your website with Reference Code: ${result.inquiry.referenceCode} for ${result.inquiry.clientName}.`);
          messengerFollowupBtn.href = `https://m.me/100084553065280?text=${msg}`;
        }

        inquirySuccessView.hidden = false;
      }

    } catch (err) {
      if (inquiryErrorBox) {
        inquiryErrorBox.textContent = err.message || 'Network error occurred. Please verify your connection or message us on Facebook.';
        inquiryErrorBox.hidden = false;
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Inquiry Now';
    }
  });
}

function setupEventListeners() {
  // Close dialog on backdrop click
  [packageDialog, inquiryDialog, portfolioLightbox].forEach(dialog => {
    if (dialog) {
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
      });
    }
  });
}
