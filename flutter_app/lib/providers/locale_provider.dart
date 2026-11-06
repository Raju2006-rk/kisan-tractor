import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LanguageItem {
  final String code;
  final String name;
  final String nativeName;

  const LanguageItem({
    required this.code,
    required this.name,
    required this.nativeName,
  });
}

class LocaleProvider with ChangeNotifier {
  static const List<LanguageItem> supportedLanguages = [
    LanguageItem(code: 'en', name: 'English', nativeName: 'English'),
    LanguageItem(code: 'hi', name: 'Hindi', nativeName: 'हिन्दी'),
    LanguageItem(code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ'),
    LanguageItem(code: 'te', name: 'Telugu', nativeName: 'తెలుగు'),
    LanguageItem(code: 'ta', name: 'Tamil', nativeName: 'தமிழ்'),
    LanguageItem(code: 'mr', name: 'Marathi', nativeName: 'मराठी'),
    LanguageItem(code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ'),
    LanguageItem(code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી'),
    LanguageItem(code: 'bn', name: 'Bengali', nativeName: 'বাংলা'),
    LanguageItem(code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം'),
  ];

  String _currentLanguage = 'en';
  bool _hasSelectedLanguage = false;

  String get currentLanguage => _currentLanguage;
  bool get hasSelectedLanguage => _hasSelectedLanguage;

  LocaleProvider() {
    _loadLanguagePreference();
  }

  Future<void> _loadLanguagePreference() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('selected_language');
    if (saved != null) {
      _currentLanguage = saved;
      _hasSelectedLanguage = true;
      notifyListeners();
    }
  }

  Future<void> selectLanguage(String code) async {
    _currentLanguage = code;
    _hasSelectedLanguage = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('selected_language', code);
    notifyListeners();
  }

  String translate(String key) {
    // Basic dictionary with English and Indian fallbacks for the primary UI keys
    final Map<String, Map<String, String>> dict = {
      'welcome': {
        'en': 'Welcome to Kisan Tractor',
        'hi': 'किसान ट्रैक्टर में आपका स्वागत है',
        'kn': 'ಕಿಸಾನ್ ಟ್ರ್ಯಾಕ್ಟರ್‌ಗೆ ಸುಸ್ವಾಗತ',
        'te': 'కిసాన్ ట్రాక్టర్‌కు స్వాగతం',
      },
      'farmer': {'en': 'Farmer', 'hi': 'किसान', 'kn': 'ರೈತ', 'te': 'రైతు'},
      'owner': {'en': 'Tractor Owner', 'hi': 'ट्रैक्टर मालिक', 'kn': 'ಟ್ರ್ಯಾಕ್ಟರ್ ಮಾಲೀಕ', 'te': 'ట్రాక్టర్ యజమాని'},
      'continue': {'en': 'Continue', 'hi': 'आगे बढ़ें', 'kn': 'ಮುಂದುವರಿಸಿ', 'te': 'కొనసాగించండి'},
      'save_and_login': {'en': 'Save & Login', 'hi': 'सुरक्षित करें और लॉगिन करें', 'kn': 'ಉಳಿಸಿ ಮತ್ತು ಲಾಗಿನ್ ಮಾಡಿ', 'te': 'సేవ్ చేసి లాగిన్ అవ్వండి'},
      'auto_detect': {'en': 'Auto-Detect Location', 'hi': 'स्थान स्वतः पहचानें', 'kn': 'ಸ್ವಯಂಚಾಲಿತ ಸ್ಥಳ ಪತ್ತೆ', 'te': 'ఆటో డిటెక్ట్ స్థానం'},
    };

    return dict[key]?[_currentLanguage] ?? dict[key]?['en'] ?? key;
  }
}

