'use strict';

const nodemailer = require('nodemailer');
const config = require('../config/env');

const isConfigured = () => Boolean(config.smtp.host && config.smtp.fromEmail);

let transporter;
const getTransporter = () => {
  transporter ||= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transporter;
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Messages "sent" while NODE_ENV=test, so tests can read codes without SMTP. */
const outbox = [];

/**
 * Sends an email. Returns true if it was handed to the SMTP server.
 * Without SMTP the message is not delivered; outside production the text is printed to the
 * server console so development works with no mail server.
 */
async function send({ to, subject, text, html }) {
  if (config.isTest) {
    outbox.push({ to, subject, text });
    return true;
  }
  if (!isConfigured()) {
    if (config.isProduction) console.warn(`SMTP is not configured; email "${subject}" to ${to} was not sent.`);
    else console.log(`\n[dev email] To: ${to}\n[dev email] ${subject}\n${text}\n`);
    return false;
  }
  try {
    await getTransporter().sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('Failed to send email:', err.message);
    return false;
  }
}

const PURPOSE_COPY = {
  EMAIL_VERIFICATION: { subject: 'Verify your RetailTrack email', intro: 'Use this code to verify your email address' },
  PASSWORD_RESET: { subject: 'Your RetailTrack password reset code', intro: 'Use this code to reset your password' },
};

function sendOtp({ to, name, code, purpose }) {
  const copy = PURPOSE_COPY[purpose];
  const minutes = config.otp.expiryMinutes;
  const text = `Hello ${name},\n\n${copy.intro}: ${code}\n\nThe code expires in ${minutes} minutes. If you did not request it, you can ignore this email.`;
  const html = `<p>Hello ${escapeHtml(name)},</p><p>${copy.intro}:</p><p style="font-size:24px;letter-spacing:4px"><strong>${escapeHtml(code)}</strong></p><p>The code expires in ${minutes} minutes. If you did not request it, you can ignore this email.</p>`;
  return send({ to, subject: copy.subject, text, html });
}

function sendWelcome({ to, name, temporaryPassword }) {
  const text = `Hello ${name},\n\nAn account was created for you on RetailTrack.\nEmail: ${to}\nTemporary password: ${temporaryPassword}\n\nSign in and change your password from Settings.`;
  const html = `<p>Hello ${escapeHtml(name)},</p><p>An account was created for you on RetailTrack.</p><p>Email: ${escapeHtml(to)}<br>Temporary password: <strong>${escapeHtml(temporaryPassword)}</strong></p><p>Sign in and change your password from Settings.</p>`;
  return send({ to, subject: 'Your RetailTrack account', text, html });
}

module.exports = { isConfigured, sendOtp, sendWelcome, outbox };
