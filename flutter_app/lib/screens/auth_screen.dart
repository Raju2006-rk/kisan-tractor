import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/locale_provider.dart';
import '../theme/app_theme.dart';
import 'farmer_registration_screen.dart';
import 'tractor_registration_screen.dart';
import 'farmer_dashboard_screen.dart';
import 'owner_dashboard_screen.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _mobileController = TextEditingController();
  final _nameController = TextEditingController();
  final _otpController = TextEditingController();
  String _selectedRole = 'farmer'; // 'farmer' or 'owner'

  @override
  void dispose() {
    _mobileController.dispose();
    _nameController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  void _routeNext(AuthProvider auth) {
    if (auth.status == AuthStatus.authenticated) {
      if (auth.activeRole == 'farmer') {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const FarmerDashboardScreen()),
        );
      } else {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const OwnerDashboardScreen()),
        );
      }
    } else if (auth.status == AuthStatus.needFarmerRegistration) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const FarmerRegistrationScreen()),
      );
    } else if (auth.status == AuthStatus.needTractorRegistration) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const TractorRegistrationScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final locale = Provider.of<LocaleProvider>(context);

    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        title: const Text('Kisan Tractor'),
        actions: [
          TextButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.language, size: 16, color: AppTheme.forest),
            label: Text(
              locale.currentLanguage.toUpperCase(),
              style: const TextStyle(color: AppTheme.forest, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 10),
              // Header
              Text(
                auth.status == AuthStatus.otpSent
                    ? 'Verify Mobile\nOTP दर्ज करें'
                    : 'Sign In / Register\nसाइन इन या रजिस्टर करें',
                style: const TextStyle(
                  color: AppTheme.forest,
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                auth.status == AuthStatus.otpSent
                    ? 'Enter the 6-digit code sent to +91 ${_mobileController.text}'
                    : 'Connect directly with local farmers and tractor owners',
                style: const TextStyle(color: AppTheme.stone, fontSize: 13),
              ),
              const SizedBox(height: 24),

              if (auth.errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.red, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          auth.errorMessage!,
                          style: TextStyle(color: Colors.red.shade800, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              if (auth.status != AuthStatus.otpSent) ...[
                // Role Selector
                const Text(
                  'Select Your Role',
                  style: TextStyle(
                    color: AppTheme.forest,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _RoleCard(
                        title: 'Farmer\nकिसान',
                        subtitle: 'Rent tractors nearby',
                        icon: Icons.agriculture_rounded,
                        isSelected: _selectedRole == 'farmer',
                        onTap: () {
                          setState(() => _selectedRole = 'farmer');
                          auth.setRole('farmer');
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _RoleCard(
                        title: 'Tractor Owner\nट्रैक्टर मालिक',
                        subtitle: 'Rent out your tractor',
                        icon: Icons.handshake_rounded,
                        isSelected: _selectedRole == 'owner',
                        onTap: () {
                          setState(() => _selectedRole = 'owner');
                          auth.setRole('owner');
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Mobile Number Field
                const Text(
                  'Mobile Number',
                  style: TextStyle(
                    color: AppTheme.forest,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _mobileController,
                  keyboardType: TextInputType.phone,
                  maxLength: 10,
                  decoration: const InputDecoration(
                    prefixText: '+91  ',
                    prefixStyle: TextStyle(
                      color: AppTheme.ink,
                      fontWeight: FontWeight.w600,
                    ),
                    hintText: '98765 43210',
                    counterText: '',
                  ),
                ),
                const SizedBox(height: 16),

                // Name field only for Tractor Owner (Farmer fills it on registration screen after OTP)
                if (_selectedRole == 'owner') ...[
                  const Text(
                    'Full Name',
                    style: TextStyle(
                      color: AppTheme.forest,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _nameController,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      hintText: 'Enter your full name',
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // Continue Button
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: auth.isLoading
                        ? null
                        : () async {
                            final mobile = _mobileController.text.trim();
                            if (mobile.length != 10) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Please enter a valid 10-digit mobile number'),
                                ),
                              );
                              return;
                            }
                            final success = await auth.requestOtp(
                              mobile: mobile,
                              name: _nameController.text.trim().isNotEmpty
                                  ? _nameController.text.trim()
                                  : null,
                              role: _selectedRole,
                              language: locale.currentLanguage,
                            );
                            if (success && mounted) {
                              _routeNext(auth);
                            }
                          },
                    child: auth.isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Continue • आगे बढ़ें'),
                  ),
                ),
              ] else ...[
                // OTP Field
                const Text(
                  '6-Digit OTP',
                  style: TextStyle(
                    color: AppTheme.forest,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _otpController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 22,
                    letterSpacing: 8,
                    fontWeight: FontWeight.bold,
                  ),
                  decoration: const InputDecoration(
                    hintText: '••••••',
                    counterText: '',
                  ),
                ),
                const SizedBox(height: 12),

                // Test OTP Autofill if available
                if (auth.devOtp != null) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppTheme.wheatOpacity40,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.wheat),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Test OTP: ${auth.devOtp}',
                          style: const TextStyle(
                            color: Color(0xFF7A5A1D),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            _otpController.text = auth.devOtp!;
                          },
                          child: const Text('Auto-fill'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // Verify Button
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: auth.isLoading
                        ? null
                        : () async {
                            final otp = _otpController.text.trim();
                            if (otp.length != 6) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Please enter the 6-digit OTP'),
                                ),
                              );
                              return;
                            }
                            final success = await auth.verifyOtp(
                              otp,
                              language: locale.currentLanguage,
                            );
                            if (success && mounted) {
                              _routeNext(auth);
                            }
                          },
                    child: auth.isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Verify & Proceed • सत्यापित करें'),
                  ),
                ),
                const SizedBox(height: 12),
                Center(
                  child: TextButton(
                    onPressed: () {
                      _otpController.clear();
                      auth.requestOtp(
                        mobile: _mobileController.text.trim(),
                        name: _nameController.text.trim(),
                        role: _selectedRole,
                      );
                    },
                    child: const Text(
                      'Resend OTP',
                      style: TextStyle(color: AppTheme.forest, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _RoleCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.forest : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppTheme.forest : AppTheme.line,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              icon,
              color: isSelected ? AppTheme.wheat : AppTheme.forest,
              size: 28,
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                color: isSelected ? Colors.white : AppTheme.forest,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                color: isSelected ? Colors.white70 : AppTheme.stone,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

