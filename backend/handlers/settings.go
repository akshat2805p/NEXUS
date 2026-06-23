package handlers

import (
	"encoding/json"
	"net/http"
	"nexus-backend/database"
)

// GetSettings — GET /api/settings
func GetSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	claims, err := authFromHeader(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := uint(claims["user_id"].(float64))

	var settings database.UserSettings
	if err := database.DB.Where("user_id = ?", userID).First(&settings).Error; err != nil {
		// Create defaults if not found
		settings = database.UserSettings{
			UserID:               userID,
			NotificationsEnabled: true,
			SoundEnabled:         true,
			Theme:                "light",
			Language:             "en",
			CurrencyPreference:   "INR",
			TransactionAlerts:    true,
			LowBalanceAlert:      true,
			LowBalanceThreshold:  1000,
		}
		database.DB.Create(&settings)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

// UpdateSettings — PUT /api/settings
func UpdateSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	claims, err := authFromHeader(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := uint(claims["user_id"].(float64))

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Remove protected fields
	delete(updates, "id")
	delete(updates, "user_id")
	delete(updates, "created_at")

	database.DB.Model(&database.UserSettings{}).Where("user_id = ?", userID).Updates(updates)

	var settings database.UserSettings
	database.DB.Where("user_id = ?", userID).First(&settings)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

// GetProfile — GET /api/profile
func GetProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	claims, err := authFromHeader(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := uint(claims["user_id"].(float64))

	var user database.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		jsonError(w, http.StatusNotFound, "User not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":             user.ID,
		"username":       user.Username,
		"email":          user.Email,
		"nexus_id":       user.NexusID,
		"full_name":      user.FullName,
		"avatar":         user.Avatar,
		"bio":            user.Bio,
		"phone_number":   user.PhoneNumber,
		"phone_verified": user.PhoneVerified,
		"country_code":   user.CountryCode,
		"is_verified":    user.IsVerified,
		"created_at":     user.CreatedAt,
		"banner":         user.Banner,
		"pronouns":       user.Pronouns,
		"connections":    user.Connections,
	})
}

// UpdateProfile — PUT /api/profile
func UpdateProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	claims, err := authFromHeader(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := uint(claims["user_id"].(float64))

	var body struct {
		FullName    string `json:"full_name"`
		Bio         string `json:"bio"`
		Avatar      string `json:"avatar"`
		Username    string `json:"username"`
		Banner      string `json:"banner"`
		Pronouns    string `json:"pronouns"`
		Connections string `json:"connections"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	updates := map[string]interface{}{}
	if body.FullName != "" {
		updates["full_name"] = body.FullName
	}
	if body.Bio != "" {
		updates["bio"] = body.Bio
	}
	if body.Avatar != "" {
		updates["avatar"] = body.Avatar
	}
	if body.Username != "" {
		updates["username"] = body.Username
	}
	if body.Banner != "" {
		updates["banner"] = body.Banner
	}
	// Pronouns can be empty
	updates["pronouns"] = body.Pronouns
	
	if body.Connections != "" {
		updates["connections"] = body.Connections
	}

	database.DB.Model(&database.User{}).Where("id = ?", userID).Updates(updates)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"message": "Profile updated"})
}
