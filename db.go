package main

import (
	"context"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	client  *mongo.Client
	db      *mongo.Database
	userCol    *mongo.Collection
	boxCol     *mongo.Collection
	itemCol    *mongo.Collection
	counterCol *mongo.Collection
)

func InitDB() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}

	var err error
	client, err = mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatalf("Failed to ping MongoDB: %v", err)
	}

	log.Println("Connected to MongoDB successfully!")

	db = client.Database("boxtracker")
	userCol = db.Collection("users")
	boxCol = db.Collection("boxes")
	itemCol = db.Collection("items")
	counterCol = db.Collection("counters")

	// Create unique index for username
	indexModel := mongo.IndexModel{
		Keys:    bson.D{{Key: "username", Value: 1}},
		Options: options.Index().SetUnique(true),
	}
	_, err = userCol.Indexes().CreateOne(context.Background(), indexModel)
	if err != nil {
		log.Printf("Could not create unique index on username: %v", err)
	}

	// Create unique index for box qr_token
	qrIndex := mongo.IndexModel{
		Keys:    bson.D{{Key: "qr_token", Value: 1}},
		Options: options.Index().SetUnique(true),
	}
	_, _ = boxCol.Indexes().CreateOne(context.Background(), qrIndex)
}

func getNextBoxSequence(ctx context.Context) (int, error) {
	opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)
	filter := bson.M{"_id": "box_sequence"}
	update := bson.M{"$inc": bson.M{"seq": 1}}

	var result struct {
		Seq int `bson:"seq"`
	}

	err := counterCol.FindOneAndUpdate(ctx, filter, update, opts).Decode(&result)
	if err != nil {
		return 0, err
	}
	return result.Seq, nil
}
