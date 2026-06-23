package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"nexus-backend/database"
	"nexus-backend/utils"
	"strings"
	"time"
)

type OTPRequest struct {
	Email string `json:"email"`
}

type OTPVerifyRequest struct {
	Email    string `json:"email"`
	Code     string `json:"code"`
	Username string `json:"username"` // only used during signup
	Mode     string `json:"mode"`     // "login" or "signup"
}

func generateOTP() string {
	b := make([]byte, 3)
	io.ReadFull(rand.Reader, b)
	return fmt.Sprintf("%06d", int(b[0])<<16|int(b[1])<<8|int(b[2]))[:6]
}

func generateShortID() string {
	b := make([]byte, 2)
	rand.Read(b)
	return strings.ToUpper(hex.EncodeToString(b))
}

func jsonError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]interface{}{"message": msg})
}

func RequestOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req OTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		jsonError(w, http.StatusBadRequest, "Valid email is required")
		return
	}

	code := generateOTP()
	expiresAt := time.Now().Add(5 * time.Minute)

	// Invalidate old OTPs for this email
	database.DB.Where("email = ? AND type = 'email'", req.Email).Delete(&database.OTP{})

	// Save new OTP to DB
	database.DB.Create(&database.OTP{
		Email:     req.Email,
		Code:      code,
		Type:      "email",
		ExpiresAt: expiresAt,
	})

	// Send real email via Resend
	if err := utils.SendOTPEmail(req.Email, "", code); err != nil {
		database.DB.Where("email = ? AND code = ? AND type = 'email'", req.Email, code).Delete(&database.OTP{})
		jsonError(w, http.StatusInternalServerError, "Failed to send OTP email. Ensure RESEND_API_KEY and mail settings are configured on the backend.")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "OTP sent to your email. Please check your inbox.",
	})
}

func VerifyOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req OTPVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Code = strings.TrimSpace(req.Code)
	if req.Email == "" || req.Code == "" {
		jsonError(w, http.StatusBadRequest, "Email and code are required")
		return
	}

	var otp database.OTP
	err := database.DB.Where("email = ? AND code = ? AND type = 'email' AND expires_at > ?", req.Email, req.Code, time.Now()).
		Order("created_at desc").First(&otp).Error
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Invalid or expired OTP")
		return
	}

	// Delete used OTP
	database.DB.Delete(&otp)

	// Find or Create User
	var user database.User
	result := database.DB.Where("email = ?", req.Email).First(&user)

	if result.Error != nil {
		// New user — use provided username or derive from email
		username := strings.TrimSpace(req.Username)
		if username == "" {
			parts := strings.Split(req.Email, "@")
			username = parts[0]
		}
		nexusID := fmt.Sprintf("%s#%s", username, generateShortID())

		user = database.User{
			Email:      req.Email,
			Username:   username,
			NexusID:    nexusID,
			IsVerified: true,
		}
		database.DB.Create(&user)

		// Create default settings
		database.DB.Create(&database.UserSettings{
			UserID:                  user.ID,
			NotificationsEnabled:    true,
			SoundEnabled:            true,
			DesktopNotifications:    true,
			EmailNotifications:      false,
			NewMessageNotifications: true,
			AllowDirectMessages:     true,
			ShowOnlineStatus:        true,
			AllowFriendRequests:     true,
			IsProfilePublic:         true,
			Theme:                   "light",
			Language:                "en",
			MessageSoundEnabled:     true,
			CurrencyPreference:      "INR",
			TransactionAlerts:       true,
			LowBalanceAlert:         true,
			LowBalanceThreshold:     1000,
		})
	}

	token, _ := utils.GenerateToken(user.ID, user.Email, user.Username)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"token":          token,
		"user_id":        user.ID,
		"email":          user.Email,
		"username":       user.Username,
		"nexus_id":       user.NexusID,
		"phone_verified": user.PhoneVerified,
		"phone_number":   user.PhoneNumber,
	})
}
