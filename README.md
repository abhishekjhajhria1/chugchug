# ChugChug

A social party app for live beer counters, group activity feeds, QR-based session connections, and photo-verified logs.

## Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS
- Auth + primary data: Supabase
- Realtime live counters/chat/reactions: Firebase Realtime Database

## Key Features

- Beer Counter with live sync to group and party views
- Session logging with required photo upload
- EXIF metadata extraction and display for uploaded photos
- QR code personal connection flow using /connect/:id
- Session friends with 24-hour expiry
- Privacy controls for beer counter, location sharing, and photo metadata

## Prerequisites

1. Node.js 20+
2. npm 10+
3. Supabase project with SQL editor access
4. Firebase project configured for Realtime Database

## Environment Variables

Create a .env file in the project root with your own values:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_DATABASE_URL
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_BARTENDER_API

## Database Setup

Run the migration in Supabase SQL editor:

1. Open src/db/migration.sql
2. Execute the full SQL script in your Supabase project
3. Confirm the following are present:
- Tables: beer_counts, photo_verifications, session_friends
- Columns: profiles.privacy_settings, parties.group_id
- Bucket: photos
- Storage policies for photos bucket

Note: this repo currently uses a manual SQL migration flow (no automated migration runner is configured).

## Install and Run

1. Install dependencies:

npm install

2. Start dev server:

npm run dev

3. Build production bundle:

npm run build

4. Preview production build locally:

npm run preview

## Release Smoke Test Checklist

1. Beer Counter
- Increment/decrement works
- Reset works
- Log Session requires a photo

2. Feed and metadata
- Logged session appears in group feed
- EXIF metadata appears when available
- Photo verification action works

3. QR connect
- Profile QR opens /connect/:id
- Second user can connect successfully
- Session friend row is created and active

4. Privacy settings
- Change settings in Profile
- Save and refresh
- Values persist

## Scripts

- npm run dev: start Vite dev server
- npm run lint: run ESLint
- npm run build: type-check and build production bundle
- npm run preview: preview built app

## Current Gaps

- No automated test framework is configured yet
- Migration application is manual via Supabase SQL editor
- Accessibility and realtime performance hardening are in progress and should be rechecked before major releases
