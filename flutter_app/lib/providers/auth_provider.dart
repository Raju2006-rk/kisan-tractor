import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../services/api_service.dart';

enum AuthStatus {
  initial,
  otpSent,
  needFarmerRegistration,
  needTractorRegistration,
  authenticated,
}

class AuthProvider with ChangeNotifier {
  UserModel? _currentUser;
  String _activeRole = 'farmer'; // 'farmer' or 'owner'
  AuthStatus _status = AuthStatus.initial;
  String? _mobile;
  String? _name;
  String? _devOtp;
  String? _errorMessage;
  bool _isLoading = false;

  UserModel? get currentUser => _currentUser;
  String get activeRole => _activeRole;
  AuthStatus get status => _status;
  String? get mobile => _mobile;
  String? get name => _name;
  String? get devOtp => _devOtp;
  String? get errorMessage => _errorMessage;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _status == AuthStatus.authenticated && _currentUser != null;

  AuthProvider() {
    _loadSavedUser();
  }

  Future<void> _loadSavedUser() async {
    final prefs = await SharedPreferences.getInstance();
    final rawUser = prefs.getString('cached_user');
    if (rawUser != null) {
      try {
        final data = jsonDecode(rawUser);
        _currentUser = UserModel.fromJson(data);
        _activeRole = _currentUser!.role;
        _status = AuthStatus.authenticated;
        notifyListeners();
      } catch (_) {}
    }
  }

  void setRole(String role) {
    _activeRole = role;
    notifyListeners();
  }

  Future<bool> requestOtp({
    required String mobile,
    String? name,
    required String role,
    String language = 'en',
  }) async {
    _isLoading = true;
    _errorMessage = null;
    _mobile = mobile;
    _name = name;
    _activeRole = role;
    notifyListeners();

    try {
      final res = await ApiService.requestOtp(
        mobile: mobile,
        name: name,
        role: role,
        language: language,
      );

      if (res['error'] != null) {
        _errorMessage = res['error'];
        _isLoading = false;
        notifyListeners();
        return false;
      }

      // Fast Subsequent Login Check:
      // If user has already registered and storage data matches -> directly signed in without OTP!
      if (res['signedIn'] == true) {
        final profileRole = res['role'] ?? role;
        _currentUser = UserModel(
          id: res['userId'] ?? 'user_${DateTime.now().millisecondsSinceEpoch}',
          mobile: mobile,
          name: res['name'] ?? name ?? '',
          role: profileRole,
        );
        _status = AuthStatus.authenticated;
        await _saveUserSession(_currentUser!);
        _isLoading = false;
        notifyListeners();
        return true;
      }

      // First-time or unverified user: OTP sent
      _devOtp = res['devOtp'];
      _status = AuthStatus.otpSent;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Connection error. Please check your network and try again.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> verifyOtp(String otp, {String language = 'en'}) async {
    if (_mobile == null) return false;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.verifyOtp(
        mobile: _mobile!,
        otp: otp,
        name: _name,
        role: _activeRole,
        language: language,
      );

      if (res['error'] != null) {
        _errorMessage = res['error'];
        _isLoading = false;
        notifyListeners();
        return false;
      }

      final role = res['role'] ?? _activeRole;
      final userJson = res['user'];
      if (userJson != null) {
        _currentUser = UserModel.fromJson(userJson);
      } else {
        _currentUser = UserModel(
          id: 'user_${DateTime.now().millisecondsSinceEpoch}',
          mobile: _mobile!,
          name: _name ?? '',
          role: role,
        );
      }

      // 1. Farmer Registration Check:
      if (role == 'farmer') {
        final hasFarmerDetails = res['hasFarmerDetails'] == true;
        if (hasFarmerDetails) {
          _status = AuthStatus.authenticated;
          await _saveUserSession(_currentUser!);
        } else {
          _status = AuthStatus.needFarmerRegistration;
        }
        _isLoading = false;
        notifyListeners();
        return true;
      }

      // 2. Tractor Owner Registration Check:
      if (role == 'owner') {
        final hasTractor = res['hasTractor'] == true;
        if (hasTractor) {
          _status = AuthStatus.authenticated;
          await _saveUserSession(_currentUser!);
        } else {
          _status = AuthStatus.needTractorRegistration;
        }
        _isLoading = false;
        notifyListeners();
        return true;
      }

      _status = AuthStatus.authenticated;
      await _saveUserSession(_currentUser!);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'OTP verification failed. Please try again.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> completeFarmerRegistration({
    required String name,
    required String village,
    String? address,
    String? pincode,
    String? district,
    String? state,
    double? lat,
    double? lng,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    final success = await ApiService.updateProfile(
      name: name,
      village: village,
      address: address,
      pincode: pincode,
      district: district,
      state: state,
      lat: lat,
      lng: lng,
    );

    if (success) {
      _currentUser = UserModel(
        id: _currentUser?.id ?? 'user_${DateTime.now().millisecondsSinceEpoch}',
        mobile: _mobile ?? _currentUser?.mobile ?? '',
        name: name,
        role: 'farmer',
        farmerProfile: FarmerProfile(
          village: village,
          address: address ?? village,
          pincode: pincode ?? '',
          district: district ?? '',
          state: state ?? '',
          lat: lat ?? 0.0,
          lng: lng ?? 0.0,
        ),
      );
      _status = AuthStatus.authenticated;
      await _saveUserSession(_currentUser!);
      _isLoading = false;
      notifyListeners();
      return true;
    } else {
      _errorMessage = 'Failed to save profile. Please try again.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> completeTractorRegistration({
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
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    final success = await ApiService.saveTractor(
      brand: brand,
      model: model,
      regNumber: regNumber,
      hp: hp,
      equipmentIds: equipmentIds,
      pricing: pricing,
      village: village,
      image: image,
      lat: lat,
      lng: lng,
    );

    if (success) {
      _status = AuthStatus.authenticated;
      if (_currentUser != null) {
        await _saveUserSession(_currentUser!);
      }
      _isLoading = false;
      notifyListeners();
      return true;
    } else {
      _errorMessage = 'Failed to save tractor details.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> _saveUserSession(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('cached_user', jsonEncode(user.toJson()));
  }

  Future<void> logout() async {
    await ApiService.logout();
    _currentUser = null;
    _status = AuthStatus.initial;
    _mobile = null;
    _name = null;
    _devOtp = null;
    notifyListeners();
  }
}

