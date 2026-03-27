const { sendMail, emailTemplate } = require('../lib/mailer');

async function sendWelcome(user) {
  sendMail({
    to: user.email,
    subject: 'مرحباً بك في الحوت | Welcome to Whale',
    html: emailTemplate({
      titleAr: 'مرحباً بك في الحوت!',
      titleEn: 'Welcome to Whale!',
      bodyAr: `مرحباً ${user.username}، تم إنشاء حسابك بنجاح. يمكنك الآن تصفح المنتجات والبدء بالبيع والشراء بأمان.`,
      bodyEn: `Hi ${user.username}, your account has been created successfully. You can now browse listings and start buying and selling safely.`,
    }),
  }).catch(() => {});
}

async function sendOrderPlaced(order) {
  if (!order.seller) return;
  sendMail({
    to: order.seller.email,
    subject: `طلب جديد #${order.orderNumber} | New Order`,
    html: emailTemplate({
      titleAr: 'لديك طلب جديد!',
      titleEn: 'You have a new order!',
      bodyAr: `تم استلام طلب جديد برقم ${order.orderNumber}. يرجى مراجعة الطلب وتأكيده.`,
      bodyEn: `A new order #${order.orderNumber} has been placed. Please review and confirm it.`,
    }),
  }).catch(() => {});
}

async function sendOrderConfirmed(order) {
  if (!order.buyer) return;
  sendMail({
    to: order.buyer.email,
    subject: `تم تأكيد طلبك #${order.orderNumber} | Order Confirmed`,
    html: emailTemplate({
      titleAr: 'تم تأكيد طلبك',
      titleEn: 'Your order has been confirmed',
      bodyAr: `تم تأكيد طلبك رقم ${order.orderNumber} من قبل البائع. سيتم شحنه قريباً.`,
      bodyEn: `Your order #${order.orderNumber} has been confirmed by the seller. It will be shipped soon.`,
    }),
  }).catch(() => {});
}

async function sendOrderShipped(order) {
  if (!order.buyer) return;
  const tracking = order.trackingNumber ? ` (${order.trackingNumber})` : '';
  sendMail({
    to: order.buyer.email,
    subject: `تم شحن طلبك #${order.orderNumber} | Order Shipped`,
    html: emailTemplate({
      titleAr: 'تم شحن طلبك',
      titleEn: 'Your order has been shipped',
      bodyAr: `تم شحن طلبك رقم ${order.orderNumber}${tracking}. يرجى تأكيد الاستلام عند وصوله.`,
      bodyEn: `Your order #${order.orderNumber} has been shipped${tracking}. Please confirm delivery when it arrives.`,
    }),
  }).catch(() => {});
}

async function sendOrderCompleted(order) {
  const emails = [];
  if (order.buyer) {
    emails.push(
      sendMail({
        to: order.buyer.email,
        subject: `اكتمل الطلب #${order.orderNumber} | Order Completed`,
        html: emailTemplate({
          titleAr: 'اكتمل طلبك',
          titleEn: 'Your order is complete',
          bodyAr: `تم إكمال طلبك رقم ${order.orderNumber} بنجاح. شكراً لثقتك بالحوت!`,
          bodyEn: `Your order #${order.orderNumber} is now complete. Thank you for using Whale!`,
        }),
      }).catch(() => {})
    );
  }
  if (order.seller) {
    emails.push(
      sendMail({
        to: order.seller.email,
        subject: `اكتمل الطلب #${order.orderNumber} | Order Completed`,
        html: emailTemplate({
          titleAr: 'اكتمل البيع',
          titleEn: 'Sale complete',
          bodyAr: `تم إكمال الطلب رقم ${order.orderNumber}. تهانينا!`,
          bodyEn: `Order #${order.orderNumber} is now complete. Congratulations!`,
        }),
      }).catch(() => {})
    );
  }
  await Promise.allSettled(emails);
}

async function sendTrialEnding(user, daysLeft) {
  sendMail({
    to: user.email,
    subject: `تنتهي فترتك التجريبية قريباً | Trial Ending Soon`,
    html: emailTemplate({
      titleAr: 'فترتك التجريبية تنتهي قريباً',
      titleEn: 'Your trial is ending soon',
      bodyAr: `تبقى ${daysLeft} أيام على انتهاء فترتك التجريبية. قم بالترقية للاستمرار في البيع.`,
      bodyEn: `You have ${daysLeft} days left in your trial. Upgrade to continue selling.`,
    }),
  }).catch(() => {});
}

async function sendVerificationEmail(user, token) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const link = `${baseUrl}/auth/verify-email?token=${token}`;
  sendMail({
    to: user.email,
    subject: 'تأكيد البريد الإلكتروني | Verify Your Email',
    html: emailTemplate({
      titleAr: 'تأكيد بريدك الإلكتروني',
      titleEn: 'Verify Your Email',
      bodyAr: `مرحباً ${user.username}، اضغط على الرابط لتأكيد بريدك الإلكتروني: <a href="${link}">${link}</a>`,
      bodyEn: `Hi ${user.username}, click the link to verify your email: <a href="${link}">${link}</a>`,
    }),
  }).catch(() => {});
}

async function sendPasswordReset(user, token) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const link = `${baseUrl}/auth/reset-password?token=${token}`;
  sendMail({
    to: user.email,
    subject: 'إعادة تعيين كلمة المرور | Reset Your Password',
    html: emailTemplate({
      titleAr: 'إعادة تعيين كلمة المرور',
      titleEn: 'Reset Your Password',
      bodyAr: `اضغط على الرابط لإعادة تعيين كلمة المرور: <a href="${link}">${link}</a>. ينتهي هذا الرابط خلال 24 ساعة.`,
      bodyEn: `Click the link to reset your password: <a href="${link}">${link}</a>. This link expires in 24 hours.`,
    }),
  }).catch(() => {});
}

module.exports = {
  sendWelcome,
  sendOrderPlaced,
  sendOrderConfirmed,
  sendOrderShipped,
  sendOrderCompleted,
  sendTrialEnding,
  sendVerificationEmail,
  sendPasswordReset,
};
