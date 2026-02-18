// frontend/src/types/auth.types.ts

/**
 * Rôles utilisateur dans l'application
 */
export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'FLEET_MANAGER' 
  | 'STATION_MANAGER' 
  | 'FUEL_OPERATOR' 
  | 'VIEWER';

/**
 * Interface utilisateur
 */
export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  last_login?: string;
  created_at?: string;
}

/**
 * Credentials de connexion
 */
export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

/**
 * Réponse d'authentification
 */
export interface AuthResponse {
  user: User;
  token: string;
  expires_in?: number;
  token_type?: string;
}

/**
 * État du store d'authentification
 */
export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fonctionnalité affichée dans le panneau d'information
 */
export interface Feature {
  id: number;
  icon: string;
  title: string;
  description: string;
  color: string;
  gradient?: string;
  animationDelay?: string;
}

/**
 * Règle de validation pour les champs de formulaire
 */
export interface ValidationRule {
  type: 'required' | 'email' | 'minLength' | 'maxLength' | 'pattern';
  value?: number | RegExp;
  message: string;
}

/**
 * État d'un champ de formulaire
 */
export interface FormField<T = string> {
  value: T;
  error: string | null;
  touched: boolean;
  focused: boolean;
  rules: ValidationRule[];
}