import 'dart:convert';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

class LocationData {
  final double lat;
  final double lng;
  final String village;
  final String pincode;
  final String district;
  final String state;
  final String address;

  LocationData({
    required this.lat,
    required this.lng,
    this.village = '',
    this.pincode = '',
    this.district = '',
    this.state = '',
    this.address = '',
  });

  String get summary {
    final parts = [village, district, pincode].where((s) => s.isNotEmpty).toList();
    return parts.isNotEmpty ? parts.join(', ') : '${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}';
  }
}

class LocationService {
  static Future<LocationData?> getCurrentLocation() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return null;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return null;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return null;
    }

    final pos = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
      timeLimit: const Duration(seconds: 10),
    );

    return reverseGeocode(pos.latitude, pos.longitude);
  }

  static Future<LocationData> reverseGeocode(double lat, double lng) async {
    try {
      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lng&addressdetails=1',
      );
      final res = await http.get(url, headers: {'User-Agent': 'KisanTractorApp/1.0'});
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final addr = data['address'] as Map<String, dynamic>? ?? {};

        final village = (addr['village'] ??
                addr['town'] ??
                addr['suburb'] ??
                addr['hamlet'] ??
                addr['city'] ??
                '')
            .toString();
        final district = (addr['state_district'] ?? addr['county'] ?? '').toString();
        final state = (addr['state'] ?? '').toString();
        final pincode = (addr['postcode'] ?? '').toString();
        final address = (data['display_name'] ?? '').toString();

        return LocationData(
          lat: lat,
          lng: lng,
          village: village,
          district: district,
          state: state,
          pincode: pincode,
          address: address,
        );
      }
    } catch (_) {}

    return LocationData(lat: lat, lng: lng);
  }
}

