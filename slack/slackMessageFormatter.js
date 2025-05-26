const { SLACK_CONFIG } = require('../constants');

/**
 * @typedef {import('../types').SlackMessage} SlackMessage
 * @typedef {import('../types').SlackAttachment} SlackAttachment
 * @typedef {import('../types').SlackField} SlackField
 * @typedef {import('../types').NotificationData} NotificationData
 * @typedef {import('../types').DeploymentData} DeploymentData
 */

/**
 * Slack Field Builder 클래스
 * 체이닝 API로 Slack field 객체를 생성합니다.
 */
class SlackFieldBuilder {
  /** @type {string} */ #title;
  /** @type {string} */ #value;
  /** @type {boolean} */ #short = false;

  /**
   * 필드 제목 설정
   * @param {string} title - 필드 제목
   * @returns {SlackFieldBuilder}
   */
  setTitle(title) {
    this.#title = title;
    return this;
  }

  /**
   * 필드 값 설정
   * @param {string} value - 필드 값
   * @returns {SlackFieldBuilder}
   */
  setValue(value) {
    this.#value = value;
    return this;
  }

  /**
   * 짧은 필드 여부 설정
   * @param {boolean} isShort - 짧은 필드 여부
   * @returns {SlackFieldBuilder}
   */
  setShort(isShort = false) {
    this.#short = isShort;
    return this;
  }

  /**
   * 필드 객체 생성
   * @returns {SlackField}
   */
  build() {
    return {
      title: this.#title || '',
      value: this.#value || '',
      short: this.#short,
    };
  }

  /**
   * 간단한 필드 생성 헬퍼
   * @static
   * @param {string} title - 필드 제목
   * @param {string} value - 필드 값
   * @param {boolean} isShort - 짧은 필드 여부
   * @returns {SlackField}
   */
  static create(title, value, isShort = false) {
    return new SlackFieldBuilder()
      .setTitle(title)
      .setValue(value)
      .setShort(isShort)
      .build();
  }
}

/**
 * Slack Attachment Builder 클래스
 * Legacy attachments 사용 시 필수인 fallback을 안전하게 설정합니다.
 */
class SlackAttachmentBuilder {
  /** @type {string} */ #color;
  /** @type {string} */ #text = '';
  /** @type {string} */ #fallback;
  /** @type {SlackField[]} */ #fields = [];

  /**
   * 색상 설정
   * @param {string} color - 첨부 색상
   * @returns {SlackAttachmentBuilder}
   */
  setColor(color) {
    this.#color = color;
    return this;
  }

  /**
   * 텍스트 설정
   * @param {string} text - 첨부 텍스트
   * @returns {SlackAttachmentBuilder}
   */
  setText(text = '') {
    this.#text = text;
    return this;
  }

  /**
   * Fallback 텍스트 설정
   * @param {string} fallback - 폴백 텍스트
   * @returns {SlackAttachmentBuilder}
   */
  setFallback(fallback) {
    this.#fallback = fallback;
    return this;
  }

  /**
   * 필드 추가
   * @param {SlackField} field - 추가할 필드
   * @returns {SlackAttachmentBuilder}
   */
  addField(field) {
    if (field) {
      this.#fields.push(field);
    }
    return this;
  }

  /**
   * 여러 필드 추가
   * @param {SlackField[]} fields - 추가할 필드 배열
   * @returns {SlackAttachmentBuilder}
   */
  addFields(fields = []) {
    if (Array.isArray(fields)) {
      this.#fields.push(...fields.filter(Boolean));
    }
    return this;
  }

  /**
   * 첨부 객체 생성
   * @returns {SlackAttachment}
   */
  build() {
    // fallback이 없으면 text에서 마크다운 제거한 텍스트를 사용
    const fallbackText = this.#fallback || this.#stripMarkdown(this.#text) || 'Slack Notification';

    return {
      color: this.#color,
      fallback: fallbackText,
      text: this.#text,
      fields: this.#fields,
      mrkdwn_in: ['text', 'fields'],
    };
  }

  /**
   * 마크다운 제거 헬퍼
   * @private
   * @param {string} text - 마크다운이 포함된 텍스트
   * @returns {string}
   */
  #stripMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*([^*]+)\*/g, '$1') // *bold* → bold
      .replace(/_([^_]+)_/g, '$1')   // _italic_ → italic
      .replace(/`([^`]+)`/g, '$1')   // `code` → code
      .replace(/<([^|>]+)\|([^>]+)>/g, '$2') // <url|text> → text
      .replace(/<([^>]+)>/g, '$1')   // <url> → url
      .trim();
  }

  /**
   * 간단한 첨부 생성 헬퍼
   * @static
   * @param {string} color - 첨부 색상
   * @param {string} text - 첨부 텍스트
   * @param {SlackField[]} fields - 필드 배열
   * @param {string} fallback - 폴백 텍스트
   * @returns {SlackAttachment}
   */
  static create(color, text = '', fields = [], fallback) {
    return new SlackAttachmentBuilder()
      .setColor(color)
      .setText(text)
      .setFallback(fallback)
      .addFields(fields)
      .build();
  }
}

/**
 * Slack Message Builder 클래스
 * 완전한 Slack 메시지 객체를 생성합니다.
 */
class SlackMessageBuilder {
  /** @type {string} */ #channel;
  /** @type {string} */ #text = '';
  /** @type {SlackAttachment[]} */ #attachments = [];

  /**
   * 채널 설정
   * @param {string} channelId - 채널 ID
   * @returns {SlackMessageBuilder}
   */
  setChannel(channelId) {
    this.#channel = channelId;
    return this;
  }

  /**
   * 메시지 텍스트 설정
   * @param {string} text - 메시지 텍스트
   * @returns {SlackMessageBuilder}
   */
  setText(text) {
    this.#text = text || '';
    return this;
  }

  /**
   * 첨부 추가
   * @param {SlackAttachment} attachment - 추가할 첨부
   * @returns {SlackMessageBuilder}
   */
  addAttachment(attachment) {
    if (attachment) {
      this.#attachments.push(attachment);
    }
    return this;
  }

  /**
   * 여러 첨부 추가
   * @param {SlackAttachment[]} attachments - 추가할 첨부 배열
   * @returns {SlackMessageBuilder}
   */
  addAttachments(attachments = []) {
    if (Array.isArray(attachments)) {
      this.#attachments.push(...attachments.filter(Boolean));
    }
    return this;
  }

  /**
   * 메시지 객체 생성
   * @returns {SlackMessage}
   */
  build() {
    const message = {
      text: this.#text,
      mrkdwn: true,
    };

    if (this.#channel) {
      message.channel = this.#channel;
    }

    if (this.#attachments.length > 0) {
      message.attachments = this.#attachments;
    }

    return message;
  }

  /**
   * 간단한 메시지 생성 헬퍼
   * @static
   * @param {string} channelId - 채널 ID
   * @param {string} text - 메시지 텍스트
   * @param {SlackAttachment[]} attachments - 첨부 배열
   * @returns {SlackMessage}
   */
  static create(channelId, text, attachments = []) {
    return new SlackMessageBuilder()
      .setChannel(channelId)
      .setText(text)
      .addAttachments(attachments)
      .build();
  }
}

/**
 * Slack 메시지 포맷터
 * 다양한 메시지 유형에 대한 포맷 함수를 제공합니다.
 */
class SlackMessageFormatter {
  // 빌더 클래스들을 static 프로퍼티로 노출
  static MessageBuilder = SlackMessageBuilder;
  static AttachmentBuilder = SlackAttachmentBuilder;
  static FieldBuilder = SlackFieldBuilder;

  // 기존 호환성을 위한 헬퍼 메서드들
  static createMessage = SlackMessageBuilder.create;
  static createAttachment = SlackAttachmentBuilder.create;
  static createField = SlackFieldBuilder.create;

  /**
   * 코드 코멘트 메시지 포맷
   * @static
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

    // 코드 스니펫 포맷 (백틱 3개 사용)
    const codeBlock = codeSnippet ? `\`\`\`${codeSnippet}\`\`\`\n` : '';

    // 첨부 텍스트 구성
    const attachmentText = `${codeBlock}\n*코멘트 내용:*\n${commentBody}\n\n<${commentUrl}|코멘트 보러가기>\n\n`;

    const attachment = new SlackAttachmentBuilder()
      .setColor(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS)
      .setText(attachmentText)
      .setFallback(`코드 코멘트: ${commentBody}`)
      .build();

    // 멘션 처리
    const mentions = mentionsString || (targetSlackId ? `<@${targetSlackId}>` : '');
    const icon = SLACK_CONFIG.ICONS.COMMENT;
    const text = `*<${prUrl}|${prTitle}>*\n${icon} *${authorSlackName}* 님이 코멘트를 남겼어요!! ${mentions}:\n`;

    return { text, attachment };
  }

  /**
   * PR 페이지 코멘트 메시지 포맷
   * @static
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

    const attachment = SlackAttachmentBuilder.create(
      SLACK_CONFIG.MESSAGE_COLORS.SUCCESS,
      attachmentText,
      [],
      `PR 코멘트: ${commentBody}`,
    );

    const icon = SLACK_CONFIG.ICONS.PR_COMMENT;
    const text = `*<${prUrl}|${prTitle}>*\n${icon} *${authorSlackName}* 님이 코멘트를 남겼어요!! ${mentionsString}`;

    return { text, attachment };
  }

  /**
   * PR 승인 메시지 포맷
   * @static
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

    const attachment = SlackAttachmentBuilder.create(
      SLACK_CONFIG.MESSAGE_COLORS.SUCCESS,
      attachmentText,
      [],
      `PR 승인: ${commentBody}`,
    );

    const icon = SLACK_CONFIG.ICONS.APPROVE;
    const text = `*<${prUrl}|${prTitle}>*\n${icon} *${authorSlackName}* 님이 Approve를 했습니다!! <@${targetSlackId}>:\n`;

    return { text, attachment };
  }

  /**
   * 리뷰 요청 메시지 포맷
   * @static
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

    const attachment = SlackAttachmentBuilder.create(
      SLACK_CONFIG.MESSAGE_COLORS.SUCCESS,
      attachmentText,
      [],
      '리뷰 요청',
    );

    const icon = SLACK_CONFIG.ICONS.REVIEW_REQUEST;
    const text = `*<${prUrl}|${prTitle}>*\n${icon} *${authorSlackName}* 님이 Review를 요청했습니다!! <@${targetSlackId}>:\n`;

    return { text, attachment };
  }

  /**
   * 예약된 리뷰 알림 메시지 포맷
   * @static
   * @param {Object} data - 알림 데이터
   * @returns {{text: string, attachment: SlackAttachment}}
   */
  static formatScheduledReviewMessage(data) {
    const { prUrl, prTitle, body } = data;

    const attachmentText = `\n<${prUrl}|PR 보러가기>.`;

    const attachment = SlackAttachmentBuilder.create(
      SLACK_CONFIG.MESSAGE_COLORS.SUCCESS,
      attachmentText,
      [],
      '예약된 리뷰 알림',
    );

    const text = `*<${prUrl}|${prTitle}>* 에서 리뷰를 기다리고 있습니다. ${body}\n`;

    return { text, attachment };
  }

  /**
   * 배포 알림 메시지 포맷
   * @static
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
      SlackFieldBuilder.create('Deploy Info', '', false),
      SlackFieldBuilder.create('Repository', `<${repoUrl}|${repoName}>`, true),
      SlackFieldBuilder.create('Deploy Server', `https://${ec2Name}`, true),
      SlackFieldBuilder.create('Author', `<@${triggerUsername}>`, true),
      SlackFieldBuilder.create('Commit', `<${repoUrl}/commit/${sha}|${sha.slice(0, 7)}>`, true),
      SlackFieldBuilder.create('Image Tag', imageTag, true),
      SlackFieldBuilder.create('Run Time', duration, true),
      SlackFieldBuilder.create('Workflow', `<${workflowUrl}|${workflowName}>`, true),
      SlackFieldBuilder.create('Ref', ref, true),
    ];

    const attachment = new SlackAttachmentBuilder()
      .setColor(color)
      .addFields(fields)
      .setFallback(`배포 ${statusText}: ${repoName}`)
      .build();

    const text = `${icon}*${statusText}* *GitHub Actions Deploy Notification*`;

    return { text, attachment };
  }

  /**
   * 빌드 알림 메시지 포맷
   * @static
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

    const fields = [SlackFieldBuilder.create('Build Info', '', false)];

    // 실패한 작업 표시
    if (!isSuccess && failedJobs && failedJobs.length > 0) {
      const jobsList = failedJobs.map((job) => `\`${job}\``).join('\n');
      fields.push(SlackFieldBuilder.create('Failed Jobs', jobsList, false));
    }

    fields.push(
      SlackFieldBuilder.create('Repository', `<${repoUrl}|${repoName}>`, true),
      SlackFieldBuilder.create('Branch', branchName || 'N/A', true),
      SlackFieldBuilder.create('Author', `<@${triggerUsername}>`, true),
      SlackFieldBuilder.create('Commit', `<${repoUrl}/commit/${sha}|${sha.slice(0, 7)}>`, true),
    );

    if (imageTag) {
      fields.push(SlackFieldBuilder.create('Image Tag', imageTag, true));
    }

    fields.push(
      SlackFieldBuilder.create('Run Time', duration, true),
      SlackFieldBuilder.create('Workflow', `<${workflowUrl}|${workflowName}>`, true),
    );

    const attachment = new SlackAttachmentBuilder()
      .setColor(color)
      .addFields(fields)
      .setFallback(`빌드 ${statusText}: ${repoName}`)
      .build();

    const text = `${icon}*${statusText}* *GitHub Actions Build Notification*`;

    return { text, attachment };
  }
}

module.exports = SlackMessageFormatter;