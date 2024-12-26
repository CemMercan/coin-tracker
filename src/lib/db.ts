import { User } from "@/types/user"
import { connectToDatabase } from "./mongodb"
import { ObjectId } from "mongodb"

export class Database {
  async createUser(username: string, password: string): Promise<User> {
    const { db } = await connectToDatabase()
    const collection = db.collection("users")

    // Kullanıcı adı kontrolü
    const existingUser = await collection.findOne({ username })
    if (existingUser) {
      throw new Error("Bu kullanıcı adı zaten kullanılıyor")
    }

    // Yeni kullanıcı oluşturma
    const result = await collection.insertOne({
      username,
      password, // Gerçek uygulamada şifreyi hashleyin!
      createdAt: new Date(),
    })

    return {
      id: result.insertedId.toString(),
      username,
      password,
    }
  }

  async getUser(username: string): Promise<User | null> {
    const { db } = await connectToDatabase()
    const collection = db.collection("users")
    
    const user = await collection.findOne({ username })
    if (!user) return null

    return {
      id: user._id.toString(),
      username: user.username,
      password: user.password,
    }
  }

  async validateUser(username: string, password: string): Promise<boolean> {
    const { db } = await connectToDatabase()
    const collection = db.collection("users")
    
    const user = await collection.findOne({ username, password })
    return !!user
  }
}

// Singleton instance
export const db = new Database() 