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

class PaymentApi {
  PaymentApi(this._apiClient);

  final ApiClient _apiClient;

  Future<PaymentPrepareData> preparePayment(String reservationNumber) async {
    final Map<String, dynamic> response = await _apiClient.postJson(
      '/api/payments/prepare',
      query: <String, String>{'reservation_number': reservationNumber},
    );
    return PaymentPrepareData.fromJson(response);
  }

  Future<void> failPayment({
    required String orderId,
    required String code,
    required String message,
  }) async {
    await _apiClient.postJson(
      '/api/payments/fail',
      body: <String, dynamic>{
        'orderId': orderId,
        'code': code,
        'message': message,
      },
    );
  }

  Future<void> confirmPayment({
    required String paymentKey,
    required String orderId,
    required int amount,
  }) async {
    await _apiClient.postJson(
      '/api/payments/confirm',
      body: <String, dynamic>{
        'paymentKey': paymentKey,
        'orderId': orderId,
        'amount': amount,
      },
    );
  }
}

final Provider<PaymentApi> paymentApiProvider = Provider<PaymentApi>((Ref ref) {
  return PaymentApi(ApiClient());
});
