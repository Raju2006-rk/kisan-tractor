import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/location_service.dart';
import '../theme/app_theme.dart';
import 'owner_dashboard_screen.dart';

class TractorRegistrationScreen extends StatefulWidget {
  const TractorRegistrationScreen({super.key});

  @override
  State<TractorRegistrationScreen> createState() => _TractorRegistrationScreenState();
}

class _TractorRegistrationScreenState extends State<TractorRegistrationScreen> {
  int _currentStep = 0;

  // Step 1: Tractor Basics & Image
  final _brandController = TextEditingController(text: 'Mahindra');
  final _modelController = TextEditingController(text: '575 DI');
  final _regNumberController = TextEditingController();
  final _imageController = TextEditingController(
    text: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
  );

  // Step 2: Equipment & Specs
  int _hp = 45;
  final Set<String> _selectedEquipment = {'rotavator', 'cultivator'};
  final _hourlyRateController = TextEditingController(text: '800');
  final _acreRateController = TextEditingController(text: '1200');
  final _tripRateController = TextEditingController(text: '600');

  // Step 3: Location & Documents
  final _villageController = TextEditingController(text: 'Doddabele');
  final _pincodeController = TextEditingController(text: '560060');
  final _rcController = TextEditingController();
  double? _lat;
  double? _lng;
  bool _isLocating = false;
  String? _detectedLocation;

  static const List<String> brands = [
    'Mahindra',
    'Swaraj',
    'Sonalika',
    'John Deere',
    'Massey Ferguson',
    'New Holland',
    'Eicher',
    'Kubota',
  ];

  static const Map<String, String> equipmentCatalog = {
    'rotavator': 'Rotavator (रोटावेटर)',
    'cultivator': 'Cultivator (कल्टीवेटर)',
    'disc_plough': 'Disc Plough (डिस्क हल)',
    'seed_drill': 'Seed Drill (बीज ड्रिल)',
    'trolley': 'Trolley / Trailer (ट्रॉली)',
    'harvester': 'Harvester (हार्वेस्टर)',
  };

  @override
  void dispose() {
    _brandController.dispose();
    _modelController.dispose();
    _regNumberController.dispose();
    _imageController.dispose();
    _hourlyRateController.dispose();
    _acreRateController.dispose();
    _tripRateController.dispose();
    _villageController.dispose();
    _pincodeController.dispose();
    _rcController.dispose();
    super.dispose();
  }

  Future<void> _detectLocation() async {
    setState(() => _isLocating = true);
    final loc = await LocationService.getCurrentLocation();
    setState(() => _isLocating = false);

    if (loc != null) {
      setState(() {
        _lat = loc.lat;
        _lng = loc.lng;
        if (loc.village.isNotEmpty) _villageController.text = loc.village;
        if (loc.pincode.isNotEmpty) _pincodeController.text = loc.pincode;
        _detectedLocation = loc.summary;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Tractor base location detected: ${_detectedLocation!}'),
            backgroundColor: AppTheme.forest,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        title: const Text('Register Tractor'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Progress Bar
            LinearProgressIndicator(
              value: (_currentStep + 1) / 3,
              backgroundColor: AppTheme.line,
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.forest),
              minHeight: 4,
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Step ${_currentStep + 1} of 3',
                    style: const TextStyle(
                      color: AppTheme.stone,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    _currentStep == 0
                        ? '1. Vehicle Basics'
                        : _currentStep == 1
                            ? '2. Equipment & Rates'
                            : '3. Location & Docs',
                    style: const TextStyle(
                      color: AppTheme.forest,
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                child: _currentStep == 0
                    ? _buildStep1Basics()
                    : _currentStep == 1
                        ? _buildStep2Equipment()
                        : _buildStep3LocationDocs(),
              ),
            ),
            // Bottom Action Bar
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppTheme.line)),
              ),
              child: Row(
                children: [
                  if (_currentStep > 0) ...[
                    OutlinedButton(
                      onPressed: () => setState(() => _currentStep--),
                      child: const Text('Back'),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: ElevatedButton(
                      onPressed: auth.isLoading
                          ? null
                          : () async {
                              if (_currentStep < 2) {
                                if (_currentStep == 0) {
                                  if (_regNumberController.text.trim().isEmpty) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Please enter vehicle registration number'),
                                      ),
                                    );
                                    return;
                                  }
                                }
                                setState(() => _currentStep++);
                              } else {
                                // Final Save
                                final success = await auth.completeTractorRegistration(
                                  brand: _brandController.text.trim(),
                                  model: _modelController.text.trim(),
                                  regNumber: _regNumberController.text.trim(),
                                  hp: _hp,
                                  equipmentIds: _selectedEquipment.toList(),
                                  pricing: {
                                    'hourlyRate': int.tryParse(_hourlyRateController.text) ?? 800,
                                    'acreRate': int.tryParse(_acreRateController.text) ?? 1200,
                                    'tripRate': int.tryParse(_tripRateController.text) ?? 600,
                                    'hourlyEnabled': true,
                                    'acreEnabled': true,
                                    'tripEnabled': true,
                                  },
                                  village: _villageController.text.trim(),
                                  image: _imageController.text.trim(),
                                  lat: _lat,
                                  lng: _lng,
                                );
                                if (success && mounted) {
                                  Navigator.pushReplacement(
                                    context,
                                    MaterialPageRoute(builder: (_) => const OwnerDashboardScreen()),
                                  );
                                }
                              }
                            },
                      child: auth.isLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : Text(_currentStep == 2 ? 'Save & Start Earning' : 'Next Step'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep1Basics() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Tractor Details\nट्रैक्टर का विवरण',
          style: TextStyle(
            color: AppTheme.forest,
            fontSize: 22,
            fontWeight: FontWeight.bold,
            height: 1.25,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Enter tractor photo, brand, model, and registration number',
          style: TextStyle(color: AppTheme.stone, fontSize: 13),
        ),
        const SizedBox(height: 20),

        // Photo Upload / Preview
        Container(
          width: double.infinity,
          height: 160,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.line),
            image: DecorationImage(
              image: NetworkImage(_imageController.text),
              fit: BoxFit.cover,
            ),
          ),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Colors.black.withOpacity(0.6)],
              ),
            ),
            padding: const EdgeInsets.all(12),
            alignment: Alignment.bottomLeft,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Tractor Photo Uploaded',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Change',
                    style: TextStyle(color: Colors.white, fontSize: 11),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),

        // Brand Dropdown
        const Text(
          'Brand Name *',
          style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.w600, fontSize: 13),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: _brandController.text,
          decoration: const InputDecoration(),
          items: brands
              .map((b) => DropdownMenuItem(value: b, child: Text(b)))
              .toList(),
          onChanged: (val) {
            if (val != null) setState(() => _brandController.text = val);
          },
        ),
        const SizedBox(height: 16),

        // Model
        const Text(
          'Model *',
          style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.w600, fontSize: 13),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _modelController,
          decoration: const InputDecoration(hintText: 'e.g. 575 DI XP Plus'),
        ),
        const SizedBox(height: 16),

        // Registration Number
        const Text(
          'Vehicle Registration Number (RC) *',
          style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.w600, fontSize: 13),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _regNumberController,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(
            hintText: 'e.g. KA-04-E-1234',
            prefixIcon: Icon(Icons.pin, color: AppTheme.stone),
          ),
        ),
        const SizedBox(height: 16),

        // Horsepower
        Text(
          'Engine Power: $_hp HP',
          style: const TextStyle(color: AppTheme.forest, fontWeight: FontWeight.w600, fontSize: 13),
        ),
        Slider(
          value: _hp.toDouble(),
          min: 20,
          max: 90,
          divisions: 14,
          activeColor: AppTheme.forest,
          inactiveColor: AppTheme.line,
          label: '$_hp HP',
          onChanged: (v) => setState(() => _hp = v.round()),
        ),
      ],
    );
  }

  Widget _buildStep2Equipment() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Equipment & Rates\nउपकरण और दरें',
          style: TextStyle(
            color: AppTheme.forest,
            fontSize: 22,
            fontWeight: FontWeight.bold,
            height: 1.25,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Choose the implements you provide and set your rental rates',
          style: TextStyle(color: AppTheme.stone, fontSize: 13),
        ),
        const SizedBox(height: 20),

        // Equipment Checklist
        const Text(
          'Available Implements',
          style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.bold, fontSize: 14),
        ),
        const SizedBox(height: 8),
        ...equipmentCatalog.entries.map((entry) {
          final isChecked = _selectedEquipment.contains(entry.key);
          return CheckboxListTile(
            value: isChecked,
            activeColor: AppTheme.forest,
            title: Text(entry.value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
            contentPadding: EdgeInsets.zero,
            onChanged: (val) {
              setState(() {
                if (val == true) {
                  _selectedEquipment.add(entry.key);
                } else {
                  _selectedEquipment.remove(entry.key);
                }
              });
            },
          );
        }),
        const SizedBox(height: 20),

        // Pricing Rates
        const Text(
          'Rental Rates (₹)',
          style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.bold, fontSize: 14),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Per Hour (₹/hr)', style: TextStyle(fontSize: 12, color: AppTheme.stone)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _hourlyRateController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(prefixText: '₹ '),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Per Acre (₹/acre)', style: TextStyle(fontSize: 12, color: AppTheme.stone)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _acreRateController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(prefixText: '₹ '),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Per Trip (₹/trip)', style: TextStyle(fontSize: 12, color: AppTheme.stone)),
            const SizedBox(height: 6),
            TextField(
              controller: _tripRateController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(prefixText: '₹ '),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStep3LocationDocs() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Location & Verification\nस्थान और सत्यापन',
          style: TextStyle(
            color: AppTheme.forest,
            fontSize: 22,
            fontWeight: FontWeight.bold,
            height: 1.25,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Where is your tractor parked? This helps match you with farmers within your service radius.',
          style: TextStyle(color: AppTheme.stone, fontSize: 13),
        ),
        const SizedBox(height: 20),

        // Auto-Detect Location Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Tractor Base Location',
                        style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      SizedBox(height: 2),
                      Text('Auto-detect your shed or farm location', style: TextStyle(color: AppTheme.stone, fontSize: 11)),
                    ],
                  ),
                  OutlinedButton.icon(
                    onPressed: _isLocating ? null : _detectLocation,
                    icon: _isLocating
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.my_location, size: 16),
                    label: Text(_isLocating ? 'Locating...' : 'Detect'),
                  ),
                ],
              ),
              if (_detectedLocation != null) ...[
                const SizedBox(height: 10),
                Text(
                  'Detected: $_detectedLocation',
                  style: const TextStyle(color: AppTheme.forest, fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Village Field
        const Text(
          'Base Village / Town *',
          style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.w600, fontSize: 13),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _villageController,
          decoration: const InputDecoration(hintText: 'e.g. Doddabele'),
        ),
        const SizedBox(height: 16),

        // PIN Code
        const Text(
          'PIN Code',
          style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.w600, fontSize: 13),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _pincodeController,
          keyboardType: TextInputType.number,
          maxLength: 6,
          decoration: const InputDecoration(hintText: '560060', counterText: ''),
        ),
        const SizedBox(height: 16),

        // Verification Documents
        const Text(
          'Registration Certificate (RC) Upload',
          style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.w600, fontSize: 13),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.line),
          ),
          child: Row(
            children: [
              const Icon(Icons.description_outlined, color: AppTheme.forest, size: 28),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('RC Book / Smart Card Photo', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    Text('Verified by community trust', style: TextStyle(color: AppTheme.stone, fontSize: 11)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppTheme.forest.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('Attached', style: TextStyle(color: AppTheme.forest, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

