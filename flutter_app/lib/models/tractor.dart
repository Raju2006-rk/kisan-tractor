class PricingModel {
  final int hourlyRate;
  final int acreRate;
  final int tripRate;
  final bool hourlyEnabled;
  final bool acreEnabled;
  final bool tripEnabled;

  PricingModel({
    this.hourlyRate = 800,
    this.acreRate = 1200,
    this.tripRate = 600,
    this.hourlyEnabled = true,
    this.acreEnabled = true,
    this.tripEnabled = false,
  });

  factory PricingModel.fromJson(Map<String, dynamic> json) {
    return PricingModel(
      hourlyRate: json['hourlyRate'] ?? 800,
      acreRate: json['acreRate'] ?? 1200,
      tripRate: json['tripRate'] ?? 600,
      hourlyEnabled: json['hourlyEnabled'] ?? true,
      acreEnabled: json['acreEnabled'] ?? true,
      tripEnabled: json['tripEnabled'] ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'hourlyRate': hourlyRate,
        'acreRate': acreRate,
        'tripRate': tripRate,
        'hourlyEnabled': hourlyEnabled,
        'acreEnabled': acreEnabled,
        'tripEnabled': tripEnabled,
      };
}

class TractorModel {
  final String id;
  final String ownerId;
  final String brand;
  final String model;
  final String regNumber;
  final int hp;
  final String image;
  final List<String> equipmentIds;
  final PricingModel pricing;
  final bool isAvailable;
  final double distanceKm;
  final String ownerName;
  final String ownerMobile;
  final String village;

  TractorModel({
    required this.id,
    required this.ownerId,
    required this.brand,
    required this.model,
    required this.regNumber,
    this.hp = 45,
    this.image = '',
    this.equipmentIds = const [],
    required this.pricing,
    this.isAvailable = true,
    this.distanceKm = 0.0,
    this.ownerName = '',
    this.ownerMobile = '',
    this.village = '',
  });

  factory TractorModel.fromJson(Map<String, dynamic> json) {
    final owner = json['owner'] as Map<String, dynamic>?;
    return TractorModel(
      id: json['id'] ?? '',
      ownerId: json['ownerId'] ?? '',
      brand: json['brand'] ?? '',
      model: json['model'] ?? '',
      regNumber: json['regNumber'] ?? '',
      hp: json['hp'] ?? 45,
      image: json['image'] ?? '',
      equipmentIds: List<String>.from(json['equipmentIds'] ?? []),
      pricing: PricingModel.fromJson(json['pricing'] ?? {}),
      isAvailable: json['isAvailable'] ?? true,
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0.0,
      ownerName: owner?['name'] ?? '',
      ownerMobile: owner?['mobile'] ?? '',
      village: json['village'] ?? owner?['village'] ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'ownerId': ownerId,
        'brand': brand,
        'model': model,
        'regNumber': regNumber,
        'hp': hp,
        'image': image,
        'equipmentIds': equipmentIds,
        'pricing': pricing.toJson(),
        'isAvailable': isAvailable,
        'distanceKm': distanceKm,
      };
}

