/**
 * Frontend Deployment Script for AWS S3 + CloudFront
 * Usage: node deploy.js <bucket-name> [cloudfront-distribution-id]
 */
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mime from 'mime-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'eu-west-1' });
const cloudFrontClient = new CloudFrontClient({ region: 'us-east-1' }); // CloudFront is always us-east-1

async function emptyBucket(bucketName) {
  console.log(`🗑️  Emptying bucket: ${bucketName}`);
  
  const listCommand = new ListObjectsV2Command({ Bucket: bucketName });
  const { Contents } = await s3Client.send(listCommand);
  
  if (Contents && Contents.length > 0) {
    for (const object of Contents) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: object.Key
      });
      await s3Client.send(deleteCommand);
    }
    console.log(`   Deleted ${Contents.length} objects`);
  }
}

async function uploadDirectory(bucketName, directory, prefix = '') {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const key = prefix ? `${prefix}/${file}` : file;
    
    if (fs.statSync(filePath).isDirectory()) {
      await uploadDirectory(bucketName, filePath, key);
    } else {
      const content = fs.readFileSync(filePath);
      const contentType = mime.lookup(filePath) || 'application/octet-stream';
      
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: content,
        ContentType: contentType,
        CacheControl: file.endsWith('.html') ? 'no-cache' : 'max-age=31536000'
      });
      
      await s3Client.send(command);
      console.log(`   Uploaded: ${key}`);
    }
  }
}

async function invalidateCloudFront(distributionId) {
  console.log(`🔄 Invalidating CloudFront distribution: ${distributionId}`);
  
  const command = new CreateInvalidationCommand({
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: {
        Quantity: 1,
        Items: ['/*']
      }
    }
  });
  
  await cloudFrontClient.send(command);
  console.log('   Invalidation created');
}

async function deploy() {
  const bucketName = process.argv[2];
  const distributionId = process.argv[3];
  
  if (!bucketName) {
    console.error('❌ Usage: node deploy.js <bucket-name> [cloudfront-distribution-id]');
    process.exit(1);
  }
  
  const buildDir = path.join(__dirname, 'dist');
  
  if (!fs.existsSync(buildDir)) {
    console.error('❌ Build directory not found. Run "npm run build" first.');
    process.exit(1);
  }
  
  console.log('🚀 Starting deployment...\n');
  
  try {
    await emptyBucket(bucketName);
    console.log('📤 Uploading files...');
    await uploadDirectory(bucketName, buildDir);
    
    if (distributionId) {
      await invalidateCloudFront(distributionId);
    }
    
    console.log('\n✅ Deployment complete!');
    console.log(`🌐 Website URL: http://${bucketName}.s3-website-${process.env.AWS_REGION || 'eu-west-1'}.amazonaws.com`);
  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  }
}

deploy();
