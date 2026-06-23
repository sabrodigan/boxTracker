package main

import "go.mongodb.org/mongo-driver/bson/primitive"

type User struct {
	ID       primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Username string             `bson:"username" json:"username"`
	Password string             `bson:"password" json:"-"`
}

type SafeUser struct {
	ID       primitive.ObjectID `json:"id"`
	Username string             `json:"username"`
}

func (u *User) ToSafeUser() SafeUser {
	return SafeUser{
		ID:       u.ID,
		Username: u.Username,
	}
}

type Box struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name      string             `bson:"name" json:"name"`
	Location  string             `bson:"location" json:"location"`
	UserID    primitive.ObjectID `bson:"user_id" json:"userId"`
	QRToken   string             `bson:"qr_token" json:"qrToken"`
	ItemCount int                `bson:"item_count,omitempty" json:"itemCount"`
}

type Item struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name        string             `bson:"name" json:"name"`
	Description string             `bson:"description" json:"description"`
	BoxID       primitive.ObjectID `bson:"box_id" json:"boxId"`
	UserID      primitive.ObjectID `bson:"user_id" json:"userId"`
}
