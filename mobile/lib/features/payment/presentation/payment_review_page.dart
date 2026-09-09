import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../data/payment_api.dart';

/// 예약금 결제 안내.
///
/// 카드 결제(토스)는 심사 전까지 내려 두고 두 가지로 받는다.
///  - 계좌이체: 계좌와 금액을 보여주고 "입금했다"는 알림을 받는다.
///  - 스마트스토어: 상품 페이지로 보내고 주문번호를 받는다.
///
/// 어느 쪽이든 확인은 운영자가 한다. 고객이 알렸다고 해서 결제 완료가 되지는
/// 않는다. 예약 상태도 여기서 바뀌지 않는다.
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
  ManualPaymentInfo? _info;
  String _declaring = '';
  final TextEditingController _orderNoController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _orderNoController.dispose();
    super.dispose();
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
      final ManualPaymentInfo info =
          await ref.read(paymentApiProvider).transferInfo(widget.reservationNumber);
      if (!mounted) return;
      setState(() {
        _info = info;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _declare(String channel) async {
    setState(() => _declaring = channel);
    try {
      final Map<String, dynamic> result = await ref.read(paymentApiProvider).declarePayment(
            reservationNumber: widget.reservationNumber,
            channel: channel,
            externalOrderNo: channel == 'naver'
                ? (_orderNoController.text.trim().isEmpty ? null : _orderNoController.text.trim())
                : null,
          );
      if (!mounted) return;
      final ManualPaymentInfo? current = _info;
      setState(() {
        _declaring = '';
        if (current != null) {
          _info = ManualPaymentInfo(
            amount: current.amount,
            isLastMinute: current.isLastMinute,
            paymentStatus: result['paymentStatus']?.toString() ?? 'ready',
            canPay: current.canPay,
            blockReason: current.blockReason,
            reservation: current.reservation,
          );
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message']?.toString() ?? '결제 확인 요청이 접수되었습니다.')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _declaring = '');
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _openUrl(String url) async {
    final Uri uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('링크를 열지 못했습니다.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('예약금 결제')),
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    final String? error = _error;
    if (error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(error, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: _load, child: const Text('다시 시도')),
            ],
          ),
        ),
      );
    }

    final ManualPaymentInfo info = _info!;
    final Map<String, dynamic> reservation = info.reservation;
    final bool declared = info.paymentStatus == 'ready';
    final bool settled = info.paymentStatus == 'paid';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        _ReservationCard(reservation: reservation),
        const SizedBox(height: 12),
        _AmountCard(amount: info.amount, isLastMinute: info.isLastMinute),
        const SizedBox(height: 12),
        if (settled)
          const _NoticeCard(
            color: Color(0xFFECFDF5),
            title: '결제가 확인되었습니다.',
            body: '예약 확정 여부는 예약 확인 화면에서 알려드립니다.',
          )
        else if (declared)
          const _NoticeCard(
            color: Color(0xFFFFFBEB),
            title: '결제 확인을 요청하셨습니다.',
            body: '확인 후 예약을 확정해 드립니다. 시간이 걸릴 수 있습니다.',
          ),
        if (!info.canPay)
          _NoticeCard(
            color: const Color(0xFFFFF1F2),
            title: info.blockReason ?? '결제를 진행할 수 없는 예약입니다.',
            body: '아래 문의로 연락 주시면 확인해 드리겠습니다.',
          ),

        if (info.canPay) ...<Widget>[
          const SizedBox(height: 12),
          _BankTransferCard(
            declaring: _declaring == 'bank_transfer',
            disabled: _declaring.isNotEmpty || declared || settled,
            settled: settled,
            declared: declared,
            onDeclare: () => _declare('bank_transfer'),
          ),
          const SizedBox(height: 12),
          _NaverCard(
            controller: _orderNoController,
            declaring: _declaring == 'naver',
            disabled: _declaring.isNotEmpty || declared || settled,
            settled: settled,
            declared: declared,
            onOpen: () => _openUrl(AppConfig.naverStoreUrl),
            onDeclare: () => _declare('naver'),
          ),
        ],
        const SizedBox(height: 12),
        if (AppConfig.hasKakaoChannel)
          _InquiryCard(onKakao: () => _openUrl(AppConfig.kakaoChannelUrl)),
        const SizedBox(height: 12),
        TextButton(
          onPressed: () => context.go('/reservations'),
          child: const Text('예약 확인으로 돌아가기'),
        ),
      ],
    );
  }
}

class _ReservationCard extends StatelessWidget {
  const _ReservationCard({required this.reservation});

  final Map<String, dynamic> reservation;

  @override
  Widget build(BuildContext context) {
    String value(String key) => reservation[key]?.toString() ?? '-';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text('예약 정보', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _Row(label: '예약번호', value: value('reservationNumber')),
            _Row(label: '예약자', value: value('englishName')),
            _Row(
              label: '일정',
              value: '${value('tourDate')} ${value('tourStartTime')}',
            ),
            _Row(
              label: '인원 / 시간',
              value: '${value('numberOfPeople')}명 / ${value('durationHours')}시간',
            ),
            _Row(
              label: '경로',
              value: '${value('departure')} -> ${value('destination')}',
            ),
            _Row(label: '코스', value: value('desiredCourse')),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 88,
            child: Text(label, style: const TextStyle(color: Colors.black54, fontSize: 13)),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }
}

class _AmountCard extends StatelessWidget {
  const _AmountCard({required this.amount, required this.isLastMinute});

  final int amount;
  final bool isLastMinute;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFFFFFBEB),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text('입금하실 금액', style: TextStyle(fontSize: 12, color: Colors.black54)),
            const SizedBox(height: 4),
            Text(
              '${_comma(amount)}원',
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            Text(
              isLastMinute
                  ? '전일 또는 당일 예약이라 예약금이 20,000원으로 적용됩니다.'
                  : '예약금입니다. 현지 택시 요금은 투어 당일 기사님께 정산합니다.',
              style: const TextStyle(fontSize: 12, color: Colors.black54),
            ),
          ],
        ),
      ),
    );
  }

  static String _comma(int value) {
    final String text = value.toString();
    final StringBuffer out = StringBuffer();
    for (int i = 0; i < text.length; i++) {
      if (i > 0 && (text.length - i) % 3 == 0) out.write(',');
      out.write(text[i]);
    }
    return out.toString();
  }
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({required this.color, required this.title, required this.body});

  final Color color;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: color,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(body, style: const TextStyle(fontSize: 13, color: Colors.black87)),
          ],
        ),
      ),
    );
  }
}

class _BankTransferCard extends StatelessWidget {
  const _BankTransferCard({
    required this.declaring,
    required this.disabled,
    required this.settled,
    required this.declared,
    required this.onDeclare,
  });

  final bool declaring;
  final bool disabled;
  final bool settled;
  final bool declared;
  final VoidCallback onDeclare;

  @override
  Widget build(BuildContext context) {
    if (!AppConfig.hasBankAccount) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text('계좌이체', style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              Text('계좌 정보를 준비 중입니다. 문의로 연락 주시면 안내드립니다.',
                  style: TextStyle(fontSize: 13, color: Colors.black54)),
            ],
          ),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text('계좌이체', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Text('입금 계좌', style: TextStyle(fontSize: 12, color: Colors.black54)),
                  const SizedBox(height: 4),
                  Text(
                    '${AppConfig.bankName} ${AppConfig.bankAccount}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 2),
                  Text('예금주 ${AppConfig.bankHolder}',
                      style: const TextStyle(fontSize: 13, color: Colors.black54)),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: AppConfig.bankAccount));
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('계좌번호를 복사했습니다.')),
                      );
                    },
                    icon: const Icon(Icons.copy, size: 16),
                    label: const Text('계좌번호 복사'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              '입금자명을 예약자 성함으로 넣어 주세요. 다르게 입금하시는 경우 문의로 알려 주시면 확인이 빠릅니다.',
              style: TextStyle(fontSize: 12, color: Colors.black54),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: disabled ? null : onDeclare,
                child: declaring
                    ? const SizedBox(
                        height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(settled ? '입금 확인됨' : declared ? '확인 요청됨' : '입금 완료'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NaverCard extends StatelessWidget {
  const _NaverCard({
    required this.controller,
    required this.declaring,
    required this.disabled,
    required this.settled,
    required this.declared,
    required this.onOpen,
    required this.onDeclare,
  });

  final TextEditingController controller;
  final bool declaring;
  final bool disabled;
  final bool settled;
  final bool declared;
  final VoidCallback onOpen;
  final VoidCallback onDeclare;

  @override
  Widget build(BuildContext context) {
    final bool ready = AppConfig.naverStoreUrl.isNotEmpty;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text('스마트스토어에서 결제', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text(
              '네이버페이로 결제하시려면 스마트스토어 상품 페이지에서 진행해 주세요.',
              style: TextStyle(fontSize: 13, color: Colors.black54),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: ready ? onOpen : null,
                icon: const Icon(Icons.open_in_new, size: 16),
                label: Text(ready ? '스마트스토어로 이동' : '스마트스토어 연결 준비 중'),
              ),
            ),
            if (ready) ...<Widget>[
              const SizedBox(height: 12),
              const Text('결제하셨다면 주문번호를 남겨 주세요',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              const Text('스마트스토어 주문 내역에서 확인하실 수 있습니다. 없으면 비워 두셔도 됩니다.',
                  style: TextStyle(fontSize: 12, color: Colors.black54)),
              const SizedBox(height: 8),
              TextField(
                controller: controller,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  isDense: true,
                  hintText: '예: 2026090812345678',
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: disabled ? null : onDeclare,
                  child: declaring
                      ? const SizedBox(
                          height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(settled
                          ? '결제 확인됨'
                          : declared
                              ? '확인 요청됨'
                              : '스마트스토어에서 결제했습니다'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _InquiryCard extends StatelessWidget {
  const _InquiryCard({required this.onKakao});

  final VoidCallback onKakao;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text('문의하기', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onKakao,
                icon: const Icon(Icons.open_in_new, size: 16),
                label: const Text('카카오톡 채널로 문의'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
