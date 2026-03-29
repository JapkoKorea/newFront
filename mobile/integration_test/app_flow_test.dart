import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:japan_taxi_tour_mobile/app/app.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('shows production kakao login entry without manual token fields',
      (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: App()));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Login'), findsOneWidget);
    expect(find.text('카카오로 시작하기'), findsOneWidget);
    expect(find.text('Developer fallback'), findsNothing);
    expect(find.text('Use token directly'), findsNothing);
    expect(find.text('Sign in with code'), findsNothing);

    expect(find.text('로그인이 완료되면 자동으로 예약 화면으로 이동합니다.'), findsOneWidget);
  });
}
