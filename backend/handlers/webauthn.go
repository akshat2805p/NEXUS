package handlers

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"nexus-backend/database"
	"nexus-backend/utils"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
)

// webauthnUser wraps the database User to satisfy the WebAuthn User interface
type webauthnUser struct {
	user  *database.User
	creds []webauthn.Credential
}

func (u *webauthnUser) WebAuthnID() []byte         { return u.user.WebAuthnUID }
func (u *webauthnUser) WebAuthnName() string        { return u.user.Email }
func (u *webauthnUser) WebAuthnDisplayName() string { return u.user.Username }
func (u *webauthnUser) WebAuthnCredentials() []webauthn.Credential { return u.creds }
func (u *webauthnUser) WebAuthnIcon() string { return "" }

func newWebAuthn(r *http.Request) (*webauthn.WebAuthn, error) {
	scheme := "https"
	if r.Header.Get("X-Forwarded-Proto") == "" && (r.Host == "localhost:8080" || r.Host == "localhost:5173") {
		scheme = "http"
	}
	origin := scheme + "://" + r.Host
	// For dev, allow localhost
	if r.Host == "localhost:8080" || r.Host == "localhost:5173" {
		origin = "https://localhost:5173"
	}

	wconfig := &webauthn.Config{
		RPDisplayName: "Nexus Chat",
		RPID:          "localhost",
		RPOrigins:     []string{origin, "https://localhost:5173", "http://localhost:5173"},
	}
	return webauthn.New(wconfig)
}

func getOrCreateWebAuthnUser(email string) (*webauthnUser, error) {
	var user database.User
	result := database.DB.Where("email = ?", email).First(&user)
	if result.Error != nil {
		// Auto-create user
		parts := splitEmail(email)
		user = database.User{
			Email:       email,
			Username:    parts,
			WebAuthnUID: uuid.New().NodeID(),
		}
		database.DB.Create(&user)
	}
	if user.WebAuthnUID == nil {
		user.WebAuthnUID = uuid.New().NodeID()
		database.DB.Save(&user)
	}

	// Load credentials
	var auths []database.Authenticator
	database.DB.Where("user_id = ?", user.ID).Find(&auths)

	creds := make([]webauthn.Credential, len(auths))
	for i, a := range auths {
		creds[i] = webauthn.Credential{
			ID:        a.CredentialID,
			PublicKey: a.PublicKey,
			Authenticator: webauthn.Authenticator{
				AAGUID:    a.AAGUID,
				SignCount: a.SignCount,
			},
		}
	}

	return &webauthnUser{user: &user, creds: creds}, nil
}

func splitEmail(email string) string {
	for i, c := range email {
		if c == '@' {
			return email[:i]
		}
	}
	return email
}

// BeginWebAuthnRegistration — POST /api/webauthn/register/begin
func BeginWebAuthnRegistration(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct{ Email string `json:"email"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" {
		http.Error(w, "Email required", http.StatusBadRequest)
		return
	}

	wa, err := newWebAuthn(r)
	if err != nil {
		http.Error(w, "WebAuthn config error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	waUser, err := getOrCreateWebAuthnUser(req.Email)
	if err != nil {
		http.Error(w, "User error", http.StatusInternalServerError)
		return
	}

	creation, session, err := wa.BeginRegistration(waUser)
	if err != nil {
		http.Error(w, "BeginRegistration error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Store session challenge
	challengeJSON, _ := json.Marshal(session)
	database.DB.Create(&database.WebAuthnSession{
		Email:     req.Email,
		Challenge: string(challengeJSON),
		ExpiresAt: time.Now().Add(5 * time.Minute),
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(creation)
}

// FinishWebAuthnRegistration — POST /api/webauthn/register/finish
func FinishWebAuthnRegistration(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	email := r.URL.Query().Get("email")
	if email == "" {
		http.Error(w, "Email required", http.StatusBadRequest)
		return
	}

	var sessionRecord database.WebAuthnSession
	err := database.DB.Where("email = ? AND expires_at > ?", email, time.Now()).Order("created_at desc").First(&sessionRecord).Error
	if err != nil {
		http.Error(w, "Session not found or expired", http.StatusUnauthorized)
		return
	}
	database.DB.Delete(&sessionRecord)

	var sessionData webauthn.SessionData
	if err := json.Unmarshal([]byte(sessionRecord.Challenge), &sessionData); err != nil {
		http.Error(w, "Session parse error", http.StatusInternalServerError)
		return
	}

	wa, _ := newWebAuthn(r)
	waUser, _ := getOrCreateWebAuthnUser(email)

	credential, err := wa.FinishRegistration(waUser, sessionData, r)
	if err != nil {
		http.Error(w, "FinishRegistration error: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Save credential
	database.DB.Create(&database.Authenticator{
		UserID:       waUser.user.ID,
		CredentialID: credential.ID,
		PublicKey:    credential.PublicKey,
		AAGUID:       credential.Authenticator.AAGUID,
		SignCount:     credential.Authenticator.SignCount,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "Biometric registered successfully!"})
}

// BeginWebAuthnLogin — POST /api/webauthn/login/begin
func BeginWebAuthnLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct{ Email string `json:"email"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" {
		http.Error(w, "Email required", http.StatusBadRequest)
		return
	}

	wa, _ := newWebAuthn(r)
	waUser, _ := getOrCreateWebAuthnUser(req.Email)

	assertion, session, err := wa.BeginLogin(waUser)
	if err != nil {
		http.Error(w, "BeginLogin error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	challengeJSON, _ := json.Marshal(session)
	database.DB.Create(&database.WebAuthnSession{
		Email:     req.Email,
		Challenge: string(challengeJSON),
		ExpiresAt: time.Now().Add(5 * time.Minute),
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(assertion)
}

// FinishWebAuthnLogin — POST /api/webauthn/login/finish
func FinishWebAuthnLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	email := r.URL.Query().Get("email")
	if email == "" {
		http.Error(w, "Email required", http.StatusBadRequest)
		return
	}

	var sessionRecord database.WebAuthnSession
	err := database.DB.Where("email = ? AND expires_at > ?", email, time.Now()).Order("created_at desc").First(&sessionRecord).Error
	if err != nil {
		http.Error(w, "Session not found or expired", http.StatusUnauthorized)
		return
	}
	database.DB.Delete(&sessionRecord)

	var sessionData webauthn.SessionData
	json.Unmarshal([]byte(sessionRecord.Challenge), &sessionData)

	wa, _ := newWebAuthn(r)
	waUser, _ := getOrCreateWebAuthnUser(email)

	credential, err := wa.FinishLogin(waUser, sessionData, r)
	if err != nil {
		http.Error(w, "FinishLogin error: "+err.Error(), http.StatusUnauthorized)
		return
	}

	// Update sign count
	database.DB.Model(&database.Authenticator{}).
		Where("credential_id = ?", base64.RawURLEncoding.EncodeToString(credential.ID)).
		Update("sign_count", credential.Authenticator.SignCount)

	token, _ := utils.GenerateToken(waUser.user.ID, waUser.user.Email, waUser.user.Username)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"token":    token,
		"user_id":  waUser.user.ID,
		"email":    waUser.user.Email,
		"username": waUser.user.Username,
	})
}

// DiscordOAuthURL — redirect users to Discord OAuth
func DiscordOAuthURL(w http.ResponseWriter, r *http.Request) {
	// In production, replace with your Discord Client ID from discord.com/developers
	clientID := "YOUR_DISCORD_CLIENT_ID"
	redirectURI := "https://" + r.Host + "/api/integrations/discord/callback"
	url := "https://discord.com/api/oauth2/authorize?client_id=" + clientID +
		"&redirect_uri=" + redirectURI +
		"&response_type=code&scope=identify+guilds"
	http.Redirect(w, r, url, http.StatusFound)
}

// CheckBiometricAvailable — GET /api/webauthn/has-credential
func CheckBiometricAvailable(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		json.NewEncoder(w).Encode(map[string]bool{"available": false})
		return
	}

	var user database.User
	if err := database.DB.Where("email = ?", email).First(&user).Error; err != nil {
		json.NewEncoder(w).Encode(map[string]bool{"available": false})
		return
	}

	var count int64
	database.DB.Model(&database.Authenticator{}).Where("user_id = ?", user.ID).Count(&count)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"available": count > 0})
}

// protocol is referenced by the FinishRegistration return type — keep import
var _ = protocol.CredentialCreationResponse{}
