// services/emailService.js  –  sends emails via nodemailer (Gmail SMTP)

const nodemailer = require('nodemailer');

const COMPANY_NAME = process.env.COMPANY_NAME || 'Your Company';
const COMPANY_EMAIL = process.env.COMPANY_EMAIL || 'company@example.com';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// ── Transporter ───────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send salary slip to employee with a signing link.
 */
async function sendSalarySlipEmail({ employee, slip, pdfPath }: any) {
  const signUrl = `${APP_URL}/sign/${slip.signatureToken}`;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const period = `${MONTHS[(slip.period.month || 1) - 1]} ${slip.period.year}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #f4f6fb;
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 620px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 6px 28px rgba(0,0,0,0.08);
    }

    .header {
      background: #1a1a2e;
      padding: 36px 42px;
    }

    .header h1 {
      color: #f0c040;
      margin: 0;
      font-size: 24px;
      letter-spacing: 1px;
    }

    .header p {
      color: #ccccdd;
      margin-top: 10px;
      font-size: 13px;
    }

    .body {
      padding: 42px;
    }

    .greeting {
      font-size: 17px;
      color: #1a1a2e;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .message {
      font-size: 14px;
      color: #555566;
      line-height: 1.8;
      margin-bottom: 30px;
    }

    .slip-card {
      background: #f8f9fc;
      border: 1px solid #e0e4f0;
      border-radius: 12px;
      padding: 24px 28px;
      margin-bottom: 32px;
    }

    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 14px;
    }

    .label {
      color: #888899;
    }

    .value {
      color: #1a1a2e;
      font-weight: 600;
    }

    .divider {
      height: 1px;
      background: #e6e8f2;
      margin: 18px 0;
    }

    .net {
      background: #1a1a2e;
      border-radius: 10px;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      margin-top: 18px;
    }

    .net .label {
      color: #ccccdd;
      font-size: 14px;
    }

    .net .value {
      color: #f0c040;
      font-size: 20px;
      font-weight: 700;
    }

    .cta {
      text-align: center;
      margin: 36px 0 24px;
    }

    .btn {
      display: inline-block;
      background: #f0c040;
      color: #1a1a2e;
      font-weight: 700;
      font-size: 15px;
      padding: 16px 40px;
      border-radius: 10px;
      text-decoration: none;
      letter-spacing: 0.5px;
    }

    .note {
      font-size: 12px;
      color: #999aaa;
      text-align: center;
      margin-top: 20px;
      line-height: 1.7;
    }

    .footer {
      background: #f0f0f5;
      padding: 24px 40px;
      text-align: center;
      font-size: 11px;
      color: #aaaaaa;
      line-height: 1.6;
    }
  </style>
</head>

<body>
  <div class="container">

    <div class="header">
      <h1>${COMPANY_NAME}</h1>
      <p>Salary Slip — ${period}</p>
    </div>

    <div class="body">

      <p class="greeting">Dear ${employee.name},</p>

      <p class="message">
        Your salary slip for <strong>${period}</strong> has been prepared.
        Please review the details below and click the button to sign digitally.
        Once signed, a copy will be securely stored in our records.
      </p>

      <div class="slip-card">

        <div class="row">
          <span class="label">Department</span>
          <span class="value">${slip.employee.department}</span>
        </div>

        <div class="row">
          <span class="label">Period</span>
          <span class="value">${period}</span>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span class="label">Basic Salary</span>
          <span class="value">LKR ${fmt(slip.earnings.basicSalary)}</span>
        </div>

        <div class="row">
          <span class="label">Allowances</span>
          <span class="value">LKR ${fmt(slip.earnings.allowances)}</span>
        </div>

        <div class="row">
          <span class="label">Bonus</span>
          <span class="value">LKR ${fmt(slip.earnings.bonus)}</span>
        </div>

        <div class="row">
          <span class="label">Deductions</span>
          <span class="value">- LKR ${fmt(
    (slip.deductions.tax || 0) +
    (slip.deductions.insurance || 0) +
    (slip.deductions.other || 0)
  )}</span>
        </div>

        <div class="net">
          <span class="label">Net Salary</span>
          <span class="value">LKR ${fmt(slip.netSalary)}</span>
        </div>

      </div>

      <div class="cta">
        <a href="${signUrl}" class="btn">✍️ Sign My Salary Slip</a>
      </div>

      <p class="note">
        This link is unique to you and will expire after signing.<br>
        If you did not expect this email, please contact us at ${COMPANY_EMAIL}.
      </p>

    </div>

    <div class="footer">
      © ${new Date().getFullYear()} ${COMPANY_NAME}<br>
      ${COMPANY_EMAIL}<br><br>
      This is an automated email — please do not reply.
    </div>

  </div>
</body>
</html>
`;

  await transporter.sendMail({
    from: `"${COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to: employee.email,
    subject: `Your Salary Slip – ${period} | ${COMPANY_NAME}`,
    html,
    attachments: pdfPath ? [{ filename: `Salary_Slip_${period}.pdf`, path: pdfPath }] : [],
  });
}

/**
 * Notify owner that an employee has signed.
 */
async function sendSignatureConfirmationEmail({ slip, ownerEmail }: any) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const period = `${MONTHS[(slip.period.month || 1) - 1]} ${slip.period.year}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family:'Segoe UI',Arial,sans-serif; background:#f4f6fb; }
    .container { max-width:560px; margin:30px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:#1a1a2e; padding:28px 36px; }
    .header h1 { color:#4ade80; margin:0; font-size:20px; }
    .header p { color:#ccccdd; margin:4px 0 0; font-size:13px; }
    .body { padding:32px 36px; font-size:14px; color:#333344; line-height:1.7; }
    .highlight { background:#f0fff4; border-left:4px solid #4ade80; padding:12px 16px; border-radius:0 8px 8px 0; margin:20px 0; }
    .footer { background:#f0f0f5; padding:16px 36px; text-align:center; font-size:11px; color:#aaa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Salary Slip Signed</h1>
      <p>${slip.employee.name} · ${period}</p>
    </div>
    <div class="body">
      <p>The salary slip for <strong>${slip.employee.name}</strong> (${slip.employee.employeeId})
         for the period <strong>${period}</strong> has been digitally signed.</p>
      <div class="highlight">
        <strong>Signed at:</strong> ${new Date(slip.signedAt).toLocaleString()}<br>
        <strong>Net Salary:</strong> LKR ${fmt(slip.netSalary)}<br>
        ${slip.gcsUrl ? `<strong>Stored at:</strong> <a href="${slip.gcsUrl}">Google Cloud Storage</a>` : ''}
      </div>
      <p>The dashboard status has been updated to <strong>Completed</strong>.
         The signed PDF is saved in the Finance folder on Google Cloud Storage.</p>
    </div>
    <div class="footer">© ${new Date().getFullYear()} ${COMPANY_NAME}</div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"${COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to: ownerEmail,
    subject: `✅ Signed: ${slip.employee.name}'s Salary Slip – ${period}`,
    html,
  });
}

/**
 * Send forgot password email with a reset link.
 */
async function sendForgotPasswordEmail({ email, name, resetUrl }: any) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family:'Segoe UI',Arial,sans-serif; background:#f4f6fb; margin:0; padding:0; }
    .container { max-width:560px; margin:40px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:#1a1a2e; padding:32px; text-align:center; }
    .header h1 { color:#f0c040; margin:0; font-size:24px; }
    .body { padding:40px; font-size:15px; color:#333344; line-height:1.7; }
    .cta { text-align:center; margin:32px 0; }
    .btn { display:inline-block; background:#f0c040; color:#1a1a2e; font-weight:700; padding:16px 40px; border-radius:10px; text-decoration:none; }
    .footer { background:#f0f0f5; padding:24px; text-align:center; font-size:12px; color:#aaa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="body">
      <p>Hello ${name},</p>
      <p>We received a request to reset your password for your ${COMPANY_NAME} account. Click the button below to choose a new password:</p>
      <div class="cta">
        <a href="${resetUrl}" class="btn">Reset Password</a>
      </div>
      <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
      <p>This link will expire in 1 hour.</p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} ${COMPANY_NAME}<br>
      This is an automated email — please do not reply.
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"${COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Password Reset Request – ${COMPANY_NAME}`,
    html,
  });
}

function fmt(n: any) {
  return Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = { sendSalarySlipEmail, sendSignatureConfirmationEmail, sendForgotPasswordEmail };
