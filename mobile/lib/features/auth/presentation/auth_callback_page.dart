import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../application/auth_controller.dart';

class AuthCallbackPage extends ConsumerStatefulWidget {
  const AuthCallbackPage({
    super.key,
    required this.code,
    required this.token,
    required this.userB64,
    required this.error,
    required this.errorDescription,
  });

  final String code;
  final String token;
  final String userB64;
  final String error;
  final String errorDescription;

  @override
  ConsumerState<AuthCallbackPage> createState() => _AuthCallbackPageState();
}

class _AuthCallbackPageState extends ConsumerState<AuthCallbackPage> {
  String _message = '카카오 로그인 처리 중...';

  @override
  void initState() {
    super.initState();
    _run();
  }

  Future<void> _run() async {
    if (widget.error.isNotEmpty) {
      setState(() {
        _message =
            '카카오 로그인 실패: ${widget.errorDescription.isEmpty ? widget.error : widget.errorDescription}';
      });
      return;
    }

    if (widget.token.isNotEmpty && widget.userB64.isNotEmpty) {
      try {
        // 전송 과정에서 base64 패딩(=)이 잘릴 수 있어 보정 후 디코딩
        String b64 = widget.userB64;
        final int rem = b64.length % 4;
        if (rem != 0) {
          b64 = b64.padRight(b64.length + (4 - rem), '=');
        }
        final String decoded = utf8.decode(base64Url.decode(b64));
        final Map<String, dynamic> user =
            jsonDecode(decoded) as Map<String, dynamic>;
        await ref.read(authControllerProvider.notifier).completeBridgeLogin(
              token: widget.token,
              user: user,
            );

        if (!mounted) {
          return;
        }
        context.go('/booking');
        return;
      } catch (e) {
        setState(() {
          _message = '로그인 콜백 데이터를 처리하지 못했습니다.';
        });
        return;
      }
    }

    if (widget.code.isEmpty) {
      setState(() {
        _message = '카카오 인증 코드가 없습니다.';
      });
      return;
    }

    final bool ok =
        await ref.read(authControllerProvider.notifier).loginWithKakaoCode(
              widget.code,
              redirectUri: AppConfig.kakaoRedirectUri,
            );

    if (!mounted) {
      return;
    }

    if (ok) {
      context.go('/booking');
      return;
    }

    setState(() {
      _message = ref.read(authControllerProvider).error ?? '로그인 실패';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('카카오 콜백')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(_message, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => context.go('/login'),
                child: const Text('로그인으로 돌아가기'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
