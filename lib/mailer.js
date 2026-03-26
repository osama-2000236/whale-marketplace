const nodemailer = require('nodemailer');

let sgMail = null;
let smtpTransport = null;

// Try SendGrid first
if (process.env.SENDGRID_API_KEY) {
  try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  } catch (e) {
    sgMail = null;
  }
}

// SMTP fallback
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  smtpTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.EMAIL_FROM || 'noreply@whale.ps';

/**
 * Send an email. Tries SendGrid first, falls back to SMTP.
 * Fire-and-forget: caller should not await, errors are caught internally.
 */
async function sendMail({ to, subject, html }) {
  try {
    if (sgMail) {
      await sgMail.send({ to, from: FROM, subject, html });
      return;
    }
    if (smtpTransport) {
      await smtpTransport.sendMail({ from: FROM, to, subject, html });
      return;
    }
    // No email provider configured — log in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[mailer] No provider configured. Would send to ${to}: ${subject}`);
    }
  } catch (err) {
    console.error('[mailer] Failed to send email:', err.message);
  }
}

/**
 * Build a bilingual email HTML template
 */
function emailTemplate({ titleAr, titleEn, bodyAr, bodyEn }) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: 'Tajawal', 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
      <div style="background: #1472a3; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🐋 الحوت | Whale</h1>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div dir="rtl" style="text-align: right; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e4e7ec;">
          <h2 style="color: #111827; margin: 0 0 12px 0;">${titleAr}</h2>
          <p style="color: #374151; line-height: 1.8; margin: 0;">${bodyAr}</p>
        </div>
        <div dir="ltr" style="text-align: left;">
          <h2 style="color: #111827; margin: 0 0 12px 0;">${titleEn}</h2>
          <p style="color: #374151; line-height: 1.8; margin: 0;">${bodyEn}</p>
        </div>
      </div>
      <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">© ${new Date().getFullYear()} Whale | الحوت</p>
    </body>
    </html>
  `;
}

module.exports = { sendMail, emailTemplate };
