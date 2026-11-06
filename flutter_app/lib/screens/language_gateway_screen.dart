import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/locale_provider.dart';
import '../theme/app_theme.dart';
import 'auth_screen.dart';

class LanguageGatewayScreen extends StatefulWidget {
  const LanguageGatewayScreen({super.key});

  @override
  State<LanguageGatewayScreen> createState() => _LanguageGatewayScreenState();
}

class _LanguageGatewayScreenState extends State<LanguageGatewayScreen> {
  String _selected = 'en';

  @override
  Widget build(BuildContext context) {
    final localeProvider = Provider.of<LocaleProvider>(context);

    return Scaffold(
      backgroundColor: AppTheme.cream,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 20),
              // Brand badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: AppTheme.forestOpacity08,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'KISAN TRACTOR',
                  style: TextStyle(
                    color: AppTheme.forest,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Choose Your Language\nअपनी भाषा चुनें',
                style: TextStyle(
                  color: AppTheme.forest,
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Select your preferred language to continue using the app',
                style: TextStyle(color: AppTheme.stone, fontSize: 13),
              ),
              const SizedBox(height: 24),
              // Languages Grid
              Expanded(
                child: GridView.builder(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 1.8,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: LocaleProvider.supportedLanguages.length,
                  itemBuilder: (context, index) {
                    final lang = LocaleProvider.supportedLanguages[index];
                    final isSelected = _selected == lang.code;

                    return InkWell(
                      onTap: () {
                        setState(() {
                          _selected = lang.code;
                        });
                      },
                      borderRadius: BorderRadius.circular(16),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isSelected ? AppTheme.forest : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isSelected ? AppTheme.forest : AppTheme.line,
                            width: isSelected ? 2 : 1,
                          ),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x08000000),
                              blurRadius: 8,
                              offset: Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              lang.nativeName,
                              style: TextStyle(
                                color: isSelected ? AppTheme.cream : AppTheme.ink,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              lang.name,
                              style: TextStyle(
                                color: isSelected
                                    ? AppTheme.wheatOpacity90
                                    : AppTheme.stone,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              // Submit button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: () async {
                    final navigator = Navigator.of(context);
                    await localeProvider.selectLanguage(_selected);
                    navigator.pushReplacement(
                      MaterialPageRoute(builder: (_) => const AuthScreen()),
                    );
                  },
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('Continue • आगे बढ़ें', style: TextStyle(fontSize: 16)),
                      SizedBox(width: 8),
                      Icon(Icons.arrow_forward_rounded, size: 20),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
          ),
        ),
      ),
    );
  }
}
