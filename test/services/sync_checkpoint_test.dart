import 'package:flutter_test/flutter_test.dart';
import 'package:mangayomi/services/sync/sync_checkpoint.dart';

void main() {
  test('edits made during upload remain after the next checkpoint', () {
    final checkpoint = nextSyncCheckpoint(
      serverTime: 300,
      snapshotTime: 200,
      previousCheckpoint: 100,
      uploadedChanges: true,
    );
    expect(checkpoint, 200);
    expect(250 >= checkpoint, isTrue); // a reading event during the request
  });
  test('download-only does not acknowledge unsent local changes', () {
    expect(
      nextSyncCheckpoint(
        serverTime: 300,
        snapshotTime: 200,
        previousCheckpoint: 100,
        uploadedChanges: false,
      ),
      100,
    );
  });
  test('a server clock behind this device is still a safe watermark', () {
    expect(
      nextSyncCheckpoint(
        serverTime: 150,
        snapshotTime: 200,
        previousCheckpoint: 100,
        uploadedChanges: true,
      ),
      150,
    );
  });
}
