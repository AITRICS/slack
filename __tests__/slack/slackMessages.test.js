const SlackMessages = require('../../slack/slackMessages');

// Slack WebClient를 모킹
const mockPostMessage = jest.fn().mockImplementation(() => Promise.resolve({ ok: true }));
const mockWeb = {
  chat: {
    postMessage: mockPostMessage,
  },
};

describe('SlackMessages', () => {
  let slackMessages;

  beforeEach(() => {
    // 각 테스트 전에 mock 함수를 초기화합니다
    mockPostMessage.mockClear();
    slackMessages = new SlackMessages(mockWeb);
  });

  describe('sendSlackMessageToComment', () => {
    it('should format and send a comment notification correctly', async () => {
      // 테스트 데이터 설정
      const notificationData = {
        commentContent: 'console.log("test")',
        commentBody: '이 부분을 수정해주세요',
        commentUrl: 'https://github.com/aitrics/repo/pull/1#comment-1',
        prUrl: 'https://github.com/aitrics/repo/pull/1',
        prTitle: '새로운 기능 추가',
        commentAuthorSlackRealName: '홍길동',
        mentionedSlackId: 'U12345',
      };

      const channelId = 'C12345';

      // 함수 호출
      await slackMessages.sendSlackMessageToComment(notificationData, channelId);

      // 검증
      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        channel: channelId,
        text: expect.stringContaining(notificationData.prTitle),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            color: 'good',
            text: expect.stringContaining(notificationData.commentBody),
          }),
        ]),
      }));
    });

    it('should handle comment notifications without code content', async () => {
      // 코드 내용이 없는 테스트 데이터 설정
      const notificationData = {
        commentBody: '좋은 변경사항입니다!',
        commentUrl: 'https://github.com/aitrics/repo/pull/1#comment-1',
        prUrl: 'https://github.com/aitrics/repo/pull/1',
        prTitle: '버그 수정',
        commentAuthorSlackRealName: '김철수',
        mentionedSlackId: 'U67890',
      };

      const channelId = 'C67890';

      // 함수 호출
      await slackMessages.sendSlackMessageToComment(notificationData, channelId);

      // 검증
      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        channel: channelId,
        text: expect.stringContaining(notificationData.prTitle),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            color: 'good',
            text: expect.not.stringContaining('```'),
          }),
        ]),
      }));
    });
  });

  describe('sendSlackMessageToApprove', () => {
    it('should send approve notification with correct format', async () => {
      const notificationData = {
        commentBody: 'LGTM!',
        commentUrl: 'https://github.com/aitrics/repo/pull/1#pullrequestreview-1',
        prUrl: 'https://github.com/aitrics/repo/pull/1',
        prTitle: 'Feature: 사용자 인증 개선',
        commentAuthorSlackRealName: '박지민',
        mentionedSlackId: 'U54321',
      };

      const channelId = 'C54321';

      await slackMessages.sendSlackMessageToApprove(notificationData, channelId);

      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        channel: channelId,
        text: expect.stringContaining(':white_check_mark:'),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            color: 'good',
          }),
        ]),
      }));
    });
  });

  // 에러 처리 테스트
  describe('error handling', () => {
    it('should throw an error when Slack API fails', async () => {
      // Slack API 실패 모킹
      mockPostMessage.mockRejectedValueOnce(new Error('Slack API error'));

      const notificationData = {
        commentBody: 'Test comment',
        commentUrl: 'https://github.com/aitrics/repo/pull/1#comment-1',
        prUrl: 'https://github.com/aitrics/repo/pull/1',
        prTitle: 'Test PR',
        commentAuthorSlackRealName: 'Tester',
        mentionedSlackId: 'U12345',
      };

      const channelId = 'C12345';

      // 에러가 전파되는지 확인
      await expect(
        slackMessages.sendSlackMessageToComment(notificationData, channelId),
      ).rejects.toThrow('Slack API error');
    });
  });
});
