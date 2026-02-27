export function podInviteEmailHtml(params: {
  podName: string;
  inviterName: string;
  acceptUrl: string;
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
              <h2 style="margin:0 0 16px; font-size:20px; color:#1e293b;">You're invited to join a pod!</h2>
              <p style="margin:0 0 8px; font-size:15px; color:#475569; line-height:1.6;">
                <strong>${params.inviterName}</strong> has invited you to join
                <strong>${params.podName}</strong> on Leyline.
              </p>
              <p style="margin:0 0 24px; font-size:15px; color:#475569; line-height:1.6;">
                Pods are where your playgroup coordinates games, tracks stats, and stays connected.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${params.acceptUrl}"
                       style="display:inline-block; background:#8B5CF6; color:#ffffff; font-size:16px; font-weight:600; padding:14px 32px; border-radius:8px; text-decoration:none;">
                      Accept Invite
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0; font-size:13px; color:#94a3b8; text-align:center;">
                This invite expires in 7 days.
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
