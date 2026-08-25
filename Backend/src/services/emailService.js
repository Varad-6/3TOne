// src/services/emailService.js
import nodemailer from "nodemailer";

export const createTransporter = () =>
  nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.OUTLOOK_EMAIL,
      pass: process.env.OUTLOOK_PASSWORD,
    },
    tls: { ciphers: "SSLv3", rejectUnauthorized: false },
  });

export const verifyConnection = async () => {
  await createTransporter().verify();
};

// { to, cc?, bcc?, subject, body, isHtml? }
export const sendSingleEmail = async ({
  to,
  cc,
  bcc,
  subject,
  body,
  isHtml = false,
}) => {
  const info = await createTransporter().sendMail({
    from: `"${process.env.SENDER_NAME || "Timesheet System"}" <${process.env.OUTLOOK_EMAIL}>`,
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject,
    [isHtml ? "html" : "text"]: body,
  });
  return info.messageId;
};
