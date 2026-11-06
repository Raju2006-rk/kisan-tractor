class FarmerProfile {
  final String village;
  final String district;
  final String state;
  final String pincode;
  final String address;
  final double lat;
  final double lng;

  FarmerProfile({
    this.village = '',
    this.district = '',
    this.state = '',
    this.pincode = '',
    this.address = '',
    this.lat = 0.0,
    this.lng = 0.0,
  });

  factory FarmerProfile.fromJson(Map<String, dynamic> json) {
    return FarmerProfile(
      village: json['village'] ?? '',
      district: json['district'] ?? '',
      state: json['state'] ?? '',
      pincode: json['pincode'] ?? '',
      address: json['address'] ?? '',
      lat: (json['lat'] as num?)?.toDouble() ?? 0.0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() => {
        'village': village,
        'district': district,
        'state': state,
        'pincode': pincode,
        'address': address,
        'lat': lat,
        'lng': lng,
      };
}

class OwnerProfile {
  final String village;
  final String district;
  final String state;
  final String pincode;
  final int serviceRadiusKm;
  final double lat;
  final double lng;
  final bool isOnline;

  OwnerProfile({
    this.village = '',
    this.district = '',
    this.state = '',
    this.pincode = '',
    this.serviceRadiusKm = 25,
    this.lat = 0.0,
    this.lng = 0.0,
    this.isOnline = true,
  });

  factory OwnerProfile.fromJson(Map<String, dynamic> json) {
    return OwnerProfile(
      village: json['village'] ?? '',
      district: json['district'] ?? '',
      state: json['state'] ?? '',
      pincode: json['pincode'] ?? '',
      serviceRadiusKm: json['serviceRadiusKm'] ?? 25,
      lat: (json['lat'] as num?)?.toDouble() ?? 0.0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0.0,
      isOnline: json['isOnline'] ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'village': village,
        'district': district,
        'state': state,
        'pincode': pincode,
        'serviceRadiusKm': serviceRadiusKm,
        'lat': lat,
        'lng': lng,
        'isOnline': isOnline,
      };
}

class UserModel {
  final String id;
  final String mobile;
  final String name;
  final String role; // 'farmer' or 'owner'
  final String preferredLanguage;
  final FarmerProfile? farmerProfile;
  final OwnerProfile? ownerProfile;

  UserModel({
    required this.id,
    required this.mobile,
    required this.name,
    required this.role,
    this.preferredLanguage = 'en',
    this.farmerProfile,
    this.ownerProfile,
  });

  bool get isFarmer => role == 'farmer';
  bool get isOwner => role == 'owner';

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final role = json['role'] ?? 'farmer';
    final profile = json['profile'] as Map<String, dynamic>?;
    return UserModel(
      id: json['id'] ?? '',
      mobile: json['mobile'] ?? '',
      name: json['name'] ?? '',
      role: role,
      preferredLanguage: json['preferredLanguage'] ?? 'en',
      farmerProfile: role == 'farmer' && profile != null
          ? FarmerProfile.fromJson(profile)
          : null,
      ownerProfile: role == 'owner' && profile != null
          ? OwnerProfile.fromJson(profile)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'mobile': mobile,
        'name': name,
        'role': role,
        'preferredLanguage': preferredLanguage,
        if (farmerProfile != null) 'profile': farmerProfile!.toJson(),
        if (ownerProfile != null) 'profile': ownerProfile!.toJson(),
      };
}

