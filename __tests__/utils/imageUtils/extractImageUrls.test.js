/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

describe('ImageUtils URL 추출 메서드들', () => {
  let ImageUtils;

  beforeAll(() => {
    const Logger = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    jest.doMock('@/utils/logger', () => Logger);
    ImageUtils = require('@/utils/imageUtils');
  });

  describe('extractImageUrls', () => {
    test('HTML 이미지 태그에서 URL 추출', () => {
      const text = `
        <img src="https://github.com/assets/image1.png" alt="github image"/>
        <img src="https://example.com/image2.jpg" alt="test"/>
        <img class="image" src="https://raw.githubusercontent.com/repo/image3.gif" width="100" alt="raw image"/>
      `;

      const result = ImageUtils.extractImageUrls(text);

      expect(result).toEqual([
        'https://github.com/assets/image1.png',
        'https://example.com/image2.jpg',
        'https://raw.githubusercontent.com/repo/image3.gif',
      ]);
    });

    test('Markdown 이미지 문법에서 URL 추출', () => {
      const text = `
        ![test](https://github.com/assets/image1.png)
        ![](https://example.com/image2.jpg)
        ![alt text](https://raw.githubusercontent.com/repo/image3.gif)
      `;

      const result = ImageUtils.extractImageUrls(text);

      expect(result).toEqual([
        'https://github.com/assets/image1.png',
        'https://example.com/image2.jpg',
        'https://raw.githubusercontent.com/repo/image3.gif',
      ]);
    });

    test('HTML과 Markdown 혼합에서 URL 추출', () => {
      const text = `
        <img src="https://github.com/assets/image1.png" alt="github image"/>
        ![test](https://raw.githubusercontent.com/repo/image2.jpg)
        <img src="https://example.com/image3.png" alt="example image"/>
        ![markdown](https://user-images.githubusercontent.com/123/image4.gif)
      `;

      const result = ImageUtils.extractImageUrls(text);

      expect(result).toEqual([
        'https://github.com/assets/image1.png',
        'https://raw.githubusercontent.com/repo/image2.jpg',
        'https://example.com/image3.png',
        'https://user-images.githubusercontent.com/123/image4.gif',
      ]);
    });

    test('중복 URL 제거', () => {
      const text = `
        <img src="https://github.com/assets/image1.png" alt="duplicate image"/>
        ![test](https://github.com/assets/image1.png)
        <img src="https://example.com/image2.png" alt="example image"/>
        ![duplicate](https://github.com/assets/image1.png)
      `;

      const result = ImageUtils.extractImageUrls(text);

      expect(result).toEqual([
        'https://github.com/assets/image1.png',
        'https://example.com/image2.png',
      ]);
    });

    test('특수 문자가 포함된 URL 추출', () => {
      const text = `
        <img src="https://github.com/assets/image_name-123.png?v=1&token=abc" alt="special chars image"/>
        ![test](https://raw.githubusercontent.com/repo/path/to/image%20with%20spaces.jpg)
      `;

      const result = ImageUtils.extractImageUrls(text);

      expect(result).toEqual([
        'https://github.com/assets/image_name-123.png?v=1&token=abc',
        'https://raw.githubusercontent.com/repo/path/to/image%20with%20spaces.jpg',
      ]);
    });

    test('빈 또는 공백 src 속성 무시', () => {
      const text = `
        <img src="" alt="empty src"/>
        <img src="   " alt="whitespace src"/>
        <img src="https://github.com/assets/valid.png" alt="valid image"/>
        ![empty]()
        ![whitespace](   )
        ![valid](https://example.com/valid.jpg)
      `;

      const result = ImageUtils.extractImageUrls(text);

      expect(result).toEqual([
        'https://github.com/assets/valid.png',
        'https://example.com/valid.jpg',
      ]);
    });

    test.each([
      ['', '빈 문자열'],
      [null, 'null'],
      [undefined, 'undefined'],
      [123, '숫자'],
      [{}, '객체'],
    ])('유효하지 않은 입력: %s (%s)', (input, _description) => {
      const result = ImageUtils.extractImageUrls(input);
      expect(result).toEqual([]);
    });

    test('이미지가 없는 텍스트', () => {
      const text = 'This is a text without any images. Just some <p>HTML</p> tags.';
      const result = ImageUtils.extractImageUrls(text);
      expect(result).toEqual([]);
    });

    test('잘못된 형식의 이미지 태그 무시', () => {
      const text = `
        <img alt="no src attr">
        <img src alt="incomplete src">
        <img alt="no src"/>
        <img src="https://valid.com/image.png" alt="valid image"/>
        ![](
        ![incomplete
        ![valid](https://valid.com/image2.png)
      `;

      const result = ImageUtils.extractImageUrls(text);

      expect(result).toEqual([
        'https://valid.com/image.png',
        'https://valid.com/image2.png',
      ]);
    });
  });

  describe('extractGitHubImageUrls', () => {
    test('GitHub 이미지 URL만 필터링', () => {
      const text = `
        <img src="https://github.com/user-attachments/assets/image1.png" alt="github attachment"/>
        ![test](https://raw.githubusercontent.com/repo/image2.jpg)
        <img src="https://example.com/image3.png" alt="external image"/>
        ![github](https://user-images.githubusercontent.com/123/image4.gif)
        <img src="https://imgur.com/image5.png" alt="imgur image"/>
      `;

      const result = ImageUtils.extractGitHubImageUrls(text);

      expect(result).toEqual([
        'https://github.com/user-attachments/assets/image1.png',
        'https://raw.githubusercontent.com/repo/image2.jpg',
        'https://user-images.githubusercontent.com/123/image4.gif',
      ]);
    });

    test.each([
      [
        'https://github.com/user-attachments/assets/image.png',
        true,
        'user-attachments 패턴',
      ],
      [
        'https://raw.githubusercontent.com/owner/repo/main/image.jpg',
        true,
        'raw.githubusercontent.com 패턴',
      ],
      [
        'https://github.com/owner/repo/assets/image.gif',
        true,
        'repo assets 패턴',
      ],
      [
        'https://user-images.githubusercontent.com/123456/image.png',
        true,
        'user-images 패턴',
      ],
      [
        'https://avatars.githubusercontent.com/u/123456?v=4',
        true,
        'avatars 패턴',
      ],
      [
        'https://camo.githubusercontent.com/abc123/image.png',
        true,
        'camo 패턴',
      ],
      [
        'https://example.com/image.png',
        false,
        '외부 이미지',
      ],
      [
        'https://imgur.com/image.jpg',
        false,
        'Imgur',
      ],
      [
        'https://cdn.jsdelivr.net/gh/user/repo/image.png',
        false,
        'CDN 이미지',
      ],
    ])('GitHub 패턴 매칭: %s → %s (%s)', (url, shouldMatch, _description) => {
      const text = `<img src="${url}" alt="test image"/>`;
      const result = ImageUtils.extractGitHubImageUrls(text);

      // 조건부 expect 제거 - 대신 명확한 방식으로 검증
      const expectedLength = shouldMatch ? 1 : 0;
      expect(result).toHaveLength(expectedLength);
      expect(result.includes(url)).toBe(shouldMatch);
    });

    test('GitHub 이미지가 없는 경우', () => {
      const text = `
        <img src="https://example.com/image.png" alt="example image"/>
        ![test](https://imgur.com/image.jpg)
        <img src="data:image/png;base64,abc123" alt="base64 image"/>
      `;

      const result = ImageUtils.extractGitHubImageUrls(text);
      expect(result).toEqual([]);
    });

    test('GitHub 이미지와 외부 이미지 혼합', () => {
      const text = `
        <img src="https://github.com/assets/github1.png" alt="github image 1"/>
        <img src="https://example.com/external.png" alt="external image"/>
        ![GitHub](https://raw.githubusercontent.com/repo/github2.jpg)
        ![External](https://imgur.com/external.gif)
        <img src="https://user-images.githubusercontent.com/123/github3.png" alt="github image 3"/>
      `;

      const result = ImageUtils.extractGitHubImageUrls(text);

      expect(result).toEqual([
        'https://github.com/assets/github1.png',
        'https://raw.githubusercontent.com/repo/github2.jpg',
        'https://user-images.githubusercontent.com/123/github3.png',
      ]);
    });

    test('유효하지 않은 입력 처리', () => {
      expect(ImageUtils.extractGitHubImageUrls(null)).toEqual([]);
      expect(ImageUtils.extractGitHubImageUrls(undefined)).toEqual([]);
      expect(ImageUtils.extractGitHubImageUrls('')).toEqual([]);
      expect(ImageUtils.extractGitHubImageUrls(123)).toEqual([]);
    });

    test('복잡한 GitHub URL 패턴', () => {
      const text = `
        <img src="https://github.com/user-attachments/assets/complex-name_123.png?v=1&size=large" alt="complex image"/>
        ![Query](https://raw.githubusercontent.com/org/repo/branch/path/to/image.jpg?token=abc123)
        <img src="https://user-images.githubusercontent.com/12345678/image-name.gif#anchor" alt="user image"/>
      `;

      const result = ImageUtils.extractGitHubImageUrls(text);

      expect(result).toHaveLength(3);
      expect(result).toContain('https://github.com/user-attachments/assets/complex-name_123.png?v=1&size=large');
      expect(result).toContain('https://raw.githubusercontent.com/org/repo/branch/path/to/image.jpg?token=abc123');
      expect(result).toContain('https://user-images.githubusercontent.com/12345678/image-name.gif#anchor');
    });

    test('GitHub 도메인 변형 처리', () => {
      const text = `
        <img src="https://github.com/owner/repo/assets/image1.png" alt="repo assets"/>
        <img src="https://raw.githubusercontent.com/owner/repo/main/image2.jpg" alt="raw image"/>
        <img src="https://user-images.githubusercontent.com/123/image3.gif" alt="user image"/>
        <img src="https://avatars.githubusercontent.com/u/456?v=4" alt="avatar"/>
        <img src="https://camo.githubusercontent.com/hash/image4.png" alt="camo image"/>
      `;

      const result = ImageUtils.extractGitHubImageUrls(text);

      expect(result).toHaveLength(5);
      expect(result.every((url) => url.includes('github'))).toBe(true);
    });
  });

  describe('URL 추출 성능 테스트', () => {
    test('대량의 이미지가 포함된 텍스트 처리', () => {
      const largeText = Array.from({ length: 100 }, (_, i) => (
        `<img src="https://github.com/assets/image${i}.png" alt="image${i}"/> ![md${i}](https://raw.githubusercontent.com/repo/img${i}.jpg)`
      )).join('\n');

      const start = Date.now();
      const allUrls = ImageUtils.extractImageUrls(largeText);
      const githubUrls = ImageUtils.extractGitHubImageUrls(largeText);
      const duration = Date.now() - start;

      expect(allUrls).toHaveLength(200); // 100개 HTML + 100개 Markdown
      expect(githubUrls).toHaveLength(200); // 모두 GitHub 이미지
      expect(duration).toBeLessThan(100); // 100ms 이내
    });

    test('큰 텍스트에서 소수의 이미지 추출', () => {
      const largeText = `${'Text content. '.repeat(10000)
      }<img src="https://github.com/assets/image1.png" alt="test image"/>${
        'More text. '.repeat(5000)
      }![test](https://raw.githubusercontent.com/repo/image2.jpg)${
        'Even more text. '.repeat(10000)}`;

      const start = Date.now();
      const result = ImageUtils.extractGitHubImageUrls(largeText);
      const duration = Date.now() - start;

      expect(result).toEqual([
        'https://github.com/assets/image1.png',
        'https://raw.githubusercontent.com/repo/image2.jpg',
      ]);
      expect(duration).toBeLessThan(50); // 50ms 이내
    });
  });
});
