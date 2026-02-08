# DevSquad AI - Production Deployment Script
# Usage: .\deploy.ps1

# Load sensitive variables from local ignored file
if (Test-Path "deploy-vars.ps1") {
    . .\deploy-vars.ps1
} else {
    Write-Error "Error: deploy-vars.ps1 not found. Please create it first."
    exit 1
}

Write-Host "🚀 Starting Production Deployment..."

# 1. Backend Deployment
Write-Host "Step 1: Building and Deploying Backend Lambda..."
Set-Location backend
.\build.ps1

Write-Host "Uploading Lambda package to S3..."
aws s3 cp lambda_deployment.zip "s3://$S3_BUCKET/lambda_deployment.zip"

Write-Host "Updating Lambda function code..."
aws lambda update-function-code --function-name $LAMBDA_NAME --s3-bucket $S3_BUCKET --s3-key lambda_deployment.zip --no-cli-pager

Set-Location ..

# 2. Frontend Deployment
Write-Host "Step 2: Building and Deploying Frontend..."
Set-Location frontend

Write-Host "Running Vite build..."
npm run build:prod

Write-Host "Uploading files to S3 bucket: $S3_BUCKET..."
node deploy.js $S3_BUCKET

Set-Location ..

Write-Host "Deployment Complete!"
Write-Host "URL: http://$S3_BUCKET.s3-website-eu-west-1.amazonaws.com"
