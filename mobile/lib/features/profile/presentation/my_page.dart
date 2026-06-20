import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/application/auth_controller.dart';

class MyPage extends ConsumerWidget {
  const MyPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState auth = ref.watch(authControllerProvider);
    final bool loggedIn = auth.isAuthenticated;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('마이'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: <Widget>[
                const CircleAvatar(
                  radius: 26,
                  backgroundColor: Color(0xFFF1F5F9),
                  child: Icon(Icons.person, color: Color(0xFF94A3B8)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        loggedIn
                            ? (auth.nickname.isEmpty ? '회원' : auth.nickname)
                            : '로그인이 필요합니다',
                        style: const TextStyle(
                            fontSize: 17, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        loggedIn
                            ? '예약 내역과 결제를 관리하세요'
                            : '카카오로 로그인하고 예약을 시작하세요',
                        style: const TextStyle(
                            fontSize: 13, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
                if (!loggedIn)
                  ElevatedButton(
                    onPressed: () => context.go('/login'),
                    child: const Text('로그인'),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _MenuTile(
            icon: Icons.receipt_long,
            label: '예약 내역',
            onTap: () => context.push('/reservations'),
          ),
          _MenuTile(
            icon: Icons.payments_outlined,
            label: '요금·예약금 정책',
            onTap: () => _showInfo(context, '요금·예약금 정책',
                '예약금 15,000원 선결제, 최소 이용시간 2시간, 5인 이상 점보택시 필수.'),
          ),
          _MenuTile(
            icon: Icons.support_agent,
            label: '고객지원',
            onTap: () => _showInfo(
                context, '고객지원', '문의는 카카오 채널 또는 이메일로 접수해 주세요.'),
          ),
          if (loggedIn) ...<Widget>[
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () async {
                await ref.read(authControllerProvider.notifier).logout();
                if (!context.mounted) {
                  return;
                }
                context.go('/login');
              },
              icon: const Icon(Icons.logout),
              label: const Text('로그아웃'),
            ),
          ],
        ],
      ),
    );
  }

  void _showInfo(BuildContext context, String title, String body) {
    showDialog<void>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('확인'),
          ),
        ],
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ListTile(
        leading: Icon(icon, color: const Color(0xFF334155)),
        title: Text(label,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        trailing: const Icon(Icons.chevron_right, color: Color(0xFF94A3B8)),
        onTap: onTap,
      ),
    );
  }
}
