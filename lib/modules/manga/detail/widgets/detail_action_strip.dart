import 'package:flutter/material.dart';

class DetailAction {
  const DetailAction({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
}

/// Equal-sized detail actions. Additional anime actions wrap on narrow phones.
class DetailActionStrip extends StatelessWidget {
  const DetailActionStrip({super.key, required this.actions});

  final List<DetailAction> actions;

  @override
  Widget build(BuildContext context) {
    if (actions.isEmpty) return const SizedBox.shrink();
    final accent = Theme.of(context).primaryColor;
    final outline = accent.withValues(alpha: 0.35);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final columns = (constraints.maxWidth / 96).floor().clamp(
            1,
            actions.length,
          );
          final rows = (actions.length / columns).ceil();
          return Container(
            decoration: BoxDecoration(
              border: Border.all(color: outline),
              borderRadius: BorderRadius.circular(16),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var row = 0; row < rows; row++) ...[
                  if (row > 0) Divider(height: 1, thickness: 1, color: outline),
                  IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (
                          var i = row * columns;
                          i < (row + 1) * columns && i < actions.length;
                          i++
                        ) ...[
                          if (i > row * columns)
                            VerticalDivider(
                              width: 1,
                              thickness: 1,
                              color: outline,
                            ),
                          Expanded(
                            child: _segment(context, actions[i], accent),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _segment(BuildContext context, DetailAction action, Color accent) {
    final color = action.onPressed == null
        ? Theme.of(context).disabledColor
        : accent;
    return Semantics(
      button: true,
      enabled: action.onPressed != null,
      child: InkWell(
        onTap: action.onPressed,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(action.icon, size: 20, color: color),
              const SizedBox(height: 5),
              Text(
                action.label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
