package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/facebook"
	"golang.org/x/oauth2/google"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var googleOauthConfig *oauth2.Config
var facebookOauthConfig *oauth2.Config

func InitOAuth() {
	baseURL := "https://boxtracker.net" // For production
	if os.Getenv("ENV") == "development" {
		baseURL = "http://localhost:8091"
	}

	googleOauthConfig = &oauth2.Config{
		RedirectURL:  baseURL + "/auth/google/callback",
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email"},
		Endpoint:     google.Endpoint,
	}

	facebookOauthConfig = &oauth2.Config{
		RedirectURL:  baseURL + "/auth/facebook/callback",
		ClientID:     os.Getenv("FACEBOOK_CLIENT_ID"),
		ClientSecret: os.Getenv("FACEBOOK_CLIENT_SECRET"),
		Scopes:       []string{"email"},
		Endpoint:     facebook.Endpoint,
	}
}

func generateStateOauthCookie(w http.ResponseWriter) string {
	b := make([]byte, 16)
	rand.Read(b)
	state := base64.URLEncoding.EncodeToString(b)
	http.SetCookie(w, &http.Cookie{
		Name:     "oauthstate",
		Value:    state,
		MaxAge:   365 * 24 * 60 * 60, // 1 year
		HttpOnly: true,
		Secure:   true,
		Path:     "/",
	})
	return state
}

func handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	oauthState := generateStateOauthCookie(w)
	url := googleOauthConfig.AuthCodeURL(oauthState)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func handleFacebookLogin(w http.ResponseWriter, r *http.Request) {
	oauthState := generateStateOauthCookie(w)
	url := facebookOauthConfig.AuthCodeURL(oauthState)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	oauthState, _ := r.Cookie("oauthstate")
	if r.FormValue("state") != oauthState.Value {
		log.Println("invalid oauth google state")
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	data, err := getUserDataFromGoogle(r.FormValue("code"))
	if err != nil {
		log.Println(err.Error())
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	processOAuthUser(w, r, data)
}

func handleFacebookCallback(w http.ResponseWriter, r *http.Request) {
	oauthState, _ := r.Cookie("oauthstate")
	if r.FormValue("state") != oauthState.Value {
		log.Println("invalid oauth facebook state")
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	data, err := getUserDataFromFacebook(r.FormValue("code"))
	if err != nil {
		log.Println(err.Error())
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	processOAuthUser(w, r, data)
}

func getUserDataFromGoogle(code string) (map[string]interface{}, error) {
	token, err := googleOauthConfig.Exchange(context.Background(), code)
	if err != nil {
		return nil, err
	}
	response, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + token.AccessToken)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	var data map[string]interface{}
	json.NewDecoder(response.Body).Decode(&data)
	return data, nil
}

func getUserDataFromFacebook(code string) (map[string]interface{}, error) {
	token, err := facebookOauthConfig.Exchange(context.Background(), code)
	if err != nil {
		return nil, err
	}
	response, err := http.Get("https://graph.facebook.com/me?fields=id,name,email&access_token=" + token.AccessToken)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	var data map[string]interface{}
	json.NewDecoder(response.Body).Decode(&data)
	return data, nil
}

func processOAuthUser(w http.ResponseWriter, r *http.Request, data map[string]interface{}) {
	email, ok := data["email"].(string)
	if !ok || email == "" {
		http.Error(w, "Email required from OAuth provider", http.StatusBadRequest)
		return
	}

	// Try to find user by email (using email as username)
	var user User
	err := userCol.FindOne(context.Background(), bson.M{"username": email}).Decode(&user)
	if err != nil {
		// Create new user if not exists
		user = User{Username: email, Password: ""} // No password needed for OAuth
		res, err := userCol.InsertOne(context.Background(), user)
		if err != nil {
			http.Error(w, "Server error during registration", http.StatusInternalServerError)
			return
		}
		user.ID = res.InsertedID.(primitive.ObjectID)
	}

	session, _ := store.Get(r, "session-name")
	session.Values["user_id"] = user.ID.Hex()
	session.Save(r, w)

	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}
