class BookingModel {
  final String id;
  final String tractorId;
  final String farmerId;
  final String ownerId;
  final String serviceType;
  final String pricingType;
  final double units;
  final int agreedRate;
  final int estimatedAmount;
  final int? finalAmount;
  final String status; // PENDING, ACCEPTED, IN_PROGRESS, PAUSED, COMPLETION_PENDING, PAYMENT_PENDING, COMPLETED, CANCELLED
  final String bookingDate;
  final String startTime;
  final String village;
  final String address;
  final String tractorBrand;
  final String tractorModel;
  final String farmerName;
  final String farmerMobile;
  final String ownerName;
  final String ownerMobile;

  BookingModel({
    required this.id,
    required this.tractorId,
    required this.farmerId,
    required this.ownerId,
    required this.serviceType,
    required this.pricingType,
    required this.units,
    required this.agreedRate,
    required this.estimatedAmount,
    this.finalAmount,
    required this.status,
    required this.bookingDate,
    required this.startTime,
    required this.village,
    this.address = '',
    this.tractorBrand = '',
    this.tractorModel = '',
    this.farmerName = '',
    this.farmerMobile = '',
    this.ownerName = '',
    this.ownerMobile = '',
  });

  factory BookingModel.fromJson(Map<String, dynamic> json) {
    final tractor = json['tractor'] as Map<String, dynamic>?;
    final farmer = json['farmer'] as Map<String, dynamic>?;
    final owner = json['owner'] as Map<String, dynamic>?;
    final loc = json['serviceLocation'] as Map<String, dynamic>?;

    return BookingModel(
      id: json['id'] ?? '',
      tractorId: json['tractorId'] ?? '',
      farmerId: json['farmerId'] ?? '',
      ownerId: json['ownerId'] ?? '',
      serviceType: json['serviceType'] ?? 'ploughing',
      pricingType: json['pricingType'] ?? 'hourly',
      units: (json['units'] as num?)?.toDouble() ?? 1.0,
      agreedRate: json['agreedRate'] ?? 0,
      estimatedAmount: json['estimatedAmount'] ?? 0,
      finalAmount: json['finalAmount'] as int?,
      status: json['status'] ?? 'PENDING',
      bookingDate: json['bookingDate'] ?? '',
      startTime: json['startTime'] ?? '',
      village: loc?['village'] ?? json['village'] ?? '',
      address: loc?['label'] ?? json['address'] ?? '',
      tractorBrand: tractor?['brand'] ?? '',
      tractorModel: tractor?['model'] ?? '',
      farmerName: farmer?['name'] ?? '',
      farmerMobile: farmer?['mobile'] ?? '',
      ownerName: owner?['name'] ?? '',
      ownerMobile: owner?['mobile'] ?? '',
    );
  }
}

