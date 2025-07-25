import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function LoginKakaoCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (!code) {
      alert('카카오 인증 코드가 없습니다.');
      navigate('/');
      return;
    }

    // 백엔드에 code 전달
    fetch('http://localhost:8000/api/auth/kakao/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(res => res.json())
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
        alert('로그인 중 오류 발생: ' + err);
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