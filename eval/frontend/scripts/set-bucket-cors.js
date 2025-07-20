const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env files
function loadEnvFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const envContent = fs.readFileSync(filePath, 'utf8')
      envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim()
          if (!process.env[key]) { // Don't override existing env vars
            process.env[key] = value
          }
        }
      })
      console.log(`✅ Loaded environment from: ${filePath}`)
    }
  } catch (error) {
    console.log(`⚠️  Could not load ${filePath}: ${error.message}`)
  }
}

// Load .env files in order of preference
loadEnvFile(path.join(__dirname, '../.env.local'))
loadEnvFile(path.join(__dirname, '../.env.development'))
loadEnvFile(path.join(__dirname, '../.env'))

const client = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL_S3 || 'https://fly.storage.tigris.dev',
  region: process.env.AWS_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
})

const bucketName = process.env.TIGRIS_BUCKET_NAME || 'eval-data'

const corsConfiguration = {
  CORSRules: [
    {
      AllowedOrigins: [
        'http://localhost:3000',
        'https://owl-eval-yymd.vercel.app',  // production
        'https://owl-eval-dev.vercel.app',   // dev
        'https://owl-eval-zeta.vercel.app',  // another dev instance
        'https://*.vercel.app'               // any vercel deployment
      ],
      AllowedMethods: ['GET', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3000
    }
  ]
}

async function setBucketCors() {
  try {
    console.log(`\nSetting CORS configuration for bucket: ${bucketName}`)
    console.log(`Endpoint: ${process.env.AWS_ENDPOINT_URL_S3}`)
    
    // Check required environment variables
    const requiredVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
    const missingVars = requiredVars.filter(varName => !process.env[varName])
    
    if (missingVars.length > 0) {
      console.error(`\n❌ Missing required environment variables: ${missingVars.join(', ')}`)
      process.exit(1)
    }
    
    console.log('\nCORS configuration to apply:')
    console.log(JSON.stringify(corsConfiguration, null, 2))
    
    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsConfiguration
    })

    await client.send(command)
    
    console.log('\n✅ CORS configuration applied successfully!')
    console.log('\nAllowed origins:')
    corsConfiguration.CORSRules[0].AllowedOrigins.forEach(origin => {
      console.log(`- ${origin}`)
    })
    
  } catch (error) {
    console.error('❌ Failed to set CORS configuration:', error)
    
    if (error.name === 'NoSuchBucket') {
      console.log(`\n💡 Bucket "${bucketName}" doesn't exist. Create it first.`)
    } else if (error.name === 'InvalidAccessKeyId') {
      console.log('\n💡 Check your AWS_ACCESS_KEY_ID in .env file')
    } else if (error.name === 'SignatureDoesNotMatch') {
      console.log('\n💡 Check your AWS_SECRET_ACCESS_KEY in .env file')
    }
    
    process.exit(1)
  }
}

setBucketCors()