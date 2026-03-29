import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/config/app_config.dart';
import '../features/auth/application/auth_controller.dart';
import '../features/auth/presentation/auth_callback_page.dart';
import '../features/auth/presentation/login_page.dart';
import '../features/booking/presentation/reservations_page.dart';
import '../features/booking/presentation/booking_shell_page.dart';
import '../features/tours/presentation/tour_detail_page.dart';
import '../features/tours/presentation/tours_page.dart';
import '../features/payment/presentation/payment_fail_page.dart';
import '../features/payment/presentation/payment_review_page.dart';
import '../features/payment/presentation/payment_success_page.dart';

final Provider<GoRouter> appRouterProvider = Provider<GoRouter>((ref) {
  final AuthState authState = ref.watch(authControllerProvider);
  const bool skipAuth = AppConfig.skipAuth;

  return GoRouter(
    initialLocation: skipAuth ? '/tours' : '/login',
    redirect: (context, state) {
      if (skipAuth) {
        return null;
      }

      if (authState.isBootstrapping) {
        return null;
      }

      final bool loggingIn = state.matchedLocation == '/login';
      final bool authCallback = state.matchedLocation == '/auth/callback';
      if (!authState.isAuthenticated && !loggingIn && !authCallback) {
        return '/login';
      }

      if (authState.isAuthenticated && loggingIn) {
        return '/tours';
      }

      return null;
    },
    routes: <GoRoute>[
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/auth/callback',
        name: 'auth-callback',
        builder: (context, state) => AuthCallbackPage(
          code: state.uri.queryParameters['code'] ?? '',
          token: state.uri.queryParameters['token'] ?? '',
          userB64: state.uri.queryParameters['user_b64'] ?? '',
          error: state.uri.queryParameters['error'] ?? '',
          errorDescription:
              state.uri.queryParameters['error_description'] ?? '',
        ),
      ),
      GoRoute(
        path: '/tours',
        name: 'tours',
        builder: (context, state) => const ToursPage(),
      ),
      GoRoute(
        path: '/tours/:id',
        name: 'tour-detail',
        builder: (context, state) =>
            TourDetailPage(tourId: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(
        path: '/booking',
        name: 'booking',
        builder: (context, state) => const BookingShellPage(),
      ),
      GoRoute(
        path: '/reservations',
        name: 'reservations',
        builder: (context, state) => const ReservationsPage(),
      ),
      GoRoute(
        path: '/payment/review',
        name: 'payment-review',
        builder: (context, state) => PaymentReviewPage(
          reservationNumber:
              state.uri.queryParameters['reservation_number'] ?? '',
        ),
      ),
      GoRoute(
        path: '/payment/success',
        name: 'payment-success',
        builder: (context, state) => PaymentSuccessPage(
          reservationNumber:
              state.uri.queryParameters['reservation_number'] ?? '',
          orderId: state.uri.queryParameters['orderId'] ?? '',
          paymentKey: state.uri.queryParameters['paymentKey'] ?? '',
          amount: int.tryParse(state.uri.queryParameters['amount'] ?? '') ?? 0,
        ),
      ),
      GoRoute(
        path: '/payment/fail',
        name: 'payment-fail',
        builder: (context, state) => PaymentFailPage(
          reservationNumber:
              state.uri.queryParameters['reservation_number'] ?? '',
          orderId: state.uri.queryParameters['orderId'] ?? '',
        ),
      ),
    ],
  );
});
