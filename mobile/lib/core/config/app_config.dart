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

  static const String kakaoChannelUrl = String.fromEnvironment(
    'KAKAO_CHANNEL_URL',
    defaultValue: 'https://pf.kakao.com/_japko',
  );

  static bool get hasBankAccount =>
      bankName.isNotEmpty && bankAccount.isNotEmpty && bankHolder.isNotEmpty;

  static const bool skipAuth = bool.fromEnvironment(
    'SKIP_AUTH',
    defaultValue: false,
  );
}
