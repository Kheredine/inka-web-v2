import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Parse .env.local manually (no dotenv dependency needed)
const envPath = resolve(__dirname, '../.env.local')
const env = {}
try {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  })
} catch {
  console.error('Could not read .env.local')
  process.exit(1)
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
})

const command = new PutBucketCorsCommand({
  Bucket: env.R2_BUCKET_NAME,
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedOrigins: ['*'],
        AllowedMethods: ['PUT', 'GET', 'HEAD'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      },
    ],
  },
})

try {
  await r2.send(command)
  console.log(`✓ CORS configured on bucket "${env.R2_BUCKET_NAME}"`)
} catch (err) {
  console.error('✗ Failed:', err.message)
  process.exit(1)
}
