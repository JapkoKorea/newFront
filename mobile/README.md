# Japan Taxi Tour Mobile

Flutter 기반 모바일 앱 작업용 하네스입니다.

## Toolchain

- Flutter: `3.24.5` (권장 고정 버전)
- Dart SDK: `>=3.5.0 <4.0.0`

버전 고정은 아래 중 하나로 운영합니다.

1. FVM 사용 시: `fvm use 3.24.5`
2. 직접 Flutter 설치 사용 시: 로컬 Flutter 버전을 `3.24.5`로 유지

## 빠른 시작

```bash
flutter pub get
flutter analyze
flutter test
flutter run -d ios
```

## 하네스 구조

```text
lib/
  app/
    app.dart               # 앱 루트 위젯
    app_router.dart        # GoRouter 설정
    theme/app_theme.dart   # 기본 테마 토큰
  features/
    booking/presentation/
      booking_shell_page.dart  # Map-first + bottom-sheet 레이아웃 베이스
```

## 환경 변수 운영

민감정보는 커밋하지 않고 `--dart-define`로 전달합니다.

예시:

```bash
export MAPS_API_KEY=YOUR_ANDROID_MAPS_KEY
flutter run -d ios \
  --dart-define=GOOGLE_MAPS_API_KEY=YOUR_KEY \
  --dart-define=API_BASE_URL=http://127.0.0.1:5000 \
  --dart-define=KAKAO_REDIRECT_URI=japkotaxi://auth/callback
```

### 현재 사용되는 define 키

- `GOOGLE_MAPS_API_KEY`: 지도 SDK 키
- `MAPS_API_KEY`: Android native Google Maps SDK 키(Gradle manifest placeholder)
- `API_BASE_URL`: 백엔드 API 주소 (기본값: `http://127.0.0.1:5000`)
- `KAKAO_REDIRECT_URI`: 앱 딥링크 콜백 URI (기본값: `japkotaxi://auth/callback`)

### Android 지도 키 적용 방식

- `android/app/build.gradle`에서 `MAPS_API_KEY`를 `manifestPlaceholders`로 주입
- `android/app/src/main/AndroidManifest.xml`의 `com.google.android.geo.API_KEY` meta-data에 연결
- 키는 코드에 하드코딩하지 말고 로컬 환경변수 또는 개인 `~/.gradle/gradle.properties`로 관리

> Kakao OAuth 시작 URL은 모바일이 직접 생성하지 않고 백엔드 `GET /api/auth/kakao/mobile/start`에서 받아옵니다.

## 인증/결제 동작(현재 모바일 구현)

1. 앱 시작 시 `/login` 진입
2. 로그인 페이지에서 카카오 버튼 클릭 → 백엔드 `GET /api/auth/kakao/mobile/start` 호출
3. 백엔드가 카카오 authorize URL 생성 (`state`에 앱 콜백 URI 포함)
4. 카카오 인증 후 백엔드 `GET /api/auth/kakao/mobile/callback`으로 복귀
5. 백엔드가 토큰 교환 완료 후 앱 딥링크(`japkotaxi://auth/callback?...`)로 재리다이렉트
6. 앱이 token/user payload를 저장하고 `/booking`으로 이동
7. 예약 3단계 완료 시 `POST /api/reservations` 호출
8. 결제 리뷰에서 `POST /api/payments/prepare` 호출 후
   - prepare 응답 URL 오픈 버튼으로 외부 결제 플로우 핸드오프
   - 시뮬레이션 성공/실패 버튼으로 `confirm/fail` 콜백 API 검증 가능

## Google Maps 플랫폼 설정 체크리스트

1. Google Cloud에서 **Maps SDK for Android / iOS** 활성화
2. Android: `android/app/src/main/AndroidManifest.xml`에 API 키 설정
3. iOS: `ios/Runner/AppDelegate.swift`에서 `GMSServices.provideAPIKey(...)` 설정
4. 키 제한(권장):
   - Android: 패키지명 + SHA-1 제한
   - iOS: 번들 ID 제한

> 참고: macOS 13 + 구버전 Xcode 환경에서는 iOS 빌드 전 CocoaPods/Xcode 설정 상태를 먼저 확인하세요.

## 앱 이름/아이콘 커스터마이징

- 앱 이름(Android): `android/app/src/main/AndroidManifest.xml`의 `android:label`
- 앱 이름(Flutter 앱 타이틀): `lib/app/app.dart`의 `MaterialApp.router(title: ...)`
- 앱 아이콘(Android): `android/app/src/main/res/mipmap-*`의 `ic_launcher*` 리소스 교체

권장 방식은 `flutter_launcher_icons`를 도입해 한 번에 생성하는 것입니다.

## 환경 변수 분리 원칙 (중요)

- **모바일 앱**: 공개 가능한 값만 사용 (`API_BASE_URL`, 지도 키 등)
- **백엔드**: 카카오 REST 키/시크릿/JWT 시크릿 보관
- **금지**: 모바일에 `KAKAO_CLIENT_SECRET` 저장

## 기본 품질 게이트

- `flutter analyze`
- `flutter test`

위 두 명령어를 통과한 상태에서만 기능 개발 브랜치를 진행하세요.
