"""
AWS Services Integration for DevSquad AI
Handles DynamoDB, S3, and other AWS service interactions
"""
import os
import json
import boto3
from datetime import datetime
from typing import Optional, Dict, Any, List
from botocore.exceptions import ClientError

# Initialize AWS clients
_dynamodb = None
_s3 = None
_dynamodb_table = None

def get_dynamodb_client():
    """Get or create DynamoDB client"""
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource('dynamodb')
    return _dynamodb

def get_s3_client():
    """Get or create S3 client"""
    global _s3
    if _s3 is None:
        _s3 = boto3.client('s3')
    return _s3

def get_sessions_table():
    """Get DynamoDB sessions table"""
    global _dynamodb_table
    if _dynamodb_table is None:
        table_name = os.getenv('DYNAMODB_TABLE', 'devsquad-sessions')
        _dynamodb_table = get_dynamodb_client().Table(table_name)
    return _dynamodb_table


class SessionStore:
    """DynamoDB-based session storage for chat history"""
    
    @staticmethod
    async def save_session(session_id: str, data: Dict[str, Any]) -> bool:
        """Save session data to DynamoDB"""
        try:
            table = get_sessions_table()
            item = {
                'session_id': session_id,
                'timestamp': datetime.utcnow().isoformat(),
                'data': json.dumps(data),
                'ttl': int(datetime.utcnow().timestamp()) + (7 * 24 * 60 * 60)  # 7 days TTL
            }
            table.put_item(Item=item)
            return True
        except ClientError as e:
            print(f"Error saving session: {e}")
            return False
    
    @staticmethod
    async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session data from DynamoDB"""
        try:
            table = get_sessions_table()
            response = table.get_item(Key={'session_id': session_id})
            item = response.get('Item')
            if item:
                return json.loads(item['data'])
            return None
        except ClientError as e:
            print(f"Error getting session: {e}")
            return None
    
    @staticmethod
    async def list_sessions(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all sessions, optionally filtered by user"""
        try:
            table = get_sessions_table()
            if user_id:
                # Query by user_id if GSI exists
                response = table.scan(
                    FilterExpression='contains(data, :user_id)',
                    ExpressionAttributeValues={':user_id': user_id}
                )
            else:
                response = table.scan(Limit=50)
            
            sessions = []
            for item in response.get('Items', []):
                try:
                    data = json.loads(item['data'])
                    sessions.append({
                        'session_id': item['session_id'],
                        'timestamp': item['timestamp'],
                        'preview': data.get('messages', [{}])[0].get('content', 'No preview')[:100]
                    })
                except:
                    continue
            return sessions
        except ClientError as e:
            print(f"Error listing sessions: {e}")
            return []
    
    @staticmethod
    async def delete_session(session_id: str) -> bool:
        """Delete a session from DynamoDB"""
        try:
            table = get_sessions_table()
            table.delete_item(Key={'session_id': session_id})
            return True
        except ClientError as e:
            print(f"Error deleting session: {e}")
            return False


class S3Storage:
    """S3 storage for file uploads and project persistence"""
    
    @staticmethod
    def get_bucket_name() -> str:
        """Get S3 bucket name from environment"""
        return os.getenv('S3_BUCKET', 'devsquad-ai-projects')
    
    @staticmethod
    async def upload_file(key: str, content: bytes, content_type: str = 'application/octet-stream') -> bool:
        """Upload a file to S3"""
        try:
            s3 = get_s3_client()
            bucket = S3Storage.get_bucket_name()
            s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=content,
                ContentType=content_type
            )
            return True
        except ClientError as e:
            print(f"Error uploading to S3: {e}")
            return False
    
    @staticmethod
    async def download_file(key: str) -> Optional[bytes]:
        """Download a file from S3"""
        try:
            s3 = get_s3_client()
            bucket = S3Storage.get_bucket_name()
            response = s3.get_object(Bucket=bucket, Key=key)
            return response['Body'].read()
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                return None
            print(f"Error downloading from S3: {e}")
            return None
    
    @staticmethod
    async def list_files(prefix: str = '') -> List[Dict[str, Any]]:
        """List files in S3 bucket with optional prefix"""
        try:
            s3 = get_s3_client()
            bucket = S3Storage.get_bucket_name()
            response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
            
            files = []
            for obj in response.get('Contents', []):
                files.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat()
                })
            return files
        except ClientError as e:
            print(f"Error listing S3 files: {e}")
            return []
    
    @staticmethod
    async def delete_file(key: str) -> bool:
        """Delete a file from S3"""
        try:
            s3 = get_s3_client()
            bucket = S3Storage.get_bucket_name()
            s3.delete_object(Bucket=bucket, Key=key)
            return True
        except ClientError as e:
            print(f"Error deleting from S3: {e}")
            return False
    
    @staticmethod
    def get_presigned_url(key: str, expiration: int = 3600) -> Optional[str]:
        """Generate a presigned URL for temporary access"""
        try:
            s3 = get_s3_client()
            bucket = S3Storage.get_bucket_name()
            url = s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': key},
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            print(f"Error generating presigned URL: {e}")
            return None


class UsageTrackerAWS:
    """AWS-enhanced usage tracking with CloudWatch metrics"""
    
    @staticmethod
    async def log_metric(metric_name: str, value: float, unit: str = 'Count'):
        """Log custom metric to CloudWatch"""
        try:
            cloudwatch = boto3.client('cloudwatch')
            cloudwatch.put_metric_data(
                Namespace='DevSquadAI',
                MetricData=[{
                    'MetricName': metric_name,
                    'Value': value,
                    'Unit': unit,
                    'Timestamp': datetime.utcnow()
                }]
            )
        except Exception as e:
            print(f"Error logging metric: {e}")
    
    @staticmethod
    async def track_api_call(agent_type: str, tokens_used: int = 0):
        """Track an API call for usage monitoring"""
        await UsageTrackerAWS.log_metric(f'APICalls_{agent_type}', 1)
        if tokens_used > 0:
            await UsageTrackerAWS.log_metric(f'Tokens_{agent_type}', tokens_used, 'Count')


class RateLimiter:
    """Simple rate limiter using DynamoDB to prevent API abuse"""
    
    @staticmethod
    async def is_allowed(source_ip: str, limit: int = 50) -> bool:
        """
        Checks if the IP has exceeded its daily limit.
        Uses the devsquad-sessions table with 'ip:' prefix.
        """
        if os.getenv('ENVIRONMENT') != 'production':
            return True # No limit in dev
            
        try:
            table = get_sessions_table()
            today = datetime.utcnow().strftime('%Y-%m-%d')
            key = f"limit:{source_ip}:{today}"
            
            response = table.get_item(Key={'session_id': key})
            item = response.get('Item')
            
            if not item:
                # First request today
                table.put_item(Item={
                    'session_id': key,
                    'count': 1,
                    'timestamp': datetime.utcnow().isoformat(),
                    'ttl': int(datetime.utcnow().timestamp()) + (24 * 60 * 60)
                })
                return True
            
            count = item.get('count', 0)
            if count >= limit:
                return False
                
            # Increment count
            table.update_item(
                Key={'session_id': key},
                UpdateExpression="set #c = #c + :val",
                ExpressionAttributeNames={'#c': 'count'},
                ExpressionAttributeValues={':val': 1}
            )
            return True
        except Exception as e:
            print(f"Rate limit error: {e}")
            return True # Fail open to not block users on DB errors


# Health check for AWS services
async def check_aws_health() -> Dict[str, Any]:
    """Check health of AWS services"""
    health = {
        'dynamodb': False,
        's3': False,
        'errors': []
    }
    
    # Check DynamoDB
    try:
        table = get_sessions_table()
        table.table_status
        health['dynamodb'] = True
    except Exception as e:
        health['errors'].append(f"DynamoDB: {str(e)}")
    
    # Check S3
    try:
        s3 = get_s3_client()
        s3.head_bucket(Bucket=S3Storage.get_bucket_name())
        health['s3'] = True
    except Exception as e:
        health['errors'].append(f"S3: {str(e)}")
    
    return health
