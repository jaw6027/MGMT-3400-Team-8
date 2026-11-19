# NeighborRent

A working MGMT 3400 local equipment marketplace. NeighborRent is a placeholder brand the team can change.

## Run locally

Use Node.js 24 or newer.

```sh
npm ci
npm start
```

Open http://localhost:3000. The server listens on all interfaces. Set `PORT` to change the port. SQLite data persists in `data/marketplace.sqlite` and is excluded from Git. Set `DATABASE_PATH` to choose another database file.

## Try both sides

Click **Sign in → Try as renter** to request equipment, then sign out and choose **Try as owner** to review the request. For sample listings, the two demo accounts are:

- `renter@example.com` / `DemoRental3400!`
- `owner@example.com` / `DemoRental3400!`

These are shared class demonstration accounts. Use sample information in them. Demo equipment is labeled and does not represent real available inventory. New users can create their own account and both rent and list items. New listings, users, and requests are stored in the database.

## Working features

- Equipment search by name/description, category, neighborhood or ZIP text, daily budget, and rental dates.
- Account registration, sign-in, sign-out, hashed passwords, and expiring HTTP-only sessions.
- Listings with descriptions, daily prices, and pickup area.
- Rental requests with dates, messages, and a server-calculated total. Both pickup and return days are charged; maximum 30 days.
- Owner approval/decline and renter cancellation through **My rentals**.
- Approval blocks overlapping dates and automatically declines competing pending requests. Cancellation frees approved dates.
- Email contact details shared with the participants only after approval, with a mail link to arrange pickup. The app does not send email.
- Responsive desktop/mobile interface with inline errors and empty states.

## Validation

```sh
npm test
npm run test:browser
```

API tests use an isolated in-memory database and cover access rules, total calculations, booking conflicts, cancellation, and search availability. Browser checks also use an isolated database and exercise sign-in, request, approval, creating a listing, reload persistence, and mobile overflow. Browser checks expect Chromium at `/usr/bin/chromium` and save screenshots in `/workspace/artifacts` in the class cloud environment.

The earlier customer interview workbook remains in `validation/`.

## Current scope

This is a functional class prototype running on one server, not a hosted production marketplace. Location matching uses entered text, not GPS or distance. Listings use category illustrations; photo uploads and owner-set availability calendars are future work. Availability currently means no approved booking for the selected dates; owners confirm requests themselves.

Payments, deposits, identity checks, insurance, two-way in-app messaging, email delivery, password reset, and account email verification are not implemented. Request messages and approved-contact sharing support arranging a rental manually. The customer validation workbook remains separate from the app.

For a future public launch, configure HTTPS, durable database storage/backups, verified email and password recovery, and an abuse/moderation process. Set `NODE_ENV=production` behind HTTPS for secure session cookies. Set `SEED_DEMO=false` with a **new database** to start without shared demo accounts. That setting does not remove demo accounts from an existing database.
