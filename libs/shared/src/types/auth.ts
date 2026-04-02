import type { BaseRecord } from './base';

/**
 * User record from users table
 */
export interface UserRecord extends BaseRecord {
  email: string;
  username: string;
  name?: string;
  avatar: string;
}

/**
 * User profile for API responses (subset of UserRecord)
 */
export type User = Pick<
  UserRecord,
  'id' | 'email' | 'username' | 'avatar' | 'created_at' | 'updated_at'
>;

// Keep request/response types — these are API contracts, not PB records
export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Combine Register/Login responses since they're identical
export type RegisterResponse = AuthResponse;
export type LoginResponse = AuthResponse;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  username?: string;
  name?: string;
  avatar?: string;
}

export interface UpdateProfileResponse {
  user: User;
}

export interface AvatarUploadResponse {
  url: string;
}
