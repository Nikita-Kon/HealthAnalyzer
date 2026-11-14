import unittest
from datetime import date, timedelta
from app.services.statistics import calculate_baseline, calculate_deviation, calculate_trend
from app.services.anomalies import detect_statistical_anomaly, detect_combined_anomalies
from app.services.analytics import analyze_health

class AnalyticsTests(unittest.TestCase):
    def test_baseline_requires_seven_and_uses_median(self):
        self.assertIsNone(calculate_baseline([1, 2, 3, 4, 5, 6]))
        self.assertEqual(calculate_baseline([1, 2, 3, 4, 5, 6, 100]), 4)
    def test_deviation_and_trend(self):
        self.assertEqual(calculate_deviation(75, 60), 25)
        self.assertIsNone(calculate_deviation(1, 0))
        self.assertEqual(calculate_trend([1, 2, 3, 4, 5, 6, 8]), 'increasing')
    def test_mad_zero_and_insufficient(self):
        self.assertEqual(detect_statistical_anomaly(9, [2] * 7)['status'], 'statistical_anomaly')
        self.assertEqual(detect_statistical_anomaly(2, [2] * 6)['status'], 'insufficient_data')
    def test_as_of_excludes_future_and_combines(self):
        rows=[]
        start=date(2024,1,1)
        for i in range(8):
            d=(start+timedelta(days=i)).isoformat()
            rows.extend([{'metric':'resting_heart_rate','value':60,'unit':'bpm','measured_at':d}, {'metric':'sleep_duration','value':8,'unit':'hours','measured_at':d}])
        rows.extend([{'metric':'resting_heart_rate','value':100,'unit':'bpm','measured_at':'2024-01-09'}, {'metric':'sleep_duration','value':3,'unit':'hours','measured_at':'2024-01-09'}, {'metric':'resting_heart_rate','value':1,'unit':'bpm','measured_at':'2024-01-10'}])
        result=analyze_health(rows,'2024-01-09')
        self.assertEqual(result['metrics']['resting_heart_rate']['value'],100)
        self.assertEqual(len(result['combined_findings']),1)
        self.assertNotEqual(result['metrics']['resting_heart_rate']['value'],1)

if __name__=='__main__': unittest.main()
