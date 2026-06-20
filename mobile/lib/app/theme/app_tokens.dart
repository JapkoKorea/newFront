import 'package:flutter/material.dart';

/// 디자인 토큰 — 색/간격/라운드의 단일 소스.
/// 화면에서 hex를 직접 쓰지 말고 여기 토큰을 참조한다.
abstract final class AppColors {
  // Brand (amber)
  static const Color brand = Color(0xFFF59E0B);
  static const Color brandDark = Color(0xFFD97706);
  static const Color onBrand = Color(0xFF111827);

  // Neutrals (slate)
  static const Color ink = Color(0xFF0F172A); // 주요 텍스트
  static const Color textStrong = Color(0xFF334155);
  static const Color textMuted = Color(0xFF64748B);
  static const Color textFaint = Color(0xFF94A3B8);
  static const Color border = Color(0xFFE2E8F0);
  static const Color surfaceMuted = Color(0xFFF1F5F9);
  static const Color background = Color(0xFFF8FAFC);
  static const Color surface = Colors.white;

  // Semantic
  static const Color success = Color(0xFF16A34A);
  static const Color danger = Color(0xFFDC2626);
  static const Color info = Color(0xFF2563EB);

  // Accent surfaces (안내/경고 박스)
  static const Color warnSurface = Color(0xFFFFFBEB);
  static const Color warnBorder = Color(0xFFFCD34D);
  static const Color warnText = Color(0xFF9A3412);

  // 시즌 배너 그라데이션
  static const List<Color> winterGradient = <Color>[
    Color(0xFF60A5FA),
    Color(0xFF2563EB),
  ];
  static const List<Color> summerGradient = <Color>[
    Color(0xFFFB923C),
    Color(0xFFF472B6),
  ];
  static const List<Color> neutralGradient = <Color>[
    Color(0xFFF59E0B),
    Color(0xFFD97706),
  ];

  static List<Color> seasonGradient(String season) {
    return switch (season) {
      'winter' => winterGradient,
      'summer' => summerGradient,
      _ => neutralGradient,
    };
  }
}

abstract final class AppRadius {
  static const double sm = 10;
  static const double md = 14;
  static const double lg = 18;
  static const double pill = 999;
}

abstract final class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
}
