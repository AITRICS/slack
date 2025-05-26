const { SLACK_CONFIG } = require('../constants');

/**
 * @typedef {import('../types').SlackMessage} SlackMessage
 * @typedef {import('../types').SlackAttachment} SlackAttachment
 * @typedef {import('../types').SlackField} SlackField
 * @typedef {import('../types').NotificationData} NotificationData
 * @typedef {import('../types').DeploymentData} DeploymentData
 */

/**
 * Field Builder – 체이닝 API로 Slack field 객체를 생성합니다.
 */
class SlackFieldBuilder {
  /** @type {string} */ #title;
  /** @type {string} */ #value;
  /** @type {boolean} */ #short = false;

  setTitle(title) {
    this.#title = title;
    return this;
  }

  setValue(value) {
    this.#value = value;
    return this;
  }

  setShort(isShort = false) {
    this.#short = isShort;
    return this;
  }

  build() {
    return { title: this.#title, value: this.#value, short: this.#short };
  }

  static create(title, value, isShort = false) {
    return new SlackFieldBuilder().setTitle(title).setValue(value).setShort(isShort).build();
  }
}

/**
 * Attachment Builder – legacy attachments 사용 시 필수인 fallback을 안전하게 채워줍니다.
 */
class SlackAttachmentBuilder {
  /** @type {string} */ #color;
  /** @type {string} */ #text = '';
  /** @type {string} */ #fallback;
  /** @type {SlackField[]} */ #fields = [];

  setColor(color) {
    this.#color = color;
    return this;
  }

  setText(text = '') {
    this.#text = text;
    return this;
  }

  setFallback(fallback) {
    this.#fallback = fallback;
    return this;
  }

  addField(field) {
    this.#fields.push(field);
    return this;
  }

  addFields(fields = []) {
    if (Array.isArray(fields)) {
      this.#fields.push(...fields.filter(Boolean));
    }
    return this;
  }

  build() {
    const fallbackPlain = this.#fallback || this.#text || 'Slack Notification'; // 빈 문자열 방지
    return {
      color: this.#color,
      fallback: fallbackPlain,
      text: this.#text,
      fields: this.#fields,
      mrkdwn_in: ['text', 'fields'],
      mrkdwn: true,
    };
  }

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
 * Message Builder – channel / text / attachments 를 조합하는 최상위 Builder.
 */
class SlackMessageBuilder {
  /** @type {string} */ #channel;
  /** @type {string} */ #text = '';
  /** @type {SlackAttachment[]} */ #attachments = [];

  setChannel(channelId) {
    this.#channel = channelId;
    return this;
  }

  setText(text) {
    this.#text = text;
    return this;
  }

  addAttachment(attachment) {
    if (attachment) this.#attachments.push(attachment);
    return this;
  }

  addAttachments(attachments = []) {
    if (Array.isArray(attachments)) {
      this.#attachments.push(...attachments.filter(Boolean));
    }
    return this;
  }

  build() {
    const msg = { text: this.#text, mrkdwn: true };
    if (this.#channel) msg.channel = this.#channel;
    if (this.#attachments.length) msg.attachments = this.#attachments;
    return msg;
  }

  static create(channelId, text, attachments = []) {
    return new SlackMessageBuilder().setChannel(channelId).setText(text).addAttachments(attachments).build();
  }
}

/**
 * SlackMessageFormatter – 메시지 유형별 포맷 함수 + Builder 노출
 */
class SlackMessageFormatter {
  /* ------------ PUBLIC BUILDERS ------------- */
  static MessageBuilder = SlackMessageBuilder;
  static AttachmentBuilder = SlackAttachmentBuilder;
  static FieldBuilder = SlackFieldBuilder;

  static createMessage = SlackMessageBuilder.create;
  static createAttachment = SlackAttachmentBuilder.create;
  static createField = SlackFieldBuilder.create;

  /* ------------- FORMATTERS -------------- */
  /** @param {NotificationData} data */
  static formatCodeCommentMessage(data) {
    const { prUrl, prTitle, commentUrl, commentBody, codeSnippet, authorSlackName, targetSlackId, mentionsString } = data;

    const codeBlock = codeSnippet ? `\u0060\u0060\u0060${codeSnippet}\u0060\u0060\u0060\n` : '';
    const attachmentText = `${codeBlock}\n*코멘트 내용:*\n${commentBody}\n\n<${commentUrl}|코멘트 보러가기>`;
    const attachment = new SlackAttachmentBuilder()
      .setColor(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS)
      .setText(attachmentText)
      .build();

    const mentions = mentionsString || (targetSlackId ? `<@${targetSlackId}>` : '');
    const text = `*<${prUrl}|${prTitle}>*\n${SLACK_CONFIG.ICONS.COMMENT} *${authorSlackName}* 님이 코멘트를 남겼어요!! ${mentions}`;

    return SlackMessageBuilder.create(undefined, text, [attachment]);
  }

  /** @param {NotificationData} data */
  static formatPRPageCommentMessage(data) {
    const { prUrl, prTitle, commentUrl, commentBody, authorSlackName, mentionsString } = data;
    const attachmentText = `*코멘트 내용:*\n${commentBody}\n\n<${commentUrl}|코멘트 보러가기>`;
    const attachment = SlackAttachmentBuilder.create(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);
    const text = `*<${prUrl}|${prTitle}>*\n${SLACK_CONFIG.ICONS.PR_COMMENT} *${authorSlackName}* 님이 코멘트를 남겼어요!! ${mentionsString}`;
    return SlackMessageBuilder.create(undefined, text, [attachment]);
  }

  /** @param {NotificationData} data */
  static formatApprovalMessage(data) {
    const { prUrl, prTitle, commentUrl, commentBody, authorSlackName, targetSlackId } = data;
    const attachmentText = `${commentBody}\n\n<${commentUrl}|코멘트 보러가기>`;
    const attachment = SlackAttachmentBuilder.create(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);
    const text = `*<${prUrl}|${prTitle}>*\n${SLACK_CONFIG.ICONS.APPROVE} *${authorSlackName}* 님이 Approve를 했습니다!! <@${targetSlackId}>`;
    return SlackMessageBuilder.create(undefined, text, [attachment]);
  }

  /** @param {NotificationData} data */
  static formatReviewRequestMessage(data) {
    const { prUrl, prTitle, authorSlackName, targetSlackId } = data;
    const attachment = SlackAttachmentBuilder.create(
      SLACK_CONFIG.MESSAGE_COLORS.SUCCESS,
      `리뷰가 필요합니다! <${prUrl}|PR 보러가기>`
    );
    const text = `*<${prUrl}|${prTitle}>*\n${SLACK_CONFIG.ICONS.REVIEW_REQUEST} *${authorSlackName}* 님이 Review를 요청했습니다!! <@${targetSlackId}>`;
    return SlackMessageBuilder.create(undefined, text, [attachment]);
  }

  /** @param {object} data */
  static formatScheduledReviewMessage(data) {
    const { prUrl, prTitle, body } = data;
    const attachment = SlackAttachmentBuilder.create(
      SLACK_CONFIG.MESSAGE_COLORS.SUCCESS,
      `<${prUrl}|PR 보러가기>`
    );
    const text = `*<${prUrl}|${prTitle}>* 에서 리뷰를 기다리고 있습니다. ${body}`;
    return SlackMessageBuilder.create(undefined, text, [attachment]);
  }

  /** @param {DeploymentData} data */
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
      .build();

    const text = `${icon} *${statusText}* GitHub Actions Deploy Notification`;
    return SlackMessageBuilder.create(undefined, text, [attachment]);
  }

  /** @param {DeploymentData} data */
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

    const fields = [
      SlackFieldBuilder.create('Repository', `<${repoUrl}|${repoName}>`, true),
      SlackFieldBuilder.create('Branch', branchName || 'N/A', true),
      SlackFieldBuilder.create('Author', `<@${triggerUsername}>`, true),
      SlackFieldBuilder.create('Commit', `<${repoUrl}/commit/${sha}|${sha.slice(0, 7)}>`, true),
    ];

    if (imageTag) {
      fields.push(SlackFieldBuilder.create('Image Tag', imageTag, true));
    }

    fields.push(
      SlackFieldBuilder.create('Run Time', duration, true),
      SlackFieldBuilder.create('Workflow', `<${workflowUrl}|${workflowName}>`, true),
    );

    if (!isSuccess && failedJobs?.length) {
      fields.push(
        SlackFieldBuilder.create('Failed Jobs', failedJobs.map((j) => `\`${j}\``).join(''), false),
    );
    }

    const attachment = new SlackAttachmentBuilder()
      .setColor(color)
      .addFields(fields)
      .build();

    const text = `${icon} *${statusText}* GitHub Actions Build Notification`;
    return SlackMessageBuilder.create(undefined, text, [attachment]);
  }
}

module.exports = SlackMessageFormatter;
