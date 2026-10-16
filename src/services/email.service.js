import 'dotenv/config';
import nodemailer from 'nodemailer';
import AppError from '../errors/AppError.js';

let transporterInstance = null;

/**
 * Build or retrieve cached Nodemailer transporter with Gmail SMTP over SSL/TLS (port 465)
 */
export const getTransporter = () => {
  if (!transporterInstance) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = process.env.SMTP_USER || 'voltsparesupport@gmail.com';
    // Remove any whitespace from the app password
    const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

    transporterInstance = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // SSL/TLS on port 465
      auth: {
        user,
        pass,
      },
    });
  }
  return transporterInstance;
};

/**
 * Generate clean, lightweight, responsive HTML email template for VoltSpare OTP Verification.
 * Designed specifically for high inbox deliverability:
 * - Simple table-based layout
 * - Inline styles with web-safe system fonts
 * - No tracking pixels, remote scripts, or external images
 * - Clear text-to-code ratio
 */
export const generateOtpHtml = (otp) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VoltSpare - Email Verification OTP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 32px 28px; text-align: left;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom: 20px; border-bottom: 1px solid #f3f4f6;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.3px;">VoltSpare</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: 0.5px;">Email Verification</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding-top: 24px; padding-bottom: 24px;">
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 22px; color: #374151;">Use the verification code below to verify your VoltSpare account.</p>
              
              <div style="margin: 24px 0; text-align: center;">
                <div style="display: inline-block; background-color: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; padding: 16px 28px;">
                  <span style="font-family: 'SF Mono', 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827; display: block;">${otp}</span>
                </div>
              </div>
              
              <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 20px; color: #4b5563;">This code expires in 5 minutes. Do not share it with anyone.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top: 20px; border-top: 1px solid #f3f4f6;">
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #6b7280;">Thank you for choosing VoltSpare – Your Trusted Two-Wheeler Spare Parts Store.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Generate plain-text email alternative matching the HTML content for spam filter compliance
 */
export const generateOtpText = (otp) => {
  return `VoltSpare
Email Verification

Use the verification code below to verify your VoltSpare account.

${otp}

This code expires in 5 minutes. Do not share it with anyone.

Thank you for choosing VoltSpare – Your Trusted Two-Wheeler Spare Parts Store.`;
};

/**
 * Dispatch verification OTP email to customer with high-deliverability configuration
 * @param {string} toEmail - Customer recipient email
 * @param {string} otp - Backend-generated OTP
 */
export const sendOtpEmail = async (toEmail, otp) => {
  if (!toEmail) {
    throw new AppError('Recipient email address is required to dispatch OTP.', 400);
  }

  // Bypass external SMTP network calls in test mode for speed and test reliability
  if (process.env.NODE_ENV === 'test') {
    return {
      success: true,
      messageId: 'mock-test-message-id',
      simulated: true,
    };
  }

  const senderUser = process.env.SMTP_USER || 'voltsparesupport@gmail.com';
  const fromHeader = `"VoltSpare" <${senderUser}>`;

  const mailOptions = {
    from: fromHeader,
    sender: senderUser,
    replyTo: fromHeader,
    to: toEmail,
    subject: 'VoltSpare - Email Verification OTP',
    text: generateOtpText(otp),
    html: generateOtpHtml(otp),
    headers: {
      'Auto-Submitted': 'auto-generated',
      'X-Auto-Response-Suppress': 'All',
    },
  };

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);

    // Safe delivery metadata logging without exposing OTP or credentials
    console.log('[EmailService] OTP email dispatched:', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } catch (error) {
    // Sanitized logging: never log OTP, credentials, or secrets
    console.error('SMTP Mail Dispatch Error:', error.message || 'Failed to dispatch email');
    throw new AppError('Unable to send verification email. Please check your email address or try again later.', 500);
  }
};

/**
 * Verify SMTP connection settings (does not expose credentials)
 */
export const verifySmtpConnection = async () => {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return { success: true, message: 'SMTP connection established successfully.' };
  } catch (error) {
    console.error('SMTP Verification Error:', error.message || 'Connection failed');
    return { success: false, message: error.message };
  }
};

export default {
  getTransporter,
  generateOtpHtml,
  generateOtpText,
  sendOtpEmail,
  verifySmtpConnection,
};
