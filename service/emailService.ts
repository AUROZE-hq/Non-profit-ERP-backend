// services/emailService.js  –  sends emails via nodemailer (Gmail SMTP)

const nodemailer = require('nodemailer');

const COMPANY_NAME   = process.env.COMPANY_NAME    || 'Your Company';
const COMPANY_EMAIL  = process.env.COMPANY_EMAIL   || 'company@example.com';
const APP_URL        = process.env.APP_URL          || 'http://localhost:5173';
const BACKEND_URL    = process.env.BACKEND_URL      || 'http://localhost:5000';

// ── Transporter ───────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send salary slip to employee with a signing link.
 */
async function sendSalarySlipEmail({ employee, slip, pdfPath }:any) {
  const signUrl = `${APP_URL}/sign/${slip.signatureToken}`;
  const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const period  = `${MONTHS[(slip.period.month || 1) - 1]} ${slip.period.year}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background:#f4f6fb; margin:0; padding:0; }
    .container { max-width:600px; margin:30px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:#1a1a2e; padding:32px 40px; }
    .header h1 { color:#f0c040; margin:0; font-size:22px; letter-spacing:1px; }
    .header p { color:#ccccdd; margin:6px 0 0; font-size:13px; }
    .body { padding:36px 40px; }
    .greeting { font-size:16px; color:#1a1a2e; font-weight:600; margin-bottom:8px; }
    .message { font-size:14px; color:#555566; line-height:1.7; margin-bottom:24px; }
    .slip-card { background:#f8f9fc; border:1px solid #e0e4f0; border-radius:10px; padding:20px 24px; margin-bottom:28px; }
    .slip-card .row { display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; }
    .slip-card .label { color:#888899; }
    .slip-card .value { color:#1a1a2e; font-weight:600; }
    .net { background:#1a1a2e; border-radius:8px; padding:14px 24px; display:flex; justify-content:space-between; margin-top:12px; }
    .net .label { color:#ccccdd; font-size:14px; }
    .net .value { color:#f0c040; font-size:18px; font-weight:700; }
    .cta { text-align:center; margin:28px 0 20px; }
    .btn { display:inline-block; background:#f0c040; color:#1a1a2e; font-weight:700; font-size:15px; padding:14px 36px; border-radius:8px; text-decoration:none; letter-spacing:0.5px; }
    .note { font-size:12px; color:#aaaaaa; text-align:center; margin-top:16px; line-height:1.6; }
    .footer { background:#f0f0f5; padding:20px 40px; text-align:center; font-size:11px; color:#aaaaaa; }
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
        Once signed, a copy will be saved to our records.
      </p>

      <div class="slip-card">
        <div class="row"><span class="label">Employee ID</span><span class="value">${slip.employee.employeeId}</span></div>
        <div class="row"><span class="label">Department</span><span class="value">${slip.employee.department}</span></div>
        <div class="row"><span class="label">Period</span><span class="value">${period}</span></div>
        <div class="row"><span class="label">Basic Salary</span><span class="value">LKR ${fmt(slip.earnings.basicSalary)}</span></div>
        <div class="row"><span class="label">Allowances</span><span class="value">LKR ${fmt(slip.earnings.allowances)}</span></div>
        <div class="row"><span class="label">Bonus</span><span class="value">LKR ${fmt(slip.earnings.bonus)}</span></div>
        <div class="row"><span class="label">Deductions</span><span class="value">- LKR ${fmt((slip.deductions.tax||0)+(slip.deductions.insurance||0)+(slip.deductions.other||0))}</span></div>
        <div class="net">
          <span class="label">Net Salary</span>
          <span class="value">LKR ${fmt(slip.netSalary)}</span>
        </div>
      </div>

      <div class="cta">
        <a href="${signUrl}" class="btn">✍️ &nbsp; Sign My Salary Slip</a>
      </div>
      <p class="note">
        This link is unique to you and expires after signing.<br>
        If you did not expect this email, contact us at ${COMPANY_EMAIL}.
      </p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} ${COMPANY_NAME} · ${COMPANY_EMAIL}<br>
      This is an automated email — please do not reply directly.
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from:        `"${COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to:          employee.email,
    subject:     `Your Salary Slip – ${period} | ${COMPANY_NAME}`,
    html,
    attachments: pdfPath ? [{ filename: `Salary_Slip_${period}.pdf`, path: pdfPath }] : [],
  });
}

/**
 * Notify owner that an employee has signed.
 */
async function sendSignatureConfirmationEmail({ slip, ownerEmail }:any) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
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
    from:    `"${COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to:      ownerEmail,
    subject: `✅ Signed: ${slip.employee.name}'s Salary Slip – ${period}`,
    html,
  });
}

function fmt(n:any) {
  return Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = { sendSalarySlipEmail, sendSignatureConfirmationEmail };
