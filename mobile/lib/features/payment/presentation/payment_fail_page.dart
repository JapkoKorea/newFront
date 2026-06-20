import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/payment_api.dart';

class PaymentFailPage extends ConsumerStatefulWidget {
  const PaymentFailPage({
    super.key,
    required this.reservationNumber,
    required this.orderId,
  });

  final String reservationNumber;
  final String orderId;

  @override
  ConsumerState<PaymentFailPage> createState() => _PaymentFailPageState();
}

class _PaymentFailPageState extends ConsumerState<PaymentFailPage> {
  bool _isMarking = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _markFail();
  }

  Future<void> _markFail() async {
    if (widget.orderId.isEmpty) {
      setState(() {
        _isMarking = false;
        _error = 'orderId 파라미터가 없어 실패 상태를 기록할 수 없습니다.';
      });
      return;
    }

    try {
      await ref.read(paymentApiProvider).failPayment(
            orderId: widget.orderId,
            code: 'PAYMENT_FAILED',
            message: '모바일 결제 과정에서 사용자가 취소했거나 결제에 실패했습니다',
          );
      if (!mounted) {
        return;
      }
      setState(() => _isMarking = false);
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _isMarking = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: _isMarking
            ? const Center(child: CircularProgressIndicator())
            : _PaymentResultView(
                accent: const Color(0xFFDC2626),
                icon: Icons.error_outline,
                title: '결제에 실패했습니다',
                message: _error ??
                    '예약번호 ${_shortNumber(widget.reservationNumber)} 결제가 실패로 처리되었습니다.',
                primaryLabel: '결제 다시 시도',
                onPrimary: () => context.go(
                  '/payment/review?reservation_number=${widget.reservationNumber}',
                ),
                secondaryLabel: '홈으로',
                onSecondary: () => context.go('/home'),
              ),
      ),
    );
  }

  String _shortNumber(String value) {
    if (value.isEmpty) {
      return '-';
    }
    if (value.length <= 8) {
      return value;
    }
    return value.substring(value.length - 8).toUpperCase();
  }
}

class _PaymentResultView extends StatelessWidget {
  const _PaymentResultView({
    required this.accent,
    required this.icon,
    required this.title,
    required this.message,
    required this.primaryLabel,
    required this.onPrimary,
    required this.secondaryLabel,
    required this.onSecondary,
  });

  final Color accent;
  final IconData icon;
  final String title;
  final String message;
  final String primaryLabel;
  final VoidCallback onPrimary;
  final String secondaryLabel;
  final VoidCallback onSecondary;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: <Widget>[
          const Spacer(),
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              color: accent.withOpacity(0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 56, color: accent),
          ),
          const SizedBox(height: 20),
          Text(
            title,
            textAlign: TextAlign.center,
            style:
                const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF64748B), height: 1.4),
          ),
          const Spacer(),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onPrimary,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: Text(primaryLabel,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: onSecondary,
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: Text(secondaryLabel),
            ),
          ),
        ],
      ),
    );
  }
}
