import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'app_router.dart';
import 'theme/app_theme.dart';

class App extends ConsumerStatefulWidget {
  const App({super.key});

  @override
  ConsumerState<App> createState() => _AppState();
}

class _AppState extends ConsumerState<App> {
  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _linkSub;

  @override
  void initState() {
    super.initState();
    _initDeepLinks();
  }

  Future<void> _initDeepLinks() async {
    // 콜드 스타트로 들어온 초기 딥링크
    try {
      final Uri? initial = await _appLinks.getInitialAppLink();
      if (initial != null) {
        _handleLink(initial);
      }
    } catch (_) {
      // 무시: 초기 링크 없음/오류
    }
    // 앱이 떠 있을 때(warm) 들어오는 딥링크 스트림
    _linkSub = _appLinks.uriLinkStream.listen(
      _handleLink,
      onError: (Object _) {},
    );
  }

  void _handleLink(Uri uri) {
    if (uri.scheme != 'japkotaxi') {
      return;
    }
    // japkotaxi://auth/callback?token=...&user_b64=...
    // go_router에서는 host=auth, path=/callback 으로 들어온다.
    final GoRouter router = ref.read(appRouterProvider);
    final String query = uri.query.isEmpty ? '' : '?${uri.query}';
    router.go('/callback$query');
  }

  @override
  void dispose() {
    _linkSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final GoRouter router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'japko_reserve',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: router,
    );
  }
}
