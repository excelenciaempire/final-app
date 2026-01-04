# Spediak Redesign - Deployment Guide

## 🎯 Overview
This guide covers deploying the redesigned Spediak application with new features including SOP management, subscription tiers, Discord integration, and enhanced admin tools.

## 📋 Pre-Deployment Checklist

### 1. Database Migrations
Run the following migrations in order:

```bash
cd app-spediak/backend
node scripts/run-migrations.js
```

**Manual Migration (if script fails):**
```bash
# Connect to your Neon database
psql "YOUR_DATABASE_URL"

# Run each migration file:
\i migrations/003_create_user_profiles_and_subscriptions.sql
\i migrations/004_create_sop_tables.sql
\i migrations/005_create_ads_and_admin_audit.sql
```

### 2. Environment Variables

**Backend (.env):**
```env
# Existing
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
CLERK_SECRET_KEY=sk_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# NEW - Discord OAuth
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=https://your-domain.com/api/discord/callback

# NEW - Stripe (for subscriptions)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Frontend (app.config.js / .env):**
```env
EXPO_PUBLIC_API_URL=https://your-backend.com
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
```

### 3. Install Dependencies

**Backend:**
```bash
cd app-spediak/backend
npm install
```

**Frontend:**
```bash
cd app-spediak/Spediak
npm install
# AsyncStorage was already installed
```

## 🗄️ Database Schema Changes

### New Tables Created:
1. **user_profiles** - Extended user data (company, states serviced, organization)
2. **user_subscriptions** - Subscription plans and usage tracking
3. **sop_documents** - SOP document metadata
4. **sop_assignments** - State/Org to SOP mappings
5. **sop_history** - Immutable audit log for SOP changes
6. **ad_inventory** - Banner ad management
7. **admin_audit_log** - Admin action tracking
8. **discord_connections** - Discord OAuth data

### Indexes Created:
- Performance indexes on all foreign keys
- Indexes on frequently queried columns (status, dates, etc.)

## 🚀 Deployment Steps

### Step 1: Backend Deployment
```bash
cd app-spediak/backend
npm run start
# or deploy to your hosting service (Render, Railway, etc.)
```

### Step 2: Run Database Migrations
```bash
node scripts/run-migrations.js
```

### Step 3: Seed Initial Data (Optional)
Create demo ads for testing:
```sql
INSERT INTO ad_inventory (title, subtitle, destination_url, image_url, created_by)
VALUES 
  ('Moisture Meter', 'Fast moisture checks on site', 'https://amazon.com/...', null, 'system'),
  ('Outlet Tester', 'Quick electrical spot checks', 'https://amazon.com/...', null, 'system'),
  ('Thermal Camera', 'Great for basic diagnostics', 'https://amazon.com/...', null, 'system');
```

### Step 4: Frontend Build
```bash
cd app-spediak/Spediak

# For Web:
npm run build
# Deploy dist/ folder to Vercel/Netlify

# For Mobile:
expo build:ios
expo build:android
```

## 🧪 Testing Checklist

### Backend API Testing:
- [ ] User profile APIs (/api/user/profile)
- [ ] Subscription APIs (/api/user/subscription)
- [ ] SOP upload and assignment (/api/admin/sop/*)
- [ ] Ad management (/api/admin/ads)
- [ ] Discord OAuth flow (/api/discord/*)
- [ ] Statement generation with usage tracking

### Frontend Testing:

#### Mobile (iOS/Android):
- [ ] State selector in header
- [ ] Statement usage card displays correctly
- [ ] Ad banner rotates (free users only)
- [ ] SOP alignment card shows active SOPs
- [ ] Statement history accordion/dropdown
- [ ] SOP page with state/org selection
- [ ] Discord OAuth redirects properly
- [ ] Profile page with all new fields
- [ ] Plan selection page

#### Web (Desktop):
- [ ] Sidebar navigation with all menu items
- [ ] State selector dropdown in header
- [ ] All mobile features work on web
- [ ] Admin dashboard accessible
- [ ] SOP Management tab functional
- [ ] SOP History page with filters
- [ ] File uploads work (SOP documents, ad images)
- [ ] Responsive layout on different screen sizes

### Admin Features:
- [ ] SOP Management tab loads in admin dashboard
- [ ] Upload SOP documents to Cloudinary
- [ ] Assign SOPs to states
- [ ] Assign SOPs to organizations
- [ ] SOP History displays all changes
- [ ] Filters work in SOP History
- [ ] Export CSV functionality
- [ ] Ad Manager creates/edits/deletes ads
- [ ] User search finds users by email
- [ ] Admin diagnostics display correct data

### State Persistence:
- [ ] Selected state persists across app restarts
- [ ] State change marks content as "stale"
- [ ] Stale warning displays correctly
- [ ] Warning can be dismissed

### Subscription Logic:
- [ ] Free plan enforces 5 statements/30 days
- [ ] Analyze button disables when limit reached
- [ ] Usage counter increments after generation
- [ ] Monthly reset works (after 30 days)
- [ ] Pro/Platinum plans show unlimited
- [ ] Upgrade flow navigates to plan selection

## 🔐 Security Considerations

### Before Production:
1. **Encrypt Discord tokens** in database
2. **Enable RLS** on sensitive tables
3. **Rate limiting** on API endpoints
4. **CSRF protection** on OAuth flows
5. **Sanitize user inputs** for SQL injection
6. **Validate file uploads** (size, type, malware)
7. **Secure admin routes** with server-side checks

## 📊 Monitoring

### Key Metrics to Track:
- Statement generation counts per user
- Subscription conversion rates
- SOP document usage
- Ad click-through rates
- API error rates
- Discord connection success rate

## 🐛 Common Issues

### Issue: Migrations fail
**Solution:** Check DATABASE_URL is set, database is accessible, and previous migrations ran successfully.

### Issue: AsyncStorage errors on web
**Solution:** GlobalStateContext uses localStorage for web automatically.

### Issue: Discord OAuth redirect fails
**Solution:** Ensure DISCORD_REDIRECT_URI matches your registered redirect in Discord Developer Portal.

### Issue: File uploads fail
**Solution:** Verify Cloudinary credentials are correct and API limits aren't exceeded.

### Issue: Ads don't load
**Solution:** Check ad_inventory table has active ads. Component gracefully fails silently to not break UI.

## 📱 Platform-Specific Notes

### iOS:
- Test camera permissions for defect images
- Test file picker for SOP documents
- Verify AsyncStorage permissions

### Android:
- Test all permissions (camera, storage)
- Verify file picker works
- Test back button behavior

### Web:
- Test drag-and-drop for images
- Test file input for SOPs
- Verify localStorage persistence
- Test responsive breakpoints
- Ensure admin dashboard tabs are scrollable

## 🔄 Rollback Plan

If issues arise, rollback using:

```bash
# Restore database from backup
psql "YOUR_DATABASE_URL" < app-spediak/backend/backups/spediak_backup_TIMESTAMP.sql

# Revert code
git revert HEAD
# or
git reset --hard PREVIOUS_COMMIT_HASH
```

## ✅ Post-Deployment Verification

1. Create a test user account
2. Verify state selector works
3. Generate a test statement (should increment counter)
4. Check admin panel loads (for admin users)
5. Upload a test SOP document
6. Verify Discord OAuth redirects correctly
7. Test subscription upgrade flow

## 📞 Support Resources

- Clerk Documentation: https://clerk.com/docs
- Cloudinary API: https://cloudinary.com/documentation
- Discord OAuth: https://discord.com/developers/docs/topics/oauth2
- Neon PostgreSQL: https://neon.tech/docs

