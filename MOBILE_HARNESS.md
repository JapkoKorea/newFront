# Mobile Harness Baseline

이 문서는 Flutter 모바일 구현 시작 전에 필요한 하네스 기준을 정의합니다.

## 1) 디렉토리 정책

- 모바일 앱은 `mobile/` 하위에서 독립 실행
- 웹(`src/`)과 코드 혼합 금지
- 백엔드 API 계약은 기존 FastAPI 엔드포인트 재사용

## 2) 버전 정책

- 기준 Flutter: `3.24.5`
- FVM 메타데이터: `mobile/.fvmrc`
- macOS 13 개발 환경에서 시작 후, 추후 Flutter/Xcode 업데이트 가능

## 3) 품질 게이트

모바일 기능 개발 시작 전 아래 명령이 통과되어야 합니다.

```bash
pnpm mobile:pub:get
pnpm mobile:analyze
pnpm mobile:test
```

## 4) 앱 구조(초기)

```text
mobile/lib/
  app/
    app.dart
    app_router.dart
    theme/app_theme.dart
  features/
    booking/
      presentation/booking_shell_page.dart
      data/reservation_api.dart
    payment/
      presentation/payment_review_page.dart
      data/payment_api.dart
```

## 5) 환경 변수

- 예시 파일: `mobile/.env.example`
- 실제 키는 커밋 금지
- 실행 시 `--dart-define` 사용

예시:

```bash
flutter run -d ios \
  --dart-define=GOOGLE_MAPS_API_KEY=YOUR_KEY \
  --dart-define=API_BASE_URL=http://127.0.0.1:5000 \
  --dart-define=KAKAO_REDIRECT_URI=japkotaxi://auth/callback
```

인증 흐름:
- 모바일 로그인 화면에서 백엔드 `/api/auth/kakao/mobile/start` 호출
- 백엔드는 카카오 authorize URL을 만들고 `state`에 앱 콜백 URI를 포함
- 카카오 인증 후 백엔드 `/api/auth/kakao/mobile/callback`에서 토큰 교환
- 백엔드가 앱 딥링크로 token/user payload를 전달해 앱 로그인 완료
- 발급 JWT는 SharedPreferences(`jwt`)에 저장

## 6) 다음 구현 우선순위

1. Toss 실결제 SDK/웹뷰 연동으로 `confirm` 콜백 자동화
2. 앱 딥링크/유니버설 링크 설정으로 카카오 콜백 완전 자동화
3. 예약 목록 UX 개선(필터/정렬/상태별 액션)
