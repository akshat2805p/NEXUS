package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"nexus-backend/database"
	"nexus-backend/utils"
	"strings"
)

// SearchUser — GET /api/users/search?q=email_or_phone
func SearchUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	claims, err := authFromHeader(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	myID := uint(claims["user_id"].(float64))

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) < 2 {
		jsonError(w, http.StatusBadRequest, "Search query must be at least 2 characters")
		return
	}

	type UserResult struct {
		ID          uint   `json:"id"`
		Username    string `json:"username"`
		NexusID     string `json:"nexus_id"`
		Email       string `json:"email"`
		PhoneNumber string `json:"phone_number"`
		Avatar      string `json:"avatar"`
	}

	var users []database.User
	// Search by email, phone, or nexus_id
	database.DB.Where(
		"(email LIKE ? OR phone_number = ? OR nexus_id LIKE ? OR username LIKE ?) AND id != ?",
		"%"+q+"%", q, "%"+q+"%", "%"+q+"%", myID,
	).Limit(10).Find(&users)

	var results []UserResult
	for _, u := range users {
		results = append(results, UserResult{
			ID:          u.ID,
			Username:    u.Username,
			NexusID:     u.NexusID,
			Email:       u.Email,
			PhoneNumber: u.PhoneNumber,
			Avatar:      u.Avatar,
		})
	}
	if results == nil {
		results = []UserResult{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// SendFriendRequest — POST /api/friends/request
func SendFriendRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	claims, err := authFromHeader(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	myID := uint(claims["user_id"].(float64))

	var body struct {
		TargetID uint `json:"target_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	if body.TargetID == 0 || body.TargetID == myID {
		jsonError(w, http.StatusBadRequest, "Invalid target user")
		return
	}

	// Check if friendship already exists
	var count int64
	database.DB.Model(&database.Friendship{}).Where(
		"(requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)",
		myID, body.TargetID, body.TargetID, myID,
	).Count(&count)
	if count > 0 {
		jsonError(w, http.StatusConflict, "Friend request already sent or already friends")
		return
	}

	database.DB.Create(&database.Friendship{
		RequesterID: myID,
		TargetID:    body.TargetID,
		Status:      "pending",
	})

	if GlobalHub != nil {
		notifyFriendshipsChanged(GlobalHub, myID, body.TargetID)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Friend request sent",
	})
}

// RespondFriendRequest — POST /api/friends/respond
func RespondFriendRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	claims, err := authFromHeader(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	myID := uint(claims["user_id"].(float64))

	var body struct {
		RequesterID uint   `json:"requester_id"`
		Action      string `json:"action"` // "accept" or "decline"
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	var friendship database.Friendship
	if err := database.DB.Where("requester_id = ? AND target_id = ? AND status = 'pending'", body.RequesterID, myID).First(&friendship).Error; err != nil {
		jsonError(w, http.StatusNotFound, "Friend request not found")
		return
	}

	if body.Action == "accept" {
		database.DB.Model(&friendship).Update("status", "accepted")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"message": "Friend request accepted"})
	} else {
		database.DB.Delete(&friendship)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"message": "Friend request declined"})
	}
	
	if GlobalHub != nil {
		notifyFriendshipsChanged(GlobalHub, body.RequesterID, myID)
	}
}

// GetFriends — GET /api/friends
func GetFriends(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	claims, err := authFromHeader(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	myID := uint(claims["user_id"].(float64))

	type FriendResult struct {
		ID          uint   `json:"id"`
		Username    string `json:"username"`
		NexusID     string `json:"nexus_id"`
		Email       string `json:"email"`
		PhoneNumber string `json:"phone_number"`
		Avatar      string `json:"avatar"`
		Status      string `json:"status"`
		IsRequester bool   `json:"is_requester"`
	}

	var friendships []database.Friendship
	database.DB.Where("requester_id = ? OR target_id = ?", myID, myID).Find(&friendships)

	var results []FriendResult
	for _, f := range friendships {
		otherID := f.TargetID
		isReq := true
		if f.TargetID == myID {
			otherID = f.RequesterID
			isReq = false
		}
		var other database.User
		database.DB.First(&other, otherID)
		results = append(results, FriendResult{
			ID:          other.ID,
			Username:    other.Username,
			NexusID:     other.NexusID,
			Email:       other.Email,
			PhoneNumber: other.PhoneNumber,
			Avatar:      other.Avatar,
			Status:      f.Status,
			IsRequester: isReq,
		})
	}
	if results == nil {
		results = []FriendResult{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// RemoveFriend — DELETE /api/friends/{id}
func RemoveFriend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	claims, err := authFromHeader(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	myID := uint(claims["user_id"].(float64))

	var body struct {
		TargetID uint `json:"target_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	database.DB.Where(
		"(requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)",
		myID, body.TargetID, body.TargetID, myID,
	).Delete(&database.Friendship{})

	fmt.Fprintf(w, `{"message":"Friend removed"}`)
}

// InviteUser — POST /api/friends/invite
func InviteUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	claims, err := authFromHeader(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	email := strings.TrimSpace(strings.ToLower(body.Email))
	if email == "" || !strings.Contains(email, "@") {
		jsonError(w, http.StatusBadRequest, "Valid email is required")
		return
	}

	// Check if already registered
	var count int64
	database.DB.Model(&database.User{}).Where("email = ?", email).Count(&count)
	if count > 0 {
		jsonError(w, http.StatusBadRequest, "User is already registered on Nexus")
		return
	}

	inviterName := claims["username"].(string)

	if err := utils.SendInviteEmail(email, inviterName); err != nil {
		jsonError(w, http.StatusInternalServerError, "Failed to send invitation email")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Invitation sent successfully!",
	})
}
