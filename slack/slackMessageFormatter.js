// eslint-disable-next-line max-classes-per-file
const { SLACK_CONFIG } = require('../constants');

/**
 * Field Builder – 체이닝 API로 Slack field 객체를 생성합니다.
 */
class SlackFieldBuilder {
  /** @type {string} */ #title;

  /** @type {string} */ #value;

  /** @type {boolean} */ #short = false;

  /**
   * @param {string} title
   */
  setTitle(title) {
    this.#title = title;
    return this;
  }

  /**
   * @param {string} value
   */
  setValue(value) {
    this.#value = value;
    return this;
  }

  /**
   * @param {boolean} isShort
   */
  setShort(isShort = false) {
    this.#short = isShort;
    return this;
  }

  /**
   * @returns {SlackField}
   */
  build() {
    return { title: this.#title, value: this.#value, short: this.#short };
  }

  /**
   * 정적 헬퍼 – 기존 정적 메서드와 호환.
   * @param {string} title
   * @param {string} value
   * @param {boolean} [isShort=false]
   * @returns {SlackField}
   */
  static create(title, value, isShort = false) {
    return new SlackFieldBuilder().setTitle(title).setValue(value).setShort(isShort)
      .build();
  }
}

/**
 * Attachment Builder – 색상·텍스트·필드를 체이닝으로 조합합니다.
 */
class SlackAttachmentBuilder {
  /** @type {string} */ #color;

  /** @type {string} */ #text = '';

  /** @type {SlackField[]} */ #fields = [];

  /**
   * @param {string} color
   */
  setColor(color) {
    this.#color = color;
    return this;
  }

  /**
   * @param {string} text
   */
  setText(text = '') {
    this.#text = text;
    return this;
  }

  /**
   * @param {SlackField[]} fields
   */
  addFields(fields = []) {
    this.#fields.push(...fields);
    return this;
  }

  /**
   * @returns {SlackAttachment}
   */
  build() {
    return { color: this.#color, text: this.#text, fields: this.#fields };
  }

  /**
   * 정적 헬퍼 – 기존 createAttachment 대체.
   * @param {string} color
   * @param {string} [text='']
   * @param {SlackField[]} [fields=[]]
   * @returns {SlackAttachment}
   */
  static create(color, text = '', fields = []) {
    return new SlackAttachmentBuilder().setColor(color).setText(text).addFields(fields)
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

  /**
   * @param {string} channelId
   */
  setChannel(channelId) {
    this.#channel = channelId;
    return this;
  }

  /**
   * @param {string} text
   */
  setText(text) {
    this.#text = text;
    return this;
  }

  /**
   * @param {SlackAttachment} attachment
   */
  addAttachment(attachment) {
    this.#attachments.push(attachment);
    return this;
  }

  /**
   * @param {SlackAttachment[]} attachments
   */
  addAttachments(attachments = []) {
    this.#attachments.push(...attachments);
    return this;
  }

  /**
   * @returns {SlackMessage}
   */
  build() {
    return {
      channel: this.#channel,
      text: this.#text,
      attachments: this.#attachments,
      mrkdwn: true,
    };
  }

  /**
   * 정적 헬퍼 – 기존 createMessage 대체.
   * @param {string} channelId
   * @param {string} text
   * @param {SlackAttachment[]} [attachments=[]]
   * @returns {SlackMessage}
   */
  static create(channelId, text, attachments = []) {
    return new SlackMessageBuilder().setChannel(channelId).setText(text).addAttachments(attachments)
      .build();
  }
}

/**
 * SlackMessageFormatter – 기존 API 유지 + Builder 패턴 노출.
 */
class SlackMessageFormatter {
  /**
   * ## LEGACY STATIC HELPERS
   * createMessage / createAttachment / createField 함수를 유지해 기존 코드와의 호환성을 보장합니다.
   */
  static createMessage = SlackMessageBuilder.create;

  static createAttachment = SlackAttachmentBuilder.create;

  static createField = SlackFieldBuilder.create;

  /**
   * Builder 클래스를 외부로 노출합니다 – 새 코드에서는 체이닝 API를 사용하세요.
   */
  static MessageBuilder = SlackMessageBuilder;

  static AttachmentBuilder = SlackAttachmentBuilder;

  static FieldBuilder = SlackFieldBuilder;

  /**
   * @param {NotificationData} data
   * @returns {SlackMessage}
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

    const codeBlock = codeSnippet ? `\`\`\`${codeSnippet}\`\`\`\n` : '';
    const attachmentText = `${codeBlock}\n*코멘트 내용:*\n${commentBody}\n\n<${commentUrl}|코멘트 보러가기>\n\n`;

    const attachment = new SlackAttachmentBuilder()
      .setColor(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS)
      .setText(attachmentText)
      .build();

    const mentions = mentionsString || (targetSlackId ? `<@${targetSlackId}>` : '');
    const icon = SLACK_CONFIG.ICONS.COMMENT;
    const text = `*<${prUrl}|${prTitle}>*\n${icon} *${authorSlackName}* 님이 코멘트를 남겼어요!! ${mentions}:\n`;

    return new SlackMessageBuilder()
      .setText(text)
      .addAttachment(attachment)
      .build();
  }

  /**
   * @param {NotificationData} data
   * @returns {SlackMessage}
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
    );

    const icon = SLACK_CONFIG.ICONS.PR_COMMENT;
    const text = `*<${prUrl}|${prTitle}>*\n${icon} *${authorSlackName}* 님이 코멘트를 남겼어요!! ${mentionsString}`;

    return new SlackMessageBuilder().setText(text).addAttachment(attachment).build();
  }

  /**
   * @param {NotificationData} data
   * @returns {SlackMessage}
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
    );

    const icon = SLACK_CONFIG.ICONS.APPROVE;
    const text = `*<${prUrl}|${prTitle}>*\n${icon} *${authorSlackName}* 님이 Approve를 했습니다!! <@${targetSlackId}>:\n`;

    return SlackMessageBuilder.create(undefined, text, [attachment]);
  }

  /**
   * @param {NotificationData} data
   * @returns {SlackMessage}
   */
  static formatReviewRequestMessage(data) {
    const {
      prUrl,
      prTitle,
      authorSlackName,
      targetSlackId,
    } = data;

    const attachment = SlackAttachmentBuilder.create(
      SLACK_CONFIG.MESSAGE_COLORS.SUCCESS,
      `\n<${prUrl}|PR 보러가기>.`,
    );

    const icon = SLACK_CONFIG.ICONS.REVIEW_REQUEST;
    const text = `*<${prUrl}|${prTitle}>*\n${icon} *${authorSlackName}* 님이 Review를 요청했습니다!! <@${targetSlackId}>:\n`;

    return SlackMessageBuilder.create(undefined, text, [attachment]);
  }

  /**
   * @param {Object} data
   * @returns {SlackMessage}
   */
  static formatScheduledReviewMessage(data) {
    const { prUrl, prTitle, body } = data;

    const attachment = SlackAttachmentBuilder.create(
      SLACK_CONFIG.MESSAGE_COLORS.SUCCESS,
      `\n<${prUrl}|PR 보러가기>.`,
    );

    const text = `*<${prUrl}|${prTitle}>* 에서 리뷰를 기다리고 있습니다. ${body}\n`;

    return SlackMessageBuilder.create(undefined, text, [attachment]);
  }

  /**
   * @param {DeploymentData} data
   * @returns {SlackMessage}
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

    const fields = [new SlackFieldBuilder().setTitle('Deploy Info').setValue('').build()];

    fields.push(
      SlackFieldBuilder.create('Repository', `<${repoUrl}|${repoName}>`, true),
      SlackFieldBuilder.create('Deploy Server', `https://${ec2Name}`, true),
      SlackFieldBuilder.create('Author', `<@${triggerUsername}>`, true),
      SlackFieldBuilder.create('Commit', `<${repoUrl}/commit/${sha}|${sha.slice(0, 7)}>`, true),
      SlackFieldBuilder.create('Image Tag', imageTag, true),
      SlackFieldBuilder.create('Run Time', duration, true),
      SlackFieldBuilder.create('Workflow', `<${workflowUrl}|${workflowName}>`, true),
      SlackFieldBuilder.create('Ref', ref, true),
    );

    const attachment = new SlackAttachmentBuilder()
      .setColor(color)
      .addFields(fields)
      .build();

    const text = `${icon}*${statusText}* *GitHub Actions Deploy Notification*`;

    return SlackMessageBuilder.create(undefined, text, [attachment]);
  }

  /**
   * @param {Object} data
   * @returns {SlackMessage}
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

    if (!isSuccess && failedJobs?.length > 0) {
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
      .build();

    const text = `${icon}*${statusText}* *GitHub Actions Build Notification*`;

    return SlackMessageBuilder.create(undefined, text, [attachment]);
  }
}

module.exports = SlackMessageFormatter;
