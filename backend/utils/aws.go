package utils

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var S3Client *s3.Client
var PresignClient *s3.PresignClient
var BucketName string

func InitAWS() {
	BucketName = os.Getenv("AWS_S3_BUCKET")
	if BucketName == "" {
		log.Println("⚠️ AWS_S3_BUCKET not set. S3 uploads will be disabled.")
		return
	}

	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Printf("❌ Failed to load AWS config: %v", err)
		return
	}

	S3Client = s3.NewFromConfig(cfg)
	PresignClient = s3.NewPresignClient(S3Client)
	log.Println("✅ AWS S3 configured successfully")
}

func GeneratePresignedUploadURL(objectKey string, contentType string) (string, error) {
	if PresignClient == nil {
		return "", fmt.Errorf("S3 client not initialized")
	}

	request, err := PresignClient.PresignPutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:      aws.String(BucketName),
		Key:         aws.String(objectKey),
		ContentType: aws.String(contentType),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = time.Duration(15 * time.Minute)
	})
	if err != nil {
		return "", err
	}

	return request.URL, nil
}
