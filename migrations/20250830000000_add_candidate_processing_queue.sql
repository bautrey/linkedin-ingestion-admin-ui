-- Migration: Add robust candidate processing queue system
-- Created: 2025-08-30
-- Purpose: Replace memory-based job management with database persistence and individual candidate processing

-- 1. Job Definitions Table
CREATE TABLE IF NOT EXISTS job_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    schedule VARCHAR(50) NOT NULL,
    handler_function VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    max_retries INTEGER DEFAULT 3,
    retry_delay_ms INTEGER DEFAULT 5000,
    timeout_ms INTEGER DEFAULT 300000,
    options JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Candidate Processing Queue Table
CREATE TABLE IF NOT EXISTS candidate_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_key VARCHAR(100) NOT NULL,
    candidate_name VARCHAR(200),
    linkedin_url TEXT,
    job_execution_id UUID REFERENCES jira_job_execution_history(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
    priority INTEGER DEFAULT 1,
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    processing_duration_ms INTEGER,
    result JSONB,
    error_message TEXT,
    error_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enhance existing job execution history
ALTER TABLE jira_job_execution_history ADD COLUMN IF NOT EXISTS candidates_queued INTEGER DEFAULT 0;
ALTER TABLE jira_job_execution_history ADD COLUMN IF NOT EXISTS candidates_processed INTEGER DEFAULT 0;
ALTER TABLE jira_job_execution_history ADD COLUMN IF NOT EXISTS candidates_completed INTEGER DEFAULT 0;
ALTER TABLE jira_job_execution_history ADD COLUMN IF NOT EXISTS candidates_failed INTEGER DEFAULT 0;
ALTER TABLE jira_job_execution_history ADD COLUMN IF NOT EXISTS processing_mode VARCHAR(20) DEFAULT 'individual';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_definitions_enabled ON job_definitions(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_job_definitions_name ON job_definitions(name);

CREATE INDEX IF NOT EXISTS idx_candidate_queue_status ON candidate_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_candidate_queue_next_retry ON candidate_processing_queue(next_retry_at) WHERE status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_candidate_queue_job_execution ON candidate_processing_queue(job_execution_id);
CREATE INDEX IF NOT EXISTS idx_candidate_queue_candidate_key ON candidate_processing_queue(candidate_key);
CREATE INDEX IF NOT EXISTS idx_candidate_queue_processing_order ON candidate_processing_queue(created_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_jira_job_execution_history_processing_mode ON jira_job_execution_history(processing_mode);

-- Create helpful views
CREATE OR REPLACE VIEW candidate_queue_statistics AS
SELECT 
    job_execution_id,
    COUNT(*) as total_candidates,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_candidates,
    COUNT(*) FILTER (WHERE status = 'processing') as processing_candidates, 
    COUNT(*) FILTER (WHERE status = 'completed') as completed_candidates,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_candidates,
    COUNT(*) FILTER (WHERE status = 'retrying') as retrying_candidates,
    AVG(processing_duration_ms) FILTER (WHERE status = 'completed') as avg_processing_time_ms,
    MIN(created_at) as first_queued_at,
    MAX(processing_completed_at) as last_completed_at,
    COUNT(*) FILTER (WHERE attempt_count > 1) as candidates_with_retries
FROM candidate_processing_queue
GROUP BY job_execution_id;

CREATE OR REPLACE VIEW job_definitions_with_status AS
SELECT 
    jd.*,
    jjeh.started_at as last_execution_started,
    jjeh.completed_at as last_execution_completed,
    jjeh.status as last_execution_status,
    jjeh.success as last_execution_success,
    jjeh.candidates_queued,
    jjeh.candidates_processed,
    jjeh.candidates_completed,
    jjeh.candidates_failed
FROM job_definitions jd
LEFT JOIN LATERAL (
    SELECT * FROM jira_job_execution_history 
    WHERE job_name = jd.name 
    ORDER BY started_at DESC 
    LIMIT 1
) jjeh ON true;

CREATE OR REPLACE VIEW active_candidate_queue AS
SELECT 
    cpq.*,
    jjeh.job_name,
    jjeh.started_at as job_started_at,
    CASE 
        WHEN cpq.status = 'retrying' AND cpq.next_retry_at <= NOW() THEN 'ready_for_retry'
        WHEN cpq.status = 'processing' AND cpq.processing_started_at < NOW() - INTERVAL '10 minutes' THEN 'potentially_stuck'
        ELSE cpq.status 
    END as effective_status
FROM candidate_processing_queue cpq
JOIN jira_job_execution_history jjeh ON cpq.job_execution_id = jjeh.id
WHERE cpq.status != 'completed' OR cpq.created_at > NOW() - INTERVAL '24 hours'
ORDER BY cpq.created_at ASC;

-- Seed initial job definitions
INSERT INTO job_definitions (name, description, schedule, handler_function, enabled, options) VALUES
('process-recent-candidates', 'Process candidates from JIRA created in last 24 hours', '0 * * * *', 'processRecentCandidates', TRUE, '{"hoursBack": 24, "maxResults": 20, "jobType": "recent"}'),
('process-older-candidates', 'Process older candidates from JIRA backlog (daily batch)', '0 8 * * *', 'processOlderCandidates', TRUE, '{"maxResults": 5, "jobType": "older"}')
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    schedule = EXCLUDED.schedule,
    handler_function = EXCLUDED.handler_function,
    options = EXCLUDED.options,
    updated_at = NOW();

-- Add comments for documentation
COMMENT ON TABLE job_definitions IS 'Persistent job definitions to replace file-based job configuration';
COMMENT ON TABLE candidate_processing_queue IS 'Individual candidate processing queue with retry logic for resilient batch processing';
COMMENT ON COLUMN job_definitions.handler_function IS 'Function name in candidateProcessingJob.js to call for this job';
COMMENT ON COLUMN candidate_processing_queue.status IS 'Processing status: pending -> processing -> completed/failed -> retrying (if applicable)';
COMMENT ON COLUMN candidate_processing_queue.next_retry_at IS 'When this candidate should be retried (if status is retrying)';
COMMENT ON COLUMN jira_job_execution_history.processing_mode IS 'Processing mode: batch (old) vs individual (new queue-based)';