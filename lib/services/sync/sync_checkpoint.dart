import 'dart:math';

/// A server watermark must not hide local edits made during the request. A
/// download-only run uploads nothing, so retains the previous upload boundary.
int nextSyncCheckpoint({
  required int serverTime,
  required int snapshotTime,
  required int previousCheckpoint,
  required bool uploadedChanges,
}) => min(serverTime, uploadedChanges ? snapshotTime : previousCheckpoint);
