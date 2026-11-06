import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/tractor.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../theme/app_theme.dart';

class BookingWizardScreen extends StatefulWidget {
  final TractorModel tractor;

  const BookingWizardScreen({super.key, required this.tractor});

  @override
  State<BookingWizardScreen> createState() => _BookingWizardScreenState();
}

class _BookingWizardScreenState extends State<BookingWizardScreen> {
  String _serviceType = 'ploughing';
  String _pricingType = 'hourly';
  double _units = 2.0;
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _time = const TimeOfDay(hour: 9, minute: 0);

  final _villageController = TextEditingController(text: 'Doddabele');
  final _farmLabelController = TextEditingController();
  double? _lat;
  double? _lng;
  bool _isLocating = false;
  bool _isSubmitting = false;

  static const List<Map<String, String>> services = [
    {'id': 'ploughing', 'name': 'Ploughing (जुताई)'},
    {'id': 'rotavator', 'name': 'Rotavator (रोटावेटर)'},
    {'id': 'sowing', 'name': 'Sowing (बुवाई)'},
    {'id': 'haulage', 'name': 'Haulage (परिवहन)'},
  ];

  @override
  void dispose() {
    _villageController.dispose();
    _farmLabelController.dispose();
    super.dispose();
  }

  int get _rate {
    if (_pricingType == 'hourly') return widget.tractor.pricing.hourlyRate;
    if (_pricingType == 'acre') return widget.tractor.pricing.acreRate;
    return widget.tractor.pricing.tripRate;
  }

  int get _estimatedAmount {
    return (_rate * _units).round();
  }

  Future<void> _detectLocation() async {
    setState(() => _isLocating = true);
    final loc = await LocationService.getCurrentLocation();
    if (!mounted) return;
    setState(() => _isLocating = false);

    if (loc != null) {
      setState(() {
        _lat = loc.lat;
        _lng = loc.lng;
        if (loc.village.isNotEmpty) _villageController.text = loc.village;
        if (loc.address.isNotEmpty) _farmLabelController.text = loc.address;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Farm location detected: ${loc.summary}'),
          backgroundColor: AppTheme.forest,
        ),
      );
    }
  }

  Future<void> _submitBooking() async {
    setState(() => _isSubmitting = true);

    final bookingDate = DateFormat('yyyy-MM-dd').format(_date);
    final startTime =
        '${_time.hour.toString().padLeft(2, '0')}:${_time.minute.toString().padLeft(2, '0')}';

    await ApiService.createBooking(
      tractorId: widget.tractor.id,
      serviceType: _serviceType,
      pricingType: _pricingType,
      units: _units,
      bookingDate: bookingDate,
      startTime: startTime,
      village: _villageController.text.trim(),
      farmLabel: _farmLabelController.text.trim().isNotEmpty
          ? _farmLabelController.text.trim()
          : _villageController.text.trim(),
      lat: _lat,
      lng: _lng,
    );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              const CircleAvatar(
                radius: 30,
                backgroundColor: Color(0xFFE8F5E9),
                child: Icon(Icons.check_circle, color: AppTheme.forest, size: 40),
              ),
              const SizedBox(height: 16),
              const Text(
                'Booking Request Sent!\nबुकिंग अनुरोध भेजा गया',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppTheme.forest,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Request sent to ${widget.tractor.ownerName}. Direct cash/UPI payment after job completion.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppTheme.stone, fontSize: 12),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    Navigator.pop(context); // Return to Dashboard
                  },
                  child: const Text('Back to Dashboard'),
                ),
              ),
            ],
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        title: const Text('Book Tractor'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Selected Tractor Card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.line),
                ),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: SizedBox(
                        width: 70,
                        height: 70,
                        child: widget.tractor.image.isNotEmpty
                            ? Image.network(
                                widget.tractor.image,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) =>
                                    Container(color: Colors.grey.shade200),
                              )
                            : Container(color: Colors.grey.shade200),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${widget.tractor.brand} ${widget.tractor.model}',
                            style: const TextStyle(
                              color: AppTheme.forest,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                          Text(
                            'Owner: ${widget.tractor.ownerName}',
                            style: const TextStyle(color: AppTheme.stone, fontSize: 12),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '₹${widget.tractor.pricing.hourlyRate}/hr • ${widget.tractor.village}',
                            style: const TextStyle(
                              color: AppTheme.forest,
                              fontWeight: FontWeight.w600,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Service Type Selection
              const Text(
                '1. Select Service Type',
                style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: services.map((s) {
                  final isSelected = _serviceType == s['id'];
                  return ChoiceChip(
                    label: Text(s['name']!),
                    selected: isSelected,
                    selectedColor: AppTheme.forest,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : AppTheme.forest,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                    backgroundColor: Colors.white,
                    side: BorderSide(color: isSelected ? AppTheme.forest : AppTheme.line),
                    onSelected: (val) {
                      if (val) setState(() => _serviceType = s['id']!);
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),

              // Pricing Type & Units
              const Text(
                '2. Pricing Unit & Duration',
                style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  _PricingChip(
                    title: 'Hourly',
                    subtitle: '₹${widget.tractor.pricing.hourlyRate}/hr',
                    isSelected: _pricingType == 'hourly',
                    onTap: () => setState(() => _pricingType = 'hourly'),
                  ),
                  const SizedBox(width: 8),
                  _PricingChip(
                    title: 'Per Acre',
                    subtitle: '₹${widget.tractor.pricing.acreRate}/acre',
                    isSelected: _pricingType == 'acre',
                    onTap: () => setState(() => _pricingType = 'acre'),
                  ),
                  const SizedBox(width: 8),
                  _PricingChip(
                    title: 'Per Trip',
                    subtitle: '₹${widget.tractor.pricing.tripRate}/trip',
                    isSelected: _pricingType == 'trip',
                    onTap: () => setState(() => _pricingType = 'trip'),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Unit Stepper
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.line),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _pricingType == 'hourly'
                          ? 'Hours needed'
                          : _pricingType == 'acre'
                              ? 'Acres to work'
                              : 'Trips',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove_circle_outline, color: AppTheme.forest),
                          onPressed: () {
                            if (_units > 1) setState(() => _units -= 1);
                          },
                        ),
                        Text(
                          '${_units.toInt()} ${_pricingType == "hourly" ? "hrs" : _pricingType == "acre" ? "acres" : "trips"}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add_circle_outline, color: AppTheme.forest),
                          onPressed: () {
                            setState(() => _units += 1);
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Date & Time
              const Text(
                '3. Schedule Date & Time',
                style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: _date,
                          firstDate: DateTime.now(),
                          lastDate: DateTime.now().add(const Duration(days: 30)),
                        );
                        if (picked != null) setState(() => _date = picked);
                      },
                      icon: const Icon(Icons.calendar_today, size: 16),
                      label: Text(DateFormat('dd MMM yyyy').format(_date)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        final picked = await showTimePicker(context: context, initialTime: _time);
                        if (picked != null) setState(() => _time = picked);
                      },
                      icon: const Icon(Icons.access_time, size: 16),
                      label: Text(_time.format(context)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Farm Location
              const Text(
                '4. Farm Service Location',
                style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.line),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Base Village', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        OutlinedButton.icon(
                          onPressed: _isLocating ? null : _detectLocation,
                          icon: const Icon(Icons.my_location, size: 14),
                          label: Text(_isLocating ? 'Locating...' : 'GPS Auto-Detect'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _villageController,
                      decoration: const InputDecoration(hintText: 'Village Name'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _farmLabelController,
                      decoration: const InputDecoration(hintText: 'Farm landmark / Survey number'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Estimated Price Banner
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.wheatOpacity40,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.wheat),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Estimated Bill',
                          style: TextStyle(color: Color(0xFF7A5A1D), fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                        Text(
                          'Pay directly to driver upon completion',
                          style: TextStyle(color: AppTheme.stone, fontSize: 10),
                        ),
                      ],
                    ),
                    Text(
                      '₹$_estimatedAmount',
                      style: const TextStyle(
                        color: AppTheme.forest,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Confirm Booking Button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submitBooking,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Confirm Booking • बुकिंग पक्की करें'),
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}

class _PricingChip extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool isSelected;
  final VoidCallback onTap;

  const _PricingChip({
    required this.title,
    required this.subtitle,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          decoration: BoxDecoration(
            color: isSelected ? AppTheme.forest : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isSelected ? AppTheme.forest : AppTheme.line),
          ),
          child: Column(
            children: [
              Text(
                title,
                style: TextStyle(
                  color: isSelected ? Colors.white : AppTheme.ink,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(
                  color: isSelected ? AppTheme.wheat : AppTheme.stone,
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

