# Simple Lambda Docker Build Script
# Builds Linux-compatible Lambda deployment package

$ErrorActionPreference = "Stop"

Write-Host "Building Lambda package with Docker..."

# Check Docker
try {
    docker --version | Out-Null
    docker info | Out-Null
} catch {
    Write-Host "Docker not running. Please start Docker Desktop."
    exit 1
}

$BackendDir = $PSScriptRoot
$OutputDir = Join-Path $BackendDir "docker-output"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Create Dockerfile
$Dockerfile = @"
FROM public.ecr.aws/lambda/python:3.11
WORKDIR /build

# Install dependencies directly to root of package
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -t .

# Copy application code
COPY lambda_handler.py main.py ./
COPY agents ./agents/
COPY services ./services/
COPY prompts ./prompts/
COPY models ./models/

# Create zip with correct structure
RUN python -c "import zipfile; import os; zf = zipfile.ZipFile('/tmp/lambda.zip', 'w', zipfile.ZIP_DEFLATED); [zf.write(os.path.join(dp, f)) for dp, dn, filenames in os.walk('.') for f in filenames if not f.endswith('.pyc') and '__pycache__' not in dp]; zf.close()"

CMD ["sleep", "300"]
"@

$Dockerfile | Out-File -FilePath (Join-Path $BackendDir "Dockerfile.lambda") -Encoding utf8 -Force

Write-Host "Building Docker image..."
docker build -f (Join-Path $BackendDir "Dockerfile.lambda") -t devsquad-lambda-build $BackendDir

Write-Host "Extracting package..."
docker run -d --name lambda-extract devsquad-lambda-build
docker cp lambda-extract:/tmp/lambda.zip (Join-Path $OutputDir "lambda_deployment.zip")
docker stop lambda-extract | Out-Null
docker rm lambda-extract | Out-Null

# Move to final location
$FinalZip = Join-Path $BackendDir "lambda_deployment.zip"
Move-Item -Path (Join-Path $OutputDir "lambda_deployment.zip") -Destination $FinalZip -Force

# Cleanup
Remove-Item -Recurse -Force $OutputDir
Remove-Item -Force (Join-Path $BackendDir "Dockerfile.lambda")

# Check size
$SizeMB = (Get-Item $FinalZip).Length / 1MB
Write-Host ""
Write-Host "Build complete!"
Write-Host "Package size: $([math]::Round($SizeMB, 2)) MB"
Write-Host "Output: $FinalZip"
