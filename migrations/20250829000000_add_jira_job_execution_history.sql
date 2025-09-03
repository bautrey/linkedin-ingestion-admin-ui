-- Migration: Add JIRA job execution history table
-- Created: 2025-08-29
-- Purpose: Persist JIRA candidate processing job execution history to survive container restarts

CREATE TABLE IF NOT EXISTS jira_job_execution_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(100) NOT NULL,
    execution_id VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'retrying')),
    success BOOLEAN,
    retry_count INTEGER DEFAULT 0,
    result JSONB,
    error_message TEXT,
    is_dry_run BOOLEAN DEFAULT FALSE,
    dry_run_options JSONB,
    triggered_by VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'manual', 'candidate-specific'
    candidate_key VARCHAR(50), -- For candidate-specific executions
    metadata JSONB, -- Additional context data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jira_job_execution_history_job_name ON jira_job_execution_history(job_name);
CREATE INDEX IF NOT EXISTS idx_jira_job_execution_history_started_at ON jira_job_execution_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_jira_job_execution_history_status ON jira_job_execution_history(status);
CREATE INDEX IF NOT EXISTS idx_jira_job_execution_history_candidate_key ON jira_job_execution_history(candidate_key) WHERE candidate_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jira_job_execution_history_triggered_by ON jira_job_execution_history(triggered_by);

-- Add some helpful views
CREATE OR REPLACE VIEW jira_job_execution_summary AS
SELECT 
    job_name,
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE success = true) as successful_executions,
    COUNT(*) FILTER (WHERE success = false) as failed_executions,
    COUNT(*) FILTER (WHERE status = 'running') as currently_running,
    MAX(started_at) as last_execution,
    AVG(duration_ms) FILTER (WHERE success = true) as avg_success_duration_ms,
    AVG(duration_ms) FILTER (WHERE success = false) as avg_failure_duration_ms
FROM jira_job_execution_history 
GROUP BY job_name;

COMMENT ON TABLE jira_job_execution_history IS 'Persistent storage for JIRA candidate processing job execution history, replacing in-memory storage';
COMMENT ON COLUMN jira_job_execution_history.triggered_by IS 'How the JIRA job was initiated: scheduled (cron), manual (admin trigger), candidate-specific (individual candidate processing)';
COMMENT ON COLUMN jira_job_execution_history.candidate_key IS 'JIRA candidate key when job is triggered for specific candidate';
COMMENT ON COLUMN jira_job_execution_history.metadata IS 'Additional context like processing options, batch size, candidates processed, etc.';