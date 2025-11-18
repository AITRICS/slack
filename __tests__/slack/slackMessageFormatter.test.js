const SlackMessageFormatter = require('../../slack/slackMessageFormatter');

describe('SlackMessageFormatter', () => {
  describe('createMessage', () => {
    it('should create basic message structure', () => {
      const message = SlackMessageFormatter.createMessage('C12345', 'Test message');

      expect(message).toEqual({
        channel: 'C12345',
        text: 'Test message',
        attachments: [],
        mrkdwn: true,
      });
    });

    it('should create message with attachments', () => {
      const attachments = [{ color: 'good', text: 'Attachment' }];
      const message = SlackMessageFormatter.createMessage('C12345', 'Test', attachments);

      expect(message.attachments).toEqual(attachments);
    });
  });

  describe('createField', () => {
    it('should create short field', () => {
      const field = SlackMessageFormatter.createField('Title', 'Value', true);

      expect(field).toEqual({
        title: 'Title',
        value: 'Value',
        short: true,
      });
    });

    it('should create long field by default', () => {
      const field = SlackMessageFormatter.createField('Title', 'Value');

      expect(field.short).toBe(false);
    });
  });

  describe('createAttachment', () => {
    it('should create attachment with all properties', () => {
      const fields = [{ title: 'Test', value: 'Value', short: true }];
      const attachment = SlackMessageFormatter.createAttachment('good', 'Text', fields);

      expect(attachment).toEqual({
        color: 'good',
        text: 'Text',
        fields,
      });
    });

    it('should create attachment with defaults', () => {
      const attachment = SlackMessageFormatter.createAttachment('danger');

      expect(attachment).toEqual({
        color: 'danger',
        text: '',
        fields: [],
      });
    });
  });

  describe('formatCodeCommentMessage', () => {
    it('should format code comment with code snippet', () => {
      const data = {
        prUrl: 'https://github.com/test/repo/pull/1',
        prTitle: 'Test PR',
        commentUrl: 'https://github.com/test/repo/pull/1#comment',
        commentBody: 'Comment body',
        codeSnippet: 'const x = 1;',
        authorSlackName: 'John',
        targetSlackId: 'U12345',
      };

      const result = SlackMessageFormatter.formatCodeCommentMessage(data);

      expect(result.text).toContain('Test PR');
      expect(result.text).toContain('John');
      expect(result.text).toContain('<@U12345>');
      expect(result.attachment.text).toContain('```const x = 1;```');
      expect(result.attachment.text).toContain('Comment body');
      expect(result.attachment.color).toBe('good');
    });

    it('should format code comment without code snippet', () => {
      const data = {
        prUrl: 'https://github.com/test/repo/pull/1',
        prTitle: 'Test PR',
        commentUrl: 'https://github.com/test/repo/pull/1#comment',
        commentBody: 'Comment only',
        authorSlackName: 'John',
      };

      const result = SlackMessageFormatter.formatCodeCommentMessage(data);

      expect(result.attachment.text).not.toContain('```');
      expect(result.attachment.text).toContain('Comment only');
    });

    it('should handle mentions string', () => {
      const data = {
        prUrl: 'https://github.com/test/repo/pull/1',
        prTitle: 'Test PR',
        commentUrl: 'https://github.com/test/repo/pull/1#comment',
        commentBody: 'Comment',
        authorSlackName: 'John',
        mentionsString: '<@U1> <@U2>',
      };

      const result = SlackMessageFormatter.formatCodeCommentMessage(data);

      expect(result.text).toContain('<@U1> <@U2>');
    });
  });

  describe('formatDeploymentMessage', () => {
    it('should format successful deployment message', () => {
      const data = {
        status: 'success',
        repoUrl: 'https://github.com/test/repo',
        repoName: 'test-repo',
        ec2Name: 'prod-server',
        triggerUsername: 'deployer',
        sha: 'abc123def456',
        imageTag: 'v1.0.0',
        duration: '5분 30초',
        workflowUrl: 'https://github.com/test/repo/actions/runs/123',
        workflowName: 'Deploy',
        ref: 'refs/heads/main',
      };

      const result = SlackMessageFormatter.formatDeploymentMessage(data);

      expect(result.text).toContain('Succeeded');
      expect(result.text).toContain('Deploy Notification');
      expect(result.attachment.color).toBe('good');
      expect(result.attachment.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Deploy Server', value: 'https://prod-server' }),
          expect.objectContaining({ title: 'Image Tag', value: 'v1.0.0' }),
          expect.objectContaining({ title: 'Repository' }),
        ]),
      );
    });

    it('should format failed deployment message', () => {
      const data = {
        status: 'failure',
        repoUrl: 'https://github.com/test/repo',
        repoName: 'test-repo',
        ec2Name: 'prod-server',
        triggerUsername: 'deployer',
        sha: 'abc123def456',
        imageTag: 'v1.0.0',
        duration: '3분 15초',
        workflowUrl: 'https://github.com/test/repo/actions/runs/123',
        workflowName: 'Deploy',
        ref: 'refs/heads/main',
      };

      const result = SlackMessageFormatter.formatDeploymentMessage(data);

      expect(result.text).toContain('Failed');
      expect(result.attachment.color).toBe('danger');
    });
  });

  describe('formatBuildMessage', () => {
    it('should format successful build message', () => {
      const data = {
        status: 'success',
        repoUrl: 'https://github.com/test/repo',
        repoName: 'test-repo',
        branchName: 'main',
        triggerUsername: 'developer',
        sha: 'abc123def456',
        duration: '2분 30초',
        workflowUrl: 'https://github.com/test/repo/actions/runs/123',
        workflowName: 'CI',
        jobNames: [],
      };

      const result = SlackMessageFormatter.formatBuildMessage(data);

      expect(result.text).toContain('Succeeded');
      expect(result.text).toContain('Build Notification');
      expect(result.attachment.color).toBe('good');
    });

    it('should format failed build message with job names', () => {
      const data = {
        status: 'failure',
        repoUrl: 'https://github.com/test/repo',
        repoName: 'test-repo',
        branchName: 'feature-branch',
        triggerUsername: 'developer',
        sha: 'abc123def456',
        duration: '5분 15초',
        workflowUrl: 'https://github.com/test/repo/actions/runs/123',
        workflowName: 'CI',
        jobNames: ['lint', 'test', 'build'],
      };

      const result = SlackMessageFormatter.formatBuildMessage(data);

      expect(result.text).toContain('Failed');
      expect(result.attachment.color).toBe('danger');
      expect(result.attachment.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Job name list',
            value: '`lint`\n`test`\n`build`',
          }),
        ]),
      );
    });

    it('should handle build without image tag', () => {
      const data = {
        status: 'success',
        repoUrl: 'https://github.com/test/repo',
        repoName: 'test-repo',
        branchName: 'main',
        triggerUsername: 'developer',
        sha: 'abc123def456',
        duration: '2분',
        workflowUrl: 'https://github.com/test/repo/actions/runs/123',
        workflowName: 'CI',
        jobNames: [],
      };

      const result = SlackMessageFormatter.formatBuildMessage(data);

      const imageTagField = result.attachment.fields.find((f) => f.title === 'Image Tag');
      expect(imageTagField).toBeUndefined();
    });
  });
});
