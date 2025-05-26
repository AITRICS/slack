const { SLACK_CONFIG } = require('../constants');

/**
 * @typedef {import('../types').SlackMessage} SlackMessage
 * @typedef {import('../types').SlackAttachment} SlackAttachment
 * @typedef {import('../types').SlackField} SlackField
 * @typedef {import('../types').NotificationData} NotificationData
 * @typedef {import('../types').DeploymentData} DeploymentData
 */

/**
 * Slack 메시지 포맷터
 */
class SlackMessageFormatter {
  /**
   * Slack 메시지 생성
   * @param {string} channelId - 채널 ID
   * @param {string} text - 메시지 텍스트
   * @param {SlackAttachment[]} [attachments=[]] - 첨부 내용
   * @returns {SlackMessage}
   */
  static createMessage(channelId, text, attachments = []) {
    return {
      channel: channelId,
      text,
      attachments,
      mrkdwn: true,
    };
  }

  /**
   * 첨부 필드 생성
   * @param {string} title - 필드 제목
   * @param {string} value - 필드 값
   * @param {boolean} [isShort=false] - 짧은 필드 여부
   * @returns {SlackField}
   */
  static createField(title, value, isShort = false) {
    return { title, value, short: isShort };
  }

  /**
   * 첨부 내용 생성
   * @param {string} color - 색상
   * @param {string} [text=''] - 텍스트
   * @param {SlackField[]} [fields=[]] - 필드 목록
   * @returns {SlackAttachment}
   */
  static createAttachment(color, text = '', fields = []) {
    return { color, text, fields };
  }

  /**
   * 코드 코멘트 메시지 포맷
   * @param {NotificationData} data - 알림 데이터
   * @returns {{text: string, attachment: SlackAttachment}}
   */
  static formatCodeCommentMessage(data) {
    const {
      prUrl,
      prTitle,
      commentUrl,
      commentBody,
      codeSnippet,
      authorSlackName,
      targetSlackId,
      mentionsString,
    } = data;

    // 코드 스니펫 포맷
    const codeBlock = codeSnippet ? `\`\`\`${codeSnippet}\`\`\`\n` : '';

    // 첨부 텍스트 구성
    const attachmentText = `${codeBlock}\n*코멘트 내용:*\n${commentBody}\n\n<${commentUrl}|코멘트 보러가기>\n\n`;
    const attachment = SlackMessageFormatter.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);

    // 멘션 처리 (단일/다중 멘션 모두 지원)
    const mentions = mentionsString || (targetSlackId ? `<@${targetSlackId}>` : '');
    const icon = SLACK_CONFIG.ICONS.COMMENT;
    const text = `*<${prUrl}|${prTitle}>*\n${icon} *${authorSlackName}* 님이 코멘트를 남겼어요!! ${mentions}:\n`;

    return { text, attachment };
  }

  /**
   * PR 페이지 코멘트 메시지 포맷
   * @param {NotificationData} data - 알림 데이터
   * @returns {{text: string, attachment: SlackAttachment}}
   */
  static formatPRPageCommentMessage(data) {
    const {
      prUrl,
      prTitle,
      commentUrl,
      commentBody,
      authorSlackName,
      mentionsString,
    } = data;

    const attachmentText = `*코멘트 내용:*\n${commentBody}\n\n<${commentUrl}|코멘트 보러가기>`;
    const attachment = SlackMessageFormatter.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);

    const icon = SLACK_CONFIG.ICONS.PR_COMMENT;
    const text = `*<${prUrl}|${prTitle}>*\n${icon} *${authorSlackName}* 님이 코멘트를 남겼어요!! ${mentionsString}`;

    return { text, attachment };
  }

  /**
   * PR 승인 메시지 포맷
   * @param {NotificationData} data - 알림 데이터
   * @returns {{text: string, attachment: SlackAttachment}}
   */
  static formatApprovalMessage(data) {
    const {
      prUrl,
      prTitle,
      commentUrl,
      commentBody,
      authorSlackName,
      targetSlackId,
    } = data;

    const attachmentText = `${commentBody}\n\n<${commentUrl}|코멘트 보러가기>.`;
    const attachment = SlackMessageFormatter.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);

    const icon = SLACK_CONFIG.ICONS.APPROVE;
    const text = `*<${prUrl}|${prTitle}>*\n${icon} *${authorSlackName}* 님이 Approve를 했습니다!! <@${targetSlackId}>:\n`;

    return { text, attachment };
  }

  /**
   * 리뷰 요청 메시지 포맷
   * @param {NotificationData} data - 알림 데이터
   * @returns {{text: string, attachment: SlackAttachment}}
   */
  static formatReviewRequestMessage(data) {
    const {
      prUrl,
      prTitle,
      authorSlackName,
      targetSlackId,
    } = data;

    const attachmentText = `\n<${prUrl}|PR 보러가기>.`;
    const attachment = SlackMessageFormatter.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);

    const icon = SLACK_CONFIG.ICONS.REVIEW_REQUEST;
    const text = `*<${prUrl}|${prTitle}>*\n${icon} *${authorSlackName}* 님이 Review를 요청했습니다!! <@${targetSlackId}>:\n`;

    return { text, attachment };
  }

  /**
   * 예약된 리뷰 알림 메시지 포맷
   * @param {Object} data - 알림 데이터
   * @returns {{text: string, attachment: SlackAttachment}}
   */
  static formatScheduledReviewMessage(data) {
    const { prUrl, prTitle, body } = data;

    const attachmentText = `\n<${prUrl}|PR 보러가기>.`;
    const attachment = SlackMessageFormatter.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);
    const text = `*<${prUrl}|${prTitle}>* 에서 리뷰를 기다리고 있습니다. ${body}\n`;

    return { text, attachment };
  }

  /**
   * 배포 알림 메시지 포맷
   * @param {DeploymentData} data - 배포 데이터
   * @returns {{text: string, attachment: SlackAttachment}}
   */
  static formatDeploymentMessage(data) {
    const {
      status,
      repoUrl,
      repoName,
      ec2Name,
      triggerUsername,
      sha,
      imageTag,
      duration,
      workflowUrl,
      workflowName,
      ref,
    } = data;

    const isSuccess = status === 'success';
    const color = isSuccess ? SLACK_CONFIG.MESSAGE_COLORS.SUCCESS : SLACK_CONFIG.MESSAGE_COLORS.DANGER;
    const icon = isSuccess ? SLACK_CONFIG.ICONS.SUCCESS : SLACK_CONFIG.ICONS.FAILURE;
    const statusText = isSuccess ? 'Succeeded' : 'Failed';

    const fields = [
      SlackMessageFormatter.createField('Deploy Info', '', false),
      SlackMessageFormatter.createField('Repository', `<${repoUrl}|${repoName}>`, true),
      SlackMessageFormatter.createField('Deploy Server', `https://${ec2Name}`, true),
      SlackMessageFormatter.createField('Author', `<@${triggerUsername}>`, true),
      SlackMessageFormatter.createField('Commit', `<${repoUrl}/commit/${sha}|${sha.slice(0, 7)}>`, true),
      SlackMessageFormatter.createField('Image Tag', imageTag, true),
      SlackMessageFormatter.createField('Run Time', duration, true),
      SlackMessageFormatter.createField('Workflow', `<${workflowUrl}|${workflowName}>`, true),
      SlackMessageFormatter.createField('Ref', ref, true),
    ];

    const attachment = SlackMessageFormatter.createAttachment(color, '', fields);
    const text = `${icon}*${statusText}* *GitHub Actions Deploy Notification*`;

    return { text, attachment };
  }

  /**
   * 빌드 알림 메시지 포맷
   * @param {Object} data - 빌드 데이터
   * @returns {{text: string, attachment: SlackAttachment}}
   */
  static formatBuildMessage(data) {
    const {
      status,
      repoUrl,
      repoName,
      branchName,
      triggerUsername,
      sha,
      imageTag,
      duration,
      workflowUrl,
      workflowName,
      failedJobs,
    } = data;

    const isSuccess = status === 'success';
    const color = isSuccess ? SLACK_CONFIG.MESSAGE_COLORS.SUCCESS : SLACK_CONFIG.MESSAGE_COLORS.DANGER;
    const icon = isSuccess ? SLACK_CONFIG.ICONS.SUCCESS : SLACK_CONFIG.ICONS.FAILURE;
    const statusText = isSuccess ? 'Succeeded' : 'Failed';

    const fields = [SlackMessageFormatter.createField('Build Info', '', false)];

    // 실패한 작업 표시
    if (!isSuccess && failedJobs && failedJobs.length > 0) {
      const jobsList = failedJobs.map((job) => `\`${job}\``).join('\n');
      fields.push(SlackMessageFormatter.createField('Failed Jobs', jobsList, false));
    }

    fields.push(
      SlackMessageFormatter.createField('Repository', `<${repoUrl}|${repoName}>`, true),
      SlackMessageFormatter.createField('Branch', branchName || 'N/A', true),
      SlackMessageFormatter.createField('Author', `<@${triggerUsername}>`, true),
      SlackMessageFormatter.createField('Commit', `<${repoUrl}/commit/${sha}|${sha.slice(0, 7)}>`, true),
    );

    if (imageTag) {
      fields.push(SlackMessageFormatter.createField('Image Tag', imageTag, true));
    }

    fields.push(
      SlackMessageFormatter.createField('Run Time', duration, true),
      SlackMessageFormatter.createField('Workflow', `<${workflowUrl}|${workflowName}>`, true),
    );

    const attachment = SlackMessageFormatter.createAttachment(color, '', fields);
    const text = `${icon}*${statusText}* *GitHub Actions Build Notification*`;

    return { text, attachment };
  }
}

module.exports = SlackMessageFormatter;
