import nodemailer from 'nodemailer';
import { config } from '../config';
import { getHealthTip } from '../lib/aqi';

// Build transporter based on available config
function buildTransporter() {
  // Generic SMTP if provided
  if (config.smtpHost && config.smtpUser && config.smtpPass) {
    return nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 465,
      secure: config.smtpSecure !== false, // default true
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
  }

  // Gmail App Password
  if (config.gmailUser && config.gmailPass) {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: config.gmailUser, pass: config.gmailPass },
    });
  }

  // Resend SMTP fallback
  return nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: config.resendApiKey,
    },
  });
}

const transporter = buildTransporter();

export async function sendEmailAlert(to: string, subject: string, measurement: any) {
  try {
    const category = measurement.aqiCategory || 'unknown';
    const healthTip = getHealthTip(category);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 20px; }
          .metric { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #667eea; }
          .tip { background: #fff3cd; padding: 15px; margin: 15px 0; border-radius: 6px; border-left: 4px solid #ffc107; }
          .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 12px; }
          .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌬️ AeroGuard AI Alert</h1>
            <p>${subject}</p>
          </div>
          <div class="content">
            <div class="metric">
              <h2>Current Air Quality</h2>
              <p><strong>AQI:</strong> ${measurement.aqiCalculated || 'N/A'}</p>
              <p><strong>Category:</strong> ${String(category).replace('_', ' ').toUpperCase()}</p>
              <p><strong>Temperature:</strong> ${measurement.temperature ?? 'N/A'}°C</p>
              <p><strong>Humidity:</strong> ${measurement.humidity ?? 'N/A'}%</p>
            </div>
            <div class="tip">
              <h3>💡 Health Recommendation</h3>
              <p>${healthTip}</p>
            </div>
            <a href="${process.env.APP_URL || 'http://localhost:3000'}" class="btn">View Dashboard</a>
          </div>
          <div class="footer">
            <p>AeroGuard AI—Predict the air. Protect your health.</p>
            <p><a href="${(process.env.APP_URL || 'http://localhost:3000') + '/alerts'}">Manage alert preferences</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: config.emailFrom || `AeroGuard AI <${config.gmailUser || 'alerts@aeroguard.ai'}>`,
      to,
      subject: `🚨 ${subject}`,
      html,
    });

    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Email send error:', error);
  }
}
