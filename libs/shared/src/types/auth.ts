/**
 * User profile from PocketBase
 */
export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  createdAt: string;
  updated: string;
}

/**
 * JWT token from auth endpoints
 */
export interface AuthToken {
  token: string;
}

/**
 * Request body for user registration
 */
export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

/**
 * Response from registration endpoint
 */
export interface RegisterResponse {
  user: User;
  token: string;
}

/**
 * Request body for login
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Response from login endpoint
 */
export interface LoginResponse {
  user: User;
  token: string;
}

/**
 * Decoded JWT token claims (PocketBase auth token format)
 */
export interface JwtClaims {
  id: string;
  type: string;
  exp: number;
  iat: number;
}

/**
 * Request with authenticated user attached
 */
export interface AuthenticatedRequest {
  user: User;
  claims: JwtClaims;
}
