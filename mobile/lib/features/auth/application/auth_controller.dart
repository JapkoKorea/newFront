import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/auth_token_store.dart';

class AuthState {
  const AuthState({
    this.token = '',
    this.nickname = '',
    this.userId = '',
    this.isBootstrapping = true,
    this.error,
  });

  final String token;
  final String nickname;
  final String userId;
  final bool isBootstrapping;
  final String? error;

  bool get isAuthenticated => token.isNotEmpty;

  AuthState copyWith({
    String? token,
    String? nickname,
    String? userId,
    bool? isBootstrapping,
    String? error,
    bool clearError = false,
  }) {
    return AuthState(
      token: token ?? this.token,
      nickname: nickname ?? this.nickname,
      userId: userId ?? this.userId,
      isBootstrapping: isBootstrapping ?? this.isBootstrapping,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class AuthController extends Notifier<AuthState> {
  AuthController(this._tokenStore, this._apiClient);

  final AuthTokenStore _tokenStore;
  final ApiClient _apiClient;

  @override
  AuthState build() {
    _bootstrap();
    return const AuthState();
  }

  Future<void> _bootstrap() async {
    try {
      final String token = await _tokenStore.readToken() ?? '';
      final String? userJson = await _tokenStore.readUserJson();
      String nickname = '';
      String userId = '';

      if (userJson != null && userJson.isNotEmpty) {
        final dynamic decoded = jsonDecode(userJson);
        if (decoded is Map<String, dynamic>) {
          nickname = decoded['nickname']?.toString() ?? '';
          userId = decoded['user_id']?.toString() ?? '';
        }
      }

      state = state.copyWith(
        token: token,
        nickname: nickname,
        userId: userId,
        isBootstrapping: false,
        clearError: true,
      );
    } catch (_) {
      state = state.copyWith(
        isBootstrapping: false,
        error: 'Failed to load auth session',
      );
    }
  }

  Future<bool> loginWithKakaoCode(
    String code, {
    String? redirectUri,
  }) async {
    final String trimmed = code.trim();
    if (trimmed.isEmpty) {
      state = state.copyWith(error: 'Kakao authorization code is required');
      return false;
    }

    try {
      final Map<String, dynamic> response = await _apiClient.postJson(
        '/api/auth/kakao/callback',
        body: <String, dynamic>{
          'code': trimmed,
          if ((redirectUri ?? '').trim().isNotEmpty)
            'redirect_uri': (redirectUri ?? '').trim(),
        },
      );

      final String token = response['token']?.toString() ?? '';
      final Map<String, dynamic> user =
          (response['user'] as Map<String, dynamic>? ?? <String, dynamic>{});

      if (token.isEmpty) {
        state = state.copyWith(error: 'Token missing in auth response');
        return false;
      }

      await _tokenStore.saveToken(token);
      await _tokenStore.saveUserJson(jsonEncode(user));

      state = state.copyWith(
        token: token,
        nickname: user['nickname']?.toString() ?? '',
        userId: user['user_id']?.toString() ?? '',
        clearError: true,
      );
      return true;
    } catch (e) {
      state = state.copyWith(error: e.toString());
      return false;
    }
  }

  Future<String> getKakaoAuthorizeUrl() async {
    final Map<String, dynamic> response = await _apiClient.getJson(
      '/api/auth/kakao/mobile/start',
      query: <String, String>{'app_redirect': AppConfig.kakaoRedirectUri},
    );
    final String authUrl = response['auth_url']?.toString() ?? '';
    if (authUrl.isEmpty) {
      throw ApiClientException(500, 'Kakao authorize URL is missing');
    }
    return authUrl;
  }

  Future<void> completeBridgeLogin({
    required String token,
    required Map<String, dynamic> user,
  }) async {
    final String trimmed = token.trim();
    if (trimmed.isEmpty) {
      state = state.copyWith(error: 'Token missing in bridge callback');
      return;
    }

    await _tokenStore.saveToken(trimmed);
    await _tokenStore.saveUserJson(jsonEncode(user));

    state = state.copyWith(
      token: trimmed,
      nickname: user['nickname']?.toString() ?? '',
      userId: user['user_id']?.toString() ?? '',
      clearError: true,
    );
  }

  Future<void> logout() async {
    await _tokenStore.clear();
    state = const AuthState(isBootstrapping: false);
  }
}

final NotifierProvider<AuthController, AuthState> authControllerProvider =
    NotifierProvider<AuthController, AuthState>(
  () => AuthController(AuthTokenStore(), ApiClient()),
);
