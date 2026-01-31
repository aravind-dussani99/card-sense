import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

const canSend = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
if (canSend) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!canSend || !transporter) {
    console.warn("SMTP not configured; skipping email send.");
    return { sent: false };
  }
  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
  return { sent: true };
};
