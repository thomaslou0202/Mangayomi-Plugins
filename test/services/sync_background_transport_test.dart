import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mangayomi/services/sync/sync_api_client.dart';

void main() {
  test(
    'large off-isolate JSON preserves the wire protocol and headers',
    () async {
      final rows = List.generate(
        5000,
        (i) => {'clientId': i, 'name': '第 $i 章', 'isRead': i.isEven},
      );
      final client = SyncApiClient(
        MockClient((request) async {
          expect(request.url.path, '/api/sync/v1');
          expect(request.headers['cookie'], 'id=test-token');
          expect(request.headers['connection'], 'close');
          expect(jsonDecode(request.body)['chapters'], rows);
          return http.Response(
            jsonEncode({'chapters': rows, 'syncedAt': 10}),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }),
      );
      final response = await client.postSync(
        'http://localhost:3000',
        'test-token',
        {'since': 0, 'chapters': rows},
      );
      expect(response!['chapters'], rows);
      expect(response['syncedAt'], 10);
    },
  );
}
