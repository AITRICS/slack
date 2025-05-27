const { SLACK_CONFIG } = require('../constants');

/**
 * Slack 메시지 포맷터
 */
class SlackMessageFormatter {
  /**
   * Slack 메시지 생성
   * @static
   * @param {string} channelId - 채널 ID
   * @param {string} text - 메시지 텍스트
   * @param {import('../types').SlackAttachment[]} [attachments=[]] - 첨부 내용
   * @returns {import('../types').SlackMessage}
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
   * @static
   * @param {string} title - 필드 제목
   * @param {string} value - 필드 값
   * @param {boolean} [isShort=false] - 짧은 필드 여부
   * @returns {import('../types').SlackField}
   */
  static createField(title, value, isShort = false) {
    return { title, value, short: isShort };
  }

  /**
   * 첨부 내용 생성
   * @static
   * @param {string} color - 색상
   * @param {string} [text=''] - 텍스트
   * @param {import('../types').SlackField[]} [fields=[]] - 필드 목록
   * @returns {import('../types').SlackAttachment}
   */
  static createAttachment(color, text = '', fields = []) {
    return { color, text, fields };
  }

  /**
   * 안전한 문자열 접근
   * @private
   * @static
   * @param {any} value - 확인할 값
   * @param {string} [fallback=''] - 기본값
   * @returns {string}
   */
  static #safeString(value, fallback = '') {
    return value || fallback;
  }

  /**
   * 멘션 문자열 생성
   * @private
   * @static
   * @param {string} [mentionsString] - 기존 멘션 문자열
   * @param {string} [targetSlackId] - 대상 Slack ID
   * @returns {string}
   */
  static #createMentions(mentionsString, targetSlackId) {
    return mentionsString || (targetSlackId ? `<@${targetSlackId}>` : '');
  }

  /**
   * 공통 메시지 헤더 생성
   * @private
   * @static
   * @param {string} prUrl - PR URL
   * @param {string} prTitle - PR 제목
   * @param {string} icon - 아이콘
   * @param {string} authorName - 작성자 이름
   * @param {string} action - 액션 설명
   * @param {string} mentions - 멘션 문자열
   * @returns {string}
   */
  static #createMessageHeader(prUrl, prTitle, icon, authorName, action, mentions) {
    const mentionPart = mentions ? ` ${mentions}` : '';
    const colonSuffix = mentions ? ':\n' : '';
    return `*<${prUrl}|${prTitle}>*\n${icon} *${authorName}* ${action}${mentionPart}${colonSuffix}`;
  }

  /**
   * 코드 코멘트 메시지 포맷
   * @static
   * @param {import('../types').NotificationData} data - 알림 데이터
   * @returns {{text: string, attachment: import('../types').SlackAttachment}}
   */
  static formatCodeCommentMessage(data) {
    const {
      prUrl = '',
      prTitle = '',
      commentUrl = '',
      commentBody = '',
      codeSnippet = '',
      authorSlackName = '',
      targetSlackId = '',
      mentionsString = '',
    } = data;

    // 코드 스니펫 포맷
    const codeBlock = codeSnippet ? `\`\`\`${codeSnippet}\`\`\`\n` : '';

    // 첨부 텍스트 구성
    const attachmentText = [
      codeBlock,
      `\n${SLACK_CONFIG.MESSAGE_TEMPLATES.COMMENT_CONTENT}`,
      commentBody,
      `\n\n<${commentUrl}|${SLACK_CONFIG.MESSAGE_TEMPLATES.VIEW_COMMENT}>\n\n`,
    ].join('\n');

    const attachment = SlackMessageFormatter.createAttachment(
      SLACK_CONFIG.MESSAGE_COLORS.SUCCESS,
      attachmentText,
    );

    const mentions = SlackMessageFormatter.#createMentions(mentionsString, targetSlackId);
    const text = SlackMessageFormatter.#createMessageHeader(
      prUrl,
      prTitle,
      SLACK_CONFIG.ICONS.COMMENT,
      authorSlackName,
      SLACK_CONFIG.MESSAGE_TEMPLATES.CODE_COMMENT,
      mentions,
    );

    return { text, attachment };
  }

  /**
   * PR 페이지 코멘트 메시지 포맷
   * @static
   * @param {import('../types').NotificationData} data - 알림 데이터
   * @returns {{text: string, attachment: import('../types').SlackAttachment}}
   */
  static formatPRPageCommentMessage(data) {
    const {
      prUrl = '',
      prTitle = '',
      commentUrl = '',
      commentBody = '',
      authorSlackName = '',
      mentionsString = '',
    } = data;

    const attachmentText = [
      `${SLACK_CONFIG.MESSAGE_TEMPLATES.COMMENT_CONTENT}`,
      commentBody,
      `\n\n<${commentUrl}|${SLACK_CONFIG.MESSAGE_TEMPLATES.VIEW_COMMENT}>`,
    ].join('\n');

    const attachment = SlackMessageFormatter.createAttachment(
      SLACK_CONFIG.MESSAGE_COLORS.SUCCESS,
      attachmentText,
    );

    const text = SlackMessageFormatter.#createMessageHeader(
      prUrl,
      prTitle,
      SLACK_CONFIG.ICONS.PR_COMMENT,
      authorSlackName,
      SLACK_CONFIG.MESSAGE_TEMPLATES.PR_COMMENT,
      mentionsString,
    );

    return { text, attachment };
  }

  /**
   * PR 승인 메시지 포맷
   * @static
   * @param {import('../types').NotificationData} data - 알림 데이터
   * @returns {{text: string, attachment: import('../types').SlackAttachment}}
   */
  static formatApprovalMessage(data) {
    const {
      prUrl = '',
      prTitle = '',
      commentUrl = '',
      commentBody = '',
      authorSlackName = '',
      targetSlackId = '',
    } = data;

    const attachmentText = [
      SlackMessageFormatter.#safeString(commentBody),
      `\n\n<${commentUrl}|${SLACK_CONFIG.MESSAGE_TEMPLATES.VIEW_COMMENT}>.`,
    ].join('');

    const attachment = SlackMessageFormatter.createAttachment(
      SLACK_CONFIG.MESSAGE_COLORS.SUCCESS,
      attachmentText,
    );

    const mentions = targetSlackId ? `<@${targetSlackId}>` : '';
    const text = SlackMessageFormatter.#createMessageHeader(
      prUrl,
      prTitle,
      SLACK_CONFIG.ICONS.APPROVE,
      authorSlackName,
      SLACK_CONFIG.MESSAGE_TEMPLATES.APPROVE,
      mentions,
    );

    return { text, attachment };
  }

  /**
   * 리뷰 요청 메시지 포맷
   * @static
   * @param {import('../types').NotificationData} data - 알림 데이터
   * @returns {{text: string, attachment: import('../types').SlackAttachment}}
   */
  static formatReviewRequestMessage(data) {
    const {
      prUrl = '',
      prTitle = '',
      authorSlackName = '',
      targetSlackId = '',
    } = data;

    const attachmentText = `\n<${prUrl}|${SLACK_CONFIG.MESSAGE_TEMPLATES.VIEW_PR}>.`;
    const attachment = SlackMessageFormatter.createAttachment(
      SLACK_CONFIG.MESSAGE_COLORS.SUCCESS,
      attachmentText,
    );

    const mentions = targetSlackId ? `<@${targetSlackId}>` : '';
    const text = SlackMessageFormatter.#createMessageHeader(
      prUrl,
      prTitle,
      SLACK_CONFIG.ICONS.REVIEW_REQUEST,
      authorSlackName,
      SLACK_CONFIG.MESSAGE_TEMPLATES.REVIEW_REQUEST,
      mentions,
    );

    return { text, attachment };
  }

  /**
   * 예약된 리뷰 알림 메시지 포맷
   * @static
   * @param {Object} data - 알림 데이터
   * @returns {{text: string, attachment: import('../types').SlackAttachment}}
   */
  static formatScheduledReviewMessage(data) {
    const { prUrl = '', prTitle = '', body = '' } = data;

    const attachmentText = `\n<${prUrl}|${SLACK_CONFIG.MESSAGE_TEMPLATES.VIEW_PR}>.`;
    const attachment = SlackMessageFormatter.createAttachment(
      SLACK_CONFIG.MESSAGE_COLORS.SUCCESS,
      attachmentText,
    );

    const text = `*<${prUrl}|${prTitle}>* ${SLACK_CONFIG.MESSAGE_TEMPLATES.SCHEDULE_REVIEW} ${body}\n`;

    return { text, attachment };
  }

  /**
   * 배포 알림 메시지 포맷
   * @static
   * @param {import('../types').DeploymentData} data - 배포 데이터
   * @returns {{text: string, attachment: import('../types').SlackAttachment}}
   */
  static formatDeploymentMessage(data) {
    const {
      status = '',
      repoUrl = '',
      repoName = '',
      ec2Name = '',
      triggerUsername = '',
      sha = '',
      imageTag = '',
      duration = '',
      workflowUrl = '',
      workflowName = '',
      ref = '',
    } = data;

    const isSuccess = status === 'success';
    const color = isSuccess ? SLACK_CONFIG.MESSAGE_COLORS.SUCCESS : SLACK_CONFIG.MESSAGE_COLORS.DANGER;
    const icon = isSuccess ? SLACK_CONFIG.ICONS.SUCCESS : SLACK_CONFIG.ICONS.FAILURE;
    const statusText = isSuccess ? 'Succeeded' : 'Failed';

    const fields = [
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.DEPLOY_INFO, '', false),
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.REPOSITORY, `<${repoUrl}|${repoName}>`, true),
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.DEPLOY_SERVER, `https://${ec2Name}`, true),
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.AUTHOR, `<@${triggerUsername}>`, true),
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.COMMIT, `<${repoUrl}/commit/${sha}|${sha.slice(0, 7)}>`, true),
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.IMAGE_TAG, imageTag, true),
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.RUN_TIME, duration, true),
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.WORKFLOW, `<${workflowUrl}|${workflowName}>`, true),
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.REF, ref, true),
    ];

    const attachment = SlackMessageFormatter.createAttachment(color, '', fields);
    const text = `${icon}*${statusText}* ${SLACK_CONFIG.MESSAGE_TEMPLATES.DEPLOY_NOTIFICATION}`;

    return { text, attachment };
  }

  /**
   * 빌드 알림 메시지 포맷
   * @static
   * @param {import('../types').DeploymentData} data - 빌드 데이터
   * @returns {{text: string, attachment: import('../types').SlackAttachment}}
   */
  static formatBuildMessage(data) {
    const {
      status = '',
      repoUrl = '',
      repoName = '',
      branchName = '',
      triggerUsername = '',
      sha = '',
      imageTag = '',
      duration = '',
      workflowUrl = '',
      workflowName = '',
      jobNames = [],
    } = data;

    const isSuccess = status === 'success';
    const color = isSuccess ? SLACK_CONFIG.MESSAGE_COLORS.SUCCESS : SLACK_CONFIG.MESSAGE_COLORS.DANGER;
    const icon = isSuccess ? SLACK_CONFIG.ICONS.SUCCESS : SLACK_CONFIG.ICONS.FAILURE;
    const statusText = isSuccess ? 'Succeeded' : 'Failed';

    const fields = [SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.BUILD_INFO, '', false)];

    // 작업 표시
    if (jobNames && jobNames.length > 0) {
      const jobsList = jobNames.map((job) => `\`${job}\``).join('\n');
      fields.push(SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.JOB_NAMES, jobsList, false));
    }

    fields.push(
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.REPOSITORY, `<${repoUrl}|${repoName}>`, true),
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.BRANCH, branchName || 'N/A', true),
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.AUTHOR, `<@${triggerUsername}>`, true),
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.COMMIT, `<${repoUrl}/commit/${sha}|${sha.slice(0, 7)}>`, true),
    );

    if (imageTag) {
      fields.push(SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.IMAGE_TAG, imageTag, true));
    }

    fields.push(
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.RUN_TIME, duration, true),
      SlackMessageFormatter.createField(SLACK_CONFIG.MESSAGE_TEMPLATES.WORKFLOW, `<${workflowUrl}|${workflowName}>`, true),
    );

    const attachment = SlackMessageFormatter.createAttachment(color, '', fields);
    const text = `${icon}*${statusText}* ${SLACK_CONFIG.MESSAGE_TEMPLATES.BUILD_NOTIFICATION}`;

    return { text, attachment };
  }
}

module.exports = SlackMessageFormatter;
