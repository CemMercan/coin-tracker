import { MongoClient } from 'mongodb'

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined')
}

if (!process.env.MONGODB_DB) {
  throw new Error('MONGODB_DB is not defined')
}

let cachedClient: MongoClient | null = null
let cachedDb: any = null

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb }
  }

  const client = await MongoClient.connect(process.env.MONGODB_URI as string)
  const db = client.db(process.env.MONGODB_DB)

  cachedClient = client
  cachedDb = db

  return { client, db }
} 