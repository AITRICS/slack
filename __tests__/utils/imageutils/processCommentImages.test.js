/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

describe('ImageUtils.processCommentImages', () => {
  let ImageUtils;
  let Logger;

  beforeAll(() => {
    Logger = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    jest.doMock('@/utils/logger', () => Logger);
    ImageUtils = require('@/utils/imageUtils');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('성공적인 이미지 처리', () => {
    test('GitHub 이미지가 포함된 코멘트 처리', () => {
      const commentText = `
        이것은 코멘트입니다.
        <img src="https://github.com/user-attachments/assets/image1.png" alt="test image"/>
        ![markdown image](https://raw.githubusercontent.com/repo/image2.jpg)
        추가 텍스트입니다.
      `;

      const result = ImageUtils.processCommentImages(commentText);

      expect(result).toEqual({
        text: expect.stringContaining('<https://github.com/user-attachments/assets/image1.png|[test image]>'),
        hasImages: true,
        imageCount: 2,
        githubImageCount: 2,
      });

      expect(result.text).toContain('<https://raw.githubusercontent.com/repo/image2.jpg|[markdown image]>');
      expect(result.text).toContain('이것은 코멘트입니다.');
      expect(result.text).toContain('추가 텍스트입니다.');

      expect(Logger.debug).toHaveBeenCalledWith(
        '코멘트 이미지 처리 완료',
        expect.objectContaining({
          originalTextLength: commentText.length,
          totalImageCount: 2,
          githubImageCount: 2,
          convertedTextLength: expect.any(Number),
          supportedPatterns: expect.any(Array),
        }),
      );
    });

    test('GitHub 이미지와 외부 이미지 혼합', () => {
      const commentText = `
        코멘트 내용입니다.
        <img src="https://github.com/user-attachments/assets/image1.png" alt="github"/>
        ![external](https://example.com/external.png)
        <img src="https://raw.githubusercontent.com/repo/image2.jpg"/>
      `;

      const result = ImageUtils.processCommentImages(commentText);

      expect(result).toEqual({
        text: expect.any(String),
        hasImages: true,
        imageCount: 3,
        githubImageCount: 2,
      });

      // GitHub 이미지만 변환됨
      expect(result.text).toContain('<https://github.com/user-attachments/assets/image1.png|[github]>');
      expect(result.text).toContain('<https://raw.githubusercontent.com/repo/image2.jpg|[첨부이미지]>');

      // 외부 이미지는 변환되지 않음
      expect(result.text).toContain('![external](https://example.com/external.png)');
    });

    test('복잡한 HTML 구조가 포함된 코멘트', () => {
      const commentText = `
        <h3>제목</h3>
        <p>설명 텍스트</p>
        <div class="image-container">
          <img src="https://github.com/assets/screenshot.png" alt="Screenshot" width="500"/>
        </div>
        <ul>
          <li>항목 1</li>
          <li>항목 2</li>
        </ul>
      `;

      const result = ImageUtils.processCommentImages(commentText);

      expect(result.hasImages).toBe(true);
      expect(result.imageCount).toBe(1);
      expect(result.githubImageCount).toBe(1);
      expect(result.text).toContain('<https://github.com/assets/screenshot.png|[Screenshot]>');
      expect(result.text).toContain('<h3>제목</h3>');
      expect(result.text).toContain('<div class="image-container">');
    });

    test('여러 GitHub 도메인 패턴 처리', () => {
      const commentText = `
        다양한 GitHub 이미지들:
        <img src="https://github.com/user-attachments/assets/image1.png"/>
        ![raw](https://raw.githubusercontent.com/owner/repo/main/image2.jpg)
        <img src="https://user-images.githubusercontent.com/123456/image3.gif"/>
        ![avatar](https://avatars.githubusercontent.com/u/789?v=4)
      `;

      const result = ImageUtils.processCommentImages(commentText);

      expect(result.hasImages).toBe(true);
      expect(result.imageCount).toBe(4);
      expect(result.githubImageCount).toBe(4);

      // 모든 GitHub 이미지가 변환됨
      expect(result.text).toContain('<https://github.com/user-attachments/assets/image1.png|[첨부이미지]>');
      expect(result.text).toContain('<https://raw.githubusercontent.com/owner/repo/main/image2.jpg|[raw]>');
      expect(result.text).toContain('<https://user-images.githubusercontent.com/123456/image3.gif|[첨부이미지]>');
      expect(result.text).toContain('<https://avatars.githubusercontent.com/u/789?v=4|[avatar]>');
    });
  });

  describe('이미지가 없는 코멘트', () => {
    test('일반 텍스트만 있는 코멘트', () => {
      const commentText = '이것은 일반 텍스트 코멘트입니다. 이미지가 없습니다.';
      const result = ImageUtils.processCommentImages(commentText);

      expect(result).toEqual({
        text: commentText,
        hasImages: false,
        imageCount: 0,
        githubImageCount: 0,
      });

      expect(Logger.debug).toHaveBeenCalledWith(
        '코멘트 이미지 처리 완료',
        expect.objectContaining({
          totalImageCount: 0,
          githubImageCount: 0,
        }),
      );
    });

    test('HTML이 있지만 이미지는 없는 코멘트', () => {
      const commentText = `
        <h2>제목</h2>
        <p>일반 <strong>텍스트</strong>입니다.</p>
        <ul><li>목록 항목</li></ul>
      `;

      const result = ImageUtils.processCommentImages(commentText);

      expect(result).toEqual({
        text: commentText,
        hasImages: false,
        imageCount: 0,
        githubImageCount: 0,
      });
    });

    test('외부 이미지만 있는 코멘트', () => {
      const commentText = `
        외부 이미지들:
        <img src="https://example.com/image1.png"/>
        ![external](https://imgur.com/image2.jpg)
      `;

      const result = ImageUtils.processCommentImages(commentText);

      expect(result).toEqual({
        text: commentText, // 변환되지 않은 원본
        hasImages: true,
        imageCount: 2,
        githubImageCount: 0,
      });
    });
  });

  describe('유효하지 않은 입력 처리', () => {
    test.each([
      [null, 'null'],
      [undefined, 'undefined'],
      ['', '빈 문자열'],
      [123, '숫자'],
      [{}, '객체'],
      [[], '배열'],
      [true, '불린'],
    ])('유효하지 않은 입력: %s (%s)', (input, _description) => {
      const result = ImageUtils.processCommentImages(input);

      expect(result).toEqual({
        text: input,
        hasImages: false,
        imageCount: 0,
        githubImageCount: 0,
      });

      expect(Logger.debug).toHaveBeenCalledWith(
        '코멘트 이미지 처리 완료',
        expect.objectContaining({
          totalImageCount: 0,
          githubImageCount: 0,
        }),
      );
    });
  });

  describe('에러 처리', () => {
    test('이미지 URL 추출 중 에러 발생', () => {
      // extractImageUrls 메서드를 일시적으로 mock하여 에러 상황 생성
      const originalExtractImageUrls = ImageUtils.extractImageUrls;
      ImageUtils.extractImageUrls = jest.fn(() => {
        throw new Error('URL 추출 에러');
      });

      const commentText = '테스트 코멘트';
      const result = ImageUtils.processCommentImages(commentText);

      expect(result).toEqual({
        text: commentText,
        hasImages: false,
        imageCount: 0,
        githubImageCount: 0,
      });

      expect(Logger.error).toHaveBeenCalledWith(
        '코멘트 이미지 처리 실패',
        expect.any(Error),
      );

      // 원본 메서드 복원
      ImageUtils.extractImageUrls = originalExtractImageUrls;
    });

    test('GitHub 이미지 URL 추출 중 에러 발생', () => {
      // extractGitHubImageUrls 메서드를 일시적으로 mock하여 에러 상황 생성
      const originalExtractGitHubImageUrls = ImageUtils.extractGitHubImageUrls;
      ImageUtils.extractGitHubImageUrls = jest.fn(() => {
        throw new Error('GitHub URL 추출 에러');
      });

      const commentText = '테스트 코멘트';
      const result = ImageUtils.processCommentImages(commentText);

      expect(result).toEqual({
        text: commentText,
        hasImages: false,
        imageCount: 0,
        githubImageCount: 0,
      });

      expect(Logger.error).toHaveBeenCalledWith(
        '코멘트 이미지 처리 실패',
        expect.any(Error),
      );

      // 원본 메서드 복원
      ImageUtils.extractGitHubImageUrls = originalExtractGitHubImageUrls;
    });

    test('이미지 변환 중 에러 발생', () => {
      // convertImagesToSlackLinks 메서드를 일시적으로 mock하여 에러 상황 생성
      const originalConvertImagesToSlackLinks = ImageUtils.convertImagesToSlackLinks;
      ImageUtils.convertImagesToSlackLinks = jest.fn(() => {
        throw new Error('이미지 변환 에러');
      });

      const commentText = '테스트 코멘트';
      const result = ImageUtils.processCommentImages(commentText);

      expect(result).toEqual({
        text: commentText,
        hasImages: false,
        imageCount: 0,
        githubImageCount: 0,
      });

      expect(Logger.error).toHaveBeenCalledWith(
        '코멘트 이미지 처리 실패',
        expect.any(Error),
      );

      // 원본 메서드 복원
      ImageUtils.convertImagesToSlackLinks = originalConvertImagesToSlackLinks;
    });
  });

  describe('반환 데이터 검증', () => {
    test('반환 객체 구조 검증', () => {
      const commentText = '<img src="https://github.com/assets/test.png"/>';
      const result = ImageUtils.processCommentImages(commentText);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('hasImages');
      expect(result).toHaveProperty('imageCount');
      expect(result).toHaveProperty('githubImageCount');

      expect(typeof result.text).toBe('string');
      expect(typeof result.hasImages).toBe('boolean');
      expect(typeof result.imageCount).toBe('number');
      expect(typeof result.githubImageCount).toBe('number');
    });

    test('이미지 개수 정확성 검증', () => {
      const commentText = `
        <img src="https://github.com/assets/github1.png"/>
        ![test](https://example.com/external1.jpg)
        <img src="https://raw.githubusercontent.com/repo/github2.gif"/>
        ![external](https://imgur.com/external2.png)
        <img src="https://user-images.githubusercontent.com/123/github3.jpg"/>
      `;

      const result = ImageUtils.processCommentImages(commentText);

      expect(result.imageCount).toBe(5); // 전체 이미지 수
      expect(result.githubImageCount).toBe(3); // GitHub 이미지 수
      expect(result.hasImages).toBe(true);
    });

    test('변환된 텍스트 길이 변화 검증', () => {
      const commentText = '<img src="https://github.com/assets/test.png" alt="test"/>';
      const result = ImageUtils.processCommentImages(commentText);

      expect(result.text.length).not.toBe(commentText.length);
      expect(result.text).toBe('<https://github.com/assets/test.png|[test]>');

      expect(Logger.debug).toHaveBeenCalledWith(
        '코멘트 이미지 처리 완료',
        expect.objectContaining({
          originalTextLength: commentText.length,
          convertedTextLength: result.text.length,
        }),
      );
    });
  });

  describe('성능 테스트', () => {
    test('대량의 이미지가 포함된 코멘트 처리', () => {
      const commentText = Array.from({ length: 100 }, (_, i) => (
        `<img src="https://github.com/assets/image${i}.png" alt="image${i}"/>`
      )).join('\n');

      const start = Date.now();
      const result = ImageUtils.processCommentImages(commentText);
      const duration = Date.now() - start;

      expect(result.imageCount).toBe(100);
      expect(result.githubImageCount).toBe(100);
      expect(result.hasImages).toBe(true);
      expect(duration).toBeLessThan(200); // 200ms 이내
    });

    test('큰 텍스트에서 소수 이미지 처리', () => {
      const largeText = `${'Long comment text. '.repeat(10000)
      }<img src="https://github.com/assets/image.png"/>${
        'More text. '.repeat(5000)}`;

      const start = Date.now();
      const result = ImageUtils.processCommentImages(largeText);
      const duration = Date.now() - start;

      expect(result.imageCount).toBe(1);
      expect(result.githubImageCount).toBe(1);
      expect(result.hasImages).toBe(true);
      expect(duration).toBeLessThan(100); // 100ms 이내
    });
  });

  describe('실제 GitHub 코멘트 시나리오', () => {
    test('코드 리뷰 코멘트 with 스크린샷', () => {
      const commentText = `
        이 변경사항에 대해 확인했습니다.
        
        UI 변화를 보여주는 스크린샷입니다:
        ![Before](https://github.com/user-attachments/assets/before-123.png)
        ![After](https://github.com/user-attachments/assets/after-456.png)
        
        전체적으로 좋은 변경입니다! 👍
      `;

      const result = ImageUtils.processCommentImages(commentText);

      expect(result.imageCount).toBe(2);
      expect(result.githubImageCount).toBe(2);
      expect(result.text).toContain('<https://github.com/user-attachments/assets/before-123.png|[Before]>');
      expect(result.text).toContain('<https://github.com/user-attachments/assets/after-456.png|[After]>');
      expect(result.text).toContain('전체적으로 좋은 변경입니다! 👍');
    });

    test('이슈 설명 with 에러 스크린샷', () => {
      const commentText = `
        # 버그 리포트
        
        다음 에러가 발생합니다:
        
        <img src="https://user-images.githubusercontent.com/12345/error-screenshot.png" alt="Error Screenshot"/>
        
        ## 재현 단계
        1. 로그인
        2. 대시보드 접근
        3. 에러 발생
        
        추가 정보: <img src="https://github.com/assets/console-log.png" alt="Console"/>
      `;

      const result = ImageUtils.processCommentImages(commentText);

      expect(result.imageCount).toBe(2);
      expect(result.githubImageCount).toBe(2);
      expect(result.text).toContain('<https://user-images.githubusercontent.com/12345/error-screenshot.png|[Error Screenshot]>');
      expect(result.text).toContain('<https://github.com/assets/console-log.png|[Console]>');
      expect(result.text).toContain('# 버그 리포트');
      expect(result.text).toContain('## 재현 단계');
    });
  });
});
