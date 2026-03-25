export interface BaseRecord {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalPages: number;
  page: number;
}
