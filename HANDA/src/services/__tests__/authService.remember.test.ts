import { AuthService } from '../authService';
import * as ApiClient from '../apiClient';

jest.mock('../apiClient', () => {
  class ApiReadinessError extends Error {}

  return {
    API_BASE_URL: 'https://handa.test',
    ApiReadinessError,
    authenticatedFetch: jest.fn(),
    clearAccessToken: jest.fn(),
    clearRefreshToken: jest.fn(),
    createPersistentRefreshToken: jest.fn(),
    fetchWithRetry: jest.fn(),
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    setAccessToken: jest.fn(),
    setRefreshToken: jest.fn(),
    warmUpServer: jest.fn(),
  };
});

describe('remembered sign-in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ApiClient.warmUpServer).mockResolvedValue(undefined);
    jest.mocked(ApiClient.createPersistentRefreshToken).mockResolvedValue('persistent-refresh-token');
    jest.mocked(ApiClient.fetchWithRetry).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: 'access-token',
        user: { id: 'resident-1', role: 'resident' },
      }),
    } as Response);
  });

  it('creates and stores a persistent credential when remember is selected but the API omits one', async () => {
    await AuthService.login('resident@example.com', 'password', ['resident'], true);

    expect(ApiClient.fetchWithRetry).toHaveBeenCalledWith(
      'https://handa.test/api/v1/auth/login',
      expect.objectContaining({
        body: JSON.stringify({ email: 'resident@example.com', password: 'password', keepLoggedIn: true }),
      }),
    );
    expect(ApiClient.createPersistentRefreshToken).toHaveBeenCalledWith('access-token');
    expect(ApiClient.setRefreshToken).toHaveBeenCalledWith('persistent-refresh-token');
  });

  it('removes a stale remembered credential when remember is not selected', async () => {
    await AuthService.login('resident@example.com', 'password', ['resident'], false);

    expect(ApiClient.setAccessToken).toHaveBeenCalledWith('access-token', false);
    expect(ApiClient.clearRefreshToken).toHaveBeenCalled();
    expect(ApiClient.createPersistentRefreshToken).not.toHaveBeenCalled();
  });
});
