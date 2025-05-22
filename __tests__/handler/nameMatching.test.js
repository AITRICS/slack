// __tests__/handler/nameMatching.test.js

const EventHandler = require('../../handler/eventHandler');
const fetchSlackUserList = require('../../slack/fetchSlackUserList');
const {
  mockSlackMembers, createMockOctokit, createMockSlackWeb, setupDefaultMocks,
} = require('../mocks/commonMocks');

// Mock fetchSlackUserList
jest.mock('../../slack/fetchSlackUserList', () => jest.fn());

describe('EventHandler 이름 매칭 통합 테스트', () => {
  let eventHandler;
  let mockOctokit;
  let mockWeb;
  let mockPostMessage;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOctokit = createMockOctokit();
    mockWeb = createMockSlackWeb();
    mockPostMessage = mockWeb._mockFunctions.mockPostMessage;

    setupDefaultMocks(mockOctokit);
    fetchSlackUserList.mockResolvedValue(mockSlackMembers);

    eventHandler = new EventHandler(mockOctokit, mockWeb);
  });

  describe('Deploy 이벤트를 통한 이름 매칭 확인', () => {
    const createTestContext = (actorLogin) => ({
      payload: {
        repository: {
          name: 'test-repo',
          full_name: 'org/test-repo',
          html_url: 'https://github.com/org/test-repo',
        },
      },
      runId: '123456',
      ref: 'refs/heads/main',
      sha: 'abc123def456',
    });

    beforeEach(() => {
      mockOctokit.actions.getWorkflowRun.mockImplementation(({ run_id }) => Promise.resolve({
        data: {
          name: 'Deploy Workflow',
          html_url: `https://github.com/org/test-repo/actions/runs/${run_id}`,
          run_started_at: '2025-05-22T10:00:00Z',
          actor: { login: 'test-user' }, // 기본값
        },
      }));
    });

    it('실제 Slack 사용자와 매칭되는 GitHub 사용자', async () => {
      // GitHub API에서 실제 이름 반환하도록 설정
      mockOctokit.rest.users.getByUsername.mockResolvedValue({
        data: { name: '최경환', login: 'ray' },
      });

      mockOctokit.actions.getWorkflowRun.mockResolvedValue({
        data: {
          name: 'Deploy Workflow',
          html_url: 'https://github.com/org/test-repo/actions/runs/123456',
          run_started_at: '2025-05-22T10:00:00Z',
          actor: { login: 'ray' }, // 실제 매칭될 사용자
        },
      });

      const context = createTestContext('ray');
      await eventHandler.handleDeploy(context, 'prod-server', 'v1.0.0', 'success');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                title: 'Author',
                value: '<@U12345>', // ray는 mockSlackMembers에서 U12345로 매칭됨
              }),
            ]),
          }),
        ]),
      }));
    });

    it('Slack 사용자와 매칭되지 않는 GitHub 사용자', async () => {
      mockOctokit.rest.users.getByUsername.mockResolvedValue({
        data: { name: '존재하지않는사용자', login: 'unknown-user' },
      });

      mockOctokit.actions.getWorkflowRun.mockResolvedValue({
        data: {
          name: 'Deploy Workflow',
          html_url: 'https://github.com/org/test-repo/actions/runs/123456',
          run_started_at: '2025-05-22T10:00:00Z',
          actor: { login: 'unknown-user' },
        },
      });

      const context = createTestContext('unknown-user');
      await eventHandler.handleDeploy(context, 'prod-server', 'v1.0.0', 'success');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                title: 'Author',
                value: '<@존재하지않는사용자>', // 매칭되지 않아 GitHub 실명 사용
              }),
            ]),
          }),
        ]),
      }));
    });

    it('GitHub API에서 이름이 없는 경우', async () => {
      mockOctokit.rest.users.getByUsername.mockResolvedValue({
        data: { name: null, login: 'no-name-user' },
      });

      mockOctokit.actions.getWorkflowRun.mockResolvedValue({
        data: {
          name: 'Deploy Workflow',
          html_url: 'https://github.com/org/test-repo/actions/runs/123456',
          run_started_at: '2025-05-22T10:00:00Z',
          actor: { login: 'no-name-user' },
        },
      });

      const context = createTestContext('no-name-user');
      await eventHandler.handleDeploy(context, 'prod-server', 'v1.0.0', 'success');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                title: 'Author',
                value: '<@no-name-user>', // name이 null이므로 login 사용
              }),
            ]),
          }),
        ]),
      }));
    });
  });

  describe('다양한 이름 형태 매칭 확인', () => {
    it('한글 이름으로 매칭', async () => {
      // 김철수로 설정된 사용자 테스트
      mockOctokit.rest.users.getByUsername.mockResolvedValue({
        data: { name: '김철수', login: 'kimcs' },
      });

      mockOctokit.actions.getWorkflowRun.mockResolvedValue({
        data: {
          name: 'Deploy Workflow',
          html_url: 'https://github.com/org/test-repo/actions/runs/123456',
          run_started_at: '2025-05-22T10:00:00Z',
          actor: { login: 'kimcs' },
        },
      });

      const context = {
        payload: {
          repository: {
            name: 'test-repo',
            full_name: 'org/test-repo',
            html_url: 'https://github.com/org/test-repo',
          },
        },
        runId: '123456',
        ref: 'refs/heads/main',
        sha: 'abc123def456',
      };

      await eventHandler.handleDeploy(context, 'prod-server', 'v1.0.0', 'success');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                title: 'Author',
                value: '<@U67890>', // 김철수는 U67890으로 매칭
              }),
            ]),
          }),
        ]),
      }));
    });

    it('Display name으로 매칭', async () => {
      // jimin으로 설정된 사용자 테스트 (박지민의 display_name)
      mockOctokit.rest.users.getByUsername.mockResolvedValue({
        data: { name: 'jimin', login: 'jimin-user' },
      });

      mockOctokit.actions.getWorkflowRun.mockResolvedValue({
        data: {
          name: 'Deploy Workflow',
          html_url: 'https://github.com/org/test-repo/actions/runs/123456',
          run_started_at: '2025-05-22T10:00:00Z',
          actor: { login: 'jimin-user' },
        },
      });

      const context = {
        payload: {
          repository: {
            name: 'test-repo',
            full_name: 'org/test-repo',
            html_url: 'https://github.com/org/test-repo',
          },
        },
        runId: '123456',
        ref: 'refs/heads/main',
        sha: 'abc123def456',
      };

      await eventHandler.handleDeploy(context, 'prod-server', 'v1.0.0', 'success');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                title: 'Author',
                value: '<@U11111>', // jimin은 U11111로 매칭
              }),
            ]),
          }),
        ]),
      }));
    });
  });

  describe('SKIP_SLACK_USER 처리 확인', () => {
    it('SKIP_SLACK_USER에 포함된 사용자는 매칭되지 않음', async () => {
      // john (이주호)는 SKIP_SLACK_USER에 포함됨
      mockOctokit.rest.users.getByUsername.mockResolvedValue({
        data: { name: 'john', login: 'john-user' },
      });

      mockOctokit.actions.getWorkflowRun.mockResolvedValue({
        data: {
          name: 'Deploy Workflow',
          html_url: 'https://github.com/org/test-repo/actions/runs/123456',
          run_started_at: '2025-05-22T10:00:00Z',
          actor: { login: 'john-user' },
        },
      });

      const context = {
        payload: {
          repository: {
            name: 'test-repo',
            full_name: 'org/test-repo',
            html_url: 'https://github.com/org/test-repo',
          },
        },
        runId: '123456',
        ref: 'refs/heads/main',
        sha: 'abc123def456',
      };

      await eventHandler.handleDeploy(context, 'prod-server', 'v1.0.0', 'success');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                title: 'Author',
                value: '<@john>', // SKIP 처리되어 원래 이름 사용
              }),
            ]),
          }),
        ]),
      }));
    });
  });
});
