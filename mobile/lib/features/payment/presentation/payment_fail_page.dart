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
      setState(() {
        _isMarking = false;
      });
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
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: _isMarking
                ? const CircularProgressIndicator()
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      const Icon(
                        Icons.error_outline,
                        size: 72,
                        color: Color(0xFFDC2626),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        '결제에 실패했습니다',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _error ??
                            '예약번호 ${widget.reservationNumber.isEmpty ? '-' : widget.reservationNumber} 결제가 실패로 처리되었습니다.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () => context.go(
                            '/payment/review?reservation_number=${widget.reservationNumber}',
                          ),
                          child: const Text('결제 다시 시도'),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
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
