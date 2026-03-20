let transport = null;

function getTransport() {
  if (transport !== null) return transport;

  if (process.env.SENDGRID_API_KEY) {
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      transport = { type: 'sendgrid', client: sgMail };
      return transport;
    } catch (_e) { /* fall through */ }
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      transport = { type: 'smtp', client: transporter };
      return transport;
    } catch (_e) { /* fall through */ }
  }

  transport = { type: 'none', client: null };
  return transport;
}

const FROM = process.env.EMAIL_FROM || 'noreply@whale.ps';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Whale · الحوت';

function wrap(content, preheader = '') {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:Tajawal,Arial,sans-serif;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
<tr><td style="background:#1472a3;padding:24px;text-align:center;">
<span style="font-size:28px;color:#fff;font-weight:bold;">🐳 Whale</span>
</td></tr>
<tr><td style="padding:32px 24px;">${content}</td></tr>
<tr><td style="padding:16px 24px;text-align:center;color:#888;font-size:12px;border-top:1px solid #eee;">
<p>Whale · الحوت — السوق الكبير</p>
<a href="${process.env.SITE_URL || 'https://whale.ps'}/unsubscribe" style="color:#888;">إلغاء الاشتراك</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function send(to, subject, html) {
  const t = getTransport();
  if (t.type === 'none') return;

  try {
    if (t.type === 'sendgrid') {
      await t.client.send({ to, from: { email: FROM, name: FROM_NAME }, subject, html });
    } else if (t.type === 'smtp') {
      await t.client.sendMail({ from: `"${FROM_NAME}" <${FROM}>`, to, subject, html });
    }
  } catch (e) {
    console.error('[Email] Failed to send:', e.message);
  }
}

async function sendWelcome(user) {
  const html = wrap(`
    <h2 style="color:#1472a3;">مرحباً ${user.username}! 🎉</h2>
    <p>أهلاً بك في Whale — السوق الكبير.</p>
    <p>حسابك جاهز مع <strong>30 يوم Pro مجاناً</strong>!</p>
    <p>ابدأ الآن بإضافة أول إعلان لك:</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${process.env.SITE_URL || ''}/whale/sell" style="background:#1472a3;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">أضف إعلان</a>
    </p>
  `, 'مرحباً بك في Whale!');
  await send(user.email, 'مرحباً بك في Whale! 🐳', html);
}

async function sendOrderPlaced(order, buyer, listing) {
  if (buyer?.email) {
    const html = wrap(`
      <h2>تم إنشاء الطلب #${order.orderNumber}</h2>
      <p>المنتج: <strong>${listing.title}</strong></p>
      <p>المبلغ: <strong>₪${order.amount}</strong></p>
      <p>أموالك محفوظة حتى تؤكد الاستلام.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${process.env.SITE_URL || ''}/whale/orders/${order.id}" style="background:#1472a3;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;">تتبع الطلب</a>
      </p>
    `);
    await send(buyer.email, `طلب جديد #${order.orderNumber}`, html);
  }

  // Notify seller
  if (listing.seller?.email) {
    const sellerHtml = wrap(`
      <h2>طلب جديد! 🎉</h2>
      <p>طلب جديد #${order.orderNumber} على "${listing.title}"</p>
      <p>المبلغ: <strong>₪${order.amount}</strong></p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${process.env.SITE_URL || ''}/whale/orders/${order.id}" style="background:#1472a3;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;">عرض الطلب</a>
      </p>
    `);
    await send(listing.seller.email, `طلب جديد #${order.orderNumber}`, sellerHtml);
  }
}

async function sendOrderConfirmed(order, buyer) {
  if (!buyer?.email) return;
  const html = wrap(`
    <h2>تم تأكيد طلبك #${order.orderNumber} ✅</h2>
    <p>البائع أكد الطلب وسيتم شحنه قريباً.</p>
  `);
  await send(buyer.email, `تم تأكيد الطلب #${order.orderNumber}`, html);
}

async function sendOrderShipped(order, buyer, trackingNumber, shippingCompany) {
  if (!buyer?.email) return;
  const html = wrap(`
    <h2>طلبك في الطريق! 📦</h2>
    <p>الطلب #${order.orderNumber} تم شحنه.</p>
    ${trackingNumber ? `<p>رقم التتبع: <strong>${trackingNumber}</strong></p>` : ''}
    ${shippingCompany ? `<p>شركة الشحن: <strong>${shippingCompany}</strong></p>` : ''}
  `);
  await send(buyer.email, `طلبك #${order.orderNumber} تم شحنه`, html);
}

async function sendOrderCompleted(order, seller) {
  if (!seller?.email) return;
  const html = wrap(`
    <h2>تم إتمام الطلب! 💰</h2>
    <p>الطلب #${order.orderNumber} مكتمل والمبلغ ₪${order.amount} تم تحريره لحسابك.</p>
  `);
  await send(seller.email, `تم إتمام الطلب #${order.orderNumber}`, html);
}

async function sendTrialEnding(user, daysLeft) {
  if (!user?.email) return;
  const html = wrap(`
    <h2>اشتراكك Pro ينتهي قريباً ⏰</h2>
    <p>متبقي <strong>${daysLeft} أيام</strong> على انتهاء الفترة التجريبية.</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${process.env.SITE_URL || ''}/upgrade" style="background:#1472a3;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;">جدد الآن</a>
    </p>
  `);
  await send(user.email, 'اشتراكك Pro ينتهي قريباً', html);
}

async function sendPasswordReset(user, resetToken) {
  if (!user?.email) return;
  const html = wrap(`
    <h2>إعادة تعيين كلمة المرور</h2>
    <p style="text-align:center;margin:24px 0;">
      <a href="${process.env.SITE_URL || ''}/auth/reset-password?token=${resetToken}" style="background:#1472a3;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;">إعادة التعيين</a>
    </p>
    <p>إذا لم تطلب هذا، تجاهل هذا البريد.</p>
  `);
  await send(user.email, 'إعادة تعيين كلمة المرور — Whale', html);
}

module.exports = {
  send, sendWelcome, sendOrderPlaced, sendOrderConfirmed,
  sendOrderShipped, sendOrderCompleted, sendTrialEnding, sendPasswordReset,
};
