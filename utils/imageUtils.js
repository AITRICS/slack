const Logger = require('./logger');

/**
 * GitHub 이미지를 Slack 포맷으로 변환하는 유틸리티
 */
class ImageUtils {
  /**
   * HTML 이미지 태그에서 이미지 URL 추출
   * @static
   * @param {string} text - 분석할 텍스트
   * @returns {string[]} 이미지 URL 목록
   */
  static extractImageUrls(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // HTML img 태그에서 src 속성 추출 (다양한 형태 지원)
    const imgTagPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const urls = [];
    let match;

    while ((match = imgTagPattern.exec(text)) !== null) {
      const url = match[1];
      if (url && url.trim()) {
        urls.push(url.trim());
      }
    }

    return [...new Set(urls)]; // 중복 제거
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
   * HTML 이미지 태그를 Slack 포맷으로 변환
   * @static
   * @param {string} text - 변환할 텍스트
   * @returns {string} 변환된 텍스트
   */
  static convertImagesToSlackFormat(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    const imgTagPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let conversionCount = 0;

    const convertedText = text.replace(imgTagPattern, (match, src) => {
      if (ImageUtils.#isValidGitHubImageUrl(src)) {
        conversionCount += 1;
        return `\n📷 *첨부 이미지:* ${src}`;
      }
      return match; // GitHub 이미지가 아닌 경우 원본 유지
    });

    if (conversionCount > 0) {
      Logger.debug(`이미지 태그 변환 완료: ${conversionCount}개`, {
        originalLength: text.length,
        convertedLength: convertedText.length,
      });
    }

    return convertedText;
  }

  /**
   * 이미지 URL들을 Slack attachment 형태로 생성
   * @static
   * @param {string[]} imageUrls - 이미지 URL 목록
   * @returns {Object[]} Slack attachment 배열
   */
  static createSlackImageAttachments(imageUrls) {
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return [];
    }

    const validUrls = imageUrls.filter(ImageUtils.#isValidGitHubImageUrl);

    return validUrls.map((url, index) => ({
      color: '#36a64f',
      image_url: url,
      fallback: `첨부 이미지 ${index + 1}`,
      title: validUrls.length > 1 ? `첨부 이미지 ${index + 1}` : '첨부 이미지',
      title_link: url,
    }));
  }

  /**
   * 코멘트 텍스트에서 이미지를 처리하여 Slack 포맷으로 변환 (통합 함수)
   * @static
   * @param {string} commentText - 코멘트 텍스트
   * @returns {Object} 변환된 텍스트와 이미지 첨부 정보
   */
  static processCommentImages(commentText) {
    try {
      if (!commentText || typeof commentText !== 'string') {
        return {
          text: commentText,
          imageAttachments: [],
          hasImages: false,
        };
      }

      const imageUrls = ImageUtils.extractImageUrls(commentText);
      const convertedText = ImageUtils.convertImagesToSlackFormat(commentText);
      const imageAttachments = ImageUtils.createSlackImageAttachments(imageUrls);

      Logger.debug('코멘트 이미지 처리 완료', {
        originalTextLength: commentText.length,
        imageCount: imageUrls.length,
        validImageCount: imageAttachments.length,
      });

      return {
        text: convertedText,
        imageAttachments,
        hasImages: imageUrls.length > 0,
      };
    } catch (error) {
      Logger.error('코멘트 이미지 처리 실패', error);
      return {
        text: commentText, // 실패 시 원본 반환
        imageAttachments: [],
        hasImages: false,
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
