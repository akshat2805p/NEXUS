package utils

import (
	"fmt"
	"os"

	"github.com/twilio/twilio-go"
	twilioApi "github.com/twilio/twilio-go/rest/api/v2010"
)

// SendOTPSMS sends a real OTP via Twilio SMS
func SendOTPSMS(toPhone, otp string) error {
	accountSID := os.Getenv("TWILIO_ACCOUNT_SID")
	authToken := os.Getenv("TWILIO_AUTH_TOKEN")
	fromPhone := os.Getenv("TWILIO_PHONE_NUMBER")

	if accountSID == "" || authToken == "" || fromPhone == "" {
		return fmt.Errorf("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are required to send SMS OTPs")
	}

	client := twilio.NewRestClientWithParams(twilio.ClientParams{
		Username: accountSID,
		Password: authToken,
	})

	params := &twilioApi.CreateMessageParams{}
	params.SetTo(toPhone)
	params.SetFrom(fromPhone)
	params.SetBody(fmt.Sprintf("Your Nexus verification code is: %s\nExpires in 5 minutes. Do not share this code.", otp))

	if _, err := client.Api.CreateMessage(params); err != nil {
		return fmt.Errorf("twilio error: %w", err)
	}

	return nil
}
