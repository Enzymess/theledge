// Trim and strip HTML tags from a string
function sanitizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/<[^>]*>/g, '');
}

// Sanitize all string fields in an object (shallow)
function sanitizeObject(obj) {
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    clean[key] = typeof val === 'string' ? sanitizeString(val) : val;
  }
  return clean;
}

// Validate Philippine phone number
function isValidPHPhone(phone) {
  return /^(\+63|0)[9][0-9]{9}$/.test(phone.replace(/\s/g, ''));
}

// Validate email
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Format date to YYYY-MM-DD safely
function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

module.exports = { sanitizeString, sanitizeObject, isValidPHPhone, isValidEmail, formatDate };
