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
      appBar: AppBar(title: const Text('결제 검토')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? _ErrorCard(error: _error!, onRetry: _load)
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      const Text(
                        '예약 요약',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 20,
                        ),
                      ),
                      const SizedBox(height: 12),
                      _SummaryRow(
                        label: '예약번호',
                        value: widget.reservationNumber,
                      ),
                      _SummaryRow(
                        label: '출발지',
                        value: bookingState.draft.departure,
                      ),
                      _SummaryRow(
                        label: '도착지',
                        value: bookingState.draft.destination,
                      ),
                      _SummaryRow(label: '날짜', value: bookingState.draft.date),
                      _SummaryRow(label: '시간', value: bookingState.draft.time),
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '결제 주문명: ${_prepareData?.orderName ?? '-'}\n'
                          '결제 금액: ${_prepareData?.amount ?? 0} ${_prepareData?.currency ?? ''}',
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () async {
                            final PaymentPrepareData? data = _prepareData;
                            if (data == null || data.successUrl.isEmpty) {
                              return;
                            }

                            final ScaffoldMessengerState messenger =
                                ScaffoldMessenger.of(context);

                            final bool launched =
                                await launchUrl(Uri.parse(data.successUrl));
                            if (!launched) {
                              messenger.showSnackBar(
                                const SnackBar(
                                  content: Text('결제 URL을 열 수 없습니다.'),
                                ),
                              );
                            }
                          },
                          child: const Text('결제 성공 URL 열기'),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () async {
                            final PaymentPrepareData? data = _prepareData;
                            if (data == null || data.failUrl.isEmpty) {
                              return;
                            }

                            final ScaffoldMessengerState messenger =
                                ScaffoldMessenger.of(context);
                            final bool launched =
                                await launchUrl(Uri.parse(data.failUrl));
                            if (!launched) {
                              messenger.showSnackBar(
                                const SnackBar(
                                  content: Text('결제 실패 URL을 열 수 없습니다.'),
                                ),
                              );
                            }
                          },
                          child: const Text('결제 실패 URL 열기'),
                        ),
                      ),
                      const Spacer(),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () {
                            final PaymentPrepareData? data = _prepareData;
                            if (data == null) {
                              return;
                            }

                            context.go(
                              '/payment/success'
                              '?reservation_number=${widget.reservationNumber}'
                              '&orderId=${data.orderId}'
                              '&amount=${data.amount}',
                            );
                          },
                          child: const Text('성공 콜백 테스트'),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () {
                            final PaymentPrepareData? data = _prepareData;
                            if (data == null) {
                              return;
                            }

                            context.go(
                              '/payment/fail'
                              '?reservation_number=${widget.reservationNumber}'
                              '&orderId=${data.orderId}',
                            );
                          },
                          child: const Text('실패 콜백 테스트'),
                        ),
                      ),
                    ],
                  ),
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(error, textAlign: TextAlign.center),
          const SizedBox(height: 10),
          ElevatedButton(
            onPressed: onRetry,
            child: const Text('다시 시도'),
          ),
        ],
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
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: <Widget>[
          SizedBox(
            width: 110,
            child:
                Text(label, style: const TextStyle(color: Color(0xFF64748B))),
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
