import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain/tour_course.dart';

class ToursPage extends StatefulWidget {
  const ToursPage({super.key});

  @override
  State<ToursPage> createState() => _ToursPageState();
}

class _ToursPageState extends State<ToursPage> {
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final List<TourCourse> filtered = _filter == 'all'
        ? tourCourses
        : tourCourses
            .where((TourCourse c) => c.season.contains(_filter))
            .toList();

    return Scaffold(
      appBar: AppBar(title: const Text('비에이·후라노 택시투어 코스')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          const Text(
            '시즌별 코스를 먼저 선택하고, 이후 출발/도착/관광지를 확정하세요.',
            style: TextStyle(color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: <Widget>[
              _FilterChip(
                label: '전체',
                selected: _filter == 'all',
                onTap: () => setState(() => _filter = 'all'),
              ),
              _FilterChip(
                label: '❄️ 겨울',
                selected: _filter == 'winter',
                onTap: () => setState(() => _filter = 'winter'),
              ),
              _FilterChip(
                label: '🌸 여름',
                selected: _filter == 'summer',
                onTap: () => setState(() => _filter = 'summer'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...filtered.map((TourCourse course) {
            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => context.push('/tours/${course.id}'),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: <Widget>[
                          ...course.season.map((String s) => Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEFF6FF),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  seasonLabel[s] ?? s,
                                  style: const TextStyle(fontSize: 12),
                                ),
                              )),
                          if (course.badge != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFF7ED),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                course.badge!,
                                style: const TextStyle(fontSize: 12),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        course.name,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        course.description,
                        style: const TextStyle(color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 8),
                      Text('소요시간: ${course.duration}'),
                      Text(
                          '출발: ${course.departure.isEmpty ? '-' : course.departure}'),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: course.spots.take(3).map((String spot) {
                          return Chip(
                            label: Text(spot,
                                style: const TextStyle(fontSize: 12)),
                            materialTapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                          );
                        }).toList(),
                      ),
                      if (course.spots.length > 3)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            '+${course.spots.length - 3}곳 더 보기',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF94A3B8),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
    );
  }
}
