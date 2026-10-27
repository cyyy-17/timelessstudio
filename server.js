const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Uploads Configuration for Client PC Image Uploads
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    cb(null, `${safeName}_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit for high-res photography
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith('image/') || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WEBP, GIF, AVIF) are supported.'));
    }
  }
});

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Admin session store with 24-hour TTL
const activeAdminSessions = new Map(); // token -> expiresAt (timestamp)
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// Admin login brute-force throttle
const failedLoginAttempts = new Map(); // ip -> { count, lockedUntil }
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

const recentSubmissions = new Map(); // Fingerprint rate limiter

// Periodic cache cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentSubmissions.entries()) {
    if (now - timestamp > 60000) {
      recentSubmissions.delete(key);
    }
  }
  for (const [token, expiresAt] of activeAdminSessions.entries()) {
    if (now > expiresAt) {
      activeAdminSessions.delete(token);
    }
  }
  for (const [ip, record] of failedLoginAttempts.entries()) {
    if (record.lockedUntil && now > record.lockedUntil) {
      failedLoginAttempts.delete(ip);
    }
  }
}, 300000);

// Admin Auth Middleware (Bearer Token with 24h Expiry)
function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const expiresAt = activeAdminSessions.get(token);
    if (expiresAt && expiresAt > Date.now()) {
      return next();
    } else if (expiresAt) {
      activeAdminSessions.delete(token); // cleanup expired session
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
}

// ==========================================
// PUBLIC API ENDPOINTS
// ==========================================

// Verified Business Profile & Configuration (Dynamic from Settings)
app.get('/api/business-info', (req, res) => {
  try {
    const s = db.getSettings();
    res.json({
      businessName: s.business_name || 'Timeless Studio 21',
      tagline: s.tagline || 'Natural Light. Unscripted Stories.',
      subtitle: s.subtitle || 'Freelance Photography & Cinematography · Batangas & Beyond',
      phoneNumbers: [s.primary_phone || '+63 997 433 0341', s.secondary_phone || '+63 997 334 2839'],
      displayPhones: s.display_phones || '0997 433 0341 / 0997 334 2839',
      address: s.address || 'Barangay San Juan, Malvar, Batangas, Philippines',
      serviceArea: s.service_area || 'Malvar, Lipa City, Tanauan City, Batangas & CALABARZON (Available for Destination Shoots)',
      operationMode: s.operation_mode || 'Freelance On-Location Coverage by Appointment',
      facebookPage: s.facebook_url || 'https://www.facebook.com/p/Timeless-Studio-21-100084553065280/',
      facebookProfileId: s.facebook_profile_id || '100084553065280',
      messengerLink: s.messenger_link || 'https://m.me/100084553065280',
      operatingHours: s.operating_hours || 'Available Daily for Bookings & Consultations · Online Inquiries 24/7',
      email: s.email || 'timelessstudio21.freelance@gmail.com',
      verified: true
    });
  } catch (error) {
    console.error('Error fetching business info:', error);
    res.status(500).json({ error: 'Failed to retrieve business information' });
  }
});

// Packages Catalog
app.get('/api/packages', (req, res) => {
  try {
    const rawPackages = db.getAllPackages(true);
    const packages = rawPackages.map(pkg => ({
      ...pkg,
      featured: Boolean(pkg.featured),
      inclusions: typeof pkg.inclusions === 'string' ? JSON.parse(pkg.inclusions) : pkg.inclusions
    }));
    res.json(packages);
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ error: 'Failed to retrieve packages' });
  }
});

// Portfolio Showcase
app.get('/api/portfolio', (req, res) => {
  try {
    const portfolio = db.getAllPortfolio();
    res.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Failed to retrieve portfolio' });
  }
});

// Client Testimonials
app.get('/api/testimonials', (req, res) => {
  try {
    const testimonials = db.getAllTestimonials(true);
    res.json(testimonials);
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({ error: 'Failed to retrieve testimonials' });
  }
});

// FAQs
app.get('/api/faqs', (req, res) => {
  try {
    const faqs = db.getAllFaqs(true);
    res.json(faqs);
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({ error: 'Failed to retrieve FAQs' });
  }
});

// Package Inquiry Submission (Customer facing)
app.post('/api/inquiries', (req, res) => {
  try {
    const body = req.body || {};

    // 1. Honeypot check for bots
    if (body.website && body.website.trim().length > 0) {
      return res.status(400).json({ error: 'Invalid submission' });
    }

    // 2. Required fields validation
    const clientName = (body.clientName || body.client || '').trim();
    const contactNumber = (body.contactNumber || body.contact || '').trim();
    const serviceCategory = (body.serviceCategory || body.event || body.eventType || 'Event').trim();

    if (!clientName) {
      return res.status(400).json({ error: 'Client name is required.' });
    }
    if (!contactNumber) {
      return res.status(400).json({ error: 'Contact number is required.' });
    }

    // 3. Duplicate Submission Protection (Rate limiting / fingerprint)
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const submissionFingerprint = `${clientIp}_${clientName.toLowerCase()}_${contactNumber}`;
    const now = Date.now();

    if (recentSubmissions.has(submissionFingerprint)) {
      const lastTime = recentSubmissions.get(submissionFingerprint);
      if (now - lastTime < 30000) { // 30 second cooldown
        return res.status(429).json({
          error: 'You have submitted an inquiry recently. Please wait a moment before sending another, or message us on Facebook directly.'
        });
      }
    }
    recentSubmissions.set(submissionFingerprint, now);

    // 4. Create inquiry in database
    const newInquiry = db.createInquiry({
      client_name: clientName,
      facebook_name: (body.facebookName || '').trim(),
      contact_number: contactNumber,
      email: (body.email || '').trim(),
      service_category: serviceCategory,
      package_id: body.packageId || '',
      package_name: (body.packageName || '').trim(),
      package_price: body.packagePrice || 0,
      event_date: body.eventDate || '',
      program_time: (body.programTime || '').trim(),
      prep_location: (body.prepLocation || '').trim(),
      ceremony_venue: (body.ceremonyVenue || body.ceremonyLocation || '').trim(),
      reception_venue: (body.receptionVenue || body.receptionLocation || '').trim(),
      guest_count: body.guestCount || '',
      notes: (body.notes || '').trim()
    });

    res.status(201).json({
      success: true,
      message: 'Inquiry received successfully',
      inquiry: {
        id: newInquiry.id,
        referenceCode: newInquiry.reference_code,
        clientName: newInquiry.client_name,
        packageName: newInquiry.package_name,
        packagePrice: newInquiry.package_price,
        eventDate: newInquiry.event_date,
        createdAt: newInquiry.created_at
      }
    });
  } catch (error) {
    console.error('Error processing inquiry:', error);
    res.status(500).json({ error: 'Internal server error while processing your inquiry.' });
  }
});

// ==========================================
// ADMIN DASHBOARD REST API (Protected)
// ==========================================

// Check Initial Master Setup Status
app.get('/api/admin/setup-status', (req, res) => {
  try {
    const isSetup = db.isAdminSetupCompleted();
    res.json({
      setupCompleted: isSetup,
      username: isSetup ? db.getAdminUsername() : null
    });
  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({ error: 'Failed to check admin setup status' });
  }
});

// Initial Master Security Setup Wizard
app.post('/api/admin/setup', (req, res) => {
  try {
    if (db.isAdminSetupCompleted()) {
      return res.status(400).json({ error: 'Master administrator account has already been initialized.' });
    }

    const { username, password, confirmPassword } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Master username and password are required.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const result = db.completeAdminSetup(username, password);
    if (!result.success) {
      return res.status(400).json(result);
    }

    // Immediately create authenticated session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    activeAdminSessions.set(sessionToken, Date.now() + SESSION_TTL_MS);

    return res.status(201).json({
      success: true,
      token: sessionToken,
      username: result.username,
      message: 'Master administrator credentials configured successfully.'
    });
  } catch (error) {
    console.error('Error completing master setup:', error);
    res.status(500).json({ error: 'Failed to complete master security setup' });
  }
});

// Admin Login with Brute-Force Rate Limiting & Salted scrypt Verification
app.post('/api/admin/login', (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // If initial setup has never been performed, lock normal login and prompt setup
  if (!db.isAdminSetupCompleted()) {
    return res.status(403).json({
      error: 'First-time security setup is required before logging in.',
      needsSetup: true
    });
  }

  const attemptRecord = failedLoginAttempts.get(clientIp);
  if (attemptRecord && attemptRecord.lockedUntil && attemptRecord.lockedUntil > now) {
    const remainingSecs = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
    return res.status(429).json({
      error: `Too many failed login attempts. Portal locked for security. Please try again in ${remainingSecs} seconds.`
    });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (db.verifyAdminCredentials(username, password)) {
    // Reset failed attempts on success
    failedLoginAttempts.delete(clientIp);

    const sessionToken = crypto.randomBytes(32).toString('hex');
    activeAdminSessions.set(sessionToken, Date.now() + SESSION_TTL_MS);
    return res.json({
      success: true,
      token: sessionToken,
      username: db.getAdminUsername(),
      message: 'Authentication successful'
    });
  }

  // Artificial delay to prevent timing analysis & rapid brute forcing
  setTimeout(() => {
    // Record failed attempt
    const count = (attemptRecord?.count || 0) + 1;
    if (count >= MAX_LOGIN_ATTEMPTS) {
      failedLoginAttempts.set(clientIp, { count, lockedUntil: now + LOGIN_LOCKOUT_MS });
      return res.status(429).json({
        error: 'Too many failed login attempts. Portal temporarily locked for 15 minutes.'
      });
    } else {
      failedLoginAttempts.set(clientIp, { count, lockedUntil: 0 });
      const remaining = MAX_LOGIN_ATTEMPTS - count;
      return res.status(401).json({
        error: `Invalid master credentials (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`
      });
    }
  }, 400);
});

// Admin Stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  try {
    const stats = db.getInquiryStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// --- INQUIRIES MANAGEMENT ---

// Admin Inquiries List
app.get('/api/admin/inquiries', requireAdmin, (req, res) => {
  try {
    const { status, search, limit, offset } = req.query;
    const inquiries = db.getInquiries({
      status,
      search,
      limit: Number(limit) || 200,
      offset: Number(offset) || 0
    });
    res.json(inquiries);
  } catch (error) {
    console.error('Error listing inquiries:', error);
    res.status(500).json({ error: 'Failed to retrieve inquiries' });
  }
});

// Admin Create Manual Booking / Inquiry
app.post('/api/admin/inquiries', requireAdmin, (req, res) => {
  try {
    const data = req.body;
    if (!data.client_name || !data.contact_number) {
      return res.status(400).json({ error: 'Client name and contact number are required' });
    }
    const created = db.createInquiry(data);
    res.status(201).json({ success: true, inquiry: created });
  } catch (error) {
    console.error('Error creating manual inquiry:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Admin Get Single Inquiry
app.get('/api/admin/inquiries/:id', requireAdmin, (req, res) => {
  try {
    const inquiry = db.getInquiryById(Number(req.params.id));
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    res.json(inquiry);
  } catch (error) {
    console.error('Error fetching inquiry:', error);
    res.status(500).json({ error: 'Failed to fetch inquiry' });
  }
});

// Admin Update Full Inquiry
app.put('/api/admin/inquiries/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = db.updateInquiry(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Inquiry not found' });
    res.json({ success: true, inquiry: updated });
  } catch (error) {
    console.error('Error updating inquiry:', error);
    res.status(500).json({ error: 'Failed to update inquiry' });
  }
});

// Admin Update Inquiry Status & Internal Notes
app.patch('/api/admin/inquiries/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, internalNotes } = req.body;
    
    const validStatuses = ['New', 'Contacted', 'Awaiting Customer', 'Confirmed', 'Completed', 'Cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const updated = db.updateInquiryStatus(id, status, internalNotes);
    if (!updated) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json({ success: true, inquiry: updated });
  } catch (error) {
    console.error('Error updating inquiry status:', error);
    res.status(500).json({ error: 'Failed to update inquiry' });
  }
});

// Admin Delete Inquiry
app.delete('/api/admin/inquiries/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    db.deleteInquiry(id);
    res.json({ success: true, message: 'Inquiry deleted successfully' });
  } catch (error) {
    console.error('Error deleting inquiry:', error);
    res.status(500).json({ error: 'Failed to delete inquiry' });
  }
});

// --- PACKAGES MANAGEMENT ---

// Admin Package Management List
app.get('/api/admin/packages', requireAdmin, (req, res) => {
  try {
    const packages = db.getAllPackages(false);
    res.json(packages.map(p => ({
      ...p,
      inclusions: typeof p.inclusions === 'string' ? JSON.parse(p.inclusions) : p.inclusions
    })));
  } catch (error) {
    console.error('Error getting admin packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// Admin Create New Package
app.post('/api/admin/packages', requireAdmin, (req, res) => {
  try {
    const created = db.createPackage(req.body);
    res.status(201).json({
      success: true,
      package: {
        ...created,
        inclusions: typeof created.inclusions === 'string' ? JSON.parse(created.inclusions) : created.inclusions
      }
    });
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ error: 'Failed to create package' });
  }
});

// Admin Update Package
app.put('/api/admin/packages/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const updated = db.updatePackage(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Package not found' });
    res.json({
      success: true,
      package: {
        ...updated,
        inclusions: typeof updated.inclusions === 'string' ? JSON.parse(updated.inclusions) : updated.inclusions
      }
    });
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ error: 'Failed to update package' });
  }
});

// Admin Toggle Package Active Status
app.patch('/api/admin/packages/:id/toggle', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const updated = db.togglePackageActive(id, Boolean(isActive));
    res.json({ success: true, package: updated });
  } catch (error) {
    console.error('Error toggling package:', error);
    res.status(500).json({ error: 'Failed to toggle package' });
  }
});

// Admin Delete Package
app.delete('/api/admin/packages/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.deletePackage(id);
    res.json({ success: true, message: 'Package deleted successfully' });
  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

// --- PORTFOLIO MANAGEMENT ---

app.get('/api/admin/portfolio', requireAdmin, (req, res) => {
  try {
    const items = db.getAllPortfolio();
    res.json(items);
  } catch (error) {
    console.error('Error getting portfolio items:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

app.post('/api/admin/portfolio', requireAdmin, (req, res) => {
  try {
    const created = db.createPortfolioItem(req.body);
    res.status(201).json({ success: true, item: created });
  } catch (error) {
    console.error('Error creating portfolio item:', error);
    res.status(500).json({ error: 'Failed to create portfolio item' });
  }
});

app.put('/api/admin/portfolio/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = db.updatePortfolioItem(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Portfolio item not found' });
    res.json({ success: true, item: updated });
  } catch (error) {
    console.error('Error updating portfolio item:', error);
    res.status(500).json({ error: 'Failed to update portfolio item' });
  }
});

app.delete('/api/admin/portfolio/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    db.deletePortfolioItem(id);
    res.json({ success: true, message: 'Portfolio item deleted successfully' });
  } catch (error) {
    console.error('Error deleting portfolio item:', error);
    res.status(500).json({ error: 'Failed to delete portfolio item' });
  }
});

// --- MEDIA LIBRARY & FILE UPLOADS FROM PC ---

// Single Image Upload from PC
app.post('/api/admin/upload', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image exceeds maximum 25MB file size limit' });
      }
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file was received from PC' });
    }

    const publicUrl = `/uploads/${req.file.filename}`;
    res.status(201).json({
      success: true,
      url: publicUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  });
});

// List All Media Assets & Uploads
app.get('/api/admin/media', requireAdmin, (req, res) => {
  try {
    const mediaFiles = [];
    
    // Check uploads directory
    if (fs.existsSync(uploadsDir)) {
      const uploadFiles = fs.readdirSync(uploadsDir);
      for (const f of uploadFiles) {
        const fullPath = path.join(uploadsDir, f);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isFile() && /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(f)) {
            mediaFiles.push({
              url: `/uploads/${f}`,
              name: f,
              filename: f,
              size: stats.size,
              created: stats.mtimeMs,
              mtime: stats.mtimeMs,
              source: 'upload',
              type: 'upload'
            });
          }
        } catch (_) {}
      }
    }
    
    // Check assets directory
    const assetsDir = path.join(__dirname, 'public', 'assets');
    if (fs.existsSync(assetsDir)) {
      const assetFiles = fs.readdirSync(assetsDir);
      for (const f of assetFiles) {
        const fullPath = path.join(assetsDir, f);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isFile() && /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(f)) {
            mediaFiles.push({
              url: `/assets/${f}`,
              name: f,
              filename: f,
              size: stats.size,
              created: stats.mtimeMs,
              mtime: stats.mtimeMs,
              source: 'asset',
              type: 'asset'
            });
          }
        } catch (_) {}
      }
    }

    // Sort newest first
    mediaFiles.sort((a, b) => b.created - a.created);
    res.json(mediaFiles);
  } catch (err) {
    console.error('Error listing media:', err);
    res.status(500).json({ error: 'Failed to list media files' });
  }
});

// Delete Uploaded Media File
app.delete('/api/admin/media/:filename', requireAdmin, (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // Prevent path traversal
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return res.json({ success: true, message: 'Image deleted from media storage' });
    }
    return res.status(404).json({ error: 'File not found or cannot be deleted' });
  } catch (err) {
    console.error('Error deleting media:', err);
    res.status(500).json({ error: 'Failed to delete media file' });
  }
});

// --- TESTIMONIALS MANAGEMENT ---

app.get('/api/admin/testimonials', requireAdmin, (req, res) => {
  try {
    const testimonials = db.getAllTestimonials(false);
    res.json(testimonials);
  } catch (error) {
    console.error('Error getting testimonials:', error);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

app.post('/api/admin/testimonials', requireAdmin, (req, res) => {
  try {
    const created = db.createTestimonial(req.body);
    res.status(201).json({ success: true, testimonial: created });
  } catch (error) {
    console.error('Error creating testimonial:', error);
    res.status(500).json({ error: 'Failed to create testimonial' });
  }
});

app.put('/api/admin/testimonials/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = db.updateTestimonial(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Testimonial not found' });
    res.json({ success: true, testimonial: updated });
  } catch (error) {
    console.error('Error updating testimonial:', error);
    res.status(500).json({ error: 'Failed to update testimonial' });
  }
});

app.delete('/api/admin/testimonials/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    db.deleteTestimonial(id);
    res.json({ success: true, message: 'Testimonial deleted successfully' });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    res.status(500).json({ error: 'Failed to delete testimonial' });
  }
});

// --- FAQS MANAGEMENT ---

app.get('/api/admin/faqs', requireAdmin, (req, res) => {
  try {
    const faqs = db.getAllFaqs(false);
    res.json(faqs);
  } catch (error) {
    console.error('Error getting FAQs:', error);
    res.status(500).json({ error: 'Failed to fetch FAQs' });
  }
});

app.post('/api/admin/faqs', requireAdmin, (req, res) => {
  try {
    const created = db.createFaq(req.body);
    res.status(201).json({ success: true, faq: created });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({ error: 'Failed to create FAQ' });
  }
});

app.put('/api/admin/faqs/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = db.updateFaq(id, req.body);
    if (!updated) return res.status(404).json({ error: 'FAQ not found' });
    res.json({ success: true, faq: updated });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({ error: 'Failed to update FAQ' });
  }
});

app.delete('/api/admin/faqs/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    db.deleteFaq(id);
    res.json({ success: true, message: 'FAQ deleted successfully' });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({ error: 'Failed to delete FAQ' });
  }
});

// --- SETTINGS & PIN MANAGEMENT ---

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    const settings = db.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    const updated = db.updateSettings(req.body);
    res.json({ success: true, settings: updated, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.put('/api/admin/change-credentials', requireAdmin, (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword, confirmPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password confirmation does not match.' });
    }
    const result = db.updateAdminCredentials(currentPassword, newUsername, newPassword);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Error changing admin credentials:', error);
    res.status(500).json({ error: 'Failed to update master credentials' });
  }
});

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Specific routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback route to serve customer index
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Timeless Studio 21 server running on http://localhost:${PORT}`);
  console.log(`Admin portal available at http://localhost:${PORT}/admin`);
});
