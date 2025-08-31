import { NextApiResponse } from 'next';
import { ApiResponse } from '@/types/api';

export const createApiResponse = <T>(
  res: NextApiResponse,
  status: number,
  data?: T,
  error?: { code: string; message: string; details?: any }
): void => {
  const response: ApiResponse<T> = {
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
    },
  };

  if (error) {
    response.error = error;
  } else if (data) {
    response.data = data;
  }

  res.status(status).json(response);
};

export const handleApiError = (
  res: NextApiResponse,
  error: any,
  defaultMessage = 'An unexpected error occurred'
): void => {
  console.error('API Error:', error);
  
  if (error.status && error.message) {
    return createApiResponse(res, error.status, undefined, {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      details: error.details,
    });
  }

  createApiResponse(res, 500, undefined, {
    code: 'INTERNAL_SERVER_ERROR',
    message: defaultMessage,
  });
};
