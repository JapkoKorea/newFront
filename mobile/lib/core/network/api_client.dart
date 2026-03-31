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
      final Uri? fallbackUri = _alternatePortUri(uri);
      if (fallbackUri != null) {
        try {
          final http.Response fallback =
              await http.get(fallbackUri, headers: headers);
          return _decode(fallback);
        } catch (_) {
          // no-op: preserve original network error details below
        }
      }
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
    final String basePath = base.path == '/'
        ? ''
        : (base.path.endsWith('/')
            ? base.path.substring(0, base.path.length - 1)
            : base.path);
    final String combinedPath =
        '${basePath.isEmpty ? '' : basePath}$normalizedPath';

    return origin.replace(
      path: combinedPath,
      queryParameters: query,
    );
  }

  Uri? _alternatePortUri(Uri uri) {
    if (uri.scheme != 'http') {
      return null;
    }
    if (uri.host.isEmpty) {
      return null;
    }

    final int currentPort = uri.hasPort ? uri.port : 80;
    final int? alternatePort = switch (currentPort) {
      5000 => 8000,
      8000 => 5000,
      _ => null,
    };
    if (alternatePort == null) {
      return null;
    }
    return uri.replace(port: alternatePort);
  }

  String _networkErrorMessage(Object error) {
    final String baseMessage = 'Network connection failed: $error';
    final Uri uri = Uri.parse(AppConfig.apiBaseUrl);
    if (<String>{'localhost', '127.0.0.1', '::1'}.contains(uri.host)) {
      return '$baseMessage\nCurrent API_BASE_URL: ${AppConfig.apiBaseUrl}\nTip: On a real phone, localhost points to the phone itself. Use your Mac LAN IP (e.g. http://192.168.x.x:5000) and run backend with --host 0.0.0.0.';
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
    final dynamic decoded;
    try {
      decoded = response.body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(response.body);
    } catch (_) {
      throw ApiClientException(response.statusCode, 'Invalid JSON response');
    }

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
