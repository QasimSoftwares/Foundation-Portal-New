export type TransformedRequest = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  notes: string | null;
  request_type: string;
};
