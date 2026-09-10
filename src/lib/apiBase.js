/**
 * API 주소만 따로 둔다.
 *
 * session.js 는 갱신·로그아웃을 부르느라 이 값이 필요하고, api.js 는 요청을
 * 보내느라 session.js 가 필요하다. 한 파일에 두면 서로를 import 하게 되므로
 * 양쪽이 함께 기대는 이 값만 떼어 놓았다.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
