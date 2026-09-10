export type SignalHandoffEmail = {
  preheader: string;
  route: string;
  title: string;
  body: string;
  action: {
    href: string;
    label: string;
  };
  fallbackLabel: string;
  note: string;
};

export type RenderedEmail = {
  text: string;
  html: string;
};

const htmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => htmlEntities[character] ?? character);
}

/**
 * The shared transactional-email surface. Its table-first layout and inline
 * baseline styles work in conservative desktop clients, while the media query
 * gives narrower clients a roomier single-column reading width.
 */
export function buildSignalHandoffEmail(email: SignalHandoffEmail): RenderedEmail {
  const preheader = escapeHtml(email.preheader);
  const route = escapeHtml(email.route);
  const title = escapeHtml(email.title);
  const body = escapeHtml(email.body);
  const actionHref = escapeHtml(email.action.href);
  const actionLabel = escapeHtml(email.action.label);
  const fallbackLabel = escapeHtml(email.fallbackLabel);
  const note = escapeHtml(email.note);

  return {
    text: `Huddle — ${email.route}\n\n${email.title}\n\n${email.body}\n\n${email.action.label}: ${email.action.href}\n\n${email.note}`,
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${title}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .email-shell { padding: 16px !important; }
        .email-card { width: 100% !important; }
        .email-header, .email-content, .email-note, .email-footer { padding-left: 20px !important; padding-right: 20px !important; }
        .email-title { font-size: 30px !important; line-height: 34px !important; }
        .email-action { display: block !important; text-align: center !important; }
        .email-shadow { box-shadow: 7px 9px 0 #e4d5bb !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#f6eedb;color:#141414;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;">${preheader}&nbsp;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background-color:#f6eedb;">
      <tr>
        <td class="email-shell" align="center" style="padding:32px 16px;">
          <table class="email-card email-shadow" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;background-color:#fffaf0;border:1px solid #bca88a;border-radius:16px;box-shadow:12px 16px 0 #e4d5bb;">
            <tr>
              <td class="email-header" style="padding:24px 28px 18px;border-bottom:1px solid #d5c7b0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td valign="middle" style="text-align:left;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td valign="middle" style="padding-right:10px;">
                            <table role="presentation" width="24" height="24" cellspacing="0" cellpadding="0" border="0" style="width:24px;height:24px;border-collapse:separate;border-spacing:3px;">
                              <tr>
                                <td width="9" height="9" bgcolor="#8d2676" style="width:9px;height:9px;background-color:#8d2676;border-radius:9px;font-size:0;line-height:0;">&nbsp;</td>
                                <td width="9" height="9" bgcolor="#f3b01c" style="width:9px;height:9px;background-color:#f3b01c;border-radius:9px;font-size:0;line-height:0;">&nbsp;</td>
                              </tr>
                              <tr>
                                <td width="9" height="9" bgcolor="#f3b01c" style="width:9px;height:9px;background-color:#f3b01c;border-radius:9px;font-size:0;line-height:0;">&nbsp;</td>
                                <td width="9" height="9" bgcolor="#8d2676" style="width:9px;height:9px;background-color:#8d2676;border-radius:9px;font-size:0;line-height:0;">&nbsp;</td>
                              </tr>
                            </table>
                          </td>
                          <td valign="middle" style="color:#141414;font-size:23px;font-weight:700;letter-spacing:-0.5px;line-height:24px;">Huddle</td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" valign="middle" style="color:#8d2676;font-size:10px;font-weight:700;letter-spacing:1.4px;line-height:14px;text-align:right;">${route}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td width="66%" height="4" bgcolor="#8d2676" style="width:66%;height:4px;background-color:#8d2676;font-size:0;line-height:0;">&nbsp;</td>
                    <td width="22%" height="4" bgcolor="#f3b01c" style="width:22%;height:4px;background-color:#f3b01c;font-size:0;line-height:0;">&nbsp;</td>
                    <td width="12%" height="4" bgcolor="#ee342f" style="width:12%;height:4px;background-color:#ee342f;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:30px 28px 24px;">
                <p style="margin:0 0 10px;color:#8d2676;font-size:11px;font-weight:700;letter-spacing:1.5px;line-height:16px;">SIGNAL HANDOFF</p>
                <h1 class="email-title" style="margin:0;color:#141414;font-size:34px;font-weight:700;letter-spacing:-1.1px;line-height:38px;">${title}</h1>
                <p style="margin:16px 0 0;color:#62594f;font-size:16px;line-height:25px;">${body}</p>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:0 28px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;">
                  <tr>
                    <td bgcolor="#8d2676" style="background-color:#8d2676;border:1px solid #6f195e;border-radius:9px;text-align:center;">
                      <a class="email-action" href="${actionHref}" style="display:inline-block;padding:13px 18px;color:#faf4e9;font-size:15px;font-weight:700;line-height:20px;text-decoration:none;">${actionLabel}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:0 28px 28px;">
                <p style="margin:0 0 8px;color:#62594f;font-size:12px;line-height:18px;">${fallbackLabel}</p>
                <p style="margin:0;color:#8d2676;font-size:12px;line-height:18px;word-break:break-all;"><a href="${actionHref}" style="color:#8d2676;text-decoration:underline;word-break:break-all;">${actionHref}</a></p>
              </td>
            </tr>
            <tr>
              <td class="email-note" style="padding:16px 28px;background-color:#eadfc8;border-top:1px solid #d5c7b0;border-bottom:1px solid #d5c7b0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td width="4" bgcolor="#f3b01c" style="width:4px;background-color:#f3b01c;font-size:0;line-height:0;">&nbsp;</td>
                    <td style="padding-left:12px;color:#4d4036;font-size:13px;line-height:20px;">${note}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-footer" style="padding:18px 28px 22px;color:#82776b;font-size:12px;line-height:18px;">
                Huddle keeps your meeting and recording handoffs clear and in your control.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
