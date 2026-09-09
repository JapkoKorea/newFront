abstract final class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:5000',
  );

  static const String googleMapsApiKey = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: '',
  );

  static const String authJwt = String.fromEnvironment(
    'AUTH_JWT',
    defaultValue: '',
  );

  static const String kakaoRedirectUri = String.fromEnvironment(
    'KAKAO_REDIRECT_URI',
    defaultValue: 'japkotaxi://auth/callback',
  );

  // 결제 안내(카드 결제 비활성 기간). 웹의 NEXT_PUBLIC_BANK_* 와 같은 값이다.
  // 비어 있으면 계좌이체 안내를 잠그고 문의로 유도한다.
  static const String bankName = String.fromEnvironment(
    'BANK_NAME',
    defaultValue: '',
  );

  static const String bankAccount = String.fromEnvironment(
    'BANK_ACCOUNT',
    defaultValue: '',
  );

  static const String bankHolder = String.fromEnvironment(
    'BANK_HOLDER',
    defaultValue: '',
  );

  static const String naverStoreUrl = String.fromEnvironment(
    'NAVER_STORE_URL',
    defaultValue: '',
  );

  /// 카카오톡 채널 공개 ID. 관리자센터의 채널 URL 에서 _ 뒤 부분.
  /// 값이 없으면 문의 버튼을 만들지 않는다 — 존재하지 않는 채널로 보내면
  /// "페이지를 찾을 수 없습니다"가 뜬다.
  static const String kakaoChannelId = String.fromEnvironment(
    'KAKAO_CHANNEL_ID',
    defaultValue: '',
  );

  static const String kakaoChannelUrlOverride = String.fromEnvironment(
    'KAKAO_CHANNEL_URL',
    defaultValue: '',
  );

  /// 채널 홈이 아니라 대화창을 바로 연다.
  static String get kakaoChannelUrl {
    if (kakaoChannelUrlOverride.isNotEmpty) return kakaoChannelUrlOverride;
    if (kakaoChannelId.isNotEmpty) return 'https://pf.kakao.com/$kakaoChannelId/chat';
    return '';
  }

  static bool get hasKakaoChannel => kakaoChannelUrl.isNotEmpty;

  static bool get hasBankAccount =>
      bankName.isNotEmpty && bankAccount.isNotEmpty && bankHolder.isNotEmpty;

  static const bool skipAuth = bool.fromEnvironment(
    'SKIP_AUTH',
    defaultValue: false,
  );
}
