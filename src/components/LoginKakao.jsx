import React from 'react'

const KAKAO_CLIENT_ID = '카카오RESTAPI키'; // 실제 REST API 키로 교체 필요
const REDIRECT_URI = window.location.origin + '/login';

function LoginKakaoButton() {
  const handleLogin = () => {
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;
    window.location.href = kakaoAuthUrl;
  };

  return (
    <button
      className="bg-yellow-400 hover:bg-yellow-500 text-white px-6 py-3 rounded-lg font-semibold text-lg shadow flex items-center"
      onClick={handleLogin}
    >
      <img src="https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_medium.png" alt="카카오" className="w-6 h-6 mr-2" />
      카카오로 로그인
    </button>
  );
}

export default LoginKakaoButton; 