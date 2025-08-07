export type UserRole = 'GM' | 'Staff' | 'SuperAdmin';
export interface CommandLog {
  id: string;
  restaurantId: string;
  role: UserRole;
  target: string;
  message: string;
  status: 'enviado' | 'error' | 'retry';
  errorMessage?: string;
  createdAt: string;
  updatedAt?: string;
}