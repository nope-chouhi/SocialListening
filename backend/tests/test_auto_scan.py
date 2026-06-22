import pytest
from unittest.mock import patch, MagicMock

# Import the parts we want to test
from app.core.config import settings
from app.jobs.scan_jobs import run_automated_scans

class TestAutoScanScheduler:
    
    @patch('app.services.scheduler_service.scheduler')
    @patch('app.services.scheduler_service.os.getenv')
    @patch('app.core.config.settings.AUTO_SCAN_ENABLED', False)
    def test_scheduler_not_started_if_disabled(self, mock_getenv, mock_scheduler):
        """Test scheduler does not start automated scanning job when AUTO_SCAN_ENABLED is False."""
        mock_getenv.return_value = "true"  # SCHEDULER_ENABLED
        
        from app.services.scheduler_service import start_scheduler
        # Reset flag if needed
        import app.services.scheduler_service as sched_module
        sched_module.scheduler_started = False
        
        result = start_scheduler(is_embedded=False)
        assert result is True
        
        # Verify that the automated_scan_job was NOT added
        calls = mock_scheduler.add_job.call_args_list
        job_ids = [kwargs.get('id', args[2] if len(args) > 2 else None) for args, kwargs in calls]
        assert 'automated_scan_job' not in job_ids

    @patch('app.services.scheduler_service.scheduler')
    @patch('app.services.scheduler_service.os.getenv')
    @patch('app.core.config.settings.AUTO_SCAN_ENABLED', True)
    def test_scheduler_starts_when_enabled(self, mock_getenv, mock_scheduler):
        """Test scheduler registers automated scanning job when AUTO_SCAN_ENABLED is True."""
        mock_getenv.return_value = "true"
        
        from app.services.scheduler_service import start_scheduler
        import app.services.scheduler_service as sched_module
        sched_module.scheduler_started = False
        
        start_scheduler(is_embedded=False)
        
        # Verify that the automated_scan_job WAS added
        calls = mock_scheduler.add_job.call_args_list
        added_job = None
        for args, kwargs in calls:
            if kwargs.get('id') == 'automated_scan_job':
                added_job = kwargs
                break
                
        assert added_job is not None
        # IntervalTrigger has a minutes property we might check, but it's passed as args
        # We know we used kwargs: trigger=IntervalTrigger(minutes=30)
        # Just verifying it was added is good enough for now

    @patch('app.jobs.scan_jobs.SessionLocal')
    @patch('app.jobs.scan_jobs.execute_scan')
    @patch('app.jobs.scan_jobs.settings')
    def test_run_automated_scans_prevents_overlap(self, mock_settings, mock_execute_scan, mock_session_local):
        """Test run_automated_scans checks CrawlJob status to prevent overlap."""
        mock_settings.AUTO_SCAN_ENABLED = True
        
        # Setup mock DB session
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        # Setup mock keywords and groups
        mock_group = MagicMock()
        mock_group.id = 1
        mock_group.project_id = 100
        
        mock_keyword = MagicMock()
        mock_keyword.keyword = "test"
        
        # Mocking db.execute(select(...)).scalars().all() sequence
        # Call 1: KeywordGroup query -> returns [mock_group]
        # Call 2: Keyword query -> returns [mock_keyword]
        # Call 3: CrawlJob running query -> returns a running job (simulate overlap)
        
        mock_result_groups = MagicMock()
        mock_result_groups.scalars().all.return_value = [mock_group]
        
        mock_result_keywords = MagicMock()
        mock_result_keywords.scalars().all.return_value = [mock_keyword]
        
        mock_running_job = MagicMock()
        mock_running_job.id = 999
        mock_running_job.meta_data = {"project_id": 100}
        
        mock_result_running = MagicMock()
        mock_result_running.scalars().first.return_value = mock_running_job
        
        mock_db.execute.side_effect = [mock_result_groups, mock_result_keywords, mock_result_running]
        
        # Run the function
        run_automated_scans()
        
        # execute_scan should NOT be called because there's already a running job
        mock_execute_scan.assert_not_called()
        mock_db.close.assert_called_once()
        
    @patch('app.jobs.scan_jobs.SessionLocal')
    @patch('app.jobs.scan_jobs.execute_scan')
    @patch('app.jobs.scan_jobs.settings')
    def test_run_automated_scans_executes(self, mock_settings, mock_execute_scan, mock_session_local):
        """Test run_automated_scans runs execute_scan if no overlap."""
        mock_settings.AUTO_SCAN_ENABLED = True
        
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        mock_group = MagicMock()
        mock_group.id = 1
        mock_group.project_id = 100
        
        mock_keyword = MagicMock()
        mock_keyword.keyword = "test"
        
        mock_result_groups = MagicMock()
        mock_result_groups.scalars().all.return_value = [mock_group]
        
        mock_result_keywords = MagicMock()
        mock_result_keywords.scalars().all.return_value = [mock_keyword]
        
        mock_result_running = MagicMock()
        mock_result_running.scalars().first.return_value = None # No running job
        
        mock_db.execute.side_effect = [mock_result_groups, mock_result_keywords, mock_result_running]
        
        run_automated_scans()
        
        # execute_scan SHOULD be called
        mock_execute_scan.assert_called_once()
        args, kwargs = mock_execute_scan.call_args
        assert kwargs["project_id"] == 100
        assert kwargs["keyword_texts"] == ["test"]
        assert kwargs["mode"] == "AUTO_DISCOVERY"
