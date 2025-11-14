const DeploymentEventHandler = require('../../handler/deploymentEventHandler');
const { PayloadValidationError } = require('../../utils/errors');

describe('DeploymentEventHandler', () => {
  let handler;
  let mockServices;
  let mockContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServices = {
      gitHubApiHelper: {
        fetchWorkflowRunData: jest.fn(),
      },
      slackUserService: {
        getSlackProperties: jest.fn(),
      },
      slackChannelService: {
        selectChannel: jest.fn(),
      },
      slackMessageService: {
        sendDeploymentMessage: jest.fn().mockResolvedValue(true),
        sendBuildMessage: jest.fn().mockResolvedValue(true),
      },
    };

    mockContext = {
      payload: {
        repository: {
          name: 'test-repo',
          full_name: 'org/test-repo',
          html_url: 'https://github.com/org/test-repo',
        },
      },
      runId: 123456,
      ref: 'refs/heads/main',
      sha: 'abc123def456',
    };

    // Default mock implementations
    mockServices.gitHubApiHelper.fetchWorkflowRunData.mockResolvedValue({
      name: 'Deploy Workflow',
      html_url: 'https://github.com/org/test-repo/actions/runs/123456',
      run_started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5분 전
      actor: { login: 'test-user' },
    });

    mockServices.slackUserService.getSlackProperties.mockResolvedValue(
      new Map([['test-user', 'U12345']]),
    );

    handler = new DeploymentEventHandler(mockServices);
  });

  describe('handleDeploy', () => {
    it('should handle successful deployment', async () => {
      await handler.handleDeploy(mockContext, 'prod-server', 'v1.0.0', 'success');

      expect(mockServices.slackMessageService.sendDeploymentMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          ec2Name: 'prod-server',
          imageTag: 'v1.0.0',
          repoName: 'test-repo',
        }),
        expect.any(String),
      );
    });

    it('should handle failed deployment', async () => {
      await handler.handleDeploy(mockContext, 'prod-server', 'v1.0.0', 'failure');

      expect(mockServices.slackMessageService.sendDeploymentMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failure',
        }),
        expect.any(String),
      );
    });

    it('should throw error when payload is invalid', async () => {
      const invalidContext = { ...mockContext, payload: null };

      await expect(
        handler.handleDeploy(invalidContext, 'prod-server', 'v1.0.0', 'success'),
      ).rejects.toThrow(PayloadValidationError);
    });
  });

  describe('handleBuild', () => {
    it('should handle successful build', async () => {
      await handler.handleBuild(mockContext, 'main', 'v1.0.0', '', 'success');

      expect(mockServices.slackMessageService.sendBuildMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          branchName: 'main',
          imageTag: 'v1.0.0',
          jobNames: [],
        }),
        expect.any(String),
      );
    });

    it('should handle failed build with job names', async () => {
      await handler.handleBuild(mockContext, 'feature-branch', 'v1.0.0', 'lint, test', 'failure');

      expect(mockServices.slackMessageService.sendBuildMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failure',
          branchName: 'feature-branch',
          jobNames: ['lint', 'test'],
        }),
        expect.any(String),
      );
    });

    it('should throw error when payload is invalid', async () => {
      const invalidContext = { ...mockContext, payload: null };

      await expect(
        handler.handleBuild(invalidContext, 'main', 'v1.0.0', '', 'success'),
      ).rejects.toThrow(PayloadValidationError);
    });
  });
});
