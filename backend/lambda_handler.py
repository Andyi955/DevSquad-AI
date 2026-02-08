"""
AWS Lambda handler for DevSquad AI
Converts FastAPI app to Lambda-compatible handler using Mangum
"""
import os
import json
import asyncio

# Set environment variables for Lambda
os.environ['AWS_LAMBDA_FUNCTION'] = 'true'

# Import the FastAPI app
from main import app

# Use Mangum to wrap FastAPI for Lambda
try:
    from mangum import Mangum
    handler = Mangum(app, lifespan="off", api_gateway_base_path="/production")
except ImportError:
    # Fallback handler if mangum not installed
    def handler(event, context):
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"message": "Install mangum for full FastAPI support"})
        }

# Lambda entry point
lambda_handler = handler
