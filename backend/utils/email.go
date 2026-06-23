package utils

import (
	"fmt"
	"os"

	"github.com/resend/resend-go/v2"
)

// SendOTPEmail sends a real OTP email via Resend
func SendOTPEmail(toEmail, toName, otp string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		fmt.Printf("⚠️  [DEV MODE] RESEND_API_KEY not set.\n")
		fmt.Printf("🔑 OTP for %s: %s\n", toEmail, otp)
		return nil
	}

	fromEmail := getEnv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
	fromName := getEnv("RESEND_FROM_NAME", "Nexus")

	subject := "Your Nexus Login Code"

	htmlContent := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#FEFCF8;font-family:'Inter',Arial,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#FEFCF8;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #E5DDD4;overflow:hidden;max-width:480px;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#C8956C,#D4AF37);padding:32px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">◆ NEXUS</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">Fintech · Chat · Collaborate</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h2 style="margin:0 0 8px;font-size:22px;color:#1A1A1A;font-weight:700;">Your login code</h2>
            <p style="margin:0 0 24px;color:#5C5C5C;font-size:15px;line-height:1.6;">
              Use this code to sign in to your Nexus account. It expires in <strong>5 minutes</strong>.
            </p>
            <!-- OTP Box -->
            <div style="background:#F7F4EF;border:2px dashed #C8956C;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
              <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#1A1A1A;font-family:monospace;">%s</div>
            </div>
            <p style="margin:0;color:#A0A0A0;font-size:13px;">
              If you didn't request this code, you can safely ignore this email. Someone may have entered your email by mistake.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F7F4EF;padding:20px 40px;border-top:1px solid #E5DDD4;text-align:center;">
            <p style="margin:0;color:#A0A0A0;font-size:12px;">© 2025 Nexus. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`, otp)

	plainContent := fmt.Sprintf("Your Nexus login code is: %s\nThis code expires in 5 minutes.", otp)

	client := resend.NewClient(apiKey)

	params := &resend.SendEmailRequest{
		From:    fmt.Sprintf("%s <%s>", fromName, fromEmail),
		To:      []string{toEmail},
		Subject: subject,
		Html:    htmlContent,
		Text:    plainContent,
	}

	if _, err := client.Emails.Send(params); err != nil {
		return fmt.Errorf("resend error: %w", err)
	}

	return nil
}
// SendInviteEmail sends an invitation email to a non-user
func SendInviteEmail(toEmail, inviterName string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		fmt.Printf("⚠️  [DEV MODE] RESEND_API_KEY not set. Would have invited: %s\n", toEmail)
		return nil
	}

	fromEmail := getEnv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
	fromName := getEnv("RESEND_FROM_NAME", "Nexus")

	subject := fmt.Sprintf("%s invited you to join Nexus!", inviterName)

	htmlContent := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#FEFCF8;font-family:'Inter',Arial,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#FEFCF8;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #E5DDD4;overflow:hidden;max-width:480px;">
        <tr>
          <td style="background:linear-gradient(135deg,#C8956C,#D4AF37);padding:32px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">◆ NEXUS</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;text-align:center;">
            <h2 style="margin:0 0 8px;font-size:22px;color:#1A1A1A;font-weight:700;">You've been invited!</h2>
            <p style="margin:0 0 24px;color:#5C5C5C;font-size:15px;line-height:1.6;">
              <strong>%s</strong> wants you to join them on Nexus to chat, share payments, and watch movies together.
            </p>
            <a href="https://nexus.vercel.com" style="display:inline-block;background:#C8956C;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">Join Nexus Now</a>
          </td>
        </tr>
        <tr>
          <td style="background:#F7F4EF;padding:20px 40px;border-top:1px solid #E5DDD4;text-align:center;">
            <p style="margin:0;color:#A0A0A0;font-size:12px;">© 2025 Nexus. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`, inviterName)

	plainContent := fmt.Sprintf("%s invited you to join Nexus! Go to https://nexus.vercel.com to sign up.", inviterName)

	client := resend.NewClient(apiKey)

	params := &resend.SendEmailRequest{
		From:    fmt.Sprintf("%s <%s>", fromName, fromEmail),
		To:      []string{toEmail},
		Subject: subject,
		Html:    htmlContent,
		Text:    plainContent,
	}

	if _, err := client.Emails.Send(params); err != nil {
		return fmt.Errorf("resend error: %w", err)
	}

	return nil
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

