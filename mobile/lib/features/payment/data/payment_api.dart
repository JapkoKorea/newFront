import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

class PaymentPrepareData {
  const PaymentPrepareData({
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.orderName,
    required this.customerName,
    required this.customerPhone,
    required this.successUrl,
    required this.failUrl,
  });

  final String orderId;
  final int amount;
  final String currency;
  final String orderName;
  final String customerName;
  final String customerPhone;
  final String successUrl;
  final String failUrl;

  factory PaymentPrepareData.fromJson(Map<String, dynamic> json) {
    return PaymentPrepareData(
      orderId: json['order_id']?.toString() ?? '',
      amount: (json['amount'] as num?)?.toInt() ?? 0,
      currency: json['currency']?.toString() ?? 'KRW',
      orderName: json['order_name']?.toString() ?? '',
      customerName: json['customer_name']?.toString() ?? '',
      customerPhone: json['customer_mobile_phone']?.toString() ?? '',
      successUrl: json['success_url']?.toString() ?? '',
      failUrl: json['fail_url']?.toString() ?? '',
    );
  }
}

/// 계좌이체·스마트스토어 결제 안내에 필요한 값.
class ManualPaymentInfo {
  const ManualPaymentInfo({
    required this.amount,
    required this.isLastMinute,
    required this.paymentStatus,
    required this.canPay,
    required this.blockReason,
    required this.reservation,
  });

  final int amount;
  final bool isLastMinute;
  final String paymentStatus;
  final bool canPay;
  final String? blockReason;
  final Map<String, dynamic> reservation;

  factory ManualPaymentInfo.fromJson(Map<String, dynamic> json) {
    return ManualPaymentInfo(
      amount: (json['amount'] as num?)?.toInt() ?? 0,
      isLastMinute: json['isLastMinute'] == true,
      paymentStatus: json['paymentStatus']?.toString() ?? 'unpaid',
      canPay: json['canPay'] != false,
      blockReason: json['blockReason']?.toString(),
      reservation: (json['reservation'] as Map<String, dynamic>?) ?? <String, dynamic>{},
    );
  }
}

class PaymentApi {
  PaymentApi(this._apiClient);

  final ApiClient _apiClient;

  Future<ManualPaymentInfo> transferInfo(String reservationNumber) async {
    final Map<String, dynamic> response = await _apiClient.getJson(
      '/api/payments/transfer-info',
      query: <String, String>{'reservation_number': reservationNumber},
    );
    return ManualPaymentInfo.fromJson(response);
  }

  /// 고객이 "결제했다"고 알린다. 확인은 운영자가 한다.
  Future<Map<String, dynamic>> declarePayment({
    required String reservationNumber,
    required String channel,
    String? externalOrderNo,
  }) {
    return _apiClient.postJson(
      '/api/payments/declare',
      query: <String, String>{'reservation_number': reservationNumber},
      body: <String, dynamic>{
        'channel': channel,
        'external_order_no': externalOrderNo,
      },
    );
  }

  // ── 토스 결제 (심사 전까지 비활성) ────────────────────────────
  // 결제 화면이 계좌이체·스마트스토어로 바뀌면서 아래 세 호출은 쓰이지 않는다.
  // 백엔드 엔드포인트는 그대로 살아 있으므로, 카드 결제를 되살릴 때 주석만
  // 풀면 된다.
  //
  // Future<PaymentPrepareData> preparePayment(String reservationNumber) async {
  //   final Map<String, dynamic> response = await _apiClient.postJson(
  //     '/api/payments/prepare',
  //     query: <String, String>{'reservation_number': reservationNumber},
  //   );
  //   return PaymentPrepareData.fromJson(response);
  // }
  //
  // Future<void> failPayment({
  //   required String orderId,
  //   required String code,
  //   required String message,
  // }) async {
  //   await _apiClient.postJson(
  //     '/api/payments/fail',
  //     body: <String, dynamic>{
  //       'orderId': orderId,
  //       'code': code,
  //       'message': message,
  //     },
  //   );
  // }
  //
  // Future<void> confirmPayment({
  //   required String paymentKey,
  //   required String orderId,
  //   required int amount,
  // }) async {
  //   await _apiClient.postJson(
  //     '/api/payments/confirm',
  //     body: <String, dynamic>{
  //       'paymentKey': paymentKey,
  //       'orderId': orderId,
  //       'amount': amount,
  //     },
  //   );
  // }
}

final Provider<PaymentApi> paymentApiProvider = Provider<PaymentApi>((Ref ref) {
  return PaymentApi(ApiClient());
});
