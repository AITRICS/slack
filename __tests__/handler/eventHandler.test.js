const EventHandler = require('../../handler/eventHandler');
const fetchSlackUserList = require('../../slack/fetchSlackUserList');
const {
  GITHUB_CONFIG, SLACK_CHANNELS, SLACK_CONFIG, REVIEW_STATES,
} = require('../../constants');
const {
  mockSlackMembers, createMockOctokit, createMockSlackWeb, setupDefaultMocks,
} = require('../mocks/commonMocks');

// Mock 데이터 imports
const issueCommentPayload = require('../fixtures/issue_comment');
const prPageCommentPayload = require('../fixtures/pr_page_comment');
const requestChangePayload = require('../fixtures/request_change');
const reviewRequestPayload = require('../fixtures/review_request');

// Mock fetchSlackUserList
jest.mock('../../slack/fetchSlackUserList', () => jest.fn());

// Mock only time-dependent functions for consistent test results
jest.mock('../../utils/timeUtils', () => ({
  calculateDurationInMinutes: jest.fn(() => 5.5),
  formatDuration: jest.fn(() => '5분 30초'),
}));

describe('EventHandler', () => {
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

  describe('Comment 이벤트 처리', () => {
    describe('코드 리뷰 코멘트', () => {
      it('일반 코멘트 처리', async () => {
        await eventHandler.handleComment(issueCommentPayload);

        expect(mockPostMessage).toHaveBeenCalledTimes(1);
        expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
          text: expect.stringContaining(':pencil:'),
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: 'good',
              text: expect.stringContaining('무슨차이일까?'),
            }),
          ]),
        }));
      });

      it('답글 코멘트 처리', async () => {
        const replyPayload = {
          ...issueCommentPayload,
          comment: {
            ...issueCommentPayload.comment,
            in_reply_to_id: 2085982039,
          },
        };

        await eventHandler.handleComment(replyPayload);

        expect(mockOctokit.rest.pulls.getReviewComment).toHaveBeenCalledWith({
          owner: 'aitrics',
          repo: 'ray-test',
          comment_id: 2085982039,
        });
      });
    });

    describe('PR 페이지 코멘트', () => {
      beforeEach(() => {
        mockOctokit.rest.pulls.get.mockResolvedValue({
          data: {
            user: { login: 'pr-author' },
            title: 'Test PR',
            number: 23,
            requested_reviewers: [
              { login: 'reviewer1' },
              { login: 'reviewer2' },
            ],
          },
        });
      });

      it('PR 작성자가 코멘트를 남긴 경우', async () => {
        const payload = {
          ...prPageCommentPayload,
          comment: {
            ...prPageCommentPayload.comment,
            user: { login: 'pr-author' },
          },
        };

        await eventHandler.handleComment(payload);
        expect(mockPostMessage).toHaveBeenCalled();
      });

      it('리뷰어가 코멘트를 남긴 경우', async () => {
        await eventHandler.handleComment(prPageCommentPayload);
        expect(mockPostMessage).toHaveBeenCalled();
      });
    });
  });

  describe('Approve 이벤트 처리', () => {
    it('approve 알림 전송', async () => {
      const approvePayload = {
        review: {
          html_url: 'https://github.com/test/repo/pull/1#pullrequestreview-123',
          user: { login: 'approver' },
          body: 'LGTM!',
          state: 'approved',
        },
        pull_request: {
          user: { login: 'pr-author' },
          html_url: 'https://github.com/test/repo/pull/1',
          title: 'Test PR',
        },
      };

      await eventHandler.handleApprove(approvePayload);

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining(':white_check_mark:'),
        text: expect.stringContaining('Approve를 했습니다'),
      }));
    });

    it('request changes payload 구조 검증', async () => {
      expect(requestChangePayload.action).toBe('submitted');
      expect(requestChangePayload.review.state).toBe('changes_requested');
      expect(requestChangePayload.review.body).toBe('request changes');

      await eventHandler.handleApprove(requestChangePayload);
      expect(mockPostMessage).toHaveBeenCalled();
    });
  });

  describe('Review Request 이벤트 처리', () => {
    it('리뷰 요청 알림 전송', async () => {
      await eventHandler.handleReviewRequested(reviewRequestPayload);

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining(':eyes:'),
        text: expect.stringContaining('Review를 요청했습니다'),
      }));
    });
  });

  describe('Deploy 이벤트 처리', () => {
    const mockContext = {
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

    beforeEach(() => {
      mockOctokit.actions.getWorkflowRun.mockResolvedValue({
        data: {
          name: 'Deploy Workflow',
          html_url: 'https://github.com/org/test-repo/actions/runs/123456',
          run_started_at: '2025-05-22T10:00:00Z',
          actor: { login: 'deployer' },
        },
      });
    });

    it('성공한 배포 알림', async () => {
      await eventHandler.handleDeploy(mockContext, 'prod-server', 'v1.0.0', 'success');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining(':white_check_mark:*Succeeded*'),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            color: 'good',
            fields: expect.arrayContaining([
              expect.objectContaining({ title: 'Deploy Server', value: 'https://prod-server' }),
              expect.objectContaining({ title: 'Image Tag', value: 'v1.0.0' }),
            ]),
          }),
        ]),
      }));
    });

    it('실패한 배포 알림', async () => {
      await eventHandler.handleDeploy(mockContext, 'prod-server', 'v1.0.0', 'failure');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining(':x:*Failed*'),
        attachments: expect.arrayContaining([
          expect.objectContaining({ color: 'danger' }),
        ]),
      }));
    });

    it('duration 계산이 포함된 알림 확인', async () => {
      await eventHandler.handleDeploy(mockContext, 'prod-server', 'v1.0.0', 'success');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                title: 'Run Time',
                value: expect.stringMatching(/\d+분 \d+초/),
              }),
            ]),
          }),
        ]),
      }));
    });
  });

  describe('Build 이벤트 처리', () => {
    const mockContext = {
      payload: {
        repository: {
          name: 'test-repo',
          full_name: 'org/test-repo',
          html_url: 'https://github.com/org/test-repo',
        },
      },
      runId: '123456',
      ref: 'refs/heads/feature-branch',
      sha: 'abc123def456',
    };

    beforeEach(() => {
      mockOctokit.actions.getWorkflowRun.mockResolvedValue({
        data: {
          name: 'Build Workflow',
          html_url: 'https://github.com/org/test-repo/actions/runs/123456',
          run_started_at: '2025-05-22T10:00:00Z',
          actor: { login: 'developer' },
        },
      });
    });

    it('성공한 빌드 알림', async () => {
      await eventHandler.handleBuild(mockContext, 'feature-branch', 'v1.0.0-beta', 'lint, test, build', 'success');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining(':white_check_mark:*Succeeded*'),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            color: 'good',
            fields: expect.arrayContaining([
              expect.objectContaining({ title: 'Branch', value: 'feature-branch' }),
            ]),
          }),
        ]),
      }));
    });

    it('실패한 빌드 알림 - job 목록 포함', async () => {
      await eventHandler.handleBuild(mockContext, 'feature-branch', 'v1.0.0-beta', 'test, build', 'failure');

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining(':x:*Failed*'),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            color: 'danger',
            fields: expect.arrayContaining([
              expect.objectContaining({
                title: 'Failed Jobs',
                value: expect.stringContaining('`test`\n`build`'),
              }),
            ]),
          }),
        ]),
      }));
    });
  });

  describe('Schedule 이벤트 처리', () => {
    it('팀별 PR 그룹화', async () => {
      const schedulePayload = { repository: { name: 'test-repo' } };

      mockOctokit.rest.pulls.list.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'Test PR 1',
            html_url: 'https://github.com/org/test-repo/pull/1',
            user: { login: 'developer1' },
            draft: false,
            author: 'developer1',
          },
          {
            number: 2,
            title: 'Test PR 2',
            html_url: 'https://github.com/org/test-repo/pull/2',
            user: { login: 'developer2' },
            draft: true, // draft PR은 제외
            author: 'developer2',
          },
        ],
      });

      mockOctokit.teams.listMembersInOrg
        .mockResolvedValueOnce({ data: [{ login: 'developer1' }] })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] });

      await eventHandler.handleSchedule(schedulePayload);

      expect(mockPostMessage).toHaveBeenCalledTimes(1); // draft가 아닌 PR 1개만
    });
  });

  describe('에러 처리', () => {
    it('GitHub API 오류 처리', async () => {
      mockOctokit.rest.users.getByUsername.mockRejectedValueOnce(new Error('GitHub API Error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // handleComment에서 try-catch로 감싸져 있어서 에러가 throw되지 않을 수 있음
      // 이 경우 console.error가 호출되는지 확인
      await eventHandler.handleComment(issueCommentPayload);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
