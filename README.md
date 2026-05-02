# The Ledge Baguio — Booking System

## Quick Start

```bash
cd backend
npm install
node server.js
```

Then open http://localhost:5000

Admin panel: http://localhost:5000/admin
Login: http://localhost:5000/login (password: Admin@Ledge2025)
Store staff: http://localhost:5000/store-staff
Guest store: http://localhost:5000/store

## Default Admin Account
Email: enzosebastian0719@gmail.com
Password: Admin@Ledge2025
**Change the password after first login.**

## File Layout
```
project/
  backend/          Express server
    server.js       Main entry point
    seed.js         Run once to reset admin password
    src/
      config/       db.js, env.js
      controllers/  All business logic
      middleware/   auth, roleGuard, rateLimiter
      models/       JSON-DB helper models
      routes/       Express routers
      services/     emailService, pricingService
      utils/        logger, sanitize
  frontend/
    pages/          HTML pages
    public/
      css/          style.css, admin.css
      js/           main.js, admin.js, api.js
  data/             JSON database files (auto-created)
```

## Roles
- admin — full access
- manager — most admin features, no staff management
- front_desk — bookings only
- store_staff — POS + inventory
- guest — public booking + honesty store

## Sample Data
Pre-loaded in /data/:
- 3 rooms, 5 guests, 5 bookings
- 3 approved + 2 pending feedback entries
- 2 promo codes (LEDGE10, WELCOME500)
- 2 seasonal pricing modifiers
- 8 store products
