function wrapper(title: string, bodyHtml: string): string {
  return `
  <div style="background:#f4f4f7;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="background:#111827;padding:24px 32px;">
        <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.02em;">WAZENLY</span>
      </div>
      <div style="padding:32px;color:#374151;">
        <h1 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 16px;">${title}</h1>
        ${bodyHtml}
      </div>
      <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f0f0f0;">
        <p style="font-size:12px;color:#9ca3af;margin:0;">© ${new Date().getFullYear()} WAZENLY. If you didn't request this email, you can safely ignore it.</p>
      </div>
    </div>
  </div>`;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;margin:8px 0 20px;">${label}</a>`;
}

export function verificationEmail(name: string | null, url: string, expiresInHours: number): string {
  return wrapper(
    "Verify your email",
    `<p style="font-size:14px;line-height:1.6;margin:0 0 20px;">Hi ${name || "there"}, welcome to WAZENLY! Please confirm your email address to activate your account.</p>
     ${button(url, "Verify email")}
     <p style="font-size:12px;color:#9ca3af;margin:0 0 8px;">This link expires in ${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}.</p>
     <p style="font-size:12px;color:#9ca3af;word-break:break-all;margin:0;">Or paste this URL into your browser: ${url}</p>`
  );
}

export function passwordResetEmail(url: string): string {
  return wrapper(
    "Reset your password",
    `<p style="font-size:14px;line-height:1.6;margin:0 0 20px;">We received a request to reset your WAZENLY password. Click below to choose a new one.</p>
     ${button(url, "Reset password")}
     <p style="font-size:12px;color:#9ca3af;margin:0 0 8px;">This link expires in 1 hour.</p>
     <p style="font-size:12px;color:#9ca3af;word-break:break-all;margin:0;">Or paste this URL into your browser: ${url}</p>`
  );
}

export function invitationEmail(
  workspaceName: string,
  role: string,
  inviterName: string | null,
  url: string,
  expiresInDays: number
): string {
  return wrapper(
    `Join ${workspaceName} on WAZENLY`,
    `<p style="font-size:14px;line-height:1.6;margin:0 0 20px;">${inviterName || "Someone"} invited you to join <strong>${workspaceName}</strong> on WAZENLY as a <strong>${role}</strong>.</p>
     ${button(url, "Accept invitation")}
     <p style="font-size:12px;color:#9ca3af;margin:0 0 8px;">This invitation expires in ${expiresInDays} day${expiresInDays === 1 ? "" : "s"}.</p>
     <p style="font-size:12px;color:#9ca3af;word-break:break-all;margin:0;">Or paste this URL into your browser: ${url}</p>`
  );
}
