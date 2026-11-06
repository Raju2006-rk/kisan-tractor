import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/location_service.dart';
import '../theme/app_theme.dart';
import 'farmer_dashboard_screen.dart';

class FarmerRegistrationScreen extends StatefulWidget {
  const FarmerRegistrationScreen({super.key});

  @override
  State<FarmerRegistrationScreen> createState() => _FarmerRegistrationScreenState();
}

class _FarmerRegistrationScreenState extends State<FarmerRegistrationScreen> {
  final _nameController = TextEditingController();
  final _villageController = TextEditingController();
  final _pincodeController = TextEditingController();
  final _addressController = TextEditingController();
  final _districtController = TextEditingController();
  final _stateController = TextEditingController();

  double? _lat;
  double? _lng;
  bool _isLocating = false;
  String? _detectedSummary;

  @override
  void dispose() {
    _nameController.dispose();
    _villageController.dispose();
    _pincodeController.dispose();
    _addressController.dispose();
    _districtController.dispose();
    _stateController.dispose();
    super.dispose();
  }

  Future<void> _handleAutoDetect() async {
    setState(() => _isLocating = true);
    final loc = await LocationService.getCurrentLocation();
    setState(() => _isLocating = false);

    if (loc != null) {
      setState(() {
        _lat = loc.lat;
        _lng = loc.lng;
        if (loc.village.isNotEmpty) _villageController.text = loc.village;
        if (loc.pincode.isNotEmpty) _pincodeController.text = loc.pincode;
        if (loc.district.isNotEmpty) _districtController.text = loc.district;
        if (loc.state.isNotEmpty) _stateController.text = loc.state;
        if (loc.address.isNotEmpty) _addressController.text = loc.address;
        _detectedSummary = loc.summary;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Location detected: ${_detectedSummary ?? "GPS captured"}'),
            backgroundColor: AppTheme.forest,
          ),
        );
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not access GPS. Please enter your village manually.'),
            backgroundColor: Colors.orange,
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
        title: const Text('Farmer Registration'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.forest.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Text(
                  'FIRST-TIME SETUP',
                  style: TextStyle(
                    color: AppTheme.forest,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Complete Your Profile\nप्रोफाइल पूरा करें',
                style: TextStyle(
                  color: AppTheme.forest,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Add your name and location so nearby tractor owners can find and accept your booking requests.',
                style: TextStyle(color: AppTheme.stone, fontSize: 13),
              ),
              const SizedBox(height: 24),

              // Name Field
              const Text(
                'Full Name *',
                style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _nameController,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  hintText: 'e.g. Ramesh Kumar',
                  prefixIcon: Icon(Icons.person_outline, color: AppTheme.stone),
                ),
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
                              'Auto-Detect Location',
                              style: TextStyle(
                                color: AppTheme.forest,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Use GPS to fill village & PIN code',
                              style: TextStyle(color: AppTheme.stone, fontSize: 11),
                            ),
                          ],
                        ),
                        OutlinedButton.icon(
                          onPressed: _isLocating ? null : _handleAutoDetect,
                          icon: _isLocating
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.my_location, size: 16),
                          label: Text(_isLocating ? 'Locating...' : 'Detect'),
                        ),
                      ],
                    ),
                    if (_detectedSummary != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppTheme.forest.withOpacity(0.06),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle, size: 16, color: AppTheme.forest),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Detected: $_detectedSummary',
                                style: const TextStyle(
                                  color: AppTheme.forest,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Village and PIN Code Row
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Village / Town *',
                          style: TextStyle(
                            color: AppTheme.forest,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _villageController,
                          decoration: const InputDecoration(hintText: 'e.g. Doddabele'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'PIN Code',
                          style: TextStyle(
                            color: AppTheme.forest,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _pincodeController,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          decoration: const InputDecoration(
                            hintText: '560060',
                            counterText: '',
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Detailed Farm Address
              const Text(
                'Farm Address / Landmark',
                style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _addressController,
                decoration: const InputDecoration(
                  hintText: 'e.g. Near Lake Road, Survey No 42',
                ),
              ),
              const SizedBox(height: 16),

              // District and State
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'District',
                          style: TextStyle(
                            color: AppTheme.forest,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _districtController,
                          decoration: const InputDecoration(hintText: 'e.g. Bangalore Rural'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'State',
                          style: TextStyle(
                            color: AppTheme.forest,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _stateController,
                          decoration: const InputDecoration(hintText: 'e.g. Karnataka'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),

              // Save & Login Button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: auth.isLoading
                      ? null
                      : () async {
                          final name = _nameController.text.trim();
                          final village = _villageController.text.trim();
                          if (name.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Please enter your full name')),
                            );
                            return;
                          }
                          if (village.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Please enter your village or town')),
                            );
                            return;
                          }

                          final success = await auth.completeFarmerRegistration(
                            name: name,
                            village: village,
                            address: _addressController.text.trim().isNotEmpty
                                ? _addressController.text.trim()
                                : village,
                            pincode: _pincodeController.text.trim(),
                            district: _districtController.text.trim(),
                            state: _stateController.text.trim(),
                            lat: _lat,
                            lng: _lng,
                          );

                          if (success && mounted) {
                            Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(builder: (_) => const FarmerDashboardScreen()),
                            );
                          }
                        },
                  child: auth.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('Save & Login • सुरक्षित करें और लॉगिन करें'),
                            SizedBox(width: 8),
                            Icon(Icons.arrow_forward_rounded, size: 20),
                          ],
                        ),
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

