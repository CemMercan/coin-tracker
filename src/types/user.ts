export interface User {
  id: string
  username: string
  password: string
}

export interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}

export interface RegisterRequest {
  username: string
  password: string
} 