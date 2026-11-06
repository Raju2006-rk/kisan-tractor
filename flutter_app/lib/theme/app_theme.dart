import 'package:flutter/material.dart';

class AppTheme {
  // Brand color palette matching the Kisan Tractor web platform
  static const Color forest = Color(0xFF163B2A);
  static const Color forestDark = Color(0xFF0F2B1E);
  static const Color clay = Color(0xFFB4552F);
  static const Color clayDark = Color(0xFF904223);
  static const Color cream = Color(0xFFFBF8F0);
  static const Color paper = Colors.white;
  static const Color ink = Color(0xFF19251E);
  static const Color stone = Color(0xFF5B695F);
  static const Color line = Color(0xFFE3DCBF);
  static const Color wheat = Color(0xFFF5E4B3);
  static const Color greenAccent = Color(0xFF1F7A4D);

  // Pre-computed transparent colors to avoid deprecated withOpacity
  static const Color forestOpacity08 = Color(0x14163B2A);
  static const Color forestOpacity20 = Color(0x33163B2A);
  static const Color clayOpacity25 = Color(0x40B4552F);
  static const Color wheatOpacity40 = Color(0x66F5E4B3);
  static const Color wheatOpacity50 = Color(0x80F5E4B3);
  static const Color wheatOpacity90 = Color(0xE6F5E4B3);

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: cream,
      colorScheme: const ColorScheme.light(
        primary: forest,
        secondary: clay,
        surface: paper,
        onPrimary: cream,
        onSecondary: Colors.white,
        onSurface: ink,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: cream,
        foregroundColor: forest,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: forest,
          fontSize: 20,
          fontWeight: FontWeight.bold,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: forest,
          foregroundColor: cream,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: forest,
          side: const BorderSide(color: line),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        filled: true,
        fillColor: paper,
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
          borderSide: BorderSide(color: line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
          borderSide: BorderSide(color: line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
          borderSide: BorderSide(color: forest, width: 1.5),
        ),
        hintStyle: TextStyle(color: Color(0xFF9EABA2), fontSize: 14),
      ),
      cardTheme: const CardTheme(
        color: paper,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(20)),
          side: BorderSide(color: line),
        ),
      ),
    );
  }
}
