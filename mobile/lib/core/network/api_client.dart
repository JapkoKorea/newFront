import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import 'auth_token_store.dart';

class ApiClientException implements Exception {
  ApiClientException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  String toString() => 'ApiClientException($statusCode): $message';
}

class ApiClient {
  ApiClient({AuthTokenStore? tokenStore})
      : _tokenStore = tokenStore ?? AuthTokenStore();

  final AuthTokenStore _tokenStore;

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, String>? query,
  }) async {
    final Uri uri = _buildUri(path, query: query);
    final Map<String, String> headers = await _buildHeaders();
    final http.Response response;
    try {
      response = await http.get(uri, headers: headers);
    } catch (e) {
      throw ApiClientException(-1, _networkErrorMessage(e));
    }
    return _decode(response);
  }

  Future<Map<String, dynamic>> postJson(
    String path, {
    Map<String, String>? query,
    Map<String, dynamic>? body,
  }) async {
    final Uri uri = _buildUri(path, query: query);
    final Map<String, String> headers = await _buildHeaders(
      extra: <String, String>{'Content-Type': 'application/json'},
    );
    final http.Response response;
    try {
      response = await http.post(
        uri,
        headers: headers,
        body: jsonEncode(body ?? <String, dynamic>{}),
      );
    } catch (e) {
      throw ApiClientException(-1, _networkErrorMessage(e));
    }
    return _decode(response);
  }

  Future<Map<String, dynamic>> patchJson(
    String path, {
    Map<String, String>? query,
    Map<String, dynamic>? body,
  }) async {
    final Uri uri = _buildUri(path, query: query);
    final Map<String, String> headers = await _buildHeaders(
      extra: <String, String>{'Content-Type': 'application/json'},
    );
    final http.Response response;
    try {
      response = await http.patch(
        uri,
        headers: headers,
        body: body == null ? null : jsonEncode(body),
      );
    } catch (e) {
      throw ApiClientException(-1, _networkErrorMessage(e));
    }
    return _decode(response);
  }

  Uri _buildUri(String path, {Map<String, String>? query}) {
    final Uri base = Uri.parse(AppConfig.apiBaseUrl);
    final Uri origin = Uri(
      scheme: base.scheme.isEmpty ? 'http' : base.scheme,
      host: base.host.isEmpty ? 'localhost' : base.host,
      port: base.hasPort ? base.port : null,
    );
    final String normalizedPath = path.startsWith('/') ? path : '/$path';

    return origin.replace(
      path: normalizedPath,
      queryParameters: query,
    );
  }

  String _networkErrorMessage(Object error) {
    final String baseMessage = 'Network connection failed: $error';
    if (AppConfig.apiBaseUrl.contains('localhost')) {
      return '$baseMessage\nTip: On a real phone, localhost points to the phone itself. Use your Mac LAN IP (e.g. http://192.168.x.x:8000) and run backend with --host 0.0.0.0.';
    }
    return baseMessage;
  }

  Future<Map<String, String>> _buildHeaders({
    Map<String, String>? extra,
  }) async {
    final String? token = await _tokenStore.readToken();
    final Map<String, String> headers = <String, String>{
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
      if (AppConfig.authJwt.isNotEmpty)
        'Authorization': 'Bearer ${AppConfig.authJwt}',
      ...?extra,
    };
    return headers;
  }

  Map<String, dynamic> _decode(http.Response response) {
    final dynamic decoded =
        response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final String message = decoded is Map<String, dynamic>
          ? (decoded['detail']?.toString() ??
              decoded['message']?.toString() ??
              'Request failed')
          : 'Request failed';

      throw ApiClientException(response.statusCode, message);
    }

    if (decoded is Map<String, dynamic>) {
      return decoded;
    }

    throw ApiClientException(
        response.statusCode, 'Invalid JSON response shape');
  }
}
