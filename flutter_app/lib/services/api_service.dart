import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../models/tractor.dart';
import '../models/booking.dart';

class ApiService {
  // In development, you can point this to your local Next.js server.
  // 10.0.2.2 is the localhost alias for Android Emulator; localhost works for Web and iOS.
  static String baseUrl = 'http://10.0.2.2:3000';

  static String? _sessionCookie;

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _sessionCookie = prefs.getString('session_cookie');
  }

  static Future<void> _saveCookie(http.Response response) async {
    final rawCookie = response.headers['set-cookie'];
    if (rawCookie != null) {
      _sessionCookie = rawCookie.split(';').first;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('session_cookie', _sessionCookie!);
    }
  }

  static Map<String, String> _headers() {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (_sessionCookie != null) {
      headers['Cookie'] = _sessionCookie!;
    }
    return headers;
  }

  static Future<Map<String, dynamic>> requestOtp({
    required String mobile,
    String? name,
    required String role,
    String language = 'en',
  }) async {
    final url = Uri.parse('$baseUrl/api/auth/request-otp');
    final response = await http.post(
      url,
      headers: _headers(),
      body: jsonEncode({
        'mobile': mobile,
        'name': name,
        'role': role,
        'language': language,
      }),
    );
    await _saveCookie(response);
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> verifyOtp({
    required String mobile,
    required String otp,
    String? name,
    required String role,
    String language = 'en',
  }) async {
    final url = Uri.parse('$baseUrl/api/auth/verify-otp');
    final response = await http.post(
      url,
      headers: _headers(),
      body: jsonEncode({
        'mobile': mobile,
        'otp': otp,
        'name': name,
        'role': role,
        'language': language,
      }),
    );
    await _saveCookie(response);
    return jsonDecode(response.body);
  }

  static Future<bool> updateProfile({
    required String name,
    required String village,
    String? address,
    String? pincode,
    String? district,
    String? state,
    double? lat,
    double? lng,
  }) async {
    final url = Uri.parse('$baseUrl/api/profile');
    final response = await http.patch(
      url,
      headers: _headers(),
      body: jsonEncode({
        'name': name,
        'village': village,
        'address': address ?? village,
        'pincode': pincode ?? '',
        'district': district ?? '',
        'state': state ?? '',
        'lat': lat,
        'lng': lng,
      }),
    );
    await _saveCookie(response);
    return response.statusCode == 200;
  }

  static Future<List<TractorModel>> fetchTractors({String? village}) async {
    final query = village != null && village.isNotEmpty ? '?village=${Uri.encodeComponent(village)}' : '';
    final url = Uri.parse('$baseUrl/api/tractors$query');
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final list = (data['tractors'] as List? ?? []);
      return list.map((item) => TractorModel.fromJson(item)).toList();
    }
    return [];
  }

  static Future<List<BookingModel>> fetchBookings() async {
    final url = Uri.parse('$baseUrl/api/bookings');
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final list = (data['bookings'] as List? ?? []);
      return list.map((item) => BookingModel.fromJson(item)).toList();
    }
    return [];
  }

  static Future<BookingModel?> createBooking({
    required String tractorId,
    required String serviceType,
    required String pricingType,
    required double units,
    required String bookingDate,
    required String startTime,
    required String village,
    required String farmLabel,
    double? lat,
    double? lng,
  }) async {
    final url = Uri.parse('$baseUrl/api/bookings');
    final response = await http.post(
      url,
      headers: _headers(),
      body: jsonEncode({
        'tractorId': tractorId,
        'serviceType': serviceType,
        'pricingType': pricingType,
        'units': units,
        'bookingDate': bookingDate,
        'startTime': startTime,
        'village': village,
        'farmLabel': farmLabel,
        'lat': lat ?? 0.0,
        'lng': lng ?? 0.0,
      }),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);
      if (data['booking'] != null) {
        return BookingModel.fromJson(data['booking']);
      }
    }
    return null;
  }

  static Future<bool> saveTractor({
    required String brand,
    required String model,
    required String regNumber,
    required int hp,
    required List<String> equipmentIds,
    required Map<String, dynamic> pricing,
    required String village,
    String? image,
    double? lat,
    double? lng,
  }) async {
    final url = Uri.parse('$baseUrl/api/tractors');
    final response = await http.post(
      url,
      headers: _headers(),
      body: jsonEncode({
        'brand': brand,
        'model': model,
        'regNumber': regNumber,
        'hp': hp,
        'equipmentIds': equipmentIds,
        'pricing': pricing,
        'village': village,
        'image': image ?? 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
        'lat': lat ?? 0.0,
        'lng': lng ?? 0.0,
      }),
    );
    await _saveCookie(response);
    return response.statusCode == 200 || response.statusCode == 201;
  }

  static Future<void> logout() async {
    try {
      await http.post(Uri.parse('$baseUrl/api/auth/logout'), headers: _headers());
    } catch (_) {}
    _sessionCookie = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('session_cookie');
    await prefs.remove('cached_user');
  }
}

