'use strict';

const prisma = require('../lib/prisma');

const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Whale · الحوت';
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@whale.ps';
const FROM = `${FROM_NAME} <${FROM_EMAIL}>`;
const BASE_URL = process.env.OAUTH_CALLBACK_BASE || process.env.SITE_URL || process.env.BASE_URL || 'http://localhost:3000';

let cachedTransport = null;

async function getTransport() {
  if (cachedTransport) return cachedTransport;

  if (process.env.EMAIL_PROVIDER === 'sendgrid' && process.env.SENDGRID_API_KEY) {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    cachedTransport = { type: 'sendgrid', client: sgMail };
    return cachedTransport;
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    cachedTransport = { type: 'smtp', client: transporter };
    return cachedTransport;
  }

  cachedTransport = { type: 'none', client: null };
  return cachedTransport;
}

function wrap(content, preheader = '') {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Whale · الحوت</title>
</head>
<body style="margin:0;padding:0;background:#F2F7FA;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl">
  <div style="display:none;max-height:0;overflow:hidden">${preheader}</div>
  <div style="max-width:560px;margin:0 auto;padding:28px 14px">
    <div style="text-align:center;margin-bottom:18px">
      <div style="width:50px;height:50px;background:#0A4B6E;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:26px">🐳</div>
      <div style="font-size:20px;font-weight:800;color:#0A4B6E;margin-top:8px">Whale · الحوت</div>
    </div>
    <div style="background:#FFFFFF;border:1px solid #D8E8F0;border-radius:16px;padding:26px">
      ${content}
      <div style="margin-top:20px;background:#E6F7F5;color:#0E9383;border-radius:10px;padding:10px;text-align:center;font-size:13px;font-weight:600">
        🐳 أموالك محفوظة حتى تؤكد الاستلام
      </div>
    </div>
    <div style="text-align:center;font-size:12px;color:#8BA4B4;line-height:1.8;margin-top:16px">
      <a href="${BASE_URL}" style="color:#1472A3;text-decoration:none">${BASE_URL}</a><br>
      طولكرم، فلسطين · Tulkarem, Palestine<br>
      <a href="${BASE_URL}/unsubscribe" style="color:#1472A3;text-decoration:none">إلغاء الاشتراك</a>
    </div>
  </div>
</body>
</html>`;
}

async function send(to, subject, html) {
  if (!to || !subject || !html) return;
  try {
    const transport = await getTransport();
    if (transport.type === 'sendgrid') {
      await transport.client.send({ from: FROM, to, subject, html });
      return;
    }
    if (transport.type === 'smtp') {
      await transport.client.sendMail({ from: FROM, to, subject, html });
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(`[Email] Skipped "${subject}" to ${to} (no configured provider)`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[Email] Failed "${subject}" to ${to}: ${err.message}`);
  }
}

async function sendWelcome(user) {
  if (!user?.email) return;
  const html = wrap(`
    <h2 style="margin:0 0 10px;font-size:20px;color:#0D1B26">🎉 أهلاً وسهلاً، ${user.username || 'صديقنا'}!</h2>
    <p style="margin:0 0 10px;font-size:15px;color:#4A6072;line-height:1.7">حسابك على Whale أصبح جاهزاً. يمكنك الآن البيع والشراء بأمان.</p>
    <p style="margin:0 0 14px;font-size:15px;color:#4A6072;line-height:1.7"><strong>30 يوم Pro مجاناً</strong> بدأت الآن.</p>
    <div style="text-align:center"><a href="${BASE_URL}/whale/sell" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">أضف إعلانك الأول</a></div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid #E8F4FC;color:#8BA4B4;font-size:13px;direction:ltr;text-align:left">Welcome to Whale. Your account is ready and your 30-day Pro trial is active.</div>
  `, 'Welcome to Whale');
  await send(user.email, '🐳 أهلاً بك في Whale — Welcome to Whale', html);
}

async function sendOrderPlaced(order, buyer, listing) {
  if (buyer?.email) {
    const html = wrap(`
      <h2 style="margin:0 0 10px;font-size:20px;color:#0D1B26">✅ تم تقديم طلبك</h2>
      <p style="margin:0 0 10px;font-size:15px;color:#4A6072;line-height:1.7">المنتج: <strong>${listing?.title || ''}</strong></p>
      <p style="margin:0 0 10px;font-size:15px;color:#4A6072;line-height:1.7">رقم الطلب: <strong>${order.orderNumber}</strong></p>
      <p style="margin:0 0 14px;font-size:15px;color:#4A6072;line-height:1.7">الإجمالي: <strong>${order.amount} ₪</strong></p>
      <div style="text-align:center"><a href="${BASE_URL}/whale/orders/${order.id}" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">تتبع طلبك</a></div>
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid #E8F4FC;color:#8BA4B4;font-size:13px;direction:ltr;text-align:left">Order ${order.orderNumber} placed successfully.</div>
    `, `Order ${order.orderNumber} placed`);
    await send(buyer.email, `✅ تم استلام طلبك #${order.orderNumber}`, html);
  }

  const seller = await prisma.user.findUnique({ where: { id: order.sellerId } }).catch(() => null);
  if (seller?.email) {
    const html = wrap(`
      <h2 style="margin:0 0 10px;font-size:20px;color:#0D1B26">🛒 طلب جديد على إعلانك</h2>
      <p style="margin:0 0 10px;font-size:15px;color:#4A6072;line-height:1.7">رقم الطلب: <strong>${order.orderNumber}</strong></p>
      <p style="margin:0 0 10px;font-size:15px;color:#4A6072;line-height:1.7">المنتج: <strong>${listing?.title || ''}</strong></p>
      <p style="margin:0 0 14px;font-size:15px;color:#4A6072;line-height:1.7">المبلغ: <strong>${order.amount} ₪</strong></p>
      <div style="text-align:center"><a href="${BASE_URL}/whale/orders/${order.id}" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">تأكيد الطلب</a></div>
    `, 'New order needs your action');
    await send(seller.email, `🛒 طلب جديد #${order.orderNumber}`, html);
  }
}

async function sendOrderConfirmed(order, buyer) {
  if (!buyer?.email) return;
  const html = wrap(`
    <h2 style="margin:0 0 10px;font-size:20px;color:#0D1B26">✅ البائع أكّد طلبك</h2>
    <p style="margin:0 0 10px;font-size:15px;color:#4A6072;line-height:1.7">رقم الطلب: <strong>${order.orderNumber}</strong></p>
    <p style="margin:0 0 14px;font-size:15px;color:#4A6072;line-height:1.7">ستتلقى تحديثاً عند الشحن.</p>
    <div style="text-align:center"><a href="${BASE_URL}/whale/orders/${order.id}" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">متابعة الطلب</a></div>
  `, 'Seller confirmed your order');
  await send(buyer.email, `✅ طلبك #${order.orderNumber} تم تأكيده`, html);
}

async function sendOrderShipped(order, buyer, trackingNumber, shippingCompany) {
  if (!buyer?.email) return;
  const trackingHtml = trackingNumber
    ? `<p style="margin:0 0 10px;font-size:15px;color:#4A6072;line-height:1.7">رقم التتبع: <strong>${trackingNumber}</strong></p>`
    : '';
  const html = wrap(`
    <h2 style="margin:0 0 10px;font-size:20px;color:#0D1B26">🚚 طلبك في الطريق</h2>
    <p style="margin:0 0 10px;font-size:15px;color:#4A6072;line-height:1.7">رقم الطلب: <strong>${order.orderNumber}</strong></p>
    <p style="margin:0 0 10px;font-size:15px;color:#4A6072;line-height:1.7">شركة الشحن: <strong>${shippingCompany || 'غير محدد'}</strong></p>
    ${trackingHtml}
    <div style="text-align:center"><a href="${BASE_URL}/whale/orders/${order.id}" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">تتبع الطلب</a></div>
  `, 'Your order has shipped');
  await send(buyer.email, `🚚 تم شحن طلبك #${order.orderNumber}`, html);
}

async function sendOrderCompleted(order, seller) {
  if (!seller?.email) return;
  const html = wrap(`
    <h2 style="margin:0 0 10px;font-size:20px;color:#0D1B26">💰 تم إتمام البيع</h2>
    <p style="margin:0 0 10px;font-size:15px;color:#4A6072;line-height:1.7">رقم الطلب: <strong>${order.orderNumber}</strong></p>
    <p style="margin:0 0 14px;font-size:15px;color:#4A6072;line-height:1.7">تم تحرير مبلغ <strong>${order.amount} ₪</strong> لحسابك.</p>
    <div style="text-align:center"><a href="${BASE_URL}/whale/orders/${order.id}" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">عرض الطلب</a></div>
  `, 'Order completed');
  await send(seller.email, `💰 الطلب #${order.orderNumber} مكتمل`, html);
}

async function sendTrialEnding(user, daysLeft) {
  if (!user?.email) return;
  const html = wrap(`
    <h2 style="margin:0 0 10px;font-size:20px;color:#0D1B26">⚡ اشتراكك Pro ينتهي قريباً</h2>
    <p style="margin:0 0 10px;font-size:15px;color:#4A6072;line-height:1.7">ينتهي خلال <strong>${daysLeft}</strong> أيام.</p>
    <p style="margin:0 0 14px;font-size:15px;color:#4A6072;line-height:1.7">جدّد الآن حتى لا تفقد مميزات Pro.</p>
    <div style="text-align:center"><a href="${BASE_URL}/upgrade" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">ترقية الحساب</a></div>
  `, 'Your Pro plan expires soon');
  await send(user.email, `⚡ اشتراكك ينتهي خلال ${daysLeft} أيام`, html);
}

async function sendPasswordReset(user, resetToken) {
  if (!user?.email || !resetToken) return;
  const resetUrl = `${BASE_URL}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
  const html = wrap(`
    <h2 style="margin:0 0 10px;font-size:20px;color:#0D1B26">🔑 إعادة تعيين كلمة المرور</h2>
    <p style="margin:0 0 14px;font-size:15px;color:#4A6072;line-height:1.7">لطلب إعادة التعيين اضغط الزر التالي:</p>
    <div style="text-align:center"><a href="${resetUrl}" style="display:inline-block;background:#0A4B6E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">إعادة التعيين</a></div>
  `, 'Password reset');
  await send(user.email, '🔑 إعادة تعيين كلمة المرور', html);
}

module.exports = {
  send,
  sendWelcome,
  sendOrderPlaced,
  sendOrderConfirmed,
  sendOrderShipped,
  sendOrderCompleted,
  sendTrialEnding,
  sendPasswordReset
};
