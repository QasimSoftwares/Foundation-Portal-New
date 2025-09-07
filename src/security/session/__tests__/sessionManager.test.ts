import { describe, it, expect, beforeEach, afterEach, vi, Mocked } from 'vitest';
import { SessionManager, sessionManager } from '../sessionManager';
import { createClient } from '@supabase/supabase-js';
import { Session } from '@supabase/supabase-js';

// Mock the Supabase client
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      auth: {
        getUser: vi.fn(),
        refreshSession: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      data: { user: { id: 'test-user-id' } },
      error: null,
    })),
  };
});

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockSupabase: any;

  beforeEach(() => {
    // Create a new instance of SessionManager for each test
    sessionManager = new SessionManager({
      accessTokenCookieName: 'test-access-token',
      refreshTokenCookieName: 'test-refresh-token',
      accessTokenMaxAge: 3600,
      refreshTokenMaxAge: 604800,
      secureCookies: false,
      sameSite: 'lax',
    });

    // Get the mocked Supabase client
    mockSupabase = createClient('test-url', 'test-key');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('startSession', () => {
    it('should create a new session and return session data', async () => {
      // Mock the session data
      const mockSession = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        user: { id: 'test-user-id' },
      } as unknown as Session;

      // Mock the Supabase response
      mockSupabase.from('sessions').insert.mockResolvedValueOnce({
        data: { id: 'test-session-id' },
        error: null,
      });

      mockSupabase.from('refresh_tokens').insert.mockResolvedValueOnce({
        data: { id: 'test-token-id' },
        error: null,
      });

      // Call the method
      const result = await sessionManager.startSession({
        userId: 'test-user-id',
        session: mockSession,
        ip: '127.0.0.1',
        userAgent: 'test-user-agent',
        deviceInfo: {
          type: 'desktop',
          os: 'Windows',
          browser: 'Chrome',
          isMobile: false,
          isTablet: false,
          isDesktop: true,
          isBot: false,
        },
      });

      // Assertions
      expect(result).toEqual({
        sessionId: 'test-session-id',
        refreshTokenId: 'test-token-id',
      });

      // Verify session was created
      expect(mockSupabase.from('sessions').insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'test-user-id',
          ip: '127.0.0.1',
          user_agent: 'test-user-agent',
          device_type: 'desktop',
          device_os: 'Windows',
          device_browser: 'Chrome',
          is_mobile: false,
          is_tablet: false,
          is_desktop: true,
          is_bot: false,
        })
      );
    });

    it('should throw an error if refresh token is missing', async () => {
      const mockSession = {
        access_token: 'test-access-token',
        // No refresh_token
        user: { id: 'test-user-id' },
      } as unknown as Session;

      await expect(
        sessionManager.startSession({
          userId: 'test-user-id',
          session: mockSession,
        })
      ).rejects.toThrow('Missing refresh token in session');
    });
  });

  describe('enforceSessionLimit', () => {
    it('should not revoke sessions if under the limit', async () => {
      // Mock the count response to be under the limit
      mockSupabase.from('sessions').select.mockReturnValueOnce({
        data: [],
        count: 2, // Under the default limit of 5
        error: null,
      });

      await sessionManager['enforceSessionLimit']('test-user-id', 'new-session-id');

      // Should not try to revoke any sessions
      expect(mockSupabase.from('sessions').update).not.toHaveBeenCalled();
    });

    it('should revoke oldest sessions if over the limit', async () => {
      // Mock the count response to be over the limit
      mockSupabase.from('sessions').select.mockReturnValueOnce({
        data: [],
        count: 6, // Over the default limit of 5
        error: null,
      });

      // Mock the sessions to revoke
      mockSupabase.from('sessions').select.mockReturnValueOnce({
        data: [
          { id: 'old-session-1' },
          { id: 'old-session-2' },
        ],
        error: null,
      });

      await sessionManager['enforceSessionLimit']('test-user-id', 'new-session-id');

      // Should revoke the oldest sessions
      expect(mockSupabase.from('sessions').update).toHaveBeenCalledWith(
        expect.objectContaining({
          revoked_at: expect.any(String),
          revoked_reason: 'concurrent_session_limit',
        })
      );
    });
  });

  describe('clearSessionCookies', () => {
    it('should clear session cookies', async () => {
      const mockResponse = {
        cookies: {
          set: vi.fn(),
        },
      };

      await sessionManager.clearSessionCookies(
        mockResponse as any,
        'test-user-id',
        '127.0.0.1',
        'test-user-agent'
      );

      // Should clear both access and refresh token cookies
      expect(mockResponse.cookies.set).toHaveBeenCalledTimes(2);
      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-access-token',
          value: '',
          expires: expect.any(Date),
        })
      );
      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-refresh-token',
          value: '',
          expires: expect.any(Date),
        })
      );
    });
  });
});
