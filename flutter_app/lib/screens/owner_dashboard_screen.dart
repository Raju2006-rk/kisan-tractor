import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/booking.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'auth_screen.dart';

class OwnerDashboardScreen extends StatefulWidget {
  const OwnerDashboardScreen({super.key});

  @override
  State<OwnerDashboardScreen> createState() => _OwnerDashboardScreenState();
}

class _OwnerDashboardScreenState extends State<OwnerDashboardScreen> {
  bool _isOnline = true;
  List<BookingModel> _bookings = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadBookings();
  }

  Future<void> _loadBookings() async {
    setState(() => _isLoading = true);
    final bookings = await ApiService.fetchBookings();
    setState(() {
      _bookings = bookings;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final user = auth.currentUser;

    final pending = _bookings.filter((b) => b.status == 'PENDING');
    final active = _bookings.filter((b) => ['IN_PROGRESS', 'ACCEPTED'].contains(b.status));

    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        title: const Text('Owner Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppTheme.forest),
            onPressed: _loadBookings,
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: AppTheme.stone),
            onPressed: () async {
              await auth.logout();
              if (mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const AuthScreen()),
                );
              }
            },
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadBookings,
          color: AppTheme.forest,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Online / Offline Status Toggle Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _isOnline ? AppTheme.forest : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: _isOnline ? AppTheme.forest : AppTheme.line),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.04),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor: _isOnline ? AppTheme.wheat : Colors.grey.shade200,
                            child: Icon(
                              _isOnline ? Icons.power_settings_new : Icons.power_off,
                              color: _isOnline ? AppTheme.forest : Colors.grey,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _isOnline ? 'ONLINE • Accepting Jobs' : 'OFFLINE',
                                style: TextStyle(
                                  color: _isOnline ? Colors.white : AppTheme.ink,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                ),
                              ),
                              Text(
                                _isOnline
                                    ? 'Visible to nearby farmers'
                                    : 'Switch on to receive bookings',
                                style: TextStyle(
                                  color: _isOnline ? Colors.white70 : AppTheme.stone,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      Switch(
                        value: _isOnline,
                        activeColor: AppTheme.wheat,
                        activeTrackColor: AppTheme.wheat.withOpacity(0.4),
                        onChanged: (val) {
                          setState(() => _isOnline = val);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(val ? 'You are now ONLINE' : 'You are now OFFLINE'),
                              duration: const Duration(seconds: 1),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Metrics Row
                Row(
                  children: [
                    Expanded(
                      child: _MetricCard(
                        title: "Today's Earnings",
                        value: '₹3,200',
                        subtitle: 'Direct cash & UPI',
                        icon: Icons.currency_rupee,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MetricCard(
                        title: 'Completed Jobs',
                        value: '4',
                        subtitle: 'Zero commission',
                        icon: Icons.verified_rounded,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Booking Requests Section
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Farmer Requests (${pending.length})',
                      style: const TextStyle(
                        color: AppTheme.forest,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    TextButton(
                      onPressed: _loadBookings,
                      child: const Text('Refresh', style: TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                if (_isLoading)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24.0),
                      child: CircularProgressIndicator(color: AppTheme.forest),
                    ),
                  )
                else if (pending.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.line),
                    ),
                    child: const Column(
                      children: [
                        Icon(Icons.inbox_outlined, size: 36, color: AppTheme.stone),
                        SizedBox(height: 8),
                        Text(
                          'No pending requests right now',
                          style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.forest),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'New booking requests from farmers will appear here.',
                          style: TextStyle(fontSize: 11, color: AppTheme.stone),
                        ),
                      ],
                    ),
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: pending.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final b = pending[index];
                      return Container(
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
                                Text(
                                  '${b.serviceType.toUpperCase()} · ${b.farmerName}',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                ),
                                Text(
                                  '₹${b.estimatedAmount}',
                                  style: const TextStyle(
                                    color: AppTheme.forest,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${b.bookingDate} at ${b.startTime} · ${b.village}',
                              style: const TextStyle(color: AppTheme.stone, fontSize: 12),
                            ),
                            const SizedBox(height: 14),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Request declined')),
                                      );
                                    },
                                    child: const Text('Decline'),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: ElevatedButton(
                                    onPressed: () {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Request Accepted!')),
                                      );
                                    },
                                    child: const Text('Accept Job'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

extension FilterExtension<T> on List<T> {
  List<T> filter(bool Function(T) test) {
    return where(test).toList();
  }
}

class _MetricCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;

  const _MetricCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppTheme.forest, size: 20),
          const SizedBox(height: 10),
          Text(
            value,
            style: const TextStyle(
              color: AppTheme.forest,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: const TextStyle(color: AppTheme.stone, fontSize: 11, fontWeight: FontWeight.w500),
          ),
          Text(
            subtitle,
            style: TextStyle(color: AppTheme.stone.withOpacity(0.7), fontSize: 10),
          ),
        ],
      ),
    );
  }
}

