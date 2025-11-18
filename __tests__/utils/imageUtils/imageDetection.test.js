/* Jest Best Practice FYI:
  https://jestjs.io/docs/jest-object#jestisolatemodulesfn
  https://stackoverflow.com/questions/64245013/difference-between-jest-mock-and-jest-domock
*/

describe('ImageUtils 이미지 감지 메서드들', () => {
  let ImageUtils;

  beforeAll(() => {
    const Logger = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    jest.doMock('@/utils/logger', () => Logger);
    ImageUtils = require('@/utils/imageUtils');
  });

  describe('hasGitHubImages', () => {
    describe('GitHub 이미지 포함된 경우', () => {
      test.each([
        [
          '<img src="https://github.com/user-attachments/assets/image.png" alt="github attachment"/>',
          'HTML - user-attachments',
        ],
        [
          '![test](https://raw.githubusercontent.com/owner/repo/main/image.jpg)',
          'Markdown - raw.githubusercontent.com',
        ],
        [
          '<img src="https://github.com/owner/repo/assets/image.gif" alt="repo assets"/>',
          'HTML - repo assets',
        ],
        [
          '![avatar](https://user-images.githubusercontent.com/123456/image.png)',
          'Markdown - user-images',
        ],
        [
          '<img src="https://avatars.githubusercontent.com/u/123456?v=4" alt="user avatar"/>',
          'HTML - avatars with query',
        ],
        [
          '![camo](https://camo.githubusercontent.com/hash/image.png)',
          'Markdown - camo',
        ],
      ])('GitHub 이미지 감지: %s (%s)', (text, _description) => {
        const result = ImageUtils.hasGitHubImages(text);
        expect(result).toBe(true);
      });

      test('여러 GitHub 이미지가 포함된 경우', () => {
        const text = `
          <img src="https://github.com/assets/image1.png" alt="github image 1"/>
          ![test](https://raw.githubusercontent.com/repo/image2.jpg)
          <img src="https://user-images.githubusercontent.com/123/image3.gif" alt="user image 3"/>
        `;

        const result = ImageUtils.hasGitHubImages(text);
        expect(result).toBe(true);
      });

      test('GitHub 이미지와 외부 이미지 혼합', () => {
        const text = `
          <img src="https://example.com/external.png" alt="external image"/>
          ![github](https://github.com/assets/github-image.png)
          <img src="https://imgur.com/another-external.jpg" alt="imgur image"/>
        `;

        const result = ImageUtils.hasGitHubImages(text);
        expect(result).toBe(true);
      });
    });

    describe('GitHub 이미지가 없는 경우', () => {
      test.each([
        [
          '<img src="https://example.com/image.png" alt="external image"/>',
          'HTML - 외부 이미지',
        ],
        [
          '![test](https://imgur.com/image.jpg)',
          'Markdown - Imgur',
        ],
        [
          '<img src="data:image/png;base64,abc123" alt="base64 image"/>',
          'HTML - Data URL',
        ],
        [
          '![local](./local-image.png)',
          'Markdown - 상대 경로',
        ],
        [
          'Just plain text without any images',
          '이미지 없는 텍스트',
        ],
        [
          '<p>HTML content</p><div>No images here</div>',
          'HTML 태그만 있는 텍스트',
        ],
      ])('GitHub 이미지 없음: %s (%s)', (text, _description) => {
        const result = ImageUtils.hasGitHubImages(text);
        expect(result).toBe(false);
      });

      test('외부 이미지만 있는 경우', () => {
        const text = `
          <img src="https://example.com/image1.png" alt="example image 1"/>
          ![test](https://imgur.com/image2.jpg)
          <img src="https://cdn.example.com/image3.gif" alt="cdn image"/>
        `;

        const result = ImageUtils.hasGitHubImages(text);
        expect(result).toBe(false);
      });
    });

    describe('유효하지 않은 입력', () => {
      test.each([
        [null, 'null'],
        [undefined, 'undefined'],
        ['', '빈 문자열'],
        [123, '숫자'],
        [{}, '객체'],
        [[], '배열'],
        [true, '불린'],
      ])('유효하지 않은 입력: %s (%s)', (input, _description) => {
        const result = ImageUtils.hasGitHubImages(input);
        expect(result).toBe(false);
      });
    });

    describe('경계값 테스트', () => {
      test('빈 src 속성', () => {
        const text = '<img src="" alt="empty"/>';
        const result = ImageUtils.hasGitHubImages(text);
        expect(result).toBe(false);
      });

      test('공백 src 속성', () => {
        const text = '<img src="   " alt="whitespace"/>';
        const result = ImageUtils.hasGitHubImages(text);
        expect(result).toBe(false);
      });

      test('잘못된 형식의 이미지 태그', () => {
        const text = `
          <img alt="no src attr">
          <img src alt="incomplete src">
          <img alt="no src"/>
          ![](
          ![incomplete
        `;

        const result = ImageUtils.hasGitHubImages(text);
        expect(result).toBe(false);
      });

      test('유사하지만 다른 도메인', () => {
        const text = `
          <img src="https://github-clone.com/image.png" alt="clone site"/>
          ![test](https://notgithub.com/image.jpg)
          <img src="https://github.example.com/image.gif" alt="fake github"/>
        `;

        const result = ImageUtils.hasGitHubImages(text);
        expect(result).toBe(false);
      });
    });
  });

  describe('hasImages', () => {
    describe('이미지가 포함된 경우', () => {
      test.each([
        [
          '<img src="https://github.com/assets/image.png" alt="github image"/>',
          'HTML - GitHub 이미지',
        ],
        [
          '![test](https://example.com/image.jpg)',
          'Markdown - 외부 이미지',
        ],
        [
          '<img src="data:image/png;base64,abc123" alt="base64 image"/>',
          'HTML - Data URL',
        ],
        [
          '![local](./relative-path.png)',
          'Markdown - 상대 경로',
        ],
        [
          '<img src="https://imgur.com/image.gif" alt="imgur image"/>',
          'HTML - Imgur',
        ],
        [
          '![cdn](https://cdn.example.com/image.jpg)',
          'Markdown - CDN',
        ],
      ])('이미지 감지: %s (%s)', (text, _description) => {
        const result = ImageUtils.hasImages(text);
        expect(result).toBe(true);
      });

      test('여러 종류의 이미지 혼합', () => {
        const text = `
          <img src="https://github.com/assets/github.png" alt="github image"/>
          ![external](https://example.com/external.jpg)
          <img src="data:image/png;base64,abc123" alt="base64 image"/>
          ![local](./local.gif)
        `;

        const result = ImageUtils.hasImages(text);
        expect(result).toBe(true);
      });

      test('텍스트 중간에 이미지', () => {
        const text = 'Some text before ![image](https://example.com/image.png) and after.';
        const result = ImageUtils.hasImages(text);
        expect(result).toBe(true);
      });

      test('복잡한 HTML 구조 내 이미지', () => {
        const text = `
          <div class="container">
            <p>Description</p>
            <div class="image-wrapper">
              <img src="https://example.com/image.png" alt="test" class="responsive"/>
            </div>
          </div>
        `;

        const result = ImageUtils.hasImages(text);
        expect(result).toBe(true);
      });
    });

    describe('이미지가 없는 경우', () => {
      test.each([
        [
          'Just plain text content',
          '일반 텍스트',
        ],
        [
          '<p>HTML content</p><div>without images</div>',
          'HTML 태그만',
        ],
        [
          '# Markdown header\n\n- List item\n- Another item',
          'Markdown 구조만',
        ],
        [
          '<img alt="no src attr"> <img src alt="incomplete src"> <img alt="no src"/>',
          '잘못된 img 태그들',
        ],
        [
          '![](  ) ![empty]() ![whitespace](   )',
          '빈 Markdown 이미지들',
        ],
      ])('이미지 없음: %s (%s)', (text, _description) => {
        const result = ImageUtils.hasImages(text);
        expect(result).toBe(false);
      });
    });

    describe('유효하지 않은 입력', () => {
      test.each([
        [null, 'null'],
        [undefined, 'undefined'],
        ['', '빈 문자열'],
        [123, '숫자'],
        [{}, '객체'],
        [[], '배열'],
        [false, '불린'],
      ])('유효하지 않은 입력: %s (%s)', (input, _description) => {
        const result = ImageUtils.hasImages(input);
        expect(result).toBe(false);
      });
    });
  });

  describe('hasGitHubImages vs hasImages 비교', () => {
    test('GitHub 이미지만 있는 경우', () => {
      const text = '<img src="https://github.com/assets/image.png" alt="github image"/>';

      expect(ImageUtils.hasGitHubImages(text)).toBe(true);
      expect(ImageUtils.hasImages(text)).toBe(true);
    });

    test('외부 이미지만 있는 경우', () => {
      const text = '<img src="https://example.com/image.png" alt="external image"/>';

      expect(ImageUtils.hasGitHubImages(text)).toBe(false);
      expect(ImageUtils.hasImages(text)).toBe(true);
    });

    test('GitHub과 외부 이미지 혼합', () => {
      const text = `
        <img src="https://github.com/assets/github.png" alt="github image"/>
        ![external](https://example.com/external.jpg)
      `;

      expect(ImageUtils.hasGitHubImages(text)).toBe(true);
      expect(ImageUtils.hasImages(text)).toBe(true);
    });

    test('이미지가 전혀 없는 경우', () => {
      const text = 'Just plain text content.';

      expect(ImageUtils.hasGitHubImages(text)).toBe(false);
      expect(ImageUtils.hasImages(text)).toBe(false);
    });

    test('다양한 시나리오의 논리적 일관성', () => {
      const testCases = [
        {
          text: '<img src="https://github.com/assets/test.png" alt="github test"/>',
          expectedGitHub: true,
          expectedAny: true,
          description: 'GitHub 이미지만',
        },
        {
          text: '<img src="https://imgur.com/test.png" alt="imgur test"/>',
          expectedGitHub: false,
          expectedAny: true,
          description: '외부 이미지만',
        },
        {
          text: 'No images here',
          expectedGitHub: false,
          expectedAny: false,
          description: '이미지 없음',
        },
        {
          text: `
            <img src="https://github.com/assets/github.png" alt="github image"/>
            <img src="https://example.com/external.png" alt="external image"/>
          `,
          expectedGitHub: true,
          expectedAny: true,
          description: '혼합',
        },
      ];

      testCases.forEach(({
        text, expectedGitHub, expectedAny, description: _description,
      }) => {
        const hasGitHub = ImageUtils.hasGitHubImages(text);
        const hasAny = ImageUtils.hasImages(text);

        expect(hasGitHub).toBe(expectedGitHub);
        expect(hasAny).toBe(expectedAny);

        // 논리적 일관성: GitHub 이미지가 있으면 반드시 전체 이미지도 있어야 함
        const isLogicallyConsistent = !hasGitHub || hasAny;
        expect(isLogicallyConsistent).toBe(true);
      });
    });
  });

  describe('성능 테스트', () => {
    test('큰 텍스트에서의 이미지 감지 성능', () => {
      const largeText = `${'Large text content. '.repeat(10000)
      }<img src="https://github.com/assets/image.png" alt="github image"/>${
        'More content. '.repeat(10000)}`;

      const start = Date.now();
      const hasGitHub = ImageUtils.hasGitHubImages(largeText);
      const hasAny = ImageUtils.hasImages(largeText);
      const duration = Date.now() - start;

      expect(hasGitHub).toBe(true);
      expect(hasAny).toBe(true);
      expect(duration).toBeLessThan(50); // 50ms 이내
    });

    test('많은 이미지가 포함된 텍스트', () => {
      const manyImages = Array.from({ length: 1000 }, (_, i) => (
        i % 2 === 0 ?
          `<img src="https://github.com/assets/image${i}.png" alt="github image ${i}"/>` :
          `![test${i}](https://example.com/image${i}.jpg)`
      )).join(' ');

      const start = Date.now();
      const hasGitHub = ImageUtils.hasGitHubImages(manyImages);
      const hasAny = ImageUtils.hasImages(manyImages);
      const duration = Date.now() - start;

      expect(hasGitHub).toBe(true); // GitHub 이미지 500개
      expect(hasAny).toBe(true); // 전체 이미지 1000개
      expect(duration).toBeLessThan(100); // 100ms 이내
    });

    test('이미지가 없는 큰 텍스트 처리 성능', () => {
      const largeTextNoImages = 'Text without images. '.repeat(50000);

      const start = Date.now();
      const hasGitHub = ImageUtils.hasGitHubImages(largeTextNoImages);
      const hasAny = ImageUtils.hasImages(largeTextNoImages);
      const duration = Date.now() - start;

      expect(hasGitHub).toBe(false);
      expect(hasAny).toBe(false);
      expect(duration).toBeLessThan(30); // 30ms 이내 (이미지가 없으면 더 빨라야 함)
    });
  });

  describe('실제 GitHub 사용 시나리오', () => {
    test('일반적인 PR 설명', () => {
      const prDescription = `
        # 새로운 기능 추가
        
        이 PR은 사용자 프로필 기능을 추가합니다.
        
        ## 변경사항
        - 프로필 페이지 추가
        - 아바타 업로드 기능
        
        ## 스크린샷
        ![Profile Page](https://github.com/user-attachments/assets/profile-page.png)
        
        ## 테스트
        모든 테스트가 통과했습니다.
      `;

      expect(ImageUtils.hasGitHubImages(prDescription)).toBe(true);
      expect(ImageUtils.hasImages(prDescription)).toBe(true);
    });

    test('이슈 리포트 with 스크린샷', () => {
      const issueReport = `
        ## 버그 설명
        로그인 후 대시보드에서 에러가 발생합니다.
        
        ## 에러 스크린샷
        <img src="https://user-images.githubusercontent.com/12345/error-screenshot.png" alt="Error"/>
        
        ## 브라우저 콘솔
        <img src="https://github.com/assets/console-error.png" alt="console error"/>
        
        ## 환경
        - Chrome 120
        - Windows 10
      `;

      expect(ImageUtils.hasGitHubImages(issueReport)).toBe(true);
      expect(ImageUtils.hasImages(issueReport)).toBe(true);
    });

    test('코드 리뷰 코멘트 without 이미지', () => {
      const reviewComment = `
        이 변경사항은 좋아 보입니다!
        
        몇 가지 제안사항:
        1. 변수명을 더 명확하게 하면 좋겠습니다
        2. 에러 핸들링을 추가해주세요
        
        LGTM! 👍
      `;

      expect(ImageUtils.hasGitHubImages(reviewComment)).toBe(false);
      expect(ImageUtils.hasImages(reviewComment)).toBe(false);
    });

    test('외부 이미지만 포함된 코멘트', () => {
      const commentWithExternalImages = `
        참고할 만한 디자인입니다:
        
        ![Design Reference](https://dribbble.com/shot/12345/image.png)
        
        이런 스타일은 어떨까요?
        <img src="https://unsplash.com/photo/example.jpg" alt="unsplash photo"/>
      `;

      expect(ImageUtils.hasGitHubImages(commentWithExternalImages)).toBe(false);
      expect(ImageUtils.hasImages(commentWithExternalImages)).toBe(true);
    });
  });
});
