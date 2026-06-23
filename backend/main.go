package main

import (
	"encoding/json"
	"log"
	"net/http"
	"nexus-backend/database"
	"nexus-backend/handlers"
	"nexus-backend/utils"
	"os"

	"github.com/joho/godotenv"
)

// CORS middleware
func enableCors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE, PATCH")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func warnDeliveryConfig() {
	if os.Getenv("RESEND_API_KEY") == "" {
		log.Println("⚠️ RESEND_API_KEY is not set. Email OTP delivery will not work.")
	}
	if os.Getenv("TWILIO_ACCOUNT_SID") == "" || os.Getenv("TWILIO_AUTH_TOKEN") == "" || os.Getenv("TWILIO_PHONE_NUMBER") == "" {
		log.Println("⚠️ Twilio SMS settings are incomplete. Phone OTP delivery will not work.")
	}
}

func main() {
	// Load environment variables from .env if present
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️ .env not found or could not be loaded, proceeding with existing environment variables")
	}
	warnDeliveryConfig()
	database.InitDB()
	utils.InitRedis()
	utils.InitAWS()

	hub := handlers.NewHub()
	hub.SubscribeToRedis()
	go hub.Run()

	// ── AUTH ──────────────────────────────────────────────────────
	http.HandleFunc("/api/request-otp", enableCors(handlers.RequestOTP))
	http.HandleFunc("/api/verify-otp", enableCors(handlers.VerifyOTP))

	// ── PHONE VERIFICATION ────────────────────────────────────────
	http.HandleFunc("/api/phone/send-otp", enableCors(handlers.SendPhoneOTP))
	http.HandleFunc("/api/phone/verify-otp", enableCors(handlers.VerifyPhoneOTP))

	// ── PROFILE & SETTINGS ───────────────────────────────────────
	http.HandleFunc("/api/profile", enableCors(handlers.GetProfile))
	http.HandleFunc("/api/profile/update", enableCors(handlers.UpdateProfile))
	http.HandleFunc("/api/settings", enableCors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			handlers.GetSettings(w, r)
		} else if r.Method == http.MethodPut {
			handlers.UpdateSettings(w, r)
		}
	}))

	// ── FRIENDS ──────────────────────────────────────────────────
	http.HandleFunc("/api/users/search", enableCors(handlers.SearchUser))
	http.HandleFunc("/api/friends", enableCors(handlers.GetFriends))
	http.HandleFunc("/api/friends/request", enableCors(handlers.SendFriendRequest))
	http.HandleFunc("/api/friends/respond", enableCors(handlers.RespondFriendRequest))
	http.HandleFunc("/api/friends/remove", enableCors(handlers.RemoveFriend))
	http.HandleFunc("/api/friends/invite", enableCors(handlers.InviteUser))

	// ── FINANCE ──────────────────────────────────────────────────
	http.HandleFunc("/api/accounts", enableCors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			handlers.GetAccounts(w, r)
		} else if r.Method == http.MethodPost {
			handlers.CreateAccount(w, r)
		}
	}))
	http.HandleFunc("/api/transactions", enableCors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			handlers.GetTransactions(w, r)
		} else if r.Method == http.MethodPost {
			handlers.CreateTransaction(w, r)
		}
	}))
	http.HandleFunc("/api/transfer", enableCors(handlers.Transfer))

	// ── WEBAUTHN ─────────────────────────────────────────────────
	http.HandleFunc("/api/webauthn/register/begin", enableCors(handlers.BeginWebAuthnRegistration))
	http.HandleFunc("/api/webauthn/register/finish", enableCors(handlers.FinishWebAuthnRegistration))
	http.HandleFunc("/api/webauthn/login/begin", enableCors(handlers.BeginWebAuthnLogin))
	http.HandleFunc("/api/webauthn/login/finish", enableCors(handlers.FinishWebAuthnLogin))
	http.HandleFunc("/api/webauthn/has-credential", enableCors(handlers.CheckBiometricAvailable))

	// ── MEDIA ───────────────────────────────────────────────────
	http.HandleFunc("/api/media/presign", enableCors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			FileName    string `json:"fileName"`
			ContentType string `json:"contentType"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		url, err := utils.GeneratePresignedUploadURL(req.FileName, req.ContentType)
		if err != nil {
			http.Error(w, "Failed to generate presigned URL: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"url": url,
			"key": req.FileName, // Or generate a unique ID
		})
	}))

	// ── WEBSOCKET ─────────────────────────────────────────────────
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handlers.ServeWs(hub, w, r)
	})

	// ── SERVE REACT FRONTEND ──────────────────────────────────────
	distPath := "../frontend/dist"
	if _, err := os.Stat("/app/dist"); err == nil {
		distPath = "/app/dist"
	}
	fs := http.FileServer(http.Dir(distPath))
	http.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := os.Stat(distPath + r.URL.Path); os.IsNotExist(err) {
			http.ServeFile(w, r, distPath+"/index.html")
			return
		}
		fs.ServeHTTP(w, r)
	}))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Nexus backend running on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
