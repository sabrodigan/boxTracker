package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gorilla/mux"
)

type spaHandler struct {
	staticPath string
	indexPath  string
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := filepath.Join(h.staticPath, r.URL.Path)
	_, err := os.Stat(path)
	if os.IsNotExist(err) {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		http.ServeFile(w, r, filepath.Join(h.staticPath, h.indexPath))
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	http.FileServer(http.Dir(h.staticPath)).ServeHTTP(w, r)
}

func main() {
	InitSessionStore()
	InitDB()
	InitOAuth()

	r := mux.NewRouter()

	api := r.PathPrefix("/api").Subrouter()

	r.HandleFunc("/auth/google/login", handleGoogleLogin).Methods("GET")
	r.HandleFunc("/auth/google/callback", handleGoogleCallback).Methods("GET")
	r.HandleFunc("/auth/facebook/login", handleFacebookLogin).Methods("GET")
	r.HandleFunc("/auth/facebook/callback", handleFacebookCallback).Methods("GET")
	api.HandleFunc("/register", registerHandler).Methods("POST")
	api.HandleFunc("/login", loginHandler).Methods("POST")
	api.HandleFunc("/logout", logoutHandler).Methods("POST")
	api.HandleFunc("/user", getUserHandler).Methods("GET")

	// Protected endpoints
	protected := api.PathPrefix("").Subrouter()
	protected.Use(RequireAuth)

	protected.HandleFunc("/boxes", getBoxesHandler).Methods("GET")
	protected.HandleFunc("/boxes", createBoxHandler).Methods("POST")
	protected.HandleFunc("/boxes/by-qr/{qr}", getBoxByQRHandler).Methods("GET")
	protected.HandleFunc("/boxes/{id}", getBoxHandler).Methods("GET")
	protected.HandleFunc("/boxes/{id}", updateBoxHandler).Methods("PUT")
	protected.HandleFunc("/boxes/{id}", deleteBoxHandler).Methods("DELETE")

	protected.HandleFunc("/boxes/{boxId}/items", getItemsHandler).Methods("GET")
	protected.HandleFunc("/boxes/{boxId}/items", createItemHandler).Methods("POST")

	protected.HandleFunc("/items/{id}", deleteItemHandler).Methods("DELETE")
	protected.HandleFunc("/items/{id}", updateItemHandler).Methods("PUT")
	protected.HandleFunc("/items/{id}/move", moveItemHandler).Methods("PATCH")

	protected.HandleFunc("/search", searchHandler).Methods("GET")
	protected.HandleFunc("/export", exportCSVHandler).Methods("GET")

	// Serve the static React build
	spa := spaHandler{staticPath: "dist/public", indexPath: "index.html"}
	r.PathPrefix("/").Handler(spa)

	// Listen address is configurable via LISTEN_ADDR. Defaults to loopback so
	// production (fronted by the Caddy reverse proxy) is never exposed directly.
	// For LAN access during local development, set LISTEN_ADDR=0.0.0.0:8091.
	addr := os.Getenv("LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8091"
	}
	log.Printf("Server started on %s", addr)
	log.Fatal(http.ListenAndServe(addr, r))
}
