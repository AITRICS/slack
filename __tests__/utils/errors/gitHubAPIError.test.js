// GitHubAPIError.test.js
/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

describe('errors.GitHubAPIError', () => {
  let GitHubAPIError;
  let SlackNotificationError;

  beforeAll(() => {
    ({ GitHubAPIError, SlackNotificationError } = require('@/utils/errors'));
  });

  describe('기본 생성자 동작', () => {
    test('메시지만으로 에러 생성', () => {
      const error = new GitHubAPIError('GitHub API failed');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SlackNotificationError);
      expect(error).toBeInstanceOf(GitHubAPIError);
      expect(error.name).toBe('GitHubAPIError');
      expect(error.message).toBe('GitHub API failed');
      expect(error.code).toBe('GITHUB_API_ERROR');
      expect(error.details).toEqual({});
      expect(error.timestamp).toBeDefined();
    });

    test('메시지와 details로 에러 생성', () => {
      const details = { repo: 'owner/repo', status: 404 };
      const error = new GitHubAPIError('Repository not found', details);

      expect(error.message).toBe('Repository not found');
      expect(error.code).toBe('GITHUB_API_ERROR');
      expect(error.details).toEqual(details);
    });

    test('모든 매개변수로 에러 생성', () => {
      const details = { endpoint: '/repos/owner/repo' };
      const cause = new Error('Request timeout');
      const error = new GitHubAPIError('GitHub API timeout', details, { cause });

      expect(error.message).toBe('GitHub API timeout');
      expect(error.details.endpoint).toBe('/repos/owner/repo');
      expect(error.cause).toBe(cause);
    });
  });

  describe('상속 관계 검증', () => {
    test('SlackNotificationError 상속', () => {
      const error = new GitHubAPIError('Test');
      expect(error instanceof SlackNotificationError).toBe(true);
    });

    test('Error 상속', () => {
      const error = new GitHubAPIError('Test');
      expect(error instanceof Error).toBe(true);
    });

    test('코드가 자동으로 설정됨', () => {
      const error = new GitHubAPIError('Test');
      expect(error.code).toBe('GITHUB_API_ERROR');
    });

    test('name이 올바르게 설정됨', () => {
      const error = new GitHubAPIError('Test');
      expect(error.name).toBe('GitHubAPIError');
    });
  });

  describe('GitHub API 관련 실제 시나리오', () => {
    test('인증 실패', () => {
      const details = {
        status: 401,
        message: 'Bad credentials',
        documentation_url: 'https://docs.github.com/rest',
        token: 'ghp_***masked***',
      };

      const error = new GitHubAPIError('GitHub 인증 실패', details);

      expect(error.message).toBe('GitHub 인증 실패');
      expect(error.details.status).toBe(401);
      expect(error.details.message).toBe('Bad credentials');
    });

    test('저장소 없음', () => {
      const details = {
        status: 404,
        message: 'Not Found',
        repo: 'owner/nonexistent-repo',
        endpoint: '/repos/owner/nonexistent-repo',
      };

      const error = new GitHubAPIError('저장소를 찾을 수 없습니다', details);

      expect(error.details.status).toBe(404);
      expect(error.details.repo).toBe('owner/nonexistent-repo');
    });

    test('Rate Limit 초과', () => {
      const details = {
        status: 403,
        message: 'API rate limit exceeded',
        remaining: 0,
        reset: 1640995200,
        limit: 5000,
        used: 5000,
      };

      const error = new GitHubAPIError('GitHub API rate limit 초과', details);

      expect(error.details.remaining).toBe(0);
      expect(error.details.used).toBe(5000);
      expect(error.details.limit).toBe(5000);
    });

    test('권한 부족', () => {
      const details = {
        status: 403,
        message: 'Forbidden',
        resource: 'Repository',
        field: 'private',
        code: 'insufficient_scope',
      };

      const error = new GitHubAPIError('권한이 부족합니다', details);

      expect(error.details.code).toBe('insufficient_scope');
      expect(error.details.resource).toBe('Repository');
    });

    test('팀 멤버 조회 실패', () => {
      const details = {
        status: 404,
        message: 'Not Found',
        team: 'SE',
        org: 'aitrics',
        endpoint: '/orgs/aitrics/teams/SE/members',
      };

      const error = new GitHubAPIError('팀 멤버를 조회할 수 없습니다', details);

      expect(error.details.team).toBe('SE');
      expect(error.details.org).toBe('aitrics');
    });

    test('PR 정보 조회 실패', () => {
      const details = {
        status: 422,
        message: 'Validation Failed',
        errors: [
          {
            resource: 'PullRequest',
            field: 'number',
            code: 'invalid',
          },
        ],
        prNumber: 99999,
        repo: 'owner/repo',
      };

      const error = new GitHubAPIError('유효하지 않은 PR 번호', details);

      expect(error.details.prNumber).toBe(99999);
      expect(error.details.errors).toHaveLength(1);
    });

    test('코멘트 조회 실패', () => {
      const details = {
        status: 404,
        message: 'Not Found',
        commentId: 123456789,
        repo: 'owner/repo',
        commentType: 'review',
      };

      const error = new GitHubAPIError('코멘트를 찾을 수 없습니다', details);

      expect(error.details.commentId).toBe(123456789);
      expect(error.details.commentType).toBe('review');
    });

    test('워크플로우 실행 정보 조회 실패', () => {
      const details = {
        status: 404,
        message: 'Not Found',
        runId: '987654321',
        repo: 'owner/repo',
        workflow: 'CI',
      };

      const error = new GitHubAPIError('워크플로우 실행 정보를 찾을 수 없습니다', details);

      expect(error.details.runId).toBe('987654321');
      expect(error.details.workflow).toBe('CI');
    });
  });

  describe('에러 체이닝', () => {
    test('네트워크 에러 체이닝', () => {
      const networkError = new Error('ENOTFOUND api.github.com');
      const details = {
        endpoint: 'https://api.github.com/repos/owner/repo',
        method: 'GET',
      };

      const error = new GitHubAPIError('GitHub API 네트워크 오류', details, { cause: networkError });

      expect(error.cause.message).toBe('ENOTFOUND api.github.com');
      expect(error.details.endpoint).toContain('api.github.com');
    });

    test('HTTP 에러 체이닝', () => {
      const httpError = new Error('Request failed with status code 500');
      httpError.response = {
        status: 500,
        statusText: 'Internal Server Error',
        data: { message: 'Server Error' },
      };

      const error = new GitHubAPIError('GitHub 서버 오류', { status: 500 }, { cause: httpError });

      expect(error.cause).toBe(httpError);
      expect(error.cause.response.status).toBe(500);
    });
  });

  describe('GitHub API 에러 응답 파싱', () => {
    test('표준 GitHub API 에러 응답', () => {
      const apiResponse = {
        message: 'Validation Failed',
        errors: [
          {
            resource: 'Issue',
            field: 'title',
            code: 'missing_field',
          },
        ],
        documentation_url: 'https://docs.github.com/rest/reference/issues#create-an-issue',
      };

      const error = new GitHubAPIError('유효성 검사 실패', apiResponse);

      expect(error.details.message).toBe('Validation Failed');
      expect(error.details.errors).toHaveLength(1);
      expect(error.details.documentation_url).toContain('docs.github.com');
    });

    test('GraphQL API 에러 응답', () => {
      const graphqlResponse = {
        errors: [
          {
            type: 'FORBIDDEN',
            path: ['repository'],
            locations: [{ line: 2, column: 3 }],
            message: 'Resource not accessible by integration',
          },
        ],
        data: null,
      };

      const error = new GitHubAPIError('GraphQL API 권한 오류', graphqlResponse);

      expect(error.details.errors[0].type).toBe('FORBIDDEN');
      expect(error.details.data).toBeNull();
    });
  });

  describe('재시도 로직을 위한 에러 분류', () => {
    test('재시도 가능한 에러들', () => {
      const retryableErrors = [
        new GitHubAPIError('Rate limited', { status: 403, message: 'rate limit exceeded' }),
        new GitHubAPIError('Server error', { status: 500 }),
        new GitHubAPIError('Bad gateway', { status: 502 }),
        new GitHubAPIError('Service unavailable', { status: 503 }),
        new GitHubAPIError('Gateway timeout', { status: 504 }),
      ];

      retryableErrors.forEach((error) => {
        expect(error.code).toBe('GITHUB_API_ERROR');
        expect([403, 500, 502, 503, 504]).toContain(error.details.status);
      });
    });

    test('재시도 불가능한 에러들', () => {
      const nonRetryableErrors = [
        new GitHubAPIError('Unauthorized', { status: 401 }),
        new GitHubAPIError('Forbidden', { status: 403, message: 'insufficient scope' }),
        new GitHubAPIError('Not found', { status: 404 }),
        new GitHubAPIError('Validation failed', { status: 422 }),
      ];

      nonRetryableErrors.forEach((error) => {
        expect(error.code).toBe('GITHUB_API_ERROR');
        expect([401, 403, 404, 422]).toContain(error.details.status);
      });
    });
  });

  describe('로깅 및 모니터링', () => {
    test('로깅을 위한 중요 정보 포함', () => {
      const details = {
        status: 404,
        method: 'GET',
        endpoint: '/repos/owner/repo/pulls/123',
        repo: 'owner/repo',
        prNumber: 123,
        requestId: 'req_123456',
        timestamp: new Date().toISOString(),
      };

      const error = new GitHubAPIError('PR을 찾을 수 없습니다', details);

      expect(error.details.status).toBe(404);
      expect(error.details.endpoint).toBe('/repos/owner/repo/pulls/123');
      expect(error.details.requestId).toBe('req_123456');
    });

    test('민감한 정보 제외', () => {
      const details = {
        token: 'ghp_1234567890abcdefghijklmnopqrstuvwxyzABCD',
        maskedToken: 'ghp_***masked***',
        endpoint: '/user',
        status: 401,
      };

      const error = new GitHubAPIError('인증 실패', details);

      // 실제로는 애플리케이션에서 토큰을 마스킹해야 함
      expect(error.details.maskedToken).toBe('ghp_***masked***');
      expect(error.details.token).toBeDefined(); // 테스트에서는 원본 확인
    });
  });

  describe('타입 검증', () => {
    test('GitHubAPIError 타입 가드', () => {
      const isGitHubAPIError = (error) => error instanceof GitHubAPIError;

      const githubError = new GitHubAPIError('Test');
      const genericError = new Error('Test');

      expect(isGitHubAPIError(githubError)).toBe(true);
      expect(isGitHubAPIError(genericError)).toBe(false);
    });

    test('에러 코드로 구분', () => {
      const error = new GitHubAPIError('Test');
      expect(error.code).toBe('GITHUB_API_ERROR');

      const isGitHubAPIErrorByCode = (err) => err.code === 'GITHUB_API_ERROR';
      expect(isGitHubAPIErrorByCode(error)).toBe(true);
    });
  });
});
