import 'package:flutter/material.dart';
import 'package:mangayomi/providers/l10n_providers.dart';
import 'package:mangayomi/utils/memory_probe.dart';
import 'package:mangayomi/utils/platform_utils.dart';

/// A live readout of what the app is holding, for measuring on the device
/// rather than guessing from a desktop.
///
/// Deliberately plain and legible from a sofa: the numbers are meant to be
/// read off a television while somebody scrolls the library or reads a
/// chapter, which is the only way to answer whether the image cache budget is
/// the constraint on a box with little RAM.
class MemoryOverlay extends StatelessWidget {
  const MemoryOverlay({super.key, required this.probe, this.onClose});

  final MemoryProbe probe;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    // The buttons are only offered where they can be pressed. A television
    // has no pointer, and this sits in a Stack above the whole app rather than
    // inside its focus traversal, so a d-pad can never reach them: they would
    // be two controls that look live and are not. The settings toggle already
    // resets the run when it is switched on, and that is reachable.
    final interactive = onClose != null && !isTv;

    return Positioned(
      top: MediaQuery.paddingOf(context).top + 8,
      right: 8,
      child: IgnorePointer(
        ignoring: !interactive,
        child: Material(
          color: Colors.black.withValues(alpha: 0.78),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: ListenableBuilder(
              listenable: probe,
              builder: (context, _) => _body(context, probe.stats),
            ),
          ),
        ),
      ),
    );
  }

  Widget _body(BuildContext context, MemoryStats stats) {
    final latest = stats.latest;
    const style = TextStyle(
      color: Colors.white,
      fontSize: 13,
      fontFamily: 'monospace',
      height: 1.4,
    );

    if (latest == null) {
      return Text(context.l10n.memory_waiting_sample, style: style);
    }

    // Amber once the cache is spending its time full, which is the reading
    // that says the budget is the thing to change.
    final pressure = stats.ceilingShare;
    final pressureColour = pressure >= 0.5
        ? Colors.amber
        : (pressure > 0 ? Colors.white : Colors.white70);

    final interactive = onClose != null && !isTv;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          context.l10n.memory_rss(
            formatBytes(latest.rssBytes),
            formatBytes(stats.peakRssBytes),
          ),
          style: style,
        ),
        Text(
          context.l10n.memory_image_cache(
            formatBytes(latest.imageCacheBytes),
            formatBytes(latest.imageCacheMaxBytes),
            formatBytes(stats.peakCacheBytes),
          ),
          style: style,
        ),
        Text(
          context.l10n.memory_cached_items(
            latest.imageCacheCount,
            latest.imageCacheMaxCount,
            latest.liveImages,
            stats.peakCacheCount,
          ),
          style: style,
        ),
        Text(
          context.l10n.memory_cache_pressure(
            (pressure * 100).toStringAsFixed(0),
            stats.samples,
          ),
          style: style.copyWith(color: pressureColour),
        ),
        if (isTv)
          Text(
            context.l10n.memory_reset_hint,
            style: style.copyWith(color: Colors.white54, fontSize: 11),
          ),
        if (interactive)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextButton(
                onPressed: probe.reset,
                child: Text(
                  context.l10n.reset,
                  style: const TextStyle(fontSize: 12),
                ),
              ),
              TextButton(
                onPressed: onClose,
                child: Text(
                  context.l10n.hide_action,
                  style: const TextStyle(fontSize: 12),
                ),
              ),
            ],
          ),
      ],
    );
  }
}
