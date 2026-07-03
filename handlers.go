package main

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

func getBoxesHandler(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromSession(r)

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.D{{Key: "user_id", Value: user.ID}}}},
		{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: "items"},
			{Key: "localField", Value: "_id"},
			{Key: "foreignField", Value: "box_id"},
			{Key: "as", Value: "items"},
		}}},
		{{Key: "$addFields", Value: bson.D{
			{Key: "item_count", Value: bson.D{{Key: "$size", Value: "$items"}}},
		}}},
		{{Key: "$project", Value: bson.D{{Key: "items", Value: 0}}}},
	}

	cursor, err := boxCol.Aggregate(context.Background(), pipeline)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var boxes []Box
	if err = cursor.All(context.Background(), &boxes); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if boxes == nil {
		boxes = []Box{}
	}
	jsonResponse(w, http.StatusOK, boxes)
}

func createBoxHandler(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromSession(r)
	var box Box
	if err := json.NewDecoder(r.Body).Decode(&box); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}
	seq, err := getNextBoxSequence(context.Background())
	if err != nil {
		http.Error(w, "Failed to generate box number", http.StatusInternalServerError)
		return
	}

	box.ID = primitive.NewObjectID()
	box.UserID = user.ID
	box.QRToken = primitive.NewObjectID().Hex() // Unique token
	box.BoxNumber = fmt.Sprintf("BXT-%s-%04d", time.Now().Format("20060102"), seq)
	box.ItemCount = 0

	_, err = boxCol.InsertOne(context.Background(), box)
	if err != nil {
		http.Error(w, "Failed to create box", http.StatusInternalServerError)
		return
	}
	jsonResponse(w, http.StatusCreated, box)
}

func getBoxHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	boxID, err := primitive.ObjectIDFromHex(vars["id"])
	if err != nil {
		http.Error(w, "Invalid Box ID", http.StatusBadRequest)
		return
	}

	var box Box
	err = boxCol.FindOne(context.Background(), bson.M{"_id": boxID}).Decode(&box)
	if err != nil {
		http.Error(w, "Box not found", http.StatusNotFound)
		return
	}
	jsonResponse(w, http.StatusOK, box)
}

func getBoxByQRHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	qrToken := vars["qr"]
	user := GetUserFromSession(r)

	var box Box
	err := boxCol.FindOne(context.Background(), bson.M{"qr_token": qrToken, "user_id": user.ID}).Decode(&box)
	if err != nil {
		http.Error(w, "Box not found", http.StatusNotFound)
		return
	}
	jsonResponse(w, http.StatusOK, box)
}

func updateBoxHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	boxID, err := primitive.ObjectIDFromHex(vars["id"])
	if err != nil {
		http.Error(w, "Invalid Box ID", http.StatusBadRequest)
		return
	}

	var updateData struct {
		Name        *string `json:"name"`
		Location    *string `json:"location"`
		IsImportant *bool   `json:"isImportant"`
	}
	if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	updateDoc := bson.M{}
	if updateData.Name != nil {
		updateDoc["name"] = *updateData.Name
	}
	if updateData.Location != nil {
		updateDoc["location"] = *updateData.Location
	}
	if updateData.IsImportant != nil {
		updateDoc["is_important"] = *updateData.IsImportant
	}

	if len(updateDoc) > 0 {
		_, err = boxCol.UpdateOne(context.Background(), bson.M{"_id": boxID}, bson.M{"$set": updateDoc})
		if err != nil {
			http.Error(w, "Failed to update box", http.StatusInternalServerError)
			return
		}
	}

	var box Box
	boxCol.FindOne(context.Background(), bson.M{"_id": boxID}).Decode(&box)
	jsonResponse(w, http.StatusOK, box)
}

func deleteBoxHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	boxID, err := primitive.ObjectIDFromHex(vars["id"])
	if err != nil {
		http.Error(w, "Invalid Box ID", http.StatusBadRequest)
		return
	}

	_, err = itemCol.DeleteMany(context.Background(), bson.M{"box_id": boxID})
	if err != nil {
		http.Error(w, "Failed to delete items", http.StatusInternalServerError)
		return
	}
	_, err = boxCol.DeleteOne(context.Background(), bson.M{"_id": boxID})
	if err != nil {
		http.Error(w, "Failed to delete box", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getItemsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	boxID, err := primitive.ObjectIDFromHex(vars["boxId"])
	if err != nil {
		http.Error(w, "Invalid Box ID", http.StatusBadRequest)
		return
	}

	cursor, err := itemCol.Find(context.Background(), bson.M{"box_id": boxID})
	if err != nil {
		http.Error(w, "Failed to get items", http.StatusInternalServerError)
		return
	}

	var items []Item
	if err = cursor.All(context.Background(), &items); err != nil {
		http.Error(w, "Failed to parse items", http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []Item{}
	}
	jsonResponse(w, http.StatusOK, items)
}

func createItemHandler(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromSession(r)
	vars := mux.Vars(r)
	boxID, err := primitive.ObjectIDFromHex(vars["boxId"])
	if err != nil {
		http.Error(w, "Invalid Box ID", http.StatusBadRequest)
		return
	}

	var item Item
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}
	item.ID = primitive.NewObjectID()
	item.BoxID = boxID
	item.UserID = user.ID

	_, err = itemCol.InsertOne(context.Background(), item)
	if err != nil {
		http.Error(w, "Failed to create item", http.StatusInternalServerError)
		return
	}
	jsonResponse(w, http.StatusCreated, item)
}

func updateItemHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	itemID, err := primitive.ObjectIDFromHex(vars["id"])
	if err != nil {
		http.Error(w, "Invalid Item ID", http.StatusBadRequest)
		return
	}

	var updateData struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	updateDoc := bson.M{}
	if updateData.Name != nil {
		updateDoc["name"] = *updateData.Name
	}
	if updateData.Description != nil {
		updateDoc["description"] = *updateData.Description
	}

	if len(updateDoc) > 0 {
		_, err = itemCol.UpdateOne(context.Background(), bson.M{"_id": itemID}, bson.M{"$set": updateDoc})
		if err != nil {
			http.Error(w, "Failed to update item", http.StatusInternalServerError)
			return
		}
	}

	var item Item
	itemCol.FindOne(context.Background(), bson.M{"_id": itemID}).Decode(&item)
	jsonResponse(w, http.StatusOK, item)
}

func deleteItemHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	itemID, err := primitive.ObjectIDFromHex(vars["id"])
	if err != nil {
		http.Error(w, "Invalid Item ID", http.StatusBadRequest)
		return
	}

	_, err = itemCol.DeleteOne(context.Background(), bson.M{"_id": itemID})
	if err != nil {
		http.Error(w, "Failed to delete item", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func moveItemHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	itemID, err := primitive.ObjectIDFromHex(vars["id"])
	if err != nil {
		http.Error(w, "Invalid Item ID", http.StatusBadRequest)
		return
	}

	var body struct {
		BoxID string `json:"boxId"` // The client sends this as a string from select
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}
	newBoxID, err := primitive.ObjectIDFromHex(body.BoxID)
	if err != nil {
		http.Error(w, "Invalid Box ID", http.StatusBadRequest)
		return
	}

	_, err = itemCol.UpdateOne(context.Background(), bson.M{"_id": itemID}, bson.M{"$set": bson.M{"box_id": newBoxID}})
	if err != nil {
		http.Error(w, "Failed to move item", http.StatusInternalServerError)
		return
	}
	var item Item
	itemCol.FindOne(context.Background(), bson.M{"_id": itemID}).Decode(&item)
	jsonResponse(w, http.StatusOK, item)
}

type SearchResult struct {
	Box   Box    `json:"box"`
	Items []Item `json:"items"`
}

func searchHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	user := GetUserFromSession(r)
	query := r.URL.Query().Get("q")
	log.Printf("Search request from user %s for query: %q", user.Username, query)
	if query == "" {
		jsonResponse(w, http.StatusOK, []SearchResult{})
		return
	}

	// Case-insensitive regex
	regex := primitive.Regex{Pattern: query, Options: "i"}

	// Find matching items
	itemCursor, err := itemCol.Find(context.Background(), bson.M{
		"user_id": user.ID,
		"$or": []bson.M{
			{"name": regex},
			{"description": regex},
		},
	})
	if err != nil {
		http.Error(w, "Search failed", http.StatusInternalServerError)
		return
	}

	var items []Item
	if err = itemCursor.All(context.Background(), &items); err != nil {
		http.Error(w, "Failed to parse items", http.StatusInternalServerError)
		return
	}

	// Find matching boxes (by name, location, or box_number)
	boxCursor, err := boxCol.Find(context.Background(), bson.M{
		"user_id": user.ID,
		"$or": []bson.M{
			{"name": regex},
			{"location": regex},
			{"box_number": regex},
		},
	})
	if err != nil {
		http.Error(w, "Search failed", http.StatusInternalServerError)
		return
	}

	var matchingBoxes []Box
	if err = boxCursor.All(context.Background(), &matchingBoxes); err != nil {
		http.Error(w, "Failed to parse boxes", http.StatusInternalServerError)
		return
	}

	// Group items by box ID
	boxItemsMap := make(map[primitive.ObjectID][]Item)
	for _, item := range items {
		boxItemsMap[item.BoxID] = append(boxItemsMap[item.BoxID], item)
	}

	// Build a map of box ID to Box to ensure unique results
	boxMap := make(map[primitive.ObjectID]Box)
	for _, box := range matchingBoxes {
		boxMap[box.ID] = box
	}
	for boxID := range boxItemsMap {
		if _, exists := boxMap[boxID]; !exists {
			var box Box
			if err := boxCol.FindOne(context.Background(), bson.M{"_id": boxID}).Decode(&box); err == nil {
				boxMap[box.ID] = box
			}
		}
	}

	var results []SearchResult
	for boxID, box := range boxMap {
		itemsInBox := boxItemsMap[boxID]
		if itemsInBox == nil {
			itemsInBox = []Item{}
		}
		results = append(results, SearchResult{
			Box:   box,
			Items: itemsInBox,
		})
	}
	if results == nil {
		results = []SearchResult{}
	}
	
	log.Printf("Search results count: %d", len(results))

	jsonResponse(w, http.StatusOK, results)
}

func exportCSVHandler(w http.ResponseWriter, r *http.Request) {
	user := GetUserFromSession(r)

	// Fetch all boxes
	boxCursor, err := boxCol.Find(context.Background(), bson.M{"user_id": user.ID})
	if err != nil {
		http.Error(w, "Failed to get boxes", http.StatusInternalServerError)
		return
	}
	var boxes []Box
	if err = boxCursor.All(context.Background(), &boxes); err != nil {
		http.Error(w, "Failed to parse boxes", http.StatusInternalServerError)
		return
	}

	// Fetch all items
	itemCursor, err := itemCol.Find(context.Background(), bson.M{"user_id": user.ID})
	if err != nil {
		http.Error(w, "Failed to get items", http.StatusInternalServerError)
		return
	}
	var items []Item
	if err = itemCursor.All(context.Background(), &items); err != nil {
		http.Error(w, "Failed to parse items", http.StatusInternalServerError)
		return
	}

	// Group items by Box ID
	itemsByBox := make(map[primitive.ObjectID][]Item)
	for _, item := range items {
		itemsByBox[item.BoxID] = append(itemsByBox[item.BoxID], item)
	}

	// Update user export history
	_, err = userCol.UpdateOne(
		context.Background(),
		bson.M{"_id": user.ID},
		bson.M{"$push": bson.M{"export_history": time.Now()}},
	)
	if err != nil {
		log.Printf("Warning: failed to update export history for user %s: %v", user.Username, err)
	}

	// Set CSV headers for download
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=\"boxtracker_export.csv\"")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Write CSV Header
	writer.Write([]string{"Box Number", "Box Name", "Box Location", "Important", "Item Name", "Item Description"})

	// Write Rows
	for _, box := range boxes {
		boxItems := itemsByBox[box.ID]
		if len(boxItems) == 0 {
			// Write just the box if it's empty
			writer.Write([]string{
				box.BoxNumber,
				box.Name,
				box.Location,
				strconv.FormatBool(box.IsImportant),
				"",
				"",
			})
		} else {
			for _, item := range boxItems {
				writer.Write([]string{
					box.BoxNumber,
					box.Name,
					box.Location,
					strconv.FormatBool(box.IsImportant),
					item.Name,
					item.Description,
				})
			}
		}
	}
}
