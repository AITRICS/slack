const BaseEventHandler = require('./baseEventHandler');
const Logger = require('../utils/logger');
const { SlackNotificationError } = require('../utils/errors');

/**
 * @typedef {import('../types').CommentEventPayload} CommentEventPayload
 * @typedef {import('../types').NotificationData} NotificationData
 */

/**
 * GitHub 코멘트 이벤트 처리
 */
class CommentEventHandler extends BaseEventHandler {
  /**
   * 코멘트 이벤트 처리
   * @param {CommentEventPayload} payload - 이벤트 페이로드
   */
  async processEvent(payload) {
    const isPRPageComment = payload.comment.issue_url !== undefined;

    if (isPRPageComment) {
      await this.handlePRPageComment(payload);
    } else {
      await this.handleCodeComment(payload);
    }
  }

  /**
   * 코드 리뷰 코멘트 처리
   * @param {CommentEventPayload} payload
   */
  async handleCodeComment(payload) {
    const { repository, pull_request: pr, comment } = payload;
    const recipients = await this.getCodeCommentRecipients(payload);

    if (recipients.length === 0) {
      Logger.info('코드 코멘트 알림 수신자 없음');
      return;
    }

    // 수신자가 1명이고 PR 작성자인 경우 - 첫 코멘트로 간주
    const isFirstComment = recipients.length === 1 && recipients[0].githubUsername === pr.user.login;

    if (isFirstComment) {
      await this.sendSingleCodeComment(payload, recipients[0]);
    } else {
      await this.sendMultipleCodeComments(payload, recipients);
    }
  }

  /**
   * 코드 코멘트 수신자 결정
   * @param {CommentEventPayload} payload
   * @returns {Promise<Array<{githubUsername: string, slackId: string}>>}
   */
  async getCodeCommentRecipients(payload) {
    const { repository, pull_request: pr, comment } = payload;
    const commentAuthor = comment.user.login;

    // 해당 코멘트 스레드의 모든 참여자 조회
    const threadParticipants = await this.gitHubApiHelper.fetchCommentThreadParticipants(
      repository.name,
      pr.number,
      comment.id,
    );

    // 스레드 참여자가 없거나 1명(본인)뿐인 경우 PR 작성자에게 알림
    if (threadParticipants.length <= 1) {
      const prAuthor = pr.user.login;
      if (prAuthor !== commentAuthor) {
        return [{ githubUsername: prAuthor }];
      }
      return [];
    }

    // 코멘트 작성자를 제외한 모든 스레드 참여자
    const recipients = threadParticipants
      .filter((username) => username !== commentAuthor)
      .map((username) => ({ githubUsername: username }));

    // Slack ID 추가
    return this.slackUserService.addSlackIdsToRecipients(recipients);
  }

  /**
   * 단일 수신자에게 코드 코멘트 알림 전송
   * @param {CommentEventPayload} payload
   * @param {{githubUsername: string, slackId?: string}} recipient
   */
  async sendSingleCodeComment(payload, recipient) {
    const notificationData = await this.prepareCodeCommentData(payload, recipient.githubUsername);
    const channelId = await this.slackChannelService.selectChannel(recipient.githubUsername);

    await this.slackMessageService.sendCodeCommentMessage(notificationData, channelId);
    Logger.info(`코드 코멘트 알림 전송: ${recipient.githubUsername}`);
  }

  /**
   * 여러 수신자에게 코드 코멘트 알림 전송
   * @param {CommentEventPayload} payload
   * @param {Array<{githubUsername: string, slackId: string}>} recipients
   */
  async sendMultipleCodeComments(payload, recipients) {
    const recipientsByChannel = await this.groupByChannel(recipients);
    const baseData = await this.prepareCodeCommentData(payload);

    await Promise.all(
      Object.entries(recipientsByChannel).map(async ([channelId, channelRecipients]) => {
        const mentions = channelRecipients.map((r) => `<@${r.slackId}>`).join(', ');

        const notificationData = {
          ...baseData,
          mentionsString: mentions,
        };

        await this.slackMessageService.sendCodeCommentMessage(notificationData, channelId);
        Logger.info(`코드 코멘트 알림 전송 (채널: ${channelId}, 수신자: ${channelRecipients.length}명)`);
      }),
    );
  }

  /**
   * 코드 코멘트 알림 데이터 준비
   * @param {CommentEventPayload} payload
   * @param {string} [targetUsername] - 특정 대상자 (단일 알림인 경우)
   * @returns {Promise<NotificationData>}
   */
  async prepareCodeCommentData(payload, targetUsername) {
    const { comment, pull_request: pr } = payload;
    const authorUsername = comment.user.login;

    // 답글인 경우 원본 코멘트 작성자 확인
    if (comment.in_reply_to_id && !targetUsername) {
      const originalAuthor = await this.gitHubApiHelper.fetchCommentAuthor(
        payload.repository.name,
        comment.in_reply_to_id,
      );
      if (originalAuthor !== authorUsername) {
        targetUsername = originalAuthor;
      }
    }

    // 대상자가 없으면 PR 작성자를 기본값으로
    if (!targetUsername) {
      targetUsername = pr.user.login;
    }

    // Slack 정보 조회
    const userMap = await this.slackUserService.getSlackProperties(
      [authorUsername, targetUsername],
      'id',
    );
    const nameMap = await this.slackUserService.getSlackProperties(
      [authorUsername],
      'realName',
    );

    return {
      prUrl: pr.html_url,
      prTitle: pr.title,
      commentUrl: comment.html_url,
      commentBody: comment.body,
      codeSnippet: comment.diff_hunk,
      authorUsername,
      authorSlackName: nameMap.get(authorUsername) || authorUsername,
      targetUsername,
      targetSlackId: userMap.get(targetUsername) || targetUsername,
    };
  }

  /**
   * PR 페이지 코멘트 처리
   * @param {CommentEventPayload} payload
   */
  async handlePRPageComment(payload) {
    const { repository, issue } = payload;
    const recipients = await this.getPRPageCommentRecipients(payload);

    if (recipients.length === 0) {
      Logger.info('PR 페이지 코멘트 알림 수신자 없음');
      return;
    }

    await this.sendPRPageComments(payload, recipients);
  }

  /**
   * PR 페이지 코멘트 수신자 결정
   * @param {CommentEventPayload} payload
   * @returns {Promise<Array<{githubUsername: string, slackId: string}>>}
   */
  async getPRPageCommentRecipients(payload) {
    const { repository, issue, comment } = payload;
    const commentAuthor = comment.user.login;

    // PR 상세 정보 조회
    const prDetails = await this.gitHubApiHelper.fetchPullRequestDetails(
      repository.name,
      issue.number,
    );
    const prAuthor = prDetails.user.login;

    // 모든 리뷰어 조회
    const reviewers = await this.getAllReviewers(repository.name, issue.number);

    let recipients = [];

    if (commentAuthor === prAuthor) {
      // PR 작성자가 코멘트한 경우 - 모든 리뷰어에게 알림
      recipients = reviewers.filter((r) => r.githubUsername !== commentAuthor);
    } else {
      // 리뷰어가 코멘트한 경우 - 다른 리뷰어 + PR 작성자에게 알림
      recipients = await this.getRecipientsForReviewerComment(
        reviewers,
        commentAuthor,
        prAuthor,
      );
    }

    return this.removeDuplicates(recipients);
  }

  /**
   * PR의 모든 리뷰어 조회
   * @param {string} repoName
   * @param {number} prNumber
   * @returns {Promise<Array<{githubUsername: string, slackId: string}>>}
   */
  async getAllReviewers(repoName, prNumber) {
    const [prDetails, reviews] = await Promise.all([
      this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber),
      this.gitHubApiHelper.fetchPullRequestReviews(repoName, prNumber),
    ]);

    // 리뷰 요청 받은 사용자 + 실제 리뷰한 사용자
    const requestedReviewers = (prDetails.requested_reviewers || []).map((r) => r.login);
    const actualReviewers = reviews.map((review) => review.user.login);

    const allReviewers = [...new Set([...requestedReviewers, ...actualReviewers])];
    const reviewerObjects = allReviewers.map((username) => ({ githubUsername: username }));

    return this.slackUserService.addSlackIdsToRecipients(reviewerObjects);
  }

  /**
   * 리뷰어 코멘트에 대한 수신자 결정
   * @param {Array<{githubUsername: string, slackId: string}>} reviewers
   * @param {string} commentAuthor
   * @param {string} prAuthor
   * @returns {Promise<Array<{githubUsername: string, slackId: string}>>}
   */
  async getRecipientsForReviewerComment(reviewers, commentAuthor, prAuthor) {
    // 코멘트 작성자를 제외한 리뷰어들
    const otherReviewers = reviewers.filter((r) => r.githubUsername !== commentAuthor);

    // PR 작성자가 리뷰어 목록에 없으면 추가
    const prAuthorIsReviewer = reviewers.some((r) => r.githubUsername === prAuthor);

    if (!prAuthorIsReviewer) {
      const prAuthorWithSlackId = await this.slackUserService.addSlackIdsToRecipients([
        { githubUsername: prAuthor },
      ]);
      return [...prAuthorWithSlackId, ...otherReviewers];
    }

    return otherReviewers;
  }

  /**
   * PR 페이지 코멘트 알림 전송
   * @param {CommentEventPayload} payload
   * @param {Array<{githubUsername: string, slackId: string}>} recipients
   */
  async sendPRPageComments(payload, recipients) {
    const recipientsByChannel = await this.groupByChannel(recipients);
    const baseData = await this.preparePRPageCommentData(payload);

    await Promise.all(
      Object.entries(recipientsByChannel).map(async ([channelId, channelRecipients]) => {
        const mentions = channelRecipients.map((r) => `<@${r.slackId}>`).join(', ');

        const notificationData = {
          ...baseData,
          mentionsString: mentions,
        };

        await this.slackMessageService.sendPRPageCommentMessage(notificationData, channelId);
        Logger.info(`PR 페이지 코멘트 알림 전송 (채널: ${channelId}, 수신자: ${channelRecipients.length}명)`);
      }),
    );
  }

  /**
   * PR 페이지 코멘트 알림 데이터 준비
   * @param {CommentEventPayload} payload
   * @returns {Promise<NotificationData>}
   */
  async preparePRPageCommentData(payload) {
    const { repository, issue, comment } = payload;
    const authorUsername = comment.user.login;

    const prDetails = await this.gitHubApiHelper.fetchPullRequestDetails(
      repository.name,
      issue.number,
    );

    const nameMap = await this.slackUserService.getSlackProperties(
      [authorUsername],
      'realName',
    );

    return {
      prUrl: `https://github.com/${repository.full_name}/pull/${issue.number}`,
      prTitle: prDetails.title,
      commentUrl: comment.html_url,
      commentBody: comment.body,
      authorUsername,
      authorSlackName: nameMap.get(authorUsername) || authorUsername,
    };
  }

  /**
   * 수신자를 채널별로 그룹화
   * @param {Array<{githubUsername: string, slackId: string}>} recipients
   * @returns {Promise<Object<string, Array>>} 채널 ID -> 수신자 배열
   */
  async groupByChannel(recipients) {
    const groups = {};

    await Promise.all(
      recipients.map(async (recipient) => {
        const channelId = await this.slackChannelService.selectChannel(recipient.githubUsername);

        if (!groups[channelId]) {
          groups[channelId] = [];
        }
        groups[channelId].push(recipient);
      }),
    );

    return groups;
  }

  /**
   * 중복 수신자 제거
   * @param {Array<{githubUsername: string}>} recipients
   * @returns {Array<{githubUsername: string}>}
   */
  removeDuplicates(recipients) {
    const seen = new Set();
    return recipients.filter((recipient) => {
      if (seen.has(recipient.githubUsername)) {
        return false;
      }
      seen.add(recipient.githubUsername);
      return true;
    });
  }
}

module.exports = CommentEventHandler;
