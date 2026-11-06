import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/locale_provider.dart';
import 'screens/auth_screen.dart';
import 'screens/farmer_dashboard_screen.dart';
import 'screens/language_gateway_screen.dart';
import 'screens/owner_dashboard_screen.dart';
import 'services/api_service.dart';
import 'theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiService.init();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => LocaleProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
      ],
      child: const KisanTractorApp(),
    ),
  );
}

class KisanTractorApp extends StatelessWidget {
  const KisanTractorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kisan Tractor',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const _RootDecider(),
    );
  }
}

class _RootDecider extends StatelessWidget {
  const _RootDecider();

  @override
  Widget build(BuildContext context) {
    final locale = Provider.of<LocaleProvider>(context);
    final auth = Provider.of<AuthProvider>(context);

    // 1. Mandatory First-Time Language Gateway Screen
    if (!locale.hasSelectedLanguage) {
      return const LanguageGatewayScreen();
    }

    // 2. Direct Dashboard Routing for Authenticated / Subsequent Login
    if (auth.isAuthenticated) {
      if (auth.currentUser?.isOwner == true) {
        return const OwnerDashboardScreen();
      }
      return const FarmerDashboardScreen();
    }

    // 3. Auth Screen (Farmer & Tractor Owner)
    return const AuthScreen();
  }
}

