const Logger = require('./logger');

/**
 * GitHub 이미지를 Slack 포맷으로 변환하는 유틸리티
 */
class ImageUtils {
  /**
   * HTML 이미지 태그에서 이미지 URL 추출
   * @private
   * @static
   * @param {string} text - 분석할 텍스트
   * @returns {Object[]} 이미지 정보 배열 [{url, match}]
   */
  static #extractImageInfoFromHtml(text) {
    const imgTagPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const imageInfos = [];
    let match;

    while ((match = imgTagPattern.exec(text)) !== null) {
      const url = match[1];
      if (url && url.trim()) {
        imageInfos.push({
          url: url.trim(),
          match: match[0], // 전체 매치 문자열
        });
      }
    }

    return imageInfos;
  }

  /**
   * Markdown 이미지 문법에서 이미지 URL 추출
   * @private
   * @static
   * @param {string} text - 분석할 텍스트
   * @returns {Object[]} 이미지 정보 배열 [{url, match}]
   */
  static #extractImageInfoFromMarkdown(text) {
    const markdownPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const imageInfos = [];
    let match;

    while ((match = markdownPattern.exec(text)) !== null) {
      const url = match[2];
      if (url && url.trim()) {
        imageInfos.push({
          url: url.trim(),
          match: match[0], // 전체 매치 문자열
        });
      }
    }

    return imageInfos;
  }

  /**
   * GitHub 이미지 URL이 유효한지 확인
   * @private
   * @static
   * @param {string} url - 확인할 URL
   * @returns {boolean} 유효한 GitHub 이미지 URL 여부
   */
  static #isValidGitHubImageUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'github.com' &&
        urlObj.pathname.includes('/user-attachments/assets/');
    } catch {
      return false;
    }
  }

  /**
   * 이미지 태그/문법을 Slack 링크 형태로 변환
   * @static
   * @param {string} text - 변환할 텍스트
   * @returns {string} 변환된 텍스트
   */
  static convertImagesToSlackLinks(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let convertedText = text;
    let conversionCount = 0;

    // HTML img 태그 변환
    const htmlImageInfos = ImageUtils.#extractImageInfoFromHtml(text);
    htmlImageInfos.forEach((imageInfo) => {
      if (ImageUtils.#isValidGitHubImageUrl(imageInfo.url)) {
        const slackLink = `<${imageInfo.url}|[첨부이미지]>`;
        convertedText = convertedText.replace(imageInfo.match, slackLink);
        conversionCount += 1;
      }
    });

    // Markdown 이미지 문법 변환
    const markdownImageInfos = ImageUtils.#extractImageInfoFromMarkdown(convertedText);
    markdownImageInfos.forEach((imageInfo) => {
      if (ImageUtils.#isValidGitHubImageUrl(imageInfo.url)) {
        const slackLink = `<${imageInfo.url}|[첨부이미지]>`;
        convertedText = convertedText.replace(imageInfo.match, slackLink);
        conversionCount += 1;
      }
    });

    if (conversionCount > 0) {
      Logger.debug(`이미지를 Slack 링크로 변환 완료: ${conversionCount}개`, {
        originalLength: text.length,
        convertedLength: convertedText.length,
      });
    }

    return convertedText;
  }

  /**
   * 텍스트에서 이미지 URL 추출 (HTML + Markdown)
   * @static
   * @param {string} text - 분석할 텍스트
   * @returns {string[]} 이미지 URL 목록
   */
  static extractImageUrls(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const htmlImageInfos = ImageUtils.#extractImageInfoFromHtml(text);
    const markdownImageInfos = ImageUtils.#extractImageInfoFromMarkdown(text);

    const allUrls = [
      ...htmlImageInfos.map((info) => info.url),
      ...markdownImageInfos.map((info) => info.url),
    ];

    return [...new Set(allUrls)]; // 중복 제거
  }

  /**
   * 코멘트 텍스트에서 이미지를 처리하여 Slack 포맷으로 변환
   * @static
   * @param {string} commentText - 코멘트 텍스트
   * @returns {Object} 변환된 텍스트와 이미지 정보
   */
  static processCommentImages(commentText) {
    try {
      if (!commentText || typeof commentText !== 'string') {
        return {
          text: commentText,
          hasImages: false,
          imageCount: 0,
        };
      }

      const originalImageUrls = ImageUtils.extractImageUrls(commentText);
      const validImageUrls = originalImageUrls.filter(ImageUtils.#isValidGitHubImageUrl);
      const convertedText = ImageUtils.convertImagesToSlackLinks(commentText);

      Logger.debug('코멘트 이미지 처리 완료', {
        originalTextLength: commentText.length,
        totalImageCount: originalImageUrls.length,
        validImageCount: validImageUrls.length,
        convertedTextLength: convertedText.length,
      });

      return {
        text: convertedText,
        hasImages: validImageUrls.length > 0,
        imageCount: validImageUrls.length,
      };
    } catch (error) {
      Logger.error('코멘트 이미지 처리 실패', error);
      return {
        text: commentText, // 실패 시 원본 반환
        hasImages: false,
        imageCount: 0,
      };
    }
  }

  /**
   * 이미지가 포함된 코멘트인지 확인
   * @static
   * @param {string} text - 확인할 텍스트
   * @returns {boolean} 이미지 포함 여부
   */
  static hasImages(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const imageUrls = ImageUtils.extractImageUrls(text);
    return imageUrls.some(ImageUtils.#isValidGitHubImageUrl);
  }
}

module.exports = ImageUtils;
