"""Unit tests for optimization.ai_monitor — mocks MongoDB."""
import pytest
from unittest.mock import patch, MagicMock


def _make_mock_collection():
    col = MagicMock()
    col.insert_one.return_value = MagicMock(inserted_id="m123")
    col.count_documents.return_value = 0
    col.delete_many.return_value = MagicMock(deleted_count=10)

    class _FakeCursor:
        def __init__(self, data):
            self._data = data
        def sort(self, *a, **kw):
            return self
        def limit(self, *a, **kw):
            return self
        def __iter__(self):
            return iter(self._data)
        def __len__(self):
            return len(self._data)

    col.find.return_value = _FakeCursor([])
    col._FakeCursor = _FakeCursor
    return col


@pytest.fixture()
def monitor_env(mock_rag_service):
    mock_col = _make_mock_collection()

    with patch("optimization.ai_monitor.RAGService") as MockRAG, \
         patch("optimization.ai_monitor._get_collection", return_value=mock_col):
        MockRAG.get_instance.return_value = mock_rag_service
        from optimization.ai_monitor import AIPerformanceMonitor
        mon = AIPerformanceMonitor()
        yield mon, mock_col


class TestAIPerformanceMonitor:
    def test_record_request(self, monitor_env):
        mon, col = monitor_env
        mon.record_request("/chat", 0.15, True)
        col.insert_one.assert_called_once()
        doc = col.insert_one.call_args[0][0]
        assert doc["endpoint"] == "/chat"
        assert doc["latency"] == 0.15
        assert doc["success"] is True

    def test_record_request_error(self, monitor_env):
        mon, col = monitor_env
        mon.record_request("/evaluate", 5.0, False, {"error": "Timeout"})
        doc = col.insert_one.call_args[0][0]
        assert doc["success"] is False
        assert doc["metadata"]["error"] == "Timeout"

    def test_get_endpoint_stats_empty(self, monitor_env):
        mon, col = monitor_env
        r = mon.get_endpoint_stats("/chat", minutes=60)
        assert r["total_requests"] == 0

    def test_get_endpoint_stats_with_data(self, monitor_env):
        mon, col = monitor_env
        FakeCursor = col._FakeCursor
        col.find.return_value = FakeCursor([
            {"endpoint": "/chat", "latency": 0.1, "success": True, "timestamp": "2026-01-01T00:00:00"},
            {"endpoint": "/chat", "latency": 0.2, "success": True, "timestamp": "2026-01-01T00:00:00"},
            {"endpoint": "/chat", "latency": 0.3, "success": False, "timestamp": "2026-01-01T00:00:00"},
        ])
        r = mon.get_endpoint_stats("/chat", minutes=60)
        assert r["total_requests"] == 3
        assert r["successes"] == 2
        assert r["failures"] == 1

    def test_get_error_log(self, monitor_env):
        mon, col = monitor_env
        FakeCursor = col._FakeCursor
        col.find.return_value = FakeCursor([
            {"endpoint": "/chat", "latency": 5.0, "metadata": {}, "timestamp": "2026-01-01T00:00:00"},
        ])
        r = mon.get_error_log(last_n=5)
        assert len(r) == 1

    def test_get_system_health(self, monitor_env):
        mon, col = monitor_env
        r = mon.get_system_health()
        assert "overall" in r
        assert r["overall"] == "healthy"
        assert "components" in r

    def test_get_throughput(self, monitor_env):
        mon, col = monitor_env
        r = mon.get_throughput(minutes=60)
        assert r["total_requests"] == 0
        assert r["requests_per_minute"] == 0.0

    def test_purge_old_metrics(self, monitor_env):
        mon, col = monitor_env
        r = mon.purge_old_metrics(days=60)
        assert r == 10

    def test_record_request_db_failure(self, monitor_env):
        mon, col = monitor_env
        col.insert_one.side_effect = Exception("DB Down")
        # Should handle exception and return None
        res = mon.record_request("/chat", 0.5, True)
        assert res is None

    def test_get_endpoint_stats_db_failure(self, monitor_env):
        mon, col = monitor_env
        col.find.side_effect = Exception("Query Failed")
        # Should handle exception and return empty stats
        r = mon.get_endpoint_stats("/chat")
        assert r["total_requests"] == 0

    def test_get_endpoint_stats_p95_edge(self, monitor_env):
        mon, col = monitor_env
        FakeCursor = col._FakeCursor
        # Only 1 request
        col.find.return_value = FakeCursor([
            {"endpoint": "/chat", "latency": 1.0, "success": True, "timestamp": "2026-01-01T00:00:00"},
        ])
        r = mon.get_endpoint_stats("/chat")
        assert r["p95_latency"] == 1.0

    def test_get_system_health_degraded(self, monitor_env):
        mon, col = monitor_env
        # Mock RAG service to be degraded
        mon.rag_service.health_check.return_value = {"status": "degraded"}
        r = mon.get_system_health()
        assert r["overall"] == "degraded"

    def test_get_system_health_slow(self, monitor_env):
        mon, col = monitor_env
        FakeCursor = col._FakeCursor
        # High latency
        col.find.return_value = FakeCursor([
            {"endpoint": "/chat", "latency": 15.0, "success": True, "timestamp": "2026-01-01T00:00:00"},
        ])
        r = mon.get_system_health()
        assert r["overall"] == "slow"
