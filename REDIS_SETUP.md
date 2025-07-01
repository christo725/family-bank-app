# Upstash Redis Setup Instructions

This app now uses Upstash Redis for persistent data storage to prevent data loss when the serverless function sleeps. (Vercel KV has been migrated to use Upstash as the underlying provider)

## Setup Steps

### Option 1: Through Vercel Marketplace (Recommended)

1. Go to your Vercel project dashboard
2. Navigate to the "Storage" tab or "Integrations" tab
3. Click "Browse Marketplace"
4. Search for "Upstash Redis" 
5. Click "Add Integration"
6. Follow the setup wizard to create a new Redis database
7. The integration will automatically add environment variables to your project

### Option 2: Direct Upstash Setup

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a free account if you don't have one
3. Click "Create Database"
4. Choose "Redis" as the type
5. Select your region (choose closest to your Vercel deployment)
6. Create the database
7. Copy the REST URL and REST Token from the database details

### 3. Environment Variables

The app requires these environment variables (automatically added if using Vercel integration):
- `UPSTASH_REDIS_REST_URL` - Your Redis REST endpoint
- `UPSTASH_REDIS_REST_TOKEN` - Your Redis REST authentication token

If setting up manually:
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add both variables for Production, Preview, and Development environments

### 4. Deploy Your Updated App

1. Commit and push the changes to your repository
2. Vercel will automatically redeploy with the new Redis integration
3. The app will automatically migrate existing data from the JSON file to Redis on first run

## Local Development

For local development, the app will continue to use file-based storage (`data/bank_account_data.json`) when Redis environment variables are not present.

To test with Redis locally:
1. Copy the environment variables from your Vercel project settings or Upstash console
2. Create a `.env.local` file in your project root
3. Add the Redis environment variables:
   ```
   UPSTASH_REDIS_REST_URL=your_redis_url_here
   UPSTASH_REDIS_REST_TOKEN=your_redis_token_here
   ```
4. Run `npm install` to install dependencies
5. Run `npm start` to start the server

## Data Migration

The app includes automatic migration:
- On first startup with Redis configured, it will check for existing data in `data/bank_account_data.json`
- If found, it will automatically migrate this data to Redis
- Once migrated, all data operations will use Redis storage

## Monitoring

You can monitor your Redis usage:
- In Upstash Console: View detailed metrics, commands, and usage
- In Vercel Dashboard: If using the integration, basic metrics are shown

## Troubleshooting

1. **Data not persisting**: Ensure Redis environment variables are properly set in your Vercel project
2. **Migration issues**: Check server logs for migration errors
3. **Local development**: Make sure you're not accidentally using production Redis credentials locally
4. **Connection errors**: Verify your Redis URL and token are correct

## Free Tier Limits

Upstash Redis free tier includes:
- 10,000 commands per day
- 256 MB storage
- Durable storage (data persists)
- SSL/TLS encryption

This should be more than sufficient for a family banking app.