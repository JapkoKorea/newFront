import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function LoginKakaoCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = (urlParams.get('code') || '').trim();
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (error) {
      alert(`카카오 로그인 실패: ${errorDescription || error}`);
      navigate('/');
      return;
    }

    if (!code) {
      alert('카카오 인증 코드가 없습니다.');
      navigate('/');
      return;
    }

    // 백엔드에 code 전달
    fetch(`${API_BASE_URL}/api/auth/kakao/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || `HTTP ${res.status}`);
        }
        return data;
      })
      .then(data => {
        if (data.token) {
          localStorage.setItem('jwt', data.token);
          // 사용자 정보도 저장 가능
          localStorage.setItem('user', JSON.stringify(data.user));
          alert('로그인 성공!');
          navigate('/');
        } else {
          alert('로그인 실패: ' + (data.detail || '알 수 없는 오류'));
          navigate('/');
        }
      })
      .catch(err => {
        alert('로그인 중 오류 발생: ' + (err?.message || err));
        navigate('/');
      });
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <p className="text-lg">카카오 로그인 처리 중...</p>
    </div>
  );
}

export default LoginKakaoCallback; 
