const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'timeless.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize Tables
db.exec(`
CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_code TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  facebook_name TEXT,
  contact_number TEXT NOT NULL,
  email TEXT,
  service_category TEXT NOT NULL,
  package_id TEXT,
  package_name TEXT,
  package_price INTEGER DEFAULT 0,
  event_date TEXT,
  program_time TEXT,
  prep_location TEXT,
  ceremony_venue TEXT,
  reception_venue TEXT,
  guest_count TEXT,
  notes TEXT,
  status TEXT DEFAULT 'New',
  internal_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  featured INTEGER DEFAULT 0,
  badge TEXT,
  short_desc TEXT,
  inclusions TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  featured INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  location TEXT NOT NULL,
  quote TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// ==========================================
// SEED INITIAL DATA (Guarded if tables empty)
// ==========================================

// Seed Packages if empty
const pkgCount = db.prepare('SELECT COUNT(*) as c FROM packages').get().c;
if (pkgCount === 0) {
  const freelancePackages = [
    {
      id: 'wedding-diamond',
      category: 'Weddings',
      name: 'Diamond Cinematic & SDE Wedding',
      price: 58000,
      featured: 1,
      badge: 'SIGNATURE SDE',
      short_desc: 'Full-scale on-location wedding production with aerial drone cinematography and Same-Day Edit film.',
      inclusions: JSON.stringify([
        'Full Day Wedding Photo & Cinema Coverage (Hotel prep, Ceremony & Reception)',
        '2 Senior Master Photographers + 2 Cinematographers',
        'Licensed Drone Pilot & 4K Aerial Cinematography',
        'Same-Day Edit (SDE) Wedding Video projected at reception',
        'Complimentary Prenup / Engagement Photo & Video Session on location',
        '40-Page Premium Flush-Mount Leatherette Magnet Album (11×14)',
        'Two 20-Page Hardcover Parents\' Keepsake Albums (8×10)',
        '16×20 Gallery Canvas Wall Portrait in Sleek Modern Frame',
        'Full High-Res Edited Digital Files in Wooden USB Box & Cloud Gallery'
      ]),
      sort_order: 1
    },
    {
      id: 'wedding-elegance',
      category: 'Weddings',
      name: 'Elegance Gold Wedding',
      price: 32000,
      featured: 1,
      badge: 'MOST POPULAR',
      short_desc: 'Complete photo and cinematic highlight film designed for modern celebrations.',
      inclusions: JSON.stringify([
        'Full Day Photo & Video Coverage (Preparation, Ceremony & Reception)',
        '1 Senior Photographer + 1 Cinematographer',
        '4–6 Minute Cinematic Wedding Highlights Film',
        'Complimentary Prenup Photo Session at chosen Batangas location',
        '30-Page Hardbound Photo Storybook Album (10×10)',
        '11×14 Framed Couple Portrait',
        'Curated High-Res Edited Photos delivered via Cloud Gallery',
        'Master Digital Copy on Customized Flash Drive'
      ]),
      sort_order: 2
    },
    {
      id: 'wedding-classic',
      category: 'Weddings',
      name: 'Classic Silver Wedding',
      price: 24000,
      featured: 0,
      badge: 'CLASSIC COVERAGE',
      short_desc: 'Essential photo and highlight video coverage for intimate and traditional weddings.',
      inclusions: JSON.stringify([
        'Ceremony & Reception Photo and Video Coverage',
        '1 Professional Photographer + 1 Videographer',
        '3–5 Minute Event Highlights Video',
        '20-Page Hardcover Photo Album (8×10)',
        '8×10 Framed Couple Portrait',
        'All High-Resolution Edited Digital Files'
      ]),
      sort_order: 3
    },
    {
      id: 'wedding-photo-only',
      category: 'Weddings',
      name: 'Photo-Only Wedding Story',
      price: 15000,
      featured: 0,
      badge: 'PHOTO ESSENTIAL',
      short_desc: 'Dedicated freelance photography focusing on authentic, candid emotional storytelling.',
      inclusions: JSON.stringify([
        '1 Senior Wedding Photographer',
        'Unlimited Photo Shots from Preparation to Reception Finish',
        '20-Page Hardcover Photo Storybook Album',
        'All Color-Graded High-Resolution Soft Copies via Cloud Drive'
      ]),
      sort_order: 4
    },
    {
      id: 'debut-deluxe',
      category: 'Debuts & Birthdays',
      name: 'Grand 18th Debutante Deluxe',
      price: 26000,
      featured: 1,
      badge: 'DEBUT SIGNATURE',
      short_desc: 'Complete 18th birthday coverage including on-location pre-debut concept shoot and highlights film.',
      inclusions: JSON.stringify([
        'Outdoor / Destination Pre-Debut Creative Concept Shoot',
        'Full Event Coverage (Hotel Prep, 18 Roses/Candles, Program & Party)',
        '1 Senior Photographer + 1 Cinematographer',
        '4-Minute Cinematic Debut Highlights Film',
        '30-Page Hardbound Storybook Album (10×10)',
        '11×14 Framed Portrait for Venue Entrance',
        'High-Resolution Edited Digital Gallery'
      ]),
      sort_order: 5
    },
    {
      id: 'debut-classic',
      category: 'Debuts & Birthdays',
      name: '18th Debut Event Classic',
      price: 16000,
      featured: 0,
      badge: 'FAVORITE',
      short_desc: 'Complete event photo and video coverage for 18th birthday celebrations.',
      inclusions: JSON.stringify([
        'Full Event Coverage (Preparation to Party Finish)',
        '1 Photographer + 1 Videographer',
        '3–5 Minute Debut Highlights Video',
        '20-Page Hardcover Photo Album',
        'High-Resolution Soft Copies via Cloud Link'
      ]),
      sort_order: 6
    },
    {
      id: 'birthday-milestone',
      category: 'Debuts & Birthdays',
      name: 'Milestone Birthday & Party Coverage',
      price: 12000,
      featured: 0,
      badge: 'FAMILY & CELEBRATION',
      short_desc: 'Vibrant coverage for 1st birthdays, 50th golden years, 60th diamond, or kids parties.',
      inclusions: JSON.stringify([
        '1 Dedicated Event Photographer (Up to 4 Hours Coverage)',
        'On-Location Family Group Shots & Program Documentation',
        'Full Party Highlights, Cake Cutting & Candid Guest Moments',
        '20-Page Hardbound Photobook (8×8)',
        'All Edited High-Resolution Soft Copies'
      ]),
      sort_order: 7
    },
    {
      id: 'portrait-grad-lifestyle',
      category: 'Portraits & Lifestyle',
      name: 'Outdoor & Campus Graduation Session',
      price: 3500,
      featured: 1,
      badge: 'GRAD BESTSELLER',
      short_desc: 'Celebrate graduation milestone on-location at your university campus, scenic park, or home.',
      inclusions: JSON.stringify([
        'On-Location Session (Campus, Scenic Batangas Spot, or Home)',
        'Academic Toga + Creative / Casual / Filipiniana Concepts',
        'Mobile Strobe / Reflector Lighting provided by photographer',
        'Full Posing Direction & Creative Guidance',
        '1 pc 8×10 Premium Framed Milestone Print',
        '2 pcs 5×7 Tabletop Prints',
        'Complete Master-Retouched High-Resolution Digital Gallery'
      ]),
      sort_order: 8
    },
    {
      id: 'portrait-family-lifestyle',
      category: 'Portraits & Lifestyle',
      name: 'Home & Outdoor Family Lifestyle Portrait',
      price: 4500,
      featured: 1,
      badge: 'HEIRLOOM MEMORY',
      short_desc: 'Relaxed, candid on-location family portraiture at home, garden, or destination resort.',
      inclusions: JSON.stringify([
        'On-Location Session up to 8 Family Members',
        'Multi-Generation, Couple, Sibling & Grand Group Shots',
        'Natural Ambient & Mobile Creative Lighting',
        '1 pc 11×14 Premium Framed Family Wall Portrait',
        '4 pcs 5×7 Desk Prints',
        'High-Resolution Edited Digital Copies via Cloud'
      ]),
      sort_order: 9
    },
    {
      id: 'portrait-maternity-lifestyle',
      category: 'Portraits & Lifestyle',
      name: 'Maternity & Newborn Lifestyle Session',
      price: 3500,
      featured: 0,
      badge: 'GENTLE CARE',
      short_desc: 'Intimate, natural-light maternity or newborn lifestyle session in the comfort of your home.',
      inclusions: JSON.stringify([
        '1.5-Hour Private On-Location Session (Client Home or Outdoor Location)',
        '2 Attire Concepts (Partner & Siblings Welcome)',
        'Gentle Natural Light & Soft Mobile Fill Light',
        '1 pc 8×10 Framed Keepsake Print',
        '15 Master Retouched High-Resolution Soft Copies'
      ]),
      sort_order: 10
    },
    {
      id: 'portrait-solo-branding',
      category: 'Portraits & Lifestyle',
      name: 'Solo Creative & Personal Branding',
      price: 2800,
      featured: 0,
      badge: 'PERSONAL BRANDING',
      short_desc: 'Professional editorial portraits for entrepreneurs, artists, models, and personal branding.',
      inclusions: JSON.stringify([
        '1-Hour On-Location Shoot at Your Chosen Setting or Office',
        '2 Outfit & Concept Changes',
        'Professional Color Grading & Skin Retouching',
        '1 pc 8×10 Desk Print',
        '12 Curated High-Resolution Digital Files'
      ]),
      sort_order: 11
    },
    {
      id: 'christening-sacred',
      category: 'Christening & Events',
      name: 'Sacred Blessings Baptism Coverage',
      price: 14000,
      featured: 0,
      badge: 'SACRED MILESTONE',
      short_desc: 'Reverent church christening ceremony and festive reception celebration coverage.',
      inclusions: JSON.stringify([
        '1 Photographer + 1 Videographer',
        'Church Ceremony & Reception Photo/Video Coverage',
        'Pre-Ceremony Baby & Godparents Portraiture',
        '3-Minute Highlights Video Reel',
        '20-Page Photo Album (8×10)',
        'All High-Resolution Soft Copies via Cloud'
      ]),
      sort_order: 12
    }
  ];

  const insertPkgStmt = db.prepare(`
    INSERT INTO packages (id, category, name, price, featured, badge, short_desc, inclusions, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const pkg of freelancePackages) {
    insertPkgStmt.run(pkg.id, pkg.category, pkg.name, pkg.price, pkg.featured, pkg.badge, pkg.short_desc, pkg.inclusions, pkg.sort_order);
  }
}

// Seed Portfolio if empty
const portCount = db.prepare('SELECT COUNT(*) as c FROM portfolio_items').get().c;
if (portCount === 0) {
  const freelancePortfolio = [
    {
      category: 'Weddings',
      title: 'Romantic Coastal Vows',
      subtitle: 'Batangas Coastline On-Location Ceremony',
      image_url: '/assets/hero-wedding.jpg',
      featured: 1,
      sort_order: 1
    },
    {
      category: 'Debuts & Birthdays',
      title: 'Emerald Enchantment 18th Debut',
      subtitle: 'Grand Ballroom Event Documentation',
      image_url: '/assets/debut-celebration.jpg',
      featured: 1,
      sort_order: 2
    },
    {
      category: 'Portraits & Lifestyle',
      title: 'Academic Excellence Toga Portrait',
      subtitle: 'On-Location University Graduation Shoot',
      image_url: '/assets/grad-portrait.jpg',
      featured: 1,
      sort_order: 3
    },
    {
      category: 'Portraits & Lifestyle',
      title: 'Generations of Joy',
      subtitle: 'On-Location Family Lifestyle Portrait',
      image_url: '/assets/family-studio.jpg',
      featured: 1,
      sort_order: 4
    },
    {
      category: 'Christening & Events',
      title: 'Angelic Sacred Baptism',
      subtitle: 'Church Ceremony & Milestone Keepsake',
      image_url: '/assets/christening-baby.jpg',
      featured: 0,
      sort_order: 5
    },
    {
      category: 'Portraits & Lifestyle',
      title: 'Mobile Production & Lighting Setup',
      subtitle: 'Professional Mobile Strobes & Gear on Location',
      image_url: '/assets/studio-interior.jpg',
      featured: 0,
      sort_order: 6
    }
  ];

  const pStmt = db.prepare(`
    INSERT INTO portfolio_items (category, title, subtitle, image_url, featured, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const item of freelancePortfolio) {
    pStmt.run(item.category, item.title, item.subtitle, item.image_url, item.featured, item.sort_order);
  }
}

// Seed Testimonials if empty
const testCount = db.prepare('SELECT COUNT(*) as c FROM testimonials').get().c;
if (testCount === 0) {
  const initialTestimonials = [
    {
      client_name: 'Maria & Joshua L.',
      event_type: 'Wedding Coverage',
      location: 'The Farm at San Benito, Lipa',
      quote: 'Our wedding Same-Day Edit (SDE) video left our entire reception in tears. The crew arrived early at the hotel, blended into the background seamlessly, and captured every quiet emotion we missed in the rush of the day.',
      rating: 5,
      sort_order: 1
    },
    {
      client_name: 'Camille Dimaculangan',
      event_type: '18th Debut Grand Gala',
      location: 'Tanauan City',
      quote: 'My 18th Debut pre-debut concept shoot at an ancestral garden was an incredible experience. They brought portable lighting that made the shots look like a magazine spread. The highlight video was perfection!',
      rating: 5,
      sort_order: 2
    },
    {
      client_name: 'Engr. Kevin D.',
      event_type: 'Graduation Pictorial',
      location: 'BatStateU Alum',
      quote: 'We booked our on-location college graduation and toga shoot at our campus. They guided all the poses, brought strobes, and delivered edited high-res digital copies within days. Truly professional work.',
      rating: 5,
      sort_order: 3
    },
    {
      client_name: 'The Mendoza Family',
      event_type: 'Family Lifestyle Portrait',
      location: 'Malvar, Batangas',
      quote: 'We did an on-location lifestyle family shoot at our home in Malvar. They were wonderfully patient with our grandparents and toddlers. The framed canvas is now the centerpiece of our home.',
      rating: 5,
      sort_order: 4
    }
  ];

  const tStmt = db.prepare(`
    INSERT INTO testimonials (client_name, event_type, location, quote, rating, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  for (const t of initialTestimonials) {
    tStmt.run(t.client_name, t.event_type, t.location, t.quote, t.rating, t.sort_order);
  }
}

// Seed FAQs if empty
const faqCount = db.prepare('SELECT COUNT(*) as c FROM faqs').get().c;
if (faqCount === 0) {
  const initialFaqs = [
    {
      question: 'Where are you based and how does on-location freelance coverage work?',
      answer: 'We are based in Barangay San Juan, Malvar, Batangas. As a freelance production team, we travel directly to your preparation hotel, church, reception venue, home, or outdoor photoshoot location with full cinema cameras, lighting, and audio equipment.',
      category: 'Operations & Location',
      sort_order: 1
    },
    {
      question: 'How far in advance should we inquire for a wedding or 18th debut?',
      answer: 'We recommend inquiring 3 to 9 months in advance for peak wedding and debut dates (especially October through February). Because we take on limited bookings per date to preserve quality, calendar availability is on a first-come, first-served reservation basis.',
      category: 'Booking & Schedule',
      sort_order: 2
    },
    {
      question: 'What equipment do you bring for on-location shoots?',
      answer: 'We utilize cinema-grade Sony full-frame bodies (FX3 / A7 series), Sony G-Master prime and zoom lenses, mobile Godox wireless strobes with diffusers, wireless Sennheiser and Rode audio microphones for vows and speeches, and CAAP-licensed DJI 4K aerial drones.',
      category: 'Equipment & Production',
      sort_order: 3
    },
    {
      question: 'How are deliverables (photos, albums, and video films) handed over?',
      answer: 'High-resolution edited digital photographs are delivered via a private, password-protected cloud gallery suitable for instant sharing. For premium wedding and debut tiers, customized wooden USB boxes and archival flush-mount albums are delivered directly or sent via express courier.',
      category: 'Deliverables & Archival',
      sort_order: 4
    },
    {
      question: 'Do you cover events outside of Batangas province?',
      answer: 'Yes! While Malvar, Lipa, and Tanauan are our home base, we frequently cover destination events across Tagaytay, Laguna, Cavite, Metro Manila, Quezon province, and beyond. Minimal out-of-town travel arrangements apply depending on distance.',
      category: 'Service Areas',
      sort_order: 5
    }
  ];

  const fStmt = db.prepare(`
    INSERT INTO faqs (question, answer, category, sort_order, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);
  for (const f of initialFaqs) {
    fStmt.run(f.question, f.answer, f.category, f.sort_order);
  }
}

// Seed Settings if empty or incomplete
const defaultSettings = {
  business_name: 'Timeless Studio 21',
  tagline: 'Natural Light. Unscripted Stories.',
  subtitle: 'Freelance Photography & Cinematography · Batangas & Beyond',
  address: 'Barangay San Juan, Malvar, Batangas, Philippines',
  primary_phone: '+63 997 433 0341',
  secondary_phone: '+63 997 334 2839',
  display_phones: '0997 433 0341 / 0997 334 2839',
  email: 'timelessstudio21.freelance@gmail.com',
  facebook_url: 'https://www.facebook.com/p/Timeless-Studio-21-100084553065280/',
  facebook_profile_id: '100084553065280',
  messenger_link: 'https://m.me/100084553065280',
  service_area: 'Malvar, Lipa City, Tanauan City, Batangas & CALABARZON (Available for Destination Shoots)',
  operation_mode: 'Freelance On-Location Coverage by Appointment',
  operating_hours: 'Available Daily for Bookings & Consultations · Online Inquiries 24/7'
};

const insertSettingStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [key, value] of Object.entries(defaultSettings)) {
  insertSettingStmt.run(key, value);
}

// ==========================================
// INQUIRY HELPERS
// ==========================================
function generateReferenceCode() {
  const year = new Date().getFullYear();
  const randomChars = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TS21-INQ-${year}-${randomChars}`;
}

function createInquiry(data) {
  const referenceCode = generateReferenceCode();
  const stmt = db.prepare(`
    INSERT INTO inquiries (
      reference_code, client_name, facebook_name, contact_number, email,
      service_category, package_id, package_name, package_price, event_date,
      program_time, prep_location, ceremony_venue, reception_venue, guest_count,
      notes, status, internal_notes
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  stmt.run(
    referenceCode,
    data.client_name,
    data.facebook_name || '',
    data.contact_number,
    data.email || '',
    data.service_category || 'General Inquiry',
    data.package_id || '',
    data.package_name || '',
    Number(data.package_price) || 0,
    data.event_date || '',
    data.program_time || '',
    data.prep_location || '',
    data.ceremony_venue || '',
    data.reception_venue || '',
    data.guest_count || '',
    data.notes || '',
    data.status || 'New',
    data.internal_notes || ''
  );

  return db.prepare('SELECT * FROM inquiries WHERE reference_code = ?').get(referenceCode);
}

function getInquiries({ status, search, limit = 100, offset = 0 } = {}) {
  let query = 'SELECT * FROM inquiries WHERE 1=1';
  const params = [];

  if (status && status !== 'All') {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search && search.trim()) {
    query += ' AND (client_name LIKE ? OR reference_code LIKE ? OR contact_number LIKE ? OR package_name LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

function getInquiryById(id) {
  return db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id);
}

function updateInquiry(id, data) {
  const stmt = db.prepare(`
    UPDATE inquiries SET
      client_name = COALESCE(?, client_name),
      facebook_name = COALESCE(?, facebook_name),
      contact_number = COALESCE(?, contact_number),
      email = COALESCE(?, email),
      service_category = COALESCE(?, service_category),
      package_name = COALESCE(?, package_name),
      package_price = COALESCE(?, package_price),
      event_date = COALESCE(?, event_date),
      program_time = COALESCE(?, program_time),
      prep_location = COALESCE(?, prep_location),
      ceremony_venue = COALESCE(?, ceremony_venue),
      reception_venue = COALESCE(?, reception_venue),
      guest_count = COALESCE(?, guest_count),
      notes = COALESCE(?, notes),
      status = COALESCE(?, status),
      internal_notes = COALESCE(?, internal_notes),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(
    data.client_name ?? null,
    data.facebook_name ?? null,
    data.contact_number ?? null,
    data.email ?? null,
    data.service_category ?? null,
    data.package_name ?? null,
    data.package_price !== undefined ? Number(data.package_price) : null,
    data.event_date ?? null,
    data.program_time ?? null,
    data.prep_location ?? null,
    data.ceremony_venue ?? null,
    data.reception_venue ?? null,
    data.guest_count ?? null,
    data.notes ?? null,
    data.status ?? null,
    data.internal_notes ?? null,
    id
  );

  return getInquiryById(id);
}

function getInquiryStats() {
  const total = db.prepare('SELECT COUNT(*) as c FROM inquiries').get().c;
  const newCount = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE status = 'New'").get().c;
  const confirmed = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE status = 'Confirmed'").get().c;
  const totalPipeline = db.prepare("SELECT COALESCE(SUM(package_price), 0) as s FROM inquiries WHERE status IN ('New', 'Contacted', 'Confirmed')").get().s;

  return {
    total,
    newCount,
    confirmed,
    totalPipeline
  };
}

function updateInquiryStatus(id, status, internalNotes) {
  if (internalNotes !== undefined) {
    db.prepare(`
      UPDATE inquiries 
      SET status = ?, internal_notes = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, internalNotes, id);
  } else {
    db.prepare(`
      UPDATE inquiries 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, id);
  }
  return db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id);
}

function deleteInquiry(id) {
  return db.prepare('DELETE FROM inquiries WHERE id = ?').run(id);
}

// ==========================================
// PACKAGES CRUD
// ==========================================
function getAllPackages(activeOnly = true) {
  const query = activeOnly 
    ? 'SELECT * FROM packages WHERE is_active = 1 ORDER BY sort_order ASC, price DESC'
    : 'SELECT * FROM packages ORDER BY sort_order ASC, price DESC';
  return db.prepare(query).all();
}

function getPackageById(id) {
  return db.prepare('SELECT * FROM packages WHERE id = ?').get(id);
}

function createPackage(data) {
  const id = data.id || ('pkg-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4));
  const stmt = db.prepare(`
    INSERT INTO packages (id, category, name, price, featured, badge, short_desc, inclusions, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.category || 'General',
    data.name,
    Number(data.price) || 0,
    data.featured ? 1 : 0,
    data.badge || '',
    data.short_desc || '',
    typeof data.inclusions === 'string' ? data.inclusions : JSON.stringify(data.inclusions || []),
    Number(data.sort_order) || 0,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1
  );
  return getPackageById(id);
}

function updatePackage(id, data) {
  const stmt = db.prepare(`
    UPDATE packages SET
      category = COALESCE(?, category),
      name = COALESCE(?, name),
      price = COALESCE(?, price),
      featured = COALESCE(?, featured),
      badge = COALESCE(?, badge),
      short_desc = COALESCE(?, short_desc),
      inclusions = COALESCE(?, inclusions),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `);

  stmt.run(
    data.category ?? null,
    data.name ?? null,
    data.price !== undefined ? Number(data.price) : null,
    data.featured !== undefined ? (data.featured ? 1 : 0) : null,
    data.badge ?? null,
    data.short_desc ?? null,
    data.inclusions ? (typeof data.inclusions === 'string' ? data.inclusions : JSON.stringify(data.inclusions)) : null,
    data.sort_order !== undefined ? Number(data.sort_order) : null,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : null,
    id
  );

  return getPackageById(id);
}

function togglePackageActive(id, isActive) {
  db.prepare('UPDATE packages SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
  return getPackageById(id);
}

function deletePackage(id) {
  return db.prepare('DELETE FROM packages WHERE id = ?').run(id);
}

// ==========================================
// PORTFOLIO CRUD
// ==========================================
function getAllPortfolio() {
  return db.prepare('SELECT * FROM portfolio_items ORDER BY sort_order ASC, id ASC').all();
}

function getPortfolioById(id) {
  return db.prepare('SELECT * FROM portfolio_items WHERE id = ?').get(id);
}

function createPortfolioItem(data) {
  const stmt = db.prepare(`
    INSERT INTO portfolio_items (category, title, subtitle, image_url, featured, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    data.category || 'Portraits & Lifestyle',
    data.title,
    data.subtitle || '',
    data.image_url,
    data.featured ? 1 : 0,
    Number(data.sort_order) || 0
  );
  return getPortfolioById(Number(info.lastInsertRowid));
}

function updatePortfolioItem(id, data) {
  const stmt = db.prepare(`
    UPDATE portfolio_items SET
      category = COALESCE(?, category),
      title = COALESCE(?, title),
      subtitle = COALESCE(?, subtitle),
      image_url = COALESCE(?, image_url),
      featured = COALESCE(?, featured),
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `);

  stmt.run(
    data.category ?? null,
    data.title ?? null,
    data.subtitle ?? null,
    data.image_url ?? null,
    data.featured !== undefined ? (data.featured ? 1 : 0) : null,
    data.sort_order !== undefined ? Number(data.sort_order) : null,
    id
  );

  return getPortfolioById(id);
}

function deletePortfolioItem(id) {
  return db.prepare('DELETE FROM portfolio_items WHERE id = ?').run(id);
}

// ==========================================
// TESTIMONIALS CRUD
// ==========================================
function getAllTestimonials(activeOnly = true) {
  const query = activeOnly
    ? 'SELECT * FROM testimonials WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    : 'SELECT * FROM testimonials ORDER BY sort_order ASC, id ASC';
  return db.prepare(query).all();
}

function getTestimonialById(id) {
  return db.prepare('SELECT * FROM testimonials WHERE id = ?').get(id);
}

function createTestimonial(data) {
  const stmt = db.prepare(`
    INSERT INTO testimonials (client_name, event_type, location, quote, rating, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    data.client_name,
    data.event_type || 'Celebration',
    data.location || 'Batangas',
    data.quote,
    Number(data.rating) || 5,
    Number(data.sort_order) || 0,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1
  );
  return getTestimonialById(Number(info.lastInsertRowid));
}

function updateTestimonial(id, data) {
  const stmt = db.prepare(`
    UPDATE testimonials SET
      client_name = COALESCE(?, client_name),
      event_type = COALESCE(?, event_type),
      location = COALESCE(?, location),
      quote = COALESCE(?, quote),
      rating = COALESCE(?, rating),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `);

  stmt.run(
    data.client_name ?? null,
    data.event_type ?? null,
    data.location ?? null,
    data.quote ?? null,
    data.rating !== undefined ? Number(data.rating) : null,
    data.sort_order !== undefined ? Number(data.sort_order) : null,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : null,
    id
  );

  return getTestimonialById(id);
}

function deleteTestimonial(id) {
  return db.prepare('DELETE FROM testimonials WHERE id = ?').run(id);
}

// ==========================================
// FAQS CRUD
// ==========================================
function getAllFaqs(activeOnly = true) {
  const query = activeOnly
    ? 'SELECT * FROM faqs WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    : 'SELECT * FROM faqs ORDER BY sort_order ASC, id ASC';
  return db.prepare(query).all();
}

function getFaqById(id) {
  return db.prepare('SELECT * FROM faqs WHERE id = ?').get(id);
}

function createFaq(data) {
  const stmt = db.prepare(`
    INSERT INTO faqs (question, answer, category, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    data.question,
    data.answer,
    data.category || 'General',
    Number(data.sort_order) || 0,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1
  );
  return getFaqById(Number(info.lastInsertRowid));
}

function updateFaq(id, data) {
  const stmt = db.prepare(`
    UPDATE faqs SET
      question = COALESCE(?, question),
      answer = COALESCE(?, answer),
      category = COALESCE(?, category),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `);

  stmt.run(
    data.question ?? null,
    data.answer ?? null,
    data.category ?? null,
    data.sort_order !== undefined ? Number(data.sort_order) : null,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : null,
    id
  );

  return getFaqById(id);
}

function deleteFaq(id) {
  return db.prepare('DELETE FROM faqs WHERE id = ?').run(id);
}

// ==========================================
// SETTINGS & MASTER AUTHENTICATION
// ==========================================
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settingsObj = {};
  const privateKeys = ['admin_pin', 'admin_password_hash', 'admin_username', 'admin_setup_completed'];
  for (const row of rows) {
    if (!privateKeys.includes(row.key)) {
      settingsObj[row.key] = row.value;
    }
  }
  return settingsObj;
}

function updateSettings(settingsData) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const privateKeys = ['admin_pin', 'admin_password_hash', 'admin_username', 'admin_setup_completed'];
  for (const [key, value] of Object.entries(settingsData)) {
    if (!privateKeys.includes(key)) {
      stmt.run(key, String(value));
    }
  }
  return getSettings();
}

function isAdminSetupCompleted() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'admin_setup_completed'").get();
  return Boolean(row && row.value === '1');
}

function getAdminUsername() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'admin_username'").get();
  return row ? row.value : 'admin';
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password).trim(), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function completeAdminSetup(username, password) {
  if (isAdminSetupCompleted()) {
    return { success: false, error: 'Administrator master account has already been set up.' };
  }

  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '').trim();

  if (!cleanUser || cleanUser.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters long.' };
  }

  if (!cleanPass || cleanPass.length < 8) {
    return { success: false, error: 'Master password must be at least 8 characters long.' };
  }

  if (!/[A-Za-z]/.test(cleanPass) || !/[0-9]/.test(cleanPass)) {
    return { success: false, error: 'Master password must contain both letters and numbers.' };
  }

  const hashedPassword = hashPassword(cleanPass);

  const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  insert.run('admin_username', cleanUser);
  insert.run('admin_password_hash', hashedPassword);
  insert.run('admin_setup_completed', '1');

  // Purge any legacy pin
  db.prepare("DELETE FROM settings WHERE key = 'admin_pin'").run();

  return { success: true, username: cleanUser };
}

function verifyAdminCredentials(username, password) {
  if (!isAdminSetupCompleted()) {
    return false;
  }

  const userRow = db.prepare("SELECT value FROM settings WHERE key = 'admin_username'").get();
  const hashRow = db.prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'").get();

  if (!userRow || !hashRow) return false;

  const expectedUser = userRow.value.trim().toLowerCase();
  const inputUser = String(username || '').trim().toLowerCase();

  if (expectedUser !== inputUser) return false;

  const storedHash = hashRow.value.trim();
  const inputPass = String(password || '').trim();

  if (!storedHash.startsWith('scrypt$')) return false;

  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;

  const salt = parts[1];
  const expectedHash = parts[2];
  const calculatedHash = crypto.scryptSync(inputPass, salt, 64).toString('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(calculatedHash, 'hex'));
  } catch (_) {
    return false;
  }
}

function updateAdminCredentials(currentPassword, newUsername, newPassword) {
  const currentUsername = getAdminUsername();
  if (!verifyAdminCredentials(currentUsername, currentPassword)) {
    return { success: false, error: 'Current master password is incorrect.' };
  }

  const cleanUser = String(newUsername || currentUsername).trim();
  const cleanPass = String(newPassword || '').trim();

  if (!cleanUser || cleanUser.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters long.' };
  }

  if (!cleanPass || cleanPass.length < 8) {
    return { success: false, error: 'New master password must be at least 8 characters long.' };
  }

  if (!/[A-Za-z]/.test(cleanPass) || !/[0-9]/.test(cleanPass)) {
    return { success: false, error: 'New password must contain both letters and numbers.' };
  }

  const hashedPassword = hashPassword(cleanPass);
  const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  insert.run('admin_username', cleanUser);
  insert.run('admin_password_hash', hashedPassword);

  return { success: true, username: cleanUser, message: 'Master administrator credentials updated successfully.' };
}

module.exports = {
  db,
  // Inquiries
  createInquiry,
  getInquiries,
  getInquiryById,
  updateInquiry,
  updateInquiryStatus,
  deleteInquiry,
  getInquiryStats,
  // Packages
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  togglePackageActive,
  deletePackage,
  // Portfolio
  getAllPortfolio,
  getPortfolioById,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  // Testimonials
  getAllTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  // FAQs
  getAllFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
  // Settings & Master Auth
  getSettings,
  updateSettings,
  isAdminSetupCompleted,
  getAdminUsername,
  completeAdminSetup,
  verifyAdminCredentials,
  updateAdminCredentials
};
