package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"nexus-backend/database"
	"nexus-backend/utils"
	"strings"
	"time"
)

type PhoneSendRequest struct {
	Phone       string `json:"phone"`
	CountryCode string `json:"country_code"` // e.g. "+91"
}

type PhoneVerifyRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

// SendPhoneOTP — POST /api/phone/send-otp
func SendPhoneOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	claims, err := authFromHeader(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := uint(claims["user_id"].(float64))

	var req PhoneSendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	phone := strings.TrimSpace(req.Phone)
	countryCode := strings.TrimSpace(req.CountryCode)
	if countryCode == "" {
		countryCode = "+91"
	}
	if phone == "" {
		jsonError(w, http.StatusBadRequest, "Phone number is required")
		return
	}

	// Normalize: strip leading 0 if user puts it
	phone = strings.TrimPrefix(phone, "0")
	fullPhone := countryCode + phone

	// Check if phone is already used by another user
	var existingUser database.User
	if err := database.DB.Where("phone_number = ? AND id != ?", fullPhone, userID).First(&existingUser).Error; err == nil {
		jsonError(w, http.StatusConflict, "This phone number is already linked to another account")
		return
	}

	code := generateOTP()
	expiresAt := time.Now().Add(5 * time.Minute)

	// Invalidate old phone OTPs for this number
	database.DB.Where("phone = ? AND type = 'phone'", fullPhone).Delete(&database.OTP{})

	database.DB.Create(&database.OTP{
		Phone:     fullPhone,
		Code:      code,
		Type:      "phone",
		ExpiresAt: expiresAt,
	})

	// Send via Twilio
	if err := utils.SendOTPSMS(fullPhone, code); err != nil {
		database.DB.Where("phone = ? AND code = ? AND type = 'phone'", fullPhone, code).Delete(&database.OTP{})
		jsonError(w, http.StatusInternalServerError, "Failed to send SMS OTP. Ensure Twilio credentials are configured on the backend.")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": fmt.Sprintf("OTP sent to %s", fullPhone),
	})
}

// VerifyPhoneOTP — POST /api/phone/verify-otp
func VerifyPhoneOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	claims, err := authFromHeader(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := uint(claims["user_id"].(float64))

	var req PhoneVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	phone := strings.TrimSpace(req.Phone)
	code := strings.TrimSpace(req.Code)
	if phone == "" || code == "" {
		jsonError(w, http.StatusBadRequest, "Phone and code are required")
		return
	}

	var otp database.OTP
	if err := database.DB.Where("phone = ? AND code = ? AND type = 'phone' AND expires_at > ?", phone, code, time.Now()).
		Order("created_at desc").First(&otp).Error; err != nil {
		jsonError(w, http.StatusUnauthorized, "Invalid or expired OTP")
		return
	}

	database.DB.Delete(&otp)

	// Mark phone as verified on user
	database.DB.Model(&database.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"phone_number":   phone,
		"phone_verified": true,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":        "Phone verified successfully",
		"phone_verified": true,
	})
}

// authFromHeader extracts JWT claims from Authorization header
func authFromHeader(r *http.Request) (map[string]interface{}, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, fmt.Errorf("missing auth header")
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	claims, err := utils.VerifyToken(tokenStr)
	if err != nil {
		return nil, err
	}
	return claims, nil
}
