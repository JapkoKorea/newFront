import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/booking_draft.dart';

class BookingDraftStore {
  static const String _key = 'booking_draft_v1';

  Future<void> save(BookingDraft draft) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(draft.toJson()));
  }

  Future<BookingDraft?> load() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String? raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) {
      return null;
    }

    final dynamic decoded = jsonDecode(raw);
    if (decoded is! Map<String, dynamic>) {
      return null;
    }
    return BookingDraft.fromJson(decoded);
  }

  Future<void> clear() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
