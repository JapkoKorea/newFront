import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../data/courses_api.dart';
import '../domain/tour_course.dart';

class ToursPage extends StatefulWidget {
  const ToursPage({super.key});

  @override
  State<ToursPage> createState() => _ToursPageState();
}

class _ToursPageState extends State<ToursPage> {
  final CoursesApi _coursesApi = CoursesApi();
  final TextEditingController _searchController = TextEditingController();

  String _filter = 'all';
  String _query = '';
  final Set<String> _favorites = <String>{};
  List<TourCourse> _courses = <TourCourse>[];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final List<TourCourse> courses = await _coursesApi.fetchCourses();
      if (!mounted) {
        return;
      }
      setState(() {
        _courses = courses;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = '코스를 불러오지 못했습니다. 다시 시도해 주세요.';
      });
    }
  }

  List<TourCourse> get _filtered {
    final String q = _query.trim().toLowerCase();
    return _courses.where((TourCourse c) {
      final bool seasonOk = _filter == 'all' || c.season.contains(_filter);
      if (!seasonOk) {
        return false;
      }
      if (q.isEmpty) {
        return true;
      }
      final bool inName = c.name.toLowerCase().contains(q);
      final bool inSpots =
          c.spots.any((String s) => s.toLowerCase().contains(q));
      final bool inRoute = c.departure.toLowerCase().contains(q) ||
          c.destination.toLowerCase().contains(q);
      return inName || inSpots || inRoute;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('비에이·후라노 택시투어'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(_error!, style: const TextStyle(color: Color(0xFF64748B))),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh),
              label: const Text('다시 시도'),
            ),
          ],
        ),
      );
    }

    final List<TourCourse> items = _filtered;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: <Widget>[
          _SearchField(
            controller: _searchController,
            onChanged: (String v) => setState(() => _query = v),
          ),
          const SizedBox(height: 12),
          _SeasonFilters(
            value: _filter,
            onChanged: (String v) => setState(() => _filter = v),
          ),
          const SizedBox(height: 16),
          Text(
            _query.isEmpty ? '추천 코스' : '검색 결과 ${items.length}',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 40),
              child: Center(
                child: Text(
                  '조건에 맞는 코스가 없습니다.',
                  style: TextStyle(color: Color(0xFF94A3B8)),
                ),
              ),
            ),
          ...items.map(
            (TourCourse course) => Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: _CourseCard(
                course: course,
                favorited: _favorites.contains(course.id),
                onTap: () => context.push('/tours/${course.id}'),
                onToggleFavorite: () => setState(() {
                  if (!_favorites.add(course.id)) {
                    _favorites.remove(course.id);
                  }
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      decoration: InputDecoration(
        hintText: '어디로 가세요? 코스·관광지 검색',
        prefixIcon: const Icon(Icons.search),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(vertical: 0),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
      ),
    );
  }
}

class _SeasonFilters extends StatelessWidget {
  const _SeasonFilters({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    const List<List<String>> options = <List<String>>[
      <String>['all', '전체'],
      <String>['winter', '겨울'],
      <String>['summer', '여름'],
      <String>['all_season', '사계절'],
    ];
    return Wrap(
      spacing: 8,
      children: options.map((List<String> o) {
        return ChoiceChip(
          label: Text(o[1]),
          selected: value == o[0],
          onSelected: (_) => onChanged(o[0]),
        );
      }).toList(),
    );
  }
}

class _CourseCard extends StatelessWidget {
  const _CourseCard({
    required this.course,
    required this.favorited,
    required this.onTap,
    required this.onToggleFavorite,
  });

  final TourCourse course;
  final bool favorited;
  final VoidCallback onTap;
  final VoidCallback onToggleFavorite;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            _CourseBanner(
              course: course,
              favorited: favorited,
              onToggleFavorite: onToggleFavorite,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    course.name,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (course.ratingCount > 0) ...<Widget>[
                    Row(
                      children: <Widget>[
                        const Icon(Icons.star,
                            size: 15, color: Color(0xFFF59E0B)),
                        const SizedBox(width: 3),
                        Text(
                          '${course.ratingAvg.toStringAsFixed(1)} (${course.ratingCount})',
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                  ],
                  Row(
                    children: <Widget>[
                      const Icon(Icons.route,
                          size: 15, color: Color(0xFF94A3B8)),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          '${course.departure.isEmpty ? '-' : course.departure}  →  ${course.destination.isEmpty ? '-' : course.destination}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 13, color: Color(0xFF64748B)),
                        ),
                      ),
                    ],
                  ),
                  if (course.spots.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: <Widget>[
                        ...course.spots.take(3).map(
                              (String s) => _SpotPill(label: s),
                            ),
                        if (course.spots.length > 3)
                          _SpotPill(label: '+${course.spots.length - 3}'),
                      ],
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: <Widget>[
                      const Icon(Icons.schedule,
                          size: 15, color: Color(0xFF64748B)),
                      const SizedBox(width: 4),
                      Text(
                        course.duration,
                        style: const TextStyle(
                            fontSize: 13, color: Color(0xFF64748B)),
                      ),
                      const Spacer(),
                      if (course.depositKrw != null) ...<Widget>[
                        const Text(
                          '예약금 ',
                          style: TextStyle(
                              fontSize: 12, color: Color(0xFF94A3B8)),
                        ),
                        Text(
                          '${_formatWon(course.depositKrw!)}원',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _formatWon(int value) {
    final String s = value.toString();
    final StringBuffer buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) {
        buf.write(',');
      }
      buf.write(s[i]);
    }
    return buf.toString();
  }
}

class _CourseBanner extends StatelessWidget {
  const _CourseBanner({
    required this.course,
    required this.favorited,
    required this.onToggleFavorite,
  });

  final TourCourse course;
  final bool favorited;
  final VoidCallback onToggleFavorite;

  @override
  Widget build(BuildContext context) {
    final String season = course.season.isEmpty ? 'all_season' : course.season.first;
    final List<Color> gradient = switch (season) {
      'winter' => const <Color>[Color(0xFF60A5FA), Color(0xFF2563EB)],
      'summer' => const <Color>[Color(0xFFFB923C), Color(0xFFF472B6)],
      _ => const <Color>[Color(0xFFF59E0B), Color(0xFFD97706)],
    };

    return Container(
      height: 112,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradient,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        children: <Widget>[
          Positioned(
            left: 12,
            top: 12,
            child: Row(
              children: <Widget>[
                _Tag(text: seasonLabel[season] ?? season),
                if (course.badge != null) ...<Widget>[
                  const SizedBox(width: 6),
                  _Tag(text: course.badge!, highlight: true),
                ],
              ],
            ),
          ),
          Positioned(
            right: 6,
            top: 4,
            child: IconButton(
              onPressed: onToggleFavorite,
              icon: Icon(
                favorited ? Icons.favorite : Icons.favorite_border,
                color: Colors.white,
              ),
            ),
          ),
          Positioned(
            left: 14,
            right: 14,
            bottom: 12,
            child: Text(
              course.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w800,
                shadows: <Shadow>[
                  Shadow(color: Color(0x55000000), blurRadius: 6),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.text, this.highlight = false});

  final String text;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: highlight ? const Color(0xFF0F172A) : Colors.white,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: highlight ? Colors.white : const Color(0xFF334155),
        ),
      ),
    );
  }
}

class _SpotPill extends StatelessWidget {
  const _SpotPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
      ),
    );
  }
}
