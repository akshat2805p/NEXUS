package handlers

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"nexus-backend/database"
	"strconv"
	"strings"
	"time"
)

// GetAccounts — GET /api/accounts
func GetAccounts(w http.ResponseWriter, r *http.Request) {
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

	var accounts []database.Account
	database.DB.Where("user_id = ? AND is_active = true", userID).Find(&accounts)
	if accounts == nil {
		accounts = []database.Account{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(accounts)
}

// CreateAccount — POST /api/accounts
func CreateAccount(w http.ResponseWriter, r *http.Request) {
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

	var body struct {
		AccountName string  `json:"account_name"`
		AccountType string  `json:"account_type"`
		Balance     float64 `json:"balance"`
		Currency    string  `json:"currency"`
		Provider    string  `json:"provider"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.AccountName == "" {
		jsonError(w, http.StatusBadRequest, "Account name is required")
		return
	}
	if body.Currency == "" {
		body.Currency = "INR"
	}
	if body.AccountType == "" {
		body.AccountType = "checking"
	}

	// Generate account number
	acctNum := fmt.Sprintf("%016d", rand.Int63n(9999999999999999))

	account := database.Account{
		UserID:        userID,
		AccountName:   body.AccountName,
		AccountType:   body.AccountType,
		Balance:       body.Balance,
		Currency:      body.Currency,
		Provider:      body.Provider,
		AccountNumber: acctNum,
		IsActive:      true,
		IsVerified:    false,
	}
	database.DB.Create(&account)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(account)
}

// GetTransactions — GET /api/transactions
func GetTransactions(w http.ResponseWriter, r *http.Request) {
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

	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if n, err := strconv.Atoi(limitStr); err == nil && n > 0 {
			limit = n
		}
	}

	var transactions []database.Transaction
	database.DB.Where("user_id = ?", userID).
		Order("created_at desc").
		Limit(limit).
		Find(&transactions)

	if transactions == nil {
		transactions = []database.Transaction{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transactions)
}

// CreateTransaction — POST /api/transactions
func CreateTransaction(w http.ResponseWriter, r *http.Request) {
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

	var body struct {
		AccountID       uint    `json:"account_id"`
		TransactionType string  `json:"transaction_type"`
		Amount          float64 `json:"amount"`
		Currency        string  `json:"currency"`
		Description     string  `json:"description"`
		Category        string  `json:"category"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Amount <= 0 {
		jsonError(w, http.StatusBadRequest, "Amount must be positive")
		return
	}
	if body.Currency == "" {
		body.Currency = "INR"
	}

	// Generate reference number
	ref := fmt.Sprintf("NX%d%d", time.Now().UnixNano(), rand.Intn(9999))

	now := time.Now()
	tx := database.Transaction{
		UserID:          userID,
		AccountID:       body.AccountID,
		TransactionType: body.TransactionType,
		Amount:          body.Amount,
		Currency:        body.Currency,
		Description:     body.Description,
		Category:        body.Category,
		Status:          "completed",
		ReferenceNumber: ref,
		CompletedAt:     &now,
	}
	database.DB.Create(&tx)

	// Update account balance
	if body.AccountID > 0 {
		var account database.Account
		if err := database.DB.Where("id = ? AND user_id = ?", body.AccountID, userID).First(&account).Error; err == nil {
			switch body.TransactionType {
			case "deposit":
				database.DB.Model(&account).Update("balance", account.Balance+body.Amount)
			case "withdrawal", "payment", "transfer":
				database.DB.Model(&account).Update("balance", account.Balance-body.Amount)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(tx)
}

// Transfer — POST /api/transfer
func Transfer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	claims, err := authFromHeader(r)
	if err != nil {
		jsonError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	fromUserID := uint(claims["user_id"].(float64))

	var body struct {
		FromAccountID uint    `json:"from_account_id"`
		ToIdentifier  string  `json:"to_identifier"` // email, phone, or nexus_id
		Amount        float64 `json:"amount"`
		Currency      string  `json:"currency"`
		Description   string  `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Amount <= 0 {
		jsonError(w, http.StatusBadRequest, "Amount must be positive")
		return
	}

	// Validate sender account
	var fromAccount database.Account
	if err := database.DB.Where("id = ? AND user_id = ?", body.FromAccountID, fromUserID).First(&fromAccount).Error; err != nil {
		jsonError(w, http.StatusNotFound, "Source account not found")
		return
	}
	if fromAccount.Balance < body.Amount {
		jsonError(w, http.StatusBadRequest, "Insufficient balance")
		return
	}

	// Find recipient
	q := strings.TrimSpace(body.ToIdentifier)
	var toUser database.User
	if err := database.DB.Where("email = ? OR phone_number = ? OR nexus_id = ?", q, q, q).First(&toUser).Error; err != nil {
		jsonError(w, http.StatusNotFound, "Recipient not found")
		return
	}

	if toUser.ID == fromUserID {
		jsonError(w, http.StatusBadRequest, "Cannot transfer to yourself")
		return
	}

	if body.Currency == "" {
		body.Currency = fromAccount.Currency
	}

	now := time.Now()
	ref := fmt.Sprintf("NXT%d%d", time.Now().UnixNano(), rand.Intn(9999))

	// Debit sender
	database.DB.Model(&fromAccount).Update("balance", fromAccount.Balance-body.Amount)
	database.DB.Create(&database.Transaction{
		UserID:          fromUserID,
		AccountID:       body.FromAccountID,
		TransactionType: "transfer",
		Amount:          body.Amount,
		Currency:        body.Currency,
		Description:     fmt.Sprintf("Transfer to %s: %s", toUser.Username, body.Description),
		Status:          "completed",
		ToUserID:        &toUser.ID,
		ReferenceNumber: ref + "_OUT",
		CompletedAt:     &now,
		Category:        "transfer",
	})

	// Credit recipient (find or create default account)
	var toAccount database.Account
	if err := database.DB.Where("user_id = ? AND is_active = true", toUser.ID).First(&toAccount).Error; err != nil {
		// Create a default account for recipient
		toAccount = database.Account{
			UserID:        toUser.ID,
			AccountName:   "Nexus Wallet",
			AccountType:   "checking",
			Balance:       0,
			Currency:      body.Currency,
			AccountNumber: fmt.Sprintf("%016d", rand.Int63n(9999999999999999)),
			IsActive:      true,
		}
		database.DB.Create(&toAccount)
	}
	database.DB.Model(&toAccount).Update("balance", toAccount.Balance+body.Amount)
	database.DB.Create(&database.Transaction{
		UserID:          toUser.ID,
		AccountID:       toAccount.ID,
		TransactionType: "deposit",
		Amount:          body.Amount,
		Currency:        body.Currency,
		Description:     fmt.Sprintf("Transfer from %s: %s", claims["username"], body.Description),
		Status:          "completed",
		FromUserID:      &fromUserID,
		ReferenceNumber: ref + "_IN",
		CompletedAt:     &now,
		Category:        "transfer",
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":          "Transfer successful",
		"reference_number": ref,
		"amount":           body.Amount,
		"currency":         body.Currency,
		"recipient":        toUser.Username,
	})
}
