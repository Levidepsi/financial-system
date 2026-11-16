function loginEmail(signedInAt) {
  const time = new Date(signedInAt).toUTCString();
  return {
    subject: "Welcome back to Perfi",
    text: `Welcome back!\n\nYou successfully signed in to your Perfi account.\n\nSign-in time: ${time}\n\nIf this was you, you're all set. No action is required.\n\nDon't recognize this sign-in? Open Perfi directly and use Forgot password? to reset your password.\n\nThe Perfi team`,
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Perfi sign-in notification</title></head>
<body style="margin:0;padding:0;background:#f4f5ef;color:#17211b;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5ef;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e9e3;border-radius:16px;">
        <tr><td style="padding:28px;">
          <table role="presentation" cellspacing="0" cellpadding="0"><tr>
            <td aria-hidden="true" style="padding:10px;background:#1c5c45;border-radius:10px;">
              <table role="presentation" height="24" cellspacing="0" cellpadding="0"><tr>
                <td width="5" valign="bottom"><div style="height:10px;width:5px;background:#ffffff;font-size:0;">&nbsp;</div></td><td width="4"></td>
                <td width="5" valign="bottom"><div style="height:17px;width:5px;background:#ffffff;font-size:0;">&nbsp;</div></td><td width="4"></td>
                <td width="5" valign="bottom"><div style="height:24px;width:5px;background:#ffffff;font-size:0;">&nbsp;</div></td>
              </tr></table>
            </td>
            <td style="padding-left:12px;font-size:26px;font-weight:bold;color:#1c5c45;">Perfi</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 28px 28px;">
          <h1 style="margin:0 0 16px;font-size:28px;line-height:1.25;">Welcome back!</h1>
          <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">You successfully signed in to your Perfi account.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e6f1eb;border-radius:10px;"><tr><td style="padding:16px;font-size:14px;line-height:1.6;color:#154936;"><strong>Sign-in time</strong><br>${time}</td></tr></table>
          <p style="margin:20px 0;font-size:15px;line-height:1.6;">If this was you, you're all set. No action is required.</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#526158;"><strong>Don't recognize this sign-in?</strong><br>Open Perfi directly and use <strong>Forgot password?</strong> to reset your password.</p>
          <p style="margin:0;font-size:14px;line-height:1.6;">The Perfi team</p>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#526158;">This is an automatic account notification from Perfi.</p>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

module.exports = { loginEmail };
