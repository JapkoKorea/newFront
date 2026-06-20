import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/payment_api.dart';

class PaymentSuccessPage extends ConsumerStatefulWidget {
  const PaymentSuccessPage({
    super.key,
    required this.reservationNumber,
    required this.orderId,
    required this.paymentKey,
    required this.amount,
  });

  final String reservationNumber;
  final String orderId;
  final String paymentKey;
  final int amount;

  @override
  ConsumerState<PaymentSuccessPage> createState() => _PaymentSuccessPageState();
}

class _PaymentSuccessPageState extends ConsumerState<PaymentSuccessPage> {
  bool _isProcessing = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _confirmIfPossible();
  }

  Future<void> _confirmIfPossible() async {
    if (widget.paymentKey.isEmpty ||
        widget.orderId.isEmpty ||
        widget.amount <= 0) {
      setState(() {
        _isProcessing = false;
        _error = '결제 콜백 파라미터가 없습니다. 현재 로컬 테스트 모드입니다.';
      });
      return;
    }

    try {
      await ref.read(paymentApiProvider).confirmPayment(
            paymentKey: widget.paymentKey,
            orderId: widget.orderId,
            amount: widget.amount,
          );
      if (!mounted) {
        return;
      }
      setState(() => _isProcessing = false);
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _isProcessing = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: _isProcessing
            ? const Center(child: CircularProgressIndicator())
            : _PaymentResultView(
                accent: const Color(0xFF16A34A),
                icon: Icons.check_circle,
                title: '결제가 완료되었습니다',
                message: _error ??
                    '예약번호 ${_shortNumber(widget.reservationNumber)} 결제가 확인되었습니다.',
                primaryLabel: '예약 내역 보기',
                onPrimary: () => context.go('/reservations'),
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
