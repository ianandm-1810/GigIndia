# GIGI India frontend

Mobile-first React app for the GIGI India student freelance marketplace. The UI uses the existing Express API and keeps product limitations visible instead of implying features the API does not provide.

## Run locally

1. Install Node.js, then run `npm install` in this folder.
2. Copy `.env.example` to `.env`.
3. Start the backend on port 5000.
4. Run `npm run dev` and open the local Vite URL shown in the terminal.

The frontend environment values are public configuration only. Do not put Razorpay secrets, JWT secrets, MongoDB credentials, Twilio tokens, or Cloudinary secrets in a `VITE_*` variable.

## Configuration

- `VITE_API_URL`: backend API base URL; defaults to `http://localhost:5000/api`.
- `VITE_SOCKET_URL`: Socket.IO server URL; defaults to `http://localhost:5000`.

## Included screens

Home, about/how it works, login, registration, forgot/reset password, student and client dashboards, gig browse/detail/post, profile, gig chat, payment status, legal draft pages, admin notice, and 404.

The profile screen supports profile-photo and portfolio uploads plus account deletion. Profile text editing is not available because the backend has no profile-update endpoint.

## Offline and privacy behavior

The service worker caches only the static offline page, manifest, icon, and versioned frontend assets. It skips API requests and any request with an Authorization header. When a page is reloaded offline, an informational offline page appears; account details, gigs, and chat still require an internet connection.

## Current backend limitations shown in the UI

- No student proposal/assigned-work history endpoint or combined client proposal inbox.
- No payment history endpoint.
- Razorpay checkout verification records a database status; it does not implement regulated escrow or send a payout to a student.
- Five-day automatic release, disputes, reviews, ratings, and admin moderation routes are not implemented.
- Privacy and terms pages are development drafts and need completed, reviewed legal content before public launch.

## Commands

- `npm run dev`: local development server.
- `npm run lint`: Oxlint checks.
- `npm run build`: production build.
