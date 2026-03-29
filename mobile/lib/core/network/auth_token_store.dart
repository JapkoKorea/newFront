import 'package:shared_preferences/shared_preferences.dart';

class AuthTokenStore {
  static const String _jwtKey = 'jwt';
  static const String _userJsonKey = 'user_json';

  Future<String?> readToken() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    return prefs.getString(_jwtKey);
  }

  Future<void> saveToken(String token) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(_jwtKey, token);
  }

  Future<void> clear() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.remove(_jwtKey);
    await prefs.remove(_userJsonKey);
  }

  Future<String?> readUserJson() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    return prefs.getString(_userJsonKey);
  }

  Future<void> saveUserJson(String userJson) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userJsonKey, userJson);
  }
}
