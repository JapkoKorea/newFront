import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../booking/application/booking_coordinator.dart';
import '../data/payment_api.dart';

class PaymentReviewPage extends ConsumerStatefulWidget {
  const PaymentReviewPage({
    super.key,
    required this.reservationNumber,
  });

  final String reservationNumber;

  @override
  ConsumerState<PaymentReviewPage> createState() => _PaymentReviewPageState();
}

class _PaymentReviewPageState extends ConsumerState<PaymentReviewPage> {
  bool _isLoading = true;
  String? _error;
  PaymentPrepareData? _prepareData;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (widget.reservationNumber.isEmpty) {
      setState(() {
        _isLoading = false;
        _error = 'reservation_number 파라미터가 필요합니다.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final PaymentApi paymentApi = ref.read(paymentApiProvider);
      final PaymentPrepareData data =
          await paymentApi.preparePayment(widget.reservationNumber);
      if (!mounted) {
        return;
      }
      setState(() {
        _prepareData = data;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final BookingState bookingState = ref.watch(bookingCoordinatorProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('결제 확인'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorCard(error: _error!, onRetry: _load)
              : _buildContent(bookingState),
    );
  }

  Widget _buildContent(BookingState bookingState) {
    final PaymentPrepareData? data = _prepareData;
    final int amount = data?.amount ?? 0;
    final String currency = data?.currency ?? 'KRW';

    return Column(
      children: <Widget>[
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              _SectionCard(
                title: '예약 요약',
                child: Column(
                  children: <Widget>[
                    _SummaryRow(
                      label: '예약번호',
                      value: _shortNumber(widget.reservationNumber),
                    ),
                    _SummaryRow(label: '출발지', value: bookingState.draft.departure),
                    _SummaryRow(
                        label: '도착지', value: bookingState.draft.destination),
                    _SummaryRow(label: '날짜', value: bookingState.draft.date),
                    _SummaryRow(label: '시간', value: bookingState.draft.time),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _SectionCard(
                title: '결제 금액',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      data?.orderName ?? '택시투어 예약금',
                      style: const TextStyle(
                          fontSize: 13, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: <Widget>[
                        const Text(
                          '예약금',
                          style: TextStyle(
                              fontSize: 14, color: Color(0xFF334155)),
                        ),
                        const Spacer(),
                        Text(
                          currency == 'KRW' || currency.isEmpty
                              ? '${_formatNumber(amount)}원'
                              : '${_formatNumber(amount)} $currency',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              const _PolicyNote(),
            ],
          ),
        ),
        _BottomBar(
          onPay: () => _openUrl(data?.successUrl),
          onTestSuccess: data == null
              ? null
              : () => context.go(
                    '/payment/success'
                    '?reservation_number=${widget.reservationNumber}'
                    '&orderId=${data.orderId}'
                    '&amount=${data.amount}',
                  ),
          onTestFail: data == null
              ? null
              : () => context.go(
                    '/payment/fail'
                    '?reservation_number=${widget.reservationNumber}'
                    '&orderId=${data.orderId}',
                  ),
        ),
      ],
    );
  }

  Future<void> _openUrl(String? url) async {
    if (url == null || url.isEmpty) {
      return;
    }
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    final bool launched = await launchUrl(Uri.parse(url));
    if (!launched) {
      messenger.showSnackBar(
        const SnackBar(content: Text('결제 페이지를 열 수 없습니다.')),
      );
    }
  }

  String _shortNumber(String value) {
    if (value.length <= 8) {
      return value;
    }
    return value.substring(value.length - 8).toUpperCase();
  }
}

String _formatNumber(int value) {
  final String s = value.toString();
  final StringBuffer buf = StringBuffer();
  for (int i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) {
      buf.write(',');
    }
    buf.write(s[i]);
  }
  return buf.toString();
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.onPay,
    required this.onTestSuccess,
    required this.onTestFail,
  });

  final VoidCallback onPay;
  final VoidCallback? onTestSuccess;
  final VoidCallback? onTestFail;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: onPay,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('결제하기',
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: <Widget>[
                Expanded(
                  child: TextButton(
                    onPressed: onTestSuccess,
                    child: const Text('성공 콜백(테스트)',
                        style: TextStyle(
                            fontSize: 12, color: Color(0xFF94A3B8))),
                  ),
                ),
                Expanded(
                  child: TextButton(
                    onPressed: onTestFail,
                    child: const Text('실패 콜백(테스트)',
                        style: TextStyle(
                            fontSize: 12, color: Color(0xFF94A3B8))),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PolicyNote extends StatelessWidget {
  const _PolicyNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFCD34D)),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text('예약금 안내', style: TextStyle(fontWeight: FontWeight.w700)),
          SizedBox(height: 6),
          Text('- 예약금은 현장 이용요금에서 차감됩니다.',
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
          Text('- 취소 정책에 따라 환불 조건이 달라질 수 있습니다.',
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(title,
              style:
                  const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.error, required this.onRetry});

  final String error;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(error, textAlign: TextAlign.center),
            const SizedBox(height: 10),
            ElevatedButton(onPressed: onRetry, child: const Text('다시 시도')),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 84,
            child:
                Text(label, style: const TextStyle(color: Color(0xFF94A3B8))),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '-' : value,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
