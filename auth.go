package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/sessions"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

var store *sessions.CookieStore

// InitSessionStore initializes the cookie session store from the SESSION_SECRET
// environment variable. It fails closed (exits) if the secret is missing or too
// short, so the app never runs with a weak/known signing key in production.
func InitSessionStore() {
	secret := os.Getenv("SESSION_SECRET")
	if len(secret) < 32 {
		log.Fatal("SESSION_SECRET must be set to a strong random value (at least 32 characters)")
	}
	store = sessions.NewCookieStore([]byte(secret))
	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   86400, // 24 hours
		HttpOnly: true,
	}
}

func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

func checkPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func GetUserFromSession(r *http.Request) *User {
	session, _ := store.Get(r, "session-name")
	if userID, ok := session.Values["user_id"].(string); ok {
		objID, err := primitive.ObjectIDFromHex(userID)
		if err != nil {
			return nil
		}
		var user User
		err = userCol.FindOne(context.Background(), bson.M{"_id": objID}).Decode(&user)
		if err != nil {
			return nil
		}
		return &user
	}
	return nil
}

func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromSession(r)
		if user == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	var req User
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	var existing User
	err := userCol.FindOne(context.Background(), bson.M{"username": req.Username}).Decode(&existing)
	if err == nil {
		http.Error(w, "Username already exists", http.StatusBadRequest)
		return
	}

	hashed, err := hashPassword(req.Password)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}
	req.Password = hashed
	req.ID = primitive.NewObjectID()

	_, err = userCol.InsertOne(context.Background(), req)
	if err != nil {
		http.Error(w, "Error creating user", http.StatusInternalServerError)
		return
	}

	session, _ := store.Get(r, "session-name")
	session.Values["user_id"] = req.ID.Hex()
	session.Save(r, w)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req.ToSafeUser())
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	var req User
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	var user User
	err := userCol.FindOne(context.Background(), bson.M{"username": req.Username}).Decode(&user)
	if err != nil || !checkPasswordHash(req.Password, user.Password) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	session, _ := store.Get(r, "session-name")
	session.Values["user_id"] = user.ID.Hex()
	session.Save(r, w)

	json.NewEncoder(w).Encode(user.ToSafeUser())
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
	session, _ := store.Get(r, "session-name")
	session.Options.MaxAge = -1
	session.Save(r, w)
	w.WriteHeader(http.StatusOK)
}

func getUserHandler(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromSession(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	json.NewEncoder(w).Encode(user.ToSafeUser())
}
