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
      setState(() {
        _isProcessing = false;
      });
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
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: _isProcessing
                ? const CircularProgressIndicator()
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      const Icon(
                        Icons.check_circle,
                        size: 72,
                        color: Color(0xFF16A34A),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        '결제가 완료되었습니다',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _error ??
                            '예약번호 ${widget.reservationNumber.isEmpty ? '-' : widget.reservationNumber} 결제가 확인되었습니다.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () => context.go('/booking'),
                          child: const Text('예약 화면으로 돌아가기'),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
