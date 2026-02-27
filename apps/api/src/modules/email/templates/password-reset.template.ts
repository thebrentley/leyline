export function passwordResetEmailHtml(params: {
  resetUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#8B5CF6,#7C3AED); padding:32px 32px 24px; text-align:center;">
              <div style="font-size:28px; font-weight:700; color:#ffffff; letter-spacing:0.5px;">LEYLINE</div>
              <div style="font-size:11px; color:#c4b5fd; letter-spacing:2px; margin-top:4px;">EVERYTHING. CONNECTED.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">Reset Your Password</h2>
              <p style="margin:0 0 8px; font-size:15px; color:#475569; line-height:1.6;">
                We received a request to reset your password. Click the button below to choose a new one.
              </p>
              <p style="margin:0 0 24px; font-size:15px; color:#475569; line-height:1.6;">
                If you didn't request this, you can safely ignore this email.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${params.resetUrl}"
                       style="display:inline-block; background:#8B5CF6; color:#ffffff; font-size:16px; font-weight:600; padding:14px 32px; border-radius:8px; text-decoration:none;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0; font-size:13px; color:#94a3b8; text-align:center;">
                This link expires in 1 hour.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px; background:#f8fafc; border-top:1px solid #e2e8f0;">
              <p style="margin:0; font-size:12px; color:#94a3b8; text-align:center;">
                Leyline &mdash; MTG Everything. Connected.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function resetPasswordFormHtml(params: {
  token: string;
  apiBaseUrl: string;
  error?: string;
}): string {
  const errorHtml = params.error
    ? `<div style="background:#fef2f2; border:1px solid #fecaca; color:#dc2626; padding:12px 16px; border-radius:8px; margin-bottom:20px; font-size:14px;">${params.error}</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - Leyline</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 40px; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0,0,0,0.3); }
    .logo { text-align: center; margin-bottom: 32px; }
    .logo h1 { font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px; }
    .logo p { font-size: 11px; color: #a78bfa; letter-spacing: 2px; margin-top: 4px; }
    .title { font-size: 20px; color: #f1f5f9; margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: #94a3b8; margin-bottom: 24px; line-height: 1.5; }
    label { display: block; font-size: 14px; font-weight: 500; color: #cbd5e1; margin-bottom: 6px; }
    input[type="password"] { width: 100%; padding: 12px 16px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #f1f5f9; font-size: 16px; outline: none; transition: border-color 0.2s; }
    input[type="password"]:focus { border-color: #8B5CF6; }
    .field { margin-bottom: 16px; }
    .btn { width: 100%; padding: 14px; background: #8B5CF6; color: #ffffff; font-size: 16px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; transition: background 0.2s; margin-top: 8px; }
    .btn:hover { background: #7C3AED; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .error { color: #f87171; font-size: 13px; margin-top: 6px; display: none; }
    .server-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <h1>LEYLINE</h1>
      <p>EVERYTHING. CONNECTED.</p>
    </div>
    <h2 class="title">Set a new password</h2>
    <p class="subtitle">Enter your new password below. Must be at least 8 characters.</p>
    ${errorHtml}
    <form method="POST" action="${params.apiBaseUrl}/api/auth/reset-password" id="resetForm">
      <input type="hidden" name="token" value="${params.token}">
      <div class="field">
        <label for="password">New Password</label>
        <input type="password" id="password" name="password" required minlength="8" placeholder="Enter new password">
      </div>
      <div class="field">
        <label for="confirmPassword">Confirm Password</label>
        <input type="password" id="confirmPassword" required minlength="8" placeholder="Confirm new password">
        <div class="error" id="matchError">Passwords do not match.</div>
      </div>
      <button type="submit" class="btn" id="submitBtn">Reset Password</button>
    </form>
  </div>
  <script>
    document.getElementById('resetForm').addEventListener('submit', function(e) {
      var pw = document.getElementById('password').value;
      var confirm = document.getElementById('confirmPassword').value;
      var err = document.getElementById('matchError');
      if (pw !== confirm) {
        e.preventDefault();
        err.style.display = 'block';
        return;
      }
      err.style.display = 'none';
      document.getElementById('submitBtn').disabled = true;
      document.getElementById('submitBtn').textContent = 'Resetting...';
    });
  </script>
</body>
</html>`;
}

export function resetPasswordResultHtml(params: {
  success: boolean;
  message: string;
}): string {
  const iconColor = params.success ? '#22c55e' : '#ef4444';
  const icon = params.success
    ? '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#22c55e"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    : '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#ef4444"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.success ? 'Password Reset' : 'Reset Failed'} - Leyline</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 40px; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0,0,0,0.3); text-align: center; }
    .logo h1 { font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px; }
    .logo p { font-size: 11px; color: #a78bfa; letter-spacing: 2px; margin-top: 4px; }
    .icon { margin: 32px 0 16px; }
    .message { font-size: 16px; color: #f1f5f9; line-height: 1.6; margin-bottom: 8px; }
    .hint { font-size: 14px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <h1>LEYLINE</h1>
      <p>EVERYTHING. CONNECTED.</p>
    </div>
    <div class="icon">${icon}</div>
    <p class="message">${params.message}</p>
    ${params.success ? '<p class="hint">You can now log in with your new password in the app.</p>' : '<p class="hint">Please request a new reset link from the app.</p>'}
  </div>
</body>
</html>`;
}
