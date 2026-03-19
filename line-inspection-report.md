# Line-by-Line Inspection Report

- Generated: 2026-03-19T09:19:08.134Z
- Files scanned: 129
- Total lines scanned: 16751
- Findings: 158

## Severity Summary

- High: 0
- Medium: 17
- Low: 141

## Rule Summary

- performance.sync-fs: 16
- quality.console: 54
- quality.long-line: 76
- quality.todo-fixme: 11
- security.unsafe-inline-csp: 1

## Findings

| Severity | Rule | File | Line | Snippet |
|---|---|---|---:|---|
| low | quality.todo-fixme | lib\i18n.js | 242 | 'checkout.err_phone': { ar: 'أدخل رقم جوال فلسطيني بصيغة 05XX-XXX-XXX', en: 'Enter a Palestinian mobile number as 05XX-XXX-XXX' }, |
| low | quality.long-line | lib\i18n.js | 492 | en: 'Whale was born in Tulkarem, Palestine. Our goal is to build the first trusted marketplace serving Palestinians and Arab city residents — where anyone can buy and sell safely, without fear of fraud.' |
| low | quality.long-line | lib\i18n.js | 497 | en: 'We believe every person in Palestine and Arab cities deserves a safe, easy-to-use digital marketplace. Whale protects your money, verifies sellers, and ensures your product arrives.' |
| low | quality.long-line | lib\i18n.js | 542 | 'safety.d1': { ar: 'أموالك محفوظة فقط عند الدفع عبر الموقع. التحويل المباشر لا يوفر أي حماية.', en: 'Your money is protected only when paying through the site. Direct transfer provides no protection.' }, |
| low | quality.long-line | lib\i18n.js | 544 | 'safety.d2': { ar: 'اقرأ التقييمات وعدد المبيعات. البائعون الموثقون ✓ تحققنا من هويتهم.', en: 'Read reviews and sales count. Verified sellers ✓ have had their identity confirmed.' }, |
| low | quality.console | lib\i18n.js | 606 | console.warn(`[i18n] Missing key: ${key}`); |
| low | quality.console | lib\passport.js | 130 | console.warn('[OAuth] Google strategy disabled: missing env vars'); |
| low | quality.console | lib\passport.js | 150 | console.warn('[OAuth] Facebook strategy disabled: missing env vars'); |
| medium | performance.sync-fs | lib\passport.js | 154 | && fs.existsSync(process.env.APPLE_PRIVATE_KEY_PATH)) { |
| low | quality.console | lib\passport.js | 189 | console.warn('[OAuth] Apple strategy disabled: missing env vars/key file'); |
| low | quality.console | lib\prisma.js | 26 | console.error('[Prisma Error]', e.message); |
| low | quality.console | lib\prisma.js | 34 | console.warn(`[Prisma Slow] ${e.query.slice(0, 120)}... took ${e.duration}ms`); |
| low | quality.console | lib\prisma.js | 40 | console.warn('[Prisma Warn]', e.message); |
| low | quality.console | middleware\subscription.js | 65 | console.warn('[lastSeenAt] update failed:', e.message); |
| low | quality.console | middleware\subscription.js | 100 | console.log(`[CRON] Downgraded ${result.count} expired Pro subscriptions`); |
| low | quality.console | middleware\subscription.js | 103 | console.error('[CRON] Pro downgrade job failed:', error.message); |
| low | quality.console | middleware\subscription.js | 147 | console.error('[CRON] Expiry warning job failed:', error.message); |
| low | quality.console | middleware\subscription.js | 200 | console.log(`[CRON] Auto-completed ${staleOrders.length} stale orders`); |
| low | quality.console | middleware\subscription.js | 204 | console.error('[CRON] Whale auto-complete job failed:', error.message); |
| low | quality.console | routes\admin.js | 322 | console.error(err); |
| low | quality.console | routes\admin.js | 339 | console.error(err); |
| low | quality.console | routes\forum.js | 96 | console.error(error); |
| low | quality.console | routes\payment.js | 59 | console.error('[Payment start error]', err.message); |
| low | quality.console | routes\payment.js | 126 | console.error('[PayPal capture error]', err.message); |
| medium | performance.sync-fs | scripts\check-secrets.js | 66 | const entries = fs.readdirSync(dir, { withFileTypes: true }); |
| medium | performance.sync-fs | scripts\check-secrets.js | 87 | const content = fs.readFileSync(filePath, 'utf8'); |
| low | quality.console | scripts\check-secrets.js | 97 | console.error( |
| low | quality.console | scripts\check-secrets.js | 107 | console.log('🔍 Scanning for hardcoded secrets...\n'); |
| low | quality.console | scripts\check-secrets.js | 115 | console.log(`\n📁 Scanned ${fileCount} files.`); |
| low | quality.console | scripts\check-secrets.js | 118 | console.error(`\n🚨 Found ${violationCount} potential secret(s) in source code!`); |
| low | quality.console | scripts\check-secrets.js | 119 | console.error('   Remove them and use environment variables instead.\n'); |
| low | quality.console | scripts\check-secrets.js | 122 | console.log('✅ No hardcoded secrets found.\n'); |
| low | quality.console | scripts\claude-check.js | 28 | console.error(`[claude-check] ${error.message}`); |
| medium | performance.sync-fs | scripts\full-path-coverage.js | 690 | fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), 'utf8'); |
| medium | performance.sync-fs | scripts\full-path-coverage.js | 691 | fs.writeFileSync(OUTPUT_MD, toMarkdown(report), 'utf8'); |
| low | quality.console | scripts\full-path-coverage.js | 693 | console.log(`Saved JSON report: ${OUTPUT_JSON}`); |
| low | quality.console | scripts\full-path-coverage.js | 694 | console.log(`Saved Markdown report: ${OUTPUT_MD}`); |
| low | quality.console | scripts\full-path-coverage.js | 695 | console.log(`Discovered routes: ${report.totalRoutes}`); |
| low | quality.console | scripts\full-path-coverage.js | 696 | console.log(`Requests executed: ${report.totalRequests}`); |
| low | quality.console | scripts\full-path-coverage.js | 697 | console.log(`500 responses: ${summary['500'] \|\| 0}`); |
| low | quality.console | scripts\full-path-coverage.js | 706 | console.error('Coverage runner failed:', error); |
| medium | security.unsafe-inline-csp | scripts\line-inspection.js | 58 | test: (line) => /'unsafe-inline'/.test(line) |
| low | quality.todo-fixme | scripts\line-inspection.js | 67 | id: 'quality.todo-fixme', |
| low | quality.todo-fixme | scripts\line-inspection.js | 69 | description: 'TODO/FIXME/HACK marker present', |
| low | quality.todo-fixme | scripts\line-inspection.js | 70 | test: (line) => /\b(TODO\|FIXME\|HACK\|XXX)\b/i.test(line) |
| medium | performance.sync-fs | scripts\line-inspection.js | 99 | const entries = fs.readdirSync(dir, { withFileTypes: true }); |
| medium | performance.sync-fs | scripts\line-inspection.js | 116 | const text = fs.readFileSync(abs, 'utf8'); |
| medium | performance.sync-fs | scripts\line-inspection.js | 193 | .filter((abs) => fs.existsSync(abs)) |
| medium | performance.sync-fs | scripts\line-inspection.js | 214 | fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), 'utf8'); |
| medium | performance.sync-fs | scripts\line-inspection.js | 215 | fs.writeFileSync(OUTPUT_MD, markdown(report), 'utf8'); |
| low | quality.console | scripts\line-inspection.js | 217 | console.log(`Saved JSON report: ${OUTPUT_JSON}`); |
| low | quality.console | scripts\line-inspection.js | 218 | console.log(`Saved Markdown report: ${OUTPUT_MD}`); |
| low | quality.console | scripts\line-inspection.js | 219 | console.log(`Files scanned: ${report.filesScanned}`); |
| low | quality.console | scripts\line-inspection.js | 220 | console.log(`Total lines scanned: ${report.totalLines}`); |
| low | quality.console | scripts\line-inspection.js | 221 | console.log(`Findings: ${report.findings.length}`); |
| low | quality.console | services\emailService.js | 85 | console.warn(`[Email] Skipped "${subject}" to ${to} (no configured provider)`); |
| low | quality.console | services\emailService.js | 88 | console.error(`[Email] Failed "${subject}" to ${to}: ${err.message}`); |
| low | quality.long-line | services\emailService.js | 98 | <div style="text-align:center"><a href="${BASE_URL}/whale/sell" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">أضف إعلانك الأول</a></di |
| low | quality.long-line | services\emailService.js | 99 | <div style="margin-top:12px;padding-top:10px;border-top:1px solid #E8F4FC;color:#8BA4B4;font-size:13px;direction:ltr;text-align:left">Welcome to Whale. Your account is ready and your 30-day Pro trial is active.</div> |
| low | quality.long-line | services\emailService.js | 111 | <div style="text-align:center"><a href="${BASE_URL}/whale/orders/${order.id}" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">تتبع طلبك< |
| low | quality.long-line | services\emailService.js | 112 | <div style="margin-top:12px;padding-top:10px;border-top:1px solid #E8F4FC;color:#8BA4B4;font-size:13px;direction:ltr;text-align:left">Order ${order.orderNumber} placed successfully.</div> |
| low | quality.long-line | services\emailService.js | 124 | <div style="text-align:center"><a href="${BASE_URL}/whale/orders/${order.id}" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">تأكيد الطل |
| low | quality.long-line | services\emailService.js | 136 | <div style="text-align:center"><a href="${BASE_URL}/whale/orders/${order.id}" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">متابعة الط |
| low | quality.long-line | services\emailService.js | 151 | <div style="text-align:center"><a href="${BASE_URL}/whale/orders/${order.id}" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">تتبع الطلب |
| low | quality.long-line | services\emailService.js | 162 | <div style="text-align:center"><a href="${BASE_URL}/whale/orders/${order.id}" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">عرض الطلب< |
| low | quality.long-line | services\emailService.js | 173 | <div style="text-align:center"><a href="${BASE_URL}/upgrade" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">ترقية الحساب</a></div> |
| low | quality.long-line | services\emailService.js | 184 | <div style="text-align:center"><a href="${resetUrl}" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">إعادة التعيين</a></div> |
| low | quality.long-line | services\searchService.js | 28 | ts_headline('simple', coalesce(name, '') \|\| ' ' \|\| coalesce("nameAr", '') \|\| ' ' \|\| coalesce(description, '') \|\| ' ' \|\| coalesce("descriptionAr", ''), plainto_tsquery('simple', ${q})) AS snippet |
| low | quality.long-line | services\searchService.js | 30 | WHERE to_tsvector('simple', coalesce(name, '') \|\| ' ' \|\| coalesce("nameAr", '') \|\| ' ' \|\| coalesce(description, '') \|\| ' ' \|\| coalesce("descriptionAr", '')) @@ plainto_tsquery('simple', ${q}) |
| low | quality.long-line | services\searchService.js | 39 | ts_headline('simple', coalesce(title, '') \|\| ' ' \|\| coalesce("titleAr", '') \|\| ' ' \|\| coalesce(description, '') \|\| ' ' \|\| coalesce("descriptionAr", ''), plainto_tsquery('simple', ${q})) AS snippet |
| low | quality.long-line | services\searchService.js | 42 | AND to_tsvector('simple', coalesce(title, '') \|\| ' ' \|\| coalesce("titleAr", '') \|\| ' ' \|\| coalesce(description, '') \|\| ' ' \|\| coalesce("descriptionAr", '')) @@ plainto_tsquery('simple', ${q}) |
| low | quality.console | services\userService.js | 164 | console.warn('[SECURITY] ADMIN_PASSWORD not set — using insecure default. Set ADMIN_PASSWORD in env.'); |
| low | quality.console | services\whaleService.js | 480 | console.error('[Email] sendOrderPlaced failed:', err.message); |
| low | quality.console | services\whaleService.js | 520 | console.error('[Email] sendOrderConfirmed failed:', err.message); |
| low | quality.console | services\whaleService.js | 565 | console.error('[Email] sendOrderShipped failed:', err.message); |
| low | quality.console | services\whaleService.js | 627 | console.error('[Email] sendOrderCompleted failed:', err.message); |
| medium | performance.sync-fs | utils\dataStore.js | 28 | if (!fs.existsSync(DATA_DIR)) { |
| medium | performance.sync-fs | utils\dataStore.js | 31 | if (!fs.existsSync(this.filePath)) { |
| medium | performance.sync-fs | utils\dataStore.js | 32 | fs.writeFileSync(this.filePath, JSON.stringify([], null, 2)); |
| medium | performance.sync-fs | utils\dataStore.js | 39 | const raw = fs.readFileSync(this.filePath, 'utf-8'); |
| low | quality.console | utils\dataStore.js | 42 | console.error(`Error reading ${this.collection}:`, err.message); |
| medium | performance.sync-fs | utils\dataStore.js | 50 | fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2)); |
| low | quality.console | utils\dataStore.js | 53 | console.error(`Error writing ${this.collection}:`, err.message); |
| low | quality.console | utils\seed.js | 219 | console.log('🌱 Seeding products...'); |
| low | quality.console | utils\seed.js | 224 | console.log(`  Found ${existing.length} existing products. Clearing...`); |
| low | quality.console | utils\seed.js | 231 | console.log(`  ✅ Created: ${created.nameAr} (${created.id})`); |
| low | quality.console | utils\seed.js | 234 | console.log(`\n🎉 Done! ${sampleProducts.length} products created.`); |
| low | quality.console | utils\seed.js | 235 | console.log('\nAdmin login:'); |
| low | quality.console | utils\seed.js | 236 | console.log('  URL: http://localhost:3000/admin'); |
| low | quality.console | utils\seed.js | 237 | console.log('  Username: admin'); |
| low | quality.console | utils\seed.js | 238 | console.log('  Password: PcGaming@2024'); |
| medium | performance.sync-fs | utils\upload.js | 18 | if (!fs.existsSync(tmpDir)) { |
| low | quality.console | utils\upload.js | 74 | console.warn('Cloudinary upload failed, fallback to local:', error.message); |
| low | quality.long-line | views\about.ejs | 9 | <p>نحن متخصصون في بيع وتجميع أجهزة الكمبيوتر واللابتوبات والاكسسوارات بأفضل الأسعار في <%= config.location.cityAr %>. نقدم خدمات صيانة وتطوير الأجهزة بأيدي فنيين محترفين.</p> |
| low | quality.long-line | views\admin\dashboard.ejs | 56 | <img src="<%= l.images && l.images[0] ? l.images[0] : '/images/products/placeholder.svg' %>" alt="" width="40" height="40" onerror="this.src='/images/products/placeholder.svg'"> |
| low | quality.long-line | views\admin\listings.ejs | 24 | <td><img src="<%= listing.images && listing.images[0] ? listing.images[0] : '/images/products/placeholder.svg' %>" width="50" height="50" style="border-radius:6px;object-fit:cover"></td> |
| low | quality.long-line | views\admin\listings.ejs | 25 | <td><a href="/marketplace/<%= listing.id %>" target="_blank"><%= listing.titleAr \|\| listing.title %></a><br><small><%= listing.category %> - <%= listing.location %></small></td> |
| low | quality.long-line | views\admin\product-form.ejs | 12 | <form method="POST" action="/admin/products/<%= product && product.id ? 'edit/' + product.id : 'add' %>?_csrf=<%= encodeURIComponent(csrfToken \|\| '') %>" enctype="multipart/form-data" class="product-form"> |
| low | quality.long-line | views\admin\products.ejs | 35 | <td><strong><%= config.currency %> <%= p.price.toLocaleString() %></strong><% if(p.oldPrice) { %><br><s style="color:#888"><%= config.currency %> <%= p.oldPrice.toLocaleString() %></s><% } %></td> |
| low | quality.long-line | views\admin\products.ejs | 36 | <td><button onclick="toggleField('<%= p.id %>','inStock')" class="toggle-btn <%= p.inStock ? 'on' : 'off' %>" id="stock-<%= p.id %>"><%= p.inStock ? '✅ Yes' : '❌ No' %></button></td> |
| low | quality.long-line | views\admin\products.ejs | 37 | <td><button onclick="toggleField('<%= p.id %>','featured')" class="toggle-btn <%= p.featured ? 'on' : 'off' %>" id="feat-<%= p.id %>"><%= p.featured ? '⭐ Yes' : '— No' %></button></td> |
| low | quality.long-line | views\admin\qr.ejs | 34 | <a class="btn btn-sm btn-outline" href="/admin/qr/download-general?url=<%= encodeURIComponent(item.url) %>&label=<%= encodeURIComponent(item.label) %>">تنزيل PNG \| Download PNG</a> |
| low | quality.long-line | views\auth\login.ejs | 74 | <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956  |
| low | quality.long-line | views\auth\login.ejs | 89 | <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 |
| low | quality.long-line | views\auth\register.ejs | 73 | <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956  |
| low | quality.long-line | views\auth\register.ejs | 88 | <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 |
| low | quality.long-line | views\marketplace\detail.ejs | 7 | <img src="<%= listing.images && listing.images[0] ? listing.images[0] : '/images/products/placeholder.svg' %>" alt="<%= listing.titleAr \|\| listing.title %>" class="listing-main-image"> |
| low | quality.long-line | views\marketplace\form.ejs | 108 | <button type="submit" class="btn btn-primary" <%= !listing && !isPro ? 'disabled' : '' %>><%= listing && listing.id ? 'حفظ التعديلات \| Save Changes' : 'نشر الإعلان \| Post Listing' %></button> |
| low | quality.long-line | views\pages\contact.ejs | 16 | style="display:inline-flex;align-items:center;gap:6px;background:#25D366;color:#fff;padding:8px 18px;border-radius:var(--r-sm);font-size:13px;font-weight:700;text-decoration:none" |
| low | quality.long-line | views\pages\contact.ejs | 24 | <div style="width:52px;height:52px;border-radius:var(--r-md);background:var(--c-sky);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">✉</div> |
| low | quality.long-line | views\pages\pricing.ejs | 20 | <div style="text-align:center;font-size:12px;font-weight:700;color:var(--c-teal);padding:10px;background:var(--c-teal-lt);border-radius:var(--r-sm)"><%= t('pricing.current') %></div> |
| low | quality.long-line | views\pages\pricing.ejs | 25 | <div style="position:absolute;top:-12px;inset-inline-start:50%;transform:translateX(-50%);background:var(--c-ocean);color:#fff;font-size:11px;font-weight:700;padding:3px 14px;border-radius:20px;white-space:nowrap"><%= la |
| low | quality.long-line | views\pages\pricing.ejs | 37 | <div style="text-align:center;font-size:12px;font-weight:700;color:var(--c-ocean);padding:10px;background:var(--c-sky);border-radius:var(--r-sm)"><%= t('pricing.current') %></div> |
| low | quality.long-line | views\pages\pricing.ejs | 39 | <a href="/upgrade" style="display:block;text-align:center;background:var(--c-ocean);color:#fff;padding:13px;border-radius:var(--r-sm);font-size:14px;font-weight:700;text-decoration:none"><%= t('pricing.cta') %> →</a> |
| low | quality.long-line | views\pages\safety.ejs | 9 | <div style="width:40px;height:40px;border-radius:50%;background:var(--c-sky);color:var(--c-ocean);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;flex-shrink:0"><%= i %></div> |
| low | quality.long-line | views\partials\listing-card.ejs | 84 | <div class="listing-location">📍 <%= cardCity %><% if (typeof timeAgo === 'function' && listing.createdAt) { %> · <span class="listing-time" data-dynamic-time><%= timeAgo(listing.createdAt) %></span><% } %></div> |
| low | quality.long-line | views\partials\navbar.ejs | 30 | <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> |
| low | quality.long-line | views\partials\navbar.ejs | 53 | <svg class="theme-icon theme-icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17. |
| low | quality.long-line | views\partials\navbar.ejs | 54 | <svg class="theme-icon theme-icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 14.8A9 9 0 1 1 9.2 3a7.2 7.2 0 0 0 11.8 11.8Z"/></svg> |
| low | quality.long-line | views\partials\navbar.ejs | 70 | <button type="button" class="nav-icon-btn nav-notification-trigger" aria-label="<%= t('nav.notifications') %>" aria-haspopup="true" aria-expanded="false" data-notification-toggle> |
| low | quality.long-line | views\partials\navbar.ejs | 71 | <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> |
| low | quality.long-line | views\partials\navbar.ejs | 109 | <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2 |
| low | quality.long-line | views\partials\navbar.ejs | 155 | <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg> |
| low | quality.long-line | views\partials\navbar.ejs | 159 | <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2 |
| low | quality.long-line | views\partials\navbar.ejs | 167 | <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> |
| low | quality.long-line | views\partials\navbar.ejs | 172 | <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> |
| low | quality.long-line | views\partials\navbar.ejs | 178 | <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/>< |
| low | quality.long-line | views\partials\product-card.ejs | 18 | <a href="https://wa.me/<%= whatsappNumber %>?text=مرحبا، أريد الاستفسار عن: <%= encodeURIComponent(product.nameAr) %>" target="_blank" class="btn btn-primary btn-sm">📱 اطلب الآن</a> |
| low | quality.long-line | views\partials\trust-box.ejs | 14 | <div class="trust-item">🔒 <strong><%= typeof t === 'function' ? t('trust.secure') : 'Secure Payment' %></strong><br><%= typeof t === 'function' ? t('trust.secure_d') : 'Encrypted card payment' %></div> |
| low | quality.long-line | views\partials\trust-box.ejs | 15 | <div class="trust-item">🚚 <strong><%= typeof t === 'function' ? t('trust.shipping') : 'Reliable Shipping' %></strong><br><%= typeof t === 'function' ? t('trust.shipping_d') : 'Verified shipping companies' %></div> |
| low | quality.long-line | views\partials\trust-box.ejs | 16 | <div class="trust-item">✅ <strong><%= typeof t === 'function' ? t('trust.protection') : 'Buyer Protection' %></strong><br><%= typeof t === 'function' ? t('trust.protection_d') : 'Money held until delivery confirmed' %></ |
| low | quality.long-line | views\partials\trust-box.ejs | 17 | <div class="trust-item">⭐ <strong><%= typeof t === 'function' ? t('trust.reviews') : 'Real Reviews' %></strong><br><%= typeof t === 'function' ? t('trust.reviews_d') : 'From verified buyers only' %></div> |
| low | quality.long-line | views\product-detail.ejs | 48 | <a href="https://wa.me/<%= whatsappNumber %>?text=مرحبا، أريد طلب: <%= encodeURIComponent(product.nameAr) %> - السعر: <%= product.price %> شيكل" target="_blank" class="btn btn-primary btn-lg">📱 اطلب عبر واتساب</a> |
| low | quality.long-line | views\profile\user-profile.ejs | 22 | <button type="submit" class="btn <%= profile.isFollowing ? 'btn-outline' : 'btn-primary' %>"><%= profile.isFollowing ? 'إلغاء المتابعة \| Unfollow' : 'متابعة \| Follow' %></button> |
| low | quality.long-line | views\rooms\index.ejs | 45 | <a href="/rooms?<%= searchQuery ? 'q=' + encodeURIComponent(searchQuery) + '&' : '' %>cursor=<%= pageInfo.nextCursor %>" class="btn btn-outline">تحميل المزيد \| Load More</a> |
| low | quality.long-line | views\whale\cart.ejs | 36 | <img src="<%= item.listing.images[0] \|\| '/images/products/placeholder.svg' %>" alt="<%= item.listing.titleAr \|\| item.listing.title %>" class="whale-cart-item-image" loading="lazy"> |
| low | quality.long-line | views\whale\checkout.ejs | 107 | <input id="buyerCitySearch" type="search" class="search-input whale-city-search" placeholder="<%= t('checkout.search_city') %>" aria-label="<%= t('checkout.search_city') %>"> |
| low | quality.long-line | views\whale\index.ejs | 224 | <span><%= cat.icon %> <%= lang === 'ar' ? cat.nameAr : cat.name %> (<%= (categoryCounts[cat.slug] \|\| 0).toLocaleString(lang === 'ar' ? 'ar-PS' : 'en-US') %>)</span> |
| low | quality.long-line | views\whale\index.ejs | 370 | <button type="button" class="btn btn-ghost whale-filters-open whale-filters-open-inline" aria-label="<%= t('market.filters_open') %>">☰ <%= t('market.filters_open') %></button> |
| low | quality.long-line | views\whale\index.ejs | 450 | <span class="stars"><%- '★'.repeat(Math.round(listing.seller.sellerProfile.averageRating)) %><%- '☆'.repeat(5 - Math.round(listing.seller.sellerProfile.averageRating)) %></span> |
| low | quality.long-line | views\whale\listing.ejs | 96 | <button type="button" class="whale-thumb-btn <%= index === 0 ? 'active' : '' %>" data-image="<%= thumbImage.src %>" aria-label="<%= `${listing.title} ${index + 1}` %>"> |
| low | quality.long-line | views\whale\listing.ejs | 301 | <a href="<%= waLink %>" target="_blank" rel="noopener" class="btn btn-wa btn-full whale-wa-btn whale-mt-sm" data-id="<%= listing.id %>">💬 <%= t('listing.whatsapp') %></a> |
| low | quality.long-line | views\whale\listing.ejs | 307 | <button type="button" class="btn btn-ghost btn-full whale-save-detail whale-mt-sm" data-id="<%= listing.id %>" data-saved="<%= isSaved ? '1' : '0' %>"> <%= isSaved ? '♥' : '♡' %> <span><%= savedLabel %></span></button> |
| low | quality.todo-fixme | views\whale\order-detail.ejs | 28 | <!-- TODO: move display:block to CSS class --> |
| low | quality.long-line | views\whale\order-detail.ejs | 42 | <a href="<%= shippingCo.trackingUrl.replace('{trackingNumber}', encodeURIComponent(order.trackingNumber)) %>" target="_blank" rel="noopener"><%= t('order.track') %></a> |
| low | quality.todo-fixme | views\whale\order-detail.ejs | 89 | <!-- TODO: move display:inline-block to CSS class --> |
| low | quality.todo-fixme | views\whale\orders.ejs | 5 | <!-- TODO: move flex layout to CSS class --> |
| low | quality.todo-fixme | views\whale\orders.ejs | 8 | <!-- TODO: move flex layout to CSS class --> |
| low | quality.long-line | views\whale\orders.ejs | 10 | <a href="/whale/orders?tab=buying" class="btn btn-sm <%= tab === 'buying' ? 'btn-primary' : 'btn-ghost' %>" role="tab" aria-selected="<%= tab === 'buying' %>"><%= t('order.tab_buying') %></a> |
| low | quality.long-line | views\whale\orders.ejs | 11 | <a href="/whale/orders?tab=selling" class="btn btn-sm <%= tab === 'selling' ? 'btn-primary' : 'btn-ghost' %>" role="tab" aria-selected="<%= tab === 'selling' %>"><%= t('order.tab_selling') %></a> |
| low | quality.long-line | views\whale\sell.ejs | 29 | <textarea id="sellDescriptionAr" name="descriptionAr" rows="4" dir="rtl" placeholder="<%= t('listing.description_ar') \|\| (lang === 'ar' ? 'الوصف بالعربي' : 'Arabic description') %>"></textarea> |
| low | quality.todo-fixme | views\whale\seller-profile.ejs | 10 | <!-- TODO: move flex layout to CSS class --> |
| low | quality.todo-fixme | views\whale\seller-profile.ejs | 14 | <!-- TODO: move margin:0 reset to CSS --> |
| low | quality.long-line | views\whale\seller-profile.ejs | 22 | <div class="profile-stat" aria-label="<%= t('seller.total_sales') %>: <%= profile.totalSales \|\| 0 %>"><div class="val"><%= profile.totalSales \|\| 0 %></div><div class="lbl"><%= t('seller.total_sales') %></div></div> |
| low | quality.long-line | views\whale\seller-profile.ejs | 23 | <div class="profile-stat" aria-label="<%= t('dashboard.avg_rating') %>: <%= Number(profile.averageRating \|\| 0).toFixed(1) %>"><div class="val"><%= Number(profile.averageRating \|\| 0).toFixed(1) %></div><div class="lbl"><% |
| low | quality.long-line | views\whale\seller-profile.ejs | 24 | <div class="profile-stat" aria-label="<%= t('listing.reviews') %>: <%= profile.reviewCount \|\| 0 %>"><div class="val"><%= profile.reviewCount \|\| 0 %></div><div class="lbl"><%= t('listing.reviews') %></div></div> |
| low | quality.long-line | views\whale\seller-profile.ejs | 25 | <div class="profile-stat" aria-label="<%= t('seller.active_listings') %>: <%= listings.length %>"><div class="val"><%= listings.length %></div><div class="lbl"><%= t('seller.active_listings') %></div></div> |
| low | quality.todo-fixme | views\whale\seller-profile.ejs | 62 | <!-- TODO: move padding:12px 0 to CSS class --> |
