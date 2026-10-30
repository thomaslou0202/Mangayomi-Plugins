import 'package:mangayomi/services/database_worker.dart';

import 'dart:math';

import 'package:isar_community/isar.dart';
import 'package:mangayomi/main.dart';
import 'package:mangayomi/models/category.dart';
import 'package:mangayomi/models/chapter.dart';
import 'package:mangayomi/models/history.dart';
import 'package:mangayomi/models/manga.dart';
import 'package:mangayomi/models/track.dart';
import 'package:mangayomi/models/update.dart';
import 'package:mangayomi/repositories/db_write_queue.dart';

/// Generates a `clientId`: a value made once when a synced row is created,
/// then only ever compared, never regenerated for that row again (see
/// docs/sync_api.md in the sync server repo for the wire contract this
/// backs).
///
/// Kept within 2^52 so two devices that create rows on their own, before
/// ever syncing with each other, almost never collide by accident, while
/// staying well under Dart/JS's safe integer range (2^53 - 1) so the value
/// survives a JSON round trip through the server without precision loss.
final _random = Random.secure();

const _maxClientId = 0xFFFFFFFFFFFFF; // 2^52 - 1

int generateClientId() {
  // Random.secure() only hands out 32 bits at a time, so two calls are
  // combined to fill the wider range instead of wasting the extra headroom.
  final high = _random.nextInt(1 << 32);
  final low = _random.nextInt(1 << 32);
  final combined = (high << 32) | low;
  // & keeps this positive and within _maxClientId regardless of how the
  // bits landed above.
  final value = combined & _maxClientId;
  // 0 is reserved as "not yet assigned" throughout the sync code, so never hand it out.
  return value == 0 ? 1 : value;
}

/// Assigns a `clientId` to every synced row that doesn't have one yet: both
/// pre-existing rows from before this field existed, and any created during
/// the current session. Cheap to call often - `clientId` is indexed, so once
/// caught up this is just six empty indexed lookups.
///
/// Called once at app startup (covers old data promptly), and again right
/// before a sync's upload is built (covers a row made earlier in the same
/// session, which startup's sweep couldn't have seen yet).
///
/// The startup and sync sweeps both run on the database worker. Native
/// transactions are bounded to avoid stalling reader writes in other isolates.
Future<void> backfillMissingClientIds() =>
    DatabaseWorker.instance.run<void>('backfill');

/// Re-read inside each transaction so a user's concurrent edit is never
/// replaced by an old snapshot gathered before the transaction started.
Future<void> backfillClientIdsInWorker() async {
  Future<void> fill<T>(
    IsarCollection<T> collection,
    List<T> missing,
    int? Function(T) idOf,
    int? Function(T) clientIdOf,
    void Function(T, int) assign,
  ) async {
    for (var start = 0; start < missing.length; start += 100) {
      await dbWriteQueue.run(
        () => isar.writeTxnSync(() {
          for (final snapshot in missing.skip(start).take(100)) {
            final id = idOf(snapshot);
            if (id == null) continue;
            final current = collection.getSync(id);
            if (current == null || clientIdOf(current) != null) continue;
            assign(current, generateClientId());
            collection.putSync(current);
          }
        }),
      );
      await Future<void>.delayed(Duration.zero);
    }
  }

  await fill(
    isar.categorys,
    isar.categorys.where().clientIdIsNull().findAllSync(),
    (r) => r.id,
    (r) => r.clientId,
    (r, id) => r
      ..clientId = id
      ..updatedAt = DateTime.now().millisecondsSinceEpoch,
  );
  await fill(
    isar.mangas,
    isar.mangas.where().clientIdIsNull().findAllSync(),
    (r) => r.id,
    (r) => r.clientId,
    (r, id) => r
      ..clientId = id
      ..updatedAt = DateTime.now().millisecondsSinceEpoch,
  );
  await fill(
    isar.chapters,
    isar.chapters.where().clientIdIsNull().findAllSync(),
    (r) => r.id,
    (r) => r.clientId,
    (r, id) => r
      ..clientId = id
      ..updatedAt = DateTime.now().millisecondsSinceEpoch,
  );
  await fill(
    isar.tracks,
    isar.tracks.where().clientIdIsNull().findAllSync(),
    (r) => r.id,
    (r) => r.clientId,
    (r, id) => r
      ..clientId = id
      ..updatedAt = DateTime.now().millisecondsSinceEpoch,
  );
  await fill(
    isar.historys,
    isar.historys.where().clientIdIsNull().findAllSync(),
    (r) => r.id,
    (r) => r.clientId,
    (r, id) => r
      ..clientId = id
      ..updatedAt = DateTime.now().millisecondsSinceEpoch,
  );
  await fill(
    isar.updates,
    isar.updates.where().clientIdIsNull().findAllSync(),
    (r) => r.id,
    (r) => r.clientId,
    (r, id) => r
      ..clientId = id
      ..updatedAt = DateTime.now().millisecondsSinceEpoch,
  );
}
