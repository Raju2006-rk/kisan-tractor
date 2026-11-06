import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:kisan_tractor/main.dart';
import 'package:kisan_tractor/providers/auth_provider.dart';
import 'package:kisan_tractor/providers/locale_provider.dart';

void main() {
  testWidgets('App renders root smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => LocaleProvider()),
          ChangeNotifierProvider(create: (_) => AuthProvider()),
        ],
        child: const KisanTractorApp(),
      ),
    );

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
